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
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  arrows?: string;
  color?: {
    color: string;
    highlight?: string;
    opacity?: number;
  };
  width?: number;
  relation?: string;
}

export interface GraphCommunity {
  id: number;
  name: string;
  color: string;
  count: number;
  selected?: boolean;
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
}
