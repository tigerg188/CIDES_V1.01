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
import { useTheme } from "../context/ThemeContext";

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
  const { isTraditional } = useTheme();

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
    <div
      className={`p-4 rounded-2xl border shadow-xs space-y-3 transition-colors ${
        isTraditional
          ? "bg-white border-gray-300 text-gray-900"
          : "bg-slate-900 border-slate-800 text-slate-100"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 ${
              isTraditional ? "text-gray-900" : "text-slate-200"
            }`}
          >
            <span className={`w-2 h-2 rounded-full animate-pulse ${isTraditional ? "bg-blue-600" : "bg-amber-400"}`} />
            CIDES 跨境投资专业研究主线
          </span>
          <span className={`text-[11px] hidden md:inline ${isTraditional ? "text-gray-700" : "text-slate-400"}`}>
            (逐层推进 · 严谨输入约束 · 专属提示词驱动)
          </span>
        </div>

        <button
          onClick={onOpenPromptManager}
          className={`text-xs flex items-center gap-1 transition-colors font-mono font-bold ${
            isTraditional ? "text-blue-700 hover:text-blue-900" : "text-amber-400 hover:text-amber-300"
          }`}
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
            className={`p-3 rounded-xl border flex flex-col justify-between w-44 xl:w-48 2xl:w-52 h-28 transition-all ${
              thread.isIntentConfirmed
                ? isTraditional
                  ? "bg-emerald-50/90 border-emerald-300 text-emerald-950"
                  : "bg-emerald-950/30 border-emerald-800/60 text-emerald-300"
                : isTraditional
                ? "bg-gray-50 border-gray-300 text-gray-700"
                : "bg-slate-800/60 border-slate-700 text-slate-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-mono font-bold uppercase ${isTraditional ? "text-gray-700" : "text-slate-400"}`}>起点基线</span>
              {thread.isIntentConfirmed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Clock className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <div>
              <p className={`text-xs font-bold truncate ${isTraditional ? "text-gray-900" : "text-slate-100"}`}>投资意图与基线</p>
              <p className={`text-[10px] mt-0.5 font-medium ${isTraditional ? "text-gray-700" : "text-slate-400"}`}>
                {thread.isIntentConfirmed ? "已正式锁定" : "待人工确认"}
              </p>
            </div>
            <div className={`text-[9px] font-mono font-medium ${isTraditional ? "text-gray-600" : "text-slate-400"}`}>
              12维度精准拆解
            </div>
          </div>

          <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${isTraditional ? "text-gray-400" : "text-slate-600"}`} />

          {/* Research Nodes */}
          {thread.nodes.map((node, index) => {
            const { status, label } = getNodeState(node, index);
            const isSelected = selectedNodeId === node.id;
            const branches = branchesForNode(node.id);
            const isLocked = status === "locked";

            let borderStyle = isTraditional
              ? "border-gray-300 bg-white text-gray-700"
              : "border-slate-800 bg-slate-900/80 text-slate-400";

            if (status === "confirmed") {
              borderStyle = isTraditional
                ? "border-emerald-300 bg-emerald-50/80 text-emerald-950"
                : "border-emerald-700/60 bg-emerald-950/20 text-emerald-300";
            } else if (status === "candidate") {
              borderStyle = isTraditional
                ? "border-amber-400 bg-amber-50/80 text-amber-950 animate-pulse"
                : "border-amber-500/70 bg-amber-950/20 text-amber-300 animate-pulse";
            } else if (status === "ready") {
              borderStyle = isTraditional
                ? "border-blue-300 bg-blue-50/70 text-blue-950"
                : "border-blue-700/60 bg-blue-950/20 text-blue-300";
            }

            if (isSelected) {
              borderStyle += isTraditional
                ? " ring-2 ring-blue-600 shadow-md shadow-blue-500/10"
                : " ring-2 ring-amber-400/80 shadow-md shadow-amber-500/10";
            }

            return (
              <React.Fragment key={node.id}>
                <button
                  disabled={isLocked}
                  onClick={() => onSelectNode(node.id)}
                  className={`p-3 rounded-xl border flex flex-col justify-between w-44 xl:w-48 2xl:w-52 h-28 text-left transition-all relative ${borderStyle} ${
                    isLocked
                      ? "opacity-50 cursor-not-allowed"
                      : isTraditional
                      ? "hover:border-blue-600 cursor-pointer"
                      : "hover:border-amber-400/80 cursor-pointer"
                  }`}
                >
                  {/* Top line: index & status indicator */}
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[10px] font-mono font-bold ${isTraditional ? "text-gray-700" : "text-slate-400"}`}>
                      环节 {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      {branches.length > 0 && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono flex items-center gap-0.5 ${
                          isTraditional ? "bg-purple-100 text-purple-800" : "bg-purple-900/60 text-purple-300"
                        }`}>
                          <GitBranch className="w-2.5 h-2.5" />
                          {branches.length}
                        </span>
                      )}
                      {status === "confirmed" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      {status === "candidate" && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                      {status === "ready" && <Clock className="w-3.5 h-3.5 text-blue-600" />}
                      {status === "locked" && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                    </div>
                  </div>

                  {/* Center: Title & Label */}
                  <div>
                    <p className={`text-xs font-bold line-clamp-1 ${isTraditional ? "text-gray-900" : "text-slate-100"}`}>
                      {node.name}
                    </p>
                    <p className={`text-[10px] mt-0.5 truncate font-medium ${isTraditional ? "text-gray-700" : "text-slate-400"}`}>
                      {label}
                    </p>
                  </div>

                  {/* Bottom: Prompt Version Badge */}
                  <div className={`flex items-center justify-between w-full text-[9px] font-mono pt-1 border-t ${
                    isTraditional ? "border-gray-200 text-gray-700" : "border-slate-800/60 text-slate-400"
                  }`}>
                    <span className={`font-bold ${isTraditional ? "text-blue-700" : "text-amber-400/90"}`}>
                      Prompt: {node.activePromptVersion}
                    </span>
                    <span className={isTraditional ? "text-gray-600" : "text-slate-500"}>
                      {node.promptVersions.length}版本
                    </span>
                  </div>
                </button>

                {index < thread.nodes.length - 1 && (
                  <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${isTraditional ? "text-gray-400" : "text-slate-600"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
