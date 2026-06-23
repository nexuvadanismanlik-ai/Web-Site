import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token issued at login' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
