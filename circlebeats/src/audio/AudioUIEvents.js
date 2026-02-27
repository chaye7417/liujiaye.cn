/**
 * AudioUIEvents.js - 合成器 UI 鼠标悬停检测
 *
 * 包含 handleSynthMouseMoved 和各种 check*Hover 方法。
 * 所有方法以 mixin 方式挂载到 AudioSequencer.prototype。
 */

import { UI_LAYOUT } from './AudioConstants.js';
import { ptLine } from './AudioEffects.js';

/**
 * 计算 UI 通用布局参数（与绘制部分保持一致）。
 *
 * @returns {Object} 布局参数
 */
export function getLayoutParams() {
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
    buttonWidth, spacing, totalWidth, startX, waveformStartY,
    envX, envY, envW, envH,
    filterX, filterY, filterW, filterH,
    portSwitchX, portSwitchY, portSwitchWidth, portSwitchHeight,
    delaySwitchX, delaySwitchY, delaySwitchWidth, delaySwitchHeight,
    reverbSwitchX, reverbSwitchY, reverbSwitchWidth, reverbSwitchHeight
  };
}

/**
 * 计算 ADSR 节点坐标。
 *
 * @param {Object} lp - 布局参数
 * @param {Object} params - ADSR参数
 * @returns {Object} 节点坐标
 */
export function getEnvelopeNodes(lp, params) {
  const maxTimeWidth = UI_LAYOUT.maxTimeWidth;
  const y0 = lp.envY + lp.envH;
  const yMax = lp.envY + 10;
  const tA = params.attack;
  const tD = tA + params.decay;
  const tS = tD + 1;
  const tR = tS + params.release;

  return {
    y0, yMax, maxTimeWidth,
    ptA: { x: lp.envX + (tA / maxTimeWidth) * lp.envW, y: yMax },
    ptD: { x: lp.envX + (tD / maxTimeWidth) * lp.envW, y: yMax + (y0 - yMax) * (1 - params.sustain) },
    ptS: { x: lp.envX + (tS / maxTimeWidth) * lp.envW, y: yMax + (y0 - yMax) * (1 - params.sustain) },
    ptR: { x: lp.envX + (tR / maxTimeWidth) * lp.envW, y: y0 }
  };
}

/**
 * 获取当前包络参数。
 *
 * @param {Object} seq - AudioSequencer 实例
 * @returns {Object} 当前包络参数
 */
export function getCurrentEnvParams(seq) {
  const slot = seq.synthUI.currentSlot;
  const p = seq.synthParams[slot];
  if (seq.synthUI.envelopePage === 0) {
    return { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release };
  } else {
    return { attack: p.filterAttack, decay: p.filterDecay, sustain: p.filterSustain, release: p.filterRelease };
  }
}

// ======================== 鼠标移动事件 ========================

/**
 * 处理合成器 UI 鼠标移动事件。
 *
 * @param {number} mx - 鼠标X坐标
 * @param {number} my - 鼠标Y坐标
 */
