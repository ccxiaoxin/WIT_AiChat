# 智能问答系统 - 基于 RAG 的高校学业咨询平台

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.x-brightgreen" alt="Vue 3">
  <img src="https://img.shields.io/badge/Vite-6.x-blueviolet" alt="Vite 6">
  <img src="https://img.shields.io/badge/Node.js-22.x-green" alt="Node.js">
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248" alt="MongoDB">
  <img src="https://img.shields.io/badge/ChromaDB-Vector-orange" alt="ChromaDB">
  <img src="https://img.shields.io/badge/LangChain-RAG-blue" alt="LangChain">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

## 项目简介

本项目是一个基于 **RAG（检索增强生成）** 技术的高校学业智能问答系统，作为毕业设计项目开发。系统能够智能回答关于保研政策、奖学金、毕业论文、专业分流、课程培养方案等学业相关问题，为学生提供精准、及时的咨询服务。

### 核心特性

- **智能问答**：基于 RAG 技术，结合向量检索与大语言模型，提供精准的问答服务
- **知识库管理**：管理员可上传、编辑、删除知识文档，支持文档分块和向量化存储
- **用户反馈机制**：支持点赞/点踩反馈，帮助持续优化系统回答质量
- **数据统计看板**：管理员可查看热门提问分类、用户反馈统计等运营数据
- **用户认证系统**：支持普通用户和管理员角色，权限分离
- **现代化 UI**：采用渐变色彩和动画效果，提供优质的用户体验

## 技术架构

### 前端技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Vue 3 | 3.x | 渐进式 JavaScript 框架 |
| Vite | 6.x | 下一代前端构建工具 |
| TypeScript | 5.x | JavaScript 超集，提供类型安全 |
| Naive UI | 2.x | Vue 3 组件库 |
| Pinia | 3.x | Vue 状态管理库 |
| UnoCSS | - | 原子化 CSS 引擎 |
| ECharts | 5.x | 数据可视化图表库 |
| Axios | - | HTTP 请求库 |

### 后端技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Node.js | 22.x | JavaScript 运行时 |
| Express | 4.x | Web 应用框架 |
| MongoDB | - | NoSQL 数据库（用户、聊天记录） |
| ChromaDB | - | 向量数据库（知识库存储） |
| LangChain | - | LLM 应用开发框架 |
| JWT | - | 用户认证 |

### 大语言模型

| 模型 | 用途 |
|------|------|
| 通义千问 (Qwen) | 主要对话模型 |
| OpenAI Embeddings | 文本向量化 |

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端 (Vue 3 + Vite)                      │
├─────────────────────────────────────────────────────────────────┤
│  登录页  │  聊天页  │  知识库管理  │  数据统计  │  侧边栏导航    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      后端 (Node.js + Express)                    │
├─────────────────────────────────────────────────────────────────┤
│  用户认证  │  聊天接口  │  历史记录  │  知识库API  │  统计API    │
├─────────────────────────────────────────────────────────────────┤
│                         核心服务层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ LLM Service │  │ RAG Service │  │ Classifier Service      │  │
│  │ (大模型调用) │  │ (检索增强)   │  │ (问题分类)              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────────┐
        │ MongoDB  │   │ ChromaDB │   │ 通义千问 API │
        │ (用户/   │   │ (向量    │   │ (对话生成)   │
        │  聊天)   │   │  知识库) │   │              │
        └──────────┘   └──────────┘   └──────────────┘
```

## 功能模块

### 1. 用户端功能

- **智能问答**：输入问题，系统自动检索相关知识并生成回答
- **历史记录**：查看和管理历史对话
- **反馈机制**：对回答进行点赞或点踩，点踩时可选择原因
- **快捷提问**：预设常见问题，一键提问

### 2. 管理员功能

- **知识库管理**
  - 上传文档（支持 txt, md, json, pdf, doc, docx）
  - 自动分块和向量化
  - 编辑/删除文档片段
  - 分类管理

- **数据统计**
  - 热门提问分类饼图
  - 待优化回答列表（用户点踩的回答）
  - 快速跳转知识库优化

## 快速开始

### 环境要求

- Node.js >= 22.12.x
- pnpm >= 10.x
- MongoDB Atlas 账号（或本地 MongoDB）
- ChromaDB 服务

### 安装步骤

#### 1. 克隆项目

```bash
git clone <repository-url>
cd chatgpt-vue3-light-mvp
```

#### 2. 安装前端依赖

```bash
pnpm install
```

#### 3. 安装后端依赖

```bash
cd backend
npm install
```

#### 4. 配置环境变量

**前端配置** - 复制 `.env.template` 为 `.env`：

```bash
cp .env.template .env
```

**后端配置** - 编辑 `backend/.env`：

```env
PORT=3001
NODE_ENV=development

# 通义千问 API Key
VITE_QWEN_KEY=sk-your-qwen-api-key

# ChromaDB 地址
CHROMA_URL=http://localhost:8000

