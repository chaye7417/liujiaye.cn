# 简谱自定义功能设计

> 日期：2026-03-01
> 状态：待实施
> 改动范围：`templates/jianpu.html` + 新增字体文件

## 目标

为简谱页面添加高级自定义功能：
1. 自定义歌词字体（含楷体、仿宋等扩展字体）
2. 自定义标题字体
3. 自定义页眉内容（左/中/右三栏，仅 PDF 导出时显示）
4. 自定义页脚内容（左/中/右三栏 + 页码，仅 PDF 导出时显示）

---

## 任务 1：打包扩展字体

### 说明

Sparks NMN 自带的字体只有：Roman（西文衬线）、RomanItalic、CommonSerif（宋体）、CommonBlack（黑体）、NotoSansSCLight（思源黑体）。需要额外打包楷体和仿宋的 woff2 字体文件。

### 实现步骤

1. 获取开源楷体和仿宋的 woff2 文件：
   - 楷体：推荐 LXGW WenKai（霞鹜文楷）或方正楷体
   - 仿宋：推荐方正仿宋或思源仿宋

2. 放置到 Sparks NMN 字体目录：
   ```
   static/sparks-nmn/core-resources/font/
   ├── kaiti/
   │   └── kaiti.woff2
   └── fangsong/
       └── fangsong.woff2
   ```

3. 在 `hideSparksTrialBanner()` 或单独的函数中，向 iframe `<head>` 注入 `@font-face` 声明：
   ```css
   @font-face {
       font-family: 'Kaiti';
       src: url('/static/sparks-nmn/core-resources/font/kaiti/kaiti.woff2') format('woff2');
       font-weight: 400;
   }
   @font-face {
       font-family: 'Fangsong';
       src: url('/static/sparks-nmn/core-resources/font/fangsong/fangsong.woff2') format('woff2');
       font-weight: 400;
   }
   ```

### 字体映射表

| 显示名 | Sparks NMN font-family | 文件来源 |
|--------|----------------------|----------|
| 宋体（默认） | CommonSerif | 自带 |
| 黑体 | CommonBlack | 自带 |
| 思源黑体 | NotoSansSCLight | 自带 |
| 西文衬线 | Roman | 自带 |
| 楷体 | Kaiti | 需打包 |
| 仿宋 | Fangsong | 需打包 |

---

## 任务 2：添加设置面板 UI

### 说明

在上传区域下方添加一个可折叠的「高级设置」面板。

### UI 布局

```
┌─ ▶ 高级设置 ────────────────────────────────────┐
│  （折叠状态，点击展开）                           │
└──────────────────────────────────────────────────┘

展开后：
┌─ ▼ 高级设置 ────────────────────────────────────┐
│                                                  │
│  字体设置                                        │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ 歌词字体     │  │ 标题字体     │              │
│  │ [▼ 宋体    ] │  │ [▼ 宋体    ] │              │
│  │ 字重 [▼ 600] │  │ 字重 [▼ 700] │              │
│  └──────────────┘  └──────────────┘              │
│                                                  │
│  页眉页脚（仅导出 PDF 时显示）                    │
│  页眉  左 [________] 中 [________] 右 [________] │
│  页脚  左 [________] 中 [  页码  ] 右 [________] │
│                                                  │
└──────────────────────────────────────────────────┘
```

### HTML 结构

