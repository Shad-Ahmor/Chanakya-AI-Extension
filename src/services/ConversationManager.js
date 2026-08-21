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
exports.ConversationManager = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
class ConversationManager {
    static instance;
    storagePath;
    logger;
    conversations = [];
    activeConversationId = null;
    constructor(context) {
        this.logger = logger_1.Logger.getInstance();
        // Use globalStorageUri for extension-level persistence (persists across workspaces)
        this.storagePath = path.join(context.globalStorageUri.fsPath, 'conversations.json');
        if (!fs.existsSync(context.globalStorageUri.fsPath)) {
            fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
        }
        this.loadFromDisk();
    }
    static initialize(context) {
        if (!ConversationManager.instance) {
            ConversationManager.instance = new ConversationManager(context);
        }
        return ConversationManager.instance;
    }
    static getInstance() {
        if (!ConversationManager.instance) {
            throw new Error('ConversationManager is not initialized.');
        }
        return ConversationManager.instance;
    }
    loadFromDisk() {
        try {
            if (fs.existsSync(this.storagePath)) {
                const data = fs.readFileSync(this.storagePath, 'utf8');
                this.conversations = JSON.parse(data);
                // Sort by updatedAt descending
                this.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
            }
        }
        catch (err) {
            this.logger.error('Failed to load conversations from disk', err);
            this.conversations = [];
        }
    }
    saveToDisk() {
        try {
            fs.writeFileSync(this.storagePath, JSON.stringify(this.conversations, null, 2), 'utf8');
        }
        catch (err) {
            this.logger.error('Failed to save conversations to disk', err);
        }
    }
    getAllConversations() {
        return this.conversations;
    }
    getActiveConversationId() {
        if (!this.activeConversationId && this.conversations.length > 0) {
            this.activeConversationId = this.conversations[0].id;
        }
        return this.activeConversationId;
    }
    createNewConversation() {
        const newConv = {
            id: (0, uuid_1.v4)(),
            title: 'New Chat',
            messages: [],
            updatedAt: Date.now()
        };
        this.conversations.unshift(newConv);
        this.activeConversationId = newConv.id;
        this.saveToDisk();
        return newConv;
    }
    loadConversation(id) {
        const conv = this.conversations.find((c) => c.id === id);
        if (conv) {
            this.activeConversationId = id;
            return conv;
        }
        return null;
    }
    deleteConversation(id) {
        this.conversations = this.conversations.filter((c) => c.id !== id);
        if (this.activeConversationId === id) {
            this.activeConversationId = this.conversations.length > 0 ? this.conversations[0].id : null;
        }
        this.saveToDisk();
    }
    clearAll() {
        this.conversations = [];
        this.activeConversationId = null;
        this.saveToDisk();
    }
    updateActiveConversation(messages) {
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
    appendMessages(id, newMessages) {
        let conv = this.conversations.find((c) => c.id === (id || this.activeConversationId));
        if (!conv) {
            conv = this.createNewConversation();
        }
        // Append instead of overwrite
        const existingIds = new Set(conv.messages.map(m => m.id));
        for (const msg of newMessages) {
            if (!existingIds.has(msg.id)) {
                conv.messages.push(msg);
            }
            else {
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
exports.ConversationManager = ConversationManager;
//# sourceMappingURL=ConversationManager.js.map