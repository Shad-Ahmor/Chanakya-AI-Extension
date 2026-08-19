
import * as path from 'path';
import * as fs from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '../utils/logger';

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface McpServersConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export class McpService {
  private static instance: McpService;
  private _logger = Logger.getInstance();
  private _clients: Map<string, Client> = new Map();
  private _config: McpServersConfig = { mcpServers: {} };

  private constructor() {}

  public static getInstance(): McpService {
    if (!McpService.instance) {
      McpService.instance = new McpService();
    }
    return McpService.instance;
  }

  public async loadConfig(workspaceRoot?: string) {
    if (workspaceRoot) {
      const mcpPath = path.join(workspaceRoot, '.vscode', 'mcp.json');
      if (fs.existsSync(mcpPath)) {
        try {
          const content = fs.readFileSync(mcpPath, 'utf8');
          this._config = JSON.parse(content);
          this._logger.log(`Loaded MCP config from ${mcpPath}`);
          await this._connectServers();
          return;
        } catch (e: any) {
          this._logger.error(`Failed to parse MCP config at ${mcpPath}:`, e);
        }
      }
    }
  }

  private async _connectServers() {
    for (const [name, config] of Object.entries(this._config.mcpServers)) {
      if (!this._clients.has(name)) {
        try {
          this._logger.log(`Connecting to MCP server: ${name}`);
          const transport = new StdioClientTransport({
            command: config.command,
            args: config.args || [],
            env: { ...process.env, ...(config.env || {}) } as Record<string, string>
          });
          
          const client = new Client(
            { name: "Chanakya AI Enhancer", version: "0.1.5" },
            { capabilities: {} }
          );
          
          await client.connect(transport);
          this._clients.set(name, client);
          this._logger.log(`Successfully connected to MCP server: ${name}`);
        } catch (e: any) {
          this._logger.error(`Failed to connect to MCP server ${name}:`, e);
        }
      }
    }
  }

  public async getAvailableTools(): Promise<{ serverName: string; tool: any }[]> {
    const allTools: { serverName: string; tool: any }[] = [];
    
    for (const [name, client] of this._clients.entries()) {
      try {
        const response = await client.request({ method: "tools/list" }, ListToolsResultSchema);
        for (const tool of response.tools) {
          allTools.push({ serverName: name, tool });
        }
      } catch (e: any) {
        this._logger.error(`Failed to list tools for ${name}:`, e);
      }
    }
    
    return allTools;
  }

  public async callTool(serverName: string, toolName: string, args: Record<string, any>): Promise<any> {
    const client = this._clients.get(serverName);
    if (!client) {
      throw new Error(`MCP Server ${serverName} not connected.`);
    }

    try {
      const result = await client.request(
        { method: "tools/call", params: { name: toolName, arguments: args } },
        CallToolResultSchema
      );
      
      if (result.isError) {
        throw new Error(result.content.map(c => c.type === 'text' ? c.text : 'Unknown Error').join('\\n'));
      }
      
      return result.content.map(c => c.type === 'text' ? c.text : JSON.stringify(c)).join('\\n');
    } catch (e: any) {
      this._logger.error(`Failed to call tool ${toolName} on ${serverName}:`, e);
      throw e;
    }
  }

  public dispose() {
    for (const client of this._clients.values()) {
      try {
        client.close();
      } catch (e) {
        // ignore
      }
    }
    this._clients.clear();
  }
}
