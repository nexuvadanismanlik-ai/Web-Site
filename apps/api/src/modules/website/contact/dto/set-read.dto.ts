import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetReadDto {
  @ApiProperty({ description: 'Mark the message as read (true) or unread (false)' })
  @IsBoolean()
  isRead!: boolean;
}
