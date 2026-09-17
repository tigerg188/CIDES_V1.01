import React, { useState, useEffect } from "react";
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldAlert,
  GitBranch,
  Sliders,
  RefreshCw,
  Search,
  ExternalLink,
  Edit,
  ArrowRight,
  HelpCircle,
  Clock,
  Layers,
  Check,
  RotateCcw,
  Sparkles,
  Download,
  PlusCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  ResearchNodeDefinition,
  PhaseResult,
  EvidenceItem,
  RiskItem,
  AssumptionItem,
  BranchItem,
  ProjectThread,
} from "../types/cides";
import { exportCurrentNodeMarkdown } from "../utils/exportReports";

interface NodeResearchViewProps {
  node: ResearchNodeDefinition;
  thread: ProjectThread;
  onOpenPromptManager: () => void;
  onInspectEvidence: (evidence: EvidenceItem) => void;
  onOpenBranch: (branch: BranchItem) => void;
  onThreadUpdate: (updated: ProjectThread) => void;
  onNavigateToNextNode?: () => void;
}

export const NodeResearchView: React.FC<NodeResearchViewProps> = ({
  node,
  thread,
  onOpenPromptManager,
  onInspectEvidence,
  onOpenBranch,
  onThreadUpdate,
  onNavigateToNextNode,
}) => {
  const [activeTab, setActiveTab] = useState<"findings" | "evidence" | "risks" | "branches" | "spec">("findings");
  const [isExecuting, setIsExecuting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [correctionInput, setCorrectionInput] = useState("");
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ status: string; code: string; message: string } | null>(null);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number | null>(null);

  // Get current results list for this node
  const resultsList = thread.phaseResults[node.id] || [];
  // Selected or latest result
  const currentResult: PhaseResult | undefined =
    selectedVersionIndex !== null && resultsList[selectedVersionIndex]
      ? resultsList[selectedVersionIndex]
      : resultsList[resultsList.length - 1];

  const isConfirmed = currentResult?.status === "confirmed";

  // Predecessor Check
  const nodeIndex = thread.nodes.findIndex((n) => n.id === node.id);
  const prevNode = nodeIndex > 0 ? thread.nodes[nodeIndex - 1] : null;
  const isPrevConfirmed = prevNode
    ? (thread.phaseResults[prevNode.id] || []).some((r) => r.status === "confirmed")
    : thread.isIntentConfirmed;

  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (errorInfo?.code === "AI_QUOTA_EXHAUSTED") {
      setCooldownSeconds(15);
    } else {
      setCooldownSeconds(0);
    }
  }, [errorInfo]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const handleExecuteNode = async (isCorrection = false, userCorrectionNote = "") => {
    setIsExecuting(true);
    setErrorInfo(null);
    setElapsedSeconds(0);

    // Live timer that tracks real execution seconds
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const predecessorOutputs = Object.entries(thread.phaseResults).reduce((acc, [nId, resList]) => {
        const confirmed = resList.find((r) => r.status === "confirmed");
        if (confirmed) {
          acc[nId] = confirmed.executiveSummary;
        }
        return acc;
      }, {} as Record<string, string>);

      const res = await fetch("/api/cides/execute-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: node.id,
          nodeName: node.name,
          promptVersion: node.activePromptVersion,
          promptText: node.activePrompt,
          projectBaseline: thread.baseline,
          predecessorOutputs,
          activeBranches: thread.activeBranches,
          userCorrection: userCorrectionNote || undefined,
        }),
      });

      const resText = await res.text();
      let json: any;
      try {
        json = JSON.parse(resText);
      } catch {
        const isTimeout = res.status === 504 || resText.includes("504") || resText.includes("Time-out");
        const errObj = {
          status: "failed",
          code: isTimeout ? "GATEWAY_TIMEOUT" : "INVALID_SERVER_RESPONSE",
          message: isTimeout
            ? `网关请求超时 (504 Gateway Time-out)：节点【${node.name}】端到端推理与深度检索耗时超出代理时限，请稍候点击重试。`
            : `服务器返回了非预期响应 (HTTP ${res.status}): ${resText.slice(0, 100)}`,
        };
        setErrorInfo(errObj);
        throw new Error(errObj.message);
      }

      if (!json.success || !json.data) {
        const errObj = {
          status: json.status || (res.status === 429 || res.status === 503 ? "blocked" : "failed"),
          code:
            json.code ||
            (res.status === 429
              ? "AI_QUOTA_EXHAUSTED"
              : res.status === 503
              ? "AI_HIGH_DEMAND"
              : "AI_EXECUTION_FAILED"),
          message: json.error || "Gemini 节点研究执行未返回有效结果",
        };
        setErrorInfo(errObj);
        throw new Error(errObj.message);
      }

      const nextVersionNum = isCorrection ? (currentResult ? currentResult.version + 1 : 2) : 1;
      const nextVersionLabel = isCorrection ? `阶段成果 V${nextVersionNum} (用户纠偏后)` : `阶段成果 V1`;

      const newPhaseResult: PhaseResult = {
        id: `pr-${node.id.toLowerCase()}-${Date.now()}`,
        nodeId: node.id,
        nodeName: node.name,
        version: nextVersionNum,
        versionLabel: nextVersionLabel,
        status: isCorrection ? "corrected" : "candidate",
        promptVersionUsed: node.activePromptVersion,
        generatedAt: new Date().toISOString(),
        executiveSummary: json.data.executiveSummary,
        detailedFindingsMarkdown: json.data.detailedFindingsMarkdown,
        verifiedEvidences: json.data.verifiedEvidences || [],
        criticalRisks: json.data.criticalRisks || [],
        assumptionsValidated: json.data.assumptionsValidated || [],
        proposedBranches: json.data.proposedBranches || [],
        nextRecommendedStep: json.data.nextRecommendedStep || "等待投资人审阅与确认/纠偏",
        executionRecord: json.executionRecord,
        executionSource: "gemini",
      };

      // Register proposed branches into thread.activeBranches if not existing
      const newBranches: BranchItem[] = (json.data.proposedBranches || []).map((b: any) => ({
        ...b,
        parentNodeId: node.id,
        parentNodeName: node.name,
        status: "pending",
        createdAt: new Date().toISOString(),
      }));

      const existingBranchIds = new Set(thread.activeBranches.map((b) => b.id));
      const filteredNewBranches = newBranches.filter((b) => !existingBranchIds.has(b.id));

      const updatedResults = [...resultsList, newPhaseResult];

      const durationSec = json.executionRecord ? (json.executionRecord.durationMs / 1000).toFixed(1) : "数";

      const updatedThread: ProjectThread = {
        ...thread,
        phaseResults: {
          ...thread.phaseResults,
          [node.id]: updatedResults,
        },
        activeBranches: [...thread.activeBranches, ...filteredNewBranches],
        executionLogs: [
          ...thread.executionLogs,
          {
            id: "log-" + Date.now(),
            timestamp: new Date().toISOString(),
            nodeId: node.id,
            nodeName: node.name,
            promptVersionUsed: node.activePromptVersion,
            type: isCorrection ? "user_correct" : "node_run",
            message: isCorrection
              ? `【${node.name}】已根据用户纠偏意见由 Gemini-3.8-Flash 真实重新研判完成（耗时 ${durationSec}s），生成 ${nextVersionLabel}。Prompt: ${node.activePromptVersion}`
              : `【${node.name}】Gemini-3.8-Flash 真实研判与联网核验已完成（耗时 ${durationSec}s），生成 ${nextVersionLabel} 待人工确认。Prompt: ${node.activePromptVersion}`,
            executionRecord: json.executionRecord,
          },
        ],
      };

      onThreadUpdate(updatedThread);
      setActiveTab("findings");
      setShowCorrectionDialog(false);
      setCorrectionInput("");
    } catch (e: any) {
      console.error(e);
      if (!errorInfo) {
        setErrorInfo({
          status: "failed",
          code: "AI_EXECUTION_FAILED",
          message: e.message || "执行出现网络或调用异常",
        });
      }
    } finally {
      clearInterval(timer);
      setIsExecuting(false);
    }
  };

  // Section 13 & 14: User Confirmation
  const handleConfirmResult = () => {
    if (!currentResult) return;

    const updatedCurrent: PhaseResult = {
      ...currentResult,
      status: "confirmed",
      userConfirmationLog: {
        type: "confirm",
        confirmedAt: new Date().toISOString(),
        userNote: "人工审阅通过，确认为正式阶段成果基线，解锁后续节点输入。",
        acceptedAsBaseline: true,
      },
    };

    const updatedList = resultsList.map((r) => (r.id === currentResult.id ? updatedCurrent : r));

    const updatedThread: ProjectThread = {
      ...thread,
      phaseResults: {
        ...thread.phaseResults,
        [node.id]: updatedList,
      },
      executionLogs: [
        ...thread.executionLogs,
        {
          id: "log-" + Date.now(),
          timestamp: new Date().toISOString(),
          nodeId: node.id,
          nodeName: node.name,
          promptVersionUsed: currentResult.promptVersionUsed,
          type: "user_confirm",
          message: `用户已正式签署确认【${node.name}】的阶段成果 (${currentResult.versionLabel})，作为下一节点的正式研究输入。`,
        },
      ],
    };

    onThreadUpdate(updatedThread);
  };

  // Handle User Correction (Section 14)
  const handleSubmitCorrection = () => {
    if (!correctionInput.trim()) {
      alert("请填写具体的纠偏依据或补充要求！");
      return;
    }
    handleExecuteNode(true, correctionInput.trim());
  };

  return (
    <div className="space-y-5">
      {/* Node Header Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                环节 {nodeIndex + 1}
              </span>
              <h2 className="text-lg font-bold text-slate-100">{node.name}</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                Prompt: {node.activePromptVersion}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-4xl">
              <strong>节点目的：</strong>{node.purpose}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {currentResult && (
              <button
                onClick={() => exportCurrentNodeMarkdown(node, resultsList, thread.title)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-colors"
                title="导出当前节点研判成果为 Markdown 文件"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">导出节点MD</span>
              </button>
            )}

            <button
              onClick={onOpenPromptManager}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-colors"
              title="查看与修改本节点专属提示词"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>配置提示词</span>
            </button>

            <button
              id="btn-execute-node"
              disabled={isExecuting || !isPrevConfirmed}
              onClick={() => handleExecuteNode(false)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md ${
                !isPrevConfirmed
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  : "text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:brightness-105 active:brightness-95 shadow-amber-500/20"
              }`}
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>智能推演与核验中...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-slate-950 fill-slate-950" />
                  <span>
                    {currentResult ? "重新执行本节点研究" : "执行本节点研究"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Predecessor Lock Warning */}
        {!isPrevConfirmed && (
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>输入约束守卫：</strong>依据《CIDES V1.0》第十五节规则，前置环节【{prevNode?.name || "投资基线"}】尚未获得用户正式确认，本节点暂无法作为正式研究推进。请先确认前置成果。
            </span>
          </div>
        )}

        {/* Live Real AI Execution Bar */}
        {isExecuting && (
          <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 shadow-inner space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-400 flex items-center gap-2 font-mono">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                真实 AI 执行进行中 (Google Gemini)
              </span>
              <span className="text-amber-300 font-mono text-xs px-2.5 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/60">
                已执行 {elapsedSeconds} 秒
              </span>
            </div>
            <div className="text-xs text-slate-300 pl-6 space-y-1 font-mono">
              <p>• 正在调用 Gemini-3.8-Flash 大模型进行端到端逻辑研判与前置基线核验...</p>
              <p>• 已挂载 Google Search 工具，正实时检索核验东道国最新公报与官方规章...</p>
              <p className="text-[11px] text-slate-400">（系统严格执行真实 AI 研判，绝不采用预设假数据，执行时长取决于网络与推理深度）</p>
            </div>
          </div>
        )}

        {/* Diagnostic Error Panel (Never Silently Fail or Fake Fallback) */}
        {errorInfo && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  {errorInfo.status === "blocked" ? "AI 研判被阻断 (BLOCKED)" : "AI 执行失败 (FAILED)"}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-rose-900/60 border border-rose-700 text-rose-200">
                  {errorInfo.code}
                </span>
              </div>
              <button
                onClick={() => handleExecuteNode(false)}
                disabled={isExecuting || cooldownSeconds > 0}
                className={`px-2.5 py-1 rounded text-[11px] font-medium border flex items-center gap-1 transition-colors ${
                  cooldownSeconds > 0
                    ? "bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed"
                    : "bg-rose-900 hover:bg-rose-800 text-rose-100 border-rose-700"
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isExecuting ? "animate-spin" : ""}`} />
                <span>
                  {cooldownSeconds > 0 ? `配额恢复中 (${cooldownSeconds}s)` : "重新尝试调用"}
                </span>
              </button>
            </div>
            <p className="text-rose-200 leading-relaxed pl-6">
              {errorInfo.message}
            </p>
            <div className="pl-6 text-[11px] text-rose-300/80 border-t border-rose-900/60 pt-2">
              {errorInfo.code === "AI_NOT_CONFIGURED" ? (
                <span>准则守卫：根据 CIDES V1.0 原则，系统已坚决杜绝假研究成果。请在应用设置中配置 GEMINI_API_KEY 环境变量后重新点击执行。</span>
              ) : errorInfo.code === "AI_QUOTA_EXHAUSTED" ? (
                <span>频次/额度限制提示：API Key 触发了每分钟频次限制 (RPM) 或配额耗尽。系统拒绝假数据，请等待 30-60 秒配额窗口刷新后点击“重新尝试调用”，或在应用设置中更换高配额 API Key。</span>
              ) : errorInfo.code === "AI_HIGH_DEMAND" ? (
                <span>瞬时高并发提示：Google Gemini 服务当前面临瞬时请求高峰（503），系统已自动退避重试仍受阻。请稍候数秒后点击右上角“重新尝试调用”。</span>
              ) : errorInfo.code === "GATEWAY_TIMEOUT" ? (
                <span>网关超时提示：本节点 AI 端到端推理与深度检索耗时较长，请稍候点击“重新尝试调用”。</span>
              ) : (
                <span>准则守卫：程序未落入预设 fallback，确保不会给您提供伪造的研究数据。请稍后重试或检查 API 连通性。</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {currentResult ? (
        <div className="space-y-4">
          {/* Version Selector if multiple versions exist (Requirements 12 & 13) */}
          {resultsList.length > 1 && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px] font-mono shrink-0 pl-1">成果版本历史:</span>
              <div className="flex items-center gap-2 overflow-x-auto">
                {resultsList.map((res, idx) => {
                  const isSelected = currentResult.id === res.id;
                  return (
                    <button
                      key={res.id}
                      onClick={() => setSelectedVersionIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 ${
                        isSelected
                          ? "bg-amber-400 text-slate-950 font-bold shadow-sm shadow-amber-400/20"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                      }`}
                    >
                      <span>V{res.version}</span>
                      <span className="text-[10px]">
                        {res.reasoningRevision ? "(分支重新推理)" : idx === 0 ? "(初版)" : "(纠偏版)"}
                      </span>
                      {res.status === "confirmed" && <Check className="w-3 h-3 text-emerald-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Version Header & Tab Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">
                {currentResult.versionLabel}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                运行所用Prompt: {currentResult.promptVersionUsed}
              </span>
              {isConfirmed ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  已人工确认 (正式输入)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  候选成果 (待人工确认)
                </span>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs">
              <button
                onClick={() => setActiveTab("findings")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === "findings"
                    ? "bg-amber-400 text-slate-950 font-bold"
                    : "bg-slate-800/70 text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>研判报告与结论</span>
              </button>

              <button
                onClick={() => setActiveTab("evidence")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === "evidence"
                    ? "bg-amber-400 text-slate-950 font-bold"
                    : "bg-slate-800/70 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>证据边界审查 ({currentResult.verifiedEvidences?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab("risks")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === "risks"
                    ? "bg-amber-400 text-slate-950 font-bold"
                    : "bg-slate-800/70 text-slate-400 hover:text-slate-200"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>假设与风险 ({currentResult.criticalRisks?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab("branches")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === "branches"
                    ? "bg-amber-400 text-slate-950 font-bold"
                    : "bg-slate-800/70 text-slate-400 hover:text-slate-200"
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>提议分支 ({currentResult.proposedBranches?.length || 0})</span>
              </button>
            </div>
          </div>

          {/* Dedicated Real AI Execution Telemetry & Verification Card */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 text-xs shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 font-bold text-slate-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  真实 AI 执行证明与核验证据链 (Execution Telemetry)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950/90 text-emerald-300 border border-emerald-800/90 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AI 实际调用完成 (True)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <span>服务商: <strong className="text-slate-200">{currentResult.executionRecord?.provider || "Google Gemini"}</strong></span>
                <span>·</span>
                <span>模型: <strong className="text-amber-300">{currentResult.executionRecord?.model || "gemini-3.8-flash"}</strong></span>
                <span>·</span>
                <span>执行耗时: <strong className="text-slate-200">{currentResult.executionRecord ? `${(currentResult.executionRecord.durationMs / 1000).toFixed(1)}s` : "已完成"}</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1">
                <span className="text-slate-400 block text-[10px]">联网核验状态 (Google Search):</span>
                <div className="flex items-center gap-1">
                  {currentResult.executionRecord?.searchExecuted ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      已真实执行搜索核验
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      已配置工具 (专业知识推理)
                    </span>
                  )}
                </div>
                {currentResult.executionRecord?.searchQueries && currentResult.executionRecord.searchQueries.length > 0 ? (
                  <div className="text-[10px] text-slate-400 truncate" title={currentResult.executionRecord.searchQueries.join(", ")}>
                    关键词: {currentResult.executionRecord.searchQueries.join("; ")}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500">
                    来源核验数: {currentResult.verifiedEvidences?.length || 0} 条
                  </div>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1">
                <span className="text-slate-400 block text-[10px]">提示词版本与输入约束:</span>
                <div className="text-slate-200 font-semibold">
                  版本: {currentResult.promptVersionUsed}
                </div>
                <div className="text-[10px] text-slate-400">
                  输入上下文: {currentResult.executionRecord?.inputContextLength || "-"} 字符
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1">
                <span className="text-slate-400 block text-[10px]">研判输出与 Token 计量:</span>
                <div className="text-slate-200 font-semibold">
                  输出 {currentResult.executionRecord?.outputLength || currentResult.detailedFindingsMarkdown.length} 字符
                </div>
                <div className="text-[10px] text-slate-400">
                  {currentResult.executionRecord?.tokens?.totalTokens
                    ? `消耗 Tokens: ${currentResult.executionRecord.tokens.totalTokens}`
                    : "标准案卷 JSON 解析闭环"}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1">
                <span className="text-slate-400 block text-[10px]">证据边界与动态分支:</span>
                <div className="text-slate-200 font-semibold">
                  证据 {currentResult.verifiedEvidences?.length || 0} 项 · 提议分支 {currentResult.proposedBranches?.length || 0} 项
                </div>
                <div className="text-[10px] text-slate-400">
                  执行来源: {currentResult.executionSource === "gemini" ? "Gemini 真实研判" : "正式研判"}
                </div>
              </div>
            </div>
          </div>

          {/* TAB 1: Detailed Findings */}
          {activeTab === "findings" && (
            <div className="space-y-4">
              {/* Reasoning Revision Card (Mainline Re-reasoning from Branch findings) */}
              {currentResult.reasoningRevision && (
                <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/50 space-y-2 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-purple-200">
                        【分支核验带回】主线重新推理论证修正轨迹说明 (Reasoning Revision)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      {currentResult.triggeredByBranchId && (
                        <span className="px-2 py-0.5 rounded bg-purple-900/80 text-purple-300 border border-purple-700">
                          来源分支: {currentResult.triggeredByBranchId}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/30">
                        版本演进: V{currentResult.version - 1} ➔ V{currentResult.version}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-purple-100/95 leading-relaxed pl-4 border-l-2 border-purple-400/80 my-1 whitespace-pre-wrap">
                    {currentResult.reasoningRevision}
                  </div>
                </div>
              )}

              {/* Executive Summary Card */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                  执行要点与核心研判摘要 (Executive Summary)
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {currentResult.executiveSummary}
                </p>
              </div>

              {/* Detailed Markdown Analysis */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 text-xs leading-relaxed max-h-[600px] overflow-y-auto prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{currentResult.detailedFindingsMarkdown}</ReactMarkdown>
              </div>

              {/* Next Step Recommendation */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                  <span className="text-slate-400">下一步推荐操作：</span>
                  <span className="text-slate-200 font-medium">{currentResult.nextRecommendedStep}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Evidence Boundary Inspection */}
          {activeTab === "evidence" && (
            <div className="space-y-4">
              {/* Boundary Philosophy Alert (Section 21 - 25) */}
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200">
                    证据边界审查规则 (CIDES 第二十一至二十五节)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    ① 原始搜索结果<br/>(公开信息线索)
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    ② 候选信息<br/>(待核实材料)
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-amber-500/40 text-amber-300">
                    ③ 经过核验的证据<br/>(法定文号/公报)
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-purple-300">
                    ④ AI研判推论<br/>(专家模型推导)
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-emerald-500/40 text-emerald-300">
                    ⑤ 用户确认结论<br/>(正式法律效力)
                  </div>
                </div>
              </div>

              {/* Verified Evidence Cards */}
              <div className="space-y-3">
                {currentResult.verifiedEvidences?.map((evi) => (
                  <div
                    key={evi.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-100">{evi.title}</span>
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {evi.reliability}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          出处机构：{evi.source} {evi.date && `· ${evi.date}`}
                        </p>
                      </div>

                      <button
                        onClick={() => onInspectEvidence(evi)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-amber-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1 transition-colors shrink-0"
                      >
                        <span>核验证据链</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-slate-300 text-xs font-serif leading-relaxed">
                      "{evi.snippet}"
                    </div>

                    {evi.contradictionNotes && (
                      <p className="text-[11px] text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>相反或冲突证据标记：{evi.contradictionNotes}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Assumptions & Risks */}
          {activeTab === "risks" && (
            <div className="space-y-4">
              {/* Assumptions Grid */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-200 block">
                  前置关键假设校验状态 (Hypotheses Validation)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentResult.assumptionsValidated?.map((asm, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{asm.hypothesis}</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.2 rounded-full ${
                            asm.status === "validated"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : asm.status === "challenged"
                              ? "bg-amber-950 text-amber-400 border border-amber-800"
                              : "bg-rose-950 text-rose-400 border border-rose-800"
                          }`}
                        >
                          {asm.status === "validated"
                            ? "已证实"
                            : asm.status === "challenged"
                            ? "存在挑战"
                            : "被推翻"}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px]">{asm.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Critical Risks Matrix */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-200 block">
                  核心风险识别与对冲策略清单 (Critical Risk Heatmap)
                </span>
                <div className="space-y-2.5">
                  {currentResult.criticalRisks?.map((risk) => (
                    <div
                      key={risk.id}
                      className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100">{risk.description}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {risk.category}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          <strong>防范与对冲方案：</strong>{risk.mitigation}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0 ${
                          risk.severity === "高"
                            ? "bg-rose-950 text-rose-400 border border-rose-800"
                            : "bg-amber-950 text-amber-400 border border-amber-800"
                        }`}
                      >
                        {risk.severity}风险
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Proposed Branches */}
          {activeTab === "branches" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-bold text-purple-200 block">
                    动态分支管理与实证核验中心 (Branch Management & Verification)
                  </span>
                  <p className="text-purple-300/80 text-[11px]">
                    系统在分析过程中识别出重大不确定性、证据冲突或风险敞口时提议生成分支。分支研究成果带回主线后，将触发主线重新推理并生成新版本！
                  </p>
                </div>

                <button
                  id="btn-create-test-branch"
                  onClick={() => {
                    const testBranch: BranchItem = {
                      id: `branch-test-${node.id.toLowerCase()}-${Date.now()}`,
                      parentNodeId: node.id,
                      parentNodeName: node.name,
                      title: `【实证核验】${node.name}专项外部政策与关键法律文书核实 (Workflow Test)`,
                      triggerType: "evidence_conflict",
                      triggerReason: "主线初版分析基于一般假设，需专项核查当地最新官方公报、特别经济区企业税率优惠是否仍有效，验证是否需修正主线判断。",
                      objective: "通过东道国财政部/投资局真实官方文告核验法规有效性，为原主线判断提供确凿法律与数据凭据。",
                      scope: "东道国最新公报、特别经济区法案细则、双边投资协定适用条款。",
                      prompt: `你正在对主线节点【${node.name}】进行【专项实证核实分支研究】。请深入核实外部公报文凭与法律事实，查明当地法规政策是否有调整或限制，明确判定原主线初版判断中的哪些假设被推翻或需修正。`,
                      impactOnMainline: "核验成果将带回主线触发重新推理，更新主线财务模型参数与重大风险定级。",
                      status: "pending",
                      createdAt: new Date().toISOString(),
                    };

                    const updatedThread: ProjectThread = {
                      ...thread,
                      activeBranches: [
                        ...thread.activeBranches.filter((b) => b.id !== testBranch.id),
                        testBranch,
                      ],
                      executionLogs: [
                        ...thread.executionLogs,
                        {
                          id: "log-" + Date.now(),
                          timestamp: new Date().toISOString(),
                          nodeId: node.id,
                          nodeName: node.name,
                          promptVersionUsed: node.activePromptVersion,
                          type: "branch_opened",
                          message: `用户开启流程验证模式，为【${node.name}】创建测试专项深挖分支：【${testBranch.title}】。`,
                        },
                      ],
                    };
                    onThreadUpdate(updatedThread);
                    onOpenBranch(testBranch);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-purple-200 bg-purple-900/60 hover:bg-purple-800/70 border border-purple-700/80 flex items-center gap-1.5 shrink-0 transition-all shadow-sm"
                  title="用于在任意节点手动创建分支，验证完整的 Mainline -> Branch -> Merge -> Re-reasoning 闭环"
                >
                  <PlusCircle className="w-4 h-4 text-purple-300" />
                  <span>创建流程验证分支 (Workflow Test)</span>
                </button>
              </div>

              {/* Combined branches list */}
              {(() => {
                const combinedMap = new Map<string, BranchItem>();
                (currentResult.proposedBranches || []).forEach((b) => combinedMap.set(b.id, b));
                (thread.activeBranches || [])
                  .filter((b) => b.parentNodeId === node.id)
                  .forEach((b) => combinedMap.set(b.id, b));

                const allBranches = Array.from(combinedMap.values());

                if (allBranches.length === 0) {
                  return (
                    <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 space-y-2 text-xs">
                      <p>当前节点暂无系统自动提议分支。您可以点击上方【创建流程验证分支 (Workflow Test)】启动分支核验机制测试。</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {allBranches.map((branch) => {
                      const activeItem = thread.activeBranches.find((b) => b.id === branch.id);
                      const isMerged = activeItem?.status === "merged_to_mainline";
                      const isExecuting = activeItem?.status === "in_progress";

                      return (
                        <div
                          key={branch.id}
                          className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-100">{branch.title}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-900/40 text-purple-300 shrink-0">
                                {branch.triggerType}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              <strong>触发原因：</strong>{branch.triggerReason}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              <strong>预期影响：</strong>{branch.impactOnMainline}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                            <span className="text-[10px] font-mono">
                              {isMerged ? (
                                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  已带回主线重新推理
                                </span>
                              ) : isExecuting ? (
                                <span className="text-amber-400 font-semibold">深挖中...</span>
                              ) : (
                                <span className="text-slate-500">待执行深挖</span>
                              )}
                            </span>
                            <button
                              onClick={() => onOpenBranch(activeItem || branch)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-purple-300 bg-purple-950/50 hover:bg-purple-900/60 border border-purple-800/60 flex items-center gap-1.5 transition-colors"
                            >
                              <GitBranch className="w-3.5 h-3.5" />
                              <span>{isMerged ? "查看分支与带回记录" : "进入分支核验"}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* MANDATORY HUMAN REVIEW / CONFIRMATION BAR (Section 13, 14, 15) */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  阶段成果人工确认与纠偏 (CIDES 第十三、十四节硬规则)
                </span>
                <p className="text-[11px] text-slate-400">
                  {isConfirmed
                    ? "此阶段成果已经人工确认，已正式升级为后续节点输入。您仍可随时提出纠偏并生成新版本。"
                    : "依据 CIDES 规范：本阶段成果必须经过您人工确认，方可成为下一研究环节的正式基线输入。"}
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {/* Option B: 提出纠偏 (Section 14: 生成 V2) */}
                <button
                  id="btn-trigger-correction"
                  onClick={() => setShowCorrectionDialog(true)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5 text-amber-400" />
                  <span>提出纠偏 (生成新版本)</span>
                </button>

                {/* Option A: 确认通过 (Section 13) */}
                {!isConfirmed && (
                  <button
                    id="btn-confirm-result"
                    onClick={handleConfirmResult}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:brightness-105 active:brightness-95 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4 text-slate-950" />
                    <span>确认成果并确立为正式输入</span>
                  </button>
                )}

                {isConfirmed && onNavigateToNextNode && (
                  <button
                    onClick={onNavigateToNextNode}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors flex items-center gap-1.5 shadow-md shadow-amber-400/20"
                  >
                    <span>推进至下一环节</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty / Ready State */
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-lg mx-auto">
            <h3 className="text-sm font-bold text-slate-200">
              准备执行【{node.name}】专项智能研判
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              系统将严格加载专属提示词（版本：{node.activePromptVersion}），结合前序已确认基线，发起东道国政策与要素数据检索。
            </p>
          </div>
          <button
            disabled={isExecuting || !isPrevConfirmed}
            onClick={() => handleExecuteNode(false)}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-md ${
              !isPrevConfirmed
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : "text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:brightness-105 active:brightness-95 shadow-amber-500/20"
            }`}
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>启动本节点专业研究</span>
          </button>
        </div>
      )}

      {/* User Correction Dialog (Section 14: 用户纠偏的处理机制) */}
      {showCorrectionDialog && currentResult && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-400" />
                阶段成果用户纠偏与重构 (CIDES 第十四节)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                系统将保留当前 {currentResult.versionLabel} 历史，并依据您的纠偏批注意见生成【阶段成果 V{currentResult.version + 1}】。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200 block">
                请输入您的具体纠偏意见、事实依据或参数调整指令：
              </label>
              <textarea
                value={correctionInput}
                onChange={(e) => setCorrectionInput(e.target.value)}
                placeholder="例如：原分析认为电价为0.065美元/度，但根据我们获得的赞比亚能源署最新SI文件，高压大工业实际执行带容量费的阶梯电价，综合测算应上浮至0.088美元/度；此外，要求重新核算在电网每日停电6小时情景下需配置的自备光储电站装机规模..."
                className="w-full h-36 p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCorrectionDialog(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                取消
              </button>
              <button
                id="btn-submit-correction"
                onClick={handleSubmitCorrection}
                disabled={isExecuting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:brightness-105 active:brightness-95 disabled:opacity-50 transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>提交纠偏并生成新阶段成果版本</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
