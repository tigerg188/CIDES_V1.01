import {
  ProjectThread,
  ResearchNodeDefinition,
  PhaseResult,
  BranchItem,
  AIExecutionRecord,
} from "../types/cides";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Packer,
  BorderStyle,
  AlignmentType,
  ShadingType,
} from "docx";

function sanitizeFilename(name: string): string {
  return (name || "untitled").replace(/[/\\?%*:|"<>]/g, "_").trim();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerTextDownload(content: string, filename: string, mimeType = "text/markdown;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  triggerDownload(blob, filename);
}

// -------------------------------------------------------------
// 1. Export Current Node Markdown
// -------------------------------------------------------------
export function exportCurrentNodeMarkdown(
  node: ResearchNodeDefinition,
  resultsList: PhaseResult[],
  projectTitle: string
): void {
  const latestResult = resultsList[resultsList.length - 1];
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `NODE-${node.id}-${sanitizeFilename(node.name)}-${dateStr}.md`;

  let md = `# CIDES 跨境投资研判阶段成果报告\n\n`;
  md += `**所属项目**：${projectTitle}\n`;
  md += `**研究节点**：[${node.id}] ${node.name}\n`;
  md += `**导出时间**：${new Date().toLocaleString("zh-CN")}\n`;
  md += `**节点职能定义**：${node.purpose}\n`;
  md += `**当前生效 Prompt 版本**：${node.activePromptVersion}\n\n`;
  md += `---\n\n`;

  if (resultsList.length === 0) {
    md += `*本节点尚未生成 AI 研判结果。*\n`;
  } else {
    md += `## 成果版本沿革 (共 ${resultsList.length} 个版本)\n\n`;

    resultsList.forEach((result, idx) => {
      const isLatest = idx === resultsList.length - 1;
      md += `### ${result.versionLabel} ${isLatest ? "(最新确认基线)" : "(历史版本)"}\n\n`;
      md += `- **成果 ID**：\`${result.id}\`\n`;
      md += `- **生成时间**：${result.generatedAt}\n`;
      md += `- **确认状态**：${result.status}\n`;
      md += `- **调用 Prompt 版本**：${result.promptVersionUsed}\n`;

      if (result.reasoningRevision) {
        md += `\n> **[分支核验后重新推理说明 (Reasoning Revision)]**\n> \n> ${result.reasoningRevision}\n> \n> - 触发分支 ID：\`${result.triggeredByBranchId || "N/A"}\`\n> - 前序成果 ID：\`${result.previousResultId || "N/A"}\`\n\n`;
      }

      md += `\n#### 一、核心执行摘要\n\n${result.executiveSummary}\n\n`;
      md += `#### 二、详细研判内容\n\n${result.detailedFindingsMarkdown}\n\n`;

      if (result.verifiedEvidences && result.verifiedEvidences.length > 0) {
        md += `#### 三、关键确证证据链 (${result.verifiedEvidences.length} 条)\n\n`;
        result.verifiedEvidences.forEach((evi, eIdx) => {
          md += `${eIdx + 1}. **${evi.title}**\n`;
          md += `   - **来源**：${evi.source} ${evi.url ? `([链接](${evi.url}))` : ""}\n`;
          md += `   - **可信度评级**：${evi.reliability}\n`;
          md += `   - **摘要**：${evi.snippet}\n`;
          md += `   - **对研判立场支持**：${evi.supportsFinding ? "支持" : "提出挑战/反驳"}\n\n`;
        });
      }

      if (result.criticalRisks && result.criticalRisks.length > 0) {
        md += `#### 四、关键风险与防范建议\n\n`;
        result.criticalRisks.forEach((risk, rIdx) => {
          md += `${rIdx + 1}. **[${risk.severity}风险 - ${risk.category}]** ${risk.description}\n`;
          md += `   - **防范与缓解对策**：${risk.mitigation}\n\n`;
        });
      }

      if (result.assumptionsValidated && result.assumptionsValidated.length > 0) {
        md += `#### 五、核心假设核验状态\n\n`;
        result.assumptionsValidated.forEach((ass, aIdx) => {
          md += `- **假设 ${aIdx + 1}**：${ass.hypothesis} → **状态**：\`${ass.status}\`\n`;
          md += `  - 阐述：${ass.explanation}\n`;
        });
        md += `\n`;
      }

      if (result.userConfirmationLog) {
        md += `#### 六、人类专家审核与确认记录\n\n`;
        md += `- **确认类型**：${result.userConfirmationLog.type}\n`;
        md += `- **确认时间**：${result.userConfirmationLog.confirmedAt}\n`;
        md += `- **专家批注/修正要求**：${result.userConfirmationLog.userNote || "无特别修正，完全确认批准"}\n\n`;
      }

      if (result.executionRecord) {
        const er = result.executionRecord;
        md += `#### 七、真实 AI 运行凭证与遥测数据\n\n`;
        md += `- **Execution ID**：\`${er.executionId}\`\n`;
        md += `- **AI 供应商**：${er.provider} (${er.model})\n`;
        md += `- **执行源**：\`${er.executionSource}\` (真实 Gemini API 端点调用)\n`;
        md += `- **端到端耗时**：${(er.durationMs / 1000).toFixed(1)} 秒\n`;
        md += `- **Tokens 消耗**：输入 ${er.tokens?.inputTokens || "-"} / 输出 ${er.tokens?.outputTokens || "-"} / 合计 ${er.tokens?.totalTokens || "-"}\n`;
        md += `- **网络搜索调用**：请求检索=${er.searchRequested ? "是" : "否"} | 实际执行检索=${er.searchExecuted ? "是" : "否"}\n`;
        if (er.sources && er.sources.length > 0) {
          md += `- **检索数据源**：\n`;
          er.sources.forEach((s) => {
            md += `  - [${s.title}](${s.url || "#"}) - ${s.snippet}\n`;
          });
        }
        md += `\n`;
      }

      md += `---\n\n`;
    });
  }

  triggerTextDownload(md, filename);
}

// -------------------------------------------------------------
// 2. Export Full Research Report Markdown
// -------------------------------------------------------------
export function exportFullResearchReportMarkdown(thread: ProjectThread): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeTitle = sanitizeFilename(thread.title);
  const filename = `CIDES-${safeTitle}-ResearchReport.md`;

  let md = `# CIDES 跨境投资开发决策专家系统 — 完整项目研判档案\n\n`;
  md += `> 《CIDES自然语言运行定义 V1.02》官方规范导出档案\n\n`;

  // 一、项目基本信息
  md += `## 一、项目基本信息\n\n`;
  md += `- **项目名称**：${thread.title}\n`;
  md += `- **研究线程 ID**：\`${thread.id}\`\n`;
  md += `- **立项时间**：${thread.createdAt}\n`;
  md += `- **最新归档时间**：${thread.updatedAt}\n`;
  md += `- **当前流转位置**：\`${thread.currentNodeId}\`\n\n`;

  // 二、原始投资意图
  md += `## 二、原始投资意图输入\n\n`;
  md += `\`\`\`text\n${thread.rawInput || "未输入"}\n\`\`\`\n\n`;

  // 三、AI 意图识别
  md += `## 三、AI 意图结构化解析\n\n`;
  if (thread.intentResult) {
    const ir = thread.intentResult;
    md += `- **目标标的**：${ir.target}\n`;
    md += `- **投资目的**：${ir.purpose}\n`;
    md += `- **所属国别/区域**：${ir.region}\n`;
    md += `- **项目类型与形态**：${ir.projectType}\n`;
    md += `- **规划投资规模**：${ir.scale}\n`;
    md += `- **资本与资金来源**：${ir.capitalSource}\n`;
    md += `- **核心资源禀赋**：${ir.resources}\n`;
    md += `- **意图基线结构化综述**：\n\n> ${ir.structuredBaselineSummary}\n\n`;

    if (ir.implicitQuestions && ir.implicitQuestions.length > 0) {
      md += `**AI 识别的隐含关键问题**：\n`;
      ir.implicitQuestions.forEach((q) => (md += `- ${q}\n`));
      md += `\n`;
    }
    if (ir.omittedCriticalQuestions && ir.omittedCriticalQuestions.length > 0) {
      md += `**AI 筛查的原意图中被遗漏的核心事项**：\n`;
      ir.omittedCriticalQuestions.forEach((q) => (md += `- ${q}\n`));
      md += `\n`;
    }
  } else {
    md += `*暂无意图结构化解析记录。*\n\n`;
  }

  // 四、用户确认的 Research Baseline
  md += `## 四、用户确认与修正的 Research Baseline\n\n`;
  if (thread.baseline) {
    const bl = thread.baseline;
    md += `- **基线锁定时间**：${bl.confirmedAt}\n`;
    md += `- **确认签署人**：${bl.confirmedBy}\n`;
    md += `- **专家批注与纠偏**：${bl.userModificationsNote || "无特别修正，完全确认批准"}\n`;
    md += `- **核定投资边界**：\n`;
    bl.keyBoundaries?.forEach((b) => (md += `  - ${b}\n`));
    md += `\n`;
  } else {
    md += `*尚未锁定基线。*\n\n`;
  }

  // 五、主线研究过程与节点清单
  md += `## 五、主线研究节点编排流程\n\n`;
  thread.nodes.forEach((node, idx) => {
    const results = thread.phaseResults[node.id] || [];
    const isDone = results.some((r) => r.status === "confirmed");
    md += `${idx + 1}. **[${node.id}] ${node.name}** — 状态：${isDone ? "✅ 已完成并确证" : results.length > 0 ? "⚠️ 待用户确认" : "⏳ 待研判"}\n`;
  });
  md += `\n`;

  // 六、各节点研究结果
  md += `## 六、各节点研判成果详细记录\n\n`;
  thread.nodes.forEach((node) => {
    const results = thread.phaseResults[node.id] || [];
    md += `### 6.${node.id} ${node.name}\n\n`;
    if (results.length === 0) {
      md += `*该节点尚未执行。*\n\n`;
      return;
    }

    results.forEach((res) => {
      md += `#### 【${res.versionLabel}】(${res.status})\n\n`;
      if (res.reasoningRevision) {
        md += `> **[主线重新推理说明]** ${res.reasoningRevision}\n\n`;
      }
      md += `**核心执行摘要**：\n${res.executiveSummary}\n\n`;
      md += `**详细研究论述**：\n\n${res.detailedFindingsMarkdown}\n\n`;

      if (res.verifiedEvidences && res.verifiedEvidences.length > 0) {
        md += `**关键确证证据 (${res.verifiedEvidences.length} 条)**：\n`;
        res.verifiedEvidences.forEach((evi) => {
          md += `- **${evi.title}** (${evi.source}) [可信度: ${evi.reliability}]: ${evi.snippet}\n`;
        });
        md += `\n`;
      }

      if (res.criticalRisks && res.criticalRisks.length > 0) {
        md += `**重大风险识别**：\n`;
        res.criticalRisks.forEach((r) => {
          md += `- [${r.severity}风险 - ${r.category}] ${r.description} (防范：${r.mitigation})\n`;
        });
        md += `\n`;
      }

      if (res.userConfirmationLog) {
        md += `**人类确认批注**：${res.userConfirmationLog.userNote || "已批准"}\n\n`;
      }
    });
  });

  // 七、Branch 动态分支深度研究
  md += `## 七、Branch 动态分支深挖实证研究\n\n`;
  if (thread.activeBranches.length === 0) {
    md += `*主线研判过程中未派生专项深挖分支。*\n\n`;
  } else {
    thread.activeBranches.forEach((b, bIdx) => {
      md += `### 分支 ${bIdx + 1}: ${b.title}\n\n`;
      md += `- **分支 ID**：\`${b.id}\`\n`;
      md += `- **挂载主线节点**：[${b.parentNodeId}] ${b.parentNodeName || ""}\n`;
      md += `- **触发类型**：\`${b.triggerType}\` (${b.triggerReason})\n`;
      md += `- **深挖目标**：${b.objective}\n`;
      md += `- **状态**：\`${b.status}\`\n`;
      md += `- **创建时间**：${b.createdAt}\n`;
      md += `- **完成时间**：${b.completedAt || "进行中"}\n\n`;

      if (b.findingsMarkdown) {
        md += `**分支深度调查报告**：\n\n${b.findingsMarkdown}\n\n`;
      }

      if (b.evidences && b.evidences.length > 0) {
        md += `**分支专项证据**：\n`;
        b.evidences.forEach((e) => {
          md += `- **${e.title}** (${e.source}): ${e.snippet}\n`;
        });
        md += `\n`;
      }

      md += `**对主线的影响评估**：${b.impactOnMainline}\n`;
      md += `**建议主线调整方式**：\`${b.modificationType || "confirm_judgment"}\`\n`;
      md += `**具体后续动作建议**：${b.recommendedAction || "更新相关节点"}\n\n`;
      md += `---\n\n`;
    });
  }

  // 八、Branch 对主线的影响与带回动作
  md += `## 八、动态分支带回主线与上下文同步\n\n`;
  const mergedBranches = thread.activeBranches.filter((b) => b.status === "merged_to_mainline");
  if (mergedBranches.length === 0) {
    md += `*暂无已合并带回主线的分支。*\n\n`;
  } else {
    mergedBranches.forEach((b) => {
      md += `- 分支【${b.title}】已成功并回主线节点【${b.parentNodeId}】，调整策略为【${b.modificationType}】。\n`;
    });
    md += `\n`;
  }

  // 九、重新推理过程 (Mainline Re-reasoning)
  md += `## 九、主线重新推理过程 (Mainline Re-reasoning)\n\n`;
  let hasReReasoning = false;
  Object.entries(thread.phaseResults).forEach(([nodeId, resList]) => {
    resList.forEach((r) => {
      if (r.reasoningRevision) {
        hasReReasoning = true;
        md += `### 节点 [${nodeId}] 重新推理记录 (生成于 ${r.generatedAt})\n\n`;
        md += `- **触发来源分支**：\`${r.triggeredByBranchId || "N/A"}\`\n`;
        md += `- **继承上一成果**：\`${r.previousResultId || "N/A"}\`\n`;
        md += `- **论证修改详情**：\n\n> ${r.reasoningRevision}\n\n`;
      }
    });
  });
  if (!hasReReasoning) {
    md += `*暂无分支触发的主线重新推理记录。*\n\n`;
  }

  // 十、综合研究结果
  md += `## 十、综合研判与可行性结论\n\n`;
  const allNodesConfirmed = thread.nodes.every((n) =>
    (thread.phaseResults[n.id] || []).some((r) => r.status === "confirmed")
  );
  md += `- **研判完备度**：${allNodesConfirmed ? "全节点已确证闭环" : "部分节点待完成"}\n\n`;

  // 十一、最终人工决策
  md += `## 十一、投委会最终决议案\n\n`;
  if (thread.finalDecision) {
    const fd = thread.finalDecision;
    md += `- **决议结论**：**【${fd.decision.toUpperCase()}】**\n`;
    md += `- **签署专家**：${fd.decidedBy}\n`;
    md += `- **签署时间**：${fd.decidedAt}\n`;
    md += `- **决策限额**：${fd.maxInvestmentLimitUSD || "未设限"}\n`;
    md += `- **决议阐述**：\n\n> ${fd.rationale}\n\n`;

    if (fd.conditionsPrecedent && fd.conditionsPrecedent.length > 0) {
      md += `**先决条件清单 (Conditions Precedent)**：\n`;
      fd.conditionsPrecedent.forEach((cp) => (md += `- ${cp}\n`));
      md += `\n`;
    }
    if (fd.criticalRedlines && fd.criticalRedlines.length > 0) {
      md += `**关键否定红线 (Critical Redlines)**：\n`;
      fd.criticalRedlines.forEach((rl) => (md += `- ⛔ ${rl}\n`));
      md += `\n`;
    }
  } else {
    md += `*投委会尚未出具最终决议签署。*\n\n`;
  }

  // 十二、AI 执行追溯与真实度证明
  md += `## 十二、AI 执行追溯与真实度证明 (Audit Trail)\n\n`;
  md += `| 节点/分支 | 执行 ID | 模型 | 耗时 | Tokens | 搜索 | 真实源证明 |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  // Collect all execution records
  const allExecs: AIExecutionRecord[] = [];
  if (thread.intentResult?.executionRecord) allExecs.push(thread.intentResult.executionRecord);
  Object.values(thread.phaseResults).forEach((resList) => {
    resList.forEach((r) => {
      if (r.executionRecord) allExecs.push(r.executionRecord);
    });
  });
  thread.activeBranches.forEach((b) => {
    if (b.executionRecord) allExecs.push(b.executionRecord);
  });

  allExecs.forEach((er) => {
    md += `| ${er.nodeName || er.nodeId} | \`${er.executionId.slice(0, 18)}...\` | ${er.model} | ${(er.durationMs / 1000).toFixed(1)}s | ${er.tokens?.totalTokens || "-"} | ${er.searchExecuted ? "已联网核验" : er.searchRequested ? "请求无返回" : "内生推理"} | \`${er.executionSource}\` |\n`;
  });

  md += `\n---\n*CIDES V1.02 Expert Decision System | Exported at ${new Date().toISOString()}*\n`;

  triggerTextDownload(md, filename);
}

