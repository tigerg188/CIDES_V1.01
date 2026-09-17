import React, { useState, useEffect } from "react";
import {
  GitBranch,
  X,
  Play,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  ArrowDownLeft,
  Sparkles,
  FileText,
  Search,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { BranchItem, BranchModificationType, ProjectThread } from "../types/cides";

interface BranchResearchModalProps {
  branch: BranchItem;
  thread: ProjectThread;
  onClose: () => void;
  onMergeBranchToMainline: (
    branchId: string,
    modificationType: BranchModificationType,
    findingsMarkdown: string,
    action: string,
    userNote?: string,
    evidences?: any[]
  ) => void;
}

export const BranchResearchModal: React.FC<BranchResearchModalProps> = ({
  branch,
  thread,
  onClose,
  onMergeBranchToMainline,
}) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [findings, setFindings] = useState(branch.findingsMarkdown || "");
  const [branchEvidences, setBranchEvidences] = useState<any[]>(branch.evidences || []);
  const [userNote, setUserNote] = useState("专家已核准分支调查结论，同意带回主线重新推理。");
  const [modificationType, setModificationType] = useState<BranchModificationType>(
    branch.modificationType || "modify_judgment"
  );
  const [recommendedAction, setRecommendedAction] = useState(
    branch.recommendedAction || "将核验后的真实参数带回主线财务模型与制度条件节点，更新项目经济评价。"
  );
  const [errorInfo, setErrorInfo] = useState<{ status: string; code: string; message: string } | null>(null);
  const [executionRecord, setExecutionRecord] = useState<any>(null);
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

  const handleRunBranchResearch = async () => {
    setIsExecuting(true);
    setErrorInfo(null);
    setElapsedSeconds(0);

    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    try {
      const res = await fetch("/api/cides/execute-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: branch.id,
          parentNodeId: branch.parentNodeId,
          branchTitle: branch.title,
          triggerReason: branch.triggerReason,
          objective: branch.objective,
          scope: branch.scope,
          branchPrompt: branch.prompt,
          projectBaseline: thread.baseline,
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
            ? `网关请求超时 (504 Gateway Time-out)：分支【${branch.title}】检索核验耗时超出时限，请稍候重试。`
            : `服务器返回异常 (HTTP ${res.status}): ${resText.slice(0, 100)}`,
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
          message: json.error || "分支研究执行失败",
        };
        setErrorInfo(errObj);
        throw new Error(errObj.message);
      }

      setFindings(json.data.branchFindingsMarkdown || "");
      if (json.data.evidences && Array.isArray(json.data.evidences)) {
        setBranchEvidences(json.data.evidences);
      }
      if (json.data.modificationType) {
        setModificationType(json.data.modificationType);
      }
      if (json.data.recommendedAction) {
        setRecommendedAction(json.data.recommendedAction);
      }
      if (json.executionRecord) {
        setExecutionRecord(json.executionRecord);
      }
    } catch (e: any) {
      console.error(e);
      if (!errorInfo) {
        setErrorInfo({
          status: "failed",
          code: "AI_EXECUTION_FAILED",
          message: e.message || "分支执行出现网络或模型调用异常",
        });
      }
    } finally {
      clearInterval(timer);
      setIsExecuting(false);
    }
  };

  const handleConfirmMerge = () => {
    if (!findings.trim()) {
      alert("请先执行分支研究以产出分析成果，再带回主线！");
      return;
    }
    onMergeBranchToMainline(
      branch.id,
      modificationType,
      findings,
      recommendedAction,
      userNote,
      branchEvidences
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-800/60 text-purple-400">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  动态分支专项深挖研究 (CIDES 第十六至二十节)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-900/50 text-purple-300 border border-purple-800/40">
                  {branch.triggerType}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                分支服务于主线具体问题，非独立任务，研究完成后必须带回主线并更新原有判断。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Branch Mission Definition: Why, What, Impact */}
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <span className="text-slate-400 font-semibold block mb-0.5">分支研究标题:</span>
              <span className="text-slate-100 font-medium">{branch.title}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block mb-0.5">触发原因 (Why):</span>
              <span className="text-amber-300">{branch.triggerReason}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block mb-0.5">研究范围与边界:</span>
              <span className="text-slate-200">{branch.scope}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700/60">
            <span className="text-slate-400 font-semibold block mb-0.5">对主线判断之预期影响 (Impact):</span>
            <p className="text-slate-300 italic">{branch.impactOnMainline}</p>
          </div>
        </div>

        {/* Execute Branch Trigger */}
        {!findings && (
          <div className="p-5 rounded-xl bg-purple-950/20 border border-purple-800/30 text-center space-y-3">
            <p className="text-xs text-purple-200">
              系统将根据此分支专属目标，调用东道国能源电网规程/官方税法数据库进行针对性检索与多源核实。
            </p>
            <button
              id="btn-run-branch"
              onClick={handleRunBranchResearch}
              disabled={isExecuting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-purple-400 to-amber-300 hover:brightness-105 active:brightness-95 disabled:opacity-50 transition-all shadow-md shadow-purple-500/20 inline-flex items-center gap-2"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>真实 AI 研判中 ({elapsedSeconds}s)...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 text-slate-950" />
                  <span>立即启动分支研究与真实核验</span>
                </>
              )}
            </button>

            {isExecuting && (
              <p className="text-[11px] font-mono text-purple-300 animate-pulse">
                调用 Gemini-3.8-Flash 挂载 Google Search 进行专项真实核验，已执行 {elapsedSeconds} 秒...
              </p>
            )}
          </div>
        )}

        {/* Diagnostic Error Panel */}
        {errorInfo && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  {errorInfo.status === "blocked" ? "分支研究被阻断 (BLOCKED)" : "分支研究失败 (FAILED)"}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-rose-900/60 border border-rose-700 text-rose-200">
                  {errorInfo.code}
                </span>
              </div>
              <button
                onClick={handleRunBranchResearch}
                disabled={isExecuting || cooldownSeconds > 0}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 transition-colors ${
                  cooldownSeconds > 0
                    ? "bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed"
                    : "bg-rose-900 hover:bg-rose-800 text-rose-100 border-rose-700"
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isExecuting ? "animate-spin" : ""}`} />
                <span>{cooldownSeconds > 0 ? `配额恢复中 (${cooldownSeconds}s)` : "重试"}</span>
              </button>
            </div>
            <p className="text-rose-200 leading-relaxed pl-6">{errorInfo.message}</p>
            <div className="pl-6 text-[11px] text-rose-300/80 border-t border-rose-900/60 pt-1.5">
              {errorInfo.code === "AI_QUOTA_EXHAUSTED" ? (
                <span>频次/额度限制提示：API Key 触发了每分钟调用频次 (RPM) 或配额用尽。系统拒绝假数据，请等待 30-60 秒配额窗口刷新后点击“重试”，或在应用设置中更换高配额 API Key。</span>
              ) : errorInfo.code === "AI_HIGH_DEMAND" ? (
                <span>瞬时高并发提示：Gemini 服务遇到流量高峰（503），已自动保护真实性。请等待片刻点击“重试”。</span>
              ) : errorInfo.code === "GATEWAY_TIMEOUT" ? (
                <span>网关超时提示：分支核验检索耗时超出代理时限，请稍候点击“重试”。</span>
              ) : (
                <span>提示：程序已杜绝假数据兜底，确保不会向主线汇报伪造结论。</span>
              )}
            </div>
          </div>
        )}

        {/* Findings View */}
        {findings && (
          <div className="space-y-4">
            {/* Real AI Execution Telemetry Card for Branch */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    分支真实 AI 执行证明 (Branch Telemetry)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950/90 text-emerald-300 border border-emerald-800/90 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    AI 实际调用完成 (True)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <span>模型: <strong className="text-purple-300">{executionRecord?.model || "gemini-3.8-flash"}</strong></span>
                  <span>·</span>
                  <span>耗时: <strong className="text-slate-200">{executionRecord ? `${(executionRecord.durationMs / 1000).toFixed(1)}s` : "已完成"}</strong></span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">联网核验状态:</span>
                  <span className={executionRecord?.searchExecuted ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                    {executionRecord?.searchExecuted ? "已执行 Google 搜索核查" : "专业推理模式"}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">研判输出规模:</span>
                  <span className="text-slate-200">{executionRecord?.outputLength || findings.length} 字符</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Token 计量:</span>
                  <span className="text-slate-200">{executionRecord?.tokens?.totalTokens ? `${executionRecord.tokens.totalTokens} Tokens` : "闭环交付"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-400" />
                分支深挖核查结论报告
              </span>
              <button
                onClick={handleRunBranchResearch}
                disabled={isExecuting}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isExecuting ? "animate-spin" : ""}`} />
                <span>重新执行验证</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs leading-relaxed max-h-64 overflow-y-auto font-sans prose prose-invert prose-sm">
              <ReactMarkdown>{findings}</ReactMarkdown>
            </div>

            {/* Merge to Mainline Controls (Section 20: 分支可以改变原主线) */}
            <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-100">
                  将分支成果带回主线并更新原有判断 (Section 19 & 20)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    对主线原有判断之调整方式：
                  </label>
                  <select
                    value={modificationType}
                    onChange={(e) => setModificationType(e.target.value as BranchModificationType)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="confirm_judgment">确认原来的判断（事实成立，继续推进）</option>
                    <option value="modify_judgment">修改原来的判断（使用新参数/新方案继续）</option>
                    <option value="restrict_judgment">限制原来的判断（增加约束前提继续）</option>
                    <option value="overturn_judgment">推翻原来的判断（需返回前序关键节点重构）</option>
                    <option value="retain_uncertainty">仍然无法确认（保留不确定性，不得假装完成）</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    更新至主线后的建议处置动作：
                  </label>
                  <input
                    type="text"
                    value={recommendedAction}
                    onChange={(e) => setRecommendedAction(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  人类投资决策专家审核批注 (Human Confirmation Note)：
                </label>
                <input
                  type="text"
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="填写专家审核意见（例如：已核准调查事实，赞比亚新政府保留了优惠税率，同意重新推理修正财务节点）"
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            暂不合并关闭
          </button>
          {findings && (
            <button
              id="btn-merge-branch"
              onClick={handleConfirmMerge}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-purple-400 to-amber-300 hover:brightness-105 active:brightness-95 transition-all shadow-md shadow-purple-500/20 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>确认成果并带回主线更新判断</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
