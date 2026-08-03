import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { SetReadDto } from './dto/set-read.dto';

/** Minimal view of the Fastify request — avoids coupling to the adapter type. */
interface RequestLike {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@ApiTags('website-contact')
@Controller('website/contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Submit the public contact form. Unauthenticated; rate limited per IP. ' +
      'Returns an acknowledgement only.',
  })
  @ApiQuery({ name: 'tenant', required: false })
  submit(
    @Body() dto: CreateContactMessageDto,
    @Req() req: RequestLike,
    @Query('tenant') tenant?: string,
  ) {
    const userAgent = req.headers['user-agent'];
    return this.contact.submit(
      dto,
      {
        ip: req.ip,
        userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
      },
      tenant,
    );
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Get()
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List contact messages (paginated, newest first)' })
  list(@Query() query: ListMessagesDto, @Query('tenant') tenant?: string) {
    return this.contact.list(query, tenant);
  }

  @Get(':id')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single contact message' })
  findOne(@Param('id') id: string, @Query('tenant') tenant?: string) {
    return this.contact.findOne(id, tenant);
  }

  @Patch(':id/read')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a message read or unread' })
  setRead(
    @Param('id') id: string,
    @Body() dto: SetReadDto,
    @Query('tenant') tenant?: string,
  ) {
    return this.contact.setRead(id, dto.isRead, tenant);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a contact message' })
  remove(@Param('id') id: string, @Query('tenant') tenant?: string) {
    return this.contact.remove(id, tenant);
  }
}