```html
<div class="settings-toggle" onclick="toggleSettings()">
    <span id="settings-arrow">▶</span> 高级设置
</div>
<div class="settings-panel" id="settings-panel" style="display:none">
    <!-- 字体设置 -->
    <div class="settings-section">
        <div class="settings-label">字体设置</div>
        <div class="settings-row">
            <div class="setting-group">
                <label>歌词字体</label>
                <select id="font-lyrics">
                    <option value="CommonSerif">宋体</option>
                    <option value="CommonBlack">黑体</option>
                    <option value="NotoSansSCLight">思源黑体</option>
                    <option value="Kaiti">楷体</option>
                    <option value="Fangsong">仿宋</option>
                    <option value="Roman">西文衬线</option>
                </select>
                <label>字重</label>
                <select id="font-lyrics-weight">
                    <option value="400">400（常规）</option>
                    <option value="600" selected>600（半粗）</option>
                    <option value="700">700（粗体）</option>
                </select>
            </div>
            <div class="setting-group">
                <label>标题字体</label>
                <select id="font-title">
                    <option value="CommonSerif">宋体</option>
                    <option value="CommonBlack">黑体</option>
                    <option value="NotoSansSCLight">思源黑体</option>
                    <option value="Kaiti">楷体</option>
                    <option value="Fangsong">仿宋</option>
                    <option value="Roman">西文衬线</option>
                </select>
                <label>字重</label>
                <select id="font-title-weight">
                    <option value="400">400（常规）</option>
                    <option value="600">600（半粗）</option>
                    <option value="700" selected>700（粗体）</option>
                </select>
            </div>
        </div>
    </div>

    <!-- 页眉页脚 -->
    <div class="settings-section">
        <div class="settings-label">页眉页脚 <span class="settings-hint">（仅导出 PDF 时显示）</span></div>
        <div class="settings-row">
            <label>页眉</label>
            <input type="text" id="header-left" placeholder="左">
            <input type="text" id="header-center" placeholder="中">
            <input type="text" id="header-right" placeholder="右">
        </div>
        <div class="settings-row">
            <label>页脚</label>
            <input type="text" id="footer-left" placeholder="左">
            <input type="text" id="footer-center" placeholder="中（默认页码）" value="页码">
            <input type="text" id="footer-right" placeholder="右">
        </div>
    </div>
</div>
```

### CSS 样式

保持与现有 `.panel` 风格一致：圆角、边框、配色跟随 CSS 变量。

---

## 任务 3：字体设置生效逻辑（前端 JS）

### 说明

用户选择字体后，修改 .spnmn 文本中的 `Rp:` 行，使 Sparks NMN 按选定字体渲染。

### 实现步骤

1. **新增 `applyFontSettings(spnmnText)` 函数：**
   ```javascript
   function applyFontSettings(spnmnText) {
       const lyricsFont = document.getElementById('font-lyrics').value;
       const lyricsWeight = document.getElementById('font-lyrics-weight').value;
       const titleFont = document.getElementById('font-title').value;
       const titleWeight = document.getElementById('font-title-weight').value;

       const rpLine = `Rp: page=A4 font_lyrics=${lyricsFont}/${lyricsWeight}/0.95 font_title=${titleFont}/${titleWeight}`;
       return spnmnText.replace(/^Rp:.*$/m, rpLine);
   }
   ```

2. **修改 `refreshPreview()` 函数：**
   在写入 localStorage 前调用 `applyFontSettings()`：
   ```javascript
   function refreshPreview() {
       let spnmnText = document.getElementById('spnmn-editor').value;
       if (!spnmnText.trim()) { showToast('没有可预览的内容'); return; }

       spnmnText = applyFontSettings(spnmnText);
       localStorage.setItem('sparks-nmn-demo-src', spnmnText);
       // ... iframe 刷新逻辑不变
   }
   ```

3. **字体选择变更时自动刷新预览：**
   给所有 `<select>` 添加 `onchange="refreshPreview()"` 事件。

4. **注入 @font-face（扩展字体）：**
   在 `hideSparksTrialBanner()` 中同步注入楷体和仿宋的 `@font-face` CSS，确保 iframe 内能使用这些字体。

---

## 任务 4：页眉页脚注入（PDF 导出）

### 说明

修改 `exportPdf()` 函数，在调用 `print()` 前向 iframe 注入页眉页脚的 CSS。

### 实现步骤

修改 `exportPdf()` 函数：

