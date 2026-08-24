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
        
        // Chunking large sections safely without holding string arrays in memory
        const maxLength = 50000;
        let currentIndex = 0;
        let chunkIndex = 0;
        
        while (currentIndex < prompt.length) {
            let nextIndex = currentIndex + maxLength;
            if (nextIndex < prompt.length) {
                const newlineIndex = prompt.lastIndexOf('\n', nextIndex);
                if (newlineIndex > currentIndex) {
                    nextIndex = newlineIndex;
                }
            }
            
            const chunk = prompt.substring(currentIndex, nextIndex);
            const chunkHash = crypto.createHash('sha256').update(chunk).digest('hex').substring(0, 8);
            await fs.writeFile(path.join(sourceDir, `section-${chunkIndex.toString().padStart(3, '0')}-${chunkHash}.md`), chunk, 'utf-8');
            
            currentIndex = nextIndex + (prompt[nextIndex] === '\n' ? 1 : 0);
            chunkIndex++;
        }

        return {
            taskId,
            originalInputHash,
            metrics,
            sourceDir
        };
    }
}
