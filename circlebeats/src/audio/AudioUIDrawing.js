/**
 * AudioUIDrawing.js - 合成器 UI 绘制方法（第一部分）
 *
 * 包含 drawSynthUI, drawPresetSlots, drawWaveformSelector,
 * drawSynthParameters 等主要绘制方法。
 * 所有方法以 mixin 方式挂载到 AudioSequencer.prototype。
 */

import { WAVEFORM_NAMES, UI_LAYOUT } from './AudioConstants.js';
import { lerp, easeInOutCubic, formatTime, formatPercent } from './AudioEffects.js';

/**
 * 计算 UI 通用布局参数。
 *
 * @returns {Object} 布局参数
 */
function getLayoutParams() {
  const buttonWidth = UI_LAYOUT.slotButtonWidth;
  const spacing = UI_LAYOUT.buttonSpacing;
  const totalWidth = 8 * buttonWidth + 7 * spacing;
  const startX = ui.centerX - totalWidth / 2;
  const waveformStartY = ui.centerY - ui.panelHeight / 2 + 100;
  const envY = waveformStartY + UI_LAYOUT.waveformHeight + UI_LAYOUT.waveToEnvGap;
  const envH = UI_LAYOUT.envelopeHeight;

  return {
    buttonWidth, spacing, totalWidth, startX,
    waveformStartY, envX: startX, envY, envW: totalWidth, envH
  };
}

/**
 * 绘制合成器 UI 主入口。
 */
export function drawSynthUI() {
  if (!this.synthUI.visible) return;

  push();

  fill(200, 220);
  textSize(20);
  textAlign(CENTER);
  text("", ui.centerX, ui.centerY - ui.panelHeight / 2 + 30);

  // 绘制合成器返回按钮
  const buttonWidth = 100;
  const buttonHeight = 30;
  const buttonX = ui.panelX + ui.panelWidth - buttonWidth - 20;
  const buttonY = ui.panelY + 20;

  if (this.synthUI.synthButton.hovered) {
    fill(70, 70, 90, 220);
    stroke(100, 100, 120);
  } else {
    fill(50, 50, 70, 200);
    stroke(80, 80, 100);
  }

  strokeWeight(2);
  rect(buttonX, buttonY, buttonWidth, buttonHeight, 5);

  fill(220);
  textSize(14);
  textAlign(CENTER, CENTER);
  text("Hide Synth", buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);

  this.drawPresetSlots();
  this.drawWaveformSelector();
  this.drawSynthParameters();
  this.drawFilterUI();
  this.drawPortamentoSwitch();
  this.drawDelayControls();
  this.drawReverbControls();

  pop();
}

/**
 * 绘制预设插槽选择器。
 */
export function drawPresetSlots() {
  push();

  const { buttonWidth, spacing, totalWidth, startX } = getLayoutParams();
  const startY = ui.centerY - ui.panelHeight / 2 + 70;

  for (let i = 0; i < 8; i++) {
    const x = startX + i * (buttonWidth + spacing);
    const y = startY;

    const isSelected = i === this.synthUI.currentSlot;
    const isHovered = i === this.synthUI.hoveredSlot;

    let slotColor = color(this.synthUI.slotColors[i]);

    if (isSelected) {
      fill(slotColor);
    } else if (isHovered) {
      slotColor.setAlpha(180);
      fill(slotColor);
    } else {
      slotColor.setAlpha(120);
      fill(slotColor);
    }

    stroke(30, 180);
    strokeWeight(1);
    rect(x, y, buttonWidth, 20);

    fill(255);
    textSize(12);
    textAlign(CENTER, CENTER);
    text(i + 1, x + buttonWidth / 2, y + 10);
  }

  pop();
}

/**
 * 绘制波形选择器。
 */
