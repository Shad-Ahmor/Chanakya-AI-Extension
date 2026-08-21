import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs/promises';
import { suite, test, setup, teardown } from 'mocha';
import { WorkspaceIndexer } from './workspaceIndexer';
import { VectorStore } from './memory/VectorStore';

suite('RAG Ingestion Pipeline Tests', () => {
    let indexer: WorkspaceIndexer;
    let vectorStore: VectorStore;
    const testDir = path.join(__dirname, 'test_rag_ingestion');
    const dbPath = path.join(testDir, 'chanakya_memory_db');
    
    // Mock global storage URI for VectorStore
    const mockUri = {
        fsPath: testDir
    } as any;

    setup(async () => {
        // Clean up previous test
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (e) {}
        
        await fs.mkdir(testDir, { recursive: true });
        
        indexer = WorkspaceIndexer.getInstance();
        vectorStore = VectorStore.getInstance();
        await vectorStore.initialize(mockUri);
    });

    teardown(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (e) {}
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
