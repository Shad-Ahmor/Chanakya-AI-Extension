import * as vscode from 'vscode';

export class InlineEditProvider implements vscode.TextDocumentContentProvider {
  public static readonly scheme = 'chanakya-diff';
  
  // We store the original and modified contents in memory
  private documents = new Map<string, string>();
  private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  
  public onDidChange = this.onDidChangeEmitter.event;

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.documents.get(uri.toString()) || '';
  }

  public updateDocument(uri: vscode.Uri, content: string): void {
    this.documents.set(uri.toString(), content);
    this.onDidChangeEmitter.fire(uri);
  }
}
