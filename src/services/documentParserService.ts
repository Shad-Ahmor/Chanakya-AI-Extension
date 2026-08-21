import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from '../utils/logger';

export class DocumentParserService {
  private static instance: DocumentParserService;
  private readonly logger = Logger.getInstance();

  private constructor() {}

  public static getInstance(): DocumentParserService {
    if (!DocumentParserService.instance) {
      DocumentParserService.instance = new DocumentParserService();
    }
    return DocumentParserService.instance;
  }

  /**
   * Parses text from a file based on its extension.
   * Supports: .txt, .md, .pdf, .docx, and raw code files.
   */
  public async parseDocument(filePath: string): Promise<string> {
    try {
      const ext = path.extname(filePath).toLowerCase();
      this.logger.log(`[DocumentParserService] Parsing file: ${filePath} (ext: ${ext})`);

      if (ext === '.pdf') {
        const pdfParse = require('pdf-parse');
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
      } else if (ext === '.docx') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
      } else {
        // Fallback for .txt, .md, .csv, .json, .ts, etc.
        return await fs.readFile(filePath, 'utf8');
      }
    } catch (e: any) {
      this.logger.error(`[DocumentParserService] Failed to parse ${filePath}`, e);
      throw new Error(`Failed to read file ${path.basename(filePath)}: ${e.message}`);
    }
  }
}
