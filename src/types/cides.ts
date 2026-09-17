/**
 * CIDES (Cross-border Investment Development Expert System)
 * Types and Data Contracts based on 《CIDES自然语言运行定义 V1.0》
 */

export interface IntentRecognitionResult {
  target: string;
  purpose: string;
  region: string;
  projectType: string;
  scale: string;
  capitalSource: string;
  resources: string;
  knownConditions: string[];
  existingHypotheses: string[];
  coreConcerns: string[];
  implicitQuestions: string[];
  omittedCriticalQuestions: string[];
  requiresConfirmationReason: string;
  structuredBaselineSummary: string;
  proposedResearchObjectives: string[];
  executionRecord?: AIExecutionRecord;
}

export interface ResearchBaseline {
  id: string;
  confirmedAt: string;
  confirmedBy: string;
  summary: string;
  target: string;
  purpose: string;
  region: string;
  projectType: string;
  scale: string;
  capitalSource: string;
  resources: string;
  keyBoundaries: string[];
  userModificationsNote?: string;
}

export interface PromptVersion {
  versionId: string;
  versionNumber: string; // e.g. "V1.0", "V1.1", "V2.0"
  updatedAt: string;
  updatedBy: string;
  changelog: string;
  content: string;
  isCurrent: boolean;
}

export interface ResearchNodeDefinition {
  id: string;
  name: string;
  purpose: string;
  scope: string;
  inputRequirements: string[];
  outputStructure: string[];
  activePrompt: string;
  activePromptVersion: string;
  promptVersions: PromptVersion[];
  startConditions: string;
  completionConditions: string;
  userConfirmationRequirements: string;
  branchTriggers: string[];
  nextRecommendedNodeId: string | null;
  failOrPauseHandling: string;
  outputPersistenceKey: string;
}

export interface EvidenceItem {
  id: string;
  title: string;
  source: string;
  url?: string;
  date?: string;
  snippet: string;
  supportsFinding: boolean;
  reliability: "高 (官方公报/法律文书)" | "中 (权威研报/行业年鉴)" | "需进一步核验" | string;
  contradictionNotes?: string;
}

export interface RiskItem {
  id: string;
  category: "政策与地缘" | "法律与特许权" | "基础设施与能源" | "税务与外汇" | "社区与环境" | "运营与交割";
  severity: "高" | "中" | "低";
  description: string;
  mitigation: string;
}

export interface AssumptionItem {
  hypothesis: string;
  status: "validated" | "challenged" | "refuted" | "uncertain";
  explanation: string;
}

export type BranchTriggerType =
  | "important_unknown"
  | "must_external_confirm"
  | "source_conflict"
  | "broken_user_premise"
  | "ai_uncertainty"
  | "major_risk"
  | "counter_intuitive"
  | "external_shock";

export type BranchModificationType =
  | "confirm_judgment"
  | "modify_judgment"
  | "restrict_judgment"
  | "overturn_judgment"
  | "retain_uncertainty";

export interface BranchItem {
  id: string;
  parentNodeId: string;
  parentNodeName?: string;
  triggerType: BranchTriggerType;
  title: string;
  triggerReason: string;
  objective: string;
  scope: string;
  impactOnMainline: string;
  prompt: string;
  status: "pending" | "researching" | "completed" | "merged_to_mainline";
  findingsMarkdown?: string;
  evidences?: EvidenceItem[];
  modificationType?: BranchModificationType;
  recommendedAction?: string;
  createdAt: string;
  completedAt?: string;
  confirmedByHuman?: boolean;
}

export interface UserConfirmationRecord {
  type: "confirm" | "correct" | "supplement_requested";
  confirmedAt: string;
  userNote: string;
  acceptedAsBaseline: boolean;
}

export interface AIExecutionRecord {
  executionId: string;
  nodeId: string;
  nodeName: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  provider: string; // "Google Gemini"
  model: string; // "gemini-3.8-flash"
  promptVersion: string;
  promptHash?: string;
  inputContextLength: number;
  outputLength: number;
  aiCalled: boolean;
  searchRequested: boolean;
  searchExecuted: boolean;
  searchQueries?: string[];
  sources?: Array<{
    title: string;
    url?: string;
    snippet?: string;
  }>;
  status: "completed" | "failed" | "blocked";
  error?: string | null;
  createdAt: string;
  tokens?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  executionSource: "gemini";
}

export interface PhaseResult {
  id: string;
  nodeId: string;
  nodeName: string;
  version: number; // 1 = V1, 2 = V2
  versionLabel: string; // e.g. "阶段成果 V1"
  status: "candidate" | "confirmed" | "corrected" | "supplement_requested";
  promptVersionUsed: string; // Mandatory execution tracking (Section 10.6)
  generatedAt: string;
  executiveSummary: string;
  detailedFindingsMarkdown: string;
  verifiedEvidences: EvidenceItem[];
  criticalRisks: RiskItem[];
  assumptionsValidated: AssumptionItem[];
  proposedBranches: BranchItem[];
  nextRecommendedStep: string;
  userConfirmationLog?: UserConfirmationRecord;
  executionRecord?: AIExecutionRecord;
  executionSource?: "gemini";
}

export interface ExecutionLogItem {
  id: string;
  timestamp: string;
  nodeId: string;
  nodeName: string;
  promptVersionUsed: string;
  type: "node_run" | "user_confirm" | "user_correct" | "branch_created" | "branch_merged" | "prompt_edited" | "prompt_restored";
  message: string;
  executionRecord?: AIExecutionRecord;
}

export interface FinalDecisionRecord {
  decision: "go" | "conditional_go" | "no_go" | "pending_further_study";
  rationale: string;
  decidedBy: string;
  decidedAt: string;
  conditionsPrecedent: string[];
  criticalRedlines: string[];
  maxInvestmentLimitUSD?: string;
}

export interface ProjectThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  rawInput: string;
  intentResult: IntentRecognitionResult | null;
  isIntentConfirmed: boolean;
  baseline: ResearchBaseline | null;
  currentNodeId: string;
  nodes: ResearchNodeDefinition[];
  phaseResults: Record<string, PhaseResult[]>; // nodeId -> all versions (V1, V2...)
  activeBranches: BranchItem[];
  executionLogs: ExecutionLogItem[];
  finalDecision: FinalDecisionRecord | null;
}
