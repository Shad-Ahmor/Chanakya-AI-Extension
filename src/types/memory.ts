export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'mistake';

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
  
  // Older fields moved or mapped to new names
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
