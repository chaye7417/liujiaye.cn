/**
 * AudioUIFilterDraw.js - 滤波器、滑音、延迟和混响 UI 绘制
 *
 * 包含 drawFilterUI, drawFilterBasicControls, drawFilterResponseCurve,
 * drawPortamentoSwitch, drawDelayControls, drawReverbControls 等方法。
 * 所有方法以 mixin 方式挂载到 AudioSequencer.prototype。
 */

import { UI_LAYOUT, FILTER_FREQ_MIN, FILTER_FREQ_MAX } from './AudioConstants.js';
import { calculateFilterResponse, freqToString, freqToNormX } from './AudioEffects.js';

/**
 * 计算布局参数的辅助函数。
 *
 * @returns {Object} 包含各UI区域位置的对象
 */
function getFilterLayoutParams() {
  const buttonWidth = UI_LAYOUT.slotButtonWidth;
  const spacing = UI_LAYOUT.buttonSpacing;
  const totalWidth = 8 * buttonWidth + 7 * spacing;
  const startX = ui.centerX - totalWidth / 2;
  const waveformStartY = ui.centerY - ui.panelHeight / 2 + 100;

  const envX = startX;
  const envY = waveformStartY + UI_LAYOUT.waveformHeight + UI_LAYOUT.waveToEnvGap;
  const envW = totalWidth;
  const envH = UI_LAYOUT.envelopeHeight;

  const filterY = envY + envH + 60;
  const filterX = envX;
  const filterW = envW;
  const filterH = UI_LAYOUT.filterHeight;

  const portSwitchX = filterX - 10;
  const portSwitchY = filterY + filterH + 5;
  const portSwitchWidth = filterW + 20;
  const portSwitchHeight = UI_LAYOUT.switchHeight;

  const delaySwitchX = portSwitchX;
  const delaySwitchY = portSwitchY + portSwitchHeight + 5;
  const delaySwitchWidth = portSwitchWidth;
  const delaySwitchHeight = UI_LAYOUT.effectHeight;

  const reverbSwitchX = delaySwitchX;
  const reverbSwitchY = delaySwitchY + delaySwitchHeight + 5;
  const reverbSwitchWidth = delaySwitchWidth;
  const reverbSwitchHeight = UI_LAYOUT.effectHeight;

  return {
    totalWidth, startX, envX, envY, envW, envH,
    filterX, filterY, filterW, filterH,
    portSwitchX, portSwitchY, portSwitchWidth, portSwitchHeight,
    delaySwitchX, delaySwitchY, delaySwitchWidth, delaySwitchHeight,
    reverbSwitchX, reverbSwitchY, reverbSwitchWidth, reverbSwitchHeight
  };
}

// ======================== 绘制滤波器 UI ========================

export function drawFilterUI() {
  push();
  const currentSlot = this.synthUI.currentSlot;
  const slotColor = color(this.synthUI.slotColors[currentSlot]);
  const params = this.synthParams[currentSlot];
  const lp = getFilterLayoutParams();

  // 背景框
  fill(20, 180);
  stroke(40, 180);
  strokeWeight(1);
  rect(lp.filterX - 10, lp.filterY - 10, lp.filterW + 20, lp.filterH + 20, 5);

  const curveWidth = lp.filterW * 0.75;
  const controlsWidth = lp.filterW - curveWidth;

  // 分隔线
  stroke(60, 120);
  strokeWeight(1);
  line(lp.filterX + controlsWidth, lp.filterY + 10, lp.filterX + controlsWidth, lp.filterY + lp.filterH - 10);

  this.drawFilterBasicControls(lp.filterX, lp.filterY + 10, controlsWidth, lp.filterH - 20);
  this.drawFilterResponseCurve(lp.filterX + controlsWidth + 5, lp.filterY + 10, curveWidth - 10, lp.filterH - 20);

  pop();
}

// ======================== 滤波器基本控制 ========================

