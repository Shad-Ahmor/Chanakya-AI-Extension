import { AIService } from '../aiService';
import { ReflectionResult } from './reflectionEngine';

export interface SkillEdit {
    operation: 'ADD' | 'REPLACE' | 'DELETE';
    section: string;
    content?: string;
    targetContent?: string; // used for REPLACE or DELETE to identify what to change
}

export interface CandidateGenerationResult {
    edits: SkillEdit[];
    candidateContent: string;
}

export class CandidateGenerator {
    private static instance: CandidateGenerator;
    private aiService = AIService.getInstance();

    private constructor() {}

    public static getInstance(): CandidateGenerator {
        if (!CandidateGenerator.instance) {
            CandidateGenerator.instance = new CandidateGenerator();
        }
        return CandidateGenerator.instance;
    }

    public async generateCandidate(currentSkillContent: string, reflection: ReflectionResult): Promise<CandidateGenerationResult> {
        if (reflection.improvements.length === 0) {
            return { edits: [], candidateContent: currentSkillContent };
        }

        const prompt = `You are an expert AI behavior optimizer.
You are given the current skill instructions and a reflection report detailing behavioral problems and improvements.
Generate a minimal, evidence-based set of edits to improve the skill.
Do not invent problems. Do not make unrelated changes. Do not remove useful existing behavior.

Current Skill:
\`\`\`markdown
${currentSkillContent}
\`\`\`

Reflection Improvements:
${JSON.stringify(reflection.improvements, null, 2)}

Output your edits as ONLY a valid JSON array of objects matching this schema:
[
  {
    "operation": "ADD" | "REPLACE" | "DELETE",
    "section": "The name of the section you are modifying or adding to",
    "content": "The new content to ADD or REPLACE with",
    "targetContent": "The exact existing content to REPLACE or DELETE"
  }
]
No markdown formatting, no explanation. Just the JSON array.`;

        return new Promise<CandidateGenerationResult>((resolve, reject) => {
            let fullText = '';
            
            this.aiService.streamCompletion({
                prompt: prompt,
                systemInstruction: 'You are a JSON-only API. Respond only with a valid JSON array.',
                callbacks: {
                    onChunk: (chunk: string) => {
                        fullText += chunk;
                    },
                    onComplete: (text: string) => {
                        try {
                            const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                            const edits = JSON.parse(cleanedText) as SkillEdit[];
                            const candidateContent = this.applyEdits(currentSkillContent, edits);
                            resolve({ edits, candidateContent });
                        } catch (e) {
                            reject(new Error('Failed to parse candidate JSON: ' + (e as Error).message));
                        }
                    },
                    onError: (error: Error) => {
                        reject(error);
                    }
                }
            });
        });
    }

    public applyEdits(currentContent: string, edits: SkillEdit[]): string {
        let newContent = currentContent;
        for (const edit of edits) {
            if (edit.operation === 'ADD') {
                if (edit.section && newContent.includes(edit.section)) {
                    // Simple append to section
                    newContent = newContent.replace(edit.section, edit.section + '\n' + edit.content);
                } else {
                    // Append to bottom if section not found
                    newContent += '\n\n' + (edit.section ? `## ${edit.section}\n` : '') + edit.content;
                }
            } else if (edit.operation === 'REPLACE' && edit.targetContent && edit.content) {
                newContent = newContent.replace(edit.targetContent, edit.content);
            } else if (edit.operation === 'DELETE' && edit.targetContent) {
                newContent = newContent.replace(edit.targetContent, '');
            }
        }
        return newContent.trim();
    }
}
