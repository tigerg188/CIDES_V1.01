import React, { useRef } from "react";
import {
  FileText,
  Sliders,
  CheckCircle2,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  GitBranch,
  ShieldCheck,
  Award,
} from "lucide-react";
import { ProjectThread } from "../types/cides";
import { exportThreadAsJSON, importThreadFromJSON, clearThread } from "../utils/storage";

interface HeaderProps {
  thread: ProjectThread;
  onThreadUpdate: (updated: ProjectThread) => void;
  onOpenPromptManager: () => void;
  onOpenAcceptanceSuite: () => void;
  onOpenFinalDecision: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  thread,
  onThreadUpdate,
  onOpenPromptManager,
  onOpenAcceptanceSuite,
  onOpenFinalDecision,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    exportThreadAsJSON(thread);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const restored = importThreadFromJSON(content);
        onThreadUpdate(restored);
        alert("成功恢复 CIDES 完整研究线程！所有已确认成果、节点Prompt版本与分支记录已载入。");
      } catch (err: any) {
        alert("导入失败: " + err.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReset = () => {
    if (confirm("确定要重置当前研究线程并新建项目吗？建议先点击【导出归档】备份当前研究。")) {
      const fresh = clearThread();
      onThreadUpdate(fresh);
    }
  };

  const confirmedCount = Object.values(thread.phaseResults).filter(
    (list) => list.some((r) => r.status === "confirmed")
  ).length;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Core Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 p-0.5 shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <span className="font-extrabold text-amber-400 text-base tracking-tighter font-mono">
                CIDES
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100 tracking-tight">
                CIDES 跨境投资开发专家系统
              </h1>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                自然语言运行定义 V1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-md hidden sm:block">
              {thread.title || "投资意图驱动 · 节点提示词管理 · 搜索验证 · 动态分支 · 人工逐层确认"}
            </p>
          </div>
        </div>

        {/* Global Progress Indicators */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60">
            <span className="text-slate-400">研究基线:</span>
            <span className={thread.isIntentConfirmed ? "text-emerald-400 font-semibold" : "text-amber-400"}>
              {thread.isIntentConfirmed ? "已正式锁定" : "待确认"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60">
            <span className="text-slate-400">已确认节点:</span>
            <span className="text-emerald-400 font-semibold">{confirmedCount} / {thread.nodes.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Gemini-3.8-Flash 真实执行</span>
          </div>
          {thread.activeBranches.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/40 border border-purple-800/40 text-purple-300">
              <GitBranch className="w-3.5 h-3.5" />
              <span>分支: {thread.activeBranches.length}个</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Prompt Manager Button */}
          <button
            id="btn-open-prompt-manager"
            onClick={onOpenPromptManager}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-colors shadow-sm"
            title="查看、修改、版本管理与回滚节点专属提示词（硬性要求）"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">节点提示词资产</span>
          </button>

          {/* Section 41 & 42 Acceptance Test Suite Button */}
          <button
            id="btn-open-acceptance-suite"
            onClick={onOpenAcceptanceSuite}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors shadow-sm"
            title="V1.0 规范验收套件：单独测试第41节8大Prompt功能测试及第42节13条标准"
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">规范验收测试</span>
          </button>

          {/* Final Investment Decision Entry */}
          <button
            id="btn-open-final-decision"
            onClick={onOpenFinalDecision}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border shadow-sm ${
              thread.finalDecision
                ? "bg-emerald-950/60 text-emerald-300 border-emerald-700"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
            }`}
            title="人工最终投资决策控制台（AI仅供研判，人作最终定案）"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">
              {thread.finalDecision ? "已完成决策案" : "投资决策案"}
            </span>
          </button>

          {/* Import / Export / Reset Utilities (Section 29, 30, 31) */}
          <div className="h-5 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

          <button
            id="btn-export-thread"
            onClick={handleExport}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="本地保存完整研究线程（JSON归档）"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            id="btn-import-thread"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="从本地文件恢复研究线程"
          >
            <Upload className="w-4 h-4" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />

          <button
            id="btn-reset-thread"
            onClick={handleReset}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="新建/重置研究项目"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
