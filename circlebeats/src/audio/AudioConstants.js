/**
 * AudioConstants.js - 音频系统常量、预设参数和默认配置
 *
 * 包含所有与音频序列器相关的常量定义，
 * 如默认ADSR值、滤波器参数、键盘映射等。
 */

// ======================== 默认值 ========================

/** 默认 BPM */
export const DEFAULT_BPM = 120;

/** 默认拍号 */
export const DEFAULT_BEATS_PER_MEASURE = 4;
export const DEFAULT_BEAT_FRACTION = 4;

/** 默认分辨率（十六分音符） */
export const DEFAULT_RESOLUTION = '16n';
export const DEFAULT_SUBDIVISION = 16;

/** 默认音量（dB） */
export const DEFAULT_VOLUME = -10;

/** 主音量（dB） */
export const MASTER_VOLUME = -6;

/** BPM 范围 */
export const BPM_MIN = 30;
export const BPM_MAX = 300;

/** 预设插槽数量 */
export const SLOT_COUNT = 8;

/** 默认基础音高 */
export const DEFAULT_BASE_NOTE = 'C4';

// ======================== ADSR 参数范围 ========================

export const ADSR_RANGES = {
  attack: { min: 0.001, max: 2.0 },
  decay: { min: 0.01, max: 2.0 },
  sustain: { min: 0, max: 1 },
  release: { min: 0.01, max: 2.0 }
};

// ======================== 默认合成器参数 ========================

export const DEFAULT_SYNTH_PARAMS = {
  // 放大器包络参数
  volume: DEFAULT_VOLUME,
  attack: 0.005,
  decay: 0.1,
  sustain: 0.3,
  release: 0.1,
  // 滤波器参数
  filterType: 'lowpass',
  filterFreq: 20000,
  filterQ: 1,
  // 滤波器包络参数
  filterAttack: 0.01,
  filterDecay: 0.1,
  filterSustain: 1.0,
  filterRelease: 0.1,
  filterEnvAmount: 2,
  // 滑音参数
  portamento: 0.05,
  // delay参数
  delayEnabled: false,
  delayTime: 0.5,
  delayFeedback: 0.3,
  delayWet: 0.3,
  // reverb参数
  reverbEnabled: false,
  reverbDecay: 1.5,
  reverbWet: 0.3
};

// ======================== 波形类型 ========================

export const WAVEFORMS = ['sine', 'triangle', 'sawtooth', 'square'];

export const WAVEFORM_NAMES = {
  'sine': 'Sine',
  'triangle': 'Triangle',
  'sawtooth': 'Sawtooth',
  'square': 'Square'
};

// ======================== 滤波器类型 ========================

export const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass', 'notch'];

export const FILTER_TYPE_NAMES = {
  'lowpass': 'Low Pass',
  'highpass': 'High Pass',
  'bandpass': 'Band Pass',
  'notch': 'Notch',
  'allpass': 'All Pass'
};

// ======================== 滤波器参数范围 ========================

export const FILTER_FREQ_MIN = 20;
export const FILTER_FREQ_MAX = 20000;
export const FILTER_Q_MIN = 0.1;
export const FILTER_Q_MAX = 20;
export const FILTER_CURVE_RESOLUTION = 100;

/** 滤波器包络深度预设值 */
export const FILTER_ENV_AMOUNTS = [0, 1, 2, 4, 6];

// ======================== Delay 参数 ========================

/** Delay 时值选项（以拍为单位） */
export const DELAY_BEAT_VALUES = [0.125, 0.25, 0.5, 1, 1.5, 2];

/** Delay 时值显示标签 */
export const DELAY_BEAT_LABELS = {
  0.125: '1/8',
  0.25: '1/4',
  0.5: '1/2',
  1: '1',
  1.5: '1 1/2',
  2: '2'
};

/** Delay 反馈最大值 */
export const DELAY_FEEDBACK_MAX = 0.9;

/** Delay 最大延迟时间（秒） */
export const DELAY_MAX_SECONDS = 2;