export function handleSynthMouseMoved(mx, my) {
  if (!this.synthUI.visible) return;
  const lp = getLayoutParams();

  // 合成器返回按钮
  const synthBtnW = 100, synthBtnH = 30;
  const synthBtnX = ui.panelX + ui.panelWidth - synthBtnW - 20;
  const synthBtnY = ui.panelY + 20;
  this.synthUI.synthButton.hovered = (mx >= synthBtnX && mx <= synthBtnX + synthBtnW && my >= synthBtnY && my <= synthBtnY + synthBtnH);

  // 插槽悬停
  const startY = ui.centerY - ui.panelHeight / 2 + 70;
  this.synthUI.hoveredSlot = -1;
  for (let i = 0; i < 8; i++) {
    const x = lp.startX + i * (lp.buttonWidth + lp.spacing);
    if (mx >= x && mx <= x + lp.buttonWidth && my >= startY && my <= startY + 20) {
      this.synthUI.hoveredSlot = i;
      break;
    }
  }

  // 波形选择器悬停
  const wfSize = lp.totalWidth / 4 - lp.spacing;
  this.synthUI.hoveredWaveform = -1;
  this.synthUI.waveforms.forEach((_, i) => {
    const x = lp.startX + i * (wfSize + lp.spacing);
    if (mx >= x && mx <= x + wfSize && my >= lp.waveformStartY && my <= lp.waveformStartY + 25) {
      this.synthUI.hoveredWaveform = i;
    }
  });

  // 页面切换按钮
  this.synthUI.hoveredPageButton = -1;
  const pageButtonY = lp.envY - 25;
  const pageButtonWidth = 120, pageButtonHeight = 20, pageButtonSpacing = 10;
  const ampBtnX = ui.centerX - pageButtonWidth - pageButtonSpacing / 2;
  if (mx >= ampBtnX && mx <= ampBtnX + pageButtonWidth && my >= pageButtonY && my <= pageButtonY + pageButtonHeight) {
    this.synthUI.hoveredPageButton = 0;
  }
  const filterBtnX = ui.centerX + pageButtonSpacing / 2;
  if (mx >= filterBtnX && mx <= filterBtnX + pageButtonWidth && my >= pageButtonY && my <= pageButtonY + pageButtonHeight) {
    this.synthUI.hoveredPageButton = 1;
  }

  // ADSR 标签和包络线悬停
  _checkADSRHover.call(this, mx, my, lp);

  // 滤波器控制悬停
  this.checkFilterControlsHover(mx, my);
  this.checkPortamentoHover(mx, my);
  this.checkDelayHover(mx, my);
  this.checkReverbHover(mx, my);
}

/**
 * 检查 ADSR 区域悬停状态。
 */
function _checkADSRHover(mx, my, lp) {
  const labelY = lp.envY + lp.envH + 15;
  const labelHeight = 35;
  const labelWidth = lp.envW * 0.22;
  const labelX1 = lp.envX + lp.envW * 0.125;
  const labelX2 = lp.envX + lp.envW * 0.375;
  const labelX3 = lp.envX + lp.envW * 0.625;
  const labelX4 = lp.envX + lp.envW * 0.875;

  this.synthUI.hoveredADSRLabel = null;

  if (my >= labelY - 10 && my <= labelY + labelHeight) {
    const labels = [
      { x: labelX1, name: 'A' }, { x: labelX2, name: 'D' },
      { x: labelX3, name: 'S' }, { x: labelX4, name: 'R' }
    ];
    for (const l of labels) {
      if (mx >= l.x - labelWidth / 2 && mx <= l.x + labelWidth / 2) {
        this.synthUI.hoveredADSRLabel = l.name;
        this.synthUI.hoveredSegment = l.name;
        this.synthUI.hoveredEnvelope = true;
        return;
      }
    }
    this.synthUI.hoveredEnvelope = false;
  } else if (mx >= lp.envX && mx <= lp.envX + lp.envW && my >= lp.envY && my <= lp.envY + lp.envH) {
    const params = getCurrentEnvParams(this);
    const nodes = getEnvelopeNodes(lp, params);

    const nodeList = [
      { pt: nodes.ptA, name: 'A' }, { pt: nodes.ptD, name: 'D' },
      { pt: nodes.ptS, name: 'S' }, { pt: nodes.ptR, name: 'R' }
    ];
    let overNode = false;
    for (const n of nodeList) {
      if (dist(mx, my, n.pt.x, n.pt.y) <= 10) {
        this.synthUI.hoveredADSRLabel = n.name;
        this.synthUI.hoveredSegment = n.name;
        this.synthUI.hoveredEnvelope = true;
        overNode = true;
        break;
      }
    }

    if (!overNode) {
      this.synthUI.hoveredADSRLabel = null;
      const segments = [
        { from: { x: lp.envX, y: nodes.y0 }, to: nodes.ptA, name: 'A' },
        { from: nodes.ptA, to: nodes.ptD, name: 'D' },
        { from: nodes.ptD, to: nodes.ptS, name: 'S' },
        { from: nodes.ptS, to: nodes.ptR, name: 'R' }
      ];
      let found = false;
      for (const seg of segments) {
        if (ptLine(mx, my, seg.from.x, seg.from.y, seg.to.x, seg.to.y, 5)) {
          this.synthUI.hoveredSegment = seg.name;
          this.synthUI.hoveredEnvelope = true;
          found = true;
          break;
        }
      }
      if (!found) {
        this.synthUI.hoveredEnvelope = false;
        this.synthUI.hoveredSegment = null;
      }
    }
  } else {
    this.synthUI.hoveredEnvelope = false;
    this.synthUI.hoveredSegment = null;
  }
}

