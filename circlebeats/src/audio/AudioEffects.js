/**
 * AudioEffects.js - 滤波器响应计算和效果辅助函数
 *
 * 提供滤波器响应曲线的数学计算，
 * 以及各种音频效果相关的辅助方法。
 */

import { FILTER_FREQ_MIN, FILTER_FREQ_MAX } from './AudioConstants.js';

// ======================== 滤波器响应计算 ========================

/**
 * 计算滤波器响应值。
 *
 * @param {number} freq - 输入频率（Hz）
 * @param {number} cutoff - 截止频率（Hz）
 * @param {number} Q - 共振值
 * @param {string} type - 滤波器类型
 * @returns {number} 响应值（0-2）
 */
export function calculateFilterResponse(freq, cutoff, Q, type) {
  const w = freq / cutoff;

  switch (type) {
    case 'lowpass': {
      const logW = Math.log10(w);
      let response = 1.0;

      if (w > 1.0) {
        response = 1.0 / Math.pow(w, 4);
      }

      if (Q > 0.5) {
        const proximity = Math.exp(-80 * Math.pow(logW, 2));
        const normQ = Math.min(4, (Q - 0.5) / 5);
        const resonanceGain = normQ * 2;
        response += proximity * resonanceGain;
      }

      return Math.min(2.0, Math.max(0, response));
    }

    case 'highpass': {
      const logW = Math.log10(w);
      let response = 0;

      if (w < 1.0) {
        response = Math.pow(w, 4);
      } else {
        response = 1.0;
      }

      if (Q > 0.5) {
        const proximity = Math.exp(-80 * Math.pow(logW, 2));
        const normQ = Math.min(4, (Q - 0.5) / 5);
        const resonanceGain = normQ * 2;
        response += proximity * resonanceGain;
      }

      return Math.min(2.0, Math.max(0, response));
    }

    case 'bandpass': {
      const bw = 1.0 / Math.max(0.1, Q);
      const response = Math.exp(-Math.pow(Math.log(w) / (bw / 2), 2) / 2);
      return response;
    }

    case 'notch': {
      const bw = 1.0 / Math.max(0.1, Q);
      const bandpassResponse = Math.exp(-Math.pow(Math.log(w) / (bw / 2), 2) / 2);
      return 1.0 - bandpassResponse;
    }

    case 'allpass':
      return 1;

    default:
      return 1;
  }
}

// ======================== 格式化辅助函数 ========================

/**
 * 频率转字符串。
 *
 * @param {number} freq - 频率（Hz）
 * @returns {string} 格式化的频率字符串
 */
export function freqToString(freq) {
  if (freq >= 1000) {
    return `${(freq / 1000).toFixed(1)} kHz`;
  } else {
    return `${Math.round(freq)} Hz`;
  }
}

/**
 * 格式化滤波器类型。
 *
 * @param {string} type - 滤波器类型
 * @returns {string} 格式化后的名称
 */
export function formatFilterType(type) {
  switch (type) {
    case 'lowpass': return 'Low Pass';
    case 'highpass': return 'High Pass';
    case 'bandpass': return 'Band Pass';
    case 'notch': return 'Notch';
    case 'allpass': return 'All Pass';
    default: return type;
  }
}

/**
 * 格式化时间值。
 *
 * @param {number} v - 时间（秒）
 * @returns {string} 格式化的时间字符串
 */
export function formatTime(v) {
  if (v < 0.01) return Math.round(v * 1000) + 'ms';
  if (v < 1) return (v * 1000).toFixed(0) + ' ms';
  return v.toFixed(2) + ' s';
}

/**
 * 格式化百分比值。
 *
 * @param {number} v - 0-1范围的值
 * @returns {string} 百分比字符串
 */
export function formatPercent(v) {
  return Math.round(v * 100) + '%';
}

/**
 * 格式化dB值。
 *
 * @param {number} v - 0-1范围的值
 * @returns {string} dB字符串
 */
export function formatDB(v) {
  if (v <= 0.001) return '-∞ dB';
  const db = 20 * Math.log10(v);
  if (db < -40) return '-40 dB';
  return db.toFixed(1) + ' dB';
}

// ======================== 数学辅助函数 ========================

/**
 * 线性插值。
 *
 * @param {number} a - 起始值
 * @param {number} b - 目标值
 * @param {number} t - 插值因子（0-1）
 * @returns {number} 插值结果
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * 缓入缓出三次方曲线。
 *
 * @param {number} t - 进度（0-1）
 * @returns {number} 缓动后的进度
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 对数缩放。
 *
 * @param {number} value - 输入值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 对数缩放后的值（0-1）
 */
export function logScale(value, min, max) {
  if (min <= 0) min = 0.001;
  return (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
}

/**
 * 对数归一化（与 logScale 相同）。
 *
 * @param {number} value - 输入值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 归一化后的值（0-1）
 */
export function logNormalize(value, min, max) {
  return logScale(value, min, max);
}

/**
 * 检查点到线段的距离是否小于阈值。
 *
 * @param {number} px - 点的X坐标
 * @param {number} py - 点的Y坐标
 * @param {number} x1 - 线段起点X
 * @param {number} y1 - 线段起点Y
 * @param {number} x2 - 线段终点X
 * @param {number} y2 - 线段终点Y
 * @param {number} threshold - 距离阈值
 * @returns {boolean} 是否在阈值内
 */
export function ptLine(px, py, x1, y1, x2, y2, threshold) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return dist(px, py, x1, y1) < threshold;

  const t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;

  if (t < 0) return dist(px, py, x1, y1) < threshold;
  if (t > 1) return dist(px, py, x2, y2) < threshold;

  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return dist(px, py, projX, projY) < threshold;
}

/**
 * 将频率位置转换为归一化的对数坐标。
 *
 * @param {number} freq - 频率（Hz）
 * @returns {number} 归一化位置（0-1）
 */
export function freqToNormX(freq) {
  return (Math.log10(freq) - Math.log10(FILTER_FREQ_MIN)) /
    (Math.log10(FILTER_FREQ_MAX) - Math.log10(FILTER_FREQ_MIN));
}

/**
 * 将归一化对数坐标转换为频率。
 *
 * @param {number} normX - 归一化位置（0-1）
 * @returns {number} 频率（Hz）
 */
export function normXToFreq(normX) {
  return Math.pow(10,
    Math.log10(FILTER_FREQ_MIN) +
    normX * (Math.log10(FILTER_FREQ_MAX) - Math.log10(FILTER_FREQ_MIN))
  );
}
