import * as vscode from 'vscode';

/**
 * Singleton Logger using VS Code OutputChannel for clean and non-intrusive logging.
 */
export class Logger {
  private static instance: Logger;
  private channel: vscode.OutputChannel;

  private constructor() {
    this.channel = vscode.window.createOutputChannel('Chanakya AI Enhancer');
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public log(message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` | ${JSON.stringify(args)}` : '';
    this.channel.appendLine(`[INFO  ${timestamp}] ${message}${formattedArgs}`);
  }

  public warn(message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` | ${JSON.stringify(args)}` : '';
    this.channel.appendLine(`[WARN  ${timestamp}] ${message}${formattedArgs}`);
  }

  public error(message: string, error?: unknown): void {
    const timestamp = new Date().toISOString();
    const errDetails = error instanceof Error ? `\nStack: ${error.stack}` : JSON.stringify(error);
    this.channel.appendLine(`[ERROR ${timestamp}] ${message} ${errDetails ?? ''}`);
  }

  public show(): void {
    this.channel.show(true);
  }

  public dispose(): void {
    this.channel.dispose();
  }
}
