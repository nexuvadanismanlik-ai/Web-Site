import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../../common/decorators/response.decorator';
import {
  OFFERED_TIMEZONES,
  SitePreferencesService,
  type SitePreferences,
} from './site-preferences.service';

export class SavePreferencesDto {
  @IsOptional()
  @IsIn(OFFERED_TIMEZONES as unknown as string[])
  timezone?: string;
}

@ApiTags('website-preferences')
@ApiBearerAuth()
@Controller('website/preferences')
export class SitePreferencesController {
  constructor(private readonly preferences: SitePreferencesService) {}

  @Get()
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Panel preferences: timezone. Not part of published content.' })
  @ApiQuery({ name: 'tenant', required: false })
  async read(@Query('tenant') tenant?: string): Promise<SitePreferences & { options: string[] }> {
    const current = await this.preferences.get(tenant);
    return { ...current, options: [...OFFERED_TIMEZONES] };
  }

  @Put()
  @Roles('ADMIN')
  @ResponseMessage('Tercihler kaydedildi')
  @ApiOperation({ summary: 'Update panel preferences. Takes effect immediately, no publish.' })
  @ApiQuery({ name: 'tenant', required: false })
  save(@Body() dto: SavePreferencesDto, @Query('tenant') tenant?: string) {
    return this.preferences.save(dto, tenant);
  }
}