export function drawWaveformSelector() {
  push();

  const currentSlot = this.synthUI.currentSlot;
  const waveforms = this.synthUI.waveforms;
  const selectedWaveform = this.synthUI.selectedWaveforms[currentSlot];

  const { spacing, totalWidth, startX, waveformStartY } = getLayoutParams();
  const startY = waveformStartY;
  const wfSize = totalWidth / 4 - spacing;

  waveforms.forEach((waveform, i) => {
    const x = startX + i * (wfSize + spacing);
    const y = startY;
    const w = wfSize;
    const h = 25;

    const isSelected = waveform === selectedWaveform;
    const isHovered = i === this.synthUI.hoveredWaveform;

    if (isSelected) {
      fill(color(this.synthUI.slotColors[currentSlot]));
    } else if (isHovered) {
      fill(60, 180);
    } else {
      fill(40, 180);
    }

    stroke(30, 180);
    strokeWeight(1);
    rect(x, y, w, h, 5);

    noFill();

    const padding = 5;
    const graphH = h - padding * 2;
    const graphW = w - padding * 2;

    // 黑色阴影
    stroke(0, 200);
    strokeWeight(3);
    beginShape();
    _drawWaveformShape(waveform, x, y, w, h, padding, graphW, graphH);
    endShape();

    // 白色波形线条
    strokeWeight(2);
    stroke(255, 255, 255);

    beginShape();
    _drawWaveformShape(waveform, x, y, w, h, padding, graphW, graphH);
    endShape();

    // 波形标签
    textAlign(CENTER, BOTTOM);
    textSize(10);
    fill(255);
    noStroke();
    text(WAVEFORM_NAMES[waveform], x + w / 2, y + h + 12);
  });

  pop();
}

/**
 * 绘制波形形状的辅助函数。
 *
 * @param {string} waveform - 波形类型
 * @param {number} x - X坐标
 * @param {number} y - Y坐标
 * @param {number} w - 宽度
 * @param {number} h - 高度
 * @param {number} padding - 内边距
 * @param {number} graphW - 图形宽度
 * @param {number} graphH - 图形高度
 */
function _drawWaveformShape(waveform, x, y, w, h, padding, graphW, graphH) {
  switch (waveform) {
    case 'sine':
      for (let px = 0; px <= graphW; px++) {
        const py = sin(map(px, 0, graphW, 0, TWO_PI)) * graphH / 2;
        vertex(x + px + padding, y + h / 2 + py);
      }
      break;
    case 'triangle':
      vertex(x + padding, y + h / 2 + graphH / 2);
      vertex(x + padding + graphW / 4, y + h / 2 - graphH / 2);
      vertex(x + padding + graphW * 3 / 4, y + h / 2 + graphH / 2);
      vertex(x + padding + graphW, y + h / 2 - graphH / 2);
      break;
    case 'sawtooth':
      vertex(x + padding, y + h / 2 + graphH / 2);
      vertex(x + padding + graphW, y + h / 2 - graphH / 2);
      vertex(x + padding + graphW, y + h / 2 + graphH / 2);
      break;
    case 'square':
      vertex(x + padding, y + h / 2 - graphH / 2);
      vertex(x + padding + graphW / 2, y + h / 2 - graphH / 2);
      vertex(x + padding + graphW / 2, y + h / 2 + graphH / 2);
      vertex(x + padding + graphW, y + h / 2 + graphH / 2);
      break;
  }
}

/**
 * 绘制合成器参数控制（ADSR包络编辑器）。
 */
