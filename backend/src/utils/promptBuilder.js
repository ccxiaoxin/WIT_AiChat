/**
 * Prompt 构建器
 */

const CATEGORY_PROMPTS = {
  policy: {
    role: '你是一个熟悉学校政策的专业顾问',
    instruction: '请基于提供的政策文件，准确回答用户的问题。如果政策中有具体条款，请引用说明。'
  },
  major: {
    role: '你是一个专业的学业指导顾问',
    instruction: '请基于提供的课程和专业信息，为学生提供详细的学业指导建议。'
  },
  career: {
    role: '你是一个职业规划专家',
    instruction: '请基于提供的就业信息，为学生提供实用的职业发展建议。'
  },
  general: {
    role: '你是一个专业的问答助手',
    instruction: '请基于提供的知识库内容，准确、完整地回答用户的问题。'
  }
}

/**
 * 构建增强的 Prompt
 */
export function buildPrompt(question, context, category = 'general') {
  const { role, instruction } = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.general
  const contextText = context.chunks.join('\n\n---\n\n')
  
  // 如果没有检索到相关知识，使用通用Prompt
  if (context.chunks.length === 0) {
    return `${role}。

【用户问题】: ${question}

【回答要求】:
1. 请尽可能准确、专业地回答问题
2. 如果不确定，请明确说明
3. 回答要条理清晰、易于理解

请回答：`
  }
  
  // 有相关知识时，使用增强Prompt
  return `${role}。${instruction}

【相关知识库内容】:
${contextText}

【知识来源】: ${context.sources.join(', ')}

【用户问题】: ${question}

【回答要求】:
1. **优先使用上述知识库内容**进行回答
2. 如果知识库中没有相关信息，请说明并给出建议
3. 回答要准确、完整、易懂
4. 适当引用知识来源以增加可信度
5. 避免编造信息

请基于上述知识库内容回答用户问题：`
}

/**
 * 构建简单的对话 Prompt（不使用RAG）
 */
export function buildSimplePrompt(question, systemPrompt = null) {
  if (systemPrompt) {
    return systemPrompt + '\n\n' + question
  }
  return question
}

