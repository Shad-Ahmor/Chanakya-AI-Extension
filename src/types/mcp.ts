export type McpTransportType = 'stdio' | 'sse' | 'embedded';
export type McpServerStatus = 'connected' | 'connecting' | 'error' | 'offline';

export interface McpServerConfig {
  type?: McpTransportType | undefined;
  command?: string | undefined;
  args?: string[] | undefined;
  env?: Record<string, string> | undefined;
  url?: string | undefined; // For SSE / HTTP transports
  disabled?: boolean | undefined;
  autoApprove?: string[] | undefined; // Tool names that don't need manual confirmation
}

export interface McpServersConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export interface McpServerInfo {
  id: string;
  name: string;
  type: McpTransportType;
  config: McpServerConfig;
  status: McpServerStatus;
  latencyMs?: number | undefined;
  error?: string | undefined;
  tools: McpToolDefinition[];
  resources: McpResourceDefinition[];
  prompts: McpPromptDefinition[];
}

export interface McpToolDefinition {
  name: string;
  serverName: string;
  description?: string | undefined;
  inputSchema?: {
    type: string;
    properties?: Record<string, any> | undefined;
    required?: string[] | undefined;
  } | undefined;
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  serverName: string;
  description?: string | undefined;
  mimeType?: string | undefined;
}

export interface McpPromptDefinition {
  name: string;
  serverName: string;
  description?: string | undefined;
  arguments?: {
    name: string;
    description?: string | undefined;
    required?: boolean | undefined;
  }[] | undefined;
}

export interface McpToolExecutionLog {
  id: string;
  timestamp: number;
  serverName: string;
  toolName: string;
  args: Record<string, any>;
  result?: string | undefined;
  latencyMs: number;
  success: boolean;
  error?: string | undefined;
}

export interface McpPreset {
  id: string;
  name: string;
  description: string;
  category: 'database' | 'filesystem' | 'developer' | 'web' | 'memory' | 'custom';
  icon: string;
  command: string;
  args: string[];
  env?: Record<string, string> | undefined;
  url?: string | undefined;
  requiresConfig?: boolean | undefined;
  configFields?: {
    key: string;
    label: string;
    type: 'string' | 'password' | 'path';
    placeholder: string;
    description: string;
  }[] | undefined;
}
