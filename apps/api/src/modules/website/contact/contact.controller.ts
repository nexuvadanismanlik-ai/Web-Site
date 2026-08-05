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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ContactService } from './contact.service';
import { LeadService } from './lead.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { SetReadDto } from './dto/set-read.dto';
import {
  AddLeadNoteDto,
  AssignLeadDto,
  SetLeadStatusDto,
  SetLeadTagsDto,
} from './dto/lead.dto';

/** Minimal view of the Fastify request — avoids coupling to the adapter type. */
interface RequestLike {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@ApiTags('website-contact')
@Controller('website/contact')
export class ContactController {
  constructor(
    private readonly contact: ContactService,
    private readonly leads: LeadService,
  ) {}

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

  // Declared before ':id/read' so the literal segment is not captured as an id.
  @Patch('read-all')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark every unread message read, in one statement' })
  @ApiQuery({ name: 'tenant', required: false })
  markAllRead(@Query('tenant') tenant?: string) {
    return this.contact.markAllRead(tenant);
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

  // ─── Pipeline ─────────────────────────────────────────────────────────────

  @Get('pipeline/counts')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'How many leads sit in each pipeline stage' })
  @ApiQuery({ name: 'tenant', required: false })
  pipeline(@Query('tenant') tenant?: string) {
    return this.leads.pipelineCounts(tenant);
  }

  @Get('pipeline/assignees')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Users a lead can be assigned to' })
  assignees() {
    return this.leads.assignees();
  }

  @Get(':id/detail')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'A lead with its notes, timeline and attachments' })
  @ApiQuery({ name: 'tenant', required: false })
  detail(@Param('id') id: string, @Query('tenant') tenant?: string) {
    return this.leads.findOne(id, tenant);
  }

  @Patch(':id/status')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Move a lead to another pipeline stage' })
  @ApiQuery({ name: 'tenant', required: false })
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetLeadStatusDto,
    @CurrentUser('id') userId: string,
    @Query('tenant') tenant?: string,
  ) {
    return this.leads.setStatus(id, dto.status, userId, tenant);
  }

  @Patch(':id/assign')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign a lead to a user, or clear the assignment' })
  @ApiQuery({ name: 'tenant', required: false })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
    @CurrentUser('id') userId: string,
    @Query('tenant') tenant?: string,
  ) {
    return this.leads.assign(id, dto.userId ?? null, userId, tenant);
  }

  @Patch(':id/tags')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace a lead\'s tags' })
  @ApiQuery({ name: 'tenant', required: false })
  setTags(
    @Param('id') id: string,
    @Body() dto: SetLeadTagsDto,
    @CurrentUser('id') userId: string,
    @Query('tenant') tenant?: string,
  ) {
    return this.leads.setTags(id, dto.tags, userId, tenant);
  }

  @Post(':id/notes')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a note to a lead' })
  @ApiQuery({ name: 'tenant', required: false })
  addNote(
    @Param('id') id: string,
    @Body() dto: AddLeadNoteDto,
    @CurrentUser('id') userId: string,
    @Query('tenant') tenant?: string,
  ) {
    return this.leads.addNote(id, dto.body, userId, tenant);
  }

  @Delete('notes/:noteId')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a note' })
  @ApiQuery({ name: 'tenant', required: false })
  removeNote(
    @Param('noteId') noteId: string,
    @CurrentUser('id') userId: string,
    @Query('tenant') tenant?: string,
  ) {
    return this.leads.removeNote(noteId, userId, tenant);
  }
}
