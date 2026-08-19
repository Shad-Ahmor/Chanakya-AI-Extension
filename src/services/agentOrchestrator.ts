import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from '../utils/logger';
import { McpService } from './mcpService';
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export class AgentOrchestrator {
  private static instance: AgentOrchestrator;
  private readonly logger = Logger.getInstance();

  public static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator();
    }
    return AgentOrchestrator.instance;
  }

  public async getAvailableTools(): Promise<ToolDefinition[]> {
    const nativeTools: ToolDefinition[] = [
      {
        type: 'function',
        function: {
          name: 'run_terminal_command',
          description: 'Executes a command in the shell (Terminal) in the background and returns the output. Use this for git, npm, installing dependencies, or running scripts. CAUTION: You have full permission, run carefully.',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'The exact command to execute' },
              cwd: { type: 'string', description: 'The working directory to execute the command in. Leave empty to use workspace root.' }
            },
            required: ['command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'view_file',
          description: 'Read the contents of a file.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Absolute or workspace-relative path to the file.' }
            },
            required: ['filePath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_directory',
          description: 'List the contents of a directory to discover files.',
          parameters: {
            type: 'object',
            properties: {
              dirPath: { type: 'string', description: 'Absolute or workspace-relative directory path.' }
            },
            required: ['dirPath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'edit_file',
          description: 'Completely replaces the contents of a file. Use this carefully to apply code modifications.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Path to the file.' },
              content: { type: 'string', description: 'The entire new content of the file.' }
            },
            required: ['filePath', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_file',
          description: 'Creates a new file with the specified content. Also creates necessary parent directories.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Path to the new file.' },
              content: { type: 'string', description: 'The content of the file.' }
            },
            required: ['filePath', 'content']
          }
        }
      }
    ];

    try {
      const mcpService = McpService.getInstance();
      const mcpTools = await mcpService.getAvailableTools();
      for (const { serverName, tool } of mcpTools) {
        nativeTools.push({
          type: 'function',
          function: {
            name: `mcp_${serverName}_${tool.name}`,
            description: `[MCP Server: ${serverName}] ${tool.description || ''}`,
            parameters: tool.inputSchema as any
          }
        });
      }
    } catch (err) {
      this.logger.error('Failed to load MCP tools', err);
    }

    return nativeTools;
  }

  private resolvePath(reqPath: string): string {
    if (path.isAbsolute(reqPath)) return reqPath;
    const ws = vscode.workspace.workspaceFolders;
    if (!ws || ws.length === 0) return reqPath;
    return path.join(ws[0].uri.fsPath, reqPath);
  }

  public async executeTool(name: string, args: any): Promise<string> {
    this.logger.log(`[Agent] Executing tool: ${name}`);
    try {
      switch (name) {
        case 'run_terminal_command':
          return await this.runTerminalCommand(args.command, args.cwd);
        case 'view_file':
          return await this.viewFile(args.filePath);
        case 'list_directory':
          return await this.listDirectory(args.dirPath);
        case 'edit_file':
          return await this.editFile(args.filePath, args.content);
        case 'create_file':
          return await this.createFile(args.filePath, args.content);
        default:
          if (name.startsWith('mcp_')) {
            // Format: mcp_serverName_toolName
            const parts = name.split('_');
            if (parts.length >= 3) {
              const serverName = parts[1];
              const toolName = parts.slice(2).join('_');
              return await McpService.getInstance().callTool(serverName, toolName, args);
            }
          }
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (err: any) {
      this.logger.error(`[Agent] Tool ${name} failed`, err);
      return `Error executing ${name}: ${err.message}`;
    }
  }

  private async runTerminalCommand(command: string, cwd?: string): Promise<string> {
    return new Promise((resolve) => {
      const execCwd = cwd ? this.resolvePath(cwd) : (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd());
      
      cp.exec(command, { cwd: execCwd, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        let output = '';
        if (stdout) output += `[STDOUT]\n${stdout}\n`;
        if (stderr) output += `[STDERR]\n${stderr}\n`;
        if (error) output += `[ERROR_CODE] ${error.code}\n`;
        
        if (!output.trim()) {
          resolve('Command executed successfully with no output.');
        } else {
          // Truncate if too long
          if (output.length > 30000) {
            output = output.substring(0, 30000) + '... [Output Truncated]';
          }
          resolve(output);
        }
      });
    });
  }

  private async viewFile(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    const content = await fs.readFile(fullPath, 'utf8');
    return content;
  }

  private async listDirectory(dirPath: string): Promise<string> {
    const fullPath = this.resolvePath(dirPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    
    let result = `Contents of ${dirPath}:\n`;
    for (const entry of entries) {
      result += `- ${entry.isDirectory() ? '[DIR] ' : '[FILE] '}${entry.name}\n`;
    }
    return result;
  }

  private async editFile(filePath: string, content: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    await fs.writeFile(fullPath, content, 'utf8');
    return `Successfully modified file: ${filePath}`;
  }

  private async createFile(filePath: string, content: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
    return `Successfully created file: ${filePath}`;
  }
}
