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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
var vscode = __importStar(require("vscode"));
var logger_1 = require("../utils/logger");
var secretManager_1 = require("./secretManager");
/**
 * AIService handles resilient, streaming communication with LLM providers.
 * Built with native fetch, token-efficient system prompts, and strict cancellation support.
 */
var AIService = /** @class */ (function () {
    function AIService() {
        this.logger = logger_1.Logger.getInstance();
        this.secretManager = secretManager_1.SecretManager.getInstance();
    }
    AIService.getInstance = function () {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    };
    AIService.prototype.getConfig = function () {
        var config = vscode.workspace.getConfiguration('aiEnhancer');
        return {
            model: config.get('model', 'gemini-1.5-flash'),
            maxTokens: config.get('maxTokens', 2048),
            temperature: config.get('temperature', 0.2),
            autoContextExtraction: config.get('autoContextExtraction', true),
            systemPrompt: config.get('systemPrompt', 'You are Chanakya AI, an expert and elite coding assistant. Provide clean, efficient, and well-documented code.'),
            chatHistorySize: config.get('chat.historySize', 10),
            customHeaders: config.get('customHeaders', {}),
            apiEndpoint: config.get('apiEndpoint', 'https://api.openai.com/v1')
        };
    };
    /**
     * Streams completion from the selected AI provider.
     */
    AIService.prototype.streamCompletion = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var prompt, systemInstruction, callbacks, cancellationToken, config, apiKey, modelName, url, contents, bodyPayload, finalSystemInstruction, controller_1, response, errText, accumulatedText, reader, decoder, buffer, _a, done, value, lines, _i, lines_1, line, trimmed, jsonStr, data, candidates, _b, _c, part, error_1;
            var _this = this;
            var _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        prompt = params.prompt, systemInstruction = params.systemInstruction, callbacks = params.callbacks, cancellationToken = params.cancellationToken;
                        config = this.getConfig();
                        return [4 /*yield*/, this.secretManager.getApiKey('gemini')];
                    case 1:
                        apiKey = _f.sent();
                        if (!apiKey) {
                            callbacks.onError(new Error('API Key not found. Please configure your API key using the command: "Chanakya AI Enhancer: Configure API Key"'));
                            return [2 /*return*/];
                        }
                        _f.label = 2;
                    case 2:
                        _f.trys.push([2, 9, , 10]);
                        this.logger.log("Initiating stream request with model: ".concat(config.model));
                        modelName = config.model.startsWith('gemini') ? config.model : 'gemini-1.5-flash';
                        url = "https://generativelanguage.googleapis.com/v1beta/models/".concat(modelName, ":streamGenerateContent?alt=sse&key=").concat(apiKey);
                        contents = [];
                        contents.push({
                            role: 'user',
                            parts: [{ text: prompt }]
                        });
                        bodyPayload = {
                            contents: contents,
                            generationConfig: {
                                temperature: config.temperature,
                                maxOutputTokens: config.maxTokens,
                                topP: 0.95
                            }
                        };
                        finalSystemInstruction = systemInstruction || config.systemPrompt;
                        if (finalSystemInstruction) {
                            bodyPayload.systemInstruction = {
                                parts: [{ text: finalSystemInstruction }]
                            };
                        }
                        controller_1 = new AbortController();
                        if (cancellationToken) {
                            cancellationToken.onCancellationRequested(function () {
                                _this.logger.log('AI Request cancelled by user');
                                controller_1.abort();
                            });
                        }
                        return [4 /*yield*/, fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(bodyPayload),
                                signal: controller_1.signal
                            })];
                    case 3:
                        response = _f.sent();
                        if (!!response.ok) return [3 /*break*/, 5];
                        return [4 /*yield*/, response.text()];
                    case 4:
                        errText = _f.sent();
                        throw new Error("API Error [".concat(response.status, "]: ").concat(errText));
                    case 5:
                        if (!response.body) {
                            throw new Error('Readable stream not supported or response body is empty');
                        }
                        accumulatedText = '';
                        reader = response.body.getReader();
                        decoder = new TextDecoder('utf-8');
                        buffer = '';
                        _f.label = 6;
                    case 6:
                        if (!true) return [3 /*break*/, 8];
                        if (cancellationToken === null || cancellationToken === void 0 ? void 0 : cancellationToken.isCancellationRequested) {
                            return [3 /*break*/, 8];
                        }
                        return [4 /*yield*/, reader.read()];
                    case 7:
                        _a = _f.sent(), done = _a.done, value = _a.value;
                        if (done) {
                            return [3 /*break*/, 8];
                        }
                        buffer += decoder.decode(value, { stream: true });
                        lines = buffer.split('\n');
                        buffer = lines.pop() || '';
                        for (_i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                            line = lines_1[_i];
                            trimmed = line.trim();
                            if (!trimmed || !trimmed.startsWith('data: ')) {
                                continue;
                            }
                            jsonStr = trimmed.substring(6);
                            try {
                                data = JSON.parse(jsonStr);
                                candidates = data.candidates;
                                if (candidates && ((_e = (_d = candidates[0]) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.parts)) {
                                    for (_b = 0, _c = candidates[0].content.parts; _b < _c.length; _b++) {
                                        part = _c[_b];
                                        if (part.text) {
                                            accumulatedText += part.text;
                                            callbacks.onChunk(part.text);
                                        }
                                    }
                                }
                            }
                            catch (_g) {
                                // Partial JSON chunks are handled in next buffer
                            }
                        }
                        return [3 /*break*/, 6];
                    case 8:
                        callbacks.onComplete(accumulatedText);
                        return [3 /*break*/, 10];
                    case 9:
                        error_1 = _f.sent();
                        if (error_1 instanceof Error && error_1.name === 'AbortError') {
                            this.logger.log('Request aborted successfully');
                            return [2 /*return*/];
                        }
                        this.logger.error('Error during AI streaming completion', error_1);
                        callbacks.onError(error_1 instanceof Error ? error_1 : new Error(String(error_1)));
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    return AIService;
}());
exports.AIService = AIService;
