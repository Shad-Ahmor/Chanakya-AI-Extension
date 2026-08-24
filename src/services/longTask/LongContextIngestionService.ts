import { TaskComplexityDetector } from './TaskComplexityDetector';
import { ComplexityScore } from './types';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../utils/logger';

export interface IngestionResult {
    taskId: string;
    originalInputHash: string;
    metrics: ComplexityScore;
    sourceDir: string;
}

export class LongContextIngestionService {
    private readonly logger = Logger.getInstance();

    constructor(
        private readonly detector: TaskComplexityDetector,
        private readonly storageBaseDir: string
    ) {}

    public async ingest(prompt: string, taskId: string): Promise<IngestionResult> {
        this.logger.log(`[LongContextIngestion] Ingesting prompt for task ${taskId}...`);
        
        const metrics = this.detector.detect(prompt);
        const originalInputHash = crypto.createHash('sha256').update(prompt).digest('hex');
        
        const taskDir = path.join(this.storageBaseDir, taskId);
        const sourceDir = path.join(taskDir, 'source');
        
        await fs.mkdir(sourceDir, { recursive: true });
        
        // Save the raw input outside active context
        await fs.writeFile(path.join(sourceDir, 'input.md'), prompt, 'utf-8');
        
        // Chunking large sections (simulation of chunking logic for simplicity)
        const chunks = this.chunkText(prompt, 5000);
        for (let i = 0; i < chunks.length; i++) {
            const chunkHash = crypto.createHash('sha256').update(chunks[i]).digest('hex').substring(0, 8);
            await fs.writeFile(path.join(sourceDir, `section-${i.toString().padStart(3, '0')}-${chunkHash}.md`), chunks[i], 'utf-8');
        }

        return {
            taskId,
            originalInputHash,
            metrics,
            sourceDir
        };
    }

    private chunkText(text: string, maxLength: number): string[] {
        const chunks: string[] = [];
        let currentIndex = 0;
        
        while (currentIndex < text.length) {
            let nextIndex = currentIndex + maxLength;
            if (nextIndex < text.length) {
                const newlineIndex = text.lastIndexOf('\n', nextIndex);
                if (newlineIndex > currentIndex) {
                    nextIndex = newlineIndex;
                }
            }
            chunks.push(text.substring(currentIndex, nextIndex));
            currentIndex = nextIndex;
        }
        
        return chunks;
    }
}