// -------------------------------------------------------------
// 3. Export Full Research DOCX (Windows Native Word compatible)
// -------------------------------------------------------------
export async function exportFullResearchReportDocx(thread: ProjectThread): Promise<void> {
  const safeTitle = sanitizeFilename(thread.title);
  const filename = `CIDES-${safeTitle}-ResearchReport.docx`;

  const docChildren: any[] = [];

  // Title
  docChildren.push(
    new Paragraph({
      text: "CIDES 跨境投资开发决策专家系统",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: `项目研判总档案 — ${thread.title}`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "系统标准：", bold: true }),
        new TextRun("《CIDES自然语言运行定义 V1.02》  |  "),
        new TextRun({ text: "归档时间：", bold: true }),
        new TextRun(`${new Date().toLocaleString("zh-CN")}`),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  // Section 1: Basic Info
  docChildren.push(
    new Paragraph({
      text: "一、项目基本信息与立项参数",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "项目名称：", bold: true }),
        new TextRun(thread.title || "未命名"),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "研究线程 ID：", bold: true }),
        new TextRun(thread.id),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "原始意图输入：\n", bold: true }),
        new TextRun({ text: thread.rawInput || "无", italics: true }),
      ],
      spacing: { after: 250 },
    })
  );

  // Section 2: Baseline
  if (thread.baseline) {
    docChildren.push(
      new Paragraph({
        text: "二、用户确认的 Research Baseline 决策基线",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "锁定时间：", bold: true }),
          new TextRun(`${thread.baseline.confirmedAt}  |  签署人：${thread.baseline.confirmedBy}`),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "目标标的与区域：", bold: true }),
          new TextRun(`${thread.baseline.target} (${thread.baseline.region})`),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "投资规划与资本：", bold: true }),
          new TextRun(`${thread.baseline.scale} | 资金来源：${thread.baseline.capitalSource}`),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "基线综述：\n", bold: true }),
          new TextRun(thread.baseline.summary),
        ],
        spacing: { after: 250 },
      })
    );
  }

  // Section 3: Mainline Nodes
  docChildren.push(
    new Paragraph({
      text: "三、主线研判节点成果与论证记录",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    })
  );

  thread.nodes.forEach((node) => {
    const results = thread.phaseResults[node.id] || [];
    docChildren.push(
      new Paragraph({
        text: `[${node.id}] ${node.name}`,
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      })
    );

    if (results.length === 0) {
      docChildren.push(
        new Paragraph({
          text: "（本节点尚未执行）",
          spacing: { after: 150 },
        })
      );
    } else {
      results.forEach((res) => {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: `【${res.versionLabel}】 `, bold: true, color: "1E3A8A" }),
              new TextRun(`状态：${res.status}  |  生成时间：${res.generatedAt}`),
            ],
            spacing: { before: 100, after: 80 },
          })
        );

        if (res.reasoningRevision) {
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: "【分支核验后重新推理说明】 ", bold: true, color: "B45309" }),
                new TextRun(res.reasoningRevision),
              ],
              spacing: { after: 100 },
            })
          );
        }

        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: "执行摘要：", bold: true }),
              new TextRun(res.executiveSummary),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "详细论证：\n", bold: true }),
              new TextRun(res.detailedFindingsMarkdown),
            ],
            spacing: { after: 150 },
          })
        );

        if (res.criticalRisks && res.criticalRisks.length > 0) {
          docChildren.push(
            new Paragraph({
              text: "重大风险提示：",
              heading: HeadingLevel.HEADING_4,
            })
          );
          res.criticalRisks.forEach((r) => {
            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `• [${r.severity}风险 - ${r.category}] `, bold: true }),
                  new TextRun(`${r.description} (防范措施：${r.mitigation})`),
                ],
              })
            );
          });
        }
      });
    }
  });

  // Section 4: Branches
  docChildren.push(
    new Paragraph({
      text: "四、动态分支专项深挖实证核验",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    })
  );

  if (thread.activeBranches.length === 0) {
    docChildren.push(new Paragraph({ text: "主线研究中未触发专项实证分支。" }));
  } else {
    thread.activeBranches.forEach((b, idx) => {
      docChildren.push(
        new Paragraph({
          text: `分支 ${idx + 1}：${b.title} [${b.status}]`,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 150, after: 80 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "触发原因：", bold: true }),
            new TextRun(`${b.triggerReason}  |  目标：${b.objective}`),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "深度调查结论：\n", bold: true }),
            new TextRun(b.findingsMarkdown || "尚未完成"),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "对主线影响及带回策略：", bold: true }),
            new TextRun(`${b.impactOnMainline} (${b.modificationType || "confirm_judgment"})`),
          ],
          spacing: { after: 200 },
        })
      );
    });
  }

  // Section 5: Decision Desk
  if (thread.finalDecision) {
    docChildren.push(
      new Paragraph({
        text: "五、投委会正式决策签署案",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "最终裁决：", bold: true }),
          new TextRun({ text: thread.finalDecision.decision.toUpperCase(), bold: true, color: "047857" }),
          new TextRun(`  |  签署人：${thread.finalDecision.decidedBy}  |  签署日期：${thread.finalDecision.decidedAt}`),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "决策理由与阐述：\n", bold: true }),
          new TextRun(thread.finalDecision.rationale),
        ],
        spacing: { after: 200 },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, filename);
}