# MongoDB 连接
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/chat_db

# JWT 密钥
JWT_SECRET=your_jwt_secret_key

# 管理员注册密钥
ADMIN_REGISTRATION_KEY=your_admin_key
```

#### 5. 启动 ChromaDB

```bash
# 使用 Docker
docker run -p 8000:8000 chromadb/chroma

# 或使用 pip
pip install chromadb
chroma run --path ./chroma_data --port 8000
```

#### 6. 启动服务

**启动后端**：

```bash
cd backend
npm run dev
```

**启动前端**：

```bash
# 在项目根目录
pnpm dev
```

#### 7. 访问应用

- 前端：http://localhost:2048
- 后端：http://localhost:3001
- 健康检查：http://localhost:3001/health

## 项目结构

```
chatgpt-vue3-light-mvp/
├── src/                          # 前端源码
│   ├── api/                      # API 接口定义
│   ├── components/               # 通用组件
│   │   ├── Layout/              # 布局组件
│   │   ├── MarkdownPreview/     # Markdown 渲染组件
│   │   └── Navigation/          # 导航组件
│   ├── router/                   # 路由配置
│   ├── store/                    # Pinia 状态管理
│   ├── views/                    # 页面组件
│   │   ├── chat.vue             # 聊天页面
│   │   ├── login.vue            # 登录页面
│   │   ├── knowledge.vue        # 知识库管理
│   │   └── stats.vue            # 数据统计
│   └── utils/                    # 工具函数
├── backend/                      # 后端源码
│   ├── src/
│   │   ├── controllers/         # 控制器
│   │   ├── models/              # 数据模型
│   │   ├── routes/              # 路由定义
│   │   ├── services/            # 业务服务
│   │   ├── middleware/          # 中间件
│   │   └── app.js               # 应用入口
│   └── docs/                     # 文档目录
├── docs/                         # 项目文档
└── README.md                     # 项目说明
```

## API 文档

详细 API 文档请参阅 [API_DOCS.md](./API_DOCS.md)

### 主要接口

| 模块 | 接口 | 方法 | 说明 |
|------|------|------|------|
| 用户 | `/api/users/register` | POST | 用户注册 |
| 用户 | `/api/users/login` | POST | 用户登录 |
| 聊天 | `/api/chat/stream` | POST | 流式对话 |
| 历史 | `/api/history` | GET | 获取聊天历史 |
| 知识库 | `/api/knowledge/list` | GET | 获取文档列表 |
| 知识库 | `/api/knowledge/parse` | POST | 解析上传文档 |
| 统计 | `/api/stats/categories` | GET | 分类统计 |

## 知识库分类

系统支持以下知识分类：

| 分类标识 | 分类名称 | 说明 |
|----------|----------|------|
| policy_postgraduate | 保研政策 | 保研条件、流程等 |
| policy_scholarship | 奖学金政策 | 奖学金类型、申请条件 |
| policy_graduation | 毕业论文/设计 | 毕业要求、论文规范 |
| policy_major_split | 专业分流 | 分流政策、选择建议 |
| policy_general | 通用政策 | 其他学业政策 |
| major_intro | 专业介绍 | 专业概述、特色 |
| major_program | 培养方案 | 课程设置、学分要求 |
| career | 就业方向 | 就业前景、发展路径 |

## 开发指南

### 代码规范

- 使用 ESLint + Prettier 进行代码格式化
- 遵循 Vue 3 Composition API 风格
- TypeScript 严格模式

### 提交规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 样式修改
refactor: 代码重构
test: 测试相关
chore: 构建/工具相关
```

## 常见问题

### 1. MongoDB 连接超时

**错误**: `Server selection timed out after 30000 ms`

**解决方案**:
- 检查 MongoDB Atlas 集群是否运行
- 确认 IP 白名单配置
- 检查网络连接

### 2. ChromaDB 连接失败

**解决方案**:
- 确保 ChromaDB 服务已启动
- 检查 `CHROMA_URL` 配置是否正确

### 3. 端口占用

**错误**: `EADDRINUSE: address already in use`

**解决方案**:
```bash
# Windows
netstat -ano | findstr :3001
taskkill /F /PID <PID>

# Linux/Mac
lsof -i :3001
kill -9 <PID>
```

## 技术文档

- [系统设计文档](./docs/SYSTEM_DESIGN.md)
- [API 接口文档](./API_DOCS.md)
- [部署指南](./docs/DEPLOYMENT.md)

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

[MIT](./LICENSE) License

## 致谢

- [chatgpt-vue3-light-mvp](https://github.com/pdsuwwz/chatgpt-vue3-light-mvp) - 项目原型参考
- [LangChain](https://github.com/langchain-ai/langchain) - LLM 应用框架
- [ChromaDB](https://github.com/chroma-core/chroma) - 向量数据库
- [Naive UI](https://www.naiveui.com/) - Vue 3 组件库
