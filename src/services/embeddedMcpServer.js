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
exports.EmbeddedMcpServer = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const graphifyService_1 = require("./graphifyService");
class EmbeddedMcpServer {
    static instance;
    memoryStore = new Map();
    constructor() { }
    static getInstance() {
        if (!EmbeddedMcpServer.instance) {
            EmbeddedMcpServer.instance = new EmbeddedMcpServer();
        }
        return EmbeddedMcpServer.instance;
    }
    getTools() {
        return [
            {
                name: 'chanakya_fs_read',
                serverName: 'chanakya-embedded',
                description: 'Read the contents of a workspace file with optional line range.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Relative or absolute file path' },
                        startLine: { type: 'number', description: 'Optional 1-indexed start line' },
                        endLine: { type: 'number', description: 'Optional 1-indexed end line' }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'chanakya_fs_write',
                serverName: 'chanakya-embedded',
                description: 'Create or overwrite a file in the open workspace.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Relative or absolute file path' },
                        content: { type: 'string', description: 'File contents to write' }
                    },
                    required: ['filePath', 'content']
                }
            },
            {
                name: 'chanakya_workspace_search',
                serverName: 'chanakya-embedded',
                description: 'Search for text or regex pattern across workspace files.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search term or regex' },
                        maxResults: { type: 'number', description: 'Max matches to return (default 20)' }
                    },
                    required: ['query']
                }
            },
            {
                name: 'chanakya_diagnostics',
                serverName: 'chanakya-embedded',
                description: 'Get all compiler errors, linter warnings, and diagnostics across open files.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        severity: { type: 'string', description: "Filter by 'error' or 'warning' or 'all'" }
                    }
                }
            },
            {
                name: 'chanakya_git_diff',
                serverName: 'chanakya-embedded',
                description: 'Get current Git working tree status and uncommitted diffs.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        stagedOnly: { type: 'boolean', description: 'Only show staged changes' }
                    }
                }
            },
            {
                name: 'chanakya_graphify_query',
                serverName: 'chanakya-embedded',
                description: 'Query architectural topology, god nodes, circular cycles, or blast radius of a file.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: { type: 'string', description: "'summary' | 'blast_radius' | 'cycles' | 'god_nodes'" },
                        targetFile: { type: 'string', description: 'Target file for blast_radius calculation' }
                    },
                    required: ['action']
                }
            },
            {
                name: 'chanakya_terminal_exec',
                serverName: 'chanakya-embedded',
                description: 'Execute a command in the workspace shell safely.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: { type: 'string', description: 'Terminal command to run' },
                        timeoutMs: { type: 'number', description: 'Timeout in ms (default 5000)' }
                    },
                    required: ['command']
                }
            },
            {
                name: 'chanakya_db_store',
                serverName: 'chanakya-embedded',
                description: 'Store a persistent key-value pair in Chanakya MCP memory database.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        key: { type: 'string', description: 'Key name' },
                        value: { type: 'string', description: 'JSON string or text value' }
                    },
                    required: ['key', 'value']
                }
            },
            {
                name: 'chanakya_db_query',
                serverName: 'chanakya-embedded',
                description: 'Retrieve stored key-value pairs from Chanakya MCP memory database.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        key: { type: 'string', description: "Key name to lookup or '*' for all" }
                    },
                    required: ['key']
                }
            }
        ];
    }
    getResources() {
        return [
            {
                uri: 'workspace://active_file',
                name: 'Active Editor File',
                serverName: 'chanakya-embedded',
                description: 'The currently open file and selection in VS Code editor.',
                mimeType: 'text/plain'
            },
            {
                uri: 'workspace://architecture',
                name: 'Graphify Architecture Map',
                serverName: 'chanakya-embedded',
                description: 'Live architecture dependency graph and semantic subsystem layers.',
                mimeType: 'application/json'
            },
            {
                uri: 'workspace://diagnostics',
                name: 'Compiler Diagnostics',
                serverName: 'chanakya-embedded',
                description: 'Real-time project compiler diagnostics, errors, and warnings.',
                mimeType: 'application/json'
            }
        ];
    }
    getPrompts() {
        return [
            {
                name: 'architecture_review',
                serverName: 'chanakya-embedded',
                description: 'Deep architectural and structural review of the workspace codebase.',
                arguments: [
                    { name: 'focusModule', description: 'Specific subsystem to focus on', required: false }
                ]
            },
            {
                name: 'security_audit',
                serverName: 'chanakya-embedded',
                description: 'Zero-vulnerability security scan for API keys, injection flaws, and unsafe exec.',
                arguments: []
            },
            {
                name: 'clean_refactor',
                serverName: 'chanakya-embedded',
                description: 'Refactor complex monolithic functions using SOLID principles.',
                arguments: [
                    { name: 'targetFile', description: 'File to refactor', required: true }
                ]
            }
        ];
    }
    async executeTool(toolName, args) {
        const wsFolders = vscode.workspace.workspaceFolders;
        const rootPath = wsFolders && wsFolders.length > 0 ? wsFolders[0].uri.fsPath : process.cwd();
        switch (toolName) {
            case 'chanakya_fs_read': {
                const filePath = path.isAbsolute(args.filePath) ? args.filePath : path.join(rootPath, args.filePath);
                if (!fs.existsSync(filePath)) {
                    throw new Error(`File not found: ${args.filePath}`);
                }
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n');
                const start = Math.max(1, args.startLine || 1);
                const end = Math.min(lines.length, args.endLine || lines.length);
                return lines.slice(start - 1, end).map((l, idx) => `${start + idx}: ${l}`).join('\n');
            }
            case 'chanakya_fs_write': {
                const filePath = path.isAbsolute(args.filePath) ? args.filePath : path.join(rootPath, args.filePath);
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir))
                    fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(filePath, args.content, 'utf-8');
                return `Successfully wrote ${args.content.length} characters to ${args.filePath}`;
            }
            case 'chanakya_workspace_search': {
                const query = args.query || '';
                const limit = args.maxResults || 20;
                try {
                    const out = (0, child_process_1.execSync)(`git grep -n -I -i -E "${query.replace(/"/g, '\\"')}"`, {
                        cwd: rootPath,
                        encoding: 'utf-8',
                        timeout: 4000
                    });
                    return out.split('\n').slice(0, limit).join('\n') || 'No matches found.';
                }
                catch {
                    return 'No matches found.';
                }
            }
            case 'chanakya_diagnostics': {
                const diags = vscode.languages.getDiagnostics();
                const results = [];
                for (const [uri, fileDiags] of diags) {
                    for (const d of fileDiags) {
                        const sev = d.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warning';
                        if (args.severity && args.severity !== 'all' && sev !== args.severity)
                            continue;
                        results.push({
                            file: vscode.workspace.asRelativePath(uri),
                            line: d.range.start.line + 1,
                            message: d.message,
                            severity: sev
                        });
                    }
                }
                return JSON.stringify(results.slice(0, 30), null, 2);
            }
            case 'chanakya_git_diff': {
                try {
                    const status = (0, child_process_1.execSync)('git status --short', { cwd: rootPath, encoding: 'utf-8', timeout: 3000 });
                    const diff = (0, child_process_1.execSync)(args.stagedOnly ? 'git diff --cached' : 'git diff', {
                        cwd: rootPath,
                        encoding: 'utf-8',
                        timeout: 4000
                    });
                    return `--- GIT STATUS ---\n${status}\n\n--- GIT DIFF ---\n${diff.slice(0, 5000)}`;
                }
                catch (e) {
                    return `Git error or not a git repo: ${e.message}`;
                }
            }
            case 'chanakya_graphify_query': {
                const graphify = graphifyService_1.GraphifyService.getInstance();
                const data = await graphify.generateGraphData(false);
                if (args.action === 'summary') {
                    return JSON.stringify({
                        nodeCount: data.stats.nodeCount,
                        edgeCount: data.stats.edgeCount,
                        communities: data.communities.map((c) => ({ name: c.name, count: c.count })),
                        godNodes: data.analytics?.godNodes
                    }, null, 2);
                }
                else if (args.action === 'blast_radius' && args.targetFile) {
                    const node = data.nodes.find((n) => n.source_file.includes(args.targetFile) || args.targetFile.includes(n.source_file));
                    if (!node)
                        return `Could not find node for file: ${args.targetFile}`;
                    const blast = await graphify.calculateBlastRadius(node.id, 3);
                    return JSON.stringify(blast, null, 2);
                }
                else if (args.action === 'cycles') {
                    return JSON.stringify(data.analytics?.importCycles || [], null, 2);
                }
                return JSON.stringify(data.analytics || {}, null, 2);
            }
            case 'chanakya_terminal_exec': {
                const cmd = args.command;
                const timeout = args.timeoutMs || 5000;
                try {
                    const out = (0, child_process_1.execSync)(cmd, { cwd: rootPath, encoding: 'utf-8', timeout });
                    return out.slice(0, 6000);
                }
                catch (e) {
                    return `Command failed: ${e.message}\n${e.stdout || ''}\n${e.stderr || ''}`;
                }
            }
            case 'chanakya_db_store': {
                this.memoryStore.set(args.key, args.value);
                return `Stored key "${args.key}" in Chanakya MCP memory.`;
            }
            case 'chanakya_db_query': {
                if (args.key === '*') {
                    const all = {};
                    this.memoryStore.forEach((v, k) => (all[k] = v));
                    return JSON.stringify(all, null, 2);
                }
                const val = this.memoryStore.get(args.key);
                return val ? String(val) : `Key "${args.key}" not found in memory.`;
            }
            default:
                throw new Error(`Unknown embedded MCP tool: ${toolName}`);
        }
    }
    async readResource(uri) {
        if (uri === 'workspace://active_file') {
            const editor = vscode.window.activeTextEditor;
            if (!editor)
                return 'No active file open in editor.';
            return `File: ${editor.document.fileName}\nSelection: ${editor.document.getText(editor.selection) || 'None'}\n\n${editor.document.getText()}`;
        }
        else if (uri === 'workspace://architecture') {
            const data = await graphifyService_1.GraphifyService.getInstance().generateGraphData(false);
            return JSON.stringify(data, null, 2);
        }
        else if (uri === 'workspace://diagnostics') {
            return this.executeTool('chanakya_diagnostics', { severity: 'all' });
        }
        throw new Error(`Unknown resource URI: ${uri}`);
    }
}
exports.EmbeddedMcpServer = EmbeddedMcpServer;
//# sourceMappingURL=embeddedMcpServer.js.map