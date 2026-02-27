# 工程化改造

**优先级**：第 2-3 批（P2 改善）
**关联文档**：[总览](./00-overview.md)

---

## P2-7：CDN 依赖版本锁定

**问题**：部分 CDN 引用未锁定版本

```html
<!-- 当前：未锁定版本，可能被上游破坏 -->
<script src="https://unpkg.com/colyseus.js/dist/colyseus.js"></script>

<!-- 应该：锁定具体版本 -->
<script src="https://unpkg.com/colyseus.js@0.15.12/dist/colyseus.js"></script>
```

**改动文件**：`index.html`

**工作量**：30 分钟

---

## P2-8：巨型文件拆分

**目标**：将大文件按职责拆分，每个文件控制在 350 行以内

| 原文件 | 行数 | 拆分建议 |
|--------|------|----------|
| `audio-sequencer.js` | 5,822 | → `AudioSequencer.js`（核心类）+ `SynthEngine.js`（合成器逻辑）+ `AudioEffects.js`（延迟/混响）+ `AudioUI.js`（合成器 UI 绘制）|
| `partySyncColyseus.js` | 3,412 | → `ColyseusClient.js`（连接管理）+ `SlotSync.js`（插槽同步）+ `ParamsSync.js`（参数同步）+ `ColyseusUI.js`（UI 弹窗）|
| `Sketch.js` | 3,330 | → `CircleSequencer.js`（圆形序列器绘制）+ `InputHandler.js`（鼠标/触摸交互）+ `SynthUIRenderer.js`（合成器 UI）|
| `three-scene.js` | 2,553 | → `SceneSetup.js`（场景初始化）+ `CameraAnimation.js`（相机路径）+ `SphereManager.js`（小球管理）+ `PostProcessing.js`（后处理）|

**注意**：这是最大的工程量，需要引入模块系统（ES Modules 或构建工具）才能合理拆分。建议与第 9 项一起实施。

---

## P2-9：引入 Vite 构建工具

**收益**：
- 代码打包 + 压缩（Tree-shaking 移除未使用代码）
- ES Modules 支持（告别全局作用域污染）
- 开发热更新（HMR）
- 自动处理 CDN 依赖为 npm 包

**迁移步骤概要**：
1. `npm init -y` + `npm install vite tone p5 three colyseus.js abcjs`
2. 将 `<script>` 标签改为 ES Module `import`
3. 将全局变量改为模块导出/导入
4. 配置 `vite.config.js`
5. 构建输出到 `dist/`

**风险**：这是破坏性改造，需要逐步迁移。建议创建单独分支进行。

**预计工作量**：2-3 天（含测试）

---

## P2-10：代码模块化改造

与第 8、9 项一起实施。将全局变量通信改为事件总线或模块导入：

```javascript
// 当前：全局变量通信
window.metronome = new AudioSequencer();
window.activateSphere = activateSphere;

// 目标：模块化通信
// events.js
export const eventBus = new EventTarget();

// audio-sequencer.js
export const metronome = new AudioSequencer();

// three-scene.js
import { eventBus } from './events.js';
eventBus.addEventListener('beat', (e) => activateSphere(e.detail.index));
```
