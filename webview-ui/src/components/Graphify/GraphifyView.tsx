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
  ZoomOut
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

  // Request initial data from VS Code extension host
  useEffect(() => {
    setLoading(true);
    vscode.postMessage({ type: 'getGraphifyData' });

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'graphifyDataResult') {
        const graphData: GraphifyData = msg.payload.data;
        setData(graphData);
        // Default: all communities selected
        setSelectedCommunities(new Set(graphData.communities.map((c) => c.id)));
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Initialize and update Vis Network
  useEffect(() => {
    if (!containerRef.current || !data) return;

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
      title: `${node.label} (${node.file_type})\nFile: ${node.source_file}\nConnections: ${node.degree}`,
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
        color: 'rgba(255, 255, 255, 0.12)',
        highlight: '#38bdf8',
        hover: '#38bdf8',
        opacity: 0.25
      },
      width: 1,
      hoverWidth: 2,
      selectionWidth: 2.5,
      smooth: {
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
          max: 28
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
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 90,
          springConstant: 0.08,
          damping: 0.4,
          avoidOverlap: 0.8
        },
        stabilization: {
          iterations: 150,
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
          // Find 1st-degree neighbors
          const connectedIds = network.getConnectedNodes(nodeId) as string[];
          const neighbors = data.nodes.filter((n) => connectedIds.includes(n.id));
          setActiveNeighbors(neighbors);
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

  // Handle Search filtering and node focusing
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

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a12] text-slate-200 overflow-hidden select-none font-sans">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#12121f] border-b border-white/10 z-20 shadow-md">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 transition"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-sm font-semibold text-white tracking-wide flex items-center gap-1.5">
              <span>Graphify Architecture</span>
            </h1>
          </div>
          {data && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
              {data.stats.nodeCount} nodes · {data.stats.edgeCount} edges · {data.stats.communityCount} communities
            </span>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <div className="flex items-center bg-[#0a0a12] border border-white/10 rounded-lg px-2.5 py-1 text-xs w-56 focus-within:border-cyan-500/50 transition">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-2 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes or symbols..."
                className="bg-transparent border-none outline-none text-slate-200 w-full placeholder-slate-500 text-xs"
              />
            </div>
            {/* Search Dropdown */}
            {filteredSearchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-[#1a1a2e] border border-white/15 rounded-lg shadow-2xl max-h-60 overflow-y-auto z-50 p-1">
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
            className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleFit}
            className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 transition"
            title="Fit to Screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPhysicsEnabled((prev) => !prev)}
            className={`p-1.5 rounded-md transition ${
              isPhysicsEnabled ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-slate-400'
            }`}
            title="Toggle Physics Simulation"
          >
            <Sliders className="w-4 h-4" />
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30 transition"
            title="Re-scan and refresh workspace"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Body: Graph Canvas + Communities Right Sidebar */}
      <div className="flex flex-1 w-full h-full relative overflow-hidden">
        {/* Graph Canvas Container */}
        <div className="flex-1 h-full w-full relative bg-[#0d0d18]">
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {loading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
              <div className="w-10 h-10 border-3 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
              <div className="text-sm font-medium text-slate-300">Analyzing Project & Constructing Graphify...</div>
            </div>
          )}

          {/* Quick Tip Pill */}
          <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[11px] text-slate-400 pointer-events-none z-10 flex items-center gap-2">
            <span className="text-cyan-400 font-semibold">Tip:</span> Double-click any node to jump directly to its file in the editor!
          </div>
        </div>

        {/* Right Sidebar: Communities & Node Inspector */}
        <div className="w-72 h-full bg-[#121222] border-l border-white/10 flex flex-col z-20 select-none shadow-xl">
          {/* Node Inspector Card */}
          {selectedNode ? (
            <div className="p-3.5 border-b border-white/10 bg-[#16162a] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider uppercase text-cyan-400 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Node Inspector
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono">
                  {selectedNode.file_type}
                </span>
              </div>
              <div className="text-sm font-semibold text-white truncate" title={selectedNode.label}>
                {selectedNode.label}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span className="truncate max-w-[180px]" title={selectedNode.source_file}>
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
                  title="Open in VS Code Editor"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Degree: <b className="text-slate-200">{selectedNode.degree}</b></span>
                <span>·</span>
                <span>Community: <b className="text-slate-200">{selectedNode.community_name}</b></span>
              </div>

              {/* Neighbors / Connections List */}
              {activeNeighbors.length > 0 && (
                <div className="mt-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">
                    Connected Nodes ({activeNeighbors.length})
                  </div>
                  <div className="max-h-28 overflow-y-auto flex flex-col gap-1 pr-1">
                    {activeNeighbors.map((neighbor) => (
                      <div
                        key={neighbor.id}
                        onClick={() => handleSelectSearchResult(neighbor)}
                        className="flex items-center justify-between px-2 py-1 rounded text-[11px] bg-black/30 hover:bg-cyan-500/20 cursor-pointer transition border border-white/5"
                      >
                        <span className="truncate max-w-[160px] text-slate-300">{neighbor.label}</span>
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: neighbor.color.background }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 border-b border-white/10 text-xs text-slate-400 italic text-center">
              Click a node to inspect details & connections
            </div>
          )}

          {/* Communities Header & Controls */}
          <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between bg-[#141426]">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-bold tracking-wider uppercase text-slate-300">Communities</span>
            </div>
            <button
              onClick={handleToggleAllCommunities}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition"
            >
              {data && selectedCommunities.size === data.communities.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Communities List */}
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
                      onChange={() => {}} // Handled by parent div
                      className="w-3.5 h-3.5 rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer pointer-events-none"
                    />
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
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
      </div>
    </div>
  );
}
