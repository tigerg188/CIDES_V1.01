import React from "react";
import {
  CheckCircle2,
  Clock,
  Lock,
  GitBranch,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  Sliders,
} from "lucide-react";
import { ProjectThread, ResearchNodeDefinition } from "../types/cides";

interface PipelineRoadmapProps {
  thread: ProjectThread;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onOpenPromptManager: () => void;
}

export const PipelineRoadmap: React.FC<PipelineRoadmapProps> = ({
  thread,
  selectedNodeId,
  onSelectNode,
  onOpenPromptManager,
}) => {
  // Helper to determine node status
  const getNodeState = (node: ResearchNodeDefinition, index: number) => {
    // If intent is not confirmed, all nodes are locked
    if (!thread.isIntentConfirmed) {
      return { status: "locked", label: "基线未确立" };
    }

    const results = thread.phaseResults[node.id] || [];
    const hasConfirmed = results.some((r) => r.status === "confirmed");
    const hasCandidate = results.some((r) => r.status === "candidate" || r.status === "corrected");

    if (hasConfirmed) {
      return { status: "confirmed", label: "已人工确认" };
    }

    if (hasCandidate) {
      return { status: "candidate", label: "成果待确认" };
    }

    // Check predecessor requirement: index 0 is accessible once intent is confirmed
    if (index === 0) {
      return { status: "ready", label: "可开始研究" };
    }

    // Previous node must be confirmed
    const prevNode = thread.nodes[index - 1];
    const prevResults = thread.phaseResults[prevNode.id] || [];
    const prevConfirmed = prevResults.some((r) => r.status === "confirmed");

    if (prevConfirmed) {
      return { status: "ready", label: "就绪待启动" };
    }

    return { status: "locked", label: "前序待确认" };
  };

  const branchesForNode = (nodeId: string) => {
    return thread.activeBranches.filter((b) => b.parentNodeId === nodeId);
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-200 tracking-wider uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            CIDES 跨境投资专业研究主线
          </span>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            (逐层推进 · 严谨输入约束 · 专属提示词驱动)
          </span>
        </div>

        <button
          onClick={onOpenPromptManager}
          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors font-mono"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>管理全部节点提示词</span>
        </button>
      </div>

      {/* Horizontal Scrollable Pipeline Track */}
      <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
        <div className="flex items-center gap-2 min-w-max">
          {/* Baseline Step */}
          <div
            className={`p-3 rounded-xl border flex flex-col justify-between w-44 h-28 transition-all ${
              thread.isIntentConfirmed
                ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-300"
                : "bg-slate-800/60 border-slate-700 text-slate-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold uppercase">起点基线</span>
              {thread.isIntentConfirmed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Clock className="w-4 h-4 text-amber-400" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-100 truncate">投资意图与基线</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {thread.isIntentConfirmed ? "已正式锁定" : "待人工确认"}
              </p>
            </div>
            <div className="text-[9px] font-mono text-slate-400">
              12维度精准拆解
            </div>
          </div>

          <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

          {/* Research Nodes */}
          {thread.nodes.map((node, index) => {
            const { status, label } = getNodeState(node, index);
            const isSelected = selectedNodeId === node.id;
            const branches = branchesForNode(node.id);
            const isLocked = status === "locked";

            let borderStyle = "border-slate-800 bg-slate-900/80 text-slate-400";
            if (status === "confirmed") {
              borderStyle = "border-emerald-700/60 bg-emerald-950/20 text-emerald-300";
            } else if (status === "candidate") {
              borderStyle = "border-amber-500/70 bg-amber-950/20 text-amber-300 animate-pulse";
            } else if (status === "ready") {
              borderStyle = "border-blue-700/60 bg-blue-950/20 text-blue-300";
            }

            if (isSelected) {
              borderStyle += " ring-2 ring-amber-400/80 shadow-md shadow-amber-500/10";
            }

            return (
              <React.Fragment key={node.id}>
                <button
                  disabled={isLocked}
                  onClick={() => onSelectNode(node.id)}
                  className={`p-3 rounded-xl border flex flex-col justify-between w-48 h-28 text-left transition-all relative ${borderStyle} ${
                    isLocked ? "opacity-50 cursor-not-allowed" : "hover:border-amber-400/80 cursor-pointer"
                  }`}
                >
                  {/* Top line: index & status indicator */}
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-mono font-semibold text-slate-400">
                      环节 {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      {branches.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 text-[9px] font-mono flex items-center gap-0.5">
                          <GitBranch className="w-2.5 h-2.5" />
                          {branches.length}
                        </span>
                      )}
                      {status === "confirmed" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      {status === "candidate" && <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
                      {status === "ready" && <Clock className="w-3.5 h-3.5 text-blue-400" />}
                      {status === "locked" && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                    </div>
                  </div>

                  {/* Center: Title & Label */}
                  <div>
                    <p className="text-xs font-bold text-slate-100 line-clamp-1">
                      {node.name}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {label}
                    </p>
                  </div>

                  {/* Bottom: Prompt Version Badge (Mandatory Requirement) */}
                  <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                    <span className="text-amber-400/90 font-medium">
                      Prompt: {node.activePromptVersion}
                    </span>
                    <span className="text-slate-500">
                      {node.promptVersions.length}版本
                    </span>
                  </div>
                </button>

                {index < thread.nodes.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
