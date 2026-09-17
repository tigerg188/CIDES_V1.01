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
import { ExportArchiveModal } from "./components/ExportArchiveModal";
import { ProjectManagerModal } from "./components/ProjectManagerModal";
import {
  ProjectThread,
  ResearchNodeDefinition,
  PhaseResult,
  EvidenceItem,
  BranchItem,
  FinalDecisionRecord,
  BranchModificationType,
} from "./types/cides";
import { getInitialThread, saveThread, createNewThread, loadProjectById } from "./utils/storage";
import { useTheme } from "./context/ThemeContext";

export default function App() {
  const { isTraditional } = useTheme();
  const [thread, setThread] = useState<ProjectThread>(getInitialThread());
  const [currentView, setCurrentView] = useState<"intent" | "nodes" | "branches" | "audit">("intent");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("NODE_MACRO_ENTRY");

  // Modals state
  const [showPromptManager, setShowPromptManager] = useState(false);
  const [showAcceptanceSuite, setShowAcceptanceSuite] = useState(false);
  const [showFinalDecision, setShowFinalDecision] = useState(false);
  const [showExportArchiveModal, setShowExportArchiveModal] = useState(false);
  const [showProjectManagerModal, setShowProjectManagerModal] = useState(false);
  const [inspectingEvidence, setInspectingEvidence] = useState<EvidenceItem | null>(null);
  const [activeBranchModal, setActiveBranchModal] = useState<BranchItem | null>(null);

  // Re-evaluation loading state
  const [isReEvaluatingNode, setIsReEvaluatingNode] = useState(false);
  const [reEvaluatingMessage, setReEvaluatingMessage] = useState("");

  const handleCreateNewProject = () => {
    const fresh = createNewThread();
    setThread(fresh);
    saveThread(fresh);
    setCurrentView("intent");
  };

  const handleSelectProjectFromManager = (projectId: string) => {
    const loaded = loadProjectById(projectId);
    if (loaded) {
      setThread(loaded);
      setCurrentView("intent");
    }
  };

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

  const handleMergeBranch = async (
    branchId: string,
    modificationType: BranchModificationType,
    findingsMarkdown: string,
    recommendedAction: string,
    userNote: string = "专家已审核确认分支成果并核准带回主线",
    branchEvidences: any[] = []
  ) => {
    const targetBranch = thread.activeBranches.find((b) => b.id === branchId);
    const parentNodeId = targetBranch?.parentNodeId || selectedNodeId;
    const parentNode = thread.nodes.find((n) => n.id === parentNodeId);
    const existingNodeResults = thread.phaseResults[parentNodeId] || [];
    const latestOriginalResult = existingNodeResults[existingNodeResults.length - 1];

    // 1. Mark branch as merged with user review note
    const updatedBranches = thread.activeBranches.map((b) => {
      if (b.id === branchId) {
        return {
          ...b,
          status: "merged_to_mainline" as const,
          modificationType,
          findingsMarkdown,
          recommendedAction,
          evidences: branchEvidences && branchEvidences.length > 0 ? branchEvidences : b.evidences,
          userConfirmation: {
            type: "confirm" as const,
            confirmedAt: new Date().toISOString(),
            userNote,
          },
          completedAt: new Date().toISOString(),
        };
      }
      return b;
    });

    const mergeLog = {
      id: "log-" + Date.now(),
      timestamp: new Date().toISOString(),
      nodeId: parentNodeId,
      nodeName: `分支带回主线: ${targetBranch?.title || branchId}`,
      promptVersionUsed: parentNode?.activePromptVersion || "V1.0",
      type: "branch_merged" as const,
      message: `分支【${targetBranch?.title}】核验结论已带回主线。调整方式：【${modificationType}】。专家意见：${userNote}。系统正在触发 Google Gemini 进行主线重新推理...`,
    };

    const intermediateThread: ProjectThread = {
      ...thread,
      activeBranches: updatedBranches,
      executionLogs: [...thread.executionLogs, mergeLog],
    };

    handleUpdateThread(intermediateThread);
    setSelectedNodeId(parentNodeId);
    setCurrentView("nodes");
    setActiveBranchModal(null);

    // 2. Call backend /api/cides/re-evaluate-node to trigger real Gemini Re-reasoning
    setIsReEvaluatingNode(true);
    setReEvaluatingMessage(
      `正在由 Google Gemini 模型结合分支【${targetBranch?.title || "专项核验"}】新确证事实与专家批注，重新评估主线节点【${parentNode?.name || parentNodeId}】...`
    );

    try {
      const res = await fetch("/api/cides/re-evaluate-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: parentNodeId,
          nodeName: parentNode?.name || parentNodeId,
          projectBaseline: intermediateThread.baseline,
          originalResult: latestOriginalResult,
          branchResult: {
            branchId,
            title: targetBranch?.title,
            triggerReason: targetBranch?.triggerReason,
            findingsMarkdown,
            evidences: branchEvidences,
            modificationType,
            recommendedAction,
          },
          userConfirmation: {
            userNote,
            confirmedAt: new Date().toISOString(),
          },
        }),
      });

      const resText = await res.text();
      let json: any;
      try {
        json = JSON.parse(resText);
      } catch {
        throw new Error(`重新推理服务响应异常: ${resText.slice(0, 100)}`);
      }

      if (!json.success || !json.data) {
        throw new Error(json.error || "主线重新推理未返回预期数据");
      }

      const nextVersionNum = (latestOriginalResult ? latestOriginalResult.version : 1) + 1;
      const nextVersionLabel = `阶段成果 V${nextVersionNum} (分支核验后重新推理)`;

      const newPhaseResult: PhaseResult = {
        id: `pr-${parentNodeId.toLowerCase()}-${Date.now()}`,
        nodeId: parentNodeId,
        nodeName: parentNode?.name || parentNodeId,
        version: nextVersionNum,
        versionLabel: nextVersionLabel,
        status: "candidate", // Section 13: Must be candidate pending user confirmation
        promptVersionUsed: parentNode?.activePromptVersion || "V1.0",
        generatedAt: new Date().toISOString(),
        executiveSummary: json.data.executiveSummary,
        detailedFindingsMarkdown: json.data.detailedFindingsMarkdown,
        verifiedEvidences: json.data.verifiedEvidences || latestOriginalResult?.verifiedEvidences || [],
        criticalRisks: json.data.criticalRisks || latestOriginalResult?.criticalRisks || [],
        assumptionsValidated: json.data.assumptionsValidated || latestOriginalResult?.assumptionsValidated || [],
        proposedBranches: [],
        nextRecommendedStep: json.data.nextRecommendedStep || "请投资决策人审核重新推理成果并确认",
        reasoningRevision: json.data.reasoningRevision,
        parentExecutionId: json.executionRecord?.parentExecutionId,
        triggeredByBranchId: branchId,
        previousResultId: latestOriginalResult?.id,
        executionRecord: json.executionRecord,
        executionSource: "gemini",
      };

      const durationSec = json.executionRecord ? (json.executionRecord.durationMs / 1000).toFixed(1) : "数";

      const finalThread: ProjectThread = {
        ...intermediateThread,
        phaseResults: {
          ...intermediateThread.phaseResults,
          [parentNodeId]: [...existingNodeResults, newPhaseResult],
        },
        executionLogs: [
          ...intermediateThread.executionLogs,
          {
            id: "log-" + Date.now(),
            timestamp: new Date().toISOString(),
            nodeId: parentNodeId,
            nodeName: parentNode?.name || parentNodeId,
            promptVersionUsed: parentNode?.activePromptVersion || "V1.0",
            type: "node_rereason",
            message: `【${parentNode?.name}】已成功完成主线重新推理（耗时 ${durationSec}s），生成 ${nextVersionLabel}！分支结论已深度融合入案卷，请人工审查并确认为正式输入。`,
            executionRecord: json.executionRecord,
          },
        ],
      };

      handleUpdateThread(finalThread);
    } catch (err: any) {
      console.error("Re-evaluation error:", err);
      alert(`主线重新推理提醒：${err.message || "请求异常，请检查网络或稍后重试"}`);
    } finally {
      setIsReEvaluatingNode(false);
      setReEvaluatingMessage("");
    }
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
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isTraditional
          ? "bg-[#f8f9fa] text-[#202124] selection:bg-blue-500 selection:text-white"
          : "bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950"
      }`}
    >
      {/* Sticky Top Header */}
      <Header
        thread={thread}
        onThreadUpdate={handleUpdateThread}
        onOpenPromptManager={() => setShowPromptManager(true)}
        onOpenAcceptanceSuite={() => setShowAcceptanceSuite(true)}
        onOpenFinalDecision={() => setShowFinalDecision(true)}
        onOpenExportArchive={() => setShowExportArchiveModal(true)}
        onOpenProjectManager={() => setShowProjectManagerModal(true)}
        onNewProject={handleCreateNewProject}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Re-evaluation Live Banner */}
        {isReEvaluatingNode && (
          <div className="p-4 rounded-2xl bg-purple-950/90 border border-purple-500/80 shadow-lg shadow-purple-950/50 flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
              <div>
                <span className="text-xs font-bold text-purple-100 block">
                  【分支成果并入中】Google Gemini 模型正在重构主线节点研判成果...
                </span>
                <p className="text-[11px] text-purple-200/90">{reEvaluatingMessage}</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-purple-900 border border-purple-700 text-purple-200 shrink-0">
              gemini-3.8-flash
            </span>
          </div>
        )}

        {/* Navigation Bar */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 transition-colors ${
            isTraditional ? "border-gray-200" : "border-slate-800"
          }`}
        >
          <nav className="flex items-center gap-1.5 text-xs font-bold">
            <button
              onClick={() => setCurrentView("intent")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                currentView === "intent"
                  ? isTraditional
                    ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20"
                    : "bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20"
                  : isTraditional
                  ? "bg-white text-gray-900 hover:bg-gray-100 border border-gray-300"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>投资意图与基线</span>
              {thread.isIntentConfirmed && (
                <span className={`w-2 h-2 rounded-full ${currentView === "intent" ? "bg-white" : "bg-emerald-500"}`} />
              )}
            </button>

            <button
              onClick={() => setCurrentView("nodes")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                currentView === "nodes"
                  ? isTraditional
                    ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20"
                    : "bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20"
                  : isTraditional
                  ? "bg-white text-gray-900 hover:bg-gray-100 border border-gray-300"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>节点研究主线</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                currentView === "nodes"
                  ? isTraditional ? "bg-blue-700 text-white" : "bg-slate-950/20 text-slate-950"
                  : isTraditional ? "bg-blue-100 text-blue-800" : "bg-slate-800 text-amber-400"
              }`}>
                {thread.nodes.length}环节
              </span>
            </button>

            <button
              onClick={() => setCurrentView("branches")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                currentView === "branches"
                  ? isTraditional
                    ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20"
                    : "bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20"
                  : isTraditional
                  ? "bg-white text-gray-900 hover:bg-gray-100 border border-gray-300"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>动态分支深挖</span>
              {thread.activeBranches.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  currentView === "branches"
                    ? isTraditional ? "bg-blue-700 text-white" : "bg-slate-950 text-amber-400"
                    : isTraditional ? "bg-purple-100 text-purple-900" : "bg-purple-900/60 text-purple-300"
                }`}>
                  {thread.activeBranches.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentView("audit")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                currentView === "audit"
                  ? isTraditional
                    ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20"
                    : "bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20"
                  : isTraditional
                  ? "bg-white text-gray-900 hover:bg-gray-100 border border-gray-300"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <History className="w-4 h-4" />
              <span>运行追溯日志</span>
              <span className={`text-[10px] font-mono font-bold ${
                currentView === "audit"
                  ? isTraditional ? "text-blue-100" : "text-slate-950"
                  : isTraditional ? "text-gray-800" : "text-slate-500"
              }`}>
                ({thread.executionLogs.length})
              </span>
            </button>
          </nav>

          {/* Quick Status Info */}
          <div className="text-xs flex items-center gap-2 font-mono">
            {thread.finalDecision ? (
              <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                isTraditional
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
              }`}>
                <CheckCircle2 className="w-3 h-3" />
                决议已签署: {thread.finalDecision.decision.toUpperCase()}
              </span>
            ) : thread.isIntentConfirmed ? (
              <span className={`flex items-center gap-1 ${isTraditional ? "text-emerald-700" : "text-emerald-400/90"}`}>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                基线锁定 · 正在主线推演
              </span>
            ) : (
              <span className={`flex items-center gap-1 ${isTraditional ? "text-amber-700" : "text-amber-400/90"}`}>
                <Clock className="w-3.5 h-3.5 text-amber-500" />
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
            <div
              className={`p-5 rounded-2xl border space-y-2 transition-colors ${
                isTraditional
                  ? "bg-white border-gray-300 text-gray-900 shadow-xs"
                  : "bg-slate-900 border-slate-800 text-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className={`w-5 h-5 ${isTraditional ? "text-purple-700" : "text-purple-400"}`} />
                  <h2 className="text-base font-bold">
                    动态分支深挖研究管理中心 (CIDES 第十六至二十节)
                  </h2>
                </div>
                <span className={`text-xs font-mono font-bold ${isTraditional ? "text-gray-700" : "text-slate-400"}`}>
                  共计 {thread.activeBranches.length} 个分支专项
                </span>
              </div>
              <p className={`text-xs max-w-4xl leading-relaxed font-medium ${isTraditional ? "text-gray-800" : "text-slate-400"}`}>
                分支是主线研究遭遇重大未知、数据源冲突、关键假设被推翻或重大不可抗力时生成的针对性深挖模块。
                <strong className={`font-bold ${isTraditional ? "text-purple-800" : "text-purple-300"}`}> 分支研究成果必须带回主线，并有权确认、修改、限制或推翻主线原有判断。</strong>
              </p>
            </div>

            {thread.activeBranches.length === 0 ? (
              <div
                className={`p-12 rounded-2xl border text-center space-y-2 transition-colors ${
                  isTraditional
                    ? "bg-white border-gray-300 text-gray-800 shadow-xs"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                <GitBranch className={`w-8 h-8 mx-auto ${isTraditional ? "text-gray-500" : "text-slate-600"}`} />
                <p className="text-xs font-medium">暂无活跃分支。在主线各节点研究过程中，若识别出关键要素矛盾，将自动提议生成分支。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {thread.activeBranches.map((branch) => {
                  const isMerged = branch.status === "merged_to_mainline";
                  return (
                    <div
                      key={branch.id}
                      className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-colors ${
                        isTraditional
                          ? "bg-white border-gray-300 text-gray-900 shadow-xs"
                          : "bg-slate-900 border-slate-800 text-slate-100"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold">{branch.title}</h3>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 border ${
                              isMerged
                                ? isTraditional
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                  : "bg-emerald-950 text-emerald-300 border-emerald-800"
                                : isTraditional
                                ? "bg-purple-100 text-purple-900 border-purple-300"
                                : "bg-purple-950 text-purple-300 border-purple-800"
                            }`}
                          >
                            {isMerged ? "已带回主线" : "待执行深挖"}
                          </span>
                        </div>

                        <div className={`text-xs space-y-1 font-medium ${isTraditional ? "text-gray-800" : "text-slate-400"}`}>
                          <p><strong>所属主线节点：</strong><span className={isTraditional ? "text-gray-900" : "text-slate-200"}>{branch.parentNodeName || branch.parentNodeId}</span></p>
                          <p><strong>触发类型：</strong><span className={`font-mono font-bold ${isTraditional ? "text-amber-800" : "text-amber-400"}`}>{branch.triggerType}</span></p>
                          <p><strong>触发动因：</strong><span className={isTraditional ? "text-gray-900" : "text-slate-200"}>{branch.triggerReason}</span></p>
                          <p><strong>对主线预期影响：</strong><span className={isTraditional ? "text-gray-900" : "text-slate-200"}>{branch.impactOnMainline}</span></p>
                        </div>

                        {branch.modificationType && (
                          <div
                            className={`p-2.5 rounded-lg border text-xs font-mono font-bold ${
                              isTraditional
                                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                : "bg-slate-950 border border-slate-800 text-emerald-400/90"
                            }`}
                          >
                            主线调整决策：{branch.modificationType}
                          </div>
                        )}
                      </div>

                      <div
                        className={`pt-3 border-t flex items-center justify-between ${
                          isTraditional ? "border-gray-200" : "border-slate-800"
                        }`}
                      >
                        <span className={`text-[11px] font-mono ${isTraditional ? "text-gray-600" : "text-slate-500"}`}>
                          创建时间: {new Date(branch.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => setActiveBranchModal(branch)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border ${
                            isTraditional
                              ? "bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-300"
                              : "text-purple-200 bg-purple-950/70 hover:bg-purple-900/80 border-purple-800/80"
                          }`}
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
            <div
              className={`p-5 rounded-2xl border space-y-1 transition-colors ${
                isTraditional
                  ? "bg-white border-gray-300 text-gray-900 shadow-xs"
                  : "bg-slate-900 border-slate-800 text-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className={`w-5 h-5 ${isTraditional ? "text-blue-600" : "text-amber-400"}`} />
                  <h2 className="text-base font-bold">
                    系统不可篡改审计与执行日志 (CIDES 第二十八及四十二节)
                  </h2>
                </div>
                <span className={`text-xs font-mono font-bold ${isTraditional ? "text-blue-700" : "text-slate-400"}`}>
                  严格记录提示词版本使用轨迹
                </span>
              </div>
              <p className={`text-xs leading-relaxed font-medium ${isTraditional ? "text-gray-800" : "text-slate-400"}`}>
                全链路追踪投资意图识别、基线确认、节点执行所用 Prompt 版本、人工确认/纠偏批注、分支合并与投委会签署记录。
              </p>
            </div>

            <div
              className={`p-4 rounded-2xl border space-y-2 max-h-[600px] overflow-y-auto font-mono text-xs transition-colors ${
                isTraditional
                  ? "bg-white border-gray-300 text-gray-900 shadow-xs"
                  : "bg-slate-900 border-slate-800 text-slate-100"
              }`}
            >
              {thread.executionLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    isTraditional
                      ? "bg-gray-50 border-gray-300 hover:border-blue-400 text-gray-900"
                      : "bg-slate-950 border-slate-800/80 hover:border-slate-700/80 text-slate-200"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                          isTraditional
                            ? "bg-gray-200 text-gray-900"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {log.nodeName}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          isTraditional ? "text-blue-700" : "text-amber-400"
                        }`}
                      >
                        [{log.promptVersionUsed}]
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed font-sans font-medium ${isTraditional ? "text-gray-900" : "text-slate-200"}`}>
                      {log.message}
                    </p>
                    {log.executionRecord && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded border font-mono font-bold ${
                            isTraditional
                              ? "bg-white border-gray-300 text-blue-800"
                              : "bg-slate-900 border-slate-800 text-amber-300"
                          }`}
                        >
                          {log.executionRecord.provider || "Gemini"} · {log.executionRecord.model || "3.8-flash"}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded border font-mono font-bold ${
                            isTraditional
                              ? "bg-white border-gray-300 text-gray-800"
                              : "bg-slate-900 border-slate-800 text-slate-300"
                          }`}
                        >
                          耗时: {(log.executionRecord.durationMs / 1000).toFixed(1)}s
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded border font-mono font-bold ${
                            log.executionRecord.searchExecuted
                              ? isTraditional
                                ? "bg-emerald-100 border-emerald-300 text-emerald-900"
                                : "bg-emerald-950/60 border-emerald-800/60 text-emerald-300"
                              : isTraditional
                              ? "bg-white border-gray-300 text-gray-800"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          搜索核验: {log.executionRecord.searchExecuted ? "已执行真实搜索" : "基于专业知识"}
                        </span>
                        {log.executionRecord.tokens?.totalTokens ? (
                          <span
                            className={`px-1.5 py-0.5 rounded border font-mono font-bold ${
                              isTraditional
                                ? "bg-white border-gray-300 text-gray-800"
                                : "bg-slate-900 border-slate-800 text-slate-300"
                            }`}
                          >
                            Tokens: {log.executionRecord.tokens.totalTokens}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] shrink-0 font-mono font-medium ${isTraditional ? "text-gray-700" : "text-slate-500"}`}>
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

      {showExportArchiveModal && (
        <ExportArchiveModal
          thread={thread}
          onThreadUpdate={handleUpdateThread}
          onClose={() => setShowExportArchiveModal(false)}
        />
      )}

      {showProjectManagerModal && (
        <ProjectManagerModal
          isOpen={showProjectManagerModal}
          currentThread={thread}
          onClose={() => setShowProjectManagerModal(false)}
          onSelectProject={handleSelectProjectFromManager}
          onNewProject={handleCreateNewProject}
        />
      )}
    </div>
  );
}
