"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpDbService = void 0;
const logger_1 = require("../utils/logger");
class McpDbService {
    static instance;
    logger = logger_1.Logger.getInstance();
    executionLogs = [];
    toolCache = new Map();
    maxLogs = 200;
    constructor() { }
    static getInstance() {
        if (!McpDbService.instance) {
            McpDbService.instance = new McpDbService();
        }
        return McpDbService.instance;
    }
    /**
     * Log an MCP tool execution
     */
    logExecution(serverName, toolName, args, result, latencyMs, success, error) {
        const logEntry = {
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
            serverName,
            toolName,
            args,
            result,
            latencyMs,
            success,
            error
        };
        this.executionLogs.unshift(logEntry);
        if (this.executionLogs.length > this.maxLogs) {
            this.executionLogs.pop();
        }
        this.logger.log(`[McpDb] Logged ${serverName}:${toolName} (${latencyMs}ms, success=${success})`);
        return logEntry;
    }
    /**
     * Get all execution logs (optionally filtered by serverName or toolName)
     */
    getExecutionLogs(filter) {
        let logs = this.executionLogs;
        if (filter?.serverName) {
            logs = logs.filter((l) => l.serverName === filter.serverName);
        }
        if (filter?.toolName) {
            logs = logs.filter((l) => l.toolName === filter.toolName);
        }
        const limit = filter?.limit || 50;
        return logs.slice(0, limit);
    }
    /**
     * Clear execution logs
     */
    clearLogs() {
        this.executionLogs = [];
    }
    /**
     * Cache a deterministic tool result (e.g. read operations)
     */
    cacheResult(serverName, toolName, args, result, ttlMs = 30000) {
        const key = this.getCacheKey(serverName, toolName, args);
        this.toolCache.set(key, {
            result,
            timestamp: Date.now(),
            ttlMs
        });
    }
    /**
     * Retrieve cached result if available and unexpired
     */
    getCachedResult(serverName, toolName, args) {
        const key = this.getCacheKey(serverName, toolName, args);
        const entry = this.toolCache.get(key);
        if (!entry)
            return null;
        if (Date.now() - entry.timestamp > entry.ttlMs) {
            this.toolCache.delete(key);
            return null;
        }
        return entry.result;
    }
    getCacheKey(serverName, toolName, args) {
        return `${serverName}:${toolName}:${JSON.stringify(args || {})}`;
    }
    /**
     * Fast keyword / semantic matching to find best MCP tools for a given prompt query
     */
    findRelevantTools(tools, query, maxResults = 10) {
        if (!query.trim())
            return tools.slice(0, maxResults);
        const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
        if (tokens.length === 0)
            return tools.slice(0, maxResults);
        const scored = tools.map((tool) => {
            let score = 0;
            const toolText = `${tool.serverName} ${tool.name} ${tool.description || ''}`.toLowerCase();
            for (const token of tokens) {
                if (tool.name.toLowerCase().includes(token))
                    score += 5;
                if (tool.serverName.toLowerCase().includes(token))
                    score += 3;
                if (toolText.includes(token))
                    score += 1;
            }
            return { tool, score };
        });
        return scored
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((s) => s.tool)
            .slice(0, maxResults);
    }
}
exports.McpDbService = McpDbService;
//# sourceMappingURL=mcpDbService.js.map