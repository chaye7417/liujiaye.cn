/**
 * src/audio/index.js - 音频模块桶文件
 *
 * 将所有拆分模块的方法混入到 AudioSequencer.prototype，
 * 然后将实例挂载到全局 window 对象，保持与原始代码的兼容性。
 */

import AudioSequencer from './AudioSequencer.js';

// 键盘交互
import {
  setupKeyboardEvents,
  playNoteByKeyboard,
  releaseNoteByKeyboard
} from './AudioKeyboard.js';

// 鼠标交互（按下、拖拽、释放、UI事件）
import {
  setupSynthUIEvents,
  handleSynthMousePressed,
  handleFilterControlsPressed,
  handleSynthMouseDragged,
  handleFilterControlsDragged,
  handleSynthMouseReleased
} from './AudioInteraction.js';

// UI 绘制
import {
  drawSynthUI,
  drawPresetSlots,
  drawWaveformSelector,
  drawSynthParameters
} from './AudioUIDrawing.js';

// 滤波器 / 效果 UI 绘制
import {
  drawFilterUI,
  drawFilterBasicControls,
  drawFilterResponseCurve,
  drawFilterParamLabel,
  drawPortamentoSwitch,
  drawDelayControls,
  drawReverbControls
} from './AudioUIFilterDraw.js';

// 鼠标悬停检测
import {
  getLayoutParams,
  getEnvelopeNodes,
  getCurrentEnvParams,
  handleSynthMouseMoved,
  checkFilterControlsHover,
  checkPortamentoHover,
  checkDelayHover,
  checkReverbHover
} from './AudioUIEvents.js';

// 鼠标点击
import { handleSynthMouseClicked } from './AudioUIClick.js';

// 滤波器响应计算
import { calculateFilterResponse, ptLine } from './AudioEffects.js';

// ======================== Prototype 混入 ========================

// 键盘交互
AudioSequencer.prototype.setupKeyboardEvents = setupKeyboardEvents;
AudioSequencer.prototype.playNoteByKeyboard = playNoteByKeyboard;
AudioSequencer.prototype.releaseNoteByKeyboard = releaseNoteByKeyboard;

// UI 事件
AudioSequencer.prototype.setupSynthUIEvents = setupSynthUIEvents;

// 鼠标交互
AudioSequencer.prototype.handleSynthMousePressed = handleSynthMousePressed;
AudioSequencer.prototype.handleFilterControlsPressed = handleFilterControlsPressed;
AudioSequencer.prototype.handleSynthMouseDragged = handleSynthMouseDragged;
AudioSequencer.prototype.handleFilterControlsDragged = handleFilterControlsDragged;
AudioSequencer.prototype.handleSynthMouseReleased = handleSynthMouseReleased;

// UI 绘制
AudioSequencer.prototype.drawSynthUI = drawSynthUI;
AudioSequencer.prototype.drawPresetSlots = drawPresetSlots;
AudioSequencer.prototype.drawWaveformSelector = drawWaveformSelector;
AudioSequencer.prototype.drawSynthParameters = drawSynthParameters;

// 滤波器 / 效果 UI 绘制
AudioSequencer.prototype.drawFilterUI = drawFilterUI;
AudioSequencer.prototype.drawFilterBasicControls = drawFilterBasicControls;
AudioSequencer.prototype.drawFilterResponseCurve = drawFilterResponseCurve;
AudioSequencer.prototype.drawFilterParamLabel = drawFilterParamLabel;
AudioSequencer.prototype.drawPortamentoSwitch = drawPortamentoSwitch;
AudioSequencer.prototype.drawDelayControls = drawDelayControls;
AudioSequencer.prototype.drawReverbControls = drawReverbControls;

// 鼠标悬停检测
AudioSequencer.prototype.getLayoutParams = getLayoutParams;
AudioSequencer.prototype.getEnvelopeNodes = getEnvelopeNodes;
AudioSequencer.prototype.getCurrentEnvParams = getCurrentEnvParams;
AudioSequencer.prototype.handleSynthMouseMoved = handleSynthMouseMoved;
AudioSequencer.prototype.checkFilterControlsHover = checkFilterControlsHover;
AudioSequencer.prototype.checkPortamentoHover = checkPortamentoHover;
AudioSequencer.prototype.checkDelayHover = checkDelayHover;
AudioSequencer.prototype.checkReverbHover = checkReverbHover;

// 鼠标点击
AudioSequencer.prototype.handleSynthMouseClicked = handleSynthMouseClicked;

// 滤波器响应计算
AudioSequencer.prototype.calculateFilterResponse = calculateFilterResponse;
AudioSequencer.prototype.ptLine = ptLine;

// ======================== 全局挂载 ========================

// 将 AudioSequencer 类挂载到全局，保持兼容性
window.AudioSequencer = AudioSequencer;

export default AudioSequencer;
