import { useEffect, useRef, useState, useMemo } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { vscode } from '../../vscode';
import { GraphifyData, GraphNode } from '../../types/graphify';
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
  X
} from 'lucide-react';

interface GraphifyViewProps {
  onBack?: () => void;
}

export default function GraphifyView({ onBack }: GraphifyViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSetRef = useRef<DataSet<any> | null>(null);
  const edgesDataSetRef = useRef<DataSet<any> | null>(null);

  const [data, setData] = useState<GraphifyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedCommunities, setSelectedCommunities] = useState<Set<number>>(new Set());
  const [activeNeighbors, setActiveNeighbors] = useState<GraphNode[]>([]);
  const [isPhysicsEnabled, setIsPhysicsEnabled] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Request initial data from VS Code extension host
  useEffect(() => {
    setLoading(true);
    vscode.postMessage({ type: 'getGraphifyData' });

    const timer = setTimeout(() => {
      setLoading(false);
    }, 6000);

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
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Initialize and update Vis Network
  useEffect(() => {
    if (!containerRef.current || !data || data.nodes.length === 0) return;

    // Filter nodes by selected communities
    const visibleNodes = data.nodes.filter((n) => selectedCommunities.has(n.community));
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

    // Filter edges whose endpoints are both visible
    const visibleEdges = data.edges.filter(
      (e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)
    );

    // Format for Vis.js
    const visNodes = visibleNodes.map((node) => ({
      id: node.id,
      label: node.label,
      title: `${node.label} (${node.file_type})\nFile: ${node.source_file}\nDegree: ${node.degree}`,
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
          border: node.color.border
        }
      },
      font: {
        color: '#e0e0e0',
        size: 11,
        face: 'ui-monospace, SFMono-Regular, Menlo, monospace'
      },
      shape: node.file_type === 'class' ? 'diamond' : node.file_type === 'function' ? 'triangle' : 'dot',
      borderWidth: 1.5,
      borderWidthSelected: 3
    }));

    const visEdges = visibleEdges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      arrows: edge.arrows ? { to: { enabled: true, scaleFactor: 0.5 } } : undefined,
      color: {
        color: 'rgba(255, 255, 255, 0.15)',
        highlight: '#38bdf8',
        hover: '#38bdf8',
        opacity: 0.25
      },
      width: 1,
      hoverWidth: 2,
      selectionWidth: 2.5,
      smooth: {
        enabled: true,
        type: 'continuous',
        roundness: 0.1
      }
    }));

    nodesDataSetRef.current = new DataSet(visNodes);
    edgesDataSetRef.current = new DataSet(visEdges);

    const options = {
      nodes: {
        scaling: {
          min: 8,
          max: 26
        },
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.5)',
          size: 6,
          x: 2,
          y: 2
        }
      },
      edges: {
        smooth: {
          enabled: true,
          type: 'continuous',
          roundness: 0.1
        }
      },
      physics: {
        enabled: isPhysicsEnabled,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -40,
          centralGravity: 0.01,
          springLength: 80,
          springConstant: 0.08,
          damping: 0.4,
          avoidOverlap: 0.8
        },
        stabilization: {
          iterations: 120,
          updateInterval: 25
        }
      },
      interaction: {
        hover: true,
        hoverConnectedEdges: true,
        tooltipDelay: 100,
        zoomView: true,
        dragView: true,
        navigationButtons: false,
        keyboard: true
      }
    };

    if (networkRef.current) {
      networkRef.current.destroy();
    }

    const network = new Network(
      containerRef.current,
      { nodes: nodesDataSetRef.current, edges: edgesDataSetRef.current },
      options
    );
    networkRef.current = network;

    // Node click handler
    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const found = data.nodes.find((n) => n.id === nodeId);
        if (found) {
          setSelectedNode(found);
          const connectedIds = network.getConnectedNodes(nodeId) as string[];
          const neighbors = data.nodes.filter((n) => connectedIds.includes(n.id));
          setActiveNeighbors(neighbors);
          setIsSidebarOpen(true); // Open inspector when clicking node
        }
      } else {
        setSelectedNode(null);
        setActiveNeighbors([]);
      }
    });

    // Double click to open file in editor
    network.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const found = data.nodes.find((n) => n.id === nodeId);
        if (found && found.source_file) {
          vscode.postMessage({
            type: 'openFileInEditor',
            payload: { filePath: found.source_file }
          });
        }
      }
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [data, selectedCommunities, isPhysicsEnabled]);

  // Search filtering
  const filteredSearchResults = useMemo(() => {
    if (!data || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return data.nodes
      .filter((n) => n.label.toLowerCase().includes(q) || n.source_file.toLowerCase().includes(q))
      .slice(0, 15);
  }, [data, searchQuery]);

  const handleSelectSearchResult = (node: GraphNode) => {
    setSelectedNode(node);
    setSearchQuery('');
    if (networkRef.current) {
      networkRef.current.focus(node.id, {
        scale: 1.2,
        animation: { duration: 600, easingFunction: 'easeInOutQuad' }
      });
      networkRef.current.selectNodes([node.id]);
    }
  };

  const handleToggleCommunity = (commId: number) => {
    setSelectedCommunities((prev) => {
      const next = new Set(prev);
      if (next.has(commId)) {
        next.delete(commId);
      } else {
        next.add(commId);
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
      networkRef.current.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
    }
  };

  const handleZoomIn = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 1.3, animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
    }
  };

  const handleZoomOut = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 0.7, animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    vscode.postMessage({ type: 'getGraphifyData', payload: { refresh: true } });
  };

  const hasNoNodes = !loading && (!data || data.nodes.length === 0);

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a12] text-slate-200 overflow-hidden select-none font-sans relative">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#12121f] border-b border-white/10 z-20 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 transition shrink-0"
              title="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <h1 className="text-xs sm:text-sm font-semibold text-white tracking-wide truncate">
              Graphify Architecture
            </h1>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Search bar */}
          <div className="relative">
            <div className="flex items-center bg-[#0a0a12] border border-white/10 rounded-md px-2 py-1 text-xs w-28 sm:w-44 focus-within:w-48 sm:focus-within:w-56 focus-within:border-cyan-500/50 transition-all">
              <Search className="w-3 h-3 text-slate-400 mr-1.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-transparent border-none outline-none text-slate-200 w-full placeholder-slate-500 text-xs"
              />
            </div>
            {/* Search Dropdown */}
            {filteredSearchResults.length > 0 && (
              <div className="absolute right-0 top-full mt-1 bg-[#1a1a2e] border border-white/15 rounded-lg shadow-2xl max-h-60 overflow-y-auto z-50 p-1 w-64">
                {filteredSearchResults.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleSelectSearchResult(n)}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded text-xs hover:bg-cyan-500/20 cursor-pointer transition"
                  >
                    <span className="font-medium text-slate-200 truncate">{n.label}</span>
                    <span className="text-[10px] text-slate-400 uppercase ml-2">{n.file_type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleZoomIn}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFit}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition"
            title="Fit to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsPhysicsEnabled((prev) => !prev)}
            className={`p-1 rounded transition ${
              isPhysicsEnabled ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-slate-400'
            }`}
            title="Toggle Physics"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-1 rounded bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30 transition"
            title="Re-scan Workspace"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export architecture.md Button */}
          <button
            onClick={() => vscode.postMessage({ type: 'exportArchitectureMd' })}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition"
            title="Export architecture.md to workspace"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export .md</span>
          </button>

          {/* Communities Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
              isSidebarOpen
                ? 'bg-cyan-500 text-black font-semibold'
                : 'bg-white/10 text-slate-200 hover:bg-white/15'
            }`}
            title="Toggle Communities & Inspector"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Layers</span>
            {data && data.communities && (
              <span className="text-[10px] bg-black/30 px-1 py-0.2 rounded font-mono">
                {data.communities.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Body: Graph Canvas */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-[#0d0d18]">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
            <div className="w-8 h-8 border-3 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
            <div className="text-xs font-medium text-slate-300">Analyzing Project & Constructing Graphify...</div>
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
              Open a project folder in VS Code to generate an interactive architectural graph of all your files, classes, and dependencies.
            </p>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition shadow-md shadow-cyan-500/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Scan Active Project</span>
            </button>
          </div>
        )}

        {/* Stats Pill Overlay */}
        {data && data.stats.nodeCount > 0 && (
          <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md border border-white/10 text-[11px] text-slate-400 pointer-events-none z-10 flex items-center gap-2">
            <span>
              <b className="text-white">{data.stats.nodeCount}</b> nodes · <b className="text-white">{data.stats.edgeCount}</b> edges · <b className="text-cyan-400">{data.stats.communityCount}</b> communities
            </span>
          </div>
        )}

        {/* Slide-in / Collapsible Right Drawer for Communities & Inspector */}
        {isSidebarOpen && (
          <div className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-[#121222]/95 backdrop-blur-md border-l border-white/10 flex flex-col z-30 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-[#16162a]">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Communities & Details
                </span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Node Inspector Card */}
            {selectedNode && (
              <div className="p-3 border-b border-white/10 bg-[#141426] flex flex-col gap-1.5 shrink-0">
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
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span className="truncate max-w-[170px]" title={selectedNode.source_file}>
                    {selectedNode.source_file}
                  </span>
                  <button
                    onClick={() =>
                      vscode.postMessage({
                        type: 'openFileInEditor',
                        payload: { filePath: selectedNode.source_file }
                      })
                    }
                    className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-white/5 rounded"
                    title="Open in VS Code"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-2">
                  <span>Degree: <b className="text-slate-200">{selectedNode.degree}</b></span>
                  <span>·</span>
                  <span>Community: <b className="text-slate-200">{selectedNode.community_name}</b></span>
                </div>

                {/* Neighbors List */}
                {activeNeighbors.length > 0 && (
                  <div className="mt-1">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">
                      Connected ({activeNeighbors.length})
                    </div>
                    <div className="max-h-24 overflow-y-auto flex flex-col gap-1 pr-1">
                      {activeNeighbors.map((neighbor) => (
                        <div
                          key={neighbor.id}
                          onClick={() => handleSelectSearchResult(neighbor)}
                          className="flex items-center justify-between px-2 py-0.5 rounded text-[11px] bg-black/40 hover:bg-cyan-500/20 cursor-pointer transition border border-white/5"
                        >
                          <span className="truncate max-w-[150px] text-slate-300">{neighbor.label}</span>
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: neighbor.color.background }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Communities Header Controls */}
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

            {/* Communities Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
      </div>
    </div>
  );
}
