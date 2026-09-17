import React, { useState, useEffect } from "react";
import {
  BrainCircuit,
  Compass,
  GitBranch,
  FileCheck,
  ShieldCheck,
  Award,
  Sliders,
  History,
  FolderArchive,
  ArrowRight,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
} from "lucide-react";
import { Header } from "./components/Header";
import { IntentWorkspace } from "./components/IntentWorkspace";
import { PipelineRoadmap } from "./components/PipelineRoadmap";
import { NodeResearchView } from "./components/NodeResearchView";
import { PromptManagerModal } from "./components/PromptManagerModal";
import { AcceptanceSuiteModal } from "./components/AcceptanceSuiteModal";
import { FinalDecisionModal } from "./components/FinalDecisionModal";
import { EvidenceInspectorModal } from "./components/EvidenceInspectorModal";
import { BranchResearchModal } from "./components/BranchResearchModal";
import {
  ProjectThread,
  ResearchNodeDefinition,
  EvidenceItem,
  BranchItem,
  FinalDecisionRecord,
  BranchModificationType,
} from "./types/cides";
import { getInitialThread, saveThread } from "./utils/storage";

export default function App() {
  const [thread, setThread] = useState<ProjectThread>(getInitialThread());
  const [currentView, setCurrentView] = useState<"intent" | "nodes" | "branches" | "audit">("intent");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("NODE_MACRO_ENTRY");

  // Modals state
  const [showPromptManager, setShowPromptManager] = useState(false);
  const [showAcceptanceSuite, setShowAcceptanceSuite] = useState(false);
  const [showFinalDecision, setShowFinalDecision] = useState(false);
  const [inspectingEvidence, setInspectingEvidence] = useState<EvidenceItem | null>(null);
  const [activeBranchModal, setActiveBranchModal] = useState<BranchItem | null>(null);

  // Sync state changes to storage
  const handleUpdateThread = (updated: ProjectThread) => {
    setThread(updated);
    saveThread(updated);
  };

  // If baseline is locked, default to nodes view if user clicks "推进"
  const handleProceedToNodes = () => {
    setCurrentView("nodes");
  };

  const handleUpdateNodesFromPromptManager = (
    updatedNodes: ResearchNodeDefinition[],
    logMessage?: string
  ) => {
    const updated: ProjectThread = {
      ...thread,
      nodes: updatedNodes,
      executionLogs: logMessage
        ? [
            ...thread.executionLogs,
            {
              id: "log-" + Date.now(),
              timestamp: new Date().toISOString(),
              nodeId: "PROMPT_MANAGER",
              nodeName: "提示词资产管理器",
              promptVersionUsed: "V1.x",
              type: "prompt_edited",
              message: logMessage,
            },
          ]
        : thread.executionLogs,
    };
    handleUpdateThread(updated);
  };

  const handleMergeBranch = (
    branchId: string,
    modificationType: BranchModificationType,
    findingsMarkdown: string,
    recommendedAction: string
  ) => {
    const updatedBranches = thread.activeBranches.map((b) => {
      if (b.id === branchId) {
        return {
          ...b,
          status: "merged_to_mainline" as const,
          modificationType,
          findingsMarkdown,
          recommendedAction,
          completedAt: new Date().toISOString(),
        };
      }
      return b;
    });

    const targetBranch = thread.activeBranches.find((b) => b.id === branchId);

    const updated: ProjectThread = {
      ...thread,
      activeBranches: updatedBranches,
      executionLogs: [
        ...thread.executionLogs,
        {
          id: "log-" + Date.now(),
          timestamp: new Date().toISOString(),
          nodeId: targetBranch?.parentNodeId || "BRANCH_MERGER",
          nodeName: `分支带回主线: ${targetBranch?.title || branchId}`,
          promptVersionUsed: "V1.0",
          type: "branch_merged",
          message: `分支【${targetBranch?.title}】完成核验并带回主线。调整方式：【${modificationType}】。后续动作：${recommendedAction}`,
        },
      ],
    };

    handleUpdateThread(updated);
  };

  const handleSaveDecision = (decision: FinalDecisionRecord) => {
    const updated: ProjectThread = {
      ...thread,
      finalDecision: decision,
      executionLogs: [
        ...thread.executionLogs,
        {
          id: "log-" + Date.now(),
          timestamp: new Date().toISOString(),
          nodeId: "HUMAN_DECISION_DESK",
          nodeName: "投委会最终决议案",
          promptVersionUsed: "N/A",
          type: "user_confirm",
          message: `投委会已正式签署投资决策：【${decision.decision.toUpperCase()}】。签署人：${decision.decidedBy}。限额：${decision.maxInvestmentLimitUSD || "未设限"}。`,
        },
      ],
    };
    handleUpdateThread(updated);
  };

  const currentNode = thread.nodes.find((n) => n.id === selectedNodeId) || thread.nodes[0];

  const handleNavigateToNext = () => {
    const idx = thread.nodes.findIndex((n) => n.id === selectedNodeId);
    if (idx >= 0 && idx < thread.nodes.length - 1) {
      setSelectedNodeId(thread.nodes[idx + 1].id);
    } else {
      setShowFinalDecision(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Sticky Top Header */}
      <Header
        thread={thread}
        onThreadUpdate={handleUpdateThread}
        onOpenPromptManager={() => setShowPromptManager(true)}
        onOpenAcceptanceSuite={() => setShowAcceptanceSuite(true)}
        onOpenFinalDecision={() => setShowFinalDecision(true)}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <nav className="flex items-center gap-1.5 text-xs font-medium">
            <button
              onClick={() => setCurrentView("intent")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                currentView === "intent"
                  ? "bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>投资意图与基线</span>
              {thread.isIntentConfirmed && (
                <span className={`w-2 h-2 rounded-full ${currentView === "intent" ? "bg-slate-950" : "bg-emerald-400"}`} />
              )}
            </button>

            <button
              onClick={() => setCurrentView("nodes")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                currentView === "nodes"
                  ? "bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>节点研究主线</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                currentView === "nodes" ? "bg-slate-950/20 text-slate-950" : "bg-slate-800 text-amber-400"
              }`}>
                {thread.nodes.length}环节
              </span>
            </button>

            <button
              onClick={() => setCurrentView("branches")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                currentView === "branches"
                  ? "bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>动态分支深挖</span>
              {thread.activeBranches.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  currentView === "branches" ? "bg-slate-950 text-amber-400" : "bg-purple-900/60 text-purple-300"
                }`}>
                  {thread.activeBranches.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentView("audit")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                currentView === "audit"
                  ? "bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <History className="w-4 h-4" />
              <span>运行追溯日志</span>
              <span className={`text-[10px] font-mono ${
                currentView === "audit" ? "text-slate-950" : "text-slate-500"
              }`}>
                ({thread.executionLogs.length})
              </span>
            </button>
          </nav>

          {/* Quick Status Info */}
          <div className="text-xs text-slate-400 flex items-center gap-2 font-mono">
            {thread.finalDecision ? (
              <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                决议已签署: {thread.finalDecision.decision.toUpperCase()}
              </span>
            ) : thread.isIntentConfirmed ? (
              <span className="text-emerald-400/90 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                基线锁定 · 正在主线推演
              </span>
            ) : (
              <span className="text-amber-400/90 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                等待确认初始意图
              </span>
            )}
          </div>
        </div>

        {/* VIEW 1: Intent & Baseline Workspace */}
        {currentView === "intent" && (
          <IntentWorkspace
            thread={thread}
            onThreadUpdate={handleUpdateThread}
            onProceedToNodes={handleProceedToNodes}
          />
        )}

        {/* VIEW 2: Node-based Research Pipeline */}
        {currentView === "nodes" && (
          <div className="space-y-6">
            {/* Top Pipeline Stepper */}
            <PipelineRoadmap
              thread={thread}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
              onOpenPromptManager={() => setShowPromptManager(true)}
            />

            {/* Active Node Workspace */}
            {currentNode && (
              <NodeResearchView
                node={currentNode}
                thread={thread}
                onOpenPromptManager={() => setShowPromptManager(true)}
                onInspectEvidence={(evidence) => setInspectingEvidence(evidence)}
                onOpenBranch={(branch) => setActiveBranchModal(branch)}
                onThreadUpdate={handleUpdateThread}
                onNavigateToNextNode={handleNavigateToNext}
              />
            )}
          </div>
        )}

        {/* VIEW 3: Dynamic Branches Center */}
        {currentView === "branches" && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-purple-400" />
                  <h2 className="text-base font-bold text-slate-100">
                    动态分支深挖研究管理中心 (CIDES 第十六至二十节)
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  共计 {thread.activeBranches.length} 个分支专项
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-4xl leading-relaxed">
                分支是主线研究遭遇重大未知、数据源冲突、关键假设被推翻或重大不可抗力时生成的针对性深挖模块。
                <strong className="text-purple-300 font-normal"> 分支研究成果必须带回主线，并有权确认、修改、限制或推翻主线原有判断。</strong>
              </p>
            </div>

            {thread.activeBranches.length === 0 ? (
              <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2 text-slate-400">
                <GitBranch className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs">暂无活跃分支。在主线各节点研究过程中，若识别出关键要素矛盾，将自动提议生成分支。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {thread.activeBranches.map((branch) => {
                  const isMerged = branch.status === "merged_to_mainline";
                  return (
                    <div
                      key={branch.id}
                      className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-100">{branch.title}</h3>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                              isMerged
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : "bg-purple-950 text-purple-300 border border-purple-800"
                            }`}
                          >
                            {isMerged ? "已带回主线" : "待执行深挖"}
                          </span>
                        </div>

                        <div className="text-xs text-slate-400 space-y-1">
                          <p><strong>所属主线节点：</strong>{branch.parentNodeName || branch.parentNodeId}</p>
                          <p><strong>触发类型：</strong><span className="font-mono text-amber-400">{branch.triggerType}</span></p>
                          <p><strong>触发动因：</strong>{branch.triggerReason}</p>
                          <p><strong>对主线预期影响：</strong>{branch.impactOnMainline}</p>
                        </div>

                        {branch.modificationType && (
                          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-emerald-400/90 font-mono">
                            主线调整决策：{branch.modificationType}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-mono">
                          创建时间: {new Date(branch.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => setActiveBranchModal(branch)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-purple-200 bg-purple-950/70 hover:bg-purple-900/80 border border-purple-800/80 flex items-center gap-1.5 transition-colors"
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                          <span>{isMerged ? "查看分支成果与结论" : "进入分支深度核查"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: Audit & Execution Logs */}
        {currentView === "audit" && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-bold text-slate-100">
                    系统不可篡改审计与执行日志 (CIDES 第二十八及四十二节)
                  </h2>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  严格记录提示词版本使用轨迹
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                全链路追踪投资意图识别、基线确认、节点执行所用 Prompt 版本、人工确认/纠偏批注、分支合并与投委会签署记录。
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 max-h-[600px] overflow-y-auto font-mono text-xs">
              {thread.executionLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {log.nodeName}
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono">
                        [{log.promptVersionUsed}]
                      </span>
                    </div>
                    <p className="text-slate-200 text-xs leading-relaxed">{log.message}</p>
                    {log.executionRecord && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-slate-400">
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300 font-mono">
                          {log.executionRecord.provider || "Gemini"} · {log.executionRecord.model || "3.8-flash"}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                          耗时: {(log.executionRecord.durationMs / 1000).toFixed(1)}s
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border font-mono ${
                          log.executionRecord.searchExecuted
                            ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-300"
                            : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}>
                          搜索核验: {log.executionRecord.searchExecuted ? "已执行真实搜索" : "基于专业知识"}
                        </span>
                        {log.executionRecord.tokens?.totalTokens ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                            Tokens: {log.executionRecord.tokens.totalTokens}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                    {new Date(log.timestamp).toLocaleString("zh-CN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {showPromptManager && (
        <PromptManagerModal
          thread={thread}
          selectedNodeId={selectedNodeId}
          onClose={() => setShowPromptManager(false)}
          onUpdateNodes={handleUpdateNodesFromPromptManager}
        />
      )}

      {showAcceptanceSuite && (
        <AcceptanceSuiteModal
          thread={thread}
          onClose={() => setShowAcceptanceSuite(false)}
          onOpenPromptManager={() => {
            setShowAcceptanceSuite(false);
            setShowPromptManager(true);
          }}
        />
      )}

      {showFinalDecision && (
        <FinalDecisionModal
          thread={thread}
          onClose={() => setShowFinalDecision(false)}
          onSaveDecision={handleSaveDecision}
        />
      )}

      {inspectingEvidence && (
        <EvidenceInspectorModal
          evidence={inspectingEvidence}
          onClose={() => setInspectingEvidence(null)}
        />
      )}

      {activeBranchModal && (
        <BranchResearchModal
          branch={activeBranchModal}
          thread={thread}
          onClose={() => setActiveBranchModal(null)}
          onMergeBranchToMainline={handleMergeBranch}
        />
      )}
    </div>
  );
}
