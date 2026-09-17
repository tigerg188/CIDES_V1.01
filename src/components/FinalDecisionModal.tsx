import React, { useState } from "react";
import {
  ShieldCheck,
  X,
  FileSignature,
  AlertOctagon,
  CheckCircle2,
  FileText,
  DollarSign,
  UserCheck,
  Building,
} from "lucide-react";
import { ProjectThread, FinalDecisionRecord } from "../types/cides";

interface FinalDecisionModalProps {
  thread: ProjectThread;
  onClose: () => void;
  onSaveDecision: (decision: FinalDecisionRecord) => void;
}

export const FinalDecisionModal: React.FC<FinalDecisionModalProps> = ({
  thread,
  onClose,
  onSaveDecision,
}) => {
  const [decisionType, setDecisionType] = useState<"go" | "conditional_go" | "no_go" | "pending_further_study">(
    thread.finalDecision?.decision || "conditional_go"
  );
  const [decidedBy, setDecidedBy] = useState(
    thread.finalDecision?.decidedBy || "境外投资决策委员会 / 投委会主席"
  );
  const [rationale, setRationale] = useState(
    thread.finalDecision?.rationale ||
      "鉴于项目资源品位扎实、宏观准入清晰，但在国家电网限电与特许权使用费阶梯波动上存在下行风险，决定在严格达成以下交割先决条件的前提下，有条件批准推进SPA协议起草与现场详细尽调。"
  );
  const [maxLimit, setMaxLimit] = useState(thread.finalDecision?.maxInvestmentLimitUSD || "140,000,000");
  const [conditionsText, setConditionsText] = useState(
    thread.finalDecision?.conditionsPrecedent?.join("\n") ||
      "1. 取得国家电力公司关于最低25MW保底供电专线的正式书面PPA确认函\n2. 经司法部公证确认采矿许可证大矿权无小矿民重叠诉讼\n3. 设立离岸SPV双层架构并向商务部与发改委完成境外投资(ODI)备案"
  );
  const [redlinesText, setRedlinesText] = useState(
    thread.finalDecision?.criticalRedlines?.join("\n") ||
      "1. 若东道国修法要求外资无偿出让超过15%的国有股干股，立即终止交易\n2. 若电价超过0.10美元/kWh或无法保证85%以上开机率，项目财务不可行，即刻一票否决\n3. 严禁以现金形式结算任何无正式发票的政府性规费"
  );

  const handleSave = () => {
    if (!rationale.trim() || !decidedBy.trim()) {
      alert("请填写决策依据与签署人名称！");
      return;
    }

    const record: FinalDecisionRecord = {
      decision: decisionType,
      rationale: rationale.trim(),
      decidedBy: decidedBy.trim(),
      decidedAt: new Date().toISOString(),
      conditionsPrecedent: conditionsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      criticalRedlines: redlinesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      maxInvestmentLimitUSD: maxLimit.trim() || undefined,
    };

    onSaveDecision(record);
    onClose();
  };

  const confirmedNodesCount = Object.values(thread.phaseResults).filter((list) =>
    list.some((r) => r.status === "confirmed")
  ).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  人工最终投资决策控制台 (CIDES 第三十四节硬规则)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  AI仅供研判 · 人作最终定案
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                严禁系统代替人工做出投资决策；系统提供高置信度案卷与客观依据，决策权必须完全归属于人类投资人。
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

        {/* Dossier Pre-requisite summary */}
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block mb-0.5">研究基线状态:</span>
            <span className="text-emerald-400 font-bold font-mono">
              {thread.isIntentConfirmed ? "正式基线已锁定" : "未锁定"}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block mb-0.5">人工确认节点数:</span>
            <span className="text-slate-200 font-bold font-mono">
              {confirmedNodesCount} / {thread.nodes.length}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block mb-0.5">分支研究合并数:</span>
            <span className="text-purple-300 font-bold font-mono">
              {thread.activeBranches.filter((b) => b.status === "merged_to_mainline").length} 个
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block mb-0.5">决策状态:</span>
            <span className={thread.finalDecision ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
              {thread.finalDecision ? "已签署归档" : "待签署"}
            </span>
          </div>
        </div>

        {/* Decision Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-200 block">
            最终投资定案结论 (Decision Outcome)：
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <button
              type="button"
              onClick={() => setDecisionType("go")}
              className={`p-3 rounded-xl border text-left transition-all ${
                decisionType === "go"
                  ? "bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold"
                  : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>准予投资 (Go)</span>
              </div>
              <p className="text-[10px] font-normal opacity-80">
                无致命瑕疵，风险完全可控
              </p>
            </button>

            <button
              type="button"
              onClick={() => setDecisionType("conditional_go")}
              className={`p-3 rounded-xl border text-left transition-all ${
                decisionType === "conditional_go"
                  ? "bg-amber-950/60 border-amber-500 text-amber-200 font-bold"
                  : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>附条件批准</span>
              </div>
              <p className="text-[10px] font-normal opacity-80">
                须满足所有先决条件(CPs)
              </p>
            </button>

            <button
              type="button"
              onClick={() => setDecisionType("pending_further_study")}
              className={`p-3 rounded-xl border text-left transition-all ${
                decisionType === "pending_further_study"
                  ? "bg-blue-950/60 border-blue-500 text-blue-200 font-bold"
                  : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>暂缓/补充论证</span>
              </div>
              <p className="text-[10px] font-normal opacity-80">
                关键参数存疑，需进一步核验
              </p>
            </button>

            <button
              type="button"
              onClick={() => setDecisionType("no_go")}
              className={`p-3 rounded-xl border text-left transition-all ${
                decisionType === "no_go"
                  ? "bg-rose-950/60 border-rose-500 text-rose-200 font-bold"
                  : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                <span>一票否决 (No-Go)</span>
              </div>
              <p className="text-[10px] font-normal opacity-80">
                触碰核心红线，终止投资
              </p>
            </button>
          </div>
        </div>

        {/* Decision Rationale */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-200 block">
            投委会定案决议与核心理由说明 (Decision Memo & Rationale)：
          </label>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            className="w-full h-24 p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-400 resize-none font-sans leading-relaxed"
          />
        </div>

        {/* Two-Column Conditions Precedent & Redlines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300 flex items-center justify-between">
              <span>交割先决条件清单 (Conditions Precedent)：</span>
              <span className="text-[10px] text-slate-500">每行一条</span>
            </label>
            <textarea
              value={conditionsText}
              onChange={(e) => setConditionsText(e.target.value)}
              className="w-full h-24 p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-[11px] focus:outline-none focus:border-amber-400 resize-none font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300 flex items-center justify-between">
              <span>投资致命红线一票否决边界 (Redlines)：</span>
              <span className="text-[10px] text-slate-500">每行一条</span>
            </label>
            <textarea
              value={redlinesText}
              onChange={(e) => setRedlinesText(e.target.value)}
              className="w-full h-24 p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-rose-200 text-[11px] focus:outline-none focus:border-rose-400 resize-none font-mono"
            />
          </div>
        </div>

        {/* Signatory and Investment Cap */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              授权投资最高金额上限 (USD)：
            </label>
            <div className="relative">
              <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={maxLimit}
                onChange={(e) => setMaxLimit(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              投委会决策签署人 / 责任主体：
            </label>
            <div className="relative">
              <UserCheck className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={decidedBy}
                onChange={(e) => setDecidedBy(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            决策签署后将载入项目不可篡改审计案卷。
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              取消
            </button>
            <button
              id="btn-save-final-decision"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:brightness-105 active:brightness-95 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <FileSignature className="w-4 h-4 text-slate-950" />
              <span>签署并正式保存投资决策案</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
