import React, { useRef, useState } from "react";
import {
  X,
  Download,
  Upload,
  FileText,
  FileCode,
  CheckCircle2,
  HardDrive,
  Clock,
  Sparkles,
  FileCheck,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { ProjectThread } from "../types/cides";
import { exportThreadAsJSON, importThreadFromJSON } from "../utils/storage";
import {
  exportFullResearchReportDocx,
  exportFullResearchReportMarkdown,
  exportExecutionLogMarkdown,
  exportExecutionLogJSON,
} from "../utils/exportReports";

interface ExportArchiveModalProps {
  thread: ProjectThread;
  isOpen?: boolean;
  onClose: () => void;
  onThreadRestored?: (thread: ProjectThread) => void;
  onThreadUpdate?: (thread: ProjectThread) => void;
}

export const ExportArchiveModal: React.FC<ExportArchiveModalProps> = ({
  thread,
  isOpen = true,
  onClose,
  onThreadRestored,
  onThreadUpdate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const handleSaveJsonArchive = () => {
    exportThreadAsJSON(thread);
    showFeedback("✅ 研究项目档案 (.json) 已保存至您的本地 Downloads 目录，可随时重新打开继续研究！");
  };

  const handleOpenJsonArchive = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const restored = importThreadFromJSON(text);
        if (onThreadRestored) {
          onThreadRestored(restored);
        } else if (onThreadUpdate) {
          onThreadUpdate(restored);
        }
        showFeedback(`✅ 成功载入项目【${restored.title}】！已恢复节点状态与全部历史。`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } catch (err: any) {
        alert("载入档案失败: " + err.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    try {
      await exportFullResearchReportDocx(thread);
      showFeedback("✅ Word 研判档案 (.docx) 导出成功，Windows Word 可直接打开！");
    } catch (e: any) {
      alert("导出 Word 失败: " + e.message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleExportMarkdown = () => {
    exportFullResearchReportMarkdown(thread);
    showFeedback("✅ 完整研究报告 Markdown (.md) 导出成功！");
  };

  const handleExportLogMd = () => {
    exportExecutionLogMarkdown(thread);
    showFeedback("✅ 完整 AI 运行日志 Markdown (.md) 导出成功！");
  };

  const handleExportLogJson = () => {
    exportExecutionLogJSON(thread);
    showFeedback("✅ 完整 AI 运行日志 JSON (.json) 导出成功！");
  };

  const executedNodeCount = Object.values(thread.phaseResults).filter((l) => l.length > 0).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                CIDES V1.02 本地保存、恢复与报告导出中心
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                支持 Windows 本地一键存储、断点无损恢复及办公文件 (DOCX / MD / JSON) 规范导出
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

        {/* Status banner */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">当前项目：</span>
            <strong className="text-slate-100">{thread.title}</strong>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span>已执行节点: <strong className="text-amber-400">{executedNodeCount}</strong>/{thread.nodes.length}</span>
            <span>分支: <strong className="text-purple-400">{thread.activeBranches.length}</strong></span>
          </div>
        </div>

        {feedbackMessage && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2 transition-all">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Section 1: Save & Restore */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            1. Research Thread 本地保存与恢复（机器可完整恢复档案）
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              id="btn-save-project-archive"
              onClick={handleSaveJsonArchive}
              className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-left space-y-1.5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-100 group-hover:text-amber-300 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-amber-400" />
                  保存研究项目 (.json)
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  全量快照
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                完整保存当前立项意图、AI分析、所有节点成果版本历史、动态分支核验记录与投委会决议。
              </p>
            </button>

            <button
              id="btn-open-project-archive"
              onClick={() => fileInputRef.current?.click()}
              className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 text-left space-y-1.5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-100 group-hover:text-blue-300 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-blue-400" />
                  打开/恢复研究项目
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  断点续研
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                选择本地保存的 CIDES .json 档案，瞬间恢复研究状态与上下文，从上次中断处继续推进。
              </p>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleOpenJsonArchive}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {/* Section 2: Research Reports */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            2. 办公用研判报告导出（Windows Word & Markdown）
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              id="btn-export-full-docx"
              onClick={handleExportDocx}
              disabled={isExportingDocx}
              className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 text-left space-y-1.5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-100 group-hover:text-emerald-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  导出 Word 完整研判报告 (.docx)
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  办公即用
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                规范排版，中文无乱码，标题层级清晰，包含立项基线、各节点成果、动态分支与投委会决议。
              </p>
            </button>

            <button
              id="btn-export-full-md"
              onClick={handleExportMarkdown}
              className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 text-left space-y-1.5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-100 group-hover:text-purple-300 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-purple-400" />
                  导出完整研判报告 (.md)
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  一至十二章
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                按照 CIDES V1.02 标准结构导出的纯文本 Markdown 文件，方便团队协作与知识库归档。
              </p>
            </button>
          </div>
        </div>

        {/* Section 3: Execution Logs */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            3. AI 运行日志与真实执行审计凭据导出
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              id="btn-export-log-md"
              onClick={handleExportLogMd}
              className="p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-left space-y-1 transition-all group"
            >
              <span className="text-xs font-bold text-slate-100 group-hover:text-amber-300 flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-amber-400" />
                运行日志 Markdown (.md)
              </span>
              <p className="text-[11px] text-slate-400">
                含每次 Gemini 调用的耗时、Tokens、联网检索状态与真实源凭证。
              </p>
            </button>

            <button
              id="btn-export-log-json"
              onClick={handleExportLogJson}
              className="p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-left space-y-1 transition-all group"
            >
              <span className="text-xs font-bold text-slate-100 group-hover:text-emerald-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-400" />
                运行日志 JSON (.json)
              </span>
              <p className="text-[11px] text-slate-400">
                机器可读的结构化 Execution Records 原始日志集，方便程序自动化审计。
              </p>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-[11px] text-slate-500">
          <span>《CIDES自然语言运行定义 V1.02》档案治理引擎</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
