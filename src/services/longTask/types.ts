export enum TaskState {
    RECEIVED = 'RECEIVED',
    PENDING = 'PENDING',
    ANALYZING = 'ANALYZING',
    PLANNING = 'PLANNING',
    PLAN_VERIFICATION = 'PLAN_VERIFICATION',
    READY = 'READY',
    EXECUTING = 'EXECUTING',
    WAITING_TOOL = 'WAITING_TOOL',
    VERIFYING = 'VERIFYING',
    CHECKPOINTING = 'CHECKPOINTING',
    PAUSED = 'PAUSED',
    RECOVERING = 'RECOVERING',
    BLOCKED = 'BLOCKED',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED'
}

export enum RequirementStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    SATISFIED = 'SATISFIED',
    FAILED = 'FAILED',
    BLOCKED = 'BLOCKED',
    SUPERSEDED = 'SUPERSEDED'
}

export enum TaskComplexity {
    SMALL = 'SMALL',
    MEDIUM = 'MEDIUM',
    LARGE = 'LARGE',
    VERY_LARGE = 'VERY_LARGE',
    EXTREME = 'EXTREME'
}

export interface ComplexityScore {
    tokenPressure: number;
    requirementCount: number;
    fileCount: number;
    dependencyDepth: number;
    operationCount: number;
    ambiguity: number;
    expectedToolCalls: number;
    classification: TaskComplexity;
}

export type RequirementCategory = 
    | 'functional'
    | 'technical'
    | 'architectural'
    | 'UI'
    | 'performance'
    | 'security'
    | 'compatibility'
    | 'persistence'
    | 'testing'
    | 'deployment'
    | 'explicit_constraint';

export interface Requirement {
    id: string; // e.g. REQ-001
    type: 'MUST' | 'SHOULD' | 'MAY' | 'MUST NOT';
    description: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    category: RequirementCategory;
    sourceSection: string;
    dependencies: string[];
    acceptanceCriteria: string[];
    status: RequirementStatus;
    verificationMethod: string;
}

export interface WorkingSet {
    currentFiles: string[];
    relevantFiles: string[];
    recentlyModifiedFiles: string[];
    referencedFiles: string[];
    testFiles: string[];
    configFiles: string[];
    dependencyFiles: string[];
}

export interface Step {
    stepId: string;
    objective: string;
    requiredInputs: string[];
    expectedOutput: string;
    filesInvolved: string[];
    toolsRequired: string[];
    dependencies: string[];
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    verificationMethod: string;
    status: TaskState;
}

export interface Phase {
    phaseId: string;
    name: string;
    steps: Step[];
    status: TaskState;
}

export interface TaskArtifact {
    taskId: string;
    originalInput: string;
    normalizedGoal: string;
    requirements: Requirement[];
    constraints: string[];
    acceptanceCriteria: string[];
    referencedFiles: string[];
    referencedTechnologies: string[];
    detectedRisks: string[];
    ambiguities: string[];
    dependencies: string[];
    assumptions: string[];
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    complexity: TaskComplexity;
    createdAt: number;
    updatedAt: number;
    phases: Phase[];
    state: TaskState;
    workingSet?: WorkingSet;
}

export interface TaskCheckpoint {
    taskId: string;
    currentPhase: string | null;
    currentStep: string | null;
    completedSteps: string[];
    pendingSteps: string[];
    modifiedFiles: string[];
    verifiedFiles: string[];
    testResults: any[];
    decisions: string[];
    errors: string[];
    timestamp: number;
    currentWorkingSet?: WorkingSet;
}
