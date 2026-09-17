import { ProjectThread } from "../types/cides";
import { DEFAULT_RESEARCH_NODES } from "../data/defaultNodes";

const CIDES_STORAGE_KEY = "cides_expert_thread_v1";

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

  return {
    id: "thread-" + Date.now().toString(36),
    title: "新建跨境投资研究项目",
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

export function saveThread(thread: ProjectThread): void {
  try {
    const updated = {
      ...thread,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(CIDES_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save thread to localStorage", e);
  }
}

export function clearThread(): ProjectThread {
  localStorage.removeItem(CIDES_STORAGE_KEY);
  return getInitialThread();
}

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
