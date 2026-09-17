import React, { useState } from "react";
import {
  Sliders,
  X,
  History,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Sparkles,
  Eye,
  Edit,
  Clock,
  User,
  Tag,
} from "lucide-react";
import { ResearchNodeDefinition, PromptVersion, ProjectThread } from "../types/cides";

interface PromptManagerModalProps {
  thread: ProjectThread;
  selectedNodeId: string;
  onClose: () => void;
  onUpdateNodes: (updatedNodes: ResearchNodeDefinition[], logMessage?: string) => void;
}

export const PromptManagerModal: React.FC<PromptManagerModalProps> = ({
  thread,
  selectedNodeId: initialNodeId,
  onClose,
  onUpdateNodes,
}) => {
  const [activeNodeId, setActiveNodeId] = useState(initialNodeId || thread.nodes[0]?.id);
  const currentNode = thread.nodes.find((n) => n.id === activeNodeId) || thread.nodes[0];

  const [promptText, setPromptText] = useState(currentNode?.activePrompt || "");
  const [changelogNote, setChangelogNote] = useState("");
  const [authorName, setAuthorName] = useState("投资合伙人 / 专家评审组");
  const [showHistory, setShowHistory] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Sync state when switching active node
  const handleSelectNode = (nodeId: string) => {
    setActiveNodeId(nodeId);
    const node = thread.nodes.find((n) => n.id === nodeId);
    if (node) {
      setPromptText(node.activePrompt);
      setShowHistory(false);
      setSaveSuccessMsg(null);
    }
  };

  // Save new version (Section 10.3 & Test 3)
  const handleSaveNewVersion = () => {
    if (!promptText.trim()) {
      alert("提示词内容不能为空！");
      return;
    }

    const currentVersions = currentNode.promptVersions || [];
    // Generate next version number e.g. V1.1, V1.2
    const baseMajor = 1;
    const nextMinor = currentVersions.length;
    const newVersionNumber = `V${baseMajor}.${nextMinor}`;
    const newVersionId = `pv-${currentNode.id.toLowerCase()}-${Date.now()}`;

    const newVersion: PromptVersion = {
      versionId: newVersionId,
      versionNumber: newVersionNumber,
      updatedAt: new Date().toISOString(),
      updatedBy: authorName.trim() || "授权研究员",
      changelog: changelogNote.trim() || `优化【${currentNode.name}】专业核查边界与证据约束`,
      content: promptText,
      isCurrent: true,
    };

    // Mark previous current as false
    const updatedVersions = currentVersions.map((v) => ({ ...v, isCurrent: false }));
    updatedVersions.unshift(newVersion);

    const updatedNodes = thread.nodes.map((n) => {
      if (n.id === currentNode.id) {
        return {
          ...n,
          activePrompt: promptText,
          activePromptVersion: newVersionNumber,
          promptVersions: updatedVersions,
        };
      }
      return n;
    });

    const msg = `节点【${currentNode.name}】提示词已保存为新版本【${newVersionNumber}】。修改者：${newVersion.updatedBy}。版本说明：${newVersion.changelog}`;
    onUpdateNodes(updatedNodes, msg);

    setChangelogNote("");
    setSaveSuccessMsg(`成功保存为新版本 ${newVersionNumber}！系统下次运行将严格追踪此版本。`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Restore previous version (Section 10.5 & Test 6)
  const handleRestoreVersion = (version: PromptVersion) => {
    if (
      !confirm(
        `确定要将【${currentNode.name}】的提示词恢复至历史版本【${version.versionNumber}】吗？`
      )
    ) {
      return;
    }

    const updatedVersions = currentNode.promptVersions.map((v) => ({
      ...v,
      isCurrent: v.versionId === version.versionId,
    }));

    const updatedNodes = thread.nodes.map((n) => {
      if (n.id === currentNode.id) {
        return {
          ...n,
          activePrompt: version.content,
          activePromptVersion: version.versionNumber,
          promptVersions: updatedVersions,
        };
      }
      return n;
    });

    setPromptText(version.content);
    const msg = `节点【${currentNode.name}】提示词已回滚恢复为历史版本【${version.versionNumber}】。`;
    onUpdateNodes(updatedNodes, msg);
    setShowHistory(false);
    setSaveSuccessMsg(`已成功回滚恢复至版本 ${version.versionNumber}！`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Find execution history for this node (Test 7: 运行追踪)
  const nodeExecutionLogs = thread.executionLogs.filter(
    (l) => l.nodeId === currentNode.id || l.message.includes(currentNode.name)
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  CIDES 节点专属提示词资产管理
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-400 border border-slate-700">
                  第十、十一及四十一节硬性功能
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                CIDES非单一总Prompt，各研究节点均使用专属提示词；支持查看、编辑、多版本保存、回滚与运行记录追踪。
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

        {/* Node Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-700">
          {thread.nodes.map((n, idx) => {
            const isCurrent = n.id === currentNode.id;
            return (
              <button
                key={n.id}
                onClick={() => handleSelectNode(n.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isCurrent
                    ? "bg-amber-400 text-slate-950 font-bold shadow-sm"
                    : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60"
                }`}
              >
                <span>{idx + 1}. {n.name}</span>
                <span className={`text-[10px] font-mono px-1 rounded ${
                  isCurrent ? "bg-slate-950/20 text-slate-950" : "bg-slate-900 text-amber-400"
                }`}>
                  {n.activePromptVersion}
                </span>
              </button>
            );
          })}
        </div>

        {/* Node Summary Info & Version Badge */}
        <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-sm">{currentNode.name}</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono text-[11px] border border-amber-500/20">
                当前运行版本: {currentNode.activePromptVersion}
              </span>
            </div>
            <p className="text-slate-400 text-[11px]">{currentNode.purpose}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border ${
                showHistory
                  ? "bg-purple-950/60 text-purple-300 border-purple-700"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              }`}
            >
              <History className="w-3.5 h-3.5 text-purple-400" />
              <span>版本历史 ({currentNode.promptVersions.length})</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {saveSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Version History Drawer (Section 10.4 & Test 5) */}
        {showHistory ? (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <History className="w-4 h-4 text-purple-400" />
                历史版本归档列表 (支持一键恢复)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                共记录 {currentNode.promptVersions.length} 个正式版本
              </span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {currentNode.promptVersions.map((v) => {
                const isActive = v.versionNumber === currentNode.activePromptVersion;
                return (
                  <div
                    key={v.versionId}
                    className={`p-3 rounded-xl border transition-all ${
                      isActive
                        ? "bg-amber-950/20 border-amber-500/50"
                        : "bg-slate-900 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-amber-400">
                            {v.versionNumber}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              当前使用中
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(v.updatedAt).toLocaleString("zh-CN")}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {v.updatedBy}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          <strong>说明：</strong>{v.changelog}
                        </p>
                      </div>

                      {!isActive && (
                        <button
                          onClick={() => handleRestoreVersion(v)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/40 transition-colors flex items-center gap-1 shrink-0"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-400" />
                          <span>恢复为当前</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Prompt Editor (Test 1, 2, 3) */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-amber-400" />
                <span>节点专属提示词内容 (Prompt Editor)</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                修改后点击保存即生成不可篡改的新版本
              </span>
            </div>

            <textarea
              id="cides-prompt-editor-textarea"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full h-64 p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono leading-relaxed focus:outline-none focus:border-amber-400 resize-none shadow-inner"
            />

            {/* Version Metadata Form on Save */}
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3 text-xs">
              <span className="font-semibold text-slate-200 block">
                版本元数据 (记录修改者与版本变更日志，确保审计追踪)：
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    修改者 / 责任人：
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="投资经理 / 法律合伙人 / 能源顾问"
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    版本说明 / 修改要点 (Changelog)：
                  </label>
                  <input
                    type="text"
                    value={changelogNote}
                    onChange={(e) => setChangelogNote(e.target.value)}
                    placeholder="如：增强关于大宗商品下跌20%时敏感性测试的严苛要求"
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Execution Tracking Log (Test 7: 运行追踪) */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              该节点历史执行版本追溯记录 (Execution Tracking Logs)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              防止“以新充旧”或“以旧充新”
            </span>
          </div>

          <div className="space-y-1 max-h-24 overflow-y-auto font-mono text-[11px] pr-1">
            {nodeExecutionLogs.length > 0 ? (
              nodeExecutionLogs.map((log) => (
                <div key={log.id} className="text-slate-400 flex items-center justify-between py-0.5 border-b border-slate-800/40">
                  <span className="text-slate-300 truncate max-w-md">{log.message}</span>
                  <span className="text-amber-400/90 shrink-0 ml-2">[{log.promptVersionUsed}]</span>
                </div>
              ))
            ) : (
              <span className="text-slate-600 italic">暂无该节点的运行记录</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
            AI不得自行修改节点提示词；所有正式修改须经人工确认保存。
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              关闭
            </button>
            {!showHistory && (
              <button
                id="btn-save-prompt-version"
                onClick={handleSaveNewVersion}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:brightness-105 active:brightness-95 transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Save className="w-4 h-4 text-slate-950" />
                <span>保存为新版本 (生成版本号)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