export function drawFilterBasicControls(x, y, width, height) {
  push();
  const currentSlot = this.synthUI.currentSlot;
  const params = this.synthParams[currentSlot];
  const slotColor = color(this.synthUI.slotColors[currentSlot]);
  const highlightedControl = this.synthUI.filter.hoveredControl;

  const margin = 5;
  const usableHeight = height - margin * 3;
  const sectionHeight = usableHeight / 4;

  let freqY = y + sectionHeight * 0.5;
  let resY = y + sectionHeight * 1.5 + margin;
  let typeY = y + sectionHeight * 2.5 + margin * 2;
  let envY = y + sectionHeight * 3.5 + margin * 3;

  // 悬停偏移
  if (highlightedControl === "freq") { resY += 5; typeY += 5; envY += 5; }
  else if (highlightedControl === "res") { freqY -= 5; typeY += 5; envY += 5; }
  else if (highlightedControl === "type") { freqY -= 5; resY -= 5; envY += 5; }
  else if (highlightedControl === "env") { freqY -= 5; resY -= 5; typeY -= 5; }

  const controlX = x + width / 2;

  this.drawFilterParamLabel(controlX, freqY, "FREQ", freqToString(params.filterFreq), highlightedControl === "freq", slotColor);
  this.drawFilterParamLabel(controlX, resY, "RES", `${Math.round(params.filterQ * 10) / 10}`, highlightedControl === "res", slotColor);
  this.drawFilterParamLabel(controlX, typeY, "TYPE", params.filterType.toUpperCase(), highlightedControl === "type", slotColor);
  this.drawFilterParamLabel(controlX, envY, "ENV", `${params.filterEnvAmount} OCT`, highlightedControl === "env", slotColor);

  pop();
}

// ======================== 滤波器响应曲线 ========================

