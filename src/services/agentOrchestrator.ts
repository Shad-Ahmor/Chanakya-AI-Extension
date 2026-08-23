import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { McpService } from './mcpService';
import { LspService } from './lspService';
import { PlanTracker } from './planTracker';
import { ExecutionGuardService } from './executionGuard';
import { ToolSpillService } from './toolSpillService';
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
  private pendingUserOptionResolver: ((value: string) => void) | null = null;
  public readonly events = new EventEmitter();

  public resolveUserOption(choice: string) {
    if (this.pendingUserOptionResolver) {
      this.pendingUserOptionResolver(choice);
      this.pendingUserOptionResolver = null;
    }
  }

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
              path: { type: 'string', description: 'Absolute or workspace-relative path to the file.' }
            },
            required: ['path']
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
              path: { type: 'string', description: 'Absolute or workspace-relative directory path.' }
            },
            required: ['path']
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
              path: { type: 'string', description: 'Path to the file.' },
              content: { type: 'string', description: 'The entire new content of the file.' }
            },
            required: ['path', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'replace_in_file',
          description: 'Replaces a specific block of text in a file. Always use this instead of edit_file when modifying existing files. targetContent MUST precisely match the file contents, including leading whitespace.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Path to the file.' },
              targetContent: { type: 'string', description: 'The exact code block to be replaced (including exact leading whitespaces).' },
              replacementContent: { type: 'string', description: 'The new code to insert in place of targetContent.' }
            },
            required: ['path', 'targetContent', 'replacementContent']
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
              path: { type: 'string', description: 'Path to the new file.' },
              content: { type: 'string', description: 'The content of the file.' }
            },
            required: ['path', 'content']
          }
        }
      },

      {
        type: 'function',
        function: {
          name: 'delete_file',
          description: 'Deletes a file permanently. Use carefully.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Path to the file to delete.' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'delete_directory',
          description: 'Deletes a directory and all its contents recursively. Use with extreme caution.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Path to the directory to delete.' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'ask_user_options',
          description: 'Pauses generation and asks the user a multiple-choice question. Use this when there are multiple valid paths (e.g. tech stack, design theme) and you need the user to pick one before proceeding.',
          parameters: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'The question to ask the user.' },
              options: { type: 'array', items: { type: 'string' }, description: 'An array of strings representing the choices.' }
            },
            required: ['question', 'options']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'lsp_goto_definition',
          description: 'Uses VS Code Language Server Protocol (LSP) to find the exact definition location of any function, class, or symbol across the workspace without guessing.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Relative or absolute path to the source file containing the symbol reference.' },
              line: { type: 'number', description: '0-based line number where the symbol occurs.' },
              character: { type: 'number', description: '0-based character column offset.' }
            },
            required: ['filePath', 'line', 'character']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'lsp_goto_implementation',
          description: 'Uses VS Code LSP to find all concrete class/method implementations of an interface or abstract method across the workspace.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Relative or absolute path to the source file.' },
              line: { type: 'number', description: '0-based line number where the interface symbol occurs.' },
              character: { type: 'number', description: '0-based character column offset.' }
            },
            required: ['filePath', 'line', 'character']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'lsp_find_references',
          description: 'Uses VS Code LSP to find all usages and references of a symbol across the entire workspace. Use before refactoring to prevent breaking callers.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Source file path.' },
              line: { type: 'number', description: '0-based line number.' },
              character: { type: 'number', description: '0-based character column.' }
            },
            required: ['filePath', 'line', 'character']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'lsp_hover',
          description: 'Extracts exact type signature, hover tooltip, and docstrings from the Language Server for a symbol.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Source file path.' },
              line: { type: 'number', description: '0-based line number.' },
              character: { type: 'number', description: '0-based character column.' }
            },
            required: ['filePath', 'line', 'character']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'todo_write',
          description: 'Initializes or updates the agent multi-step plan checklist (DeepSeek Harness style). Keeps the user aligned on task execution status.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'High-level title for this plan.' },
              tasks: {
                type: 'array',
                description: 'Array of sequential tasks to execute.',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Unique task id (e.g. task_1, task_2).' },
                    title: { type: 'string', description: 'Brief description of the step.' }
                  },
                  required: ['title']
                }
              }
            },
            required: ['title', 'tasks']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'plan_step',
          description: 'Updates the progress of an individual task in the plan (e.g. task_1 -> completed).',
          parameters: {
            type: 'object',
            properties: {
              taskId: { type: 'string', description: 'The task id to update.' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed'], description: 'The new status of the task.' }
            },
            required: ['taskId', 'status']
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
      instructions += `\n- **${t.function.name}**: ${t.function.description}\n  Arguments schema: ${JSON.stringify(t.function.parameters)}`;
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

  private resolvePath(reqPath: string, customWorkspace?: string): string {
    if (path.isAbsolute(reqPath)) return reqPath;
    if (customWorkspace) return require('path').join(customWorkspace, reqPath);
    const ws = vscode.workspace.workspaceFolders;
    if (!ws || ws.length === 0) return reqPath;
    return path.join(ws[0].uri.fsPath, reqPath);
  }

  public async executeTool(name: string, args: any, customWorkspace?: string): Promise<string> {
    this.logger.log(`[Agent] Executing tool: ${name}`);

    // 1. Guard check for loop hygiene
    const guardIntervention = ExecutionGuardService.getInstance().evaluatePreExecution(name, args);
    if (guardIntervention.warningPrompt) {
      this.logger.warn(`[Agent] Loop warning: ${guardIntervention.warningPrompt}`);
    }

    try {
      let rawResult = '';
      const targetPath = args.path || args.filePath || args.dirPath;

      switch (name) {
        case 'run_terminal_command':
          rawResult = await this.runTerminalCommand(args.command, args.cwd, customWorkspace);
          break;
        case 'view_file':
          rawResult = await this.viewFile(targetPath, customWorkspace);
          break;
        case 'search_code':
          rawResult = await this.searchCode(args.query, customWorkspace);
          break;
        case 'list_directory':
          rawResult = await this.listDirectory(targetPath, customWorkspace);
          break;
        case 'edit_file':
          rawResult = await this.editFile(targetPath, args.content, customWorkspace);
          break;
        case 'replace_in_file':
          rawResult = await this.replaceInFile(targetPath, args.targetContent, args.replacementContent, customWorkspace);
          break;
        case 'create_file':
          rawResult = await this.createFile(targetPath, args.content, customWorkspace);
          break;
        case 'delete_file':
          rawResult = await this.deleteFile(targetPath, customWorkspace);
          break;
        case 'delete_directory':
          rawResult = await this.deleteDirectory(targetPath, customWorkspace);
          break;
        case 'lsp_goto_definition': {
          const results = await LspService.getInstance().goToDefinition(args.filePath, Number(args.line || 0), Number(args.character || 0));
          rawResult = results.length === 0 ? 'No definitions found.' : JSON.stringify(results, null, 2);
          break;
        }
        case 'lsp_goto_implementation': {
          const results = await LspService.getInstance().goToImplementation(args.filePath, Number(args.line || 0), Number(args.character || 0));
          rawResult = results.length === 0 ? 'No implementations found.' : JSON.stringify(results, null, 2);
          break;
        }
        case 'lsp_find_references': {
          const results = await LspService.getInstance().findReferences(args.filePath, Number(args.line || 0), Number(args.character || 0));
          rawResult = results.length === 0 ? 'No references found.' : JSON.stringify(results, null, 2);
          break;
        }
        case 'lsp_hover': {
          const hover = await LspService.getInstance().hover(args.filePath, Number(args.line || 0), Number(args.character || 0));
          rawResult = hover ? hover.contents.join('\n\n') : 'No hover information available.';
          break;
        }
        case 'todo_write': {
          const plan = PlanTracker.getInstance().setPlan(args.title, args.tasks || []);
          rawResult = `Plan initialized with ${plan.tasks.length} tasks. Current active step: "${plan.tasks[0]?.title || 'none'}".`;
          break;
        }
        case 'plan_step': {
          const updated = PlanTracker.getInstance().updateTaskStatus(args.taskId, args.status);
          rawResult = updated ? `Task '${args.taskId}' updated to '${args.status}'. Overall progress: ${updated.overallProgress}%.` : `Task '${args.taskId}' not found.`;
          break;
        }
        case 'ask_user_options':
          return new Promise<string>((resolve) => {
            this.pendingUserOptionResolver = resolve;
          });
        default:
          if (name.startsWith('mcp_')) {
            const parts = name.split('_');
            const serverName = parts[1];
            const originalToolName = parts.slice(2).join('_');
            rawResult = await McpService.getInstance().callTool(serverName, originalToolName, args);
          } else {
            throw new Error(`Unknown tool: ${name}`);
          }
      }

      ExecutionGuardService.getInstance().recordToolResult(name, true);

      // 2. Tool output spill check
      const spillResult = await ToolSpillService.getInstance().handleOutputSpill(name, rawResult);
      return spillResult.content;
    } catch (err: any) {
      ExecutionGuardService.getInstance().recordToolResult(name, false, err.message);
      this.logger.error(`[Agent] Tool ${name} failed`, err);
      return `Error executing ${name}: ${err.message}`;
    }
  }

  private async runTerminalCommand(command: string, cwd?: string, customWorkspace?: string): Promise<string> {
    return new Promise((resolve) => {
      const execCwd = cwd ? this.resolvePath(cwd, customWorkspace) : (customWorkspace || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd());
      
      this.logger.log(`[Terminal] Running: ${command} in ${execCwd}`);
      
      // We will run this via cp.exec to capture output synchronously.
      // But we also want a timeout so we don't block forever on servers.
      const child = cp.exec(command, { cwd: execCwd, maxBuffer: 1024 * 1024 * 5 }); // 5MB buffer
      
      let output = '';
      let isDone = false;
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        output += data.toString();
      });
      
      const timeoutTimer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          // Don't kill it, it might be a server!
          resolve(`Command '${command}' is running in the background.\nOutput so far:\n${output.substring(0, 5000)}`);
        }
      }, 15000); // 15 seconds max wait
      
      child.on('close', (code) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeoutTimer);
          if (code === 0) {
            resolve(`Command executed successfully (exit code 0).\nOutput:\n${output.substring(0, 10000)}`);
          } else {
            resolve(`Command failed with exit code ${code}.\nOutput:\n${output.substring(0, 10000)}`);
          }
        }
      });
      
      child.on('error', (err) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeoutTimer);
          resolve(`Failed to start command: ${err.message}`);
        }
      });
    });
  }

  private async searchCode(query: string, customWorkspace?: string): Promise<string> {
    return new Promise((resolve) => {
      const execCwd = customWorkspace || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
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

  private async viewFile(filePath: string, customWorkspace?: string): Promise<string> {
    const fullPath = this.resolvePath(filePath, customWorkspace);
    const content = await fs.readFile(fullPath, 'utf8');
    return content;
  }

  private async listDirectory(dirPath: string, customWorkspace?: string): Promise<string> {
    const fullPath = this.resolvePath(dirPath, customWorkspace);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    
    let result = `Contents of ${dirPath}:\n`;
    for (const entry of entries) {
      result += `- ${entry.isDirectory() ? '[DIR] ' : '[FILE] '}${entry.name}\n`;
    }
    return result;
  }

  private async editFile(filePath: string, content: string, customWorkspace?: string): Promise<string> {
    const fullPath = this.resolvePath(filePath, customWorkspace);
    await fs.writeFile(fullPath, content, 'utf8');
    
    // Open in UI
    try {
      const doc = await vscode.workspace.openTextDocument(fullPath);
      await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
      const basename = path.basename(fullPath);
      if (['implementation_plan.md', 'plan.md', 'task.md', 'walkthrough.md'].includes(basename)) {
        this.events.emit('artifactUpdated', { name: basename, content: content });
      }
    } catch (e) {
      this.logger.error(`Failed to open document ${fullPath} in UI`, e);
    }
    
    this.events.emit('fileChanged', { path: fullPath, changeType: 'modify' });
    return `Successfully modified file: ${filePath}`;
  }

  private async replaceInFile(filePath: string, targetContent: string, replacementContent: string, customWorkspace?: string): Promise<string> {
    const fullPath = this.resolvePath(filePath, customWorkspace);
    try {
      let content = await fs.readFile(fullPath, 'utf8');
      
      if (!content.includes(targetContent)) {
        return `Error: The targetContent was not found in ${filePath}. Make sure leading whitespaces are exact. Try viewing the file first.`;
      }
      
      content = content.replace(targetContent, replacementContent);
      await fs.writeFile(fullPath, content, 'utf8');
      
      // Open in UI
      try {
        const doc = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
      const basename = path.basename(fullPath);
      if (['implementation_plan.md', 'plan.md', 'task.md', 'walkthrough.md'].includes(basename)) {
        this.events.emit('artifactUpdated', { name: basename, content: content });
      }
    } catch (e) {
      this.logger.error(`Failed to open document ${fullPath} in UI`, e);
    }
    
    this.events.emit('fileChanged', { path: fullPath, changeType: 'modify' });
    return `Successfully replaced content in file: ${filePath}`;
    } catch (err: any) {
      return `Failed to read/write file: ${err.message}`;
    }
  }

  private async createFile(filePath: string, content: string, customWorkspace?: string): Promise<string> {
    const fullPath = this.resolvePath(filePath, customWorkspace);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
    
    // Open in UI
    try {
      const doc = await vscode.workspace.openTextDocument(fullPath);
      await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
      const basename = path.basename(fullPath);
      if (['implementation_plan.md', 'plan.md', 'task.md', 'walkthrough.md'].includes(basename)) {
        this.events.emit('artifactUpdated', { name: basename, content: content });
      }
    } catch (e) {
      this.logger.error(`Failed to open document ${fullPath} in UI`, e);
    }
    
    this.events.emit('fileChanged', { path: fullPath, changeType: 'create' });
    return `Successfully created file: ${filePath}`;
  }

  private async deleteFile(filePath: string, customWorkspace?: string): Promise<string> {
    const fullPath = this.resolvePath(filePath, customWorkspace);
    try {
      await fs.unlink(fullPath);
      this.events.emit('fileChanged', { path: fullPath, changeType: 'delete' });
      return `Successfully deleted file: ${filePath}`;
    } catch (e: any) {
      return `Failed to delete file ${filePath}: ${e.message}`;
    }
  }

  private async deleteDirectory(dirPath: string, customWorkspace?: string): Promise<string> {
    const fullPath = this.resolvePath(dirPath, customWorkspace);
    try {
      await fs.rm(fullPath, { recursive: true, force: true });
      return `Successfully deleted directory: ${dirPath}`;
    } catch (e: any) {
      return `Failed to delete directory ${dirPath}: ${e.message}`;
    }
  }
}