```javascript
function exportPdf() {
    const iframe = document.getElementById('sparks-preview');
    if (!iframe || !iframe.contentWindow) { showToast('预览未加载'); return; }
    const text = document.getElementById('spnmn-editor').value;
    if (!text.trim()) { showToast('没有可导出的内容'); return; }

    const doc = iframe.contentDocument;

    // 读取页眉页脚设置
    const headerLeft = document.getElementById('header-left').value;
    const headerCenter = document.getElementById('header-center').value;
    const headerRight = document.getElementById('header-right').value;
    const footerLeft = document.getElementById('footer-left').value;
    const footerCenter = document.getElementById('footer-center').value;
    const footerRight = document.getElementById('footer-right').value;

    // 构建页眉页脚 CSS
    const hasHeader = headerLeft || headerCenter || headerRight;
    const hasFooter = footerLeft || footerCenter || footerRight;

    let printCSS = `
        @media print {
            .demo-important-warning-title { display: none !important; }
    `;

    if (hasHeader || hasFooter) {
        printCSS += `@page { margin: 20mm 15mm; }`;
    }

    if (hasHeader) {
        printCSS += `
            .print-header {
                display: flex !important;
                justify-content: space-between;
                position: fixed;
                top: 0; left: 0; right: 0;
                font-size: 10pt;
                color: #666;
                border-bottom: 0.5pt solid #ccc;
                padding-bottom: 4pt;
            }
        `;
    }

    if (hasFooter) {
        // 页码用 CSS counter(page) 实现
        const footerCenterContent = footerCenter === '页码'
            ? 'counter(page)' : `"${footerCenter}"`;

        printCSS += `
            .print-footer {
                display: flex !important;
                justify-content: space-between;
                position: fixed;
                bottom: 0; left: 0; right: 0;
                font-size: 10pt;
                color: #666;
                border-top: 0.5pt solid #ccc;
                padding-top: 4pt;
            }
            .print-footer .center { content: ${footerCenterContent}; }
        `;
    }

    printCSS += `}`;

    // 注入或更新打印样式
    let styleEl = doc.getElementById('pdf-export-style');
    if (!styleEl) {
        styleEl = doc.createElement('style');
        styleEl.id = 'pdf-export-style';
        doc.head.appendChild(styleEl);
    }
    styleEl.textContent = printCSS;

    // 注入页眉页脚 HTML 元素（如果不存在）
    if (hasHeader && !doc.querySelector('.print-header')) {
        const headerEl = doc.createElement('div');
        headerEl.className = 'print-header';
        headerEl.style.display = 'none';  // 非打印时隐藏
        headerEl.innerHTML = `
            <span>${headerLeft}</span>
            <span>${headerCenter}</span>
            <span>${headerRight}</span>
        `;
        doc.body.prepend(headerEl);
    }

    if (hasFooter && !doc.querySelector('.print-footer')) {
        const footerEl = doc.createElement('div');
        footerEl.className = 'print-footer';
        footerEl.style.display = 'none';  // 非打印时隐藏
        footerEl.innerHTML = `
            <span>${footerLeft}</span>
            <span class="center">${footerCenter === '页码' ? '' : footerCenter}</span>
            <span>${footerRight}</span>
        `;
        doc.body.appendChild(footerEl);
    }

    iframe.contentWindow.print();
}
```

### 技术说明

- `position: fixed` 元素在 `@media print` 中会每页重复显示
- 页码通过 CSS `counter(page)` 自动递增
- 页眉页脚 HTML 在非打印时 `display: none`，只有 `@media print` 时才 `display: flex`
- 每次导出前更新内容，支持用户修改后重新导出

---

## 实施清单

- [ ] **任务 1**：获取楷体和仿宋 woff2 字体文件，放到 `static/sparks-nmn/core-resources/font/` 下
- [ ] **任务 2**：在 `jianpu.html` 添加可折叠设置面板的 HTML 和 CSS
- [ ] **任务 3**：添加 `applyFontSettings()` 函数，修改 `refreshPreview()` 集成字体设置，注入 @font-face
- [ ] **任务 4**：重写 `exportPdf()` 函数，集成页眉页脚注入逻辑

## 改动文件清单

| 文件 | 改动 | 后端 |
|------|------|------|
| `templates/jianpu.html` | 设置面板 + 字体逻辑 + 页眉页脚 | 无 |
| `static/sparks-nmn/core-resources/font/kaiti/` | 新增楷体 woff2 | - |
| `static/sparks-nmn/core-resources/font/fangsong/` | 新增仿宋 woff2 | - |

## 风险与注意事项

- **字体文件大小**：中文字体 woff2 通常 3-8MB，会影响首次加载速度。可考虑懒加载（用户选择楷体/仿宋时才加载）
- **CSS counter(page) 兼容性**：Chrome/Edge 支持良好，Firefox 部分支持。导出 PDF 主要用 Chrome 打印，问题不大
- **@font-face 注入时机**：必须在 iframe 加载后注入，且要在 Sparks NMN 渲染前完成，否则字体可能不生效。建议在 `hideSparksTrialBanner()` 中同步注入
