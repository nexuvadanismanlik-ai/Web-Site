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

    // Stored hashes are salted, so the presented token cannot be looked up
    // directly — each live token for this user is a candidate and has to be
    // verified in turn. Newest first, since that is nearly always the match,
    // and capped so a user with many sessions cannot turn one refresh into an
    // unbounded run of argon2 verifications.
    const candidates = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    let stored: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await argon2.verify(candidate.tokenHash, dto.refreshToken)) {
        stored = candidate;
        break;
      }
    }

    if (!stored) {
      throw new UnauthorizedException('Refresh token not found or revoked');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Deliberately NOT rotated: the refresh token is returned unchanged and its
    // row stays live.
    //
    // Rotation is the stronger design, but it requires the caller to persist the
    // replacement — and the admin panel refreshes from React server components,
    // which cannot write cookies. Rotating there meant the first refresh revoked
    // the only token the session still had, so every later request failed with
    // Unauthorized. Issuing a fresh access token against a stable refresh token
    // is idempotent, safe under concurrent requests, and adds no row per call.
    //
    // The trade-off is that a stolen refresh token stays usable until it expires
    // or the user signs out or changes their password, both of which revoke it.
    const newPayload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessSecret = this.config.get<string>('jwt.accessSecret');
    const accessExpiry = this.config.get<string>('jwt.accessExpiry', '15m');

    return {
      accessToken: this.jwt.sign(newPayload, {
        secret: accessSecret,
        expiresIn: accessExpiry,
      }),
      refreshToken: dto.refreshToken,
    };
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
