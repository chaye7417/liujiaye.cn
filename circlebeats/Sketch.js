/**
 * Sketch.js - 空壳入口文件
 *
 * 原始的 3330 行 Sketch.js 已拆分为以下模块：
 *   src/sketch/SketchConstants.js  - 常量、颜色数组、UI状态对象、拖拽状态
 *   src/sketch/SketchUtils.js      - 工具函数（颜色计算、数据触发、音高映射、BPM更新等）
 *   src/sketch/SynthUIRenderer.js  - UI绘制函数（面板、按钮、BPM控制、音高控制等）
 *   src/sketch/InputHandler.js     - 鼠标/触摸/键盘事件处理
 *   src/sketch/CircleSequencer.js  - 核心逻辑（setup/draw、步进器绘制、预设管理、OSC）
 *
 * 加载顺序很重要：Constants -> Utils -> SynthUIRenderer -> InputHandler -> CircleSequencer
 * 使用 document.write 在 HTML 解析阶段同步注入脚本，确保在 p5.js 寻找 setup()/draw() 之前加载完毕。
 */

// 版本缓存参数，与 index.html 中的版本号一致
var _sketchVersion = '20240522';

// 按依赖顺序同步加载所有子模块
document.write('<script src="src/sketch/SketchConstants.js?v=' + _sketchVersion + '"><\/script>');
document.write('<script src="src/sketch/SketchUtils.js?v=' + _sketchVersion + '"><\/script>');
document.write('<script src="src/sketch/SynthUIRenderer.js?v=' + _sketchVersion + '"><\/script>');
document.write('<script src="src/sketch/InputHandler.js?v=' + _sketchVersion + '"><\/script>');
document.write('<script src="src/sketch/ClickHandler.js?v=' + _sketchVersion + '"><\/script>');
document.write('<script src="src/sketch/CircleSequencer.js?v=' + _sketchVersion + '"><\/script>');

// 使用partySyncColyseus.js中定义的showSlotSelectionDialog函数
// 使用partySyncColyseus.js中定义的setColyseusViewOnlyMode和selectColyseusSlot函数
// 使用partySyncColyseus.js中定义的canEditColyseusSlot函数检查权限
// Colyseus集成：删除旧的shared变量引用，使用Colyseus连接系统替代
// 使用partySyncColyseus.js中定义的showCustomMessage函数显示消息
