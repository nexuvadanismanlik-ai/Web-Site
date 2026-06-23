import { Injectable } from '@nestjs/common';

/**
 * McpService — Architecture placeholder for AI/MCP integration.
 *
 * No business logic is implemented here. This service will be wired to
 * actual MCP providers (Higgsfield, etc.) in a future phase when AI features
 * are ready to be built. The database schema (mcp_providers, mcp_connections,
 * ai_agents, agent_permissions, workflow_definitions, agent_audit_logs) is
 * already in place so migrations will not be required at that point.
 *
 * Extension points:
 *   - registerProvider(dto): persist a new MCP provider record
 *   - connectTenant(providerId, tenantId): create a connection record
 *   - createAgent(tenantId, dto): scaffold an agent record
 *   - dispatchWorkflow(workflowId, payload): execute a workflow definition
 *   - auditAgentAction(tenantId, agentId, action, result): write audit trail
 */
@Injectable()
export class McpService {
  // Implementation deferred to AI phase.
}
