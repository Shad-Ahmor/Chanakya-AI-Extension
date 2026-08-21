export interface GraphNode {
  id: string;
  label: string;
  title?: string;
  color: {
    background: string;
    border: string;
    highlight: {
      background: string;
      border: string;
    };
  };
  size: number;
  font?: {
    size: number;
    color: string;
  };
  community: number;
  community_name: string;
  source_file: string;
  file_type: 'code' | 'file' | 'class' | 'function' | 'interface' | 'markdown' | 'config';
  degree: number;
  symbols?: string[] | undefined;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  arrows?: string | undefined;
  label?: string | undefined;
  title?: string | undefined;
  type?: 'import' | 'api-network' | 'declares' | 'references' | 'style' | undefined;
  relation?: string | undefined;
  dashes?: boolean | number[] | undefined;
  color?: {
    color?: string | undefined;
    highlight?: string | undefined;
    hover?: string | undefined;
    opacity?: number | undefined;
  } | undefined;
  width?: number | undefined;
}

export interface GraphCommunity {
  id: number;
  name: string;
  color: string;
  count: number;
  selected?: boolean;
}

export interface GodNode {
  id: string;
  label: string;
  source_file: string;
  degree: number;
  file_type: string;
}

export interface SurprisingConnection {
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  relation: string;
  type?: string | undefined;
  reason: string;
}

export interface ImportCycle {
  path: string[];
  labels: string[];
}

export interface SuggestedQuestion {
  question: string;
  category: 'architecture' | 'coupling' | 'flow' | 'security';
}

export interface AffectedNode {
  id: string;
  label: string;
  source_file: string;
  depth: number;
  via_relation: string;
  isDirect: boolean;
}

export interface BlastRadiusResult {
  targetNodeId: string;
  targetLabel: string;
  targetFile: string;
  affectedNodes: AffectedNode[];
  totalAffected: number;
  maxDepth: number;
}

export interface WorkMemoryLesson {
  id: string;
  topic: string;
  status: 'preferred' | 'tentative' | 'dead_end';
  score: number;
  sources: string[];
  lesson: string;
}

export interface GraphifyAnalytics {
  godNodes: GodNode[];
  surprisingConnections: SurprisingConnection[];
  importCycles: ImportCycle[];
  suggestedQuestions: SuggestedQuestion[];
  lessons?: WorkMemoryLesson[] | undefined;
}

export interface GraphifyData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  communities: GraphCommunity[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    communityCount: number;
  };
  analytics?: GraphifyAnalytics | undefined;
}