// ======================== 悬停检测方法 ========================

/**
 * 检查滤波器控件悬停状态。
 *
 * @param {number} mx - 鼠标X坐标
 * @param {number} my - 鼠标Y坐标
 */
export function checkFilterControlsHover(mx, my) {
  this.synthUI.filter.hoveredControl = null;
  this.synthUI.filter.hoveredType = -1;
  const lp = getLayoutParams();

  if (mx < lp.filterX - 10 || mx > lp.filterX + lp.filterW + 10 || my < lp.filterY - 10 || my > lp.filterY + lp.filterH + 10) return;

  const controlsWidth = lp.filterW * 0.25;

  if (mx >= lp.filterX && mx <= lp.filterX + controlsWidth) {
    const width = controlsWidth;
    const height = lp.filterH - 20;
    const y = lp.filterY + 10;
    const margin = 5;
    const usableHeight = height - margin * 3;
    const sectionHeight = usableHeight / 4;
    const controlX = lp.filterX + width / 2;
    const labelWidth = 70;

    const positions = [
      { y: y + sectionHeight * 0.5, name: "freq" },
      { y: y + sectionHeight * 1.5 + margin, name: "res" },
      { y: y + sectionHeight * 2.5 + margin * 2, name: "type" },
      { y: y + sectionHeight * 3.5 + margin * 3, name: "env" }
    ];

    for (const pos of positions) {
      const h = 32;
      if (mx >= controlX - labelWidth / 2 && mx <= controlX + labelWidth / 2 && my >= pos.y - h / 2 && my <= pos.y + h / 2) {
        this.synthUI.filter.hoveredControl = pos.name;
        if (pos.name === "type") this.synthUI.filter.hoveredType = 1;
        return;
      }
    }
  }

  // 曲线区域
  const curveWidth = lp.filterW * 0.75;
  const curveX = lp.filterX + controlsWidth + 5;
  if (mx >= curveX && mx <= curveX + curveWidth - 10 && my >= lp.filterY + 10 && my <= lp.filterY + lp.filterH - 10) {
    this.synthUI.filter.hoveredControl = "curve";
  }
}

/**
 * 检查滑音开关悬停状态。
 *
 * @param {number} mx - 鼠标X坐标
 * @param {number} my - 鼠标Y坐标
 * @returns {boolean} 是否在滑音区域内
 */
export function checkPortamentoHover(mx, my) {
  this.synthUI.portamento.hovering = false;
  const lp = getLayoutParams();
  const currentSlot = this.synthUI.currentSlot;

  if (mx >= lp.portSwitchX && mx <= lp.portSwitchX + lp.portSwitchWidth && my >= lp.portSwitchY && my <= lp.portSwitchY + lp.portSwitchHeight) {
    const toggleX = lp.portSwitchX + lp.portSwitchWidth - 40;
    const toggleY = lp.portSwitchY + lp.portSwitchHeight / 2;
    if (mx >= toggleX && mx <= toggleX + 30 && my >= toggleY - 8 && my <= toggleY + 8) {
      this.synthUI.portamento.hovering = 'toggle';
      return true;
    }
    if (this.synthUI.portamento.enabled[currentSlot]) {
      const valueX = lp.portSwitchX + lp.portSwitchWidth / 2 - 20;
      const btnSize = 16;
      const btnSpacing = 30;
      if (mx >= valueX - btnSpacing - btnSize / 2 && mx <= valueX - btnSpacing + btnSize / 2 && my >= toggleY - btnSize / 2 && my <= toggleY + btnSize / 2) {
        this.synthUI.portamento.hovering = 'minus';
        return true;
      }
      if (mx >= valueX + btnSpacing - btnSize / 2 && mx <= valueX + btnSpacing + btnSize / 2 && my >= toggleY - btnSize / 2 && my <= toggleY + btnSize / 2) {
        this.synthUI.portamento.hovering = 'plus';
        return true;
      }
    }
    this.synthUI.portamento.hovering = true;
    return true;
  }
  return false;
}

