import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import {
  CallToolResultSchema,
  ListToolsResultSchema,
  ListResourcesResultSchema,
  ReadResourceResultSchema,
  ListPromptsResultSchema
} from '@modelcontextprotocol/sdk/types.js';
import {
  McpServerConfig,
  McpServersConfig,
  McpServerInfo,
  McpServerStatus,
  McpToolDefinition,
  McpResourceDefinition,
  McpPromptDefinition
} from '../types/mcp';
import { EmbeddedMcpServer } from './embeddedMcpServer';
import { McpDbService } from './mcpDbService';
import { Logger } from '../utils/logger';

export class McpService {
  private static instance: McpService;
  private _logger = Logger.getInstance();
  private _db = McpDbService.getInstance();
  private _embedded = EmbeddedMcpServer.getInstance();

  private _clients: Map<string, Client> = new Map();
  private _statuses: Map<string, { status: McpServerStatus; error?: string; latencyMs?: number }> = new Map();
  private _config: McpServersConfig = { mcpServers: {} };
  private _workspaceRoot: string | undefined;

  private constructor() {}

  public static getInstance(): McpService {
    if (!McpService.instance) {
      McpService.instance = new McpService();
    }
    return McpService.instance;
  }

  public async loadConfig(workspaceRoot?: string) {
    if (workspaceRoot) {
      this._workspaceRoot = workspaceRoot;
    }

    const config: McpServersConfig = { mcpServers: {} };

    // 1. Check workspace .vscode/mcp.json
    if (this._workspaceRoot) {
      const mcpPath = path.join(this._workspaceRoot, '.vscode', 'mcp.json');
      if (fs.existsSync(mcpPath)) {
        try {
          const content = fs.readFileSync(mcpPath, 'utf8');
          const parsed = JSON.parse(content);
          if (parsed.mcpServers) {
            Object.assign(config.mcpServers, parsed.mcpServers);
            this._logger.log(`[McpService] Loaded ${Object.keys(parsed.mcpServers).length} servers from ${mcpPath}`);
          }
        } catch (e: any) {
          this._logger.error(`[McpService] Failed to parse MCP config at ${mcpPath}:`, e);
        }
      }
    }

    // 2. Check Global Claude Desktop Config if available on macOS / Linux / Windows
    try {
      const homeDir = os.homedir();
      const claudeConfigPath =
        process.platform === 'darwin'
          ? path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
          : process.platform === 'win32'
          ? path.join(process.env.APPDATA || homeDir, 'Claude', 'claude_desktop_config.json')
          : path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');

      if (fs.existsSync(claudeConfigPath)) {
        const content = fs.readFileSync(claudeConfigPath, 'utf8');
        const parsed = JSON.parse(content);
        if (parsed.mcpServers) {
          for (const [sName, sConf] of Object.entries(parsed.mcpServers)) {
            if (!config.mcpServers[sName]) {
              config.mcpServers[sName] = sConf as McpServerConfig;
            }
          }
          this._logger.log(`[McpService] Discovered global MCP servers from Claude Desktop config`);
        }
      }
    } catch {
      // ignore
    }

    this._config = config;
    await this._connectServers();
  }

  private async _connectServers() {
    for (const [name, srvConfig] of Object.entries(this._config.mcpServers)) {
      if (srvConfig.disabled) {
        this._statuses.set(name, { status: 'offline' });
        continue;
      }

      if (!this._clients.has(name)) {
        await this._connectSingleServer(name, srvConfig);
      }
    }
  }

  private async _connectSingleServer(name: string, config: McpServerConfig) {
    this._statuses.set(name, { status: 'connecting' });
    const startTime = Date.now();

    try {
      this._logger.log(`[McpService] Connecting to MCP server: ${name} (${config.type || (config.url ? 'sse' : 'stdio')})`);

      let transport: any;
      if (config.url || config.type === 'sse') {
        transport = new SSEClientTransport(new URL(config.url!));
      } else {
        transport = new StdioClientTransport({
          command: config.command || 'node',
          args: config.args || [],
          env: { ...process.env, ...(config.env || {}) } as Record<string, string>
        });
      }

      const client = new Client(
        { name: 'Chanakya AI Agent', version: '0.1.5' },
        { capabilities: {} }
      );

      await client.connect(transport);
      const latencyMs = Date.now() - startTime;

      this._clients.set(name, client);
      this._statuses.set(name, { status: 'connected', latencyMs });
      this._logger.log(`[McpService] Successfully connected to MCP server: ${name} in ${latencyMs}ms`);
    } catch (e: any) {
      this._logger.error(`[McpService] Failed to connect to MCP server ${name}:`, e);
      this._statuses.set(name, { status: 'error', error: e.message || 'Connection failed' });
    }
  }

