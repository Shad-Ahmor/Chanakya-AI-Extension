export type MemoryType = 
  | 'AGENT_ERROR' 
  | 'TASK_REPOSITORY_MISMATCH'
  | 'USER_AMBIGUITY'
  | 'ENVIRONMENT_FAILURE'
  | 'TOOL_FAILURE'
  | 'CANDIDATE_FAILURE'
  | 'EVALUATION_FAILURE'
  | 'SUCCESSFUL_PROCEDURE'
  | 'GENERAL_LESSON'
  | 'CONTRADICTION'
  | 'SUPERSEDED_LESSON';

export interface MemoryEnvironment {
  os?: string;
  hardware?: string;
  runtime?: string;
  framework?: string;
  model?: string;
}

export interface MemoryRecord {
  id: string;
  type: MemoryType;
  title: string;
  task: string;
  content: string; // The primary content or lesson
  embedding?: number[];
  
  trigger?: string;
  context?: string;
  observation?: string;
  action?: string;
  outcome?: string;
  evidence?: string;
  verificationStatus?: string;

  // Semantic execution flags
  agent_error?: boolean;
  candidate_generated?: boolean;
  evaluation_executed?: boolean;
  reusable_lesson?: boolean;

  // Legacy/other optional fields
  error?: string;
  root_cause?: string;
  correction?: string;
  prevention?: string;
  general_lesson?: string;
  
  confidence: number;
  applicability: number;
  status: 'active' | 'superseded' | 'suppressed';

  metadata: {
    taskType: string;
    framework?: string;
    environment?: string;
    model?: string;
    
    createdAt: number;
    lastUsedAt?: number;
    lastVerifiedAt?: number;
    
    successCount: number;
    failureCount: number;
    
    source: 'reflection' | 'skillopt' | 'verification' | 'user';
    supersededBy?: string;
    
    // Additional optional metadata
    tags?: string[];
    tools?: string[];
  };
}

export interface ReflectionResult {
  success: boolean;
  score: number;
  issues: string[];
  root_cause?: string;
  correction?: string;
  lesson?: string;
  prevention?: string;
  should_remember: boolean;
  importance?: number;
}

export interface DocumentChunk {
  chunk_id: string;
  document_id: string;
  source: string;
  filename: string;
  chunk_index: number;
  content: string;
  created_at: string;
  updated_at: string;
}
