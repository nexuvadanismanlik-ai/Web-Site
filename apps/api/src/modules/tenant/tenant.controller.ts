import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TenantService } from './tenant.service';

@ApiTags('tenant')
@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('resolve')
  @ApiOperation({ summary: 'Resolve tenant context by domain' })
  async resolve(@Query('domain') domain: string) {
    if (!domain) {
      throw new NotFoundException('domain query param is required');
    }

    const result = await this.tenantService.resolveFromDomain(domain);

    if (!result.found) {
      throw new NotFoundException(`No tenant for domain: ${domain}`);
    }

    return { success: true, data: result.context };
  }
}