export function drawFilterResponseCurve(x, y, width, height) {
  push();
  const currentSlot = this.synthUI.currentSlot;
  const params = this.synthParams[currentSlot];
  const slotColor = color(this.synthUI.slotColors[currentSlot]);

  const isFilterTransitioning = this.synthUI.transition.filterActive;
  let filterFreq = params.filterFreq;
  let filterQ = params.filterQ;
  let filterType = params.filterType;

  if (isFilterTransitioning) {
    const now = Date.now();
    const elapsed = now - this.synthUI.transition.filterStartTime;
    const duration = 300;
    let t = Math.min(1.0, elapsed / duration);
    t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    if (elapsed >= duration) {
      this.synthUI.transition.filterActive = false;
    } else {
      const sp = this.synthUI.transition.filterStartParams;
      const ep = this.synthUI.transition.filterEndParams;
      filterFreq = sp.filterFreq * (1 - t) + ep.filterFreq * t;
      filterQ = sp.filterQ * (1 - t) + ep.filterQ * t;
    }
  }

  const curveY = y;
  const curveHeight = height;

  // 背景和网格
  fill(10, 180);
  stroke(60, 100);
  strokeWeight(1);
  rect(x, curveY, width, curveHeight, 3);

  stroke(60, 80);
  strokeWeight(0.5);
  for (let i = 1; i < 4; i++) { line(x, curveY + curveHeight * i / 4, x + width, curveY + curveHeight * i / 4); }
  for (const freq of [100, 1000, 10000]) {
    const normX = freqToNormX(freq);
    line(x + width * normX, curveY, x + width * normX, curveY + curveHeight);
  }

  // 曲线
  const resolution = 100;
  stroke(red(slotColor), green(slotColor), blue(slotColor), 220);
  strokeWeight(2);
  noFill();
  beginShape();

  if (isFilterTransitioning && this.synthUI.transition.filterActive) {
    const now = Date.now();
    const elapsed = now - this.synthUI.transition.filterStartTime;
    let t = Math.min(1.0, elapsed / 300);
    t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const sp = this.synthUI.transition.filterStartParams;
    const ep = this.synthUI.transition.filterEndParams;

    for (let i = 0; i <= resolution; i++) {
      const tFreq = i / resolution;
      const freq = Math.pow(10, Math.log10(FILTER_FREQ_MIN) + tFreq * (Math.log10(FILTER_FREQ_MAX) - Math.log10(FILTER_FREQ_MIN)));
      const startResponse = calculateFilterResponse(freq, sp.filterFreq, sp.filterQ, sp.filterType);
      const endResponse = calculateFilterResponse(freq, ep.filterFreq, ep.filterQ, ep.filterType);
      const response = startResponse * (1 - t) + endResponse * t;
      vertex(x + width * tFreq, curveY + curveHeight * (1 - response * 0.5));
    }
  } else {
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution;
      const freq = Math.pow(10, Math.log10(FILTER_FREQ_MIN) + t * (Math.log10(FILTER_FREQ_MAX) - Math.log10(FILTER_FREQ_MIN)));
      const response = calculateFilterResponse(freq, filterFreq, filterQ, filterType);
      vertex(x + width * t, curveY + curveHeight * (1 - response * 0.5));
    }
  }
  endShape();

  // 截止频率指示器
  const cutoffX = x + width * freqToNormX(filterFreq);
  const qNormalized = (Math.log(filterQ) - Math.log(0.1)) / (Math.log(20) - Math.log(0.1));
  const ballY = curveY + curveHeight * (1 - qNormalized * 0.8 - 0.1);

  const isHoveringBall = this.synthUI.filter.hoveredControl === "curve" || dist(mouseX, mouseY, cutoffX, ballY) < 12;

  if (isHoveringBall) {
    stroke(255, 230);
    strokeWeight(2);
    fill(red(slotColor), green(slotColor), blue(slotColor), 220);
    ellipse(cutoffX, ballY, 16, 16);
  } else {
    noStroke();
    fill(red(slotColor), green(slotColor), blue(slotColor), 220);
    ellipse(cutoffX, ballY, 16, 16);
  }

  fill(255);
  textSize(11);
  textAlign(CENTER, BOTTOM);
  noStroke();
  text(freqToString(filterFreq), x + width / 2, curveY + curveHeight - 5);

  pop();
}

// ======================== 滤波器参数标签 ========================

export function drawFilterParamLabel(x, y, name, value, isHighlighted, slotColor) {
  push();
  const labelWidth = 70;
  const labelHeight = isHighlighted ? 32 : 28;

  if (isHighlighted) {
    fill(60, 200);
    strokeWeight(1.5);
    stroke(red(slotColor), green(slotColor), blue(slotColor), 180);
    rect(x - labelWidth / 2, y - labelHeight / 2, labelWidth, labelHeight, 4);

    stroke(red(slotColor), green(slotColor), blue(slotColor), 220);
    strokeWeight(1.5);
    line(x, y - labelHeight / 2 + 4, x - 3, y - labelHeight / 2 + 7);
    line(x, y - labelHeight / 2 + 4, x + 3, y - labelHeight / 2 + 7);
    line(x, y + labelHeight / 2 - 4, x - 3, y + labelHeight / 2 - 7);
    line(x, y + labelHeight / 2 - 4, x + 3, y + labelHeight / 2 - 7);

    fill(red(slotColor), green(slotColor), blue(slotColor), 255);
    noStroke();
    textSize(11);
    textAlign(CENTER, CENTER);

    // TYPE过渡动画
    if (name === "TYPE" && this.synthUI.transition.filterActive) {
      const now = Date.now();
      const elapsed = now - this.synthUI.transition.filterStartTime;
      let t = Math.min(1.0, elapsed / 300);
      t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const startType = this.synthUI.transition.filterStartParams.filterType;
      const endType = this.synthUI.transition.filterEndParams.filterType;

      fill(red(slotColor), green(slotColor), blue(slotColor), 230 * (1 - t));
      text(startType.toUpperCase(), x, y + 6);
      fill(red(slotColor), green(slotColor), blue(slotColor), 230 * t);
      text(endType.toUpperCase(), x, y + 6);
    } else {
      text(name, x, y - 6);
      fill(red(slotColor), green(slotColor), blue(slotColor), 230);
      textSize(11);
      text(value, x, y + 6);
    }
  } else {
    fill(30, 120);
    noStroke();
    rect(x - labelWidth / 2, y - labelHeight / 2, labelWidth, labelHeight, 3);

    fill(red(slotColor), green(slotColor), blue(slotColor), 180);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(11);

    if (name === "TYPE" && this.synthUI.transition.filterActive) {
      const now = Date.now();
      const elapsed = now - this.synthUI.transition.filterStartTime;
      let t = Math.min(1.0, elapsed / 300);
      t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const startType = this.synthUI.transition.filterStartParams.filterType;
      const endType = this.synthUI.transition.filterEndParams.filterType;

      fill(255, 180 * (1 - t));
      text(startType.toUpperCase(), x, y + 5);
      fill(255, 180 * t);
      text(endType.toUpperCase(), x, y + 5);
    } else {
      text(name, x, y - 5);
      fill(255, 180);
      text(value, x, y + 5);
    }
  }
  pop();
}