  public async getServersStatus(): Promise<McpServerInfo[]> {
    const infos: McpServerInfo[] = [];

    // 1. Add Embedded Chanakya Server
    const embeddedTools = this._embedded.getTools();
    const embeddedResources = this._embedded.getResources();
    const embeddedPrompts = this._embedded.getPrompts();

    infos.push({
      id: 'chanakya-embedded',
      name: 'Chanakya Embedded Server',
      type: 'embedded',
      config: { type: 'embedded' },
      status: 'connected',
      latencyMs: 1,
      tools: embeddedTools,
      resources: embeddedResources,
      prompts: embeddedPrompts
    });

    // 2. Add Configured MCP Servers
    for (const [name, conf] of Object.entries(this._config.mcpServers)) {
      const client = this._clients.get(name);
      const st = this._statuses.get(name) || { status: 'offline' };
      const tools: McpToolDefinition[] = [];
      const resources: McpResourceDefinition[] = [];
      const prompts: McpPromptDefinition[] = [];

      if (client && st.status === 'connected') {
        try {
          const tRes = await client.request({ method: 'tools/list' }, ListToolsResultSchema);
          for (const t of tRes.tools) {
            tools.push({
              name: t.name,
              serverName: name,
              description: t.description,
              inputSchema: t.inputSchema as any
            });
          }
        } catch {
          // ignore
        }

        try {
          const rRes = await client.request({ method: 'resources/list' }, ListResourcesResultSchema);
          for (const r of rRes.resources) {
            resources.push({
              uri: r.uri,
              name: r.name,
              serverName: name,
              description: r.description,
              mimeType: r.mimeType
            });
          }
        } catch {
          // ignore
        }

        try {
          const pRes = await client.request({ method: 'prompts/list' }, ListPromptsResultSchema);
          for (const p of pRes.prompts) {
            prompts.push({
              name: p.name,
              serverName: name,
              description: p.description,
              arguments: p.arguments
            });
          }
        } catch {
          // ignore
        }
      }

      infos.push({
        id: name,
        name,
        type: conf.url || conf.type === 'sse' ? 'sse' : 'stdio',
        config: conf,
        status: st.status,
        latencyMs: st.latencyMs,
        error: st.error,
        tools,
        resources,
        prompts
      });
    }

    return infos;
  }

  public async addServer(name: string, config: McpServerConfig): Promise<void> {
    this._config.mcpServers[name] = config;
    await this._saveWorkspaceConfig();
    await this._connectSingleServer(name, config);
  }

  public async removeServer(name: string): Promise<void> {
    const client = this._clients.get(name);
    if (client) {
      try {
        await client.close();
      } catch {
        // ignore
      }
      this._clients.delete(name);
    }
    this._statuses.delete(name);
    delete this._config.mcpServers[name];
    await this._saveWorkspaceConfig();
  }

  public async toggleServer(name: string, enabled: boolean): Promise<void> {
    if (!this._config.mcpServers[name]) return;
    this._config.mcpServers[name].disabled = !enabled;
    await this._saveWorkspaceConfig();

    if (enabled) {
      await this._connectSingleServer(name, this._config.mcpServers[name]);
    } else {
      const client = this._clients.get(name);
      if (client) {
        try {
          await client.close();
        } catch {
          // ignore
        }
        this._clients.delete(name);
      }
      this._statuses.set(name, { status: 'offline' });
    }
  }

  public async pingServer(name: string): Promise<number> {
    if (name === 'chanakya-embedded') return 1;

    const client = this._clients.get(name);
    if (!client) {
      const conf = this._config.mcpServers[name];
      if (conf) {
        await this._connectSingleServer(name, conf);
      }
    }

    const activeClient = this._clients.get(name);
    if (!activeClient) throw new Error(`Server ${name} is offline or not found.`);

    const startTime = Date.now();
    await activeClient.request({ method: 'tools/list' }, ListToolsResultSchema);
    const latencyMs = Date.now() - startTime;

    this._statuses.set(name, { status: 'connected', latencyMs });
    return latencyMs;
  }

