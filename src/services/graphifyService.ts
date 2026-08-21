import * as vscode from 'vscode';
import * as path from 'path';
import { GraphNode, GraphEdge, GraphifyData, BlastRadiusResult, AffectedNode, DuplicateEntity, GitImpactResult } from '../types/graphify';
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
  // Web & JavaScript / TypeScript
  '.tsx': '#06b6d4', // React TSX (Cyan)
  '.jsx': '#38bdf8', // React JSX (Sky)
  '.ts': '#3b82f6',  // TypeScript (Blue)
  '.js': '#f59e0b',  // JavaScript (Amber)
  '.mjs': '#f59e0b',
  '.cjs': '#f59e0b',
  '.vue': '#41b883', // Vue (Vue Green)
  '.svelte': '#ff3e00', // Svelte (Orange-Red)
  
  // Python & Data
  '.py': '#84cc16',  // Python (Lime)
  '.pyw': '#84cc16',
  '.ipynb': '#eab308', // Jupyter (Yellow)
  
  // Java, Kotlin & Android
  '.java': '#ea580c',// Java (Orange)
  '.kt': '#a855f7',  // Kotlin (Purple)
  '.kts': '#a855f7',
  '.gradle': '#0284c7', // Gradle (Blue)
  
  // C#, .NET & Microsoft
  '.cs': '#16a34a',  // C# (Green)
  '.csx': '#16a34a',
  '.vb': '#0284c7',  // VB.NET (Blue)
  '.csproj': '#16a34a',
  '.sln': '#16a34a',
  
  // PHP & WordPress / Laravel
  '.php': '#8b5cf6', // PHP (Violet)
  '.phtml': '#8b5cf6',
  
  // Ruby & Rails
  '.rb': '#e11d48',  // Ruby (Rose)
  '.erb': '#e11d48',
  '.rake': '#e11d48',
  
  // C / C++
  '.cpp': '#6366f1', // C++ (Indigo)
  '.cc': '#6366f1',
  '.cxx': '#6366f1',
  '.c': '#64748b',   // C (Slate)
  '.h': '#6366f1',   // Header
  '.hpp': '#6366f1',
  '.hxx': '#6366f1',
  
  // Systems & Other Languages
  '.go': '#06b6d4',  // Go (Cyan)
  '.rs': '#ef4444',  // Rust (Red)
  '.dart': '#0284c7',// Dart/Flutter (Sky)
  '.swift': '#f97316',// Swift (Orange)
  '.sql': '#0ea5e9', // SQL
  '.prisma': '#0f172a',
  
  // Web Markup & Styles
  '.html': '#f97316',// HTML (Orange)
  '.htm': '#f97316',
  '.css': '#ec4899', // CSS (Pink)
  '.scss': '#f43f5e',// SCSS (Rose)
  '.sass': '#f43f5e',
  '.less': '#ec4899',
  
  // Config & Documentation
  '.json': '#10b981',// Config (Emerald)
  '.yaml': '#10b981',
  '.yml': '#10b981',
  '.toml': '#10b981',
  '.xml': '#14b8a6',
  '.md': '#a855f7',  // Markdown (Purple)
  '.markdown': '#a855f7'
};

interface BackendRoute {
  fileNodeId: string;
  sourceRelPath: string;
  method: string;
  rawRoute: string;
  normalizedRoute: string;
}

interface FrontendApiCall {
  fileNodeId: string;
  sourceRelPath: string;
  method: string;
  rawEndpoint: string;
  normalizedRoute: string;
  port?: string | undefined;
}

