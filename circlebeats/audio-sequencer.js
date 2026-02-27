/**
 * audio-sequencer.js - 空壳入口文件
 *
 * 原始的 5858 行 AudioSequencer 类已拆分为以下模块：
 *   src/audio/AudioConstants.js    - 常量、预设参数、默认配置
 *   src/audio/SynthEngine.js       - 合成器创建、参数管理、懒加载
 *   src/audio/AudioEffects.js      - 滤波器响应计算、工具函数
 *   src/audio/AudioSequencer.js    - 核心类（构造函数、播放调度、BPM控制）
 *   src/audio/AudioKeyboard.js     - 键盘交互（按键映射、音符触发）
 *   src/audio/AudioInteraction.js  - 鼠标交互（点击、拖拽、释放）
 *   src/audio/AudioUIDrawing.js    - UI 绘制（合成器面板、波形、ADSR）
 *   src/audio/AudioUIFilterDraw.js - 滤波器/效果 UI 绘制
 *   src/audio/AudioUIEvents.js     - UI 鼠标悬停检测
 *   src/audio/AudioUIClick.js      - UI 鼠标点击处理
 *   src/audio/index.js             - 桶文件（prototype 混入 + 全局挂载）
 *
 * 此文件仅作为过渡兼容入口。
 * Vite 构建环境下，通过 src/main.js 导入 src/audio/index.js 即可。
 * 非 Vite 环境下，此文件通过 <script type="module"> 加载。
 */
import './src/audio/index.js';
