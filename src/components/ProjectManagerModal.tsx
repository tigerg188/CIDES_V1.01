import React, { useState, useEffect } from "react";
import {
  FolderKanban,
  PlusCircle,
  Trash2,
  ExternalLink,
  Clock,
  Layers,
  Sparkles,
  RotateCcw,
  X,
  FileText,
} from "lucide-react";
import {
  ProjectSummary,
  getProjectList,
  deleteProjectById,
  createNewThread,
  restoreAllPresets,
  deletePresetById,
  getActivePresets,
  saveThread,
} from "../utils/storage";
import { ProjectThread } from "../types/cides";
import { InvestmentPreset } from "../data/samplePresets";
import { useTheme } from "../context/ThemeContext";
import { ConfirmModal } from "./ConfirmModal";

interface ProjectManagerModalProps {
  isOpen: boolean;
  currentThread: ProjectThread;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  onRefreshPresets?: () => void;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  currentThread,
  onClose,
  onSelectProject,
  onNewProject,
  onRefreshPresets,
}) => {
  const { isTraditional } = useTheme();
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [presets, setPresets] = useState<InvestmentPreset[]>([]);
  const [activeTab, setActiveTab] = useState<"projects" | "presets">("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  } | null>(null);

  const reloadData = () => {
    setProjectList(getProjectList());
    setPresets(getActivePresets());
  };

  useEffect(() => {
    if (isOpen) {
      reloadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const proj = projectList.find((p) => p.id === projectId);
    const projName = proj?.title || "该项目";
    setConfirmState({
      isOpen: true,
      title: "删除项目案卷",
      message: `确定要彻底删除项目【${projName}】吗？删除后该档案将从本地清除。`,
      action: () => {
        const { isCurrentDeleted } = deleteProjectById(projectId, currentThread.id);
        reloadData();
        if (isCurrentDeleted) {
          onNewProject();
        }
      },
    });
  };

  const handleDeletePreset = (e: React.MouseEvent, presetId: string, name: string) => {
    e.stopPropagation();
    setConfirmState({
      isOpen: true,
      title: "移除预设案例",
      message: `确定要移除官方预设案例【${name}】吗？若需找回可随时点击“恢复全部预设”。`,
      action: () => {
        deletePresetById(presetId);
        reloadData();
        if (onRefreshPresets) onRefreshPresets();
      },
    });
  };

  const handleRestorePresets = () => {
    restoreAllPresets();
    reloadData();
    if (onRefreshPresets) onRefreshPresets();
  };

  const filteredProjects = projectList.filter((p) =>
    (p.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPresets = presets.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
        <div
          className={`w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl shadow-2xl border transition-colors ${
            isTraditional
              ? "bg-white text-gray-900 border-gray-300 shadow-xl"
              : "bg-slate-900 text-slate-100 border-slate-700 shadow-black/60"
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-6 py-4 border-b ${
              isTraditional
                ? "bg-gray-50 border-gray-200"
                : "bg-slate-950/60 border-slate-800"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
                <FolderKanban className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <span className={isTraditional ? "text-gray-900" : "text-white"}>项目管理中心</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
                    {projectList.length} 个本地项目
                  </span>
                </h2>
                <p
                  className={`text-xs font-medium ${
                    isTraditional ? "text-gray-800" : "text-slate-300"
                  }`}
                >
                  快速新建项目、切换已完成或进行中的研判档案，管理官方预设案例
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onNewProject();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-sm transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>新建项目</span>
              </button>
              <button
                onClick={onClose}
                className={`p-1.5 rounded-lg transition-colors ${
                  isTraditional
                    ? "text-gray-700 hover:text-gray-950 hover:bg-gray-100"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation & Search Bar */}
          <div
            className={`px-6 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isTraditional
                ? "bg-white border-gray-200"
                : "bg-slate-900 border-slate-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("projects")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "projects"
                    ? isTraditional
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-xs"
                    : isTraditional
                    ? "text-gray-800 hover:text-blue-700 hover:bg-gray-100 border border-gray-300"
                    : "text-slate-300 hover:text-slate-100 hover:bg-slate-800"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>我的研究项目 ({projectList.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("presets")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "presets"
                    ? isTraditional
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                    : isTraditional
                    ? "text-gray-800 hover:text-amber-800 hover:bg-gray-100 border border-gray-300"
                    : "text-slate-300 hover:text-slate-100 hover:bg-slate-800"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>预设官方案例 ({presets.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={
                  activeTab === "projects" ? "搜索项目名称..." : "搜索预设案例、国家、行业..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-48 sm:w-64 px-3 py-1.5 rounded-lg text-xs border font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                  isTraditional
                    ? "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                    : "bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
                }`}
              />
              {activeTab === "presets" && (
                <button
                  onClick={handleRestorePresets}
                  title="恢复所有被删除或隐藏的官方预设案例"
                  className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 ${
                    isTraditional
                      ? "border-gray-300 hover:bg-gray-100 text-gray-900 bg-white"
                      : "border-slate-700 hover:bg-slate-800 text-slate-200"
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">恢复全部预设</span>
                </button>
              )}
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "projects" ? (
              filteredProjects.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <FolderKanban
                    className={`w-12 h-12 mx-auto ${
                      isTraditional ? "text-gray-400" : "text-slate-600"
                    }`}
                  />
                  <p
                    className={`text-sm font-semibold ${
                      isTraditional ? "text-gray-800" : "text-slate-300"
                    }`}
                  >
                    {searchQuery ? "没有找到符合搜索条件的项目" : "暂无保存的项目历史记录"}
                  </p>
                  <button
                    onClick={() => {
                      onNewProject();
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>立即新建第一个跨境研究项目</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredProjects.map((p) => {
                    const isCurrent = p.id === currentThread.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          onSelectProject(p.id);
                          onClose();
                        }}
                        className={`relative group p-4 rounded-xl border transition-all cursor-pointer ${
                          isCurrent
                            ? isTraditional
                              ? "bg-blue-50 border-blue-600 shadow-sm ring-1 ring-blue-500"
                              : "bg-blue-950/30 border-blue-500/80 shadow-md ring-1 ring-blue-500/60"
                            : isTraditional
                            ? "bg-white hover:bg-gray-50 border-gray-300 hover:border-blue-500 shadow-xs"
                            : "bg-slate-800/60 hover:bg-slate-800 border-slate-700 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm line-clamp-1 ${isTraditional ? "text-gray-900" : "text-slate-100"}`}>
                              {p.title}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white shrink-0">
                                当前正在编辑
                              </span>
                            )}
                          </div>

                          {/* Delete Button */}
                          <button
                            onClick={(e) => handleDeleteProject(e, p.id)}
                            title="删除该项目研究案卷"
                            className="p-1 rounded-md text-red-600 hover:text-white hover:bg-red-600 transition-colors border border-transparent hover:border-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px]">
                          <span
                            className={`px-2 py-0.5 rounded border font-semibold ${
                              p.isIntentConfirmed
                                ? isTraditional
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : isTraditional
                                ? "bg-amber-100 text-amber-950 border-amber-300"
                                : "bg-slate-900 text-slate-300 border-slate-700"
                            }`}
                          >
                            {p.isIntentConfirmed ? "基线已锁定" : "意图待确立"}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded border flex items-center gap-1 font-semibold ${
                              isTraditional
                                ? "bg-gray-100 text-gray-900 border-gray-300"
                                : "bg-slate-900 text-slate-200 border-slate-700"
                            }`}
                          >
                            <Layers className="w-3 h-3 text-blue-600" />
                            <span>已确认节点: {p.completedNodesCount} / {p.totalNodesCount}</span>
                          </span>

                          {p.hasFinalDecision && (
                            <span
                              className={`px-2 py-0.5 rounded border font-semibold ${
                                isTraditional
                                  ? "bg-purple-100 text-purple-900 border-purple-300"
                                  : "bg-purple-500/10 text-purple-300 border-purple-500/20"
                              }`}
                            >
                              已形成定案
                            </span>
                          )}
                        </div>

                        {/* Footer Details */}
                        <div
                          className={`flex items-center justify-between text-[11px] pt-2 border-t ${
                            isTraditional
                              ? "border-gray-200 text-gray-800"
                              : "border-slate-700/60 text-slate-300"
                          }`}
                        >
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3 text-gray-700 dark:text-slate-400" />
                            更新于 {new Date(p.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-0.5 font-bold">
                            进入研究 <ExternalLink className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              // Presets Tab
              <div className="space-y-4">
                <div
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed font-semibold flex items-center justify-between ${
                    isTraditional
                      ? "bg-amber-50 border-amber-300 text-amber-950"
                      : "bg-amber-950/30 border-amber-700/50 text-amber-200"
                  }`}
                >
                  <span>
                    💡 官方预设案例库包含铜矿绿地建厂、湿法冶炼并购、光伏电池基地与海水淡化等典型跨境投资意图。您可以载入研究，也可以随时删除不需要的案例或一键恢复。
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-all group ${
                        isTraditional
                          ? "bg-white hover:bg-gray-50 border-gray-300 shadow-xs"
                          : "bg-slate-800/50 hover:bg-slate-800 border-slate-700"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className={`text-xs font-bold line-clamp-1 ${isTraditional ? "text-gray-900" : "text-slate-100"}`}>
                            {preset.name}
                          </h4>
                          <button
                            onClick={(e) =>
                              handleDeletePreset(e, preset.id, preset.name)
                            }
                            title="删除/隐藏该预设案例"
                            className="p-1 rounded text-red-600 hover:text-white hover:bg-red-600 transition-colors border border-transparent hover:border-red-600 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-2 border ${
                            isTraditional
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {preset.tag}
                        </span>

                        <p
                          className={`text-xs line-clamp-2 leading-relaxed mb-3 font-medium ${
                            isTraditional ? "text-gray-800" : "text-slate-300"
                          }`}
                        >
                          {preset.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-end pt-2 border-t border-gray-200 dark:border-slate-700/60">
                        <button
                          onClick={() => {
                            const fresh = createNewThread(preset.name);
                            fresh.rawInput = preset.rawInput;
                            fresh.title = preset.name;
                            saveThread(fresh);
                            onSelectProject(fresh.id);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>载入为新项目</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div
            className={`flex items-center justify-between px-6 py-3.5 border-t text-xs ${
              isTraditional
                ? "bg-gray-50 border-gray-200 text-gray-800 font-medium"
                : "bg-slate-950/60 border-slate-800 text-slate-300"
            }`}
          >
            <span>
              当前正在研究项目：
              <strong
                className={`ml-1 font-bold ${
                  isTraditional ? "text-blue-700" : "text-amber-400"
                }`}
              >
                {currentThread.title}
              </strong>
            </span>
            <button
              onClick={onClose}
              className={`px-4 py-1.5 rounded-lg border font-bold transition-colors ${
                isTraditional
                  ? "bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
                  : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
              }`}
            >
              关闭
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmState && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmText="确认删除"
          variant="danger"
          onConfirm={() => {
            confirmState.action();
            setConfirmState(null);
          }}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </>
  );
};
