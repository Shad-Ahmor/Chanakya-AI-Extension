"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretManager = void 0;
const logger_1 = require("../utils/logger");
/**
 * SecretManager securely stores API keys and sensitive tokens in VS Code's encrypted SecretStorage.
 * Never writes secrets to settings.json, globalState, or disk in plaintext.
 */
class SecretManager {
    static instance;
    secretStorage;
    logger = logger_1.Logger.getInstance();
    constructor(context) {
        this.secretStorage = context.secrets;
    }
    static initialize(context) {
        if (!SecretManager.instance) {
            SecretManager.instance = new SecretManager(context);
        }
        return SecretManager.instance;
    }
    static getInstance() {
        if (!SecretManager.instance) {
            throw new Error('SecretManager is not initialized. Call initialize(context) first.');
        }
        return SecretManager.instance;
    }
    async getApiKey(provider = 'gemini') {
        try {
            const key = await this.secretStorage.get(`aiEnhancer.apiKey.${provider}`);
            return key;
        }
        catch (error) {
            this.logger.error(`Failed to retrieve API key for ${provider}`, error);
            return undefined;
        }
    }
    async setApiKey(apiKey, provider = 'gemini') {
        try {
            if (!apiKey || apiKey.trim().length === 0) {
                await this.secretStorage.delete(`aiEnhancer.apiKey.${provider}`);
                this.logger.log(`Deleted API key for ${provider}`);
            }
            else {
                await this.secretStorage.store(`aiEnhancer.apiKey.${provider}`, apiKey.trim());
                this.logger.log(`Securely saved API key for ${provider}`);
            }
        }
        catch (error) {
            this.logger.error(`Failed to store API key for ${provider}`, error);
            throw error;
        }
    }
    async hasApiKey(provider = 'gemini') {
        const key = await this.getApiKey(provider);
        return Boolean(key && key.length > 0);
    }
}
exports.SecretManager = SecretManager;
//# sourceMappingURL=secretManager.js.map