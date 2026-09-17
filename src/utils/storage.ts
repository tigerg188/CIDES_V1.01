import { ProjectThread } from "../types/cides";
import { DEFAULT_RESEARCH_NODES } from "../data/defaultNodes";
import { SAMPLE_INVESTMENT_PRESETS, InvestmentPreset } from "../data/samplePresets";

const CIDES_STORAGE_KEY = "cides_expert_thread_v1";
const CIDES_PROJECT_LIST_KEY = "cides_project_history_list_v1";
const CIDES_DELETED_PRESETS_KEY = "cides_deleted_presets_v1";

export function createNewThread(title?: string): ProjectThread {
  return {
    id: "thread-" + Date.now().toString(36),
    title: title || "新建跨境投资研究项目",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rawInput: "",
    intentResult: null,
    isIntentConfirmed: false,
    baseline: null,
    currentNodeId: "NODE_MACRO_ENTRY",
    nodes: JSON.parse(JSON.stringify(DEFAULT_RESEARCH_NODES)),
    phaseResults: {},
    activeBranches: [],
    executionLogs: [
      {
        id: "log-" + Date.now(),
        timestamp: new Date().toISOString(),
        nodeId: "SYSTEM",
        nodeName: "系统内核",
        promptVersionUsed: "V1.0",
        type: "node_run",
        message: "《CIDES自然语言运行定义 V1.0》研究引擎已就绪，等待投资意图输入。",
      }
    ],
    finalDecision: null,
  };
}

export function getInitialThread(): ProjectThread {
  const saved = localStorage.getItem(CIDES_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.id && parsed.nodes) {
        return parsed;
      }
    } catch (e) {
      console.warn("Failed to parse saved CIDES thread, initializing fresh thread", e);
    }
  }

  const fresh = createNewThread();
  saveThread(fresh);
  return fresh;
}

export function saveThread(thread: ProjectThread): void {
  try {
    const updated = {
      ...thread,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(CIDES_STORAGE_KEY, JSON.stringify(updated));

    // Also sync to project history list
    upsertProjectInList(updated);
  } catch (e) {
    console.error("Failed to save thread to localStorage", e);
  }
}

export function clearThread(): ProjectThread {
  localStorage.removeItem(CIDES_STORAGE_KEY);
  const fresh = createNewThread();
  saveThread(fresh);
  return fresh;
}

// ----------------- Project History List Management -----------------

export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  isIntentConfirmed: boolean;
  completedNodesCount: number;
  totalNodesCount: number;
  hasFinalDecision: boolean;
  finalDecisionType?: string;
  activeBranchesCount: number;
}

export function getProjectList(): ProjectSummary[] {
  try {
    const saved = localStorage.getItem(CIDES_PROJECT_LIST_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Failed to parse project history list", e);
  }
  return [];
}

export function upsertProjectInList(thread: ProjectThread): void {
  try {
    const list = getProjectList();
    const completedCount = Object.keys(thread.phaseResults || {}).filter(
      (k) => thread.phaseResults[k]?.some((r) => r.status === "confirmed")
    ).length;

    const summary: ProjectSummary = {
      id: thread.id,
      title: thread.title || "未命名项目",
      updatedAt: thread.updatedAt || new Date().toISOString(),
      createdAt: thread.createdAt || new Date().toISOString(),
      isIntentConfirmed: !!thread.isIntentConfirmed,
      completedNodesCount: completedCount,
      totalNodesCount: thread.nodes?.length || 8,
      hasFinalDecision: !!thread.finalDecision,
      finalDecisionType: thread.finalDecision?.decision,
      activeBranchesCount: thread.activeBranches?.length || 0,
    };

    const existingIdx = list.findIndex((p) => p.id === thread.id);
    let updatedList: ProjectSummary[];
    if (existingIdx >= 0) {
      updatedList = [...list];
      updatedList[existingIdx] = summary;
    } else {
      updatedList = [summary, ...list];
    }

    // Sort by updatedAt desc
    updatedList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    localStorage.setItem(CIDES_PROJECT_LIST_KEY, JSON.stringify(updatedList));

    // Also store complete thread payload for quick switching
    localStorage.setItem(`cides_project_data_${thread.id}`, JSON.stringify(thread));
  } catch (e) {
    console.warn("Failed to upsert project to list", e);
  }
}

export function loadProjectById(projectId: string): ProjectThread | null {
  try {
    const full = localStorage.getItem(`cides_project_data_${projectId}`);
    if (full) {
      const parsed = JSON.parse(full);
      saveThread(parsed);
      return parsed;
    }
  } catch (e) {
    console.error("Failed to load project by id", projectId, e);
  }
  return null;
}

export function deleteProjectById(projectId: string, currentThreadId?: string): { isCurrentDeleted: boolean } {
  try {
    // 1. Remove from project list
    const list = getProjectList().filter((p) => p.id !== projectId);
    localStorage.setItem(CIDES_PROJECT_LIST_KEY, JSON.stringify(list));

    // 2. Remove stored data payload
    localStorage.removeItem(`cides_project_data_${projectId}`);

    // 3. Check if current active project was deleted
    if (currentThreadId === projectId) {
      localStorage.removeItem(CIDES_STORAGE_KEY);
      return { isCurrentDeleted: true };
    }
  } catch (e) {
    console.error("Failed to delete project", projectId, e);
  }
  return { isCurrentDeleted: false };
}

// ----------------- Sample Presets Management (Support Deletion/Hiding) -----------------

export function getDeletedPresetIds(): string[] {
  try {
    const raw = localStorage.getItem(CIDES_DELETED_PRESETS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Failed to parse deleted presets", e);
  }
  return [];
}

export function deletePresetById(presetId: string): InvestmentPreset[] {
  try {
    const current = getDeletedPresetIds();
    if (!current.includes(presetId)) {
      current.push(presetId);
      localStorage.setItem(CIDES_DELETED_PRESETS_KEY, JSON.stringify(current));
    }
  } catch (e) {
    console.error("Failed to delete preset", presetId, e);
  }
  return getActivePresets();
}

export function restoreAllPresets(): InvestmentPreset[] {
  localStorage.removeItem(CIDES_DELETED_PRESETS_KEY);
  return SAMPLE_INVESTMENT_PRESETS;
}

export function getActivePresets(): InvestmentPreset[] {
  const deleted = getDeletedPresetIds();
  return SAMPLE_INVESTMENT_PRESETS.filter((p) => !deleted.includes(p.id));
}

// ----------------- Import / Export JSON -----------------

export function exportThreadAsJSON(thread: ProjectThread): void {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(thread, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  const safeTitle = (thread.title || "cides-project").replace(/[/\\?%*:|"<>]/g, "-");
  downloadAnchor.setAttribute("download", `CIDES-ResearchThread-${safeTitle}-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importThreadFromJSON(jsonString: string): ProjectThread {
  const parsed = JSON.parse(jsonString);
  if (!parsed.id || !parsed.nodes) {
    throw new Error("无效的 CIDES 研究线程档案格式：缺少核心节点或线程标识符");
  }
  saveThread(parsed);
  return parsed;
}

