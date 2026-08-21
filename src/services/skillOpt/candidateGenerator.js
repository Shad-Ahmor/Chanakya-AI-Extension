"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandidateGenerator = void 0;
const aiService_1 = require("../aiService");
class CandidateGenerator {
    static instance;
    aiService = aiService_1.AIService.getInstance();
    constructor() { }
    static getInstance() {
        if (!CandidateGenerator.instance) {
            CandidateGenerator.instance = new CandidateGenerator();
        }
        return CandidateGenerator.instance;
    }
    async generateCandidate(currentSkillContent, reflection) {
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
        return new Promise((resolve, reject) => {
            let fullText = '';
            this.aiService.streamCompletion({
                prompt: prompt,
                systemInstruction: 'You are a JSON-only API. Respond only with a valid JSON array.',
                callbacks: {
                    onChunk: (chunk) => {
                        fullText += chunk;
                    },
                    onComplete: (text) => {
                        try {
                            const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                            const edits = JSON.parse(cleanedText);
                            const candidateContent = this.applyEdits(currentSkillContent, edits);
                            resolve({ edits, candidateContent });
                        }
                        catch (e) {
                            reject(new Error('Failed to parse candidate JSON: ' + e.message));
                        }
                    },
                    onError: (error) => {
                        reject(error);
                    }
                }
            });
        });
    }
    applyEdits(currentContent, edits) {
        let newContent = currentContent;
        for (const edit of edits) {
            if (edit.operation === 'ADD') {
                if (edit.section && newContent.includes(edit.section)) {
                    // Simple append to section
                    newContent = newContent.replace(edit.section, edit.section + '\n' + edit.content);
                }
                else {
                    // Append to bottom if section not found
                    newContent += '\n\n' + (edit.section ? `## ${edit.section}\n` : '') + edit.content;
                }
            }
            else if (edit.operation === 'REPLACE' && edit.targetContent && edit.content) {
                newContent = newContent.replace(edit.targetContent, edit.content);
            }
            else if (edit.operation === 'DELETE' && edit.targetContent) {
                newContent = newContent.replace(edit.targetContent, '');
            }
        }
        return newContent.trim();
    }
}
exports.CandidateGenerator = CandidateGenerator;
//# sourceMappingURL=candidateGenerator.js.map