export function drawSynthParameters() {
  push();
  const currentSlot = this.synthUI.currentSlot;
  const slotColor = color(this.synthUI.slotColors[currentSlot]);

  // 确定使用哪个参数集，处理动画过渡
  let params;

  if (this.synthUI.transition.active) {
    const now = Date.now();
    const elapsed = now - this.synthUI.transition.startTime;
    const duration = this.synthUI.transition.duration;

    if (elapsed >= duration) {
      this.synthUI.transition.active = false;
      params = _getEnvelopeParams(this, currentSlot);
    } else {
      const progress = easeInOutCubic(elapsed / duration);
      const sp = this.synthUI.transition.startParams;
      const ep = this.synthUI.transition.endParams;
      const cp = this.synthUI.transition.currentParams;

      cp.attack = lerp(sp.attack, ep.attack, progress);
      cp.decay = lerp(sp.decay, ep.decay, progress);
      cp.sustain = lerp(sp.sustain, ep.sustain, progress);
      cp.release = lerp(sp.release, ep.release, progress);
      params = cp;
    }
  } else {
    params = _getEnvelopeParams(this, currentSlot);
  }

  const layout = getLayoutParams();
  const { startX, envY, envH } = layout;
  const envX = startX;
  const envW = layout.totalWidth;

  // 绘制页面切换按钮
  _drawPageButtons.call(this, envY, slotColor);

  // 背景框
  const envBackgroundY = envY - 5;
  fill(20, 180);
  stroke(40, 180);
  strokeWeight(1);
  rect(envX - 10, envBackgroundY, envW + 20, envH + 55, 5);

  // 栅格线
  stroke(60, 120);
  strokeWeight(1);
  for (let i = 0; i <= 4; i++) {
    const y = envY + 10 + (envH - 10) * i / 4;
    line(envX, y, envX + envW, y);
  }
  for (let i = 0; i <= 4; i++) {
    const x = envX + (envW * i / 4);
    line(x, envY + 10, x, envY + envH);
  }

  // 计算节点坐标
  const maxTimeWidth = UI_LAYOUT.maxTimeWidth;
  let A = params.attack, D = params.decay, S = params.sustain, R = params.release;
  const paramType = this.synthUI.envelopePage === 0 ? "amp" : "filter";

  const tA = A;
  const tD = tA + D;
  const tS = tD + 1;
  const tR = tS + R;

  const y0 = envY + envH;
  const yMax = envY + 10;

  const ptA = { x: envX + (tA / maxTimeWidth) * envW, y: yMax };
  const ptD = { x: envX + (tD / maxTimeWidth) * envW, y: yMax + (y0 - yMax) * (1 - S) };
  const ptS = { x: envX + (tS / maxTimeWidth) * envW, y: ptD.y };
  const ptR = { x: envX + (tR / maxTimeWidth) * envW, y: y0 };

  // 绘制包络线段
  _drawEnvelopeLines.call(this, envX, y0, ptA, ptD, ptS, ptR, slotColor);

  // 绘制节点
  _drawEnvelopeNodes.call(this, envX, y0, ptA, ptD, ptS, ptR, slotColor);

  // 绘制节点标签
  _drawEnvelopeLabels.call(this, ptA, ptD, ptS, ptR, tS, S, maxTimeWidth);

  // 绘制参数数值标签
  _drawParamLabels.call(this, envX, envY, envW, envH, A, D, S, R, paramType, slotColor);

  pop();
}

// ======================== 私有辅助函数 ========================

function _getEnvelopeParams(seq, slot) {
  if (seq.synthUI.envelopePage === 0) {
    return {
      attack: seq.synthParams[slot].attack,
      decay: seq.synthParams[slot].decay,
      sustain: seq.synthParams[slot].sustain,
      release: seq.synthParams[slot].release,
      volume: seq.synthParams[slot].volume
    };
  } else {
    return {
      attack: seq.synthParams[slot].filterAttack || 0.05,
      decay: seq.synthParams[slot].filterDecay || 0.3,
      sustain: seq.synthParams[slot].filterSustain || 0.5,
      release: seq.synthParams[slot].filterRelease || 0.5,
      volume: seq.synthParams[slot].volume
    };
  }
}