/**
 * 检查 Delay 控件悬停状态。
 *
 * @param {number} mx - 鼠标X坐标
 * @param {number} my - 鼠标Y坐标
 * @returns {boolean} 是否在 Delay 区域内
 */
export function checkDelayHover(mx, my) {
  this.synthUI.delay.hovering = false;
  const currentSlot = this.synthUI.currentSlot;
  const lp = getLayoutParams();

  if (mx >= lp.delaySwitchX && mx <= lp.delaySwitchX + lp.delaySwitchWidth && my >= lp.delaySwitchY && my <= lp.delaySwitchY + lp.delaySwitchHeight) {
    const row1Y = lp.delaySwitchY + 28;
    const toggleX = lp.delaySwitchX + 80;
    if (mx >= toggleX && mx <= toggleX + 30 && my >= row1Y - 13 && my <= row1Y + 13) {
      this.synthUI.delay.hovering = 'toggle';
      return true;
    }

    if (this.synthUI.delay.enabled[currentSlot]) {
      const row2Y = lp.delaySwitchY + 48;
      const valueX = lp.delaySwitchX + lp.delaySwitchWidth / 2 - 100;
      const btnSize = 20;
      const btnSpacing = 40;
      const minusX = valueX - btnSpacing / 2;
      const plusX = valueX + btnSpacing / 2;

      if (mx >= minusX - btnSize / 2 && mx <= minusX + btnSize / 2 && my >= row2Y - btnSize / 2 && my <= row2Y + btnSize / 2) {
        this.synthUI.delay.hovering = 'minus';
        return true;
      }
      if (mx >= plusX - btnSize / 2 && mx <= plusX + btnSize / 2 && my >= row2Y - btnSize / 2 && my <= row2Y + btnSize / 2) {
        this.synthUI.delay.hovering = 'plus';
        return true;
      }

      const fbLabelX = valueX + 120;
      const fbX = fbLabelX + 70;
      if (mx >= fbX - 80 && mx <= fbX + 20 && my >= row2Y - 10 && my <= row2Y + 10) {
        this.synthUI.delay.hovering = 'feedback';
        return true;
      }
    }
    this.synthUI.delay.hovering = true;
    return true;
  }
  return false;
}

/**
 * 检查 Reverb 控件悬停状态。
 *
 * @param {number} mx - 鼠标X坐标
 * @param {number} my - 鼠标Y坐标
 * @returns {boolean} 是否在 Reverb 区域内
 */
export function checkReverbHover(mx, my) {
  this.synthUI.reverb.hovering = false;
  const currentSlot = this.synthUI.currentSlot;
  const lp = getLayoutParams();

  if (mx >= lp.reverbSwitchX && mx <= lp.reverbSwitchX + lp.reverbSwitchWidth && my >= lp.reverbSwitchY && my <= lp.reverbSwitchY + lp.reverbSwitchHeight) {
    const row1Y = lp.reverbSwitchY + 28;
    const toggleX = lp.reverbSwitchX + 80;
    if (mx >= toggleX && mx <= toggleX + 30 && my >= row1Y - 13 && my <= row1Y + 13) {
      this.synthUI.reverb.hovering = 'toggle';
      return true;
    }

    if (this.synthUI.reverb.enabled[currentSlot]) {
      const row2Y = lp.reverbSwitchY + 48;
      const decayX = lp.reverbSwitchX + 130;
      if (mx >= decayX - 60 && mx <= decayX && my >= row2Y - 12 && my <= row2Y + 12) {
        this.synthUI.reverb.hovering = 'decay';
        return true;
      }
      const wetX = lp.reverbSwitchX + lp.reverbSwitchWidth - 30;
      if (mx >= wetX - 60 && mx <= wetX && my >= row2Y - 12 && my <= row2Y + 12) {
        this.synthUI.reverb.hovering = 'wet';
        return true;
      }
    }
    this.synthUI.reverb.hovering = true;
    return true;
  }
  return false;
}
