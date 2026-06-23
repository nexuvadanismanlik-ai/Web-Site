import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';

/**
 * McpModule — Architecture extension point for AI/MCP integration.
 * No routes or controllers are registered here.
 * The Prisma models (McpProvider, McpConnection, AiAgent, etc.) are already
 * migrated. Wire McpService into feature modules when AI features are activated.
 */
@Module({
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
