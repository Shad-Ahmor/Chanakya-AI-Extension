export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'mistake';

export interface MemoryEnvironment {
  os?: string;
  hardware?: string;
  runtime?: string;
  framework?: string;
  model?: string;
}

export interface MemoryRecord {
  memory_id: string;
  memory_type: MemoryType;
  title: string;
  task: string;
  context?: string;
  action?: string;
  result?: string;
  error?: string;
  root_cause?: string;
  correction?: string;
  prevention?: string;
  general_lesson?: string;
  environment?: MemoryEnvironment;
  tools?: string[];
  tags?: string[];
  confidence: number;
  importance: number;
  reliability: number;
  times_retrieved: number;
  times_helped: number;
  times_failed: number;
  created_at: string;
  updated_at: string;
  last_used_at: string;
  version: number;
  status: 'active' | 'superseded' | 'disabled';
  superseded_by?: string;
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
