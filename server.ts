import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Lazy Gemini client helper
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    provider: "Google Gemini",
    model: "gemini-3.8-flash",
    timestamp: new Date().toISOString(),
  });
});

// Helper to find the balanced root JSON object in a string (ignores trailing commentary/text)
function findBalancedJson(text: string): string | null {
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = firstBrace; i < text.length; i++) {
    const char = text[i];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0) {
          return text.substring(firstBrace, i + 1);
        }
      }
    }
  }

  // Fallback to substring from first to last brace
  const lastBrace = text.lastIndexOf("}");
  if (lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }

  return null;
}

// Clean common JSON issues such as trailing commas and raw control characters
function sanitizeJsonString(raw: string): string {
  return raw
    .replace(/,\s*([}\]])/g, "$1") // Remove trailing commas in arrays and objects
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F]+/g, " "); // Replace dangerous control chars except newlines
}

// Robust JSON extraction helper that handles raw JSON, markdown fences, embedded JSON blocks, and trailing text
function extractJson(text: string): any {
  if (!text) {
    throw new Error("AI 返回内容为空");
  }

  // 1. Try markdown code fences first (```json ... ```)
  const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (markdownMatch && markdownMatch[1]) {
    const fenced = markdownMatch[1].trim();
    try {
      return JSON.parse(fenced);
    } catch {
      const balancedFenced = findBalancedJson(fenced);
      if (balancedFenced) {
        try {
          return JSON.parse(balancedFenced);
        } catch {
          try {
            return JSON.parse(sanitizeJsonString(balancedFenced));
          } catch {
            // continue to other fallbacks
          }
        }
      }
    }
  }

  // 2. Try balanced root JSON object (stops cleanly at closing brace, ignoring any trailing commentary)
  const balanced = findBalancedJson(text);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch {
      try {
        return JSON.parse(sanitizeJsonString(balanced));
      } catch {
        // continue to trimmed fallback
      }
    }
  }

  // 3. Fallback to direct parse of trimmed text
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(sanitizeJsonString(trimmed));
    } catch (e) {
      throw new Error(`AI 结构化内容解析失败: ${(e as Error).message}`);
    }
  }
}

// Resilience helper for quota and transient Gemini API errors
function isQuotaError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.code || err.statusCode;
  const msg =
    (err.message || "") +
    " " +
    (typeof err === "string" ? err : "") +
    " " +
    JSON.stringify(err);
  return (
    status === 429 ||
    status === "RESOURCE_EXHAUSTED" ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("Quota") ||
    msg.includes("rate-limits") ||
    msg.includes("rate limit") ||
    msg.includes("Resource has been exhausted")
  );
}

