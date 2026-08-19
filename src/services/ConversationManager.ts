import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Conversation, ChatMessage } from '../types/ipc';
import { Logger } from '../utils/logger';

export class ConversationManager {
  private static instance: ConversationManager;
  private readonly storagePath: string;
  private readonly logger: Logger;

  private conversations: Conversation[] = [];
  private activeConversationId: string | null = null;

  private constructor(context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance();
    
    // Use globalStorageUri for extension-level persistence (persists across workspaces)
    this.storagePath = path.join(context.globalStorageUri.fsPath, 'conversations.json');
    
    if (!fs.existsSync(context.globalStorageUri.fsPath)) {
      fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
    }
    
    this.loadFromDisk();
  }

  public static initialize(context: vscode.ExtensionContext): ConversationManager {
    if (!ConversationManager.instance) {
      ConversationManager.instance = new ConversationManager(context);
    }
    return ConversationManager.instance;
  }

  public static getInstance(): ConversationManager {
    if (!ConversationManager.instance) {
      throw new Error('ConversationManager is not initialized.');
    }
    return ConversationManager.instance;
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        this.conversations = JSON.parse(data);
        // Sort by updatedAt descending
        this.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
      }
    } catch (err) {
      this.logger.error('Failed to load conversations from disk', err);
      this.conversations = [];
    }
  }

  private saveToDisk() {
    try {
      fs.writeFileSync(this.storagePath, JSON.stringify(this.conversations, null, 2), 'utf8');
    } catch (err) {
      this.logger.error('Failed to save conversations to disk', err);
    }
  }

  public getAllConversations(): Conversation[] {
    return this.conversations;
  }

  public getActiveConversationId(): string | null {
    if (!this.activeConversationId && this.conversations.length > 0) {
      this.activeConversationId = this.conversations[0].id;
    }
    return this.activeConversationId;
  }

  public createNewConversation(): Conversation {
    const newConv: Conversation = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      updatedAt: Date.now()
    };
    this.conversations.unshift(newConv);
    this.activeConversationId = newConv.id;
    this.saveToDisk();
    return newConv;
  }

  public loadConversation(id: string): Conversation | null {
    const conv = this.conversations.find((c) => c.id === id);
    if (conv) {
      this.activeConversationId = id;
      return conv;
    }
    return null;
  }

  public deleteConversation(id: string): void {
    this.conversations = this.conversations.filter((c) => c.id !== id);
    if (this.activeConversationId === id) {
      this.activeConversationId = this.conversations.length > 0 ? this.conversations[0].id : null;
    }
    this.saveToDisk();
  }

  public clearAll(): void {
    this.conversations = [];
    this.activeConversationId = null;
    this.saveToDisk();
  }

  public updateActiveConversation(messages: ChatMessage[]): Conversation {
    let conv = this.conversations.find((c) => c.id === this.activeConversationId);
    
    // If no active conversation exists, create one implicitly
    if (!conv) {
      conv = this.createNewConversation();
    }
    
    conv.messages = messages;
    conv.updatedAt = Date.now();
    
    // Auto-generate title if it's currently "New Chat" and there's a user message
    if (conv.title === 'New Chat' && messages.length > 0) {
      const firstUserMsg = messages.find(m => m.role === 'user');
      if (firstUserMsg && firstUserMsg.content) {
        // Just truncate the first prompt to 30 chars
        const cleanContent = firstUserMsg.content.trim().split('\n')[0];
        conv.title = cleanContent.length > 30 ? cleanContent.substring(0, 30) + '...' : cleanContent;
      }
    }
    
    // Sort array so newest is at the top
    this.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    
    this.saveToDisk();
    return conv;
  }

  public appendMessages(id: string | null, newMessages: ChatMessage[]): Conversation {
    let conv = this.conversations.find((c) => c.id === (id || this.activeConversationId));
    
    if (!conv) {
      conv = this.createNewConversation();
    }
    
    // Append instead of overwrite
    const existingIds = new Set(conv.messages.map(m => m.id));
    for (const msg of newMessages) {
      if (!existingIds.has(msg.id)) {
        conv.messages.push(msg);
      } else {
        // If it exists, update it
        const idx = conv.messages.findIndex(m => m.id === msg.id);
        if (idx !== -1) {
          conv.messages[idx] = msg;
        }
      }
    }
    
    conv.updatedAt = Date.now();
    this.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    this.saveToDisk();
    return conv;
  }
}
