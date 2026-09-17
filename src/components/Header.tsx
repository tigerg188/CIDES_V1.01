import React, { useRef, useState } from "react";
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
  FolderKanban,
  PlusCircle,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";
import { ProjectThread } from "../types/cides";
import { exportThreadAsJSON, importThreadFromJSON, clearThread, createNewThread } from "../utils/storage";
import { useTheme } from "../context/ThemeContext";
import { ConfirmModal } from "./ConfirmModal";

interface HeaderProps {
  thread: ProjectThread;
  onThreadUpdate: (updated: ProjectThread) => void;
  onOpenPromptManager: () => void;
  onOpenAcceptanceSuite: () => void;
  onOpenFinalDecision: () => void;
  onOpenExportArchive: () => void;
  onOpenProjectManager: () => void;
  onNewProject: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  thread,
  onThreadUpdate,
  onOpenPromptManager,
  onOpenAcceptanceSuite,
  onOpenFinalDecision,
  onOpenExportArchive,
  onOpenProjectManager,
  onNewProject,
}) => {
  const { theme, setTheme, isTraditional } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importStatusModal, setImportStatusModal] = useState<{ isOpen: boolean; message: string; isError?: boolean } | null>(null);

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
        setImportStatusModal({
          isOpen: true,
          message: "成功恢复 CIDES 完整研究线程！所有已确认成果、节点Prompt版本与分支记录已载入。",
        });
      } catch (err: any) {
        setImportStatusModal({
          isOpen: true,
          message: "导入失败: " + err.message,
          isError: true,
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleResetConfirm = () => {
    const fresh = clearThread();
    onThreadUpdate(fresh);
    setShowResetConfirm(false);
  };

  const confirmedCount = Object.values(thread.phaseResults).filter(
    (list) => list.some((r) => r.status === "confirmed")
  ).length;

  return (
    <header
      className={`sticky top-0 z-40 backdrop-blur border-b transition-colors ${
        isTraditional
          ? "bg-white/95 border-gray-200 text-gray-800 shadow-xs"
          : "bg-slate-900/95 border-slate-800 text-slate-200"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Core Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-500 p-0.5 shadow-lg shadow-blue-500/20">
            <div className={`w-full h-full rounded-[10px] flex items-center justify-center ${isTraditional ? "bg-white" : "bg-slate-950"}`}>
              <span className={`font-extrabold text-base tracking-tighter font-mono ${isTraditional ? "text-blue-600" : "text-amber-400"}`}>
                CIDES
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-base font-bold tracking-tight ${isTraditional ? "text-gray-900" : "text-slate-100"}`}>
                CIDES 跨境投资开发专家系统
              </h1>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                  isTraditional
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}
              >
                自然语言运行定义 V1.0
              </span>
            </div>
            <p className={`text-xs truncate max-w-md hidden sm:block ${isTraditional ? "text-gray-500" : "text-slate-400"}`}>
              {thread.title || "投资意图驱动 · 节点提示词管理 · 搜索验证 · 动态分支 · 人工逐层确认"}
            </p>
          </div>
        </div>

        {/* Global Progress Indicators */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
              isTraditional
                ? "bg-gray-50 border-gray-200 text-gray-700"
                : "bg-slate-800/80 border-slate-700/60 text-slate-300"
            }`}
          >
            <span className={isTraditional ? "text-gray-500" : "text-slate-400"}>研究基线:</span>
            <span className={thread.isIntentConfirmed ? "text-emerald-600 dark:text-emerald-400 font-semibold" : isTraditional ? "text-amber-600 font-semibold" : "text-amber-400 font-semibold"}>
              {thread.isIntentConfirmed ? "已正式锁定" : "待确认"}
            </span>
          </div>
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
              isTraditional
                ? "bg-gray-50 border-gray-200 text-gray-700"
                : "bg-slate-800/80 border-slate-700/60 text-slate-300"
            }`}
          >
            <span className={isTraditional ? "text-gray-500" : "text-slate-400"}>已确认节点:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{confirmedCount} / {thread.nodes.length}</span>
          </div>
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
              isTraditional
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-emerald-950/40 border-emerald-800/40 text-emerald-300"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Gemini-3.8-Flash 真实执行</span>
          </div>
          {thread.activeBranches.length > 0 && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
                isTraditional
                  ? "bg-purple-50 border-purple-200 text-purple-700"
                  : "bg-purple-950/40 border-purple-800/40 text-purple-300"
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-purple-500" />
              <span>分支: {thread.activeBranches.length}个</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* New Project Button */}
          <button
            id="btn-new-project"
            onClick={onNewProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
            title="新建跨境投资研究项目"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>新建项目</span>
          </button>

          {/* Project Management Center Button */}
          <button
            id="btn-open-project-manager"
            onClick={onOpenProjectManager}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors shadow-xs ${
              isTraditional
                ? "bg-white hover:bg-gray-100 text-gray-900 border-gray-300"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600"
            }`}
            title="打开项目管理面板，查看历史档案或删除项目"
          >
            <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">项目管理</span>
          </button>

          {/* Theme Switcher (Traditional vs Night) */}
          <div
            className={`flex items-center p-0.5 rounded-lg border text-xs ${
              isTraditional
                ? "bg-gray-100 border-gray-300"
                : "bg-slate-800/80 border-slate-700"
            }`}
          >
            <button
              onClick={() => setTheme("traditional")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${
                theme === "traditional"
                  ? isTraditional
                    ? "bg-white text-blue-700 shadow-xs border border-gray-300"
                    : "bg-white text-gray-900 shadow-xs"
                  : isTraditional
                  ? "text-gray-800 hover:text-gray-950 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="传统日光版浅色界面"
            >
              <Sun className={`w-3.5 h-3.5 ${isTraditional ? "text-blue-600" : "text-amber-500"}`} />
              <span className="hidden lg:inline">传统日光版</span>
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${
                theme === "dark"
                  ? "bg-slate-950 text-amber-400 shadow-xs border border-slate-700"
                  : isTraditional
                  ? "text-gray-800 hover:text-gray-950 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="夜晚界面（现有黑底色模式）"
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden lg:inline">深色夜间版</span>
            </button>
          </div>

          {/* Prompt Manager Button */}
          <button
            id="btn-open-prompt-manager"
            onClick={onOpenPromptManager}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors shadow-xs ${
              isTraditional
                ? "bg-white hover:bg-gray-100 text-gray-900 border-gray-300"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600"
            }`}
            title="查看、修改、版本管理与回滚节点专属提示词（硬性要求）"
          >
            <Sliders className={`w-3.5 h-3.5 ${isTraditional ? "text-blue-600" : "text-amber-400"}`} />
            <span className="hidden xl:inline">节点提示词资产</span>
          </button>

          {/* Section 41 & 42 Acceptance Test Suite Button */}
          <button
            id="btn-open-acceptance-suite"
            onClick={onOpenAcceptanceSuite}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors shadow-xs ${
              isTraditional
                ? "bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300"
                : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30"
            }`}
            title="V1.0 规范验收套件：单独测试第41节8大Prompt功能测试及第42节13条标准"
          >
            <Award className={`w-3.5 h-3.5 ${isTraditional ? "text-amber-800" : "text-amber-400"}`} />
            <span className="hidden xl:inline">规范验收测试</span>
          </button>

          {/* Final Investment Decision Entry */}
          <button
            id="btn-open-final-decision"
            onClick={onOpenFinalDecision}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors border shadow-xs ${
              thread.finalDecision
                ? isTraditional
                  ? "bg-emerald-100 text-emerald-950 border-emerald-300"
                  : "bg-emerald-950/60 text-emerald-300 border-emerald-700"
                : isTraditional
                ? "bg-white hover:bg-gray-100 text-gray-900 border-gray-300"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
            }`}
            title="人工最终投资决策控制台（AI仅供研判，人作最终定案）"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${isTraditional ? "text-emerald-700" : "text-emerald-400"}`} />
            <span className="hidden sm:inline">
              {thread.finalDecision ? "已决策" : "投资决策案"}
            </span>
          </button>

          {/* V1.02 Local Archive & Report Export Center (Requirements 14-20) */}
          <button
            id="btn-open-export-archive"
            onClick={onOpenExportArchive}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
              isTraditional
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gradient-to-r from-amber-500/20 to-blue-500/20 hover:from-amber-500/30 hover:to-blue-500/30 text-amber-200 border border-amber-500/40"
            }`}
            title="一键本地保存项目、载入恢复及导出 Word/Markdown/日志"
          >
            <Download className={`w-3.5 h-3.5 ${isTraditional ? "text-white" : "text-amber-400"}`} />
            <span className="hidden sm:inline">保存/导出报告</span>
          </button>

          {/* Direct Reset */}
          <button
            id="btn-reset-thread"
            onClick={() => setShowResetConfirm(true)}
            className={`p-1.5 rounded-lg transition-colors ${
              isTraditional
                ? "text-gray-700 hover:text-red-700 hover:bg-gray-100"
                : "text-slate-400 hover:text-rose-400 hover:bg-slate-800"
            }`}
            title="新建/重置研究项目"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Confirm Reset Thread Modal */}
      {showResetConfirm && (
        <ConfirmModal
          isOpen={showResetConfirm}
          title="重置当前研究项目"
          message="确定要重置当前研究线程并新建项目吗？重置前建议先点击【保存/导出报告】备份当前研究数据。"
          confirmText="确认重置并新建"
          variant="warning"
          onConfirm={handleResetConfirm}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {/* Import Status Alert Modal */}
      {importStatusModal && (
        <ConfirmModal
          isOpen={importStatusModal.isOpen}
          title={importStatusModal.isError ? "导入失败" : "档案导入成功"}
          message={importStatusModal.message}
          confirmText="知道了"
          variant={importStatusModal.isError ? "danger" : "primary"}
          onConfirm={() => setImportStatusModal(null)}
          onCancel={() => setImportStatusModal(null)}
        />
      )}
    </header>
  );
};
