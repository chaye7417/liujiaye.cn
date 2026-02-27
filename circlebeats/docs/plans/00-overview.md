# CircleBeats 优化总览

**日期**：2026-02-26
**项目**：CircleBeats — 基于浏览器的交互式音乐创作平台
**技术栈**：Vanilla JS + Tone.js + p5.js + Three.js + Colyseus
**代码规模**：~28,700 行 JavaScript，30+ 文件，全局作用域

---

## 项目现状

CircleBeats 是一个功能丰富的 Web DAW，支持：
- 16 步圆形音序器（p5.js）
- 实时音频合成（Tone.js，8 个 PolySynth 插槽）
- 3D 可视化背景（Three.js + Bloom + Bokeh 后处理）
- 多用户实时协作（Colyseus WebSocket）
- AI 图像生成（Stability AI）
- ABC 记谱法编辑器
- 钢琴卷帘可视化

主要问题：性能开销大、API Key 暴露、无构建工具、大型资源文件未优化、UI 交互异常、服务端缺失。

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [01-ui-fixes.md](./01-ui-fixes.md) | UI/UX 问题诊断与修复（按钮隐藏、3D 背景、猫位置、交互闪烁） |
| [02-security-performance.md](./02-security-performance.md) | 安全加固（API Key）+ 性能优化（帧率、环境反射、资源压缩） |
| [03-audio-network.md](./03-audio-network.md) | 音频优化（PolySynth 懒加载）+ 网络优化（WebSocket 防抖） |
| [04-engineering.md](./04-engineering.md) | 工程化改造（CDN 锁定、文件拆分、Vite 构建、模块化） |
| [05-colyseus-server.md](./05-colyseus-server.md) | Colyseus 服务端实现方案（当前完全缺失） |

---

## 实施顺序

```
第 0 批（UI 修复，立即可做）
├── UI-1: 控制按钮默认可见（改 CSS + 删 JS hover 逻辑）
├── UI-2: 3D 背景默认显示（需配合 P0-2 帧率控制）
├── UI-3: Live2D 猫位置调整
└── UI-4: 按钮交互修复（随 UI-1 自动解决）

第 1 批（安全 + 性能关键）
├── P0-1: API Key 后端化
├── P0-2: Three.js 帧率控制 30FPS ← 与 UI-2 同步实施
├── P0-3: 环境反射降频至 5 秒
└── P1-4: floor.jpg 压缩

第 2 批（短期，中等工作量）
├── P1-5: 网络同步加防抖
├── P1-6: PolySynth 懒加载
└── P2-7: CDN 版本锁定

第 3 批（中期，重大改造，建议新分支）
├── P2-9: 引入 Vite 构建工具
├── P2-8: 巨型文件拆分
└── P2-10: 代码模块化改造
```

---

## 预期收益

| 指标 | 优化前 | 优化后（预估） |
|------|--------|----------------|
| GPU 负载 | ~100%（持续满帧） | ~40%（30FPS + 环境贴图降频） |
| 首次加载大小 | ~7MB+ | ~2MB（floor.jpg 压缩 + 打包） |
| WebSocket 消息量 | 每次 mousemove | 每 100ms（减少 80-90%） |
| Web Audio 节点数 | 8 PolySynth（启动即创建） | 1-2 PolySynth（按需创建） |
| 安全风险 | API Key 前端暴露 | Key 仅存在服务器端 |
| UI 可发现性 | 按钮/3D 背景默认隐藏 | 核心功能默认可见 |
| 网络协作 | 服务端不存在，连接必失败 | 完整的 Colyseus 服务端 |