interface ServerListeningPort {
  fileNodeId: string;
  sourceRelPath: string;
  port: string;
}

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
   * Universal workspace indexer: analyzes dependencies, AST, routes, and architecture across all programming languages.
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

    this.logger.log(`[GraphifyService] Scanning universal workspace for graph: ${rootPath}`);

    const excludePattern = '{**/node_modules/**,**/dist/**,**/.git/**,**/.vscode/**,**/build/**,**/out/**,**/.next/**,**/venv/**,**/__pycache__/**,**/.chanakya/**,**/bin/**,**/obj/**,**/target/**,**/.gradle/**}';
    const uris = await vscode.workspace.findFiles('**/*', excludePattern, 2500);

    const nodesMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const edgeKeySet = new Set<string>();
    const communityMap = new Map<string, { id: number; name: string; color: string; count: number }>();
    let nextCommunityId = 1;

    // Cross-boundary registries
    const backendRoutes: BackendRoute[] = [];
    const frontendApiCalls: FrontendApiCall[] = [];
    const serverListeningPorts: ServerListeningPort[] = [];
    const backendServerEntrypoints = new Set<string>();

    const getCommunity = (dirPath: string) => {
      const p = dirPath.toLowerCase().replace(/\\/g, '/');
      let name = dirPath === '.' || dirPath === '' ? 'Core Root' : dirPath;

      // Smart semantic classification
      if (p.includes('route') || p.includes('controller') || p.includes('api') || p.includes('endpoint')) {
        name = 'API & Routes';
      } else if (p.includes('component') || p.includes('view') || p.includes('ui') || p.includes('page')) {
        name = 'Frontend UI & Views';
      } else if (p.includes('service') || p.includes('provider') || p.includes('manager')) {
        name = 'Services & Providers';
      } else if (p.includes('model') || p.includes('schema') || p.includes('entity') || p.includes('type') || p.includes('dto')) {
        name = 'Data Models & Types';
      } else if (p.includes('util') || p.includes('helper') || p.includes('lib') || p.includes('common')) {
        name = 'Utilities & Common';
      } else if (p.includes('test') || p.includes('spec') || p.includes('mock')) {
        name = 'Test Suite';
      } else if (p.includes('config') || p.includes('setting') || p.includes('env')) {
        name = 'Configuration & Environment';
      }

      if (!communityMap.has(name)) {
        const color = COMMUNITY_PALETTE[(nextCommunityId - 1) % COMMUNITY_PALETTE.length];
        communityMap.set(name, {
          id: nextCommunityId++,
          name,
          color,
          count: 0
        });
      }
      const comm = communityMap.get(name)!;
      comm.count++;
      return comm;
    };

    const addEdge = (
      from: string,
      to: string,
      relation: string,
      type: GraphEdge['type'] = 'import',
      label?: string,
      title?: string,
      dashes?: boolean | number[],
      arrows = 'to'
    ) => {
      if (!from || !to || from === to) return;
      const key = `${from}->${to}:${relation}:${label || ''}`;
      if (!edgeKeySet.has(key)) {
        edgeKeySet.add(key);
        edges.push({
          id: `edge_${edges.length + 1}`,
          from,
          to,
          type,
          relation,
          label,
          title: title || (label ? `🌐 ${label}` : undefined),
          dashes,
          arrows,
          color: type === 'api-network' ? {
            color: '#f43f5e',
            highlight: '#fb7185',
            hover: '#38bdf8',
            opacity: 0.95
          } : undefined,
          width: type === 'api-network' ? 2.2 : 1.2
        });
      }
    };

    // File path -> node id map (multiple lookup keys for resilient matching)
    const fileToNodeId = new Map<string, string>();
    const fileNameOnlyToNodeId = new Map<string, string>();
    const symbolToNodeId = new Map<string, string>();

    // Pass 1: Create File & Module Nodes
    for (const uri of uris) {
      const relPath = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
      const dir = path.dirname(relPath);
      const fileName = path.basename(relPath);
      const baseNameWithoutExt = path.basename(relPath, path.extname(relPath));
      const ext = path.extname(relPath).toLowerCase();

      // Top level folder or architectural layer
      const community = getCommunity(dir);

      const nodeId = `file_${relPath.replace(/[^a-zA-Z0-9_]/g, '_')}`;

      // Register multiple path keys for resilient resolving
      fileToNodeId.set(relPath, nodeId);
      fileToNodeId.set(relPath.toLowerCase(), nodeId);
      fileToNodeId.set(relPath.replace(/\.[^/.]+$/, ''), nodeId); // without ext
      fileToNodeId.set(relPath.replace(/\.[^/.]+$/, '').toLowerCase(), nodeId);
      fileNameOnlyToNodeId.set(fileName.toLowerCase(), nodeId);
      fileNameOnlyToNodeId.set(baseNameWithoutExt.toLowerCase(), nodeId);

      let fileType: GraphNode['file_type'] = 'file';
      if (['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.kt', '.cs', '.vb', '.php', '.rb', '.cpp', '.c', '.h', '.hpp', '.dart', '.swift'].includes(ext)) {
        fileType = 'code';
      } else if (['.md', '.markdown', '.txt'].includes(ext)) {
        fileType = 'markdown';
      } else if (['.json', '.yaml', '.yml', '.toml', '.xml', '.gradle', '.csproj', '.config'].includes(ext)) {
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

    // Helper: normalize route path
    const normalizeRoute = (raw: string): string => {
      let r = raw.trim().replace(/^https?:\/\/[^/]+/i, '');
      r = r.split('?')[0];
      r = r.replace(/\$\{[^}]+\}/g, '*');
      r = r.replace(/:[a-zA-Z0-9_]+/g, '*');
      r = r.replace(/\/+$/, '');
      if (!r.startsWith('/')) r = '/' + r;
      return r.toLowerCase();
    };

    // Helper: resolve relative, aliased, or package import path to target node ID
    const resolveTargetNode = (sourceRelPath: string, importSpec: string): string | undefined => {
      const cleaned = importSpec.trim().replace(/^['"]|['"]$/g, '');
      if (!cleaned) return undefined;

      const sourceDir = path.dirname(sourceRelPath);
      const candidatePaths: string[] = [];

      if (cleaned.startsWith('.')) {
        // Relative import
        const direct = path.normalize(path.join(sourceDir, cleaned)).replace(/\\/g, '/');
        candidatePaths.push(direct);
        const exts = ['.ts', '.tsx', '.js', '.jsx', '.d.ts', '.css', '.scss', '.html', '.json', '.py', '.java', '.kt', '.cs', '.php', '.rb', '.cpp', '.c', '.h', '.vue', '.svelte'];
        for (const e of exts) candidatePaths.push(`${direct}${e}`);
        for (const e of ['.ts', '.tsx', '.js', '.jsx', '.java', '.php', '.py']) candidatePaths.push(`${direct}/index${e}`);
      } else if (cleaned.startsWith('@/') || cleaned.startsWith('~/')) {
        // Alias import
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
        }
      } else {
        // Monorepo cross-directory / package resolution
        const inSrc = path.normalize(path.join('src', cleaned)).replace(/\\/g, '/');
        const inWebview = path.normalize(path.join('webview-ui/src', cleaned)).replace(/\\/g, '/');
        const inBackend = path.normalize(path.join('backend', cleaned)).replace(/\\/g, '/');
        const inServer = path.normalize(path.join('server', cleaned)).replace(/\\/g, '/');
        const inApp = path.normalize(path.join('app', cleaned)).replace(/\\/g, '/');

        candidatePaths.push(cleaned);
        candidatePaths.push(inSrc);
        candidatePaths.push(`${inSrc}.ts`);
        candidatePaths.push(`${inSrc}.tsx`);
        candidatePaths.push(inWebview);
        candidatePaths.push(inBackend);
        candidatePaths.push(`${inBackend}.js`);
        candidatePaths.push(`${inBackend}.ts`);
        candidatePaths.push(inServer);
        candidatePaths.push(inApp);

        // Name fallback (e.g. Java "import com.example.UserService" -> "UserService.java")
        const baseName = path.basename(cleaned.replace(/\./g, '/'));
        if (fileNameOnlyToNodeId.has(baseName.toLowerCase())) {
          return fileNameOnlyToNodeId.get(baseName.toLowerCase());
        }
      }

      for (const p of candidatePaths) {
        const found = fileToNodeId.get(p) || fileToNodeId.get(p.toLowerCase());
        if (found) return found;
      }

      return undefined;
    };

    // Pass 2: Deep parse contents for AST symbols, imports, and cross-boundary routes across ALL languages
    for (const uri of uris) {
      const relPath = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
      const fileNodeId = fileToNodeId.get(relPath);
      if (!fileNodeId) continue;

      const fileNode = nodesMap.get(fileNodeId);
      const ext = path.extname(relPath).toLowerCase();
      const dir = path.dirname(relPath);
      const fileName = path.basename(relPath).toLowerCase();
      const topDir = dir === '.' ? 'Root' : (dir.split('/')[0] || dir);
      const community = getCommunity(topDir);

      // Identify backend / server entrypoints across all stacks
      if (
        fileName.includes('server') ||
        fileName.includes('app') ||
        fileName.includes('main') ||
        fileName.includes('index') ||
        fileName.includes('program') ||
        fileName.includes('startup') ||
        fileName.includes('application') ||
        fileName.includes('settings') ||
        dir.includes('backend') ||
        dir.includes('server') ||
        dir.includes('api') ||
        dir.includes('controllers')
      ) {
        if (['.js', '.ts', '.py', '.go', '.rs', '.java', '.kt', '.cs', '.php', '.rb'].includes(ext)) {
          backendServerEntrypoints.add(fileNodeId);
        }
      }

      try {
        const fileBytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(fileBytes).toString('utf-8');

        // ==========================================
        // 1. JavaScript / TypeScript / React / Node / Nest / Angular / Vue / Svelte
        // ==========================================
        if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'].includes(ext)) {
          // Classes
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
              addEdge(fileNodeId, symNodeId, 'declares', 'declares');
            }
          }

          // Interfaces & Types
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
              addEdge(fileNodeId, symNodeId, 'declares', 'declares');
            }
          }

          // Functions & Components
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
              addEdge(fileNodeId, symNodeId, 'declares', 'declares');
            }
          }

          // Static Imports & Requires
          const importRegex = /(?:import\s+(?:(?:\{[^}]*\}|[A-Za-z0-9_*$\s,]+)\s+from\s+)?['"]([^'"]+)['"]|export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\))/g;
          while ((match = importRegex.exec(content)) !== null) {
            const spec = match[1] || match[2] || match[3] || match[4];
            if (spec) {
              const targetNodeId = resolveTargetNode(relPath, spec);
              if (targetNodeId && targetNodeId !== fileNodeId) {
                addEdge(fileNodeId, targetNodeId, 'imports', 'import');
              }
            }
          }

          // NestJS / Express / Fastify / Koa Route Handlers
          const expressRouteRegex = /(?:app|router|server|fastify|hono)\.(get|post|put|delete|patch|all|use)\s*\(\s*['"`]([^'"`]+)['"`]|@(Get|Post|Put|Delete|Patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
          while ((match = expressRouteRegex.exec(content)) !== null) {
            const method = (match[1] || match[3] || 'GET').toUpperCase();
            const rawRoute = match[2] || match[4];
            if (rawRoute) {
              backendRoutes.push({
                fileNodeId,
                sourceRelPath: relPath,
                method,
                rawRoute,
                normalizedRoute: normalizeRoute(rawRoute)
              });
              backendServerEntrypoints.add(fileNodeId);
            }
          }

          // Angular @Component templateUrl and styleUrls
          const angularTemplateRegex = /templateUrl\s*:\s*['"`]([^'"`]+)['"`]/g;
          while ((match = angularTemplateRegex.exec(content)) !== null) {
            const targetNodeId = resolveTargetNode(relPath, match[1]);
            if (targetNodeId) addEdge(fileNodeId, targetNodeId, 'template', 'import');
          }
          const angularStyleRegex = /styleUrls\s*:\s*\[([^\]]+)\]/g;
          while ((match = angularStyleRegex.exec(content)) !== null) {
            const styleList = match[1];
            const strRegex = /['"`]([^'"`]+)['"`]/g;
            let sMatch;
            while ((sMatch = strRegex.exec(styleList)) !== null) {
              const targetNodeId = resolveTargetNode(relPath, sMatch[1]);
              if (targetNodeId) addEdge(fileNodeId, targetNodeId, 'styles', 'style');
            }
          }

          // Server Listening Ports
          const listenPortRegex = /\.(?:listen|run|serve)\s*\(\s*(\d{2,5})/g;
          while ((match = listenPortRegex.exec(content)) !== null) {
            serverListeningPorts.push({
              fileNodeId,
              sourceRelPath: relPath,
              port: match[1]
            });
            backendServerEntrypoints.add(fileNodeId);
          }

          // Frontend Network API Calls (fetch, axios, custom API client)
          const fetchRegex = /fetch\s*\(\s*(?:['"`]([^'"`]+)['"`]|(?:API_URL|BASE_URL|API|VITE_API_URL|process\.env\.[A-Z0-9_]+)\s*\+\s*['"`]([^'"`]+)['"`])/g;
          while ((match = fetchRegex.exec(content)) !== null) {
            const rawEndpoint = match[1] || match[2];
            if (rawEndpoint) {
              const portMatch = rawEndpoint.match(/localhost:(\d+)|127\.0\.0\.1:(\d+)/);
              frontendApiCalls.push({
                fileNodeId,
                sourceRelPath: relPath,
                method: 'FETCH',
                rawEndpoint,
                normalizedRoute: normalizeRoute(rawEndpoint),
                port: portMatch ? (portMatch[1] || portMatch[2]) : undefined
              });
            }
          }

          const axiosRegex = /(?:axios|apiClient|client|api|instance|http)\.(get|post|put|delete|patch)\s*(?:<[^>]+>)?\s*\(\s*['"`]([^'"`]+)['"`]/g;
          while ((match = axiosRegex.exec(content)) !== null) {
            const method = match[1].toUpperCase();
            const rawEndpoint = match[2];
            const portMatch = rawEndpoint.match(/localhost:(\d+)|127\.0\.0\.1:(\d+)/);
            frontendApiCalls.push({
              fileNodeId,
              sourceRelPath: relPath,
              method,
              rawEndpoint,
              normalizedRoute: normalizeRoute(rawEndpoint),
              port: portMatch ? (portMatch[1] || portMatch[2]) : undefined
            });
          }
        }

        // ==========================================
        // 2. Python (Django, Flask, FastAPI)
        // ==========================================
        else if (ext === '.py') {
          // Classes & Models
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
              addEdge(fileNodeId, symNodeId, 'declares', 'declares');
            }
          }

          // Defs
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
              addEdge(fileNodeId, symNodeId, 'declares', 'declares');
            }
          }

          // FastAPI / Flask Route Decorators
          const pyRouteRegex = /@(?:app|router|api|blueprint|bp)\.(get|post|put|delete|patch|route)\s*\(\s*['"`]([^'"`]+)['"`]/g;
          while ((match = pyRouteRegex.exec(content)) !== null) {
            const method = (match[1] || 'GET').toUpperCase();
            const rawRoute = match[2];
            backendRoutes.push({
              fileNodeId,
              sourceRelPath: relPath,
              method,
              rawRoute,
              normalizedRoute: normalizeRoute(rawRoute)
            });
            backendServerEntrypoints.add(fileNodeId);
          }

          // Django urls.py path('api/prime', views.prime_view)
          const djangoPathRegex = /path\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([A-Za-z0-9_.]+)/g;
          while ((match = djangoPathRegex.exec(content)) !== null) {
            const rawRoute = match[1];
            const targetView = match[2];
            backendRoutes.push({
              fileNodeId,
              sourceRelPath: relPath,
              method: 'GET',
              rawRoute: '/' + rawRoute.replace(/^\/+/, ''),
              normalizedRoute: normalizeRoute(rawRoute)
            });
            backendServerEntrypoints.add(fileNodeId);

            // Connect urls.py to views.py
            const viewTargetId = resolveTargetNode(relPath, targetView.split('.')[0]);
            if (viewTargetId) addEdge(fileNodeId, viewTargetId, 'routes_to', 'import');
          }

          // Python Server Listening Ports
          const pyPortRegex = /(?:uvicorn\.run\([^)]*port\s*=\s*(\d{2,5})|app\.run\([^)]*port\s*=\s*(\d{2,5}))/g;
          while ((match = pyPortRegex.exec(content)) !== null) {
            const p = match[1] || match[2];
            if (p) {
              serverListeningPorts.push({
                fileNodeId,
                sourceRelPath: relPath,
                port: p
              });
              backendServerEntrypoints.add(fileNodeId);
            }
          }

          // Python Imports
          const pyImportRegex = /(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_.]+))/g;
          while ((match = pyImportRegex.exec(content)) !== null) {
            const mod = match[1] || match[2];
            if (mod) {
              const targetNodeId = resolveTargetNode(relPath, mod.replace(/\./g, '/'));
              if (targetNodeId && targetNodeId !== fileNodeId) {
                addEdge(fileNodeId, targetNodeId, 'imports', 'import');
              }
            }
          }
        }

        // ==========================================
        // 3. Java & Kotlin (Spring Boot & Android)
        // ==========================================
        else if (['.java', '.kt'].includes(ext)) {
          // Class & Interface
          const javaClassRegex = /(?:public\s+|protected\s+|private\s+)?(?:abstract\s+|final\s+)?(?:class|interface|enum)\s+([A-Za-z0-9_]+)/g;
          let match;
          while ((match = javaClassRegex.exec(content)) !== null) {
            const symName = match[1];
            if (fileNode && fileNode.symbols) fileNode.symbols.push(symName);
          }

          // Java Imports (import com.example.service.UserService)
          const javaImportRegex = /import\s+([A-Za-z0-9_.]+);/g;
          while ((match = javaImportRegex.exec(content)) !== null) {
            const fullPackage = match[1];
            const className = fullPackage.split('.').pop();
            if (className && fileNameOnlyToNodeId.has(className.toLowerCase())) {
              const targetId = fileNameOnlyToNodeId.get(className.toLowerCase());
              if (targetId && targetId !== fileNodeId) {
                addEdge(fileNodeId, targetId, 'imports', 'import');
              }
            }
          }

          // Spring Boot Route Annotations (@GetMapping("/api/prime"), @RequestMapping)
          const springRouteRegex = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(\s*(?:value\s*=\s*)?['"`]([^'"`]+)['"`]/g;
          while ((match = springRouteRegex.exec(content)) !== null) {
            const method = match[1].replace('Mapping', '').toUpperCase();
            const rawRoute = match[2];
            backendRoutes.push({
              fileNodeId,
              sourceRelPath: relPath,
              method: method === 'REQUEST' ? 'ALL' : method,
              rawRoute,
              normalizedRoute: normalizeRoute(rawRoute)
            });
            backendServerEntrypoints.add(fileNodeId);
          }
        }

        // ==========================================
        // 4. C# / .NET / ASP.NET / VB.NET
        // ==========================================
        else if (['.cs', '.vb'].includes(ext)) {
          // Class & Interface
          const csClassRegex = /(?:public\s+|internal\s+)?(?:abstract\s+|sealed\s+|static\s+)?(?:class|interface|struct|enum)\s+([A-Za-z0-9_]+)/g;
          let match;
          while ((match = csClassRegex.exec(content)) !== null) {
            const symName = match[1];
            if (fileNode && fileNode.symbols) fileNode.symbols.push(symName);
          }

          // Using Statements (using MyProject.Services;)
          const usingRegex = /(?:using|Imports)\s+([A-Za-z0-9_.]+);?/g;
          while ((match = usingRegex.exec(content)) !== null) {
            const ns = match[1];
            const lastPart = ns.split('.').pop();
            if (lastPart && fileNameOnlyToNodeId.has(lastPart.toLowerCase())) {
              const targetId = fileNameOnlyToNodeId.get(lastPart.toLowerCase());
              if (targetId && targetId !== fileNodeId) {
                addEdge(fileNodeId, targetId, 'uses_namespace', 'import');
              }
            }
          }

          // ASP.NET Controller Attributes ([HttpGet("api/prime")], [Route("api/[controller]")])
          const aspRouteRegex = /\[(HttpGet|HttpPost|HttpPut|HttpDelete|Route)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\]/g;
          while ((match = aspRouteRegex.exec(content)) !== null) {
            const method = match[1].replace('Http', '').toUpperCase();
            const rawRoute = match[2];
            backendRoutes.push({
              fileNodeId,
              sourceRelPath: relPath,
              method: method === 'ROUTE' ? 'ALL' : method,
              rawRoute,
              normalizedRoute: normalizeRoute(rawRoute)
            });
            backendServerEntrypoints.add(fileNodeId);
          }
        }

        // ==========================================
        // 5. PHP / WordPress / Laravel
        // ==========================================
        else if (['.php', '.phtml'].includes(ext)) {
          // Class & Interface
          const phpClassRegex = /(?:class|interface|trait)\s+([A-Za-z0-9_]+)/g;
          let match;
          while ((match = phpClassRegex.exec(content)) !== null) {
            const symName = match[1];
            if (fileNode && fileNode.symbols) fileNode.symbols.push(symName);
          }

          // Use statements & requires
          const phpUseRegex = /(?:use\s+([A-Za-z0-9_\\]+);|require(?:_once)?\s*\(?['"`]([^'"`]+)['"`]\)?|include(?:_once)?\s*\(?['"`]([^'"`]+)['"`]\)?)/g;
          while ((match = phpUseRegex.exec(content)) !== null) {
            const spec = match[1] || match[2] || match[3];
            if (spec) {
              const targetId = resolveTargetNode(relPath, spec.replace(/\\/g, '/'));
              if (targetId && targetId !== fileNodeId) {
                addEdge(fileNodeId, targetId, 'imports', 'import');
              }
            }
          }

          // Laravel Routes (Route::get('/api/prime', ...))
          const laravelRouteRegex = /Route::(get|post|put|delete|patch|any)\s*\(\s*['"`]([^'"`]+)['"`]/g;
          while ((match = laravelRouteRegex.exec(content)) !== null) {
            const method = match[1].toUpperCase();
            const rawRoute = match[2];
            backendRoutes.push({
              fileNodeId,
              sourceRelPath: relPath,
              method,
              rawRoute,
              normalizedRoute: normalizeRoute(rawRoute)
            });
            backendServerEntrypoints.add(fileNodeId);
          }

          // WordPress template part (get_template_part('template-parts/content', 'page'))
          const wpTemplateRegex = /get_template_part\s*\(\s*['"`]([^'"`]+)['"`]/g;
          while ((match = wpTemplateRegex.exec(content)) !== null) {
            const targetId = resolveTargetNode(relPath, `${match[1]}.php`);
            if (targetId) addEdge(fileNodeId, targetId, 'template_part', 'import');
          }
        }

        // ==========================================
        // 6. Ruby & Rails
        // ==========================================
        else if (['.rb', '.rake'].includes(ext)) {
          const rbRequireRegex = /require(?:_relative)?\s+['"`]([^'"`]+)['"`]/g;
          let match;
          while ((match = rbRequireRegex.exec(content)) !== null) {
            const targetId = resolveTargetNode(relPath, `${match[1]}.rb`);
            if (targetId && targetId !== fileNodeId) {
              addEdge(fileNodeId, targetId, 'requires', 'import');
            }
          }

          // Rails routes
          const railsRouteRegex = /(get|post|put|delete|patch)\s+['"`]([^'"`]+)['"`]/g;
          while ((match = railsRouteRegex.exec(content)) !== null) {
            const method = match[1].toUpperCase();
            const rawRoute = match[2];
            backendRoutes.push({
              fileNodeId,
              sourceRelPath: relPath,
              method,
              rawRoute,
              normalizedRoute: normalizeRoute(rawRoute)
            });
            backendServerEntrypoints.add(fileNodeId);
          }
        }

        // ==========================================
        // 7. C / C++ Header & Source Inclusion
        // ==========================================
        else if (['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx'].includes(ext)) {
          const cppIncludeRegex = /#include\s+["<]([^">]+)[">]/g;
          let match;
          while ((match = cppIncludeRegex.exec(content)) !== null) {
            const headerName = match[1];
            const targetId = resolveTargetNode(relPath, headerName) || fileNameOnlyToNodeId.get(headerName.toLowerCase());
            if (targetId && targetId !== fileNodeId) {
              addEdge(fileNodeId, targetId, 'includes', 'import');
            }
          }
        }

        // ==========================================
        // 8. Go & Rust
        // ==========================================
        else if (ext === '.go') {
          const goImportRegex = /"([^"]+)"/g;
          let match;
          while ((match = goImportRegex.exec(content)) !== null) {
            const pkg = match[1];
            const basePkg = path.basename(pkg);
            if (fileNameOnlyToNodeId.has(`${basePkg}.go`)) {
              const targetId = fileNameOnlyToNodeId.get(`${basePkg}.go`);
              if (targetId && targetId !== fileNodeId) {
                addEdge(fileNodeId, targetId, 'imports', 'import');
              }
            }
          }

          // Gin / Fiber routes
          const goRouteRegex = /\.(GET|POST|PUT|DELETE|PATCH|Handle)\s*\(\s*['"`]([^'"`]+)['"`]/g;
          while ((match = goRouteRegex.exec(content)) !== null) {
            backendRoutes.push({
              fileNodeId,
              sourceRelPath: relPath,
              method: match[1],
              rawRoute: match[2],
              normalizedRoute: normalizeRoute(match[2])
            });
            backendServerEntrypoints.add(fileNodeId);
          }
        } else if (ext === '.rs') {
          const rustModRegex = /(?:mod\s+([A-Za-z0-9_]+);|use\s+(?:crate::)?([A-Za-z0-9_]+))/g;
          let match;
          while ((match = rustModRegex.exec(content)) !== null) {
            const modName = match[1] || match[2];
            if (modName && fileNameOnlyToNodeId.has(`${modName}.rs`)) {
              const targetId = fileNameOnlyToNodeId.get(`${modName}.rs`);
              if (targetId && targetId !== fileNodeId) {
                addEdge(fileNodeId, targetId, 'uses_mod', 'import');
              }
            }
          }
        }

        // ==========================================
        // 9. HTML (<script src="...">, <link href="...">)
        // ==========================================
        else if (['.html', '.htm'].includes(ext)) {
          const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["']/gi;
          let match;
          while ((match = scriptRegex.exec(content)) !== null) {
            const targetNodeId = resolveTargetNode(relPath, match[1]);
            if (targetNodeId && targetNodeId !== fileNodeId) {
              addEdge(fileNodeId, targetNodeId, 'includes_script', 'import');
            }
          }

          const linkRegex = /<link\s+[^>]*href=["']([^"']+)["']/gi;
          while ((match = linkRegex.exec(content)) !== null) {
            const targetNodeId = resolveTargetNode(relPath, match[1]);
            if (targetNodeId && targetNodeId !== fileNodeId) {
              addEdge(fileNodeId, targetNodeId, 'links_stylesheet', 'style');
            }
          }
        }

        // ==========================================
        // 10. CSS / SCSS / LESS (@import "...")
        // ==========================================
        else if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
          const cssImportRegex = /@import\s+(?:url\(['"]?([^"')]+)['"]?\)|['"]([^'"]+)['"])/g;
          let match;
          while ((match = cssImportRegex.exec(content)) !== null) {
            const spec = match[1] || match[2];
            if (spec) {
              const targetNodeId = resolveTargetNode(relPath, spec);
              if (targetNodeId && targetNodeId !== fileNodeId) {
                addEdge(fileNodeId, targetNodeId, 'imports_style', 'style');
              }
            }
          }
        }

        // ==========================================
        // 11. Markdown Links ([label](./path))
        // ==========================================
        else if (['.md', '.markdown'].includes(ext)) {
          const mdLinkRegex = /\[[^\]]+\]\(((?:\.\/|\.\.\/|[A-Za-z0-9_-]+\/)[^)#\s]+)\)/g;
          let match;
          while ((match = mdLinkRegex.exec(content)) !== null) {
            const targetNodeId = resolveTargetNode(relPath, match[1]);
            if (targetNodeId && targetNodeId !== fileNodeId) {
              addEdge(fileNodeId, targetNodeId, 'references', 'references');
            }
          }
        }
      } catch (err) {
        this.logger.error(`[GraphifyService] Failed to parse ${relPath}`, err);
      }
    }

    // Pass 3: Cross-Boundary API Edge Matching (The Bridge)
    this.logger.log(`[GraphifyService] Bridging cross-boundary APIs: ${frontendApiCalls.length} frontend calls, ${backendRoutes.length} backend routes across all stacks`);

    for (const call of frontendApiCalls) {
      let matched = false;

      // 1. Exact or Prefix Route Matching
      for (const route of backendRoutes) {
        if (call.fileNodeId === route.fileNodeId) continue;

        const isExactMatch = call.normalizedRoute === route.normalizedRoute;
        const isPrefixMatch =
          call.normalizedRoute.startsWith(route.normalizedRoute) &&
          route.normalizedRoute !== '/' &&
          route.normalizedRoute.length > 2;

        if (isExactMatch || isPrefixMatch) {
          const label = `${call.method} ${call.rawEndpoint.split('?')[0]}`;
          const title = `🌐 Cross-Boundary API: ${call.method} ${call.rawEndpoint} ➔ ${route.sourceRelPath}`;
          addEdge(call.fileNodeId, route.fileNodeId, 'api-network', 'api-network', label, title, [6, 4]);
          matched = true;
        }
      }

      // 2. Port Matching (e.g. Frontend calls port 5000 -> backend file listens on 5000)
      if (!matched && call.port) {
        for (const lp of serverListeningPorts) {
          if (call.fileNodeId === lp.fileNodeId) continue;
          if (call.port === lp.port) {
            const label = `API (port ${call.port})`;
            const title = `🌐 Port Connection: ${call.sourceRelPath} ➔ ${lp.sourceRelPath} (Port ${call.port})`;
            addEdge(call.fileNodeId, lp.fileNodeId, 'api-network', 'api-network', label, title, [6, 4]);
            matched = true;
          }
        }
      }

      // 3. Fallback: If frontend calls '/api/...' and backend server entrypoints exist, connect to primary server entrypoint
      if (!matched && call.normalizedRoute.startsWith('/api') && backendServerEntrypoints.size > 0) {
        for (const srvNodeId of backendServerEntrypoints) {
          if (call.fileNodeId === srvNodeId) continue;
          const srvNode = nodesMap.get(srvNodeId);
          const label = `${call.method} ${call.normalizedRoute}`;
          const title = `🌐 API Endpoint Call: ${call.method} ${call.rawEndpoint} ➔ ${srvNode?.source_file || 'Server'}`;
          addEdge(call.fileNodeId, srvNodeId, 'api-network', 'api-network', label, title, [6, 4]);
          matched = true;
          break;
        }
      }
    }

    // Pass 4: Calculate degrees & node sizing
    const degreeCount = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const edge of edges) {
      degreeCount.set(edge.from, (degreeCount.get(edge.from) || 0) + 1);
      degreeCount.set(edge.to, (degreeCount.get(edge.to) || 0) + 1);

      if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
      adjacency.get(edge.from)!.push(edge.to);
    }

    const nodes = Array.from(nodesMap.values()).map(node => {
      const degree = degreeCount.get(node.id) || 0;
      node.degree = degree;
      // Scale node size smoothly based on connectivity
      node.size = Math.min(28, Math.max(10, 10 + Math.sqrt(degree) * 3));
      return node;
    });

    const communities = Array.from(communityMap.values()).sort((a, b) => b.count - a.count);

    // Pass 5: Advanced Graphify Intelligence & Analytics (God Nodes, Surprising Links, Cycles, Questions)
    const godNodes = nodes
      .filter(n => n.file_type === 'code' || n.file_type === 'class')
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 8)
      .map(n => ({
        id: n.id,
        label: n.label,
        source_file: n.source_file,
        degree: n.degree,
        file_type: n.file_type
      }));

    // Surprising connections (Cross-community or API network bridges)
    const surprisingConnections = edges
      .filter(e => {
        if (e.type === 'api-network') return true;
        const fromNode = nodesMap.get(e.from);
        const toNode = nodesMap.get(e.to);
        return fromNode && toNode && fromNode.community !== toNode.community;
      })
      .slice(0, 10)
      .map(e => {
        const fromNode = nodesMap.get(e.from);
        const toNode = nodesMap.get(e.to);
        const isApi = e.type === 'api-network';
        return {
          from: e.from,
          to: e.to,
          fromLabel: fromNode?.label || e.from,
          toLabel: toNode?.label || e.to,
          relation: e.relation || 'links',
          type: e.type,
          reason: isApi
            ? `Cross-Boundary API call (${e.label || 'HTTP'})`
            : `Cross-Module coupling between [${fromNode?.community_name}] and [${toNode?.community_name}]`
        };
      });

    // Import Cycle Detection (DFS)
    const importCycles: { path: string[]; labels: string[] }[] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const currentPath: string[] = [];

    const detectCycles = (u: string) => {
      visited.add(u);
      recStack.add(u);
      currentPath.push(u);

      const neighbors = adjacency.get(u) || [];
      for (const v of neighbors) {
        if (importCycles.length >= 5) break; // cap cycles
        if (!visited.has(v)) {
          detectCycles(v);
        } else if (recStack.has(v)) {
          // Cycle found
          const cycleStartIndex = currentPath.indexOf(v);
          if (cycleStartIndex !== -1) {
            const cyclePath = currentPath.slice(cycleStartIndex).concat(v);
            const cycleLabels = cyclePath.map(id => nodesMap.get(id)?.label || id);
            importCycles.push({ path: cyclePath, labels: cycleLabels });
          }
        }
      }

      currentPath.pop();
      recStack.delete(u);
    };

    for (const node of nodes) {
      if (!visited.has(node.id) && importCycles.length < 5) {
        detectCycles(node.id);
      }
    }

    // Suggested Questions Generation
    const suggestedQuestions = [
      ...(godNodes.length > 0 ? [{
        question: `How does the core abstraction '${godNodes[0].label}' orchestrate the rest of the application?`,
        category: 'architecture' as const
      }] : []),
      ...(surprisingConnections.length > 0 ? [{
        question: `Why does '${surprisingConnections[0].fromLabel}' directly connect to '${surprisingConnections[0].toLabel}'?`,
        category: 'coupling' as const
      }] : []),
      ...(importCycles.length > 0 ? [{
        question: `How can we refactor the circular dependency between ${importCycles[0].labels.join(' ➔ ')}?`,
        category: 'architecture' as const
      }] : []),
      {
        question: `What is the entrypoint flow and data flow across the primary modules?`,
        category: 'flow' as const
      }
    ];

    // Duplicate Entity / Redundant Symbol Detection (dedup.py logic)
    const symbolUsage = new Map<string, { nodeId: string; label: string; file: string }[]>();
    for (const node of nodes) {
      if (node.symbols && !node.source_file.includes('test') && !node.source_file.includes('spec')) {
        for (const sym of node.symbols) {
          if (sym.length >= 4) {
            if (!symbolUsage.has(sym)) symbolUsage.set(sym, []);
            symbolUsage.get(sym)!.push({ nodeId: node.id, label: node.label, file: node.source_file });
          }
        }
      }
    }

    const duplicates: DuplicateEntity[] = [];
    for (const [sym, occurrences] of symbolUsage.entries()) {
      if (occurrences.length > 1) {
        duplicates.push({ name: sym, occurrences });
        if (duplicates.length >= 8) break;
      }
    }

    // Git Working Tree Impact Calculation (prs.py logic)
    let gitImpact: GitImpactResult | undefined;
    try {
      const { execSync } = await import('child_process');
      const wsFolders = vscode.workspace.workspaceFolders;
      if (wsFolders && wsFolders.length > 0) {
        const rootPath = wsFolders[0].uri.fsPath;
        const statusOutput = execSync('git status --porcelain', { cwd: rootPath, encoding: 'utf-8', timeout: 2000 });
        const modifiedRelPaths = statusOutput
          .split('\n')
          .map((l) => l.slice(3).trim().replace(/\\/g, '/'))
          .filter(Boolean);

        if (modifiedRelPaths.length > 0) {
          const matchedNodes = nodes.filter((n) =>
            modifiedRelPaths.some((p) => n.source_file.includes(p) || p.includes(n.source_file))
          );
          const affectedMap = new Map<string, AffectedNode>();

          for (const mNode of matchedNodes) {
            const blast = await this.calculateBlastRadius(mNode.id, 2);
            if (blast) {
              for (const aff of blast.affectedNodes) {
                affectedMap.set(aff.id, aff);
              }
            }
          }

          gitImpact = {
            modifiedFiles: modifiedRelPaths,
            affectedFiles: Array.from(affectedMap.values()),
            totalAffected: affectedMap.size
          };
        }
      }
    } catch {
      // Git command non-fatal fallback
    }

    this.cachedData = {
      nodes,
      edges,
      communities,
      stats: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        communityCount: communities.length
      },
      analytics: {
        godNodes,
        surprisingConnections,
        importCycles,
        suggestedQuestions,
        duplicates,
        gitImpact
      }
    };

    this.logger.log(`[GraphifyService] Generated graph: ${nodes.length} nodes, ${edges.length} edges (${edges.filter(e => e.type === 'api-network').length} API bridges), ${communities.length} communities`);
    return this.cachedData;
  }

  /**
   * Generates comprehensive architecture.md markdown content from AST graph data.
   */
  public async generateArchitectureMarkdown(): Promise<string> {
    const data = await this.generateGraphData(false);
    const now = new Date().toISOString().split('T')[0];

    const apiEdges = data.edges.filter(e => e.type === 'api-network');
    const importEdges = data.edges.filter(e => e.type !== 'api-network');

    let md = `# Project Architecture & Codebase Map

> Generated automatically by **Chanakya AI Enhancer Graphify Engine** on ${now}.

---

## 📊 Overview & Metrics

- **Total Files / Symbols Indexed**: ${data.stats.nodeCount}
- **Static Dependencies**: ${importEdges.length}
- **Cross-Boundary API Bridges (Frontend ⇄ Backend)**: ${apiEdges.length}
- **Functional Communities / Modules**: ${data.stats.communityCount}

---

## 🌐 Cross-Boundary API Network Connections (Frontend ⇄ Backend)

${apiEdges.length > 0 ? `| Frontend Caller | HTTP Endpoint / Label | Backend Server Definition |
|---|---|---|
${apiEdges.map(e => {
  const fromNode = data.nodes.find(n => n.id === e.from);
  const toNode = data.nodes.find(n => n.id === e.to);
  return `| \`${fromNode?.source_file || e.from}\` | \`${e.label || 'API Call'}\` | \`${toNode?.source_file || e.to}\` |`;
}).join('\n')}` : `*No direct HTTP API calls detected.*`}

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

    md += `## 👑 Core Abstractions & God Nodes (Highest Connectivity)

${data.analytics?.godNodes && data.analytics.godNodes.length > 0 ? `| Component | File Path | Degree (Connections) | Type |
|---|---|---|---|
${data.analytics.godNodes.map(g => `| **\`${g.label}\`** | \`${g.source_file}\` | \`${g.degree}\` | \`${g.file_type}\` |`).join('\n')}` : `*No central god nodes detected.*`}

---

## ⚡ Surprising Connections & Cross-Module Couplings

${data.analytics?.surprisingConnections && data.analytics.surprisingConnections.length > 0 ? `| Source | Target | Relation | Coupling Reason |
|---|---|---|---|
${data.analytics.surprisingConnections.map(c => `| \`${c.fromLabel}\` | \`${c.toLabel}\` | \`${c.relation}\` | ${c.reason} |`).join('\n')}` : `*No unexpected cross-module couplings detected.*`}

---

${data.analytics?.importCycles && data.analytics.importCycles.length > 0 ? `## ⚠️ Circular Dependencies & Import Cycles

${data.analytics.importCycles.map((cy, i) => `- **Cycle #${i + 1}**: \`${cy.labels.join(' ➔ ')}\``).join('\n')}

---
` : ''}## 💡 Suggested Architectural Discovery Questions

${data.analytics?.suggestedQuestions && data.analytics.suggestedQuestions.length > 0 ? data.analytics.suggestedQuestions.map(q => `- **[${q.category.toUpperCase()}]** *${q.question}*`).join('\n') : `*No questions generated.*`}

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

  /**
   * Blast-Radius & Impact Analysis: computes all upstream files and components affected if targetNode is modified.
   */
  public async calculateBlastRadius(targetNodeId: string, maxDepth = 3): Promise<BlastRadiusResult | null> {
    const data = await this.generateGraphData(false);
    const targetNode = data.nodes.find((n) => n.id === targetNodeId);
    if (!targetNode) return null;

    // Upstream adjacency: to -> list of { from, relation }
    const upstreamAdj = new Map<string, { from: string; relation: string }[]>();
    for (const edge of data.edges) {
      if (!upstreamAdj.has(edge.to)) upstreamAdj.set(edge.to, []);
      upstreamAdj.get(edge.to)!.push({ from: edge.from, relation: edge.relation || 'imports' });
    }

    const affectedNodes: AffectedNode[] = [];
    const visited = new Set<string>([targetNodeId]);
    const queue: { id: string; depth: number; via_relation: string }[] = [];

    for (const up of upstreamAdj.get(targetNodeId) || []) {
      if (!visited.has(up.from)) {
        visited.add(up.from);
        queue.push({ id: up.from, depth: 1, via_relation: up.relation });
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = data.nodes.find((n) => n.id === current.id);
      if (node) {
        affectedNodes.push({
          id: node.id,
          label: node.label,
          source_file: node.source_file,
          depth: current.depth,
          via_relation: current.via_relation,
          isDirect: current.depth === 1
        });
      }

      if (current.depth < maxDepth) {
        for (const up of upstreamAdj.get(current.id) || []) {
          if (!visited.has(up.from)) {
            visited.add(up.from);
            queue.push({ id: up.from, depth: current.depth + 1, via_relation: up.relation });
          }
        }
      }
    }

    return {
      targetNodeId: targetNode.id,
      targetLabel: targetNode.label,
      targetFile: targetNode.source_file,
      affectedNodes,
      totalAffected: affectedNodes.length,
      maxDepth
    };
  }

  /**
   * Generates a Mermaid flowchart of the architecture graph.
   */
  public async generateMermaidDiagram(maxEdges = 50): Promise<string> {
    const data = await this.generateGraphData(false);
    let mermaid = '```mermaid\nflowchart TD\n';

    // Subgraph clusters by community
    for (const comm of data.communities.slice(0, 8)) {
      const commNodes = data.nodes.filter((n) => n.community === comm.id).slice(0, 12);
      if (commNodes.length > 0) {
        const safeCommName = comm.name.replace(/[^a-zA-Z0-9_]/g, '_');
        mermaid += `  subgraph ${safeCommName}["${comm.name}"]\n`;
        for (const node of commNodes) {
          const safeNodeId = node.id.replace(/[^a-zA-Z0-9_]/g, '_');
          mermaid += `    ${safeNodeId}["${node.label}"]\n`;
        }
        mermaid += `  end\n`;
      }
    }

    // Edges
    let count = 0;
    for (const edge of data.edges) {
      if (count++ >= maxEdges) break;
      const from = edge.from.replace(/[^a-zA-Z0-9_]/g, '_');
      const to = edge.to.replace(/[^a-zA-Z0-9_]/g, '_');
      if (edge.type === 'api-network') {
        mermaid += `  ${from} -.->|API: ${edge.label || 'call'}| ${to}\n`;
      } else {
        mermaid += `  ${from} --> ${to}\n`;
      }
    }

    mermaid += '```\n';
    return mermaid;
  }

  /**
   * Registers automatic file-save watcher for incremental graph cache invalidation.
   */
  public registerIncrementalWatcher(context: vscode.ExtensionContext): void {
    let debounceTimer: NodeJS.Timeout | null = null;

    const onFileEvent = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.logger.log('[GraphifyService] File change detected, auto-invalidating graph cache');
        this.cachedData = null;
      }, 2500);
    };

    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(onFileEvent),
      vscode.workspace.onDidCreateFiles(onFileEvent),
      vscode.workspace.onDidDeleteFiles(onFileEvent),
      vscode.workspace.onDidRenameFiles(onFileEvent)
    );
  }
}
