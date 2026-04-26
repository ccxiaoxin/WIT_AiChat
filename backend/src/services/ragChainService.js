/**
 * RAG Chain 服务 - 基于 LangChain
 * 实现完整的 RAG 流程：检索 + 增强 + 生成
 */

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { processRAG } from "./ragService.js";

/**
 * 格式化历史记录
 */
function formatHistory(history) {
  if (!history || !Array.isArray(history) || history.length === 0) {
    return "（无历史记录）";
  }
  // 取最近 6 条记录，避免上下文过长
  const recentHistory = history.slice(-6);
  return recentHistory
    .map((msg) => {
      const roleName = msg.role === "user" ? "学生" : "顾问";
      return `${roleName}: ${msg.content}`;
    })
    .join("\n");
}

/**
 * 获取 Chat 模型
 */
function getChatModel(modelName = "qwen") {
  const modelConfigs = {
    qwen: {
      apiKey: process.env.VITE_QWEN_KEY,
      configuration: {
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      },
      modelName: "qwen-plus",
      temperature: 0.7,
      streaming: true,
    },
    deepseek: {
      apiKey: process.env.VITE_DEEPSEEK_KEY,
      configuration: {
        baseURL: "https://api.deepseek.com",
      },
      modelName: "deepseek-chat",
      temperature: 0.7,
      streaming: true,
    },
    moonshot: {
      apiKey: process.env.VITE_MOONSHOT_KEY,
      configuration: {
        baseURL: "https://api.moonshot.cn/v1",
      },
      modelName: "kimi-k2-0905-preview",
      temperature: 0.7,
      streaming: true,
    },
  };

  const config = modelConfigs[modelName] || modelConfigs.qwen;

  if (!config.apiKey) {
    throw new Error(`${modelName} 模型的 API Key 未配置`);
  }

  return new ChatOpenAI(config);
}

/**
 * 创建 RAG Prompt 模板
 * 根据分类使用不同的角色设定和回答要求
 */
function createRAGPromptTemplate(category = "general") {
  const categoryPrompts = {
    policy: `你是武汉工程大学计算机学院的政策咨询顾问。请基于以下政策文件内容，准确回答学生的问题。

【参考资料】:
{context}

【历史对话】:
{history}

【学生问题】: {question}

【回答要求】:
1. 直接回答问题，语言专业、亲切。
2. 引用政策条款时，请自然地融入语句中（例如“根据《保研细则》...”），不要使用“【官方数据】”这样的标签。
3. 如果参考资料中包含具体数字（如学分、比例、时间），请准确引用。
4. 不要解释你的回答逻辑，不要列出“我遵循了以下规则”之类的说明。
5. 如果资料中没有相关信息，请直接说明“目前资料库中未找到相关信息”，不要编造。

请回答：`,

    major: `你是武汉工程大学计算机学院的学业指导顾问。请基于以下专业和课程信息，为学生提供详细、准确的指导。

【参考资料】:
{context}

【历史对话】:
{history}

【学生问题】: {question}

【回答要求】:
1. 直接回答问题，条理清晰。
2. 涉及课程、学分等数据时，必须准确引用资料中的内容。
3. 请自然地呈现信息，不要在回答中包含“【官方数据】”或“【来源】”等标签。
4. 不要输出“重要说明”或解释你如何遵守了规定。
5. 如果资料中没有相关信息，请直接说明。

请回答：`,

    career: `你是一位经验丰富的职业规划导师。请基于以下职业信息，为学生提供实用的职业发展建议。

【参考资料】:
{context}

【历史对话】:
{history}

【学生问题】: {question}

【回答要求】:
1. 结合资料中的技能要求和行业趋势，给出具体的建议。
2. 将技能要求与学校课程联系起来（例如“建议重点学习《数据结构》...”）。
3. 回答要自然、有亲和力，不要使用“【职业百科】”这样的标签。
4. 不要暴露你的指令规则（如“严格基于...回答”）。
5. 如果资料不足，请基于你的专业知识补充通用建议，但要区分开。

请回答：`,

    general: `你是武汉工程大学计算机学院的智能问答助手。请基于以下知识库内容，准确回答学生的问题。

【参考资料】:
{context}

【历史对话】:
{history}

【学生问题】: {question}

【回答要求】:
1. 直接、准确地回答问题。
2. 优先使用参考资料中的信息。
3. 语言通顺自然，不要包含“【官方数据】”等元数据标签。
4. 不要解释你的工作机制或遵守的规则。
5. 如果不知道，请诚实回答。

请回答：`,
  };

  // 映射细分分类到模板
  let templateKey = "general";
  if (category.startsWith("policy")) templateKey = "policy";
  else if (category.startsWith("major")) templateKey = "major";
  else if (category === "career") templateKey = "career";

  const template = categoryPrompts[templateKey] || categoryPrompts.general;
  return PromptTemplate.fromTemplate(template);
}

