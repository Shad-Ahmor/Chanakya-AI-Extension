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
exports.DocumentParserService = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const logger_1 = require("../utils/logger");
class DocumentParserService {
    static instance;
    logger = logger_1.Logger.getInstance();
    constructor() { }
    static getInstance() {
        if (!DocumentParserService.instance) {
            DocumentParserService.instance = new DocumentParserService();
        }
        return DocumentParserService.instance;
    }
    /**
     * Parses text from a file based on its extension.
     * Supports: .txt, .md, .pdf, .docx, and raw code files.
     */
    async parseDocument(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            this.logger.log(`[DocumentParserService] Parsing file: ${filePath} (ext: ${ext})`);
            if (ext === '.pdf') {
                const pdfParse = require('pdf-parse');
                const dataBuffer = await fs.readFile(filePath);
                const data = await pdfParse(dataBuffer);
                return data.text;
            }
            else if (ext === '.docx') {
                const mammoth = require('mammoth');
                const result = await mammoth.extractRawText({ path: filePath });
                return result.value;
            }
            else {
                // Fallback for .txt, .md, .csv, .json, .ts, etc.
                return await fs.readFile(filePath, 'utf8');
            }
        }
        catch (e) {
            this.logger.error(`[DocumentParserService] Failed to parse ${filePath}`, e);
            throw new Error(`Failed to read file ${path.basename(filePath)}: ${e.message}`);
        }
    }
}
exports.DocumentParserService = DocumentParserService;
//# sourceMappingURL=documentParserService.js.map