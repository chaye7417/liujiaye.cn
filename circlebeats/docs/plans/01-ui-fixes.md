# UI/UX 问题诊断与修复方案

**优先级**：第 0 批（立即可做）
**关联文档**：[总览](./00-overview.md)

---

## UI-1：左上角控制按钮默认隐藏（严重度：高）

**问题描述**：
`index.html:623-625` — 控制按钮容器 `#controls-container` 默认设为 `opacity: 0` + `visibility: hidden`。用户需要把鼠标悬停在左上角 40×40px 的隐形热区（`#hover-zone`）上才能看到按钮。新用户根本不知道有这些按钮。

按钮列表：Hide Rhythm / Show 3D Scene / 联网协作 / 可视化器 / 总览

**当前代码**：
```css
/* index.html:610-626 */
#controls-container {
    opacity: 0;           /* 初始隐藏 */
    visibility: hidden;   /* 初始完全隐藏 */
}

/* 40x40px 隐形热区 */
#hover-zone {
    width: 40px;
    height: 40px;
}
```

**修复方案**：按钮默认可见，降低视觉干扰但不完全隐藏

```css
#controls-container {
    opacity: 0.6;           /* 默认半透明可见 */
    visibility: visible;    /* 始终可见 */
    transition: opacity 0.3s ease;
}

#controls-container:hover {
    opacity: 1;             /* 悬停时完全可见 */
}
```

同时移除 `#hover-zone` 元素和相关的 JS 悬停逻辑（`setupControlsHoverBehavior` 函数），简化交互。

**改动文件**：`index.html`（CSS + HTML + JS 三处）

---

## UI-2：3D 背景默认隐藏（严重度：中）

**问题描述**：
`three-scene.js:2486` — `let sceneVisible = false`，3D 场景默认不显示。但 Three.js 引擎已经完整初始化（GPU 资源已占用），只是 `renderer.domElement.style.display = 'none'`。

用户进入页面只看到纯黑背景 + 圆形音序器，不知道有 3D 背景功能。

**修复方案**：3D 背景默认显示

```javascript
// three-scene.js
let sceneVisible = true;  // 改为默认显示
```

同时需要确保：
- `index.html` 中 "Show 3D Scene" 按钮的初始文本改为 "Hide 3D Scene"
- 初始化时调用 `showScene()` 而非 `hideScene()`

**改动文件**：`three-scene.js` + `index.html`

**注意**：配合 P0-2（帧率控制 30FPS）一起实施，避免默认显示后 GPU 负载过高。详见 [02-security-performance.md](./02-security-performance.md)。

---

## UI-3：Live2D 猫的位置问题（严重度：中）

**问题描述**：
`cat-chat.js:17-40` — Live2D 猫被放在右侧可视化器面板（`#visualizer-panel`）内的 `#cat-chat-section` 里。但可视化器面板默认是 `hidden`（隐藏在画面右侧外），所以猫一开始就不可见。

此外，Live2D 使用 `position: fixed` + 硬编码偏移（`hOffset: 180, vOffset: 480`）初始化，然后通过 JS 延时 DOM 操作移动到目标容器，这种方式在不同屏幕尺寸上容易错位。

还有一段"暴力"代码每秒重复设置样式 5 次来防止样式被覆盖（`cat-chat.js:87-91`），说明定位机制本身不够稳定。

**选定方案**：可视化器打开时才显示猫（方案 B）
- 保持猫在可视化器面板内
- 但在面板隐藏时，不初始化 Live2D（节省资源）
- 面板打开后再加载猫
- 修复定位机制，使用相对定位替代 fixed + 硬编码偏移

**改动文件**：`index.html`（HTML 结构）+ `cat-chat.js`（初始化逻辑）

---

## UI-4：按钮悬停交互闪烁（严重度：低）

**问题描述**：
`index.html:2322-2371` — 按钮容器的显示/隐藏同时使用了两套机制：
1. CSS `:hover` 伪类（`#hover-zone:hover ~ #controls-panel #controls-container`）
2. JS `mouseenter/mouseleave` 事件（`setupControlsHoverBehavior` 函数）

两套机制互相干扰。当鼠标从热区移向按钮时，中间可能有几像素的间隙导致 mouseleave 触发，按钮闪烁消失。

**修复方案**：采用 UI-1 的修复（按钮始终可见）后，这个问题自动解决。不再需要 hover-zone 和相关的 JS 逻辑。

**改动文件**：`index.html`（删除 `setupControlsHoverBehavior` 函数 + `#hover-zone` 元素）
