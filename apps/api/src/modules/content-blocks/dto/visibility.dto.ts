import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VisibilityDto {
  @ApiProperty({ description: 'Whether the block is shown in public rendering' })
  @IsBoolean()
  isVisible!: boolean;
}