// ======================== 滑音开关 ========================

export function drawPortamentoSwitch() {
  push();
  const currentSlot = this.synthUI.currentSlot;
  const slotColor = color(this.synthUI.slotColors[currentSlot]);
  const portamentoEnabled = this.synthUI.portamento.enabled[currentSlot];
  const isHovering = this.synthUI.portamento.hovering;
  const lp = getFilterLayoutParams();

  fill(20, 180);
  stroke(40, 180);
  strokeWeight(1);
  rect(lp.portSwitchX, lp.portSwitchY, lp.portSwitchWidth, lp.portSwitchHeight, 5);

  fill(255);
  noStroke();
  textAlign(LEFT, CENTER);
  textSize(12);
  text("Portamento:", lp.portSwitchX + 10, lp.portSwitchY + lp.portSwitchHeight / 2);

  // 开关
  const toggleX = lp.portSwitchX + lp.portSwitchWidth - 40;
  const toggleY = lp.portSwitchY + lp.portSwitchHeight / 2;
  const toggleWidth = 30;
  const toggleHeight = 16;

  _drawToggleSwitch(toggleX, toggleY, toggleWidth, toggleHeight, portamentoEnabled, isHovering === 'toggle', slotColor);

  // 滑音时间控制
  if (portamentoEnabled) {
    const valueX = lp.portSwitchX + lp.portSwitchWidth / 2 - 20;
    const portamentoTime = this.synthParams[currentSlot].portamento;

    textAlign(CENTER, CENTER);
    fill(red(slotColor), green(slotColor), blue(slotColor), 220);
    textSize(11);
    text(`${Math.round(portamentoTime * 1000)} ms`, valueX, toggleY);

    const btnSize = 16;
    const btnSpacing = 30;
    _drawPlusMinusButtons(valueX - btnSpacing, valueX + btnSpacing, toggleY, btnSize,
      isHovering === 'minus', isHovering === 'plus', slotColor);
  }

  pop();
}

// ======================== Delay 控制 ========================

