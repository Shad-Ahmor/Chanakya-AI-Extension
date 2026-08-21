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
exports.WorkspaceIndexer = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
const tokenOptimizer_1 = require("../utils/tokenOptimizer");
const documentParserService_1 = require("./documentParserService");
const EmbeddingService_1 = require("./memory/EmbeddingService");
const VectorStore_1 = require("./memory/VectorStore");
class WorkspaceIndexer {
    static instance;
    logger = logger_1.Logger.getInstance();
    constructor() { }
    static getInstance() {
        if (!WorkspaceIndexer.instance) {
            WorkspaceIndexer.instance = new WorkspaceIndexer();
        }
        return WorkspaceIndexer.instance;
    }
    /**
     * Searches the workspace for a file matching the filename query.
     * If found, returns the minified contents of the file to save tokens.
     */
    async getFileContext(fileNameQuery) {
        try {
            // Remove @ symbol if present
            const query = fileNameQuery.replace(/^@/, '').trim();
            if (!query)
                return null;
            this.logger.log(`[WorkspaceIndexer] Searching for file matching: ${query}`);
            // We'll search for the file using VS Code's native findFiles.
            // This supports partial matches e.g. "logger.ts" matches "src/utils/logger.ts"
            const uris = await vscode.workspace.findFiles(`**/*${query}*`, '**/node_modules/**,**/dist/**,**/.git/**', 5);
            if (uris.length === 0) {
                this.logger.log(`[WorkspaceIndexer] No files found for query: ${query}`);
                return null;
            }
            // We'll just take the best (first) match for simplicity in this Pro-Grade implementation
            const targetUri = uris[0];
            const document = await vscode.workspace.openTextDocument(targetUri);
            let rawText = document.getText();
            // Language Id extraction
            const langId = document.languageId;
            const fileName = targetUri.path.split('/').pop() || query;
            // Minify and truncate to prevent blowing up the context window
            const minifiedText = tokenOptimizer_1.TokenOptimizer.minifyCode(rawText, langId);
            const safeText = tokenOptimizer_1.TokenOptimizer.truncateText(minifiedText, 2500, false);
            this.logger.log(`[WorkspaceIndexer] Successfully extracted and minified ${fileName}`);
            return {
                fileName,
                content: `// --- File: ${fileName} ---\n${safeText}`
            };
        }
        catch (e) {
            this.logger.error(`[WorkspaceIndexer] Error fetching context for ${fileNameQuery}`, e);
            return null;
        }
    }
    /**
     * Scans the workspace and generates an architecture.md index.
     */
    async generateArchitectureMap() {
        const ws = vscode.workspace.workspaceFolders;
        if (!ws || ws.length === 0)
            throw new Error('No workspace open');
        const rootPath = ws[0].uri.fsPath;
        this.logger.log('[WorkspaceIndexer] Generating Architecture Map...');
        const uris = await vscode.workspace.findFiles('**/*', '{**/node_modules/**,**/dist/**,**/.git/**,**/.vscode/**,**/build/**,out/**}');
        let architecture = '# Workspace Architecture\\n\\nThis document outlines the high-level structure and components of the codebase.\\n\\n';
        // Group files by directory
        const structure = {};
        for (const uri of uris) {
            const relPath = vscode.workspace.asRelativePath(uri);
            const dir = path.dirname(relPath);
            const file = path.basename(relPath);
            if (!structure[dir])
                structure[dir] = [];
            structure[dir].push(file);
        }
        for (const dir of Object.keys(structure).sort()) {
            architecture += `## ${dir === '.' ? 'Root' : dir}\\n`;
            for (const file of structure[dir].sort()) {
                architecture += `- \`${file}\``;
                // Optional: Extract basic symbols if it's a code file
                if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.py')) {
                    try {
                        const content = await fs.readFile(path.join(rootPath, dir, file), 'utf8');
                        const lines = content.split('\\n');
                        const symbols = [];
                        for (const line of lines) {
                            const exportMatch = line.match(/export (class|interface|function|const) ([a-zA-Z0-9_]+)/);
                            if (exportMatch)
                                symbols.push(exportMatch[2]);
                            const defMatch = line.match(/def ([a-zA-Z0-9_]+)/); // python
                            if (defMatch)
                                symbols.push(defMatch[1]);
                            const classMatch = line.match(/class ([a-zA-Z0-9_]+)/); // python
                            if (classMatch && !exportMatch)
                                symbols.push(classMatch[1]);
                        }
                        if (symbols.length > 0) {
                            architecture += ` (Exports/Symbols: ${symbols.slice(0, 5).join(', ')}${symbols.length > 5 ? '...' : ''})`;
                        }
                    }
                    catch (e) {
                        // ignore
                    }
                }
                architecture += '\\n';
            }
            architecture += '\\n';
        }
        const chanakyaDir = path.join(rootPath, '.chanakya');
        await fs.mkdir(chanakyaDir, { recursive: true });
        const outPath = path.join(chanakyaDir, 'architecture.md');
        await fs.writeFile(outPath, architecture, 'utf8');
        this.logger.log(`[WorkspaceIndexer] Saved architecture to ${outPath}`);
        return outPath;
    }
    /**
     * Phase 2 RAG: Full document ingestion pipeline
     */
    async ingestDocument(filePath) {
        try {
            this.logger.log(`[WorkspaceIndexer] Starting ingestion for: ${filePath}`);
            // Delete existing chunks to prevent uncontrolled duplicates
            await VectorStore_1.VectorStore.getInstance().deleteByDocumentId(filePath);
            // 1. Text extraction
            const rawText = await documentParserService_1.DocumentParserService.getInstance().parseDocument(filePath);
            // 2. Cleaning
            const cleanText = rawText.trim().replace(/\r\n/g, '\n');
            if (!cleanText) {
                this.logger.warn(`[WorkspaceIndexer] Document is empty or corrupted: ${filePath}`);
                console.log(`DOCUMENT\nparsed=false\ncharacters=0\nchunks=0\nembeddings=0\nstored=0`);
                return;
            }
            // 3. Chunking (naive 1000 char, 200 overlap)
            const chunkSize = 1000;
            const chunkOverlap = 200;
            const chunks = [];
            for (let i = 0; i < cleanText.length; i += (chunkSize - chunkOverlap)) {
                chunks.push(cleanText.substring(i, i + chunkSize));
            }
            // 4. Metadata, Embedding, Storage
            let storedCount = 0;
            let embeddingsCount = 0;
            for (let i = 0; i < chunks.length; i++) {
                const chunkContent = chunks[i].trim();
                if (!chunkContent)
                    continue;
                const chunk = {
                    chunk_id: (0, uuid_1.v4)(),
                    document_id: filePath,
                    source: 'workspace',
                    filename: path.basename(filePath),
                    chunk_index: i,
                    content: chunkContent,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                try {
                    const vector = await EmbeddingService_1.EmbeddingService.getInstance().getEmbedding(chunkContent);
                    embeddingsCount++;
                    await VectorStore_1.VectorStore.getInstance().storeChunk(chunk, vector);
                    storedCount++;
                }
                catch (err) {
                    this.logger.error(`[WorkspaceIndexer] Error embedding/storing chunk ${i} for ${filePath}: ${err.message}`);
                }
            }
            console.log(`DOCUMENT\nparsed=true\ncharacters=${cleanText.length}\nchunks=${chunks.length}\nembeddings=${embeddingsCount}\nstored=${storedCount}`);
            this.logger.log(`[WorkspaceIndexer] Ingestion complete for ${filePath}. Stored ${storedCount} chunks.`);
        }
        catch (e) {
            this.logger.error(`[WorkspaceIndexer] Ingestion failed for ${filePath}`, e);
            throw e;
        }
    }
}
exports.WorkspaceIndexer = WorkspaceIndexer;
//# sourceMappingURL=workspaceIndexer.js.map