function _drawPageButtons(envY, slotColor) {
  const pageButtonY = envY - 25;
  const pageButtonWidth = 120;
  const pageButtonHeight = 20;
  const pageButtonSpacing = 10;
  const cornerRadius = 5;

  const ampButtonX = ui.centerX - pageButtonWidth - pageButtonSpacing / 2;

  // Amp按钮
  if (this.synthUI.envelopePage === 0) {
    fill(red(slotColor), green(slotColor), blue(slotColor), 220);
  } else if (this.synthUI.hoveredPageButton === 0) {
    fill(red(slotColor), green(slotColor), blue(slotColor), 150);
  } else {
    fill(40, 180);
  }
  stroke(30, 180);
  strokeWeight(1);
  rect(ampButtonX, pageButtonY, pageButtonWidth, pageButtonHeight, cornerRadius);
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(12);
  text("Amp Envelope", ampButtonX + pageButtonWidth / 2, pageButtonY + pageButtonHeight / 2);

  // Filter按钮
  const filterButtonX = ui.centerX + pageButtonSpacing / 2;
  if (this.synthUI.envelopePage === 1) {
    fill(red(slotColor), green(slotColor), blue(slotColor), 220);
  } else if (this.synthUI.hoveredPageButton === 1) {
    fill(red(slotColor), green(slotColor), blue(slotColor), 150);
  } else {
    fill(40, 180);
  }
  stroke(30, 180);
  strokeWeight(1);
  rect(filterButtonX, pageButtonY, pageButtonWidth, pageButtonHeight, cornerRadius);
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(12);
  text("Filter Envelope", filterButtonX + pageButtonWidth / 2, pageButtonY + pageButtonHeight / 2);
}

function _drawEnvelopeLines(envX, y0, ptA, ptD, ptS, ptR, slotColor) {
  noFill();
  const normalOpacity = 100;
  const highlightOpacity = 255;
  const isHighlighted = this.synthUI.hoveredSegment !== null;

  strokeWeight(2);

  const segments = [
    { name: 'A', from: { x: envX, y: y0 }, to: ptA },
    { name: 'D', from: ptA, to: ptD },
    { name: 'S', from: ptD, to: ptS },
    { name: 'R', from: ptS, to: ptR }
  ];

  // 非高亮段落
  for (const seg of segments) {
    if (!(isHighlighted && this.synthUI.hoveredSegment === seg.name)) {
      stroke(255, 255, 255, normalOpacity);
      line(seg.from.x, seg.from.y, seg.to.x, seg.to.y);
    }
  }

  // 高亮段落
  if (isHighlighted) {
    const seg = segments.find(s => s.name === this.synthUI.hoveredSegment);
    if (seg) {
      strokeWeight(6);
      stroke(red(slotColor), green(slotColor), blue(slotColor), 50);
      line(seg.from.x, seg.from.y, seg.to.x, seg.to.y);

      strokeWeight(3);
      stroke(255, 255, 255, highlightOpacity);
      line(seg.from.x, seg.from.y, seg.to.x, seg.to.y);
    }
  }
}

function _drawEnvelopeNodes(envX, y0, ptA, ptD, ptS, ptR, slotColor) {
  strokeWeight(1);
  const isHighlighted = this.synthUI.hoveredSegment !== null;
  const nodeMap = { 'A': ptA, 'D': ptD, 'S': ptS, 'R': ptR };

  // 非高亮节点
  for (const [name, pt] of Object.entries(nodeMap)) {
    if (isHighlighted && this.synthUI.hoveredSegment === name) continue;
    fill(red(slotColor), green(slotColor), blue(slotColor), 150);
    noStroke();
    ellipse(pt.x, pt.y, 10, 10);
  }

  // 高亮节点
  if (isHighlighted) {
    const segments = {
      'A': { start: { x: envX, y: y0 }, end: ptA },
      'D': { start: ptA, end: ptD },
      'S': { start: ptD, end: ptS },
      'R': { start: ptS, end: ptR }
    };

    const seg = segments[this.synthUI.hoveredSegment];
    if (seg) {
      noStroke();
      fill(red(slotColor), green(slotColor), blue(slotColor), 50);
      ellipse(seg.end.x, seg.end.y, 14, 14);
      fill(red(slotColor), green(slotColor), blue(slotColor), 220);
      noStroke();
      ellipse(seg.end.x, seg.end.y, 10, 10);

      if (this.synthUI.hoveredSegment !== 'A') {
        noStroke();
        fill(red(slotColor), green(slotColor), blue(slotColor), 30);
        ellipse(seg.start.x, seg.start.y, 12, 12);
        fill(red(slotColor), green(slotColor), blue(slotColor), 180);
        noStroke();
        ellipse(seg.start.x, seg.start.y, 10, 10);
      }
    }
  }
}

