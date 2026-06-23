import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleFlagDto {
  @ApiProperty({ description: 'Target enabled state for the flag' })
  @IsBoolean()
  isEnabled!: boolean;
}
