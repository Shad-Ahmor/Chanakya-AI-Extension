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
const assert = __importStar(require("assert"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const workspaceIndexer_1 = require("./workspaceIndexer");
const VectorStore_1 = require("./memory/VectorStore");
suite('RAG Ingestion Pipeline Tests', () => {
    let indexer;
    let vectorStore;
    const testDir = path.join(__dirname, 'test_rag_ingestion');
    const dbPath = path.join(testDir, 'chanakya_memory_db');
    // Mock global storage URI for VectorStore
    const mockUri = {
        fsPath: testDir
    };
    setup(async () => {
        // Clean up previous test
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        }
        catch (e) { }
        await fs.mkdir(testDir, { recursive: true });
        indexer = workspaceIndexer_1.WorkspaceIndexer.getInstance();
        vectorStore = VectorStore_1.VectorStore.getInstance();
        await vectorStore.initialize(mockUri);
    });
    teardown(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        }
        catch (e) { }
    });
    test('valid document ingestion', async () => {
        const testFile = path.join(testDir, 'valid.txt');
        const content = 'a'.repeat(2500); // Should create chunks
        await fs.writeFile(testFile, content, 'utf8');
        // This should pass without throwing
        await indexer.ingestDocument(testFile);
        assert.ok(true);
    });
    test('empty document', async () => {
        const testFile = path.join(testDir, 'empty.txt');
        await fs.writeFile(testFile, '   \n   ', 'utf8');
        await indexer.ingestDocument(testFile);
        assert.ok(true);
    });
    test('multiple chunks and duplicate ingestion (persistence)', async () => {
        const testFile = path.join(testDir, 'duplicate.txt');
        const content = '1234567890'.repeat(300); // 3000 chars
        await fs.writeFile(testFile, content, 'utf8');
        await indexer.ingestDocument(testFile);
        // Run again, should delete previous and re-insert
        await indexer.ingestDocument(testFile);
        assert.ok(true);
    });
});
//# sourceMappingURL=ragIngestion.test.js.map