// -------------------------------------------------------------
// 4. Export Execution Log JSON
// -------------------------------------------------------------
export function exportExecutionLogJSON(thread: ProjectThread): void {
  const safeTitle = sanitizeFilename(thread.title);
  const filename = `CIDES-${safeTitle}-ExecutionLog.json`;

  const allRecords: AIExecutionRecord[] = [];
  if (thread.intentResult?.executionRecord) {
    allRecords.push(thread.intentResult.executionRecord);
  }
  Object.values(thread.phaseResults).forEach((resList) => {
    resList.forEach((r) => {
      if (r.executionRecord) allRecords.push(r.executionRecord);
    });
  });
  thread.activeBranches.forEach((b) => {
    if (b.executionRecord) allRecords.push(b.executionRecord);
  });

  const exportPayload = {
    cidesVersion: "V1.02",
    threadId: thread.id,
    projectTitle: thread.title,
    exportedAt: new Date().toISOString(),
    totalExecutions: allRecords.length,
    executionRecords: allRecords,
    operationalLogs: thread.executionLogs,
  };

  triggerTextDownload(JSON.stringify(exportPayload, null, 2), filename, "application/json;charset=utf-8");
}

// -------------------------------------------------------------
// 5. Export Execution Log Markdown
// -------------------------------------------------------------
export function exportExecutionLogMarkdown(thread: ProjectThread): void {
  const safeTitle = sanitizeFilename(thread.title);
  const filename = `CIDES-${safeTitle}-ExecutionLog.md`;

  const allRecords: AIExecutionRecord[] = [];
  if (thread.intentResult?.executionRecord) {
    allRecords.push(thread.intentResult.executionRecord);
  }
  Object.values(thread.phaseResults).forEach((resList) => {
    resList.forEach((r) => {
      if (r.executionRecord) allRecords.push(r.executionRecord);
    });
  });
  thread.activeBranches.forEach((b) => {
    if (b.executionRecord) allRecords.push(b.executionRecord);
  });

  let md = `# CIDES 专家系统完整运行日志与 AI 执行遥测凭证\n\n`;
  md += `**所属项目**：${thread.title}\n`;
  md += `**线程 ID**：\`${thread.id}\`\n`;
  md += `**导出时间**：${new Date().toLocaleString("zh-CN")}\n`;
  md += `**总真实 AI 执行次数**：${allRecords.length} 次\n\n`;
  md += `---\n\n`;

  md += `## 一、AI 端点真实调用执行凭证总表\n\n`;
  md += `| 序号 | 节点/分支 | 执行 ID | 模型 | 耗时(s) | Tokens (入/出/总) | 联网搜索状态 | 真实源验证 |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  allRecords.forEach((rec, idx) => {
    const searchStatus = rec.searchExecuted
      ? `✅ 实际调用 (${rec.sources?.length || 0}源)`
      : rec.searchRequested
      ? `⚠️ 请求但无返回`
      : `内生知识推理`;
    const tokensStr = rec.tokens
      ? `${rec.tokens.inputTokens || 0} / ${rec.tokens.outputTokens || 0} / ${rec.tokens.totalTokens || 0}`
      : "N/A";
    md += `| ${idx + 1} | ${rec.nodeName || rec.nodeId} | \`${rec.executionId}\` | ${rec.model} | ${(rec.durationMs / 1000).toFixed(1)} | ${tokensStr} | ${searchStatus} | \`${rec.executionSource}\` |\n`;
  });

  md += `\n## 二、每次 AI 调用的详细遥测记录\n\n`;

  allRecords.forEach((rec, idx) => {
    md += `### ${idx + 1}. [${rec.nodeId}] ${rec.nodeName}\n\n`;
    md += `- **Execution ID**：\`${rec.executionId}\`\n`;
    if (rec.parentExecutionId) {
      md += `- **父级执行关联 (Parent Execution ID)**：\`${rec.parentExecutionId}\`\n`;
    }
    if (rec.branchId) {
      md += `- **关联分支 ID**：\`${rec.branchId}\`\n`;
    }
    md += `- **AI 供应商与模型**：${rec.provider} / \`${rec.model}\`\n`;
    md += `- **真实执行证明**：\`${rec.executionSource}\` (实测 Gemini API 端点)\n`;
    md += `- **启动时间**：${rec.startedAt}\n`;
    md += `- **完成时间**：${rec.completedAt}\n`;
    md += `- **端到端耗时**：${rec.durationMs} ms (${(rec.durationMs / 1000).toFixed(2)} 秒)\n`;
    md += `- **Prompt 版本**：${rec.promptVersion}\n`;
    md += `- **输入上下文长度**：${rec.inputContextLength} 字符\n`;
    md += `- **输出内容长度**：${rec.outputLength} 字符\n`;
    md += `- **调用状态**：\`${rec.status}\`\n`;
    if (rec.error) {
      md += `- **异常错误记录**：${rec.error}\n`;
    }
    md += `- **Tokens 统计**：输入 ${rec.tokens?.inputTokens || 0}，输出 ${rec.tokens?.outputTokens || 0}，合计 ${rec.tokens?.totalTokens || 0}\n`;
    md += `- **Google Search 检索状态**：请求检索=${rec.searchRequested}，实际检索执行=${rec.searchExecuted}\n`;

    if (rec.sources && rec.sources.length > 0) {
      md += `- **检索数据源清单**：\n`;
      rec.sources.forEach((s) => {
        md += `  - [${s.title}](${s.url || "#"}) - ${s.snippet}\n`;
      });
    }
    md += `\n---\n\n`;
  });

  md += `## 三、系统流水事件日志\n\n`;
  thread.executionLogs.forEach((l) => {
    md += `- [${l.timestamp}] [${l.type}] **${l.nodeName}**：${l.message}\n`;
  });

  triggerTextDownload(md, filename);
}
