"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryManager = void 0;
const uuid_1 = require("uuid");
const VectorStore_1 = require("./VectorStore");
const EmbeddingService_1 = require("./EmbeddingService");
const logger_1 = require("../../utils/logger");
class MemoryManager {
    static instance;
    logger = logger_1.Logger.getInstance();
    vectorStore = VectorStore_1.VectorStore.getInstance();
    embeddingService = EmbeddingService_1.EmbeddingService.getInstance();
    constructor() { }
    static getInstance() {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }
    /**
     * Stores a new memory experience in the Vector Database
     */
    async storeExperience(params) {
        try {
            const memoryId = (0, uuid_1.v4)();
            const record = {
                memory_id: memoryId,
                memory_type: params.type,
                title: params.title,
                task: params.task,
                tags: params.tags || [],
                environment: {
                    os: process.platform,
                    hardware: process.arch
                },
                confidence: params.confidence ?? 0.5,
                importance: 0.5,
                reliability: 0.5,
                times_retrieved: 0,
                times_helped: 0,
                times_failed: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                last_used_at: new Date().toISOString(),
                version: 1,
                status: 'active'
            };
            if (params.error !== undefined)
                record.error = params.error;
            if (params.root_cause !== undefined)
                record.root_cause = params.root_cause;
            if (params.correction !== undefined)
                record.correction = params.correction;
            if (params.prevention !== undefined)
                record.prevention = params.prevention;
            if (params.general_lesson !== undefined)
                record.general_lesson = params.general_lesson;
            if (params.action !== undefined)
                record.action = params.action;
            if (params.result !== undefined)
                record.result = params.result;
            // Create a text representation to embed
            let textToEmbed = `Task: ${params.task}\n`;
            if (params.error)
                textToEmbed += `Error: ${params.error}\n`;
            if (params.prevention)
                textToEmbed += `Prevention: ${params.prevention}\n`;
            if (params.general_lesson)
                textToEmbed += `Lesson: ${params.general_lesson}\n`;
            const vector = await this.embeddingService.getEmbedding(textToEmbed);
            await this.vectorStore.store(record, vector);
            this.logger.log(`[MemoryManager] Created new memory ${memoryId} (${params.type})`);
            return memoryId;
        }
        catch (err) {
            this.logger.error('[MemoryManager] Failed to store experience', err);
            return '';
        }
    }
    /**
     * Updates feedback on an existing memory
     */
    async updateFeedback(memoryId, wasHelpful) {
        try {
            const record = await this.vectorStore.get(memoryId);
            if (!record)
                return;
            if (wasHelpful) {
                record.times_helped += 1;
                record.confidence = Math.min(1.0, record.confidence + 0.1);
                record.reliability = Math.min(1.0, record.reliability + 0.1);
            }
            else {
                record.times_failed += 1;
                record.confidence = Math.max(0.0, record.confidence - 0.2);
                record.reliability = Math.max(0.0, record.reliability - 0.2);
                if (record.confidence < 0.2) {
                    record.status = 'disabled';
                    this.logger.log(`[MemoryManager] Memory ${memoryId} disabled due to low confidence.`);
                }
            }
            record.updated_at = new Date().toISOString();
            // Re-embed and store
            let textToEmbed = `Task: ${record.task}\n`;
            if (record.error)
                textToEmbed += `Error: ${record.error}\n`;
            if (record.prevention)
                textToEmbed += `Prevention: ${record.prevention}\n`;
            const vector = await this.embeddingService.getEmbedding(textToEmbed);
            await this.vectorStore.store(record, vector);
        }
        catch (err) {
            this.logger.error(`[MemoryManager] Failed to update feedback for ${memoryId}`, err);
        }
    }
}
exports.MemoryManager = MemoryManager;
//# sourceMappingURL=MemoryManager.js.map