export function drawDelayControls() {
  push();
  const currentSlot = this.synthUI.currentSlot;
  const slotColor = color(this.synthUI.slotColors[currentSlot]);
  const delayEnabled = this.synthUI.delay.enabled[currentSlot];
  const isHovering = this.synthUI.delay.hovering;
  const lp = getFilterLayoutParams();

  fill(20, 180);
  stroke(40, 180);
  strokeWeight(1);
  rect(lp.delaySwitchX, lp.delaySwitchY, lp.delaySwitchWidth, lp.delaySwitchHeight, 5);

  fill(255);
  noStroke();
  textAlign(CENTER, TOP);
  textSize(12);
  text("Delay Effect", lp.delaySwitchX + lp.delaySwitchWidth / 2, lp.delaySwitchY + 8);

  const row1Y = lp.delaySwitchY + 28;
  fill(255);
  noStroke();
  textAlign(LEFT, CENTER);
  textSize(12);
  text("Enable:", lp.delaySwitchX + 15, row1Y);

  const toggleX = lp.delaySwitchX + 80;
  _drawToggleSwitch(toggleX, row1Y, 30, 16, delayEnabled, isHovering === 'toggle', slotColor);

  if (delayEnabled) {
    const row2Y = lp.delaySwitchY + 48;
    const valueX = lp.delaySwitchX + lp.delaySwitchWidth / 2 - 110;

    const delayBeats = this.synthUI.delay.values[currentSlot];
    let delayText = "";
    if (delayBeats === 0.125) delayText = "1/8";
    else if (delayBeats === 0.25) delayText = "1/4";
    else if (delayBeats === 0.5) delayText = "1/2";
    else if (delayBeats === 1) delayText = "1";
    else if (delayBeats === 1.5) delayText = "1 1/2";
    else if (delayBeats === 2) delayText = "2";
    else delayText = delayBeats.toString();

    const btnSize = 20;
    const btnSpacing = 40;
    const minusX = valueX - btnSpacing / 2;
    const plusX = valueX + btnSpacing / 2;

    _drawPlusMinusButtons(minusX, plusX, row2Y, btnSize,
      isHovering === 'minus', isHovering === 'plus', slotColor);

    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(13);
    text(delayText, valueX, row2Y);

    // 反馈滑块
    const fbLabelX = valueX + 140;
    const fbX = fbLabelX + 70;
    const fbY = row2Y;

    fill(255);
    noStroke();
    textAlign(RIGHT, CENTER);
    textSize(12);
    text("Feedback:", fbLabelX - 20, fbY);

    const fbValue = this.synthUI.delay.feedback[currentSlot];
    const fbWidth = 80;
    _drawSlider(fbX - fbWidth, fbY, fbWidth, 8, fbValue, isHovering === 'feedback', slotColor);

    fill(255);
    noStroke();
    textAlign(LEFT, CENTER);
    textSize(10);
    text(`${Math.round(fbValue * 100)}%`, fbX + 10, fbY);
  }

  pop();
}

// ======================== Reverb 控制 ========================

export function drawReverbControls() {
  push();
  const currentSlot = this.synthUI.currentSlot;
  const slotColor = color(this.synthUI.slotColors[currentSlot]);
  const reverbEnabled = this.synthUI.reverb.enabled[currentSlot];
  const isHovering = this.synthUI.reverb.hovering;
  const lp = getFilterLayoutParams();

  fill(20, 180);
  stroke(40, 180);
  strokeWeight(1);
  rect(lp.reverbSwitchX, lp.reverbSwitchY, lp.reverbSwitchWidth, lp.reverbSwitchHeight, 5);

  fill(255);
  noStroke();
  textAlign(CENTER, TOP);
  textSize(12);
  text("Reverb Effect", lp.reverbSwitchX + lp.reverbSwitchWidth / 2, lp.reverbSwitchY + 8);

  const row1Y = lp.reverbSwitchY + 28;
  fill(255);
  noStroke();
  textAlign(LEFT, CENTER);
  textSize(12);
  text("Enable:", lp.reverbSwitchX + 15, row1Y);

  const toggleX = lp.reverbSwitchX + 80;
  _drawToggleSwitch(toggleX, row1Y, 30, 16, reverbEnabled, isHovering === 'toggle', slotColor);

  if (reverbEnabled) {
    const row2Y = lp.reverbSwitchY + 48;

    // Decay控制
    fill(255);
    noStroke();
    textAlign(RIGHT, CENTER);
    textSize(12);
    text("Decay:", lp.reverbSwitchX + 65, row2Y);

    const decayX = lp.reverbSwitchX + 130;
    const decayTime = this.synthUI.reverb.decay[currentSlot];
    const normalizedDecay = (decayTime - 0.1) / (10 - 0.1);
    _drawSlider(decayX - 60, row2Y, 60, 8, normalizedDecay, isHovering === 'decay', slotColor);

    fill(255);
    noStroke();
    textAlign(LEFT, CENTER);
    textSize(10);
    text(`${decayTime.toFixed(1)}s`, decayX + 5, row2Y);

    // Wet控制
    const wetLabelX = lp.reverbSwitchX + lp.reverbSwitchWidth - 95;
    const wetX = lp.reverbSwitchX + lp.reverbSwitchWidth - 30;
    const wetY = row2Y;

    fill(255);
    noStroke();
    textAlign(RIGHT, CENTER);
    textSize(12);
    text("Wet:", wetLabelX, wetY);

    const wetValue = this.synthUI.reverb.wet[currentSlot];
    _drawSlider(wetX - 60, wetY, 60, 8, wetValue, isHovering === 'wet', slotColor);

    fill(255);
    noStroke();
    textAlign(LEFT, CENTER);
    textSize(10);
    text(`${Math.round(wetValue * 100)}%`, wetX + 5, wetY);
  }

  pop();
}