function isTransientError(err: any): boolean {
  if (!err) return false;
  if (isQuotaError(err)) return false; // Quota errors should fail-fast
  const status = err.status || err.code || err.statusCode;
  const msg =
    (err.message || "") +
    " " +
    (typeof err === "string" ? err : "") +
    " " +
    JSON.stringify(err);
  return (
    status === 503 ||
    status === "UNAVAILABLE" ||
    msg.includes("503") ||
    msg.includes("high demand") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("Overloaded") ||
    msg.includes("temporarily unavailable")
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface GenerateContentResilientParams {
  contents: any;
  config?: any;
  primaryModel?: string;
}

interface GenerateContentResult {
  response: any;
  usedModel: string;
  toolsSkipped?: boolean;
}

async function generateContentWithResilience(
  ai: GoogleGenAI,
  params: GenerateContentResilientParams
): Promise<GenerateContentResult> {
  const modelsToTry = [
    params.primaryModel || "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
  ];
  const uniqueModels = Array.from(new Set(modelsToTry));

  let lastError: any = null;

  for (let mIdx = 0; mIdx < uniqueModels.length; mIdx++) {
    const currentModel = uniqueModels[mIdx];
    // Try primary model up to 2 times, fallback models 1 time each
    const maxAttempts = mIdx === 0 ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1 || mIdx > 0) {
          const waitMs = attempt * 1200 + mIdx * 800;
          console.log(
            `[Gemini Resilience] Trying ${currentModel} (attempt ${attempt}/${maxAttempts}) after ${waitMs}ms backoff...`
          );
          await sleep(waitMs);
        }

        const response = await ai.models.generateContent({
          model: currentModel,
          contents: params.contents,
          config: params.config,
        });

        if (response) {
          if (mIdx > 0 || attempt > 1) {
            console.log(
              `[Gemini Resilience] Successfully succeeded with model: ${currentModel} (fallback level ${mIdx}, attempt ${attempt})`
            );
          }
          return { response, usedModel: currentModel, toolsSkipped: false };
        }
      } catch (err: any) {
        lastError = err;
        console.warn(
          `[Gemini Resilience] Call to ${currentModel} failed (attempt ${attempt}/${maxAttempts}):`,
          err.message || err
        );

        // If it's a quota / rate limit error (429) or transient (503) and tools were included:
        // Google Search Grounding has strict rate limits. Try without search tools to keep real research moving.
        if (params.config?.tools?.length && (isQuotaError(err) || isTransientError(err))) {
          console.log(
            `[Gemini Resilience] Tool call constraint encountered on ${currentModel}. Retrying without search tools for deep model-native analysis...`
          );
          const configWithoutTools = { ...params.config };
          delete configWithoutTools.tools;

          // Attempt text-only with resilience against 503 spikes
          for (let toolFallbackAttempt = 1; toolFallbackAttempt <= 2; toolFallbackAttempt++) {
            try {
              if (toolFallbackAttempt > 1) {
                await sleep(1500);
              } else {
                await sleep(800);
              }
              const responseNoTools = await ai.models.generateContent({
                model: currentModel,
                contents: params.contents,
                config: configWithoutTools,
              });

              if (responseNoTools) {
                console.log(
                  `[Gemini Resilience] Succeeded with model ${currentModel} (pure model-native analysis mode, attempt ${toolFallbackAttempt})!`
                );
                return { response: responseNoTools, usedModel: currentModel, toolsSkipped: true };
              }
            } catch (noToolsErr: any) {
              lastError = noToolsErr;
              console.warn(
                `[Gemini Resilience] Fallback without search tools for ${currentModel} attempt ${toolFallbackAttempt} returned:`,
                noToolsErr.message || noToolsErr
              );
              if (!isTransientError(noToolsErr)) {
                break;
              }
            }
          }
        }

        // If non-transient and not quota (e.g., bad request/invalid arguments), fail-fast
        if (!isTransientError(err) && !isQuotaError(err)) {
          throw err;
        }
      }
    }
  }

  throw lastError;
}

