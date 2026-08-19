import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

/**
 * SecretManager securely stores API keys and sensitive tokens in VS Code's encrypted SecretStorage.
 * Never writes secrets to settings.json, globalState, or disk in plaintext.
 */
export class SecretManager {
  private static instance: SecretManager;
  private readonly secretStorage: vscode.SecretStorage;
  private readonly logger = Logger.getInstance();

  private constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
  }

  public static initialize(context: vscode.ExtensionContext): SecretManager {
    if (!SecretManager.instance) {
      SecretManager.instance = new SecretManager(context);
    }
    return SecretManager.instance;
  }

  public static getInstance(): SecretManager {
    if (!SecretManager.instance) {
      throw new Error('SecretManager is not initialized. Call initialize(context) first.');
    }
    return SecretManager.instance;
  }

  public async getApiKey(provider: string = 'gemini'): Promise<string | undefined> {
    try {
      const key = await this.secretStorage.get(`aiEnhancer.apiKey.${provider}`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to retrieve API key for ${provider}`, error);
      return undefined;
    }
  }

  public async setApiKey(apiKey: string, provider: string = 'gemini'): Promise<void> {
    try {
      if (!apiKey || apiKey.trim().length === 0) {
        await this.secretStorage.delete(`aiEnhancer.apiKey.${provider}`);
        this.logger.log(`Deleted API key for ${provider}`);
      } else {
        await this.secretStorage.store(`aiEnhancer.apiKey.${provider}`, apiKey.trim());
        this.logger.log(`Securely saved API key for ${provider}`);
      }
    } catch (error) {
      this.logger.error(`Failed to store API key for ${provider}`, error);
      throw error;
    }
  }

  public async hasApiKey(provider: string = 'gemini'): Promise<boolean> {
    const key = await this.getApiKey(provider);
    return Boolean(key && key.length > 0);
  }
}
