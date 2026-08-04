import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'The password currently in use' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ description: 'The new password', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Yeni şifre en az 8 karakter olmalı' })
  @MaxLength(200)
  newPassword!: string;
}
