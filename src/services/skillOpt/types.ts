export type TaskStatus = 'TASK_ACCEPTED' | 'TASK_COMPLETED' | 'TASK_BLOCKED' | 'TASK_NOT_APPLICABLE' | 'TASK_NEEDS_CLARIFICATION' | 'TASK_FAILED' | 'TASK_CANCELLED';
export type CandidateStatus = 'CANDIDATE_NOT_CREATED' | 'CANDIDATE_CREATED' | 'CANDIDATE_APPLIED' | 'CANDIDATE_EVALUATED' | 'CANDIDATE_ACCEPTED' | 'CANDIDATE_REJECTED' | 'CANDIDATE_ROLLED_BACK';
export type EvaluationStatus = 'EVALUATION_NOT_RUN' | 'EVALUATION_RUNNING' | 'EVALUATION_PASSED' | 'EVALUATION_FAILED' | 'EVALUATION_BLOCKED' | 'EVALUATION_SKIPPED';
export type OptimizationDecisionType = 'ACCEPTED' | 'REJECTED' | 'NOT_EVALUATED';

export type ReasonCode = 
    | 'TASK_TARGET_NOT_FOUND' 
    | 'TASK_REQUIREMENTS_NOT_SATISFIED' 
    | 'TASK_NOT_APPLICABLE' 
    | 'TASK_NEEDS_CLARIFICATION' 
    | 'MCP_TOOL_UNAVAILABLE' 
    | 'MCP_PERMISSION_DENIED' 
    | 'ENVIRONMENT_UNAVAILABLE' 
    | 'NO_RELEVANT_CODE_FOUND' 
    | 'NO_MUTATION_FOUND' 
    | 'NO_TEST_INFRASTRUCTURE' 
    | 'CANDIDATE_NOT_CREATED' 
    | 'CANDIDATE_GENERATION_FAILED' 
    | 'CANDIDATE_NOT_APPLIED' 
    | 'EVALUATION_NOT_RUN' 
    | 'EVALUATION_FAILED' 
    | 'BASELINE_NOT_AVAILABLE' 
    | 'CANDIDATE_WORSE_THAN_BASELINE' 
    | 'CANDIDATE_DID_NOT_IMPROVE' 
    | 'CANDIDATE_ACCEPTED' 
    | 'CANDIDATE_REJECTED';

export interface TaskResult {
    status: TaskStatus;
    reason: string;
    reasonCode: ReasonCode;
    evidence?: string[];
}

export interface CandidateResult {
    status: CandidateStatus;
    candidateId: string | null;
    generated: boolean;
    applied: boolean;
}

export interface EvaluationResult {
    status: EvaluationStatus;
    score: number;
    baselineScore: number;
    candidateScore: number;
    testsPassed: boolean;
}

export interface OptimizationDecision {
    decision: OptimizationDecisionType;
    reason: string;
}

export interface OptimizationResult {
    // Legacy backward compatibility
    decision: 'accepted' | 'rejected' | 'not_evaluated';
    improvement?: number;
    previousVersion?: number;
    candidateVersion?: number;
    scoreBefore?: number;
    scoreAfter?: number;
    changes?: any[];
    reason?: string;
    skill?: string;
    
    // New Rich Taxonomy
    task: TaskResult;
    candidate: CandidateResult;
    evaluation: EvaluationResult;
    optimization: OptimizationDecision;
}
