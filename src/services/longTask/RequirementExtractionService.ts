import { Requirement, RequirementStatus } from './types';
import { Logger } from '../../utils/logger';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export class RequirementExtractionService {
    private readonly logger = Logger.getInstance();

    constructor() {}

    public async extractRequirements(sourceDir: string): Promise<Requirement[]> {
        this.logger.log(`[RequirementExtraction] Extracting requirements from ${sourceDir}`);
        
        const reqs: Requirement[] = [];
        
        try {
            // Read the main input to extract requirements
            // In a real implementation with a huge prompt, this would iterate over the chunks
            // and map reduce the requirements to avoid hitting token limits.
            const inputPath = path.join(sourceDir, 'input.md');
            const content = await fs.readFile(inputPath, 'utf-8');

            // LLM prompt for future extraction will be built here when integrated

            // We mock the LLM call for now, but connect the structure.
            // const response = await this.llmEngine.chat([{ role: 'system', content: systemPrompt }, { role: 'user', content }]);
            // const parsed = JSON.parse(response);
            
            // Mock extraction logic based on the user prompt's content (heuristics)
            const isRefactor = content.toLowerCase().includes('refactor');
            const isAuth = content.toLowerCase().includes('auth');
            
            reqs.push({
                id: `REQ-${randomUUID().slice(0, 4).toUpperCase()}`,
                description: isRefactor ? 'Refactor the target module without breaking existing functionality' : 'Implement the requested feature',
                type: 'MUST',
                priority: 'CRITICAL',
                category: isRefactor ? 'architectural' : 'functional',
                sourceSection: 'input.md',
                dependencies: [],
                acceptanceCriteria: ['All tests pass', 'Code compiles'],
                status: RequirementStatus.PENDING,
                verificationMethod: 'npm run test'
            });

            if (isAuth) {
                reqs.push({
                    id: `REQ-${randomUUID().slice(0, 4).toUpperCase()}`,
                    description: 'Ensure session security is maintained',
                    type: 'MUST',
                    priority: 'HIGH',
                    category: 'security',
                    sourceSection: 'input.md',
                    dependencies: [],
                    acceptanceCriteria: ['No plaintext tokens stored'],
                    status: RequirementStatus.PENDING,
                    verificationMethod: 'Security audit tool'
                });
            }

            // Extract explicit constraints
            const constraints = content.match(/(must not|never|do not)/gi);
            if (constraints && constraints.length > 0) {
                reqs.push({
                    id: `REQ-${randomUUID().slice(0, 4).toUpperCase()}`,
                    description: 'Follow explicit user constraints',
                    type: 'MUST NOT',
                    priority: 'CRITICAL',
                    category: 'explicit_constraint',
                    sourceSection: 'input.md',
                    dependencies: [],
                    acceptanceCriteria: ['Constraint is never violated'],
                    status: RequirementStatus.PENDING,
                    verificationMethod: 'Manual code review'
                });
            }

            return reqs;
        } catch (error) {
            this.logger.error('[RequirementExtraction] Failed to extract requirements', error);
            throw error;
        }
    }
}
