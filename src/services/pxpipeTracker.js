"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PxPipeTracker = void 0;
const logger_1 = require("../utils/logger");
class PxPipeTracker {
    static instance;
    logger = logger_1.Logger.getInstance();
    events = [];
    maxEvents = 100;
    constructor() { }
    static getInstance() {
        if (!PxPipeTracker.instance) {
            PxPipeTracker.instance = new PxPipeTracker();
        }
        return PxPipeTracker.instance;
    }
    /**
     * Record a PxPipe compression event
     */
    recordEvent(event) {
        const fullEvent = {
            ...event,
            id: `px_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now()
        };
        this.events.unshift(fullEvent);
        if (this.events.length > this.maxEvents) {
            this.events.pop();
        }
        this.logger.log(`[PxPipeTracker] Recorded compression: ${event.charCount} chars, saved ${event.savedTokens} tokens (${event.savingsRatio}%), +$${event.savingsUsd.toFixed(4)}`);
        return fullEvent;
    }
    /**
     * Get aggregated telemetry metrics
     */
    getTelemetry() {
        const totalCompressions = this.events.length;
        let totalCharsImaged = 0;
        let counterfactualTextTokens = 0;
        let actualImageTokensUsed = 0;
        let lifetimeSavedTokens = 0;
        let lifetimeSavedUsd = 0;
        for (const ev of this.events) {
            totalCharsImaged += ev.charCount;
            counterfactualTextTokens += ev.counterfactualTextTokens;
            actualImageTokensUsed += ev.actualImageTokens;
            lifetimeSavedTokens += ev.savedTokens;
            lifetimeSavedUsd += ev.savingsUsd;
        }
        const averageSavingsRatio = counterfactualTextTokens > 0
            ? Math.round((lifetimeSavedTokens / counterfactualTextTokens) * 100)
            : 0;
        return {
            totalCompressions,
            totalCharsImaged,
            counterfactualTextTokens,
            actualImageTokensUsed,
            lifetimeSavedTokens,
            lifetimeSavedUsd,
            averageSavingsRatio
        };
    }
    /**
     * Get recent event history
     */
    getRecentEvents(limit = 40) {
        return this.events.slice(0, limit);
    }
}
exports.PxPipeTracker = PxPipeTracker;
//# sourceMappingURL=pxpipeTracker.js.map