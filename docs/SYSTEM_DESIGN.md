# 系统设计文档

## 1. 系统概述

### 1.1 项目背景

随着高校规模的扩大和学业政策的日益复杂，学生在获取准确、及时的学业咨询方面面临诸多挑战。传统的人工咨询方式效率低下，无法满足大量学生的咨询需求。本项目旨在构建一个基于 RAG（检索增强生成）技术的智能问答系统，为学生提供 7x24 小时的学业咨询服务。

### 1.2 系统目标

- **准确性**：基于知识库检索，提供准确的政策解读和学业指导
- **实时性**：支持流式响应，提升用户交互体验
- **可维护性**：管理员可便捷地管理知识库内容
- **可扩展性**：模块化设计，便于功能扩展

### 1.3 用户角色

| 角色 | 权限 | 功能 |
|------|------|------|
| 普通用户 | 基础权限 | 问答对话、查看历史、反馈 |
| 管理员 | 完整权限 | 知识库管理、数据统计、用户管理 |

## 2. 技术架构

### 2.1 整体架构

系统采用前后端分离的 B/S 架构：

```
┌────────────────────────────────────────────────────────────────────┐
│                            客户端层                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Vue 3 + TypeScript                        │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │  │
│  │  │ 登录模块 │ │ 聊天模块 │ │知识库模块│ │ 统计模块 │            │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ RESTful API / Server-Sent Events
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                            服务端层                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Node.js + Express                          │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │                    路由层 (Routes)                       │ │  │
│  │  │  user.js │ chat.js │ history.js │ knowledge.js │ stats.js│ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │                   控制器层 (Controllers)                 │ │  │
│  │  │ userController │ chatController │ knowledgeController   │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │                    服务层 (Services)                     │ │  │
│  │  │ llmService │ ragService │ classifierService │ vectorSvc │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 ▼                ▼                ▼
          ┌──────────┐     ┌──────────┐     ┌──────────────┐
          │ MongoDB  │     │ ChromaDB │     │  LLM API     │
          │  Atlas   │     │ (向量库)  │     │ (通义千问)   │
          └──────────┘     └──────────┘     └──────────────┘
```

### 2.2 核心技术选型

#### 前端技术

| 技术 | 选型理由 |
|------|----------|
| Vue 3 | 组合式 API 提升代码复用性，响应式系统性能优异 |
| TypeScript | 类型安全，提升代码可维护性 |
| Vite | 极速冷启动，优秀的开发体验 |
| Naive UI | 完善的 Vue 3 组件库，TypeScript 友好 |
| Pinia | Vue 3 官方推荐状态管理方案 |
| UnoCSS | 原子化 CSS，按需生成，体积小 |

#### 后端技术

| 技术 | 选型理由 |
|------|----------|
| Node.js | 事件驱动，适合 I/O 密集型应用 |
| Express | 成熟稳定，生态丰富 |
| MongoDB | 灵活的文档模型，适合聊天记录存储 |
| ChromaDB | 开源向量数据库，支持语义检索 |
| LangChain | 简化 LLM 应用开发，提供 RAG 工具链 |

## 3. 数据模型设计

### 3.1 用户模型 (User)

```javascript
{
  _id: ObjectId,
  username: String,          // 用户名，唯一
  password: String,          // 密码（bcrypt 加密）
  role: String,              // 角色：'user' | 'admin'
  createdAt: Date,
  updatedAt: Date
}
```

### 3.2 聊天模型 (Chat)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,          // 关联用户
  title: String,             // 对话标题（首条消息摘要）
  messages: [{
    role: String,            // 'user' | 'assistant'
    content: String,         // 消息内容
    category: String,        // 问题分类（仅 user）
    feedback: String,        // 反馈：'like' | 'dislike' | 'none'
    feedbackReason: String,  // 点踩原因
    timestamp: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### 3.3 向量知识库结构 (ChromaDB)

```javascript
{
  id: String,                // 唯一标识
  document: String,          // 文档内容
  metadata: {
    source: String,          // 来源文件名
    category: String,        // 知识分类
    chunkIndex: Number       // 分块索引
  },
  embedding: Float[]         // 向量表示
}
```

## 4. 核心功能模块

### 4.1 RAG 问答流程

```
用户提问
    │
    ▼
┌─────────────────┐
│  问题分类服务    │  ◄── 使用 LLM 进行意图分类
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  向量检索服务    │  ◄── 基于分类过滤 + 语义相似度检索
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  上下文构建      │  ◄── 整合检索结果构建 Prompt
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  LLM 生成回答    │  ◄── 流式输出
└─────────────────┘
    │
    ▼
返回用户
```

### 4.2 问题分类服务

系统使用 LLM 进行问题意图分类，支持以下类别：

| 分类标识 | 分类名称 | 示例问题 |
|----------|----------|----------|
| policy_postgraduate | 保研政策 | "保研需要什么条件？" |
| policy_scholarship | 奖学金政策 | "国家奖学金怎么申请？" |
| policy_graduation | 毕业论文/设计 | "毕业论文字数要求？" |
| policy_major_split | 专业分流 | "大类分流怎么选专业？" |
| policy_general | 通用政策 | "学分不够怎么办？" |
| major_intro | 专业介绍 | "计算机专业学什么？" |
| major_program | 培养方案 | "必修课有哪些？" |
| career | 就业方向 | "软件工程就业前景？" |
| general | 通用问答 | 其他类型问题 |

### 4.3 向量检索服务

```javascript
// 检索流程
async function retrieveContext(question, category) {
  // 1. 文本向量化
  const embedding = await embeddings.embedQuery(question);
  
  // 2. 相似度检索（带分类过滤）
  const results = await vectorStore.similaritySearch(question, 5, {
    category: category
  });
  
  // 3. 返回检索结果
  return results.map(doc => ({
    content: doc.pageContent,
    source: doc.metadata.source
  }));
}
```

### 4.4 知识库管理

#### 文档处理流程

```
上传文档
    │
    ▼
┌─────────────────┐
│  文件解析        │  ◄── 支持 txt/md/json/pdf/doc/docx
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  文本分块        │  ◄── RecursiveCharacterTextSplitter
└─────────────────┘      chunkSize: 500, overlap: 50
    │
    ▼
┌─────────────────┐
│  向量化存储      │  ◄── OpenAI Embeddings + ChromaDB
└─────────────────┘
```

#### 分块策略

```javascript
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,        // 每块最大 500 字符
  chunkOverlap: 50,      // 块间重叠 50 字符
  separators: ['\n\n', '\n', '。', '！', '？', '；', ' ']
});
```

## 5. 接口设计

### 5.1 认证接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/users/register` | POST | 用户注册 |
| `/api/users/register-admin` | POST | 管理员注册（需密钥） |
| `/api/users/login` | POST | 用户登录 |
| `/api/users/profile` | GET | 获取用户信息 |

### 5.2 对话接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/chat/stream` | POST | 流式对话（SSE） |
| `/api/history` | GET | 获取历史列表 |
| `/api/history/:chatId` | GET | 获取对话详情 |
| `/api/history/:chatId` | DELETE | 删除对话 |
| `/api/history/:chatId/message/:messageId/feedback` | PUT | 更新反馈 |

### 5.3 知识库接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/knowledge/list` | GET | 获取文档列表 |
| `/api/knowledge/parse` | POST | 解析上传文档 |
| `/api/knowledge/save` | POST | 保存知识块 |
| `/api/knowledge/chunks` | GET | 获取文档分块 |
| `/api/knowledge/delete` | DELETE | 删除文档 |

### 5.4 统计接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/stats/categories` | GET | 分类统计 |
| `/api/stats/feedbacks` | GET | 差评反馈列表 |

## 6. 安全设计

### 6.1 认证机制

- **JWT Token**：用户登录后签发，有效期 24 小时
- **Token 验证**：所有需认证接口通过 `authMiddleware` 验证

### 6.2 权限控制

```javascript
// 管理员权限中间件
export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: '需要管理员权限' });
  }
};
```

### 6.3 密码安全

- 使用 **bcrypt** 进行密码哈希
- 盐值轮次：10

### 6.4 输入验证

- 前端表单校验
- 后端参数验证
- SQL/NoSQL 注入防护

## 7. 性能优化

### 7.1 前端优化

- **组件懒加载**：路由级别代码分割
- **按需导入**：UI 组件按需引入
- **状态管理**：Pinia 持久化关键状态

### 7.2 后端优化

- **流式响应**：SSE 实现实时输出
- **向量缓存**：ChromaDB 持久化存储
- **分类器缓存**：缓存标杆数据，减少重复加载

### 7.3 数据库优化

- **索引设计**：userId、chatId 建立索引
- **查询优化**：分页查询，限制返回字段

## 8. 部署架构

### 8.1 开发环境

```
本地开发
├── 前端 (localhost:2048)
├── 后端 (localhost:3001)
├── ChromaDB (localhost:8000)
└── MongoDB Atlas (云端)
```

### 8.2 生产环境建议

```
生产部署
├── 前端 → CDN / Nginx
├── 后端 → PM2 / Docker
├── ChromaDB → Docker 容器
└── MongoDB → Atlas 云服务
```

## 9. 扩展规划

### 9.1 功能扩展

- [ ] 多轮对话上下文
- [ ] 语音输入/输出
- [ ] 知识图谱集成
- [ ] 个性化推荐

### 9.2 性能扩展

- [ ] Redis 缓存层
- [ ] 负载均衡
- [ ] 向量库分片

## 10. 附录

### 10.1 环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| PORT | 后端端口 | 3001 |
| VITE_QWEN_KEY | 通义千问 API Key | sk-xxx |
| CHROMA_URL | ChromaDB 地址 | http://localhost:8000 |
| MONGO_URI | MongoDB 连接串 | mongodb+srv://... |
| JWT_SECRET | JWT 密钥 | your_secret |
| ADMIN_REGISTRATION_KEY | 管理员注册密钥 | admin_key |

### 10.2 错误码定义

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
