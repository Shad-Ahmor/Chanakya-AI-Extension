import { FromWebviewMessage, ToWebviewMessage } from './types/ipc';

interface VsCodeApi {
  postMessage(message: FromWebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

class VsCodeWrapper {
  private readonly vscode: VsCodeApi | undefined;

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      this.vscode = acquireVsCodeApi();
    }
  }

  public postMessage(message: FromWebviewMessage): void {
    if (this.vscode) {
      this.vscode.postMessage(message);
    } else {
      console.warn('VS Code API not available. Message logged:', message);
    }
  }

  public onMessage(handler: (message: ToWebviewMessage) => void): () => void {
    const listener = (event: MessageEvent<ToWebviewMessage>) => {
      handler(event.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }
}

export const vscode = new VsCodeWrapper();
