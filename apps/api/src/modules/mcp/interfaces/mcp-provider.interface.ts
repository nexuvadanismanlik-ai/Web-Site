export type McpProviderType = 'HIGGSFIELD' | 'OPENAI' | 'ANTHROPIC' | 'CUSTOM';
export type McpConnectionStatus = 'PENDING' | 'ACTIVE' | 'ERROR' | 'DISABLED';
export type AgentStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface IMcpProvider {
  id: string;
  name: string;
  type: McpProviderType;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface IMcpConnection {
  id: string;
  providerId: string;
  tenantId: string;
  status: McpConnectionStatus;
  createdAt: Date;
}

export interface IAiAgent {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: AgentStatus;
  createdAt: Date;
}

export interface IAgentPermission {
  id: string;
  agentId: string;
  permission: string;
  createdAt: Date;
}

export interface IWorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
}

export interface IAgentAuditLog {
  id: string;
  tenantId: string;
  agentId: string;
  action: string;
  result: Record<string, unknown> | null;
  createdAt: Date;
}
