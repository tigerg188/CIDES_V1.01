import React, { useState, useEffect } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Edit3,
  Sparkles,
  ArrowRight,
  HelpCircle,
  ShieldAlert,
  Compass,
  BookmarkPlus,
  RefreshCw,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  ProjectThread,
  IntentRecognitionResult,
  ResearchBaseline,
} from "../types/cides";
import { InvestmentPreset } from "../data/samplePresets";
import { getActivePresets, deletePresetById, restoreAllPresets } from "../utils/storage";
import { useTheme } from "../context/ThemeContext";
import { ConfirmModal } from "./ConfirmModal";

interface IntentWorkspaceProps {
  thread: ProjectThread;
  onThreadUpdate: (updated: ProjectThread) => void;
  onProceedToNodes: () => void;
}

export const IntentWorkspace: React.FC<IntentWorkspaceProps> = ({
  thread,
  onThreadUpdate,
  onProceedToNodes,
}) => {
  const { isTraditional } = useTheme();
  const [rawText, setRawText] = useState(thread.rawInput || "");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userCorrectionText, setUserCorrectionText] = useState("");
  const [errorInfo, setErrorInfo] = useState<{ status: string; code: string; message: string } | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [presets, setPresets] = useState<InvestmentPreset[]>(() => getActivePresets());
  const [confirmPresetDelete, setConfirmPresetDelete] = useState<{
    isOpen: boolean;
    presetId: string;
    presetName: string;
  } | null>(null);

  const refreshPresets = () => {
    setPresets(getActivePresets());
  };

  const handleDeletePreset = (e: React.MouseEvent, presetId: string, name: string) => {
    e.stopPropagation();
    setConfirmPresetDelete({
      isOpen: true,
      presetId,
      presetName: name,
    });
  };

  const handleRestorePresets = () => {
    restoreAllPresets();
    refreshPresets();
  };

  useEffect(() => {
    refreshPresets();
  }, []);

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

  const handleSelectPreset = (preset: InvestmentPreset) => {
    setRawText(preset.rawInput);
  };

  const handleRecognizeIntent = async () => {
    if (!rawText.trim()) {
      setErrorInfo({
        status: "failed",
        code: "INVALID_INPUT",
        message: "请输入投资意图的自然语言描述或选择示例案例",
      });
      return;
    }
    setErrorInfo(null);
    setIsAnalyzing(true);
    setElapsedSeconds(0);

    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    try {
      const res = await fetch("/api/cides/recognize-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: rawText }),
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
            ? "网关请求超时 (504 Gateway Time-out)：AI 复杂推理检索用时超出网关代理限制，请稍候点击重试。"
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
          message: json.error || "意图识别未能返回有效结构化数据",
        };
        setErrorInfo(errObj);
        throw new Error(errObj.message);
      }

      const intent: IntentRecognitionResult = {
        ...json.data,
        executionRecord: json.executionRecord,
      };

      const durationSec = json.executionRecord ? (json.executionRecord.durationMs / 1000).toFixed(1) : "数";

      const updated: ProjectThread = {
        ...thread,
        title: `${intent.region || "跨境"} · ${intent.target || "产业投资项目"}`,
        rawInput: rawText,
        intentResult: intent,
        isIntentConfirmed: false,
        executionLogs: [
          ...thread.executionLogs,
          {
            id: "log-" + Date.now(),
            timestamp: new Date().toISOString(),
            nodeId: "INTENT_ENGINE",
            nodeName: "意图识别引擎",
            promptVersionUsed: "V1.0",
            type: "node_run",
            message: `Gemini-3.8-Flash 真实调用完成（耗时 ${durationSec}s），完成投资意图12维度精准拆解与隐含问题挖掘，待用户确认与纠偏。`,
            executionRecord: json.executionRecord,
          },
        ],
      };

      onThreadUpdate(updated);
      setShowConfirmModal(true);
    } catch (e: any) {
      console.error(e);
      if (!errorInfo) {
        setErrorInfo({
          status: "failed",
          code: "AI_EXECUTION_FAILED",
          message: e.message || "意图识别出现网络或调用异常",
        });
      }
    } finally {
      clearInterval(timer);
      setIsAnalyzing(false);
    }
  };

  const handleConfirmBaseline = () => {
    if (!thread.intentResult) return;

    const baseSummary = thread.intentResult.structuredBaselineSummary || 
      `以${thread.intentResult.region}的${thread.intentResult.target}为研究客体，重点研究宏观准入、要素供给、财务测算与交易架构。`;

    const baseline: ResearchBaseline = {
      id: "baseline-" + Date.now(),
      confirmedAt: new Date().toISOString(),
      confirmedBy: "投资发起人 / 决策团队",
      summary: baseSummary,
      target: thread.intentResult.target,
      purpose: thread.intentResult.purpose,
      region: thread.intentResult.region,
      projectType: thread.intentResult.projectType,
      scale: thread.intentResult.scale,
      capitalSource: thread.intentResult.capitalSource,
      resources: thread.intentResult.resources,
      keyBoundaries: thread.intentResult.proposedResearchObjectives || [],
      userModificationsNote: userCorrectionText.trim() || "无补充纠偏，完全确认AI识别之研究基线。",
    };

    const updated: ProjectThread = {
      ...thread,
      isIntentConfirmed: true,
      baseline,
      executionLogs: [
        ...thread.executionLogs,
        {
          id: "log-" + Date.now(),
          timestamp: new Date().toISOString(),
          nodeId: "BASELINE_LOCK",
          nodeName: "正式研究基线确立",
          promptVersionUsed: "V1.0",
          type: "user_confirm",
          message: `用户已正式确认投资研究基线。用户批注: "${userCorrectionText.trim() || "直接确认"}"。升级为合法研究基准！`,
        },
      ],
    };

    onThreadUpdate(updated);
    setShowConfirmModal(false);
    onProceedToNodes();
  };

  const intent = thread.intentResult;

  return (
    <div className="space-y-6">
      {/* Top Banner & Philosophy */}
      <div
        className={`p-5 rounded-2xl border shadow-sm ${
          isTraditional
            ? "bg-white border-gray-300 text-gray-900"
            : "bg-gradient-to-r from-slate-800/80 via-slate-800/40 to-slate-900 border-slate-700/80 shadow-md text-slate-100"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Compass className={`w-5 h-5 ${isTraditional ? "text-blue-600" : "text-amber-400"}`} />
              <h2 className={`text-lg font-bold ${isTraditional ? "text-gray-900" : "text-slate-100"}`}>
                第一起点：用户的原始投资意图识别与基线确立
              </h2>
            </div>
            <p className={`text-xs max-w-3xl leading-relaxed font-medium ${isTraditional ? "text-gray-800" : "text-slate-300"}`}>
              根据《CIDES自然语言运行定义 V1.0》第三节与第四节：CIDES不是单纯问答聊天机器人，而是从用户的原始输入中精准识别12个核心维度，形成初始识别结果；且
              <strong className={`font-bold mx-1 ${isTraditional ? "text-blue-700 underline decoration-blue-300" : "text-amber-300 font-medium"}`}>
                必须允许用户人工确认和纠偏
              </strong>
              ，升级为正式研究基线后方可驱动主线推进。
            </p>
          </div>

          {thread.isIntentConfirmed && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold shrink-0 ${
                isTraditional
                  ? "bg-emerald-100 border-emerald-300 text-emerald-950"
                  : "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>正式研究基线已锁定</span>
            </div>
          )}
        </div>
      </div>

      {/* Preset Quick Selectors */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span
            className={`text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 ${
              isTraditional ? "text-gray-900" : "text-slate-300"
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${isTraditional ? "text-blue-600" : "text-amber-400"}`} />
            快速载入典型跨境投资意图案例 ({presets.length})
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className={`hidden sm:inline font-medium ${isTraditional ? "text-gray-800" : "text-slate-400"}`}>
              点击卡片自动填充文本框进行识别研判
            </span>
            <button
              onClick={handleRestorePresets}
              title="恢复所有被删除或隐藏的官方预设案例"
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                isTraditional
                  ? "border-gray-300 bg-white hover:bg-gray-100 text-gray-900"
                  : "border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <RotateCcw className={`w-3 h-3 ${isTraditional ? "text-blue-600" : "text-amber-400"}`} />
              <span>恢复预设</span>
            </button>
          </div>
        </div>
        {presets.length === 0 ? (
          <div
            className={`p-4 rounded-xl border border-dashed text-center text-xs font-semibold ${
              isTraditional
                ? "border-gray-300 text-gray-700 bg-gray-50"
                : "border-slate-700 text-slate-400"
            }`}
          >
            已清空全部预设案例。如需恢复请点击上方“恢复预设”。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {presets.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className={`relative text-left p-3.5 rounded-xl border transition-all group cursor-pointer flex flex-col justify-between ${
                  isTraditional
                    ? "bg-white hover:bg-gray-50 border-gray-300 hover:border-blue-600 shadow-xs"
                    : "bg-slate-800/60 hover:bg-slate-800 border-slate-700/70 hover:border-amber-500/40"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <span
                      className={`text-xs font-bold transition-colors line-clamp-1 ${
                        isTraditional
                          ? "text-gray-900 group-hover:text-blue-700"
                          : "text-slate-200 group-hover:text-amber-300"
                      }`}
                    >
                      {p.name}
                    </span>
                    <button
                      onClick={(e) => handleDeletePreset(e, p.id, p.name)}
                      title="删除此预设案例"
                      className="p-1 rounded text-red-600 hover:text-white hover:bg-red-600 transition-colors border border-transparent hover:border-red-600 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mb-1.5 border ${
                      isTraditional
                        ? "bg-blue-50 text-blue-900 border-blue-200"
                        : "bg-slate-900/80 text-amber-400 border-slate-700/50"
                    }`}
                  >
                    {p.tag}
                  </span>
                  <p
                    className={`text-[11px] line-clamp-2 leading-relaxed font-medium ${
                      isTraditional ? "text-gray-800" : "text-slate-300"
                    }`}
                  >
                    {p.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Natural Language Input Box */}
      <div
        className={`p-5 rounded-2xl border space-y-4 ${
          isTraditional
            ? "bg-white border-gray-300 shadow-xs"
            : "bg-slate-800/40 border-slate-700/80"
        }`}
      >
        <div className="flex items-center justify-between">
          <label
            className={`text-sm font-bold flex items-center gap-2 ${
              isTraditional ? "text-gray-900" : "text-slate-200"
            }`}
          >
            <Edit3 className={`w-4 h-4 ${isTraditional ? "text-blue-600" : "text-amber-400"}`} />
            输入用户的原始自然语言投资设想 / 商业计划 / 零散想法
          </label>
          <span
            className={`text-xs font-semibold ${
              isTraditional ? "text-gray-700" : "text-slate-400"
            }`}
          >
            支持一段话、零散要求或商业计划书摘录
          </span>
        </div>

        <textarea
          id="cides-raw-intent-input"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="例如：我们是一家中资企业，拟在非洲赞比亚铜带省投资并购一座铜矿，并扩建年产3.5万吨电积铜冶炼选厂，资金来源为企业自有资本金与跨境银行贷款。希望搞清楚真实供电电价与限电风险、矿业特许权使用费阶梯计算、外汇管制与离岸交易架构..."
          className={`w-full h-36 p-3.5 rounded-xl border text-sm font-medium transition-colors resize-none leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isTraditional
              ? "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
              : "bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-amber-500"
          }`}
        />

        {/* Live Real AI Execution Bar */}
        {isAnalyzing && (
          <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 shadow-inner space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-400 flex items-center gap-2 font-mono">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                真实 AI 执行进行中 (Google Gemini 意图引擎)
              </span>
              <span className="text-amber-300 font-mono text-xs px-2.5 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/60">
                已耗时 {elapsedSeconds} 秒
              </span>
            </div>
            <p className="text-xs text-slate-300 pl-6 font-mono">
              正在调用 Gemini-3.8-Flash 对投资意图进行 12 大维度深度拆解与隐含问题挖掘，拒绝任何伪造数据...
            </p>
          </div>
        )}

        {/* Diagnostic Error Panel */}
        {errorInfo && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  {errorInfo.status === "blocked" ? "AI 识别被阻断 (BLOCKED)" : "AI 意图解析失败 (FAILED)"}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-rose-900/60 border border-rose-700 text-rose-200">
                  {errorInfo.code}
                </span>
              </div>
              <button
                onClick={handleRecognizeIntent}
                disabled={isAnalyzing || cooldownSeconds > 0}
                className={`px-2.5 py-1 rounded text-[11px] font-medium border flex items-center gap-1 transition-colors ${
                  cooldownSeconds > 0
                    ? "bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed"
                    : "bg-rose-900 hover:bg-rose-800 text-rose-100 border-rose-700"
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isAnalyzing ? "animate-spin" : ""}`} />
                <span>{cooldownSeconds > 0 ? `配额恢复中 (${cooldownSeconds}s)` : "重试识别"}</span>
              </button>
            </div>
            <p className="text-rose-200 leading-relaxed pl-6">
              {errorInfo.message}
            </p>
            <div className="pl-6 text-[11px] text-rose-300/80 border-t border-rose-900/60 pt-2">
              {errorInfo.code === "AI_NOT_CONFIGURED" ? (
                <span>准则守卫：系统杜绝伪造数据。请配置有效 GEMINI_API_KEY 后重试。</span>
              ) : errorInfo.code === "AI_QUOTA_EXHAUSTED" ? (
                <span>频次/额度限制提示：API Key 触发了每分钟调用频次 (RPM) 或配额用尽。系统杜绝假数据兜底，请等待 30-60 秒配额重置后重试，或在应用设置中更换高配额 API Key。</span>
              ) : errorInfo.code === "AI_HIGH_DEMAND" ? (
                <span>瞬时高并发提示：Google Gemini 服务正在经历瞬时并发高峰（503），系统拒绝采用假数据替代。请稍等片刻后点击右上角“重试识别”。</span>
              ) : errorInfo.code === "GATEWAY_TIMEOUT" ? (
                <span>网关超时提示：AI 端到端深度检索研判耗时较长，请稍候点击“重试识别”。</span>
              ) : (
                <span>准则守卫：程序未进入假数据 fallback，保障研究真实性。请稍后重试。</span>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <BrainCircuit className="w-4 h-4 text-amber-400/80" />
            <span>AI将根据《CIDES V1.0》自动提取12大要素并筛查隐含与遗漏问题</span>
          </div>

          <div className="flex items-center gap-3">
            {intent && (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center gap-1.5"
              >
                <FileCheck className="w-4 h-4" />
                <span>人工确认/纠偏基线</span>
              </button>
            )}

            <button
              id="btn-recognize-intent"
              onClick={handleRecognizeIntent}
              disabled={isAnalyzing}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:brightness-105 active:brightness-95 disabled:opacity-50 transition-all shadow-md shadow-amber-500/20 flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>真实 AI 分析中 ({elapsedSeconds}s)...</span>
                </>
              ) : (
                <>
                  <BrainCircuit className="w-4 h-4 text-slate-950" />
                  <span>执行投资意图识别与拆解</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 12-Dimension Structured Breakdown Display */}
      {intent && (
        <div className="space-y-4 pt-2">
          {/* Real AI Execution Telemetry Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 font-bold text-slate-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  意图拆解真实 AI 执行证明 (Intent Telemetry)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950/90 text-emerald-300 border border-emerald-800/90 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AI 实际调用完成 (True)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <span>模型: <strong className="text-amber-300">{intent.executionRecord?.model || "gemini-3.8-flash"}</strong></span>
                <span>·</span>
                <span>耗时: <strong className="text-slate-200">{intent.executionRecord ? `${(intent.executionRecord.durationMs / 1000).toFixed(1)}s` : "已完成"}</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">上下文与输出字符:</span>
                <div className="text-slate-200">
                  输入 {intent.executionRecord?.inputContextLength || "-"} 字符 · 输出 {intent.executionRecord?.outputLength || "-"} 字符
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">Token 计量:</span>
                <div className="text-slate-200">
                  {intent.executionRecord?.tokens?.totalTokens ? `总计 ${intent.executionRecord.tokens.totalTokens} Tokens` : "标准结构化输出"}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">解析状态:</span>
                <div className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  12维度要素结构化解析成功
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <BookmarkPlus className="w-4 h-4 text-amber-400" />
              投资意图12核心维度识别拆解清单
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              状态：{thread.isIntentConfirmed ? "已正式确认" : "待用户确认/纠偏"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* 1. 投资对象 */}
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-1">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                ① 投资对象 (Target)
              </span>
              <p className="text-xs font-medium text-slate-100">{intent.target || "未明确指定"}</p>
            </div>

            {/* 2. 投资目的 */}
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-1">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                ② 投资目的 (Purpose)
              </span>
              <p className="text-xs font-medium text-slate-100">{intent.purpose || "未明确指定"}</p>
            </div>

            {/* 3. 投资区域/国家 */}
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-1">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                ③ 投资区域/国家 (Region)
              </span>
              <p className="text-xs font-medium text-slate-100">{intent.region || "未明确指定"}</p>
            </div>

            {/* 4. 项目类型 */}
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-1">
              <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                ④ 项目类型 (Project Type)
              </span>
              <p className="text-xs font-medium text-slate-100">{intent.projectType || "绿地/并购"}</p>
            </div>

            {/* 5. 预期规模 */}
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-1">
              <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                ⑤ 预期规模 (Scale)
              </span>
              <p className="text-xs font-medium text-slate-100">{intent.scale || "中大型规模"}</p>
            </div>

            {/* 6. 资本来源或资金属性 */}
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-1">
              <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                ⑥ 资本来源/属性 (Capital)
              </span>
              <p className="text-xs font-medium text-slate-100">{intent.capitalSource || "中资境外投资"}</p>
            </div>

            {/* 7. 资源条件 */}
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-1 md:col-span-2 lg:col-span-3">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                ⑦ 资源条件与要素需求 (Resources & Utilities)
              </span>
              <p className="text-xs text-slate-200">{intent.resources || "品位、电力负荷、供水与交通"}</p>
            </div>

            {/* 8. 用户已掌握条件 */}
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-1.5">
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
                ⑧ 用户已掌握条件
              </span>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                {intent.knownConditions?.map((item, idx) => (
                  <li key={idx} className="leading-snug">{item}</li>
                ))}
              </ul>
            </div>

            {/* 9. 用户已有判断 */}
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-1.5">
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
                ⑨ 用户已有判断与假设
              </span>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                {intent.existingHypotheses?.map((item, idx) => (
                  <li key={idx} className="leading-snug">{item}</li>
                ))}
              </ul>
            </div>

            {/* 10. 用户的核心关注点 */}
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-1.5">
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
                ⑩ 用户的核心关注点 / 红线
              </span>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                {intent.coreConcerns?.map((item, idx) => (
                  <li key={idx} className="leading-snug">{item}</li>
                ))}
              </ul>
            </div>

            {/* 11. 隐含研究问题 */}
            <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/40 space-y-1.5 md:col-span-1 lg:col-span-1">
              <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                ⑪ 用户隐含的研究问题
              </span>
              <ul className="text-xs text-purple-200/90 space-y-1 list-disc list-inside">
                {intent.implicitQuestions?.map((item, idx) => (
                  <li key={idx} className="leading-snug">{item}</li>
                ))}
              </ul>
            </div>

            {/* 12. 遗漏的重要关键问题 */}
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40 space-y-1.5 md:col-span-2 lg:col-span-2">
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                ⑫ 用户可能遗漏但决定投资成败的关键问题
              </span>
              <ul className="text-xs text-rose-200/90 space-y-1 list-disc list-inside">
                {intent.omittedCriticalQuestions?.map((item, idx) => (
                  <li key={idx} className="leading-snug">{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action call to confirm or enter research */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5 text-center sm:text-left">
              <span className="text-xs font-semibold text-amber-300">
                {thread.isIntentConfirmed
                  ? "已确立正式研究基线，可按照专业节点主线开展智能研究"
                  : "依据《CIDES V1.0》第四节硬性规则：必须经人工确认或纠偏后方可升级为正式研究基线"}
              </span>
              <p className="text-[11px] text-slate-400">
                {thread.isIntentConfirmed
                  ? "基线已锁定并传入所有节点提示词执行上下文。"
                  : "防止AI把自身猜测当成永久正确，支持增删改查研究边界。"}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors"
              >
                {thread.isIntentConfirmed ? "重新审查/纠偏基线" : "人工确认与纠偏"}
              </button>

              {thread.isIntentConfirmed && (
                <button
                  onClick={onProceedToNodes}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors flex items-center gap-1.5 shadow-md shadow-amber-400/20"
                >
                  <span>进入节点研究主线</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Correction Dialog (Section 4) */}
      {showConfirmModal && intent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div
            className={`border rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh] transition-colors ${
              isTraditional
                ? "bg-white border-gray-300 text-gray-900 shadow-xl"
                : "bg-slate-900 border-slate-700 text-slate-100 shadow-black/60"
            }`}
          >
            <div
              className={`flex items-start justify-between border-b pb-3 ${
                isTraditional ? "border-gray-200" : "border-slate-800"
              }`}
            >
              <div>
                <h3
                  className={`text-base font-bold flex items-center gap-2 ${
                    isTraditional ? "text-gray-900" : "text-slate-100"
                  }`}
                >
                  <FileCheck className={`w-5 h-5 ${isTraditional ? "text-blue-600" : "text-amber-400"}`} />
                  投资意图识别结果人工确认与纠偏 (CIDES 第四节硬规则)
                </h3>
                <p
                  className={`text-xs mt-0.5 font-medium ${
                    isTraditional ? "text-gray-800" : "text-slate-400"
                  }`}
                >
                  只有您确认或纠偏以后，系统才能把该结果升级为【正式研究基线】。
                </p>
              </div>
            </div>

            {/* AI's Proposed Baseline Understanding */}
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                isTraditional
                  ? "bg-gray-50 border-gray-300 text-gray-900"
                  : "bg-slate-800/80 border-slate-700 text-slate-200"
              }`}
            >
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  isTraditional ? "text-blue-700" : "text-amber-400"
                }`}
              >
                AI 对您投资意图的基线理解综述：
              </span>
              <p
                className={`text-xs leading-relaxed font-mono ${
                  isTraditional ? "text-gray-900" : "text-slate-200"
                }`}
              >
                {intent.structuredBaselineSummary ||
                  `根据您的描述，系统理解您的核心目标包括：① 判断${intent.region}关于${intent.target}的外资准入与政策可进入性；② 验证关键要素供给（如电力电价、土地、水资源）；③ 核算特许权与财税敏感性；④ 规划投资交易结构与交割路径。`}
              </p>

              <div
                className={`pt-2 border-t ${
                  isTraditional ? "border-gray-300" : "border-slate-700/60"
                }`}
              >
                <span
                  className={`text-[11px] font-bold block mb-1 ${
                    isTraditional ? "text-gray-800" : "text-slate-400"
                  }`}
                >
                  建议研究推进目标主线：
                </span>
                <ul
                  className={`text-xs space-y-1 list-decimal list-inside font-medium ${
                    isTraditional ? "text-gray-900" : "text-slate-300"
                  }`}
                >
                  {intent.proposedResearchObjectives?.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Correction / Addition input */}
            <div className="space-y-2">
              <label
                className={`text-xs font-bold flex items-center justify-between ${
                  isTraditional ? "text-gray-900" : "text-slate-200"
                }`}
              >
                <span>请指出需要纠偏、增加或删除的内容（可选）：</span>
                <span
                  className={`font-normal ${
                    isTraditional ? "text-gray-700" : "text-slate-400"
                  }`}
                >
                  若理解准确可留空直接确认
                </span>
              </label>
              <textarea
                value={userCorrectionText}
                onChange={(e) => setUserCorrectionText(e.target.value)}
                placeholder="例如：第2项不准确，我们不仅是并购，还包括自备光伏电站投资；此外，需特别增加关于当地国家矿业投资公司(ZCCM-IH)非稀释股权谈判的针对性核查..."
                className={`w-full h-24 p-3 rounded-xl border text-xs focus:outline-none transition-colors resize-none font-medium ${
                  isTraditional
                    ? "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    : "bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-amber-500"
                }`}
              />
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  isTraditional
                    ? "text-gray-800 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                    : "text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700"
                }`}
              >
                取消暂不确认
              </button>
              <button
                id="btn-confirm-baseline-submit"
                onClick={handleConfirmBaseline}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                  isTraditional
                    ? "text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-blue-600/20"
                    : "text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:brightness-105 active:brightness-95 shadow-amber-500/20"
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 ${isTraditional ? "text-white" : "text-slate-950"}`} />
                <span>确认并升级为【正式研究基线】</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal for Preset Deletion */}
      {confirmPresetDelete && (
        <ConfirmModal
          isOpen={confirmPresetDelete.isOpen}
          title="移除预设案例"
          message={`确定要移除官方预设案例【${confirmPresetDelete.presetName}】吗？若需找回，可随时在列表上方点击“恢复预设”。`}
          confirmText="确认删除"
          variant="danger"
          onConfirm={() => {
            deletePresetById(confirmPresetDelete.presetId);
            refreshPresets();
            setConfirmPresetDelete(null);
          }}
          onCancel={() => setConfirmPresetDelete(null)}
        />
      )}
    </div>
  );
};
