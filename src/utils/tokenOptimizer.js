"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenOptimizer = void 0;
const js_tiktoken_1 = require("js-tiktoken");
const logger_1 = require("./logger");
class TokenOptimizer {
    static logger = logger_1.Logger.getInstance();
    // Default to GPT-4o for token estimation, as most modern models use cl100k_base or o200k_base
    static DEFAULT_MODEL = 'gpt-4o';
    /**
     * Count the number of tokens in a given text.
     */
    static countTokens(text, model = this.DEFAULT_MODEL) {
        try {
            if (!text)
                return 0;
            const enc = (0, js_tiktoken_1.encodingForModel)(model);
            const tokens = enc.encode(text).length;
            return tokens;
        }
        catch (e) {
            this.logger.error(`Failed to count tokens: ${e}`);
            // Fallback heuristic: 1 token ~= 4 characters for English code/text
            return Math.ceil(text.length / 4);
        }
    }
    /**
     * Intelligently minifies code to save tokens for the LLM prompt.
     * Strips single-line and multi-line comments (JS/TS), and compresses extra whitespaces.
     */
    static minifyCode(code, languageId = 'typescript') {
        if (!code)
            return code;
        let minified = code;
        if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'java', 'c', 'cpp', 'csharp', 'go'].includes(languageId)) {
            // Remove multi-line comments (/* ... */)
            minified = minified.replace(/\/\*[\s\S]*?\*\//g, '');
            // Remove single-line comments (// ...) but ignore URLs (http://)
            minified = minified.replace(/(?<!https?:)\/\/.*$/gm, '');
        }
        else if (['python', 'ruby', 'bash', 'yaml'].includes(languageId)) {
            // Remove hash comments (# ...)
            minified = minified.replace(/#.*$/gm, '');
        }
        // Collapse multiple blank lines into a single blank line
        minified = minified.replace(/\n\s*\n/g, '\n');
        // Trim leading/trailing whitespace on each line to compress indentation slightly (optional for tokens, but we keep some for context)
        // Actually, LLMs rely on indentation for python, so we only remove completely empty lines and trailing spaces.
        minified = minified.replace(/[ \t]+$/gm, '');
        return minified.trim();
    }
    /**
     * Truncates text so that it fits within a maximum token limit.
     * Uses a sliding window from the end by default (preserves recent context).
     */
    static truncateText(text, maxTokens, preserveFromEnd = true, model = this.DEFAULT_MODEL) {
        if (!text)
            return text;
        try {
            const enc = (0, js_tiktoken_1.encodingForModel)(model);
            const tokens = enc.encode(text);
            if (tokens.length <= maxTokens) {
                return text;
            }
            this.logger.warn(`Truncating text from ${tokens.length} to ${maxTokens} tokens.`);
            const truncatedTokens = preserveFromEnd
                ? tokens.slice(tokens.length - maxTokens)
                : tokens.slice(0, maxTokens);
            const truncatedText = enc.decode(truncatedTokens);
            return preserveFromEnd ? `...[Truncated]\n${truncatedText}` : `${truncatedText}\n...[Truncated]`;
        }
        catch (e) {
            this.logger.error(`Failed to truncate via tokens: ${e}`);
            // Fallback character-based truncation
            const maxChars = maxTokens * 4;
            if (text.length <= maxChars)
                return text;
            return preserveFromEnd
                ? `...[Truncated]\n${text.slice(-maxChars)}`
                : `${text.slice(0, maxChars)}\n...[Truncated]`;
        }
    }
    /**
     * Pro-Grade Semantic Trimming: Trims chat messages based on priority.
     * Priority: System Prompt (Highest) > Latest Message > Context Items > Older messages.
     */
    static trimMessages(messages, maxTotalTokens) {
        if (messages.length === 0)
            return messages;
        let totalTokens = 0;
        const finalMessages = [];
        // Extract System Prompt (Always kept)
        const systemPrompts = messages.filter(m => m.role === 'system');
        for (const sys of systemPrompts) {
            const text = typeof sys.content === 'string' ? sys.content : JSON.stringify(sys.content);
            totalTokens += this.countTokens(text);
            finalMessages.push(sys);
        }
        // Filter out system from remainder
        const nonSystem = messages.filter(m => m.role !== 'system');
        // Take the most recent message (Always kept as much as possible)
        if (nonSystem.length > 0) {
            const latestMsg = nonSystem.pop();
            const text = typeof latestMsg.content === 'string' ? latestMsg.content : JSON.stringify(latestMsg.content);
            const tokens = this.countTokens(text);
            if (totalTokens + tokens <= maxTotalTokens) {
                totalTokens += tokens;
                finalMessages.push(latestMsg);
            }
            else {
                if (typeof latestMsg.content === 'string') {
                    const truncated = this.truncateText(latestMsg.content, Math.max(50, maxTotalTokens - totalTokens), true);
                    finalMessages.push({ ...latestMsg, content: truncated });
                    totalTokens = maxTotalTokens;
                }
            }
        }
        // Now fill the rest of the budget with recent messages (Priority to user over assistant if needed, but FIFO for simplicity in this window)
        for (let i = nonSystem.length - 1; i >= 0; i--) {
            const msg = nonSystem[i];
            const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            const tokens = this.countTokens(text);
            if (totalTokens + tokens <= maxTotalTokens) {
                totalTokens += tokens;
                // Insert right after system prompts
                finalMessages.splice(systemPrompts.length, 0, msg);
            }
            else {
                break;
            }
        }
        this.logger.log(`[TokenOptimizer] Pro-trimmed from ${messages.length} to ${finalMessages.length} messages. Tokens: ${totalTokens}`);
        return finalMessages;
    }
    /**
     * Calculate PxPipe Token Arbitrage (Text Tokens vs Image Tokens & Savings)
     */
    static calculatePxPipeArbitrage(text, modelType = 'claude') {
        const textTokens = this.countTokens(text);
        // Model vision tile costs:
        // Claude ~1600 tokens
        // Gemini Flash ~258 tokens
        // OpenAI ~765 tokens
        const imageTokens = modelType === 'gemini' ? 258 : modelType === 'openai' ? 765 : 1600;
        const savedTokens = Math.max(0, textTokens - imageTokens);
        const savingsPercentage = textTokens > 0 ? Math.round((savedTokens / textTokens) * 100) : 0;
        const isProfitable = textTokens > imageTokens;
        return {
            textTokens,
            imageTokens,
            savedTokens,
            savingsPercentage,
            isProfitable
        };
    }
}
exports.TokenOptimizer = TokenOptimizer;
//# sourceMappingURL=tokenOptimizer.js.map