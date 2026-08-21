"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpService = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/client/sse.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const embeddedMcpServer_1 = require("./embeddedMcpServer");
const mcpDbService_1 = require("./mcpDbService");
const logger_1 = require("../utils/logger");
class McpService {
    static instance;
    _logger = logger_1.Logger.getInstance();
    _db = mcpDbService_1.McpDbService.getInstance();
    _embedded = embeddedMcpServer_1.EmbeddedMcpServer.getInstance();
    _clients = new Map();
    _statuses = new Map();
    _config = { mcpServers: {} };
    _workspaceRoot;
    constructor() { }
    static getInstance() {
        if (!McpService.instance) {
            McpService.instance = new McpService();
        }
        return McpService.instance;
    }
    async loadConfig(workspaceRoot) {
        if (workspaceRoot) {
            this._workspaceRoot = workspaceRoot;
        }
        const config = { mcpServers: {} };
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
                }
                catch (e) {
                    this._logger.error(`[McpService] Failed to parse MCP config at ${mcpPath}:`, e);
                }
            }
        }
        // 2. Check Global Claude Desktop Config if available on macOS / Linux / Windows
        try {
            const homeDir = os.homedir();
            const claudeConfigPath = process.platform === 'darwin'
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
                            config.mcpServers[sName] = sConf;
                        }
                    }
                    this._logger.log(`[McpService] Discovered global MCP servers from Claude Desktop config`);
                }
            }
        }
        catch {
            // ignore
        }
        this._config = config;
        await this._connectServers();
    }
    async _connectServers() {
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
    async _connectSingleServer(name, config) {
        this._statuses.set(name, { status: 'connecting' });
        const startTime = Date.now();
        try {
            this._logger.log(`[McpService] Connecting to MCP server: ${name} (${config.type || (config.url ? 'sse' : 'stdio')})`);
            let transport;
            if (config.url || config.type === 'sse') {
                transport = new sse_js_1.SSEClientTransport(new URL(config.url));
            }
            else {
                transport = new stdio_js_1.StdioClientTransport({
                    command: config.command || 'node',
                    args: config.args || [],
                    env: { ...process.env, ...(config.env || {}) }
                });
            }
            const client = new index_js_1.Client({ name: 'Chanakya AI Enhancer', version: '0.1.5' }, { capabilities: {} });
            await client.connect(transport);
            const latencyMs = Date.now() - startTime;
            this._clients.set(name, client);
            this._statuses.set(name, { status: 'connected', latencyMs });
            this._logger.log(`[McpService] Successfully connected to MCP server: ${name} in ${latencyMs}ms`);
        }
        catch (e) {
            this._logger.error(`[McpService] Failed to connect to MCP server ${name}:`, e);
            this._statuses.set(name, { status: 'error', error: e.message || 'Connection failed' });
        }
    }
    async getServersStatus() {
        const infos = [];
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
            const tools = [];
            const resources = [];
            const prompts = [];
            if (client && st.status === 'connected') {
                try {
                    const tRes = await client.request({ method: 'tools/list' }, types_js_1.ListToolsResultSchema);
                    for (const t of tRes.tools) {
                        tools.push({
                            name: t.name,
                            serverName: name,
                            description: t.description,
                            inputSchema: t.inputSchema
                        });
                    }
                }
                catch {
                    // ignore
                }
                try {
                    const rRes = await client.request({ method: 'resources/list' }, types_js_1.ListResourcesResultSchema);
                    for (const r of rRes.resources) {
                        resources.push({
                            uri: r.uri,
                            name: r.name,
                            serverName: name,
                            description: r.description,
                            mimeType: r.mimeType
                        });
                    }
                }
                catch {
                    // ignore
                }
                try {
                    const pRes = await client.request({ method: 'prompts/list' }, types_js_1.ListPromptsResultSchema);
                    for (const p of pRes.prompts) {
                        prompts.push({
                            name: p.name,
                            serverName: name,
                            description: p.description,
                            arguments: p.arguments
                        });
                    }
                }
                catch {
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
    async addServer(name, config) {
        this._config.mcpServers[name] = config;
        await this._saveWorkspaceConfig();
        await this._connectSingleServer(name, config);
    }
    async removeServer(name) {
        const client = this._clients.get(name);
        if (client) {
            try {
                await client.close();
            }
            catch {
                // ignore
            }
            this._clients.delete(name);
        }
        this._statuses.delete(name);
        delete this._config.mcpServers[name];
        await this._saveWorkspaceConfig();
    }
    async toggleServer(name, enabled) {
        if (!this._config.mcpServers[name])
            return;
        this._config.mcpServers[name].disabled = !enabled;
        await this._saveWorkspaceConfig();
        if (enabled) {
            await this._connectSingleServer(name, this._config.mcpServers[name]);
        }
        else {
            const client = this._clients.get(name);
            if (client) {
                try {
                    await client.close();
                }
                catch {
                    // ignore
                }
                this._clients.delete(name);
            }
            this._statuses.set(name, { status: 'offline' });
        }
    }
    async pingServer(name) {
        if (name === 'chanakya-embedded')
            return 1;
        const client = this._clients.get(name);
        if (!client) {
            const conf = this._config.mcpServers[name];
            if (conf) {
                await this._connectSingleServer(name, conf);
            }
        }
        const activeClient = this._clients.get(name);
        if (!activeClient)
            throw new Error(`Server ${name} is offline or not found.`);
        const startTime = Date.now();
        await activeClient.request({ method: 'tools/list' }, types_js_1.ListToolsResultSchema);
        const latencyMs = Date.now() - startTime;
        this._statuses.set(name, { status: 'connected', latencyMs });
        return latencyMs;
    }
    async _saveWorkspaceConfig() {
        if (!this._workspaceRoot)
            return;
        const vscodeDir = path.join(this._workspaceRoot, '.vscode');
        if (!fs.existsSync(vscodeDir))
            fs.mkdirSync(vscodeDir, { recursive: true });
        const mcpPath = path.join(vscodeDir, 'mcp.json');
        fs.writeFileSync(mcpPath, JSON.stringify(this._config, null, 2), 'utf-8');
        this._logger.log(`[McpService] Saved updated MCP config to ${mcpPath}`);
    }
    async getAvailableTools() {
        const allTools = [];
        // 1. Embedded Tools
        for (const tool of this._embedded.getTools()) {
            allTools.push({ serverName: 'chanakya-embedded', tool });
        }
        // 2. Connected External MCP Servers
        for (const [name, client] of this._clients.entries()) {
            try {
                const response = await client.request({ method: 'tools/list' }, types_js_1.ListToolsResultSchema);
                for (const tool of response.tools) {
                    allTools.push({
                        serverName: name,
                        tool: {
                            name: tool.name,
                            serverName: name,
                            description: tool.description,
                            inputSchema: tool.inputSchema
                        }
                    });
                }
            }
            catch (e) {
                this._logger.error(`Failed to list tools for ${name}:`, e);
            }
        }
        return allTools;
    }
    async callTool(serverName, toolName, args) {
        const startTime = Date.now();
        // 1. Handle Embedded Chanakya Tools
        if (serverName === 'chanakya-embedded' || toolName.startsWith('chanakya_')) {
            try {
                const result = await this._embedded.executeTool(toolName, args);
                const latencyMs = Date.now() - startTime;
                this._db.logExecution(serverName, toolName, args, result, latencyMs, true);
                return result;
            }
            catch (err) {
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
            const result = await client.request({ method: 'tools/call', params: { name: toolName, arguments: args || {} } }, types_js_1.CallToolResultSchema);
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
        }
        catch (e) {
            const latencyMs = Date.now() - startTime;
            this._db.logExecution(serverName, toolName, args, undefined, latencyMs, false, e.message);
            this._logger.error(`Failed to call tool ${toolName} on ${serverName}:`, e);
            throw e;
        }
    }
    async readResource(serverName, uri) {
        if (serverName === 'chanakya-embedded') {
            return this._embedded.readResource(uri);
        }
        const client = this._clients.get(serverName);
        if (!client)
            throw new Error(`MCP Server "${serverName}" is not connected.`);
        const res = await client.request({ method: 'resources/read', params: { uri } }, types_js_1.ReadResourceResultSchema);
        return res.contents.map((c) => (c.text ? c.text : `[Blob/Binary: ${c.blob}]`)).join('\n');
    }
    dispose() {
        for (const client of this._clients.values()) {
            try {
                client.close();
            }
            catch {
                // ignore
            }
        }
        this._clients.clear();
        this._statuses.clear();
    }
}
exports.McpService = McpService;
//# sourceMappingURL=mcpService.js.map