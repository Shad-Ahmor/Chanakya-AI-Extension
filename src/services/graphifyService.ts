import * as vscode from 'vscode';
import * as path from 'path';
import { GraphNode, GraphEdge, GraphifyData } from '../types/graphify';
import { Logger } from '../utils/logger';

const COMMUNITY_PALETTE = [
  '#38BDF8', // Sky Blue
  '#818CF8', // Indigo
  '#F472B6', // Pink
  '#34D399', // Emerald
  '#FBBF24', // Amber
  '#A78BFA', // Purple
  '#2DD4BF', // Teal
  '#FB923C', // Orange
  '#4ADE80', // Green
  '#F87171', // Red
  '#C084FC', // Violet
  '#22D3EE'  // Cyan
];

const EXT_COLOR_MAP: Record<string, string> = {
  '.tsx': '#06b6d4', // Cyan
  '.jsx': '#38bdf8', // React Sky
  '.ts': '#3b82f6',  // TS Blue
  '.js': '#f59e0b',  // JS Amber
  '.mjs': '#f59e0b',
  '.cjs': '#f59e0b',
  '.py': '#84cc16',  // Python Lime
  '.css': '#ec4899', // Pink
  '.scss': '#f43f5e',// Rose
  '.sass': '#f43f5e',
  '.less': '#ec4899',
  '.html': '#f97316',// HTML Orange
  '.htm': '#f97316',
  '.json': '#10b981',// Config Emerald
  '.yaml': '#10b981',
  '.yml': '#10b981',
  '.toml': '#10b981',
  '.md': '#a855f7',  // Markdown Purple
  '.markdown': '#a855f7',
  '.rs': '#ef4444',  // Rust Red
  '.go': '#06b6d4',  // Go Cyan
  '.java': '#ea580c',// Java Orange
  '.cpp': '#6366f1', // C++
  '.c': '#6366f1',
  '.h': '#6366f1'
};

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

    const excludePattern = '{**/node_modules/**,**/dist/**,**/.git/**,**/.vscode/**,**/build/**,**/out/**,**/.next/**,**/venv/**,**/__pycache__/**,**/.chanakya/**}';
    const uris = await vscode.workspace.findFiles('**/*', excludePattern, 1200);

    const nodesMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const edgeKeySet = new Set<string>();
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

    const addEdge = (from: string, to: string, relation: string, arrows = 'to') => {
      if (!from || !to || from === to) return;
      const key = `${from}->${to}:${relation}`;
      if (!edgeKeySet.has(key)) {
        edgeKeySet.add(key);
        edges.push({
          id: `edge_${edges.length + 1}`,
          from,
          to,
          arrows,
          relation
        });
      }
    };

    // File path -> node id map (multiple lookup keys for resilient matching)
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

      // Map multiple path keys for resilient resolving
      fileToNodeId.set(relPath, nodeId);
      fileToNodeId.set(relPath.toLowerCase(), nodeId);
      fileToNodeId.set(relPath.replace(/\.[^/.]+$/, ''), nodeId); // without ext
      fileToNodeId.set(relPath.replace(/\.[^/.]+$/, '').toLowerCase(), nodeId);

      let fileType: GraphNode['file_type'] = 'file';
      if (['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.cpp', '.c'].includes(ext)) {
        fileType = 'code';
      } else if (['.md', '.markdown', '.txt'].includes(ext)) {
        fileType = 'markdown';
      } else if (['.json', '.yaml', '.yml', '.toml', '.xml'].includes(ext)) {
        fileType = 'config';
      }

      const nodeColor = EXT_COLOR_MAP[ext] || community.color;

      nodesMap.set(nodeId, {
        id: nodeId,
        label: fileName,
        title: `${relPath} (${fileType})`,
        color: {
          background: nodeColor,
          border: community.color,
          highlight: { background: '#ffffff', border: nodeColor }
        },
        size: 11,
        community: community.id,
        community_name: community.name,
        source_file: relPath,
        file_type: fileType,
        degree: 0,
        symbols: []
      });
    }

    // Helper: resolve relative or aliased import path to target node ID
    const resolveTargetNode = (sourceRelPath: string, importSpec: string): string | undefined => {
      const cleaned = importSpec.trim().replace(/^['"]|['"]$/g, '');
      if (!cleaned) return undefined;

      const sourceDir = path.dirname(sourceRelPath);
      const candidatePaths: string[] = [];

      if (cleaned.startsWith('.')) {
        // Relative import
        const direct = path.normalize(path.join(sourceDir, cleaned)).replace(/\\/g, '/');
        candidatePaths.push(direct);
        candidatePaths.push(`${direct}.ts`);
        candidatePaths.push(`${direct}.tsx`);
        candidatePaths.push(`${direct}.js`);
        candidatePaths.push(`${direct}.jsx`);
        candidatePaths.push(`${direct}.d.ts`);
        candidatePaths.push(`${direct}.css`);
        candidatePaths.push(`${direct}.scss`);
        candidatePaths.push(`${direct}.html`);
        candidatePaths.push(`${direct}.json`);
        candidatePaths.push(`${direct}.py`);
        candidatePaths.push(`${direct}/index.ts`);
        candidatePaths.push(`${direct}/index.tsx`);
        candidatePaths.push(`${direct}/index.js`);
        candidatePaths.push(`${direct}/index.jsx`);
        candidatePaths.push(`${direct}/index.html`);
        candidatePaths.push(`${direct}/index.css`);
      } else if (cleaned.startsWith('@/') || cleaned.startsWith('~/')) {
        // Alias import (e.g. @/components/...)
        const noAlias = cleaned.replace(/^[@~]\//, '');
        const direct = path.normalize(noAlias).replace(/\\/g, '/');
        const inSrc = path.normalize(path.join('src', noAlias)).replace(/\\/g, '/');
        const inWebview = path.normalize(path.join('webview-ui/src', noAlias)).replace(/\\/g, '/');

        for (const base of [direct, inSrc, inWebview]) {
          candidatePaths.push(base);
          candidatePaths.push(`${base}.ts`);
          candidatePaths.push(`${base}.tsx`);
          candidatePaths.push(`${base}.js`);
          candidatePaths.push(`${base}.jsx`);
          candidatePaths.push(`${base}/index.ts`);
          candidatePaths.push(`${base}/index.tsx`);
          candidatePaths.push(`${base}/index.js`);
        }
      } else {
        // Non-relative import check in src/ or webview-ui/src/
        const inSrc = path.normalize(path.join('src', cleaned)).replace(/\\/g, '/');
        const inWebview = path.normalize(path.join('webview-ui/src', cleaned)).replace(/\\/g, '/');
        candidatePaths.push(cleaned);
        candidatePaths.push(inSrc);
        candidatePaths.push(`${inSrc}.ts`);
        candidatePaths.push(`${inSrc}.tsx`);
        candidatePaths.push(inWebview);
        candidatePaths.push(`${inWebview}.tsx`);
        candidatePaths.push(`${inWebview}.ts`);
      }

      for (const p of candidatePaths) {
        const found = fileToNodeId.get(p) || fileToNodeId.get(p.toLowerCase());
        if (found) return found;
      }

      return undefined;
    };

    // Pass 2: Deep parse contents for AST symbols and dependencies
    for (const uri of uris) {
      const relPath = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
      const fileNodeId = fileToNodeId.get(relPath);
      if (!fileNodeId) continue;

      const fileNode = nodesMap.get(fileNodeId);
      const ext = path.extname(relPath).toLowerCase();
      const dir = path.dirname(relPath);
      const topDir = dir === '.' ? 'Root' : (dir.split('/')[0] || dir);
      const community = getCommunity(topDir);

      try {
        const fileBytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(fileBytes).toString('utf-8');

        // 2a. JS / TS / JSX / TSX Parsing
        if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
          // 1. Classes
          const classRegex = /(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_]+)/g;
          let match;
          while ((match = classRegex.exec(content)) !== null) {
            const symName = match[1];
            if (fileNode && fileNode.symbols) fileNode.symbols.push(symName);
            const symNodeId = `sym_${fileNodeId}_${symName}`;
            symbolToNodeId.set(symName, symNodeId);

            if (!nodesMap.has(symNodeId)) {
              nodesMap.set(symNodeId, {
                id: symNodeId,
                label: symName,
                title: `Class ${symName} in ${relPath}`,
                color: {
                  background: '#c084fc',
                  border: community.color,
                  highlight: { background: '#ffffff', border: '#c084fc' }
                },
                size: 13,
                community: community.id,
                community_name: community.name,
                source_file: relPath,
                file_type: 'class',
                degree: 0,
                symbols: []
              });
              addEdge(fileNodeId, symNodeId, 'declares');
            }
          }

          // 2. Interfaces
          const ifaceRegex = /(?:export\s+)?interface\s+([A-Za-z0-9_]+)/g;
          while ((match = ifaceRegex.exec(content)) !== null) {
            const symName = match[1];
            if (fileNode && fileNode.symbols) fileNode.symbols.push(symName);
            const symNodeId = `sym_${fileNodeId}_${symName}`;
            symbolToNodeId.set(symName, symNodeId);

            if (!nodesMap.has(symNodeId)) {
              nodesMap.set(symNodeId, {
                id: symNodeId,
                label: symName,
                title: `Interface ${symName} in ${relPath}`,
                color: {
                  background: '#22d3ee',
                  border: community.color,
                  highlight: { background: '#ffffff', border: '#22d3ee' }
                },
                size: 11,
                community: community.id,
                community_name: community.name,
                source_file: relPath,
                file_type: 'interface',
                degree: 0,
                symbols: []
              });
              addEdge(fileNodeId, symNodeId, 'declares');
            }
          }

          // 3. Top functions & React components
          const fnRegex = /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;
          while ((match = fnRegex.exec(content)) !== null) {
            const symName = match[1];
            if (fileNode && fileNode.symbols) fileNode.symbols.push(symName);
            const symNodeId = `sym_${fileNodeId}_${symName}`;
            symbolToNodeId.set(symName, symNodeId);

            if (!nodesMap.has(symNodeId)) {
              nodesMap.set(symNodeId, {
                id: symNodeId,
                label: `${symName}()`,
                title: `Function ${symName}() in ${relPath}`,
                color: {
                  background: '#fbbf24',
                  border: community.color,
                  highlight: { background: '#ffffff', border: '#fbbf24' }
                },
                size: 10,
                community: community.id,
                community_name: community.name,
                source_file: relPath,
                file_type: 'function',
                degree: 0,
                symbols: []
              });
              addEdge(fileNodeId, symNodeId, 'declares');
            }
          }

          // 4. Imports (ESM import, export from, dynamic import, require)
          const importRegex = /(?:import\s+(?:(?:\{[^}]*\}|[A-Za-z0-9_*$\s,]+)\s+from\s+)?['"]([^'"]+)['"]|export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\))/g;
          while ((match = importRegex.exec(content)) !== null) {
            const spec = match[1] || match[2] || match[3] || match[4];
            if (spec) {
              const targetNodeId = resolveTargetNode(relPath, spec);
              if (targetNodeId && targetNodeId !== fileNodeId) {
                addEdge(fileNodeId, targetNodeId, 'imports');
              }
            }
          }
        }

        // 2b. HTML File Parsing (<script src="...">, <link href="...">)
        else if (['.html', '.htm'].includes(ext)) {
          const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["']/gi;
          let match;
          while ((match = scriptRegex.exec(content)) !== null) {
            const targetNodeId = resolveTargetNode(relPath, match[1]);
            if (targetNodeId && targetNodeId !== fileNodeId) {
              addEdge(fileNodeId, targetNodeId, 'includes_script');
            }
          }

          const linkRegex = /<link\s+[^>]*href=["']([^"']+)["']/gi;
          while ((match = linkRegex.exec(content)) !== null) {
            const targetNodeId = resolveTargetNode(relPath, match[1]);
            if (targetNodeId && targetNodeId !== fileNodeId) {
              addEdge(fileNodeId, targetNodeId, 'links_stylesheet');
            }
          }
        }

        // 2c. CSS / SCSS File Parsing (@import "...")
        else if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
          const cssImportRegex = /@import\s+(?:url\(['"]?([^"')]+)['"]?\)|['"]([^'"]+)['"])/g;
          let match;
          while ((match = cssImportRegex.exec(content)) !== null) {
            const spec = match[1] || match[2];
            if (spec) {
              const targetNodeId = resolveTargetNode(relPath, spec);
              if (targetNodeId && targetNodeId !== fileNodeId) {
                addEdge(fileNodeId, targetNodeId, 'imports_style');
              }
            }
          }
        }

        // 2d. Python Parsing (class, def, imports)
        else if (ext === '.py') {
          const pyClassRegex = /^class\s+([A-Za-z0-9_]+)/gm;
          let match;
          while ((match = pyClassRegex.exec(content)) !== null) {
            const symName = match[1];
            if (fileNode && fileNode.symbols) fileNode.symbols.push(symName);
            const symNodeId = `sym_${fileNodeId}_${symName}`;
            symbolToNodeId.set(symName, symNodeId);

            if (!nodesMap.has(symNodeId)) {
              nodesMap.set(symNodeId, {
                id: symNodeId,
                label: symName,
                title: `Class ${symName} in ${relPath}`,
                color: {
                  background: '#84cc16',
                  border: community.color,
                  highlight: { background: '#ffffff', border: '#84cc16' }
                },
                size: 13,
                community: community.id,
                community_name: community.name,
                source_file: relPath,
                file_type: 'class',
                degree: 0,
                symbols: []
              });
              addEdge(fileNodeId, symNodeId, 'declares');
            }
          }

          const pyDefRegex = /^(?:async\s+)?def\s+([A-Za-z0-9_]+)/gm;
          while ((match = pyDefRegex.exec(content)) !== null) {
            const symName = match[1];
            if (symName.startsWith('__')) continue;
            if (fileNode && fileNode.symbols) fileNode.symbols.push(symName);
            const symNodeId = `sym_${fileNodeId}_${symName}`;
            symbolToNodeId.set(symName, symNodeId);

            if (!nodesMap.has(symNodeId)) {
              nodesMap.set(symNodeId, {
                id: symNodeId,
                label: `${symName}()`,
                title: `def ${symName}() in ${relPath}`,
                color: {
                  background: '#a3e635',
                  border: community.color,
                  highlight: { background: '#ffffff', border: '#a3e635' }
                },
                size: 10,
                community: community.id,
                community_name: community.name,
                source_file: relPath,
                file_type: 'function',
                degree: 0,
                symbols: []
              });
              addEdge(fileNodeId, symNodeId, 'declares');
            }
          }

          const pyImportRegex = /(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_.]+))/g;
          while ((match = pyImportRegex.exec(content)) !== null) {
            const mod = match[1] || match[2];
            if (mod) {
              const targetNodeId = resolveTargetNode(relPath, mod.replace(/\./g, '/'));
              if (targetNodeId && targetNodeId !== fileNodeId) {
                addEdge(fileNodeId, targetNodeId, 'imports');
              }
            }
          }
        }

        // 2e. Markdown Links ([label](./path))
        else if (['.md', '.markdown'].includes(ext)) {
          const mdLinkRegex = /\[[^\]]+\]\(((?:\.\/|\.\.\/|[A-Za-z0-9_-]+\/)[^)#\s]+)\)/g;
          let match;
          while ((match = mdLinkRegex.exec(content)) !== null) {
            const targetNodeId = resolveTargetNode(relPath, match[1]);
            if (targetNodeId && targetNodeId !== fileNodeId) {
              addEdge(fileNodeId, targetNodeId, 'references');
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
      node.size = Math.min(28, Math.max(10, 10 + Math.sqrt(degree) * 3));
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
