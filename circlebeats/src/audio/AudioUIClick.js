/**
 * AudioUIClick.js - 合成器 UI 鼠标点击事件处理
 *
 * 包含 handleSynthMouseClicked 及其辅助处理函数。
 * 所有方法以 mixin 方式挂载到 AudioSequencer.prototype。
 */

import { getLayoutParams } from './AudioUIEvents.js';

// ======================== 鼠标点击事件 ========================

/**
 * 处理合成器 UI 鼠标点击事件。
 *
 * @param {number} mx - 鼠标X坐标
 * @param {number} my - 鼠标Y坐标
 * @returns {boolean} 是否消费了事件
 */
export function handleSynthMouseClicked(mx, my) {
  if (!this.synthUI.visible) return;

  // 返回按钮
  if (this.synthUI.synthButton.hovered) {
    this.synthUI.visible = false;
    window.rhythmVisible = true;
    window.dispatchEvent(new CustomEvent('synth-ui-visibility-change', { detail: { visible: false } }));
    return true;
  }

  // 插槽点击
  if (this.synthUI.hoveredSlot !== -1) {
    _handleSlotClick.call(this);
    return true;
  }

  // 波形选择
  if (this.synthUI.hoveredWaveform !== -1) {
    _handleWaveformClick.call(this);
    return true;
  }

  // 页面切换按钮
  const lp = getLayoutParams();
  const pageResult = _handlePageButtonClick.call(this, mx, my, lp);
  if (pageResult) return true;

  // 滑音开关
  if (this.synthUI.portamento.hovering) {
    return _handlePortamentoClick.call(this);
  }

  // Delay控制
  if (this.synthUI.delay.hovering) {
    return _handleDelayClick.call(this);
  }

  return false;
}

// ======================== 点击辅助函数 ========================

/**
 * 处理插槽点击，包括过渡动画初始化。
 */
function _handleSlotClick() {
  if (this.synthUI.hoveredSlot !== this.synthUI.currentSlot) {
    this.synthUI.previousSlot = this.synthUI.currentSlot;
    const isFilterPage = this.synthUI.envelopePage === 1;
    const oldSlot = this.synthUI.currentSlot;

    if (isFilterPage) {
      this.synthUI.transition.startParams = {
        attack: this.synthParams[oldSlot].filterAttack || 0.05,
        decay: this.synthParams[oldSlot].filterDecay || 0.3,
        sustain: this.synthParams[oldSlot].filterSustain || 0.5,
        release: this.synthParams[oldSlot].filterRelease || 0.5,
        volume: this.synthParams[oldSlot].volume
      };
    } else {
      this.synthUI.transition.startParams = {
        attack: this.synthParams[oldSlot].attack,
        decay: this.synthParams[oldSlot].decay,
        sustain: this.synthParams[oldSlot].sustain,
        release: this.synthParams[oldSlot].release,
        volume: this.synthParams[oldSlot].volume
      };
    }

    this.synthUI.currentSlot = this.synthUI.hoveredSlot;
    const newSlot = this.synthUI.currentSlot;

    if (isFilterPage) {
      this.synthUI.transition.endParams = {
        attack: this.synthParams[newSlot].filterAttack || 0.05,
        decay: this.synthParams[newSlot].filterDecay || 0.3,
        sustain: this.synthParams[newSlot].filterSustain || 0.5,
        release: this.synthParams[newSlot].filterRelease || 0.5,
        volume: this.synthParams[newSlot].volume
      };
    } else {
      this.synthUI.transition.endParams = {
        attack: this.synthParams[newSlot].attack,
        decay: this.synthParams[newSlot].decay,
        sustain: this.synthParams[newSlot].sustain,
        release: this.synthParams[newSlot].release,
        volume: this.synthParams[newSlot].volume
      };
    }

    this.synthUI.transition.currentParams = { ...this.synthUI.transition.startParams };
    this.synthUI.transition.active = true;
    this.synthUI.transition.startTime = Date.now();

    // 滤波器过渡
    this.synthUI.transition.filterStartParams = {
      filterFreq: this.synthParams[oldSlot].filterFreq,
      filterQ: this.synthParams[oldSlot].filterQ,
      filterType: this.synthParams[oldSlot].filterType
    };
    this.synthUI.transition.filterEndParams = {
      filterFreq: this.synthParams[newSlot].filterFreq,
      filterQ: this.synthParams[newSlot].filterQ,
      filterType: this.synthParams[newSlot].filterType
    };
    this.synthUI.transition.filterCurrentParams = { ...this.synthUI.transition.filterStartParams };
    this.synthUI.transition.filterActive = true;
    this.synthUI.transition.filterStartTime = Date.now();
  } else {
    this.synthUI.currentSlot = this.synthUI.hoveredSlot;
  }
}

/**
 * 处理波形选择点击。
 */
function _handleWaveformClick() {
  const newWaveform = this.synthUI.waveforms[this.synthUI.hoveredWaveform];
  const currentSlot = this.synthUI.currentSlot;
  this.synthUI.selectedWaveforms[currentSlot] = newWaveform;
  if (window.synthPresetManager) {
    window.synthPresetManager.setWaveform(currentSlot, newWaveform);
  }
  const synth = this.getOrCreateSynth(currentSlot);
  if (synth) { synth.oscillator.type = newWaveform; }
}

