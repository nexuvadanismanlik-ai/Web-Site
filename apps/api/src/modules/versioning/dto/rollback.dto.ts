import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RollbackDto {
  @ApiProperty({ description: 'ID of the PageVersion to roll back to (UUID)' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  versionId!: string;
}