// ======================== Reverb 参数 ========================

export const REVERB_DECAY_MIN = 0.1;
export const REVERB_DECAY_MAX = 10;
export const REVERB_PRE_DELAY = 0.01;

// ======================== 滑音参数范围 ========================

export const PORTAMENTO_MIN = 0.01;
export const PORTAMENTO_MAX = 0.3;
export const PORTAMENTO_STEP = 0.01;

// ======================== 键盘映射 ========================

export const KEYBOARD_MAP = {
  // 白键映射 (A-S-D-F-G-H-J-K-L-;-')
  'a': 'C4',
  's': 'D4',
  'd': 'E4',
  'f': 'F4',
  'g': 'G4',
  'h': 'A4',
  'j': 'B4',
  'k': 'C5',
  'l': 'D5',
  ';': 'E5',
  "'": 'F5',
  // 黑键映射 (W-E-T-Y-U)
  'w': 'C#4',
  'e': 'D#4',
  't': 'F#4',
  'y': 'G#4',
  'u': 'A#4'
};

/** 八度偏移范围 */
export const OCTAVE_OFFSET_MIN = -2;
export const OCTAVE_OFFSET_MAX = 2;

// ======================== 音名到 MIDI 映射 ========================

export const NOTE_TO_MIDI = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

// ======================== UI 布局常量 ========================

export const UI_LAYOUT = {
  /** 包络编辑器最大时间轴（秒） */
  maxTimeWidth: 7,
  /** 包络编辑器高度 */
  envelopeHeight: 90,
  /** 波形选择器高度 */
  waveformHeight: 25,
  /** 插槽按钮宽度 */
  slotButtonWidth: 30,
  /** 按钮间距 */
  buttonSpacing: 5,
  /** 波形到包络的间距 */
  waveToEnvGap: 45,
  /** 滤波器 UI 高度 */
  filterHeight: 120,
  /** 开关控件高度 */
  switchHeight: 30,
  /** 效果控件高度 */
  effectHeight: 60,
  /** 过渡动画持续时间（毫秒） */
  transitionDuration: 300
};

// ======================== 默认预设插槽颜色 ========================

export const DEFAULT_SLOT_COLORS = [
  '#FF5252', '#FF9800', '#FFEB3B', '#4CAF50',
  '#2196F3', '#673AB7', '#E91E63', '#00BCD4'
];

// ======================== 辅助函数 ========================

/**
 * 创建指定数量的默认数组。
 *
 * @param {number} count - 数组长度
 * @param {*} value - 默认值
 * @returns {Array} 填充了默认值的数组
 */
export function createSlotArray(count, value) {
  return Array(count).fill(value);
}

/**
 * 获取Delay时值的显示标签。
 *
 * @param {number} beats - 拍数值
 * @returns {string} 显示标签
 */
export function getDelayBeatLabel(beats) {
  return DELAY_BEAT_LABELS[beats] || beats.toString();
}

/**
 * 获取下一个更小的 delay 时值。
 *
 * @param {number} currentBeats - 当前拍数
 * @returns {number} 更小的拍数值
 */
export function getPrevDelayBeat(currentBeats) {
  for (let i = DELAY_BEAT_VALUES.length - 1; i >= 0; i--) {
    if (DELAY_BEAT_VALUES[i] < currentBeats) {
      return DELAY_BEAT_VALUES[i];
    }
  }
  return DELAY_BEAT_VALUES[0];
}

/**
 * 获取下一个更大的 delay 时值。
 *
 * @param {number} currentBeats - 当前拍数
 * @returns {number} 更大的拍数值
 */
export function getNextDelayBeat(currentBeats) {
  for (let i = 0; i < DELAY_BEAT_VALUES.length; i++) {
    if (DELAY_BEAT_VALUES[i] > currentBeats) {
      return DELAY_BEAT_VALUES[i];
    }
  }
  return DELAY_BEAT_VALUES[DELAY_BEAT_VALUES.length - 1];
}