/**
 * 处理页面切换按钮点击。
 *
 * @param {number} mx - 鼠标X坐标
 * @param {number} my - 鼠标Y坐标
 * @param {Object} lp - 布局参数
 * @returns {boolean} 是否消费了事件
 */
function _handlePageButtonClick(mx, my, lp) {
  const pageButtonY = lp.envY - 25;
  const pageButtonWidth = 120, pageButtonHeight = 20, pageButtonSpacing = 10;
  const ampBtnX = ui.centerX - pageButtonWidth - pageButtonSpacing / 2;
  const filterBtnX = ui.centerX + pageButtonSpacing / 2;
  const currentSlot = this.synthUI.currentSlot;
  const p = this.synthParams[currentSlot];

  if (mx >= ampBtnX && mx <= ampBtnX + pageButtonWidth && my >= pageButtonY && my <= pageButtonY + pageButtonHeight) {
    if (this.synthUI.envelopePage !== 0) {
      this.synthUI.transition.startParams = { attack: p.filterAttack || 0.05, decay: p.filterDecay || 0.3, sustain: p.filterSustain || 0.5, release: p.filterRelease || 0.5, volume: p.volume };
      this.synthUI.transition.endParams = { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release, volume: p.volume };
      this.synthUI.transition.currentParams = { ...this.synthUI.transition.startParams };
      this.synthUI.transition.active = true;
      this.synthUI.transition.startTime = Date.now();
    }
    this.synthUI.envelopePage = 0;
    return true;
  }

  if (mx >= filterBtnX && mx <= filterBtnX + pageButtonWidth && my >= pageButtonY && my <= pageButtonY + pageButtonHeight) {
    if (this.synthUI.envelopePage !== 1) {
      this.synthUI.transition.startParams = { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release, volume: p.volume };
      this.synthUI.transition.endParams = { attack: p.filterAttack || 0.05, decay: p.filterDecay || 0.3, sustain: p.filterSustain || 0.5, release: p.filterRelease || 0.5, volume: p.volume };
      this.synthUI.transition.currentParams = { ...this.synthUI.transition.startParams };
      this.synthUI.transition.active = true;
      this.synthUI.transition.startTime = Date.now();
    }
    this.synthUI.envelopePage = 1;
    return true;
  }
  return false;
}

/**
 * 处理滑音开关点击。
 *
 * @returns {boolean} 是否消费了事件
 */
function _handlePortamentoClick() {
  const currentSlot = this.synthUI.currentSlot;
  if (this.synthUI.portamento.hovering === 'toggle') {
    this.synthUI.portamento.enabled[currentSlot] = !this.synthUI.portamento.enabled[currentSlot];
    const synth = this.getOrCreateSynth(currentSlot);
    if (synth) {
      synth.portamento = this.synthUI.portamento.enabled[currentSlot] ? this.synthParams[currentSlot].portamento : 0;
    }
    return true;
  } else if (this.synthUI.portamento.enabled[currentSlot]) {
    if (this.synthUI.portamento.hovering === 'minus') {
      let newValue = Math.max(0.01, this.synthParams[currentSlot].portamento - 0.01);
      this.synthParams[currentSlot].portamento = newValue;
      const synth = this.getOrCreateSynth(currentSlot);
      if (synth) synth.portamento = newValue;
      return true;
    } else if (this.synthUI.portamento.hovering === 'plus') {
      let newValue = Math.min(0.3, this.synthParams[currentSlot].portamento + 0.01);
      this.synthParams[currentSlot].portamento = newValue;
      const synth = this.getOrCreateSynth(currentSlot);
      if (synth) synth.portamento = newValue;
      return true;
    }
  }
  return false;
}

/**
 * 处理 Delay 控件点击。
 *
 * @returns {boolean} 是否消费了事件
 */
function _handleDelayClick() {
  const currentSlot = this.synthUI.currentSlot;
  if (this.synthUI.delay.hovering === 'toggle') {
    this.synthUI.delay.enabled[currentSlot] = !this.synthUI.delay.enabled[currentSlot];
    if (this.delayEffects && this.delayEffects[currentSlot]) {
      this.delayEffects[currentSlot].wet.value = this.synthUI.delay.enabled[currentSlot] ? 0.3 : 0;
    }
    if (window.synthPresetManager) {
      window.synthPresetManager.setDelayEnabled(currentSlot, this.synthUI.delay.enabled[currentSlot]);
    }
    return true;
  } else if (this.synthUI.delay.enabled[currentSlot]) {
    if (this.synthUI.delay.hovering === 'minus' || this.synthUI.delay.hovering === 'plus') {
      const currentBeats = this.synthUI.delay.values[currentSlot];
      const beatValues = [0.125, 0.25, 0.5, 1, 1.5, 2];
      const currentIdx = beatValues.indexOf(currentBeats);
      let newIdx;
      if (this.synthUI.delay.hovering === 'minus') {
        newIdx = Math.max(0, (currentIdx === -1 ? 0 : currentIdx) - 1);
      } else {
        newIdx = Math.min(beatValues.length - 1, (currentIdx === -1 ? 0 : currentIdx) + 1);
      }
      this.synthUI.delay.values[currentSlot] = beatValues[newIdx];
      const delayTimeInSeconds = this.calculateDelayTime(beatValues[newIdx]);
      if (this.delayEffects && this.delayEffects[currentSlot]) {
        this.delayEffects[currentSlot].delayTime.value = delayTimeInSeconds;
      }
      return true;
    }
  }
  return false;
}