// ======================== 通用绘制辅助 ========================

function _drawToggleSwitch(x, y, w, h, enabled, hovered, slotColor) {
  stroke(60);
  strokeWeight(1);
  fill(enabled ? color(red(slotColor), green(slotColor), blue(slotColor), 150) : color(60));
  rect(x, y - h / 2, w, h, h / 2);

  noStroke();
  if (enabled) {
    fill(hovered ?
      color(red(slotColor), green(slotColor), blue(slotColor), 255) :
      color(red(slotColor), green(slotColor), blue(slotColor), 220));
    ellipse(x + w - h / 2, y, h + 2, h + 2);
  } else {
    fill(hovered ? 255 : 200);
    ellipse(x + h / 2, y, h + 2, h + 2);
  }
}

function _drawPlusMinusButtons(minusX, plusX, y, btnSize, minusHover, plusHover, slotColor) {
  // 减号按钮
  fill(40);
  if (minusHover) {
    stroke(red(slotColor), green(slotColor), blue(slotColor), 180);
  } else {
    stroke(60);
  }
  strokeWeight(1);
  rect(minusX - btnSize / 2, y - btnSize / 2, btnSize, btnSize, 3);
  stroke(255);
  strokeWeight(2);
  line(minusX - btnSize / 3, y, minusX + btnSize / 3, y);

  // 加号按钮
  fill(40);
  if (plusHover) {
    stroke(red(slotColor), green(slotColor), blue(slotColor), 180);
  } else {
    stroke(60);
  }
  strokeWeight(1);
  rect(plusX - btnSize / 2, y - btnSize / 2, btnSize, btnSize, 3);
  stroke(255);
  strokeWeight(2);
  line(plusX - btnSize / 3, y, plusX + btnSize / 3, y);
  line(plusX, y - btnSize / 3, plusX, y + btnSize / 3);
}

function _drawSlider(x, y, width, height, value, hovered, slotColor) {
  fill(40, 180);
  stroke(60);
  strokeWeight(1);
  rect(x, y - height / 2, width, height, 4);

  noStroke();
  fill(red(slotColor), green(slotColor), blue(slotColor), 180);
  const fillWidth = width * value;
  rect(x, y - height / 2, fillWidth, height, 4);

  fill(red(slotColor), green(slotColor), blue(slotColor), 220);
  if (hovered) {
    stroke(255, 180);
    strokeWeight(1);
  } else {
    noStroke();
  }
  ellipse(x + fillWidth, y, 14, 14);
}
