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
exports.VectorStore = void 0;
const path = __importStar(require("path"));
const vectra_1 = require("vectra");
const logger_1 = require("../../utils/logger");
class VectorStore {
    static instance;
    index;
    isInitialized = false;
    logger = logger_1.Logger.getInstance();
    constructor() { }
    static getInstance() {
        if (!VectorStore.instance) {
            VectorStore.instance = new VectorStore();
        }
        return VectorStore.instance;
    }
    async initialize(globalStorageUri) {
        if (this.isInitialized)
            return;
        try {
            const dbPath = path.join(globalStorageUri.fsPath, 'chanakya_memory_db');
            this.index = new vectra_1.LocalIndex(dbPath);
            if (!await this.index.isIndexCreated()) {
                await this.index.createIndex();
            }
            this.isInitialized = true;
            this.logger.log('Vector store initialized successfully at: ' + dbPath);
        }
        catch (error) {
            this.logger.error('Failed to initialize Vector Store', error);
        }
    }
    validateVector(vector) {
        // vectra by default uses 1536 if created without config, or infers from first item
        if (!vector || vector.length === 0) {
            throw new Error('Vector is empty or invalid.');
        }
    }
    async store(record, vector) {
        if (!this.isInitialized)
            return;
        try {
            this.validateVector(vector);
            // Upsert the item
            await this.index.upsertItem({
                id: record.memory_id,
                vector: vector,
                metadata: record
            });
            this.logger.log(`Stored memory: ${record.memory_id} [${record.memory_type}]`);
        }
        catch (error) {
            this.logger.error('Failed to store memory vector', error);
        }
    }
    async storeChunk(chunk, vector) {
        if (!this.isInitialized)
            return;
        try {
            this.validateVector(vector);
            await this.index.upsertItem({
                id: chunk.chunk_id,
                vector: vector,
                metadata: chunk
            });
            this.logger.log(`Stored chunk: ${chunk.chunk_id} for doc: ${chunk.document_id}`);
        }
        catch (error) {
            this.logger.error('Failed to store document chunk vector', error);
            throw error;
        }
    }
    async search(vector, topK = 5) {
        if (!this.isInitialized)
            return [];
        try {
            this.validateVector(vector);
            const results = await this.index.queryItems(vector, '', topK);
            return results.map(r => r.item.metadata);
        }
        catch (error) {
            this.logger.error('Failed to search memory vector', error);
            return [];
        }
    }
    async get(memoryId) {
        if (!this.isInitialized)
            return null;
        try {
            const item = await this.index.getItem(memoryId);
            return item ? item.metadata : null;
        }
        catch (error) {
            this.logger.error(`Failed to get memory ${memoryId}`, error);
            return null;
        }
    }
    async delete(memoryId) {
        if (!this.isInitialized)
            return;
        try {
            await this.index.deleteItem(memoryId);
        }
        catch (error) {
            this.logger.error(`Failed to delete memory ${memoryId}`, error);
        }
    }
    async deleteByDocumentId(documentId) {
        if (!this.isInitialized)
            return;
        try {
            // Find all items with matching document_id
            const items = await this.index.listItems();
            const chunksToDelete = items.filter(item => item.metadata && item.metadata.document_id === documentId);
            for (const chunk of chunksToDelete) {
                await this.index.deleteItem(chunk.id);
            }
            this.logger.log(`Deleted ${chunksToDelete.length} existing chunks for document: ${documentId}`);
        }
        catch (error) {
            this.logger.error(`Failed to delete chunks for document ${documentId}`, error);
            throw error;
        }
    }
}
exports.VectorStore = VectorStore;
//# sourceMappingURL=VectorStore.js.map