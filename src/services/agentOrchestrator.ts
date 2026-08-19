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
          name: 'search_code',
          description: 'Search for text, code, function names, or imports across the workspace to prevent hallucination. ALWAYS use this to verify a function exists before importing it.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The text or regex to search for.' }
            },
            required: ['query']
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

  public async getXMLToolInstructions(): Promise<string> {
    const tools = await this.getAvailableTools();
    let instructions = `
You have access to the following tools to perform autonomous tasks:
`;
    for (const t of tools) {
      instructions += `\n- **${t.function.name}**: ${t.function.description}`;
    }

    instructions += `

To use a tool, you MUST output a block of XML like this:
<tool_call>
{"name": "tool_name", "arguments": {"arg1": "value1"}}
</tool_call>

Only one tool call per response is supported. Do not output anything else if you are calling a tool.
`;
    return instructions;
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
        case 'search_code':
          return await this.searchCode(args.query);
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
      
      // Look for existing Chanakya Agent terminal
      let terminal = vscode.window.terminals.find(t => t.name === 'Chanakya Agent');
      if (!terminal) {
        terminal = vscode.window.createTerminal({
          name: 'Chanakya Agent',
          cwd: execCwd
        });
      }
      
      terminal.show(false);
      terminal.sendText(command);
      
      // Resolve immediately to prevent blocking the LLM for long-running commands like pip install or migrations.
      resolve(`Command '${command}' has been sent to the VS Code 'Chanakya Agent' Terminal and is running. The user can see it live. Proceed with your next step without waiting for it to finish.`);
    });
  }

  private async searchCode(query: string): Promise<string> {
    return new Promise((resolve) => {
      const execCwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
      // Using simple grep -rn
      cp.exec(`grep -rn "${query.replace(/"/g, '\\"')}" .`, { cwd: execCwd, maxBuffer: 1024 * 1024 * 10 }, (_error, stdout) => {
        if (!stdout || stdout.trim().length === 0) {
          resolve(`No results found for query: ${query}`);
        } else {
          let output = stdout;
          if (output.length > 20000) {
            output = output.substring(0, 20000) + '\\n... [Results Truncated]';
          }
          resolve(`Search results:\\n${output}`);
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
    
    // Open in UI
    try {
      const doc = await vscode.workspace.openTextDocument(fullPath);
      await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
    } catch (e) {
      this.logger.error(`Failed to open document ${fullPath} in UI`, e);
    }
    
    return `Successfully modified file: ${filePath}`;
  }

  private async createFile(filePath: string, content: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
    
    // Open in UI
    try {
      const doc = await vscode.workspace.openTextDocument(fullPath);
      await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
    } catch (e) {
      this.logger.error(`Failed to open document ${fullPath} in UI`, e);
    }
    
    return `Successfully created file: ${filePath}`;
  }
}