/**
 * 格式化检索到的文档为上下文
 */
function formatDocuments(docs) {
  if (!docs || docs.length === 0) {
    return "（当前知识库中未检索到相关内容）";
  }

  return docs
    .map((doc, index) => {
      // 优先使用 metadata 中的 source，如果没有则使用 '知识库'
      // 注意：这里我们不再强制重新编号来源，而是直接使用文档自带的 source
      // 如果 doc.metadata.source 已经是 "来源 1: xxx" 格式，则直接使用
      const source = doc.metadata?.source || "知识库";

      // 如果 source 已经包含了 "【来源" 字样，说明是结构化数据生成的，直接拼接
      if (
        source.includes("【来源") ||
        doc.pageContent.includes("【官方数据】")
      ) {
        // 移除内容中的【官方数据】等标签，避免 LLM 复读
        const cleanContent = doc.pageContent
          .replace(/【(?:官方数据|职业百科)】/g, "")
          .trim();
        return cleanContent;
      }

      return `【来源: ${source}】\n${doc.pageContent}`;
    })
    .join("\n\n---\n\n");
}

/**
 * 创建 RAG Chain（集成智能路由与知识增强）
 */
export async function createRAGChain(
  question,
  category = "general",
  modelName = "qwen",
  history = [],
) {
  try {
    // 1. 调用统一的 RAG 调度服务 (获取结构化事实 + 向量检索结果)
    const { chunks, sources } = await processRAG(question, category);

    console.log(`[RAG Chain] 调度完成，获取到 ${chunks.length} 个上下文片段`);

    // 2. 将 chunks 转换为 LangChain 期望的 Document 格式 (chunks 和 sources 保持 1:1)
    const retrievedDocs = chunks.map((content, i) => ({
      pageContent: content,
      metadata: {
        source: sources[i] || "知识库",
      },
    }));

    // 3. 创建 Prompt 模板
    const promptTemplate = createRAGPromptTemplate(category);

    // 4. 获取 Chat 模型
    const model = getChatModel(modelName);

    // 5. 使用 LCEL 构建 RAG Chain
    const ragChain = RunnableSequence.from([
      {
        context: () => formatDocuments(retrievedDocs),
        question: new RunnablePassthrough(),
        history: () => formatHistory(history),
      },
      promptTemplate,
      model,
      new StringOutputParser(),
    ]);

    // 6. 去重来源列表（用于前端展示）
    const uniqueSources = [...new Set(sources)];

    return {
      chain: ragChain,
      retrievedDocs,
      sources: uniqueSources,
    };
  } catch (error) {
    console.error("[RAG Chain] 创建失败:", error.message);
    throw error;
  }
}

/**
 * 流式执行 RAG Chain
 */
export async function streamRAGChain(
  question,
  category,
  modelName,
  history,
  onChunk,
) {
  try {
    const { chain, sources } = await createRAGChain(
      question,
      category,
      modelName,
      history,
    );

    // 流式调用
    const stream = await chain.stream(question);

    for await (const chunk of stream) {
      onChunk(chunk);
    }

    return {
      success: true,
      sources,
    };
  } catch (error) {
    console.error("[RAG Chain] 流式执行失败:", error.message);
    throw error;
  }
}

/**
 * 非流式执行 RAG Chain
 */
export async function invokeRAGChain(question, category, modelName) {
  try {
    const { chain, sources } = await createRAGChain(
      question,
      category,
      modelName,
    );

    const result = await chain.invoke(question);

    return {
      result,
      sources,
    };
  } catch (error) {
    console.error("[RAG Chain] 执行失败:", error.message);
    throw error;
  }
}