function _drawEnvelopeLabels(ptA, ptD, ptS, ptR, tS, S, maxTimeWidth) {
  fill(255);
  noStroke();
  textSize(12);

  // 简化标签位置
  textAlign(CENTER, BOTTOM);
  text('A', ptA.x, ptA.y - 6);
  text('D', ptD.x, ptD.y - 6);
  textAlign(LEFT, CENTER);
  if (tS > maxTimeWidth * 0.85 || S < 0.2) {
    textAlign(CENTER, BOTTOM);
    text('S', ptS.x, ptS.y - 6);
  } else {
    text('S', ptS.x + 6, ptS.y);
  }
  textAlign(CENTER, BOTTOM);
  text('R', ptR.x, ptR.y - 6);
}

function _drawParamLabels(envX, envY, envW, envH, A, D, S, R, paramType, slotColor) {
  const labelY = envY + envH + 15;
  const labelX1 = envX + envW * 0.125;
  const labelX2 = envX + envW * 0.375;
  const labelX3 = envX + envW * 0.625;
  const labelX4 = envX + envW * 0.875;

  textAlign(CENTER, TOP);
  textSize(11);
  strokeWeight(1);
  stroke(60, 120);

  const labelWidth = 75;
  const labelHeight = 35;

  const isLabelHighlighted = (label) => {
    return this.synthUI.hoveredADSRLabel === label || this.synthUI.hoveredSegment === label;
  };

  const prefix = paramType === "filter" ? "F-" : "";

  _drawSingleParamLabel.call(this, labelX1, labelY, prefix + "Attack", formatTime(A), isLabelHighlighted('A'), slotColor, labelWidth, labelHeight);
  _drawSingleParamLabel.call(this, labelX2, labelY, prefix + "Decay", formatTime(D), isLabelHighlighted('D'), slotColor, labelWidth, labelHeight);
  _drawSingleParamLabel.call(this, labelX3, labelY, prefix + "Sustain", formatPercent(S), isLabelHighlighted('S'), slotColor, labelWidth, labelHeight);
  _drawSingleParamLabel.call(this, labelX4, labelY, prefix + "Release", formatTime(R), isLabelHighlighted('R'), slotColor, labelWidth, labelHeight);
}

function _drawSingleParamLabel(x, y, name, value, isHL, slotColor, labelWidth, labelHeight) {
  if (isHL) {
    fill(60, 200);
    strokeWeight(1.5);
    stroke(red(slotColor), green(slotColor), blue(slotColor), 180);
    rect(x - labelWidth / 2, y - 8, labelWidth, labelHeight, 3);

    stroke(red(slotColor), green(slotColor), blue(slotColor), 220);
    strokeWeight(1.5);
    line(x, y - 3, x - 4, y + 1);
    line(x, y - 3, x + 4, y + 1);
    line(x, y + 25, x - 4, y + 21);
    line(x, y + 25, x + 4, y + 21);

    fill(red(slotColor), green(slotColor), blue(slotColor), 255);
    noStroke();
    textSize(12);
    text(name, x, y - 3);

    fill(red(slotColor), green(slotColor), blue(slotColor), 230);
    textSize(11);
    text(value, x, y + 12);
  } else {
    fill(red(slotColor), green(slotColor), blue(slotColor), 180);
    noStroke();
    text(name, x, y - 3);

    fill(255, 180);
    text(value, x, y + 12);
  }
}
