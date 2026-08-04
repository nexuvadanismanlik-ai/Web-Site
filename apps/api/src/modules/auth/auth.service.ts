import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RefreshDto } from './dto/refresh.dto';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const { accessToken, refreshToken } = await this.signTokenPair(payload, user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async refresh(dto: RefreshDto) {
    const refreshSecret = this.config.get<string>('jwt.refreshSecret');

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(dto.refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = await argon2.hash(dto.refreshToken);

    // Find a stored token that matches hash and is not revoked
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token not found or revoked');
    }

    // Verify the raw token against stored hash
    const hashValid = await argon2.verify(stored.tokenHash, dto.refreshToken);
    if (!hashValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate: revoke current token, issue new pair
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('User account is inactive');
    }

    const newPayload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const tokens = await this.signTokenPair(newPayload, user.id);

    return tokens;
  }

  /**
   * Changes the signed-in user's password after re-verifying the current one,
   * then revokes every refresh token so other sessions cannot keep acting as
   * them with credentials that no longer exist.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Account is not active');
    }

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Mevcut şifre hatalı');
    }

    if (await argon2.verify(user.passwordHash, newPassword)) {
      throw new BadRequestException('Yeni şifre mevcut şifreyle aynı olamaz');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await argon2.hash(newPassword) },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    return { success: true };
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  private async signTokenPair(
    payload: JwtPayload,
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessSecret = this.config.get<string>('jwt.accessSecret');
    const refreshSecret = this.config.get<string>('jwt.refreshSecret');
    const accessExpiry = this.config.get<string>('jwt.accessExpiry', '15m');
    const refreshExpiry = this.config.get<string>('jwt.refreshExpiry', '7d');

    const accessToken = this.jwt.sign(payload, { secret: accessSecret, expiresIn: accessExpiry });
    const refreshToken = this.jwt.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiry,
    });

    const tokenHash = await argon2.hash(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