  private async _saveWorkspaceConfig(): Promise<void> {
    if (!this._workspaceRoot) return;
    const vscodeDir = path.join(this._workspaceRoot, '.vscode');
    if (!fs.existsSync(vscodeDir)) fs.mkdirSync(vscodeDir, { recursive: true });
    const mcpPath = path.join(vscodeDir, 'mcp.json');
    fs.writeFileSync(mcpPath, JSON.stringify(this._config, null, 2), 'utf-8');
    this._logger.log(`[McpService] Saved updated MCP config to ${mcpPath}`);
  }

  public async getAvailableTools(): Promise<{ serverName: string; tool: McpToolDefinition }[]> {
    const allTools: { serverName: string; tool: McpToolDefinition }[] = [];

    // 1. Embedded Tools
    for (const tool of this._embedded.getTools()) {
      allTools.push({ serverName: 'chanakya-embedded', tool });
    }

    // 2. Connected External MCP Servers
    for (const [name, client] of this._clients.entries()) {
      try {
        const response = await client.request({ method: 'tools/list' }, ListToolsResultSchema);
        for (const tool of response.tools) {
          allTools.push({
            serverName: name,
            tool: {
              name: tool.name,
              serverName: name,
              description: tool.description,
              inputSchema: tool.inputSchema as any
            }
          });
        }
      } catch (e: any) {
        this._logger.error(`Failed to list tools for ${name}:`, e);
      }
    }

    return allTools;
  }

  public async callTool(serverName: string, toolName: string, args: Record<string, any>): Promise<string> {
    const startTime = Date.now();

    // 1. Handle Embedded Chanakya Tools
    if (serverName === 'chanakya-embedded' || toolName.startsWith('chanakya_')) {
      try {
        const result = await this._embedded.executeTool(toolName, args);
        const latencyMs = Date.now() - startTime;
        this._db.logExecution(serverName, toolName, args, result, latencyMs, true);
        return result;
      } catch (err: any) {
        const latencyMs = Date.now() - startTime;
        this._db.logExecution(serverName, toolName, args, undefined, latencyMs, false, err.message);
        throw err;
      }
    }

    // 2. Check Tool Cache
    const cached = this._db.getCachedResult(serverName, toolName, args);
    if (cached) {
      this._logger.log(`[McpService] Cache HIT for ${serverName}:${toolName}`);
      return cached;
    }

    // 3. Handle External MCP Servers
    let client = this._clients.get(serverName);
    if (!client) {
      if (this._config.mcpServers[serverName]) {
        await this._connectSingleServer(serverName, this._config.mcpServers[serverName]);
        client = this._clients.get(serverName);
      }
      if (!client) {
        throw new Error(`MCP Server "${serverName}" is not connected.`);
      }
    }

    try {
      const result = await client.request(
        { method: 'tools/call', params: { name: toolName, arguments: args || {} } },
        CallToolResultSchema
      );

      const latencyMs = Date.now() - startTime;
      if (result.isError) {
        const errMsg = result.content.map((c) => (c.type === 'text' ? c.text : 'Error')).join('\n');
        this._db.logExecution(serverName, toolName, args, undefined, latencyMs, false, errMsg);
        throw new Error(errMsg);
      }

      const textOutput = result.content.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n');
      this._db.logExecution(serverName, toolName, args, textOutput, latencyMs, true);
      this._db.cacheResult(serverName, toolName, args, textOutput, 20000);
      return textOutput;
    } catch (e: any) {
      const latencyMs = Date.now() - startTime;
      this._db.logExecution(serverName, toolName, args, undefined, latencyMs, false, e.message);
      this._logger.error(`Failed to call tool ${toolName} on ${serverName}:`, e);
      throw e;
    }
  }

  public async readResource(serverName: string, uri: string): Promise<string> {
    if (serverName === 'chanakya-embedded') {
      return this._embedded.readResource(uri);
    }

    const client = this._clients.get(serverName);
    if (!client) throw new Error(`MCP Server "${serverName}" is not connected.`);

    const res = await client.request({ method: 'resources/read', params: { uri } }, ReadResourceResultSchema);
    return res.contents.map((c: any) => (c.text ? c.text : `[Blob/Binary: ${c.blob}]`)).join('\n');
  }

  public dispose() {
    for (const client of this._clients.values()) {
      try {
        client.close();
      } catch {
        // ignore
      }
    }
    this._clients.clear();
    this._statuses.clear();
  }
}
