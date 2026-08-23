const mockModule = require('module');
const originalRequire = mockModule.prototype.require;
mockModule.prototype.require = function(request: string) {
    if (request === 'vscode') {
        return {
            workspace: { 
                workspaceFolders: [{ uri: { fsPath: __dirname } }],
                getConfiguration: () => ({ get: () => {} })
            },
            window: { 
                showInformationMessage: (msg: string) => console.log('[INFO]', msg),
                showErrorMessage: (msg: string) => console.error('[ERROR]', msg),
                createOutputChannel: () => ({ appendLine: (msg: string) => console.log('[LOG]', msg) }),
                withProgress: async (_options: any, task: any) => {
                    await task({ report: (msg: any) => console.log('[PROGRESS]', msg.message) });
                }
            },
            ProgressLocation: { Notification: 15 },
            CancellationTokenSource: class {
                token = { isCancellationRequested: false, onCancellationRequested: () => {} };
                cancel() {}
                dispose() {}
            },
            EventEmitter: class {
                fire() {}
                event() {}
            }
        };
    }
    return originalRequire.apply(this, arguments);
};

import { runReactPilot } from './src/commands/runReactPilot';
runReactPilot().catch(console.error);
