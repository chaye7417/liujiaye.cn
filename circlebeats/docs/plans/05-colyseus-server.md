# Colyseus 服务端实现方案

**优先级**：P2（需要单独安排时间实施）
**关联文档**：[总览](./00-overview.md)

---

## 问题描述

`partySyncColyseus.js`（3,412 行）实现了完整的客户端协作逻辑，尝试连接 `wss://liujiaye.cn:2567`。但服务器上（81.70.28.90）**从未部署 Colyseus 服务端程序**，2567 端口完全不通。

用户点击"联网协作"按钮后会等待 10 秒超时，然后显示连接失败。

---

## 现状

- **客户端代码**：完整（连接、插槽管理、参数同步、心跳、重连）
- **服务端代码**：不存在
- **服务器端口**：2567 未开放

---

## 待实施方案

需要创建 Colyseus 服务端项目（Node.js），包含：

### 1. 房间定义（`RhythmRoom`）

- 8 个插槽的占用/释放管理
- 节奏 pattern 数据同步
- 合成器参数同步（ADSR、滤波器、效果）
- BPM 同步
- 欢迎消息（`welcome` / `connection_success`）
- 心跳机制
- `requestInitialState` 消息处理

### 2. 部署

- 在服务器 81.70.28.90 上运行（端口 2567）
- 配置 SSL 证书（WSS）
- 使用 pm2 管理进程

### 3. 客户端现有消息协议（服务端需兼容）

| 消息类型 | 方向 | 说明 |
|----------|------|------|
| `heartbeat_response` | 客户端 → 服务端 | 心跳 |
| `requestInitialState` | 客户端 → 服务端 | 请求初始状态 |
| `updateRhythm` | 双向 | 同步节奏数据 |
| `updateSynthParams` | 双向 | 同步合成器参数 |
| `updateBpm` | 双向 | 同步 BPM |
| `selectSlot` | 客户端 → 服务端 | 选择插槽 |
| `releaseSlot` | 客户端 → 服务端 | 释放插槽 |
| `welcome` / `connection_success` | 服务端 → 客户端 | 连接成功确认 |
