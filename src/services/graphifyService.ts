import * as vscode from 'vscode';
import * as path from 'path';
import { GraphNode, GraphEdge, GraphifyData } from '../types/graphify';
import { Logger } from '../utils/logger';

const COMMUNITY_PALETTE = [
  '#4E79A7', // Blue
  '#F28E2B', // Orange
  '#E15759', // Red
  '#76B7B2', // Teal
  '#59A14F', // Green
  '#EDC948', // Yellow
  '#B07AA1', // Purple
  '#FF9DA7', // Pink
  '#9C755F', // Brown
  '#BAB0AC', // Gray
  '#5499C7', // Sky Blue
  '#48C9B0', // Mint
  '#F5B041', // Amber
  '#EB984E', // Coral
  '#AF7AC5', // Lavender
  '#5DADE2', // Cyan
  '#45B39D', // Emerald
  '#F4D03F'  // Gold
];

export class GraphifyService {
  private static instance: GraphifyService;
  private readonly logger = Logger.getInstance();
  private cachedData: GraphifyData | null = null;

  public static getInstance(): GraphifyService {
    if (!GraphifyService.instance) {
      GraphifyService.instance = new GraphifyService();
    }
    return GraphifyService.instance;
  }

  /**
   * Scans workspace, analyzes files, dependencies, AST symbols, and constructs Graphify graph data.
   */
  public async generateGraphData(forceRefresh = false): Promise<GraphifyData> {
    if (this.cachedData && !forceRefresh) {
      return this.cachedData;
    }

    const wsFolders = vscode.workspace.workspaceFolders;
    let rootPath: string | null = null;

    if (wsFolders && wsFolders.length > 0) {
      rootPath = wsFolders[0].uri.fsPath;
    } else if (vscode.window.activeTextEditor) {
      rootPath = path.dirname(vscode.window.activeTextEditor.document.fileName);
    }

    if (!rootPath) {
      this.logger.log('[GraphifyService] No workspace folder or active file open');
      return {
        nodes: [],
        edges: [],
        communities: [],
        stats: { nodeCount: 0, edgeCount: 0, communityCount: 0 }
      };
    }

    this.logger.log(`[GraphifyService] Scanning workspace for graph: ${rootPath}`);

    const excludePattern = '{**/node_modules/**,**/dist/**,**/.git/**,**/.vscode/**,**/build/**,**/out/**,**/.next/**,**/venv/**,**/__pycache__/**}';
    const uris = await vscode.workspace.findFiles('**/*', excludePattern, 1000);

    const nodesMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const communityMap = new Map<string, { id: number; name: string; color: string; count: number }>();
    let nextCommunityId = 1;

    const getCommunity = (dirName: string) => {
      const normalized = dirName === '.' || dirName === '' ? 'Root' : dirName;
      if (!communityMap.has(normalized)) {
        const color = COMMUNITY_PALETTE[(nextCommunityId - 1) % COMMUNITY_PALETTE.length];
        communityMap.set(normalized, {
          id: nextCommunityId++,
          name: normalized,
          color,
          count: 0
        });
      }
      const comm = communityMap.get(normalized)!;
      comm.count++;
      return comm;
    };

    // File path -> node id map
    const fileToNodeId = new Map<string, string>();
    const symbolToNodeId = new Map<string, string>();

    // Pass 1: Create File & Module Nodes
    for (const uri of uris) {
      const relPath = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
      const dir = path.dirname(relPath);
      const fileName = path.basename(relPath);
      const ext = path.extname(relPath).toLowerCase();

      // Top level folder or component community
      const topDir = dir === '.' ? 'Root' : (dir.split('/')[0] || dir);
      const community = getCommunity(topDir);

      const nodeId = `file_${relPath.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      fileToNodeId.set(relPath, nodeId);
      fileToNodeId.set(relPath.replace(/\.[^/.]+$/, ''), nodeId); // without ext

      let fileType: GraphNode['file_type'] = 'file';
      if (['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.cpp', '.c'].includes(ext)) {
        fileType = 'code';
      } else if (['.md', '.markdown', '.txt'].includes(ext)) {
        fileType = 'markdown';
      } else if (['.json', '.yaml', '.yml', '.toml', '.xml'].includes(ext)) {
        fileType = 'config';
      }

      nodesMap.set(nodeId, {
        id: nodeId,
        label: fileName,
        title: `${relPath} (${fileType})`,
        color: {
          background: community.color,
          border: community.color,
          highlight: { background: '#ffffff', border: community.color }
        },
        size: 11,
        community: community.id,
        community_name: community.name,
        source_file: relPath,
        file_type: fileType,
        degree: 0
      });
    }

    // Pass 2: Parse File Contents for Symbols & Imports
    for (const uri of uris) {
      const relPath = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
      const fileNodeId = fileToNodeId.get(relPath);
      if (!fileNodeId) continue;

      const ext = path.extname(relPath).toLowerCase();
      if (!['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext)) continue;

      try {
        const fileBytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(fileBytes).toString('utf-8');
        const dir = path.dirname(relPath);
        const topDir = dir === '.' ? 'Root' : (dir.split('/')[0] || dir);
        const community = getCommunity(topDir);

        // 2a. Symbol Extraction (Classes, Functions, Interfaces)
        if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
          // Extract class
          const classRegex = /(?:export\s+)?class\s+([A-Za-z0-9_]+)/g;
          let match;
          while ((match = classRegex.exec(content)) !== null) {
            const symName = match[1];
            const symNodeId = `sym_${fileNodeId}_${symName}`;
            symbolToNodeId.set(symName, symNodeId);

            if (!nodesMap.has(symNodeId)) {
              nodesMap.set(symNodeId, {
                id: symNodeId,
                label: `${symName}`,
                title: `Class ${symName} in ${relPath}`,
                color: {
                  background: community.color,
                  border: community.color,
                  highlight: { background: '#ffffff', border: community.color }
                },
                size: 13,
                community: community.id,
                community_name: community.name,
                source_file: relPath,
                file_type: 'class',
                degree: 0
              });
              edges.push({
                id: `edge_${fileNodeId}_${symNodeId}`,
                from: fileNodeId,
                to: symNodeId,
                relation: 'declares'
              });
            }
          }

          // Extract interface
          const ifaceRegex = /(?:export\s+)?interface\s+([A-Za-z0-9_]+)/g;
          while ((match = ifaceRegex.exec(content)) !== null) {
            const symName = match[1];
            const symNodeId = `sym_${fileNodeId}_${symName}`;
            symbolToNodeId.set(symName, symNodeId);

            if (!nodesMap.has(symNodeId)) {
              nodesMap.set(symNodeId, {
                id: symNodeId,
                label: `${symName}`,
                title: `Interface ${symName} in ${relPath}`,
                color: {
                  background: community.color,
                  border: community.color,
                  highlight: { background: '#ffffff', border: community.color }
                },
                size: 11,
                community: community.id,
                community_name: community.name,
                source_file: relPath,
                file_type: 'interface',
                degree: 0
              });
              edges.push({
                id: `edge_${fileNodeId}_${symNodeId}`,
                from: fileNodeId,
                to: symNodeId,
                relation: 'declares'
              });
            }
          }

          // Extract top functions
          const fnRegex = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;
          while ((match = fnRegex.exec(content)) !== null) {
            const symName = match[1];
            const symNodeId = `sym_${fileNodeId}_${symName}`;
            symbolToNodeId.set(symName, symNodeId);

            if (!nodesMap.has(symNodeId)) {
              nodesMap.set(symNodeId, {
                id: symNodeId,
                label: `${symName}()`,
                title: `Function ${symName}() in ${relPath}`,
                color: {
                  background: community.color,
                  border: community.color,
                  highlight: { background: '#ffffff', border: community.color }
                },
                size: 10,
                community: community.id,
                community_name: community.name,
                source_file: relPath,
                file_type: 'function',
                degree: 0
              });
              edges.push({
                id: `edge_${fileNodeId}_${symNodeId}`,
                from: fileNodeId,
                to: symNodeId,
                relation: 'declares'
              });
            }
          }

          // 2b. Import Dependencies Extraction (TS/JS)
          const importRegex = /import\s+(?:\{([^}]+)\}|([A-Za-z0-9_*$]+))?\s*(?:from\s+)?['"]([^'"]+)['"]/g;
          while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[3];
            if (importPath.startsWith('.')) {
              // Resolve relative import
              const resolvedRel = path.normalize(path.join(dir, importPath)).replace(/\\/g, '/');
              const targetNodeId = fileToNodeId.get(resolvedRel) ||
                fileToNodeId.get(`${resolvedRel}.ts`) ||
                fileToNodeId.get(`${resolvedRel}.tsx`) ||
                fileToNodeId.get(`${resolvedRel}.js`) ||
                fileToNodeId.get(`${resolvedRel}/index.ts`) ||
                fileToNodeId.get(`${resolvedRel}/index.tsx`);

              if (targetNodeId && targetNodeId !== fileNodeId) {
                const edgeId = `edge_imp_${fileNodeId}_${targetNodeId}`;
                if (!edges.some(e => e.id === edgeId)) {
                  edges.push({
                    id: edgeId,
                    from: fileNodeId,
                    to: targetNodeId,
                    arrows: 'to',
                    relation: 'imports'
                  });
                }
              }
            }
          }
        } else if (ext === '.py') {
          // Python AST extraction (class, def, router)
          const pyClassRegex = /^class\s+([A-Za-z0-9_]+)/gm;
          let match;
          while ((match = pyClassRegex.exec(content)) !== null) {
            const symName = match[1];
            const symNodeId = `sym_${fileNodeId}_${symName}`;
            symbolToNodeId.set(symName, symNodeId);

            if (!nodesMap.has(symNodeId)) {
              nodesMap.set(symNodeId, {
                id: symNodeId,
                label: symName,
                title: `Class ${symName} in ${relPath}`,
                color: {
                  background: community.color,
                  border: community.color,
                  highlight: { background: '#ffffff', border: community.color }
                },
                size: 13,
                community: community.id,
                community_name: community.name,
                source_file: relPath,
                file_type: 'class',
                degree: 0
              });
              edges.push({
                id: `edge_${fileNodeId}_${symNodeId}`,
                from: fileNodeId,
                to: symNodeId,
                relation: 'declares'
              });
            }
          }

          const pyDefRegex = /^(?:async\s+)?def\s+([A-Za-z0-9_]+)/gm;
          while ((match = pyDefRegex.exec(content)) !== null) {
            const symName = match[1];
            if (symName.startsWith('__')) continue;
            const symNodeId = `sym_${fileNodeId}_${symName}`;
            symbolToNodeId.set(symName, symNodeId);

            if (!nodesMap.has(symNodeId)) {
              nodesMap.set(symNodeId, {
                id: symNodeId,
                label: `${symName}()`,
                title: `def ${symName}() in ${relPath}`,
                color: {
                  background: community.color,
                  border: community.color,
                  highlight: { background: '#ffffff', border: community.color }
                },
                size: 10,
                community: community.id,
                community_name: community.name,
                source_file: relPath,
                file_type: 'function',
                degree: 0
              });
              edges.push({
                id: `edge_${fileNodeId}_${symNodeId}`,
                from: fileNodeId,
                to: symNodeId,
                relation: 'declares'
              });
            }
          }

          // Python imports
          const pyImportRegex = /(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_.]+))/g;
          while ((match = pyImportRegex.exec(content)) !== null) {
            const mod = match[1] || match[2];
            const modPath = mod.replace(/\./g, '/');
            const targetNodeId = fileToNodeId.get(modPath) || fileToNodeId.get(`${modPath}.py`);
            if (targetNodeId && targetNodeId !== fileNodeId) {
              const edgeId = `edge_py_${fileNodeId}_${targetNodeId}`;
              if (!edges.some(e => e.id === edgeId)) {
                edges.push({
                  id: edgeId,
                  from: fileNodeId,
                  to: targetNodeId,
                  arrows: 'to',
                  relation: 'imports'
                });
              }
            }
          }
        }
      } catch (err) {
        this.logger.error(`[GraphifyService] Failed to parse ${relPath}`, err);
      }
    }

    // Pass 3: Calculate degrees & node sizing
    const degreeCount = new Map<string, number>();
    for (const edge of edges) {
      degreeCount.set(edge.from, (degreeCount.get(edge.from) || 0) + 1);
      degreeCount.set(edge.to, (degreeCount.get(edge.to) || 0) + 1);
    }

    const nodes = Array.from(nodesMap.values()).map(node => {
      const degree = degreeCount.get(node.id) || 0;
      node.degree = degree;
      // Scale node size smoothly based on connectivity
      node.size = Math.min(26, Math.max(9, 9 + Math.sqrt(degree) * 3));
      return node;
    });

    const communities = Array.from(communityMap.values()).sort((a, b) => b.count - a.count);

    this.cachedData = {
      nodes,
      edges,
      communities,
      stats: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        communityCount: communities.length
      }
    };

    this.logger.log(`[GraphifyService] Generated graph: ${nodes.length} nodes, ${edges.length} edges, ${communities.length} communities`);
    return this.cachedData;
  }

  /**
   * Generates comprehensive architecture.md markdown content from AST graph data.
   */
  public async generateArchitectureMarkdown(): Promise<string> {
    const data = await this.generateGraphData(false);
    const now = new Date().toISOString().split('T')[0];

    let md = `# Project Architecture & Codebase Map

> Generated automatically by **Chanakya AI Enhancer Graphify Engine** on ${now}.

---

## 📊 Overview & Metrics

- **Total Files / Symbols Indexed**: ${data.stats.nodeCount}
- **Dependency Connections**: ${data.stats.edgeCount}
- **Functional Communities**: ${data.stats.communityCount}

---

## 🏛️ Module & Community Breakdown

`;

    for (const comm of data.communities) {
      const commNodes = data.nodes.filter((n) => n.community === comm.id);
      md += `### 📁 ${comm.name} (${comm.count} components)\n\n`;

      for (const node of commNodes) {
        md += `- **\`${node.label}\`** (${node.file_type})\n`;
        md += `  - Path: \`${node.source_file}\`\n`;
        if (node.symbols && node.symbols.length > 0) {
          md += `  - Exported Symbols: ${node.symbols.map((s) => `\`${s}\``).join(', ')}\n`;
        }
      }
      md += '\n';
    }

    md += `---

## 🔗 Key Dependency Relationships

| Source Module | Relation | Target Module |
|---|---|---|
`;

    for (const edge of data.edges.slice(0, 50)) {
      const fromNode = data.nodes.find((n) => n.id === edge.from);
      const toNode = data.nodes.find((n) => n.id === edge.to);
      if (fromNode && toNode) {
        md += `| \`${fromNode.label}\` | \`${edge.relation || 'imports'}\` | \`${toNode.label}\` |\n`;
      }
    }

    md += `\n> *Showing first 50 dependency links.*

---

*Chanakya AI Enhancer — Deep Architecture Intelligence*
`;

    return md;
  }

  /**
   * Saves architecture.md to workspace root and opens it in editor.
   */
  public async exportArchitectureToFile(): Promise<string> {
    const wsFolders = vscode.workspace.workspaceFolders;
    if (!wsFolders || wsFolders.length === 0) {
      throw new Error('No open workspace folder to save architecture.md');
    }

    const rootUri = wsFolders[0].uri;
    const archUri = vscode.Uri.joinPath(rootUri, 'architecture.md');
    const content = await this.generateArchitectureMarkdown();

    await vscode.workspace.fs.writeFile(archUri, Buffer.from(content, 'utf-8'));
    const doc = await vscode.workspace.openTextDocument(archUri);
    await vscode.window.showTextDocument(doc);

    return vscode.workspace.asRelativePath(archUri);
  }
}