// Endpoint 1: Intent Recognition & Decomposition (Section 3 & 4)
app.post("/api/cides/recognize-intent", async (req, res) => {
  const startTime = Date.now();
  const { rawInput } = req.body;
  
  if (!rawInput || typeof rawInput !== "string" || !rawInput.trim()) {
    return res.status(400).json({
      success: false,
      status: "failed",
      code: "INVALID_INPUT",
      error: "投资意图自然语言输入不能为空",
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    // Strict Rule: No AI Key -> BLOCKED. Never return fake preset intent.
    return res.status(503).json({
      success: false,
      status: "blocked",
      code: "AI_NOT_CONFIGURED",
      error: "AI 未配置：当前系统未检测到 GEMINI_API_KEY 环境变量，无法执行真实投资意图拆解。请在设置中配置有效 Gemini API Key 后重试。",
    });
  }

  try {
    const prompt = `你正在执行《CIDES自然语言运行定义 V1.0》第三节【投资意图识别与拆解】。
CIDES是跨境投资开发专家系统。请从用户的原始自然语言输入中，严格识别并提取以下12个核心维度，并评估是否存在重大歧义或需要用户确认的关键边界：

用户原始投资意图输入：
"""
${rawInput.trim()}
"""

请按JSON格式严格输出以下结构（禁止输出任何Markdown说明文字）：
{
  "target": "投资对象（行业/矿种/资产/标的公司等）",
  "purpose": "投资目的（战略保供、财务回报、产能转移、特许经营等）",
  "region": "投资区域/国家",
  "projectType": "项目类型（绿地开发、股权并购、合资合营、BOT特许经营等）",
  "scale": "预期规模与投资体量",
  "capitalSource": "资本来源或资金属性（中资出海、自有资金、银团贷款等）",
  "resources": "核心资源与要素条件（矿品位、电力负荷、供水、交通等）",
  "knownConditions": ["用户已掌握并明确提出的条件1", "条件2"],
  "existingHypotheses": ["用户已有的主观判断或前置假设1", "假设2"],
  "coreConcerns": ["用户核心关注点/红线1", "关注点2"],
  "implicitQuestions": ["用户输入中隐含的关键专业研究问题1", "问题2"],
  "omittedCriticalQuestions": ["用户可能遗漏但决定投资成败的关键问题1", "问题2"],
  "requiresConfirmationReason": "为什么此意图需要用户确认与纠偏的说明",
  "structuredBaselineSummary": "建议确认的研究基线综述（用于向用户呈现以供确认/纠偏）",
  "proposedResearchObjectives": ["建议阶段1研究目标", "建议阶段2研究目标", "建议阶段3研究目标", "建议阶段4研究目标"]
}`;

    const { response, usedModel } = await generateContentWithResilience(ai, {
      primaryModel: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.15,
      },
    });

    const durationMs = Date.now() - startTime;
    const responseText = response.text || "";
    const parsed = extractJson(responseText);

    const usage = response.usageMetadata;
    const executionRecord = {
      executionId: `exec-intent-${Date.now()}`,
      nodeId: "INTENT_ENGINE",
      nodeName: "投资意图识别与拆解",
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      provider: "Google Gemini",
      model: usedModel,
      promptVersion: "V1.0",
      inputContextLength: prompt.length,
      outputLength: responseText.length,
      aiCalled: true,
      searchRequested: false,
      searchExecuted: false,
      status: "completed" as const,
      error: null,
      createdAt: new Date().toISOString(),
      tokens: {
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
      },
      executionSource: "gemini" as const,
    };

    return res.json({
      success: true,
      status: "completed",
      data: parsed,
      executionRecord,
      source: "gemini",
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const isQuota = isQuotaError(error);
    const isTransient = isTransientError(error);
    const isParse =
      error instanceof SyntaxError ||
      error.message?.includes("JSON") ||
      error.message?.includes("解析失败");

    if (isQuota || isTransient || isParse) {
      console.warn(
        `[CIDES AI Notice] Intent recognition notice:`,
        error.message || error
      );
    } else {
      console.error("Intent recognition error:", error);
    }

    let status = 500;
    let code = "AI_EXECUTION_FAILED";
    let userMessage = `Gemini 意图识别执行失败: ${error.message || "未知异常"}`;

    if (isQuota) {
      status = 429;
      code = "AI_QUOTA_EXHAUSTED";
      userMessage =
        "Google Gemini API 调用频率或额度已达上限 (429 RESOURCE_EXHAUSTED)。当前 API Key 已达到每分钟频次限制 (RPM) 或配额用尽。系统已启动安全熔断以避免持续消耗，请稍等 30-60 秒配额窗口刷新后点击重试，或在应用设置中更换具备充足配额的 API Key。";
    } else if (isTransient) {
      status = 503;
      code = "AI_HIGH_DEMAND";
      userMessage =
        "Google Gemini 模型服务当前正遭遇瞬时高并发流量（503 UNAVAILABLE）。系统已自动执行退避重试，请稍候片刻点击【重试识别】即可继续。";
    } else if (isParse) {
      status = 422;
      code = "AI_PARSE_FAILED";
      userMessage = `AI 意图解析成功但结构化提取失败: ${error.message}`;
    }

    return res.status(status).json({
      success: false,
      status: isQuota || isTransient ? "blocked" : "failed",
      code,
      error: userMessage,
      rawError: error.message,
      durationMs,
    });
  }
});

// Endpoint 2: Execute Research Node (Section 5, 8, 9, 21, 22, 23, 25)
app.post("/api/cides/execute-node", async (req, res) => {
  const startTime = Date.now();
  const {
    nodeId,
    nodeName,
    promptText,
    activePrompt,
    promptVersion,
    promptVersionUsed,
    projectBaseline,
    predecessorOutputs,
    confirmedPreviousResults,
    activeBranches,
    userCorrection,
  } = req.body;

  const resolvedPromptText = promptText || activePrompt || "";
  const resolvedPromptVersion = promptVersion || promptVersionUsed || "V1.0";

  const ai = getGeminiClient();
  if (!ai) {
    // Strict Rule: No AI Key -> BLOCKED. Never return fake research findings.
    return res.status(503).json({
      success: false,
      status: "blocked",
      code: "AI_NOT_CONFIGURED",
      error: "AI 未配置：当前系统未检测到有效 GEMINI_API_KEY 环境变量，无法执行正式研究节点。请配置 API Key 后重试。",
      nodeId,
      promptVersion: resolvedPromptVersion,
    });
  }

  try {
    const systemInstruction = `你正在驱动《CIDES自然语言运行定义 V1.0》的跨境投资研究节点【${nodeName || nodeId}】。
你必须严格按照节点专属提示词、证据边界和多阶段推理要求开展专业研究。
核心原则：
1. 搜到 ≠ 验证；验证 ≠ 用户确认；用户确认 ≠ 最终投资决定。
2. 必须明确区分【经过核验的证据】、【AI研究分析判断】与【核心风险】。
3. 必须主动识别：重要未知、信息冲突、原假设错误风险、反常识问题，如有必要主动提议生成研究分支（Branch）。
4. 本次运行严格绑定提示词版本：${resolvedPromptVersion}。`;

    const requestContent = `
【研究节点信息】
- 节点ID: ${nodeId}
- 节点名称: ${nodeName}
- 运行使用的专属提示词版本: ${resolvedPromptVersion}

【节点专属提示词内容】
"""
${resolvedPromptText}
"""

【已确立的正式投资研究基线（合法研究客体）】
${JSON.stringify(projectBaseline || {}, null, 2)}

【前面节点已经用户确认的正式成果（已锁定正式输入基准）】
${JSON.stringify(predecessorOutputs || confirmedPreviousResults || {}, null, 2)}

【已合并回主线的相关分支研究成果（补充证据/修正）】
${JSON.stringify(activeBranches || [], null, 2)}

${userCorrection ? `【用户在上一轮提出的纠偏/补充研究要求（强制性调整指令）】\n"${userCorrection}"\n请根据用户的纠偏或补充指令，重新核验事实并更新研判，形成带有纠偏修正的新版本成果！` : ""}

请严格遵循以下输出JSON结构（禁止包裹任何外部解释文本）：
{
  "executiveSummary": "本节点阶段性研究成果核心综述（150-300字，客观、严谨、不夸大）",
  "detailedFindingsMarkdown": "详细的研究分析内容，包含背景调查、关键要素拆解、横向比对、推演逻辑（支持Markdown格式，包含表格与清晰小节）",
  "verifiedEvidences": [
    {
      "id": "ev-1",
      "title": "证据名称或文件标题",
      "source": "官方部门/权威机构/法规编号/行业数据库",
      "url": "可查网址或官方文号",
      "date": "发布或生效年份/月份",
      "snippet": "关键原文摘录或核心数据段落",
      "supportsFinding": true,
      "reliability": "高 (官方法规/官方公告) / 中 (权威研报/行业年鉴) / 需进一步核验",
      "contradictionNotes": "若存在冲突或反证在此注明，无则写无"
    }
  ],
  "criticalRisks": [
    {
      "id": "rk-1",
      "category": "政策与地缘/法律与特许权/基础设施与能源/税务与外汇/社区与环境/运营与交割",
      "severity": "高",
      "description": "风险具体情景描述",
      "mitigation": "应对预案与谈判对策"
    }
  ],
  "assumptionsValidated": [
    {
      "hypothesis": "被检验的前置假设",
      "status": "validated",
      "explanation": "检验说明及逻辑依据"
    }
  ],
  "proposedBranches": [
    {
      "id": "br-1",
      "triggerType": "source_conflict",
      "title": "分支研究建议标题",
      "triggerReason": "触发分支的具体原因（如某关键要素依据存疑、存在两份冲突公告等）",
      "objective": "分支研究目标",
      "scope": "分支研究边界",
      "impactOnMainline": "该分支结果若证实/证伪，将对主线经济模型或可行性产生何种实质影响",
      "suggestedPrompt": "该分支研究所需的针对性提示词"
    }
  ],
  "nextRecommendedStep": "下一步建议动作（经用户确认后进入哪个节点）"
}
`;

    const fullContextForMeasurement = systemInstruction + "\n" + requestContent;

    const { response, usedModel, toolsSkipped } = await generateContentWithResilience(ai, {
      primaryModel: "gemini-3.8-flash",
      contents: requestContent,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.2,
        tools: [{ googleSearch: {} }],
      },
    });

    const durationMs = Date.now() - startTime;
    const responseText = response.text || "";
    const parsed = extractJson(responseText);

    // Grounding & Search Verification (Section 8: 区分请求搜索和实际搜索)
    const candidate = response.candidates?.[0];
    const groundingMeta = candidate?.groundingMetadata;
    const webSearchQueries: string[] = groundingMeta?.webSearchQueries || [];
    const groundingChunks = groundingMeta?.groundingChunks || [];

    const searchRequested = !toolsSkipped;
    const searchExecuted = !toolsSkipped && (webSearchQueries.length > 0 || groundingChunks.length > 0);

    const sources = groundingChunks
      .filter((c: any) => c.web?.uri)
      .map((c: any) => ({
        title: c.web?.title || "网络权威来源",
        url: c.web?.uri,
        snippet: c.web?.snippet || "",
      }));

    const usage = response.usageMetadata;

    const executionRecord = {
      executionId: `exec-${nodeId}-${Date.now()}`,
      nodeId,
      nodeName,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      provider: "Google Gemini",
      model: usedModel,
      promptVersion: resolvedPromptVersion,
      inputContextLength: fullContextForMeasurement.length,
      outputLength: responseText.length,
      aiCalled: true,
      searchRequested,
      searchExecuted,
      searchQueries: webSearchQueries,
      sources,
      status: "completed" as const,
      error: null,
      createdAt: new Date().toISOString(),
      tokens: {
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
      },
      executionSource: "gemini" as const,
    };

    return res.json({
      success: true,
      status: "completed",
      data: {
        ...parsed,
        promptVersionUsed: resolvedPromptVersion,
        nodeId,
        generatedAt: new Date().toISOString(),
      },
      executionRecord,
      source: "gemini",
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const isQuota = isQuotaError(error);
    const isTransient = isTransientError(error);
    const isParse =
      error instanceof SyntaxError ||
      error.message?.includes("JSON") ||
      error.message?.includes("解析失败");

    if (isQuota || isTransient || isParse) {
      console.warn(
        `[CIDES AI Notice] Node [${nodeId}] notice:`,
        error.message || error
      );
    } else {
      console.error(`Execute node [${nodeId}] error:`, error);
    }

    let status = 500;
    let code = "AI_EXECUTION_FAILED";
    let userMessage = `Gemini 节点【${nodeName || nodeId}】执行失败: ${error.message || "未知异常"}`;

    if (isQuota) {
      status = 429;
      code = "AI_QUOTA_EXHAUSTED";
      userMessage =
        `Google Gemini API 调用频率或额度已达上限 (429 RESOURCE_EXHAUSTED)。节点【${nodeName || nodeId}】调用受限。系统已启动安全熔断，请稍候 30-60 秒等待配额窗口刷新后点击【重新尝试调用】，或在应用设置中更换具备更高配额的 API Key。`;
    } else if (isTransient) {
      status = 503;
      code = "AI_HIGH_DEMAND";
      userMessage =
        `Google Gemini 模型服务当前正遭遇瞬时高并发流量（503 UNAVAILABLE）。节点【${nodeName || nodeId}】已尝试自动退避重试与备用调度。请稍候片刻点击【重新尝试调用】即可继续真实研判。`;
    } else if (isParse) {
      status = 422;
      code = "AI_PARSE_FAILED";
      userMessage = `AI 节点研判生成完成，但结构化结果解析失败: ${error.message}`;
    }

    return res.status(status).json({
      success: false,
      status: isQuota || isTransient ? "blocked" : "failed",
      code,
      error: userMessage,
      rawError: error.message,
      durationMs,
      nodeId,
      promptVersion: resolvedPromptVersion,
    });
  }
});

// Endpoint 3: Execute Branch Research (Section 16, 17, 18, 19, 20)
app.post("/api/cides/execute-branch", async (req, res) => {
  const startTime = Date.now();
  const {
    branchId,
    parentNodeId,
    branchTitle,
    triggerReason,
    objective,
    scope,
    branchPrompt,
    projectBaseline,
  } = req.body;

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      success: false,
      status: "blocked",
      code: "AI_NOT_CONFIGURED",
      error: "AI 未配置：当前系统未检测到 GEMINI_API_KEY 环境变量，无法执行真实分支深挖。请配置 API Key 后重试。",
      branchId,
    });
  }

  try {
    const prompt = `你正在执行《CIDES自然语言运行定义 V1.0》中的【动态分支深挖研究】。
分支任务具有明确目的，不是另开聊天窗口，必须回答为什么研究、研究什么、研究结果对主线判断产生何种影响。

分支研究标题: ${branchTitle}
所属主线节点: ${parentNodeId}
触发原因: ${triggerReason}
研究目标: ${objective}
研究范围: ${scope}
分支专用提示词:
"""
${branchPrompt || "进行针对性深度核查，交叉核对不同来源，寻找原始凭据，给出明确判断及对主线的影响。"}
"""
项目总体基线:
${JSON.stringify(projectBaseline || {}, null, 2)}

请严格返回以下JSON格式（禁止包裹外部多余文本）：
{
  "branchFindingsMarkdown": "分支研究深入报告（详细论述调查过程、事实依据、证据核验）",
  "evidences": [
    {
      "title": "证据标题",
      "source": "来源",
      "snippet": "内容摘要",
      "url": "参考链接或文件号",
      "supportsFinding": true
    }
  ],
  "impactOnMainline": "对主线原判断的实质影响阐述",
  "modificationType": "confirm_judgment",
  "recommendedAction": "带回主线后的具体更新动作建议"
}`;

    const { response, usedModel, toolsSkipped } = await generateContentWithResilience(ai, {
      primaryModel: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        tools: [{ googleSearch: {} }],
      },
    });

    const durationMs = Date.now() - startTime;
    const responseText = response.text || "";
    const parsed = extractJson(responseText);

    const candidate = response.candidates?.[0];
    const groundingMeta = candidate?.groundingMetadata;
    const webSearchQueries: string[] = groundingMeta?.webSearchQueries || [];
    const groundingChunks = groundingMeta?.groundingChunks || [];

    const searchRequested = !toolsSkipped;
    const searchExecuted = !toolsSkipped && (webSearchQueries.length > 0 || groundingChunks.length > 0);

    const sources = groundingChunks
      .filter((c: any) => c.web?.uri)
      .map((c: any) => ({
        title: c.web?.title || "网络核验数据源",
        url: c.web?.uri,
        snippet: c.web?.snippet || "",
      }));

    const usage = response.usageMetadata;

    const executionRecord = {
      executionId: `exec-branch-${branchId}-${Date.now()}`,
      nodeId: parentNodeId || "BRANCH",
      nodeName: `分支深挖: ${branchTitle}`,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      provider: "Google Gemini",
      model: usedModel,
      promptVersion: "V1.0",
      inputContextLength: prompt.length,
      outputLength: responseText.length,
      aiCalled: true,
      searchRequested,
      searchExecuted,
      searchQueries: webSearchQueries,
      sources,
      status: "completed" as const,
      error: null,
      createdAt: new Date().toISOString(),
      tokens: {
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
      },
      executionSource: "gemini" as const,
    };

    return res.json({
      success: true,
      status: "completed",
      data: {
        ...parsed,
        branchId,
        completedAt: new Date().toISOString(),
      },
      executionRecord,
      source: "gemini",
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const isQuota = isQuotaError(error);
    const isTransient = isTransientError(error);
    const isParse =
      error instanceof SyntaxError ||
      error.message?.includes("JSON") ||
      error.message?.includes("解析失败");

    if (isQuota || isTransient || isParse) {
      console.warn(
        `[CIDES AI Notice] Branch [${branchId}] notice:`,
        error.message || error
      );
    } else {
      console.error(`Execute branch [${branchId}] error:`, error);
    }

    let status = 500;
    let code = "AI_EXECUTION_FAILED";
    let userMessage = `Gemini 分支【${branchTitle}】执行失败: ${error.message || "未知异常"}`;

    if (isQuota) {
      status = 429;
      code = "AI_QUOTA_EXHAUSTED";
      userMessage =
        `Google Gemini API 调用频率或额度已达上限 (429 RESOURCE_EXHAUSTED)。分支【${branchTitle}】调用受限。请等待 30-60 秒配额窗口刷新后再试，或在设置中更换具备充足配额的 API Key。`;
    } else if (isTransient) {
      status = 503;
      code = "AI_HIGH_DEMAND";
      userMessage =
        `Google Gemini 模型服务当前正遭遇瞬时高并发流量（503 UNAVAILABLE）。分支【${branchTitle}】已尝试自动退避重试。请稍候点击【重试】。`;
    } else if (isParse) {
      status = 422;
      code = "AI_PARSE_FAILED";
      userMessage = `AI 分支研判生成完成，但结构化结果解析失败: ${error.message}`;
    }

    return res.status(status).json({
      success: false,
      status: isQuota || isTransient ? "blocked" : "failed",
      code,
      error: userMessage,
      rawError: error.message,
      durationMs,
      branchId,
    });
  }
});

// Endpoint 4: Mainline Re-reasoning after Branch Completion (CIDES V1.02 Requirements 7, 8, 9)
app.post("/api/cides/re-evaluate-node", async (req, res) => {
  const startTime = Date.now();
  const {
    nodeId,
    nodeName,
    projectBaseline,
    originalResult,
    branchResult,
    userConfirmation,
  } = req.body;

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      success: false,
      status: "blocked",
      code: "AI_NOT_CONFIGURED",
      error: "AI 未配置：当前系统未检测到 GEMINI_API_KEY 环境变量，无法执行真实主线重新推理。请配置 API Key 后重试。",
      nodeId,
    });
  }

  try {
    const prompt = `你正在执行 CIDES (跨境投资开发决策专家系统) V1.02 的【主线重新推理引擎】(Mainline Re-reasoning Engine)。
【核心任务】
主线研究节点【[${nodeId}] ${nodeName}】此前已完成初步研判并形成了阶段成果版本 V1。
但在该节点研究过程中，AI 发现关键未知事实/重大外部约束/假设风险，提出了专项动态分支【${branchResult?.title || "专项深挖分支"}】并执行了针对性深挖实证研究。
现在，该分支的专项调查已经完成，并经过了人类投资决策专家（Human Decision Desk）的实质性审核与批注。
你必须严格执行【分支带回主线与重新推理 (Branch -> Mainline Re-reasoning)】机制：
将【原节点结论】与【分支调查的最新实证结果及人类专家确认意见】进行深度融合，重新评估并修正该节点的结论。

【严格执行原则】：
1. 绝对不能简单把分支结论粘贴在后面，必须对原节点结论进行结构性重新评估。
2. 必须明确阐明论证修改轨迹（写入 reasoningRevision 字段）：说明相较于原版本，哪些推断被证实、哪些数据被推翻、哪些风险被重新定级，原结论为何及如何被修正。
3. 修正更新执行摘要（executiveSummary）与详细研判正文（detailedFindingsMarkdown）。
4. 综合吸收原证据链与分支新确证证据（verifiedEvidences）。
5. 更新重大风险清单（criticalRisks）与核心假设验证状态（assumptionsValidated）。
6. 输出基于修正后结论的后续主线推进建议（nextRecommendedStep）。

【项目立项基线 Baseline】:
${JSON.stringify(projectBaseline || {}, null, 2)}

【原主线节点成果 (Original Result)】:
- 原执行摘要: ${originalResult?.executiveSummary || "无"}
- 原详细研判核心要点: ${(originalResult?.detailedFindingsMarkdown || "").slice(0, 1500)}
- 原重大风险: ${JSON.stringify(originalResult?.criticalRisks || [])}
- 原假设状态: ${JSON.stringify(originalResult?.assumptionsValidated || [])}

【完成核验的专项分支成果 (Branch Findings)】:
- 分支标题: ${branchResult?.title || "专项核查"} (ID: ${branchResult?.branchId || branchResult?.id || "N/A"})
- 触发原因: ${branchResult?.triggerReason || "实证深挖"}
- 分支深度调查结论: ${branchResult?.findingsMarkdown || branchResult?.result || "无"}
- 分支关键证据: ${JSON.stringify(branchResult?.evidences || [])}
- 建议主线调整类型: ${branchResult?.modificationType || "modify_judgment"}
- 建议后续动作: ${branchResult?.recommendedAction || "更新论证"}

【人类专家审核确认意见 (User Confirmation)】:
- 专家确认意见: ${userConfirmation?.userNote || "专家已核准分支调查结论，同意带回主线重新推理"}
- 确认时间: ${userConfirmation?.confirmedAt || new Date().toISOString()}

请返回严格合法的单一 JSON 对象（禁止包裹外部文本或非 JSON 内容）：
{
  "reasoningRevision": "明确阐述：相较于上一版本，因分支实证调查核验及专家批注，主线论证发生了哪些实质性修正、补充或推翻...",
  "executiveSummary": "重新推理后的更新版核心执行摘要",
  "detailedFindingsMarkdown": "重新推理后的更新版详细研究论述（深度融合分支新事实与证据）",
  "verifiedEvidences": [
    {
      "title": "证据标题",
      "source": "来源",
      "snippet": "内容摘要",
      "url": "参考链接或文件",
      "supportsFinding": true,
      "reliability": "高 (官方公报/法律文书)"
    }
  ],
  "criticalRisks": [
    {
      "category": "政策与地缘",
      "severity": "高",
      "description": "风险阐述",
      "mitigation": "防范策略"
    }
  ],
  "assumptionsValidated": [
    {
      "hypothesis": "假设命题",
      "status": "validated",
      "explanation": "核验说明"
    }
  ],
  "nextRecommendedStep": "重新推理后建议下一步推进方向"
}`;

    const { response, usedModel, toolsSkipped } = await generateContentWithResilience(ai, {
      primaryModel: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        tools: [{ googleSearch: {} }],
      },
    });

    const durationMs = Date.now() - startTime;
    const responseText = response.text || "";
    const parsed = extractJson(responseText);

    const candidate = response.candidates?.[0];
    const groundingMeta = candidate?.groundingMetadata;
    const webSearchQueries: string[] = groundingMeta?.webSearchQueries || [];
    const groundingChunks = groundingMeta?.groundingChunks || [];

    const searchRequested = !toolsSkipped;
    const searchExecuted = !toolsSkipped && (webSearchQueries.length > 0 || groundingChunks.length > 0);

    const sources = groundingChunks
      .filter((c: any) => c.web?.uri)
      .map((c: any) => ({
        title: c.web?.title || "核验数据源",
        url: c.web?.uri,
        snippet: c.web?.snippet || "",
      }));

    const usage = response.usageMetadata;
    const executionId = `exec-rereason-${nodeId}-${Date.now()}`;
    const parentExecutionId = originalResult?.executionRecord?.executionId || `exec-parent-${Date.now()}`;
    const triggeredByBranchId = branchResult?.branchId || branchResult?.id || "BRANCH-TRIGGER";

    const executionRecord = {
      executionId,
      nodeId,
      nodeName: `主线重新推理: ${nodeName}`,
      branchId: triggeredByBranchId,
      parentExecutionId,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      provider: "Google Gemini",
      model: usedModel,
      promptVersion: originalResult?.promptVersionUsed || "V1.0",
      inputContextLength: prompt.length,
      outputLength: responseText.length,
      aiCalled: true,
      searchRequested,
      searchExecuted,
      searchQueries: webSearchQueries,
      sources,
      status: "completed" as const,
      error: null,
      createdAt: new Date().toISOString(),
      tokens: {
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
      },
      executionSource: "gemini" as const,
    };

    return res.json({
      success: true,
      status: "completed",
      data: {
        ...parsed,
        nodeId,
        nodeName,
        parentExecutionId,
        triggeredByBranchId,
        previousResultId: originalResult?.id,
        generatedAt: new Date().toISOString(),
      },
      executionRecord,
      source: "gemini",
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const isQuota = isQuotaError(error);
    const isTransient = isTransientError(error);
    const isParse =
      error instanceof SyntaxError ||
      error.message?.includes("JSON") ||
      error.message?.includes("解析失败");

    if (isQuota || isTransient || isParse) {
      console.warn(
        `[CIDES AI Notice] Re-evaluate node [${nodeId}] notice:`,
        error.message || error
      );
    } else {
      console.error(`Re-evaluate node [${nodeId}] error:`, error);
    }

    let status = 500;
    let code = "AI_EXECUTION_FAILED";
    let userMessage = `Gemini 主线重新推理【${nodeName}】执行失败: ${error.message || "未知异常"}`;

    if (isQuota) {
      status = 429;
      code = "AI_QUOTA_EXHAUSTED";
      userMessage =
        `Google Gemini API 调用频率或额度已达上限 (429 RESOURCE_EXHAUSTED)。主线重新推理受限。请等待片刻后再试。`;
    } else if (isTransient) {
      status = 503;
      code = "AI_HIGH_DEMAND";
      userMessage =
        `Google Gemini 模型服务当前正遭遇瞬时高并发流量（503 UNAVAILABLE）。主线重新推理已尝试自动退避重试。请稍候点击【重试】。`;
    } else if (isParse) {
      status = 422;
      code = "AI_PARSE_FAILED";
      userMessage = `AI 重新推理生成完成，但结构化结果解析失败: ${error.message}`;
    }

    return res.status(status).json({
      success: false,
      status: isQuota || isTransient ? "blocked" : "failed",
      code,
      error: userMessage,
      rawError: error.message,
      durationMs,
      nodeId,
    });
  }
});

// Vite / static file middleware
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CIDES Expert System server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
