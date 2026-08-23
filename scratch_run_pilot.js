const mockModule = require('module');
const originalRequire = mockModule.prototype.require;
mockModule.prototype.require = function(request) {
    if (request === 'vscode') {
        return {
            workspace: { 
                workspaceFolders: [{ uri: { fsPath: __dirname } }],
                getConfiguration: () => ({ get: () => {} })
            },
            window: { 
                showInformationMessage: (msg) => console.log('[INFO]', msg),
                showErrorMessage: (msg) => console.error('[ERROR]', msg),
                createOutputChannel: () => ({ appendLine: (msg) => console.log('[LOG]', msg) }),
                withProgress: async (_options, task) => {
                    await task({ report: (msg) => console.log('[PROGRESS]', msg.message) });
                }
            },
            ProgressLocation: { Notification: 15 },
            CancellationTokenSource: class {
                constructor() {
                    this.token = { isCancellationRequested: false, onCancellationRequested: () => {} };
                }
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

const { runReactPilot } = require('./out/commands/runReactPilot');
runReactPilot().catch(console.error);
