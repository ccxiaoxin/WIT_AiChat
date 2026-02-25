# 接口文档 (API Documentation)

## 1. 基础信息
*   **Base URL**: `http://localhost:3001/api`
*   **认证方式**: Bearer Token
    *   在 Header 中添加 `Authorization: Bearer <your_token>`
    *   Token 通过登录/注册接口获取。

---

## 2. 用户认证 (Auth)

### 2.1 注册用户
*   **URL**: `/users/register`
*   **Method**: `POST`
*   **Auth**: 无需认证
*   **Body**:
    ```json
    {
      "username": "testuser",
      "password": "password123"
    }
    ```
*   **Response (201)**:
    ```json
    {
      "_id": "65e...",
      "username": "testuser",
      "role": "user",
      "token": "eyJhbGciOiJIUzI1Ni..."
    }
    ```

### 2.2 注册管理员 (仅限内部/特殊用途)
*   **URL**: `/users/register-admin`
*   **Method**: `POST`
*   **Auth**: 无需认证 (但需要 Key)
*   **Body**:
    ```json
    {
      "username": "admin",
      "password": "adminpassword",
      "adminKey": "你的ADMIN_REGISTRATION_KEY"
    }
    ```
*   **Response (201)**: 同注册用户。

### 2.3 用户登录
*   **URL**: `/users/login`
*   **Method**: `POST`
*   **Auth**: 无需认证
*   **Body**:
    ```json
    {
      "username": "testuser",
      "password": "password123"
    }
    ```
*   **Response (200)**: 同注册用户。

### 2.4 获取当前用户信息
*   **URL**: `/users/me`
*   **Method**: `GET`
*   **Auth**: **Required**
*   **Response (200)**:
    ```json
    {
      "_id": "65e...",
      "username": "testuser",
      "role": "user",
      "createdAt": "2024-03-05T..."
    }
    ```

---

## 3. 对话历史 (History)

### 3.1 获取会话列表
*   **URL**: `/history`
*   **Method**: `GET`
*   **Auth**: **Required**
*   **描述**: 获取当前用户的所有会话摘要（用于侧边栏展示）。
*   **Response (200)**:
    ```json
    [
      {
        "_id": "65e123...",
        "title": "关于 RAG 的提问...",
        "updatedAt": "2024-03-05T10:00:00.000Z"
      },
      {
        "_id": "65e456...",
        "title": "新对话",
        "updatedAt": "2024-03-04T09:00:00.000Z"
      }
    ]
    ```

### 3.2 创建新会话
*   **URL**: `/history`
*   **Method**: `POST`
*   **Auth**: **Required**
*   **描述**: 创建一个空白会话，返回新会话的 ID。
*   **Body** (可选):
    ```json
    {
      "title": "自定义标题" // 不传默认 "新对话"
    }
    ```
*   **Response (201)**:
    ```json
    {
      "_id": "65e789...",
      "user": "65e...",
      "title": "新对话",
      "messages": [],
      "createdAt": "..."
    }
    ```

### 3.3 获取会话详情
*   **URL**: `/history/:id`
*   **Method**: `GET`
*   **Auth**: **Required**
*   **描述**: 获取某个会话的完整消息记录（用于点击侧边栏后加载历史消息）。
*   **Response (200)**:
    ```json
    {
      "_id": "65e123...",
      "title": "关于 RAG 的提问",
      "messages": [
        {
          "role": "user",
          "content": "什么是 RAG？",
          "timestamp": "..."
        },
        {
          "role": "assistant",
          "content": "RAG 是检索增强生成...",
          "timestamp": "..."
        }
      ]
    }
    ```

### 3.4 删除会话
*   **URL**: `/history/:id`
*   **Method**: `DELETE`
*   **Auth**: **Required**
*   **Response (200)**:
    ```json
    {
      "message": "对话已删除"
    }
    ```

---

## 4. AI 对话 (Chat)

### 4.1 发送对话 (流式)
*   **URL**: `/chat`
*   **Method**: `POST`
*   **Auth**: **Required** (为了保存历史记录，必须带 Token)
*   **Headers**:
    *   `Content-Type: application/json`
    *   `Authorization: Bearer <token>`
*   **Body**:
    ```json
    {
      "question": "React 的生命周期有哪些？",
      "modelName": "qwen",       // 可选，默认 qwen
      "useRAG": true,            // 可选，默认 true
      "chatId": "65e789...",     // 必填！如果不填，虽然能对话，但不会保存历史
      "history": []              // 可选，附带上下文（目前后端暂未深度使用，主要靠数据库存历史）
    }
    ```
*   **Response**: **Server-Sent Events (SSE)**
    *   `event: category` -> `data: "前端开发"` (问题分类)
    *   `event: content` -> `data: "React"` (流式文本片段)
    *   `event: content` -> `data: " 的生命周期..."`
    *   `event: context` -> `data: { sources: ["react-docs.pdf"], count: 1 }` (引用来源)
    *   `event: done` -> (结束信号)

---

## 5. 知识库管理 (Knowledge) - *现有接口*

### 5.1 上传文档
*   **URL**: `/knowledge/upload`
*   **Method**: `POST`
*   **Auth**: 无需认证 (建议后续加上管理员权限)
*   **Body**: `multipart/form-data`
    *   `file`: (文件对象)

### 5.2 重新处理所有文档
*   **URL**: `/knowledge/process`
*   **Method**: `POST`
*   **Auth**: 无需认证

