const fs = require('fs');

// 1. MOCK VSCODE
const vscode = {
  EventEmitter: class {
    fire() {}
    event() {}
  },
  workspace: {
    getConfiguration: () => ({ get: () => undefined })
  },
  window: {
    showInformationMessage: () => {}
  }
};
require('module')._cache['vscode'] = {
  id: 'vscode',
  filename: 'vscode',
  loaded: true,
  exports: vscode
};

// 2. MOCK VECTORSTORE / UUID so it doesn't crash without real DB
require('module')._cache['uuid'] = {
  id: 'uuid',
  filename: 'uuid',
  loaded: true,
  exports: { v4: () => 'xxxxx-1234' }
};

// 3. Register ts-node to compile our TS files on the fly
require('ts-node').register({
  compilerOptions: { module: 'commonjs', esModuleInterop: true },
  transpileOnly: true
});

// 4. Run the test
require('./src/test/adversarialMemory.test.ts');
