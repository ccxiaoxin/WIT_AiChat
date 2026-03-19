# API 接口文档

## 概述

本文档描述智能问答系统的后端 API 接口。

- **基础 URL**: `http://localhost:3001/api`
- **认证方式**: Bearer Token (JWT)
- **内容类型**: `application/json`

## 认证

除登录和注册接口外，所有接口都需要在请求头中携带 JWT Token：

```
Authorization: Bearer <token>
```

---

## 1. 用户模块

### 1.1 用户注册

**POST** `/users/register`

注册新用户账号。

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名，3-20 字符 |
| password | string | 是 | 密码，至少 6 字符 |

**请求示例**

```json
{
  "username": "testuser",
  "password": "123456"
}
```

**响应示例**

```json
{
  "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
  "username": "testuser",
  "role": "user",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 1.2 管理员注册

**POST** `/users/register-admin`

注册管理员账号，需要管理员密钥。

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |
| adminKey | string | 是 | 管理员注册密钥 |

**请求示例**

```json
{
  "username": "admin",
  "password": "admin123",
  "adminKey": "your-admin-key"
}
```

**响应示例**

```json
{
  "_id": "65f1a2b3c4d5e6f7g8h9i0j2",
  "username": "admin",
  "role": "admin",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 1.3 用户登录

**POST** `/users/login`

用户登录获取 Token。

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |

**请求示例**

```json
{
  "username": "testuser",
  "password": "123456"
}
```

**响应示例**

```json
{
  "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
  "username": "testuser",
  "role": "user",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 1.4 获取用户信息

**GET** `/users/profile`

获取当前登录用户信息。

**请求头**

```
Authorization: Bearer <token>
```

**响应示例**

```json
{
  "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
  "username": "testuser",
  "role": "user"
}
```

---

## 2. 聊天模块

### 2.1 流式对话

**POST** `/chat/stream`

发送问题并获取流式响应。

**请求头**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| question | string | 是 | 用户问题 |
| modelName | string | 否 | 模型名称，默认 qwen |
| useRAG | boolean | 否 | 是否使用 RAG，默认 true |
| history | array | 否 | 历史消息数组 |
| chatId | string | 否 | 对话 ID |

**请求示例**

```json
{
  "question": "保研需要什么条件？",
  "modelName": "qwen",
  "chatId": "65f1a2b3c4d5e6f7g8h9i0j3"
}
```

**响应**

返回 Server-Sent Events (SSE) 流：

```
data: {"content": "保研"}
data: {"content": "需要"}
data: {"content": "满足"}
data: {"content": "以下"}
data: {"content": "条件"}
data: [DONE]
```

**特殊响应字段**

流开始时可能包含元数据：

```
data: {"category": "policy_postgraduate", "sources": ["保研政策.txt"]}
```

---

### 2.2 创建新对话

**POST** `/history`

创建新的对话会话。

**请求头**

```
Authorization: Bearer <token>
```

**响应示例**

```json
{
  "_id": "65f1a2b3c4d5e6f7g8h9i0j3",
  "userId": "65f1a2b3c4d5e6f7g8h9i0j1",
  "title": "新对话",
  "messages": [],
  "createdAt": "2024-03-10T10:00:00.000Z"
}
```

---

## 3. 历史记录模块

### 3.1 获取历史列表

**GET** `/history`

获取当前用户的所有对话列表。

**请求头**

```
Authorization: Bearer <token>
```

**响应示例**

```json
[
  {
    "_id": "65f1a2b3c4d5e6f7g8h9i0j3",
    "title": "关于保研条件的咨询",
    "createdAt": "2024-03-10T10:00:00.000Z",
    "updatedAt": "2024-03-10T10:30:00.000Z"
  },
  {
    "_id": "65f1a2b3c4d5e6f7g8h9i0j4",
    "title": "奖学金申请流程",
    "createdAt": "2024-03-09T15:00:00.000Z",
    "updatedAt": "2024-03-09T15:20:00.000Z"
  }
]
```

---

### 3.2 获取对话详情

**GET** `/history/:chatId`

获取指定对话的完整消息记录。

**请求头**

```
Authorization: Bearer <token>
```

**路径参数**

| 参数 | 说明 |
|------|------|
| chatId | 对话 ID |

**响应示例**

```json
{
  "_id": "65f1a2b3c4d5e6f7g8h9i0j3",
  "title": "关于保研条件的咨询",
  "messages": [
    {
      "_id": "msg1",
      "role": "user",
      "content": "保研需要什么条件？",
      "category": "policy_postgraduate",
      "timestamp": "2024-03-10T10:00:00.000Z"
    },
    {
      "_id": "msg2",
      "role": "assistant",
      "content": "保研需要满足以下条件...",
      "feedback": "like",
      "timestamp": "2024-03-10T10:00:05.000Z"
    }
  ]
}
```

---

### 3.3 删除对话

**DELETE** `/history/:chatId`

删除指定对话。

**请求头**

```
Authorization: Bearer <token>
```

**路径参数**

| 参数 | 说明 |
|------|------|
| chatId | 对话 ID |

**响应示例**

```json
{
  "success": true,
  "message": "删除成功"
}
```

---

### 3.4 更新消息反馈

**PUT** `/history/:chatId/message/:messageId/feedback`

更新消息的反馈状态。

**请求头**

```
Authorization: Bearer <token>
```

**路径参数**

| 参数 | 说明 |
|------|------|
| chatId | 对话 ID |
| messageId | 消息 ID |

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| feedback | string | 是 | 反馈类型：like/dislike/none |
| feedbackReason | string | 否 | 点踩原因（feedback 为 dislike 时） |

**请求示例**

```json
{
  "feedback": "dislike",
  "feedbackReason": "答非所问"
}
```

**响应示例**

```json
{
  "success": true,
  "data": true,
  "message": "反馈更新成功"
}
```

---

## 4. 知识库模块

> 以下接口需要管理员权限

### 4.1 获取文档列表

**GET** `/knowledge/list`

获取知识库中的所有文档。

**请求头**

```
Authorization: Bearer <admin-token>
```

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "source": "保研政策2024.txt",
      "category": "policy_postgraduate",
      "chunkCount": 15
    },
    {
      "source": "奖学金申请指南.pdf",
      "category": "policy_scholarship",
      "chunkCount": 8
    }
  ]
}
```

---

### 4.2 解析文档

**POST** `/knowledge/parse`

上传并解析文档，返回分块结果。

**请求头**

```
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data
```

**表单字段**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 文档文件 |

**支持格式**

- txt, md, json, pdf, doc, docx

**响应示例**

```json
{
  "success": true,
  "data": {
    "sourceName": "保研政策2024.txt",
    "chunks": [
      "第一章 保研基本条件\n\n1. 学业成绩要求...",
      "第二章 申请流程\n\n申请保研需要...",
      "第三章 材料准备\n\n申请人需要准备..."
    ]
  }
}
```

---

### 4.3 保存知识块

**POST** `/knowledge/save`

保存解析后的知识块到向量数据库。

**请求头**

```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chunks | string[] | 是 | 文档块数组 |
| category | string | 是 | 知识分类 |
| sourceName | string | 是 | 来源文件名 |

**请求示例**

```json
{
  "chunks": [
    "第一章 保研基本条件...",
    "第二章 申请流程..."
  ],
  "category": "policy_postgraduate",
  "sourceName": "保研政策2024.txt"
}
```

**响应示例**

```json
{
  "success": true,
  "data": true,
  "message": "保存成功，共 2 个片段"
}
```

---

### 4.4 获取文档分块

**GET** `/knowledge/chunks`

获取指定文档的所有分块内容。

**请求头**

```
Authorization: Bearer <admin-token>
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| source | string | 是 | 文档来源名 |

**请求示例**

```
GET /knowledge/chunks?source=保研政策2024.txt
```

**响应示例**

```json
{
  "success": true,
  "data": [
    "第一章 保研基本条件\n\n1. 学业成绩要求...",
    "第二章 申请流程\n\n申请保研需要...",
    "第三章 材料准备\n\n申请人需要准备..."
  ]
}
```

---

### 4.5 删除文档

**DELETE** `/knowledge/delete`

删除指定文档及其所有分块。

**请求头**

```
Authorization: Bearer <admin-token>
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| source | string | 是 | 文档来源名 |

**请求示例**

```
DELETE /knowledge/delete?source=保研政策2024.txt
```

**响应示例**

```json
{
  "success": true,
  "data": true,
  "message": "删除成功"
}
```

---

## 5. 统计模块

> 以下接口需要管理员权限

### 5.1 获取分类统计

**GET** `/stats/categories`

获取用户提问的分类统计数据。

**请求头**

```
Authorization: Bearer <admin-token>
```

**响应示例**

```json
{
  "success": true,
  "data": [
    { "name": "policy_postgraduate", "value": 45 },
    { "name": "policy_scholarship", "value": 32 },
    { "name": "major_intro", "value": 28 },
    { "name": "policy_graduation", "value": 20 },
    { "name": "general", "value": 15 }
  ]
}
```

---

### 5.2 获取差评反馈

**GET** `/stats/feedbacks`

获取被用户点踩的回答列表。

**请求头**

```
Authorization: Bearer <admin-token>
```

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "chatId": "65f1a2b3c4d5e6f7g8h9i0j3",
      "messageId": "msg123",
      "username": "testuser",
      "question": "保研需要什么条件？",
      "answer": "保研需要...",
      "category": "policy_postgraduate",
      "reason": "答非所问",
      "timestamp": "2024-03-10T10:00:00.000Z"
    }
  ]
}
```

---

## 6. 健康检查

### 6.1 服务健康状态

**GET** `/health`

检查服务健康状态（无需认证）。

**响应示例**

```json
{
  "status": "ok",
  "timestamp": "2024-03-10T10:00:00.000Z"
}
```

---

## 错误响应

所有接口在发生错误时返回统一格式：

```json
{
  "message": "错误描述信息"
}
```

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或 Token 无效 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 知识分类枚举

| 值 | 说明 |
|----|------|
| policy_postgraduate | 保研政策 |
| policy_scholarship | 奖学金政策 |
| policy_graduation | 毕业论文/设计 |
| policy_major_split | 专业分流 |
| policy_general | 通用政策 |
| major_intro | 专业介绍 |
| major_program | 培养方案 |
| career | 就业方向 |
| general | 通用问答 |
