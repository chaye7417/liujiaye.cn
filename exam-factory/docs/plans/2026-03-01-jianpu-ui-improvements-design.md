# 简谱页面 UI 改进设计

> 日期：2026-03-01
> 状态：待实施
> 改动范围：`templates/jianpu.html`（单文件）

## 目标

1. **隐藏 Sparks NMN 试用模式横幅** — 彻底隐藏 iframe 内的 "Sparks NMN 试用模式" 提示信息
2. **添加导出 PDF 功能** — 一键将简谱预览导出为 PDF

---

## 任务 1：隐藏试用模式横幅

### 问题分析

现有的 `hideSparksTrialBanner()` 在 iframe `onload` 时执行，但 Sparks NMN 是 React SPA，`onload` 触发时 React 可能还没完成 DOM 渲染，导致 `.demo-important-warning-title` 元素尚不存在，隐藏失败。

### 方案：CSS 注入 + MutationObserver 双保险

**修改文件：** `templates/jianpu.html` — `hideSparksTrialBanner()` 函数

**实现步骤：**

1. iframe `onload` 后，向 iframe 的 `<head>` 注入 `<style>` 标签：
   ```css
   .demo-important-warning-title { display: none !important; }
   ```
   - CSS 注入不依赖元素是否已存在，React 后续渲染时自动生效

2. 作为保底，创建 `MutationObserver` 监听 iframe `<body>` 的 DOM 变化：
   - 一旦检测到 `.demo-important-warning-title` 出现，直接 `remove()` 其父容器
   - 移除后 `disconnect()` 停止监听

**为什么比现有方案更好：**
- CSS 注入是即时的，无论 React 何时渲染都会生效
- MutationObserver 作为保底确保彻底移除（而非仅隐藏）
- 两种策略互补，覆盖所有时序可能

---

## 任务 2：添加导出 PDF 按钮

### 方案：浏览器端 print() 导出

利用 Sparks NMN 自带的 `@media print` 样式，通过 `iframe.contentWindow.print()` 触发浏览器打印对话框，用户选择"另存为 PDF"。

### UI 设计

在现有的复制（📋）和下载（💾）按钮旁边添加 PDF 导出按钮（📄），三个按钮并排。

```
┌──────────────────────────────────────────┐
│  [📋 复制]  [💾 下载]  [📄 导出PDF]      │  ← icon-actions 区域
│                                          │
│  ┌──────────────────────────────────┐    │
│  │                                  │    │
│  │      Sparks NMN 预览 iframe      │    │
│  │                                  │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

### 实现步骤

**修改文件：** `templates/jianpu.html`

1. **添加按钮 HTML：**
   ```html
   <button class="icon-btn" onclick="exportPdf()" title="导出 PDF" aria-label="导出 PDF">📄</button>
   ```
   位置：`icon-actions` div 内，在下载按钮之后

2. **添加 exportPdf() 函数：**
   ```javascript
   function exportPdf() {
       const iframe = document.getElementById('sparks-preview');
       if (!iframe || !iframe.contentWindow) {
           showToast('预览未加载');
           return;
       }
       const text = document.getElementById('spnmn-editor').value;
       if (!text.trim()) {
           showToast('没有可导出的内容');
           return;
       }
       // 确保打印时横幅被隐藏
       const doc = iframe.contentDocument;
       if (doc && !doc.getElementById('pdf-export-style')) {
           const style = doc.createElement('style');
           style.id = 'pdf-export-style';
           style.textContent = '@media print { .demo-important-warning-title { display: none !important; } }';
           doc.head.appendChild(style);
       }
       iframe.contentWindow.print();
   }
   ```

### 技术说明

- Sparks NMN 已有完善的 `@media print` CSS（调整布局宽度、隐藏 header、处理分页）
- 浏览器打印对话框自带"另存为 PDF"选项
- 无需后端改动，纯前端实现
- 打印时额外注入 CSS 确保横幅在 PDF 中不出现

---

## 实施清单

- [ ] 重写 `hideSparksTrialBanner()` — CSS 注入 + MutationObserver
- [ ] 添加 PDF 导出按钮到 `icon-actions`
- [ ] 添加 `exportPdf()` 函数
- [ ] 部署测试验证横幅隐藏和 PDF 导出

## 风险与注意事项

- **跨域限制：** iframe 和主页面同源（都是 `/static/sparks-nmn/`），不存在跨域问题
- **浏览器兼容性：** `window.print()` 所有现代浏览器都支持
- **PDF 质量：** 依赖 Sparks NMN 自带的打印样式，已针对 A4 页面优化
