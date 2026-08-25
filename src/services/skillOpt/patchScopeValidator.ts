import { Candidate } from './candidateGenerator';
export type PatchScopeDecision = 'ALLOW' | 'BLOCK';

export interface PatchScopeResult {
    decision: PatchScopeDecision;
    reason: string;
}

export class PatchScopeValidator {
    private static instance: PatchScopeValidator;

    private constructor() {}

    public static getInstance(): PatchScopeValidator {
        if (!PatchScopeValidator.instance) {
            PatchScopeValidator.instance = new PatchScopeValidator();
        }
        return PatchScopeValidator.instance;
    }

    /**
     * Validates if a generated candidate stays within the allowed scope.
     * @param candidate The generated candidate containing proposed edits.
     * @param allowedScope The primary target or authorized scope (e.g., 'src/components/Dashboard.tsx').
     */
    public validateScope(candidate: Candidate, allowedScope: string): PatchScopeResult {
        if (!candidate || !candidate.edits || candidate.edits.length === 0) {
            return { decision: 'ALLOW', reason: 'No edits to validate.' };
        }

        const lowerScope = allowedScope.toLowerCase();
        
        for (const edit of candidate.edits) {
            // Very rudimentary check for this implementation.
            // If the scope specifies a specific file or component, and the edit is for a completely different file path (if known), we flag it.
            // Assuming candidate.edits might have 'section' properties
            const editTarget = (edit.section || '').toLowerCase();
            
            if (editTarget && lowerScope.includes('.tsx') && !lowerScope.includes(editTarget) && !editTarget.includes(lowerScope)) {
                 // For example, if scope is "Dashboard.tsx" but edit targets "UserPreferences.tsx"
                 if (editTarget.includes('.ts') || editTarget.includes('.js')) {
                     return {
                         decision: 'BLOCK',
                         reason: `Scope Escape Detected: Authorized scope is ${allowedScope}, but candidate attempts to modify ${editTarget}.`
                     };
                 }
            }
        }

        return {
            decision: 'ALLOW',
            reason: 'Candidate remains within authorized scope.'
        };
    }
}
