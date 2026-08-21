import { useEffect, useRef, useState, useMemo } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { vscode } from '../../vscode';
import { GraphifyData, GraphNode, BlastRadiusResult } from '../../types/graphify';
import {
  Search,
  RefreshCw,
  Maximize2,
  ExternalLink,
  Layers,
  ArrowLeft,
  Info,
  Sliders,
  ZoomIn,
  ZoomOut,
  FolderTree,
  FileText,
  X,
  Code,
  Crown,
  GitFork,
  AlertTriangle,
  HelpCircle,
  Send,
  Navigation,
  Flame,
  Radio
} from 'lucide-react';

interface GraphifyViewProps {
  onBack?: () => void;
}

type DrawerTab = 'layers' | 'godNodes' | 'bridges' | 'cycles' | 'blast' | 'insights';

export default function GraphifyView({ onBack }: GraphifyViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSetRef = useRef<DataSet<any> | null>(null);
  const edgesDataSetRef = useRef<DataSet<any> | null>(null);

  const [data, setData] = useState<GraphifyData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCommunities, setSelectedCommunities] = useState<Set<number>>(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<DrawerTab>('layers');
  const [isPhysicsEnabled, setIsPhysicsEnabled] = useState<boolean>(true);
  const [pathTargetNodeId, setPathTargetNodeId] = useState<string>('');
  const [blastResult, setBlastResult] = useState<BlastRadiusResult | null>(null);
  const [isCalculatingBlast, setIsCalculatingBlast] = useState<boolean>(false);

  // Request initial graph data from extension backend
  useEffect(() => {
    setLoading(true);
    vscode.postMessage({ type: 'getGraphifyData' });

    const timer = setTimeout(() => {
      setLoading(false);
    }, 15000);

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'graphifyDataResult') {
        clearTimeout(timer);
        const graphData: GraphifyData = msg.payload.data;
        setData(graphData);
        if (graphData && graphData.communities) {
          setSelectedCommunities(new Set(graphData.communities.map((c) => c.id)));
        }
        setLoading(false);
      } else if (msg.type === 'blastRadiusResult') {
        const res: BlastRadiusResult = msg.payload.result;
        setBlastResult(res);
        setIsCalculatingBlast(false);
        setActiveTab('blast');

        if (networkRef.current && nodesDataSetRef.current && res) {
          const affectedIdSet = new Set(res.affectedNodes.map((a) => a.id));
          affectedIdSet.add(res.targetNodeId);

          const allNodes = nodesDataSetRef.current.get();
          const updates = allNodes.map((n: any) => ({
            id: n.id,
            opacity: affectedIdSet.has(n.id) ? 1.0 : 0.15,
            color:
              n.id === res.targetNodeId
                ? { background: '#ef4444', border: '#dc2626' }
                : affectedIdSet.has(n.id)
                ? { background: '#f87171', border: '#ef4444' }
                : undefined
          }));
          nodesDataSetRef.current.update(updates);

          networkRef.current.fit({
            nodes: Array.from(affectedIdSet),
            animation: { duration: 700, easingFunction: 'easeInOutQuad' }
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Initialize and configure interactive force-directed Vis Network
  useEffect(() => {
    if (!containerRef.current || !data || data.nodes.length === 0) return;

    // Filter nodes by selected communities
    const visibleNodes = data.nodes.filter((n) => selectedCommunities.has(n.community));
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

    // Filter edges whose endpoints are both visible
    const visibleEdges = data.edges.filter(
      (e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)
    );

    // Format nodes with custom styling
    const visNodes = visibleNodes.map((node) => ({
      id: node.id,
      label: node.label,
      title: node.title,
      value: node.size,
      color: {
        background: node.color.background,
        border: node.color.border,
        highlight: {
          background: '#ffffff',
          border: node.color.background
        },
        hover: {
          background: '#ffffff',
          border: node.color.background
        }
      },
      font: {
        color: '#f1f5f9',
        size: 11,
        face: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        strokeWidth: 2,
        strokeColor: '#0a0a12'
      },
      shape: node.file_type === 'class' ? 'diamond' : node.file_type === 'function' ? 'triangle' : 'dot',
      borderWidth: 2,
      borderWidthSelected: 4,
      shadow: {
        enabled: true,
        color: `${node.color.background}55`,
        size: 10,
        x: 0,
        y: 0
      }
    }));

    // Format edges with animated smooth curves, arrows, and API network dashed differentiation
    const visEdges = visibleEdges.map((edge) => {
      const isApi = edge.type === 'api-network' || edge.relation === 'api-network';
      return {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        arrows: edge.arrows ? { to: { enabled: true, scaleFactor: isApi ? 0.8 : 0.6 } } : undefined,
        dashes: isApi ? [6, 4] : undefined,
        label: isApi ? edge.label : undefined,
        title: edge.title || (edge.label ? `🌐 API Call: ${edge.label}` : undefined),
        font: isApi
          ? {
              color: '#f43f5e',
              size: 10,
              face: 'ui-monospace, monospace',
              strokeWidth: 3,
              strokeColor: '#0a0a12',
              align: 'top'
            }
          : undefined,
        color: isApi
          ? {
              color: '#f43f5e',
              highlight: '#fb7185',
              hover: '#38bdf8',
              opacity: 0.95
            }
          : {
              color: 'rgba(255, 255, 255, 0.18)',
              highlight: '#38bdf8',
              hover: '#38bdf8',
              opacity: 0.35
            },
        width: isApi ? 2.4 : 1.2,
        hoverWidth: isApi ? 3.5 : 2.5,
        selectionWidth: isApi ? 3.5 : 3,
        smooth: {
          enabled: true,
          type: 'continuous',
          roundness: 0.18
        }
      };
    });

    nodesDataSetRef.current = new DataSet(visNodes);
    edgesDataSetRef.current = new DataSet(visEdges);

    const options = {
      nodes: {
        scaling: {
          min: 9,
          max: 28
        }
      },
      edges: {
        smooth: {
          enabled: true,
          type: 'continuous',
          roundness: 0.18
        }
      },
      physics: {
        enabled: isPhysicsEnabled,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -45,
          centralGravity: 0.012,
          springLength: 90,
          springConstant: 0.07,
          damping: 0.45,
          avoidOverlap: 0.85
        },
        stabilization: {
          iterations: 150,
          updateInterval: 30
        }
      },
      interaction: {
        hover: true,
        hoverConnectedEdges: true,
        tooltipDelay: 80,
        navigationButtons: false,
        keyboard: true,
        zoomView: true,
        dragView: true
      }
    };

    const network = new Network(
      containerRef.current,
      { nodes: nodesDataSetRef.current, edges: edgesDataSetRef.current },
      options
    );

    // Single-click selection: open file in editor and populate inspector drawer
    network.on('click', (params) => {
      if (params.nodes && params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const found = data.nodes.find((n) => n.id === nodeId);
        if (found) {
          setSelectedNode(found);
          setIsSidebarOpen(true);

          // Dispatch openFile to VS Code central main editor
          vscode.postMessage({
            type: 'openFile',
            payload: { filePath: found.source_file }
          });
        }
      } else {
        setSelectedNode(null);
      }
    });

    // Double-click to zoom and focus smoothly on node
    network.on('doubleClick', (params) => {
      if (params.nodes && params.nodes.length > 0) {
        network.focus(params.nodes[0], {
          scale: 1.4,
          animation: {
            duration: 600,
            easingFunction: 'easeInOutQuad'
          }
        });
      }
    });

    // Hover glow effect: illuminate connected nodes and edges, dim non-neighbors
    network.on('hoverNode', (params) => {
      const hoveredId = params.node;
      if (!nodesDataSetRef.current) return;

      const connectedNodes = new Set(network.getConnectedNodes(hoveredId) as string[]);
      connectedNodes.add(hoveredId);

      const allNodes = nodesDataSetRef.current.get();
      const updates = allNodes.map((n: any) => ({
        id: n.id,
        opacity: connectedNodes.has(n.id) ? 1.0 : 0.25
      }));
      nodesDataSetRef.current.update(updates);
    });

    network.on('blurNode', () => {
      if (!nodesDataSetRef.current) return;
      const allNodes = nodesDataSetRef.current.get();
      const updates = allNodes.map((n: any) => ({
        id: n.id,
        opacity: 1.0
      }));
      nodesDataSetRef.current.update(updates);
    });

    networkRef.current = network;

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [data, selectedCommunities, isPhysicsEnabled]);

  // Search filter matches
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !data) return [];
    const q = searchQuery.toLowerCase();
    return data.nodes.filter(
      (n) => n.label.toLowerCase().includes(q) || n.source_file.toLowerCase().includes(q)
    );
  }, [searchQuery, data]);

  // Shortest Path Finder (BFS between selectedNode and targetNode)
  const handleTraceShortestPath = (targetId: string) => {
    if (!selectedNode || !data || !networkRef.current || !nodesDataSetRef.current) return;
    const startId = selectedNode.id;
    if (startId === targetId) return;

    // Adjacency graph
    const adj = new Map<string, string[]>();
    for (const e of data.edges) {
      if (!adj.has(e.from)) adj.set(e.from, []);
      if (!adj.has(e.to)) adj.set(e.to, []);
      adj.get(e.from)!.push(e.to);
      adj.get(e.to)!.push(e.from);
    }

    // BFS
    const queue: string[] = [startId];
    const prev = new Map<string, string>();
    const visited = new Set<string>([startId]);
    let found = false;

    while (queue.length > 0) {
      const u = queue.shift()!;
      if (u === targetId) {
        found = true;
        break;
      }
      for (const v of adj.get(u) || []) {
        if (!visited.has(v)) {
          visited.add(v);
          prev.set(v, u);
          queue.push(v);
        }
      }
    }

    if (found) {
      const path: string[] = [];
      let curr: string | undefined = targetId;
      while (curr) {
        path.unshift(curr);
        curr = prev.get(curr);
      }

      // Fit network to path
      networkRef.current.fit({
        nodes: path,
        animation: { duration: 700, easingFunction: 'easeInOutQuad' }
      });
    }
  };

  const handleCalculateBlastRadius = (nodeId: string) => {
    setIsCalculatingBlast(true);
    vscode.postMessage({
      type: 'calculateBlastRadius',
      payload: { nodeId }
    });
  };

  const handleSelectSearchResult = (node: GraphNode) => {
    setSelectedNode(node);
    setSearchQuery('');
    if (networkRef.current) {
      networkRef.current.selectNodes([node.id]);
      networkRef.current.focus(node.id, {
        scale: 1.4,
        animation: { duration: 500, easingFunction: 'easeInOutQuad' }
      });
    }
  };

  const handleToggleCommunity = (communityId: number) => {
    setSelectedCommunities((prev) => {
      const next = new Set(prev);
      if (next.has(communityId)) {
        next.delete(communityId);
      } else {
        next.add(communityId);
      }
      return next;
    });
  };

  const handleToggleAllCommunities = () => {
    if (!data) return;
    if (selectedCommunities.size === data.communities.length) {
      setSelectedCommunities(new Set());
    } else {
      setSelectedCommunities(new Set(data.communities.map((c) => c.id)));
    }
  };

  const handleFit = () => {
    if (networkRef.current) {
      networkRef.current.fit({
        animation: { duration: 500, easingFunction: 'easeInOutQuad' }
      });
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (networkRef.current) {
      const currentScale = networkRef.current.getScale();
      const newScale = direction === 'in' ? currentScale * 1.3 : currentScale * 0.7;
      networkRef.current.moveTo({ scale: newScale, animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
    }
  };

  const handleAskQuestion = (question: string) => {
    vscode.postMessage({
      type: 'sendMessage',
      payload: {
        text: `Analyze the codebase architecture: ${question}`,
        contextItems: []
      }
    });
  };

  const hasNoNodes = !loading && (!data || data.nodes.length === 0);

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0a12] text-slate-100 overflow-hidden select-none font-sans">
      {/* Top Navbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#12121f] shrink-0 z-20 gap-2">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Graphify Architecture
            </span>
          </div>
        </div>

        {/* Center: Search Autocomplete */}
        <div className="relative flex-1 max-w-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search file, component, symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition"
            />
          </div>

          {/* Autocomplete Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-[#141426] border border-white/10 rounded-lg shadow-2xl z-50 p-1 flex flex-col gap-0.5">
              {searchResults.slice(0, 8).map((node) => (
                <div
                  key={node.id}
                  onClick={() => handleSelectSearchResult(node)}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-cyan-500/20 cursor-pointer text-xs transition"
                >
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: node.color.background }}
                    />
                    <span className="truncate font-medium text-slate-200">{node.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[120px] font-mono">
                    {node.source_file}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-1.5">
          {/* Zoom Buttons */}
          <button
            onClick={() => handleZoom('in')}
            className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFit}
            className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
            title="Fit to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Physics Toggle */}
          <button
            onClick={() => setIsPhysicsEnabled((prev) => !prev)}
            className={`p-1.5 rounded transition ${
              isPhysicsEnabled ? 'text-cyan-400 hover:bg-cyan-500/10' : 'text-slate-500 hover:bg-white/5'
            }`}
            title={isPhysicsEnabled ? 'Freeze Physics Simulation' : 'Enable Physics Simulation'}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Refresh Graph */}
          <button
            onClick={() => {
              setLoading(true);
              vscode.postMessage({ type: 'getGraphifyData', payload: { refresh: true } });
            }}
            className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
            title="Rescan & Refresh Graph"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Export architecture.md Button */}
          <button
            onClick={() => vscode.postMessage({ type: 'exportArchitectureMd' })}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition"
            title="Export architecture.md with full analytics to workspace"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export .md</span>
          </button>

          {/* Drawer Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
              isSidebarOpen
                ? 'bg-cyan-500 text-black font-semibold'
                : 'bg-white/10 text-slate-200 hover:bg-white/15'
            }`}
            title="Toggle Inspector & Analytics Drawer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hub</span>
          </button>
        </div>
      </div>

      {/* Main Body: Graph Canvas */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-[#0d0d18]">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
            <div className="w-8 h-8 border-3 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
            <div className="text-xs font-medium text-slate-300">Parsing AST & Building Universal Architecture Graph...</div>
          </div>
        )}

        {/* Empty State Overlay */}
        {hasNoNodes && (
          <div className="absolute inset-0 bg-[#0d0d18] flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-500/5">
              <FolderTree className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-white mb-1.5">No Open Workspace Found</h2>
            <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
              Open a project folder in VS Code to generate an interactive multi-language architecture graph.
            </p>
            <button
              onClick={() => {
                setLoading(true);
                vscode.postMessage({ type: 'getGraphifyData', payload: { refresh: true } });
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition shadow-md shadow-cyan-500/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Scan Active Project</span>
            </button>
          </div>
        )}

        {/* Stats & Visual Legend Overlay */}
        {data && data.stats.nodeCount > 0 && (
          <div className="absolute bottom-2.5 left-2.5 px-3 py-2 rounded-xl bg-black/85 backdrop-blur-md border border-white/10 text-[11px] text-slate-300 pointer-events-none z-10 flex flex-col gap-1.5 shadow-2xl">
            <div className="flex items-center gap-2">
              <span>
                <b className="text-white font-semibold">{data.stats.nodeCount}</b> files · <b className="text-white font-semibold">{data.stats.edgeCount}</b> links · <b className="text-cyan-400 font-semibold">{data.stats.communityCount}</b> modules
              </span>
            </div>
            <div className="flex items-center gap-3 pt-1 border-t border-white/10 text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-white/40 inline-block rounded" />
                <span>Static Import</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 border-b-2 border-dashed border-rose-500 inline-block" />
                <span className="text-rose-300 font-medium">API Network (FE ⇄ BE)</span>
              </div>
            </div>
          </div>
        )}

        {/* Slide-in Right Drawer with Multi-Tab Analytics */}
        {isSidebarOpen && (
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-[#121222]/95 backdrop-blur-md border-l border-white/10 flex flex-col z-30 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-[#16162a]">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Architecture Hub
                </span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tab Navigation Rail */}
            <div className="flex items-center border-b border-white/10 bg-[#10101c] px-1 py-1 gap-1 text-[11px] overflow-x-auto">
              <button
                onClick={() => setActiveTab('layers')}
                className={`px-2 py-1 rounded font-medium transition flex items-center gap-1 shrink-0 ${
                  activeTab === 'layers' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3" /> Layers
              </button>
              <button
                onClick={() => setActiveTab('godNodes')}
                className={`px-2 py-1 rounded font-medium transition flex items-center gap-1 shrink-0 ${
                  activeTab === 'godNodes' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crown className="w-3 h-3 text-amber-400" /> Hubs
              </button>
              <button
                onClick={() => setActiveTab('blast')}
                className={`px-2 py-1 rounded font-medium transition flex items-center gap-1 shrink-0 ${
                  activeTab === 'blast' ? 'bg-rose-500 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="w-3 h-3 text-rose-400" /> Blast
              </button>
              <button
                onClick={() => setActiveTab('bridges')}
                className={`px-2 py-1 rounded font-medium transition flex items-center gap-1 shrink-0 ${
                  activeTab === 'bridges' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <GitFork className="w-3 h-3 text-rose-400" /> Bridges
              </button>
              <button
                onClick={() => setActiveTab('cycles')}
                className={`px-2 py-1 rounded font-medium transition flex items-center gap-1 shrink-0 ${
                  activeTab === 'cycles' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-yellow-400" /> Cycles
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`px-2 py-1 rounded font-medium transition flex items-center gap-1 shrink-0 ${
                  activeTab === 'insights' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <HelpCircle className="w-3 h-3 text-purple-400" /> AI
              </button>
            </div>

            {/* Selected Node Inspector Card (Always visible if a node is selected) */}
            {selectedNode && (
              <div className="p-3 border-b border-white/10 bg-[#141426] flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-cyan-400 flex items-center gap-1">
                    <Info className="w-3 h-3" /> Selected Node
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono">
                    {selectedNode.file_type}
                  </span>
                </div>
                <div className="text-xs font-bold text-white truncate" title={selectedNode.label}>
                  {selectedNode.label}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between gap-1">
                  <span className="truncate" title={selectedNode.source_file}>
                    {selectedNode.source_file}
                  </span>
                  <button
                    onClick={() =>
                      vscode.postMessage({
                        type: 'openFile',
                        payload: { filePath: selectedNode.source_file }
                      })
                    }
                    className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-white/5 rounded shrink-0"
                    title="Open in VS Code Central Editor"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-2">
                  <span>Degree: <b className="text-slate-200">{selectedNode.degree}</b></span>
                  <span>·</span>
                  <span>Module: <b className="text-slate-200">{selectedNode.community_name}</b></span>
                </div>

                {/* Blast Radius Trigger Button */}
                <button
                  onClick={() => handleCalculateBlastRadius(selectedNode.id)}
                  disabled={isCalculatingBlast}
                  className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition shadow-md shadow-rose-500/10"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>{isCalculatingBlast ? 'Calculating Blast...' : 'Calculate Blast Radius (Impact)'}</span>
                </button>

                {/* Path Trace Input */}
                <div className="mt-1 pt-1.5 border-t border-white/10 flex items-center gap-1.5">
                  <Navigation className="w-3 h-3 text-amber-400 shrink-0" />
                  <select
                    value={pathTargetNodeId}
                    onChange={(e) => {
                      setPathTargetNodeId(e.target.value);
                      handleTraceShortestPath(e.target.value);
                    }}
                    className="flex-1 bg-black/40 border border-white/10 rounded px-1.5 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-amber-400"
                  >
                    <option value="">Trace Shortest Path to...</option>
                    {data?.nodes
                      .filter((n) => n.id !== selectedNode.id)
                      .slice(0, 50)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label} ({n.source_file})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Exported AST Symbols */}
                {selectedNode.symbols && selectedNode.symbols.length > 0 && (
                  <div className="mt-1">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1 flex items-center gap-1">
                      <Code className="w-3 h-3 text-purple-400" /> Exported Symbols ({selectedNode.symbols.length})
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                      {selectedNode.symbols.slice(0, 10).map((sym, idx) => (
                        <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 font-mono border border-purple-500/30 truncate max-w-full">
                          {sym}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 1: Layers & Communities */}
            {activeTab === 'layers' && (
              <div className="flex-1 overflow-y-auto flex flex-col">
                <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-[#141426] shrink-0">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Layers ({data?.communities.length || 0})
                  </span>
                  <button
                    onClick={handleToggleAllCommunities}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition"
                  >
                    {data && selectedCommunities.size === data.communities.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="p-2 space-y-1">
                  {data?.communities.map((comm) => {
                    const isSelected = selectedCommunities.has(comm.id);
                    return (
                      <div
                        key={comm.id}
                        onClick={() => handleToggleCommunity(comm.id)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition select-none ${
                          isSelected ? 'bg-white/5 text-slate-200 hover:bg-white/10' : 'text-slate-500 hover:bg-white/5 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer pointer-events-none"
                          />
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: comm.color }}
                          />
                          <span className="truncate font-medium">{comm.name}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 ml-2">{comm.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: God Nodes / Core Hubs */}
            {activeTab === 'godNodes' && (
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                <div className="text-[11px] text-slate-400 px-1 py-1">
                  Core abstractions that orchestrate application flow (highest connectivity):
                </div>
                {data?.analytics?.godNodes.map((g, idx) => (
                  <div
                    key={g.id}
                    onClick={() => {
                      const found = data.nodes.find((n) => n.id === g.id);
                      if (found) handleSelectSearchResult(found);
                    }}
                    className="p-2.5 rounded-lg bg-black/40 hover:bg-cyan-500/20 border border-white/5 cursor-pointer transition flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-mono">
                          {idx + 1}
                        </span>
                        {g.label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                        {g.degree} links
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono truncate">{g.source_file}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: Blast Radius / Impact Analysis */}
            {activeTab === 'blast' && (
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {blastResult ? (
                  <div className="flex flex-col gap-2">
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5" /> Target: {blastResult.targetLabel}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 font-bold">
                          {blastResult.totalAffected} Broken Files
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono truncate">{blastResult.targetFile}</span>
                    </div>

                    <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider px-1">
                      Upstream Broken Dependents:
                    </div>

                    {blastResult.affectedNodes.length > 0 ? (
                      blastResult.affectedNodes.map((aff, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            const found = data?.nodes.find((n) => n.id === aff.id);
                            if (found) handleSelectSearchResult(found);
                          }}
                          className="p-2.5 rounded-lg bg-black/40 hover:bg-rose-500/20 border border-white/5 cursor-pointer transition flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                              <Radio className={`w-3 h-3 ${aff.isDirect ? 'text-red-400' : 'text-amber-400'}`} />
                              {aff.label}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              aff.isDirect ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              Depth {aff.depth} ({aff.via_relation})
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono truncate">{aff.source_file}</span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">
                        Zero upstream dependents! This node can be refactored safely.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Flame className="w-8 h-8 text-rose-500/40" />
                    <span>Select any file/component and click <b>"Calculate Blast Radius"</b> to inspect all upstream code affected by changes.</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Surprising Cross-Domain Bridges */}
            {activeTab === 'bridges' && (
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                <div className="text-[11px] text-slate-400 px-1 py-1">
                  Cross-boundary API calls & unexpected cross-module couplings:
                </div>
                {data?.analytics?.surprisingConnections.map((b, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-1 text-xs"
                  >
                    <div className="flex items-center justify-between text-slate-200 font-medium">
                      <span className="text-cyan-300 truncate max-w-[110px]">{b.fromLabel}</span>
                      <span className="text-[10px] text-slate-500 font-mono">➔</span>
                      <span className="text-rose-300 truncate max-w-[110px]">{b.toLabel}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{b.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 5: Circular Dependencies */}
            {activeTab === 'cycles' && (
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <div className="text-[11px] text-slate-400 px-1 py-1">
                  Circular dependencies detected in the codebase:
                </div>
                {data?.analytics?.importCycles && data.analytics.importCycles.length > 0 ? (
                  data.analytics.importCycles.map((cy, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs flex flex-col gap-1.5"
                    >
                      <div className="flex items-center gap-1.5 text-red-400 font-bold text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5" /> Cycle #{idx + 1}
                      </div>
                      <div className="text-[11px] font-mono text-slate-300 leading-relaxed">
                        {cy.labels.join(' ➔ ')}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400">
                    ✅ No circular dependencies detected!
                  </div>
                )}
              </div>
            )}

            {/* Tab 6: Architectural Questions & AI Insights */}
            {activeTab === 'insights' && (
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <div className="text-[11px] text-slate-400 px-1 py-1">
                  AI-suggested architectural queries based on graph topology:
                </div>
                {data?.analytics?.suggestedQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-[#141426] border border-white/5 flex flex-col gap-2 text-xs hover:border-purple-500/30 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold tracking-wider">
                        {q.category}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-snug">{q.question}</p>
                    <button
                      onClick={() => handleAskQuestion(q.question)}
                      className="self-end flex items-center gap-1 px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-[11px] font-medium transition"
                    >
                      <Send className="w-3 h-3" /> Ask Chanakya AI
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
