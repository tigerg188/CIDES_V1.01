import React from "react";
import { X, ExternalLink, ShieldCheck, AlertCircle, FileText, Calendar, Building2 } from "lucide-react";
import { EvidenceItem } from "../types/cides";

interface EvidenceInspectorModalProps {
  evidence: EvidenceItem | null;
  onClose: () => void;
}

export const EvidenceInspectorModal: React.FC<EvidenceInspectorModalProps> = ({
  evidence,
  onClose,
}) => {
  if (!evidence) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              证据链条核验详情 (CIDES 第二十四节: 证据可追溯)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {/* Title */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
              证据/文件标题
            </span>
            <p className="font-semibold text-slate-100 text-sm">
              {evidence.title}
            </p>
          </div>

          {/* Source & Date */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 font-mono">
            <div>
              <span className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                <Building2 className="w-3 h-3 text-slate-400" /> 出处与权威机构
              </span>
              <span className="text-slate-200 font-semibold">{evidence.source}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                <Calendar className="w-3 h-3 text-slate-400" /> 发布/生效时间
              </span>
              <span className="text-slate-200">{evidence.date || "未记载具体年份"}</span>
            </div>
          </div>

          {/* Snippet / Raw Excerpt */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 block">
              关键原文摘录或核心法定条款 (Snippet)
            </span>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-serif leading-relaxed text-xs border-l-2 border-l-amber-500">
              "{evidence.snippet}"
            </div>
          </div>

          {/* Reliability & URL */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">核验可信度评级：</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                {evidence.reliability}
              </span>
            </div>

            {evidence.url && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">官方公报/核验证明：</span>
                <a
                  href={evidence.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono hover:underline"
                >
                  <span>查看官方档案文号</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {evidence.contradictionNotes && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-[11px] flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                <span><strong>相反或冲突证据标记：</strong>{evidence.contradictionNotes}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            关闭详情
          </button>
        </div>
      </div>
    </div>
  );
};
