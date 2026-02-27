/**
 * SynthEngine.js - 合成器创建、参数管理、懒加载
 *
 * 负责 Tone.js 合成器实例的创建和管理，
 * 包括 MonoSynth 的懒加载创建、音频效果链的构建、
 * 参数初始化和同步等功能。
 */

import {
  DEFAULT_SYNTH_PARAMS,
  DEFAULT_VOLUME,
  MASTER_VOLUME,
  SLOT_COUNT,
  DEFAULT_BASE_NOTE,
  NOTE_TO_MIDI,
  DELAY_MAX_SECONDS,
  REVERB_PRE_DELAY
} from './AudioConstants.js';

/**
 * 初始化合成器参数数组。
 *
 * 从 SynthPresetManager 获取参数（如果存在），否则使用默认值。
 *
 * @param {Object} synthUI - 合成器UI状态对象
 * @returns {Array<Object>} 合成器参数数组
 */
export function initSynthParams(synthUI) {
  return Array(SLOT_COUNT).fill().map((_, index) => {
    if (window.synthPresetManager) {
      const envParams = window.synthPresetManager.presetEnvelopeParams[index] || {};
      const filterParams = window.synthPresetManager.presetFilterParams[index] || {};
      const delayParams = window.synthPresetManager.presetDelayParams[index] || {};
      const reverbParams = window.synthPresetManager.presetReverbParams[index] || {};
      const portamentoEnabled = window.synthPresetManager.presetPortamentoEnabled[index] || false;
      const portamentoTime = window.synthPresetManager.presetPortamentoTime[index] || 0.05;

      // 更新UI中的波形选择
      if (window.synthPresetManager.presetWaveforms && window.synthPresetManager.presetWaveforms[index]) {
        synthUI.selectedWaveforms[index] = window.synthPresetManager.presetWaveforms[index];
      }

      return {
        volume: DEFAULT_VOLUME,
        attack: envParams.attack || 0.005,
        decay: envParams.decay || 0.1,
        sustain: envParams.sustain || 0.3,
        release: envParams.release || 0.1,
        filterType: filterParams.type || 'lowpass',
        filterFreq: filterParams.frequency || 20000,
        filterQ: filterParams.Q || 1,
        filterAttack: envParams.filterAttack || 0.01,
        filterDecay: envParams.filterDecay || 0.1,
        filterSustain: envParams.filterSustain || 1.0,
        filterRelease: envParams.filterRelease || 0.1,
        filterEnvAmount: filterParams.envAmount || 2,
        portamento: portamentoTime,
        delayEnabled: window.synthPresetManager.presetDelayEnabled[index] || false,
        delayTime: delayParams.time || 0.5,
        delayFeedback: delayParams.feedback || 0.3,
        delayWet: delayParams.mix || 0.3,
        reverbEnabled: window.synthPresetManager.presetReverbEnabled[index] || false,
        reverbDecay: reverbParams.decay || 1.5,
        reverbWet: reverbParams.mix || 0.3
      };
    } else {
      return { ...DEFAULT_SYNTH_PARAMS };
    }
  });
}

/**
 * 初始化音效系统。
 *
 * 创建主音量控制，设置 Transport BPM，
 * 同步 SynthPresetManager 的效果启用状态。
 *
 * @param {Object} sequencer - AudioSequencer 实例
 */
export function initSound(sequencer) {
  try {
    if (typeof Tone === 'undefined') {
      console.warn("Tone.js未加载，稍后将重试");
      setTimeout(() => initSound(sequencer), 1000);
      return;
    }

    // 尝试预先启动音频上下文
    if (Tone.context.state !== 'running') {
      const unlockAudio = () => {
        Tone.start();
        document.body.removeEventListener('click', unlockAudio);
      };
      document.body.addEventListener('click', unlockAudio, { once: true });
    }

    // 设置全局Transport的BPM
    Tone.Transport.bpm.value = sequencer.bpm;

    // 创建主音量控制
    sequencer.masterVolume = new Tone.Volume(MASTER_VOLUME).toDestination();

    // 懒加载：首次使用时才创建
    sequencer.presetSounds = Array(SLOT_COUNT).fill(null);
    sequencer.delayEffects = Array(SLOT_COUNT).fill(null);
    sequencer.reverbEffects = Array(SLOT_COUNT).fill(null);

    // 同步SynthPresetManager的效果启用状态
    if (window.synthPresetManager) {
      for (let i = 0; i < SLOT_COUNT; i++) {
        if (!sequencer.synthUI.delay) {
          sequencer.synthUI.delay = { enabled: Array(SLOT_COUNT).fill(false) };
        }
        if (!sequencer.synthUI.reverb) {
          sequencer.synthUI.reverb = { enabled: Array(SLOT_COUNT).fill(false) };
        }
        sequencer.synthUI.delay.enabled[i] = window.synthPresetManager.presetDelayEnabled[i];
        sequencer.synthUI.reverb.enabled[i] = window.synthPresetManager.presetReverbEnabled[i];
      }
    }

    sequencer.audioInitialized = true;

    // 设置Transport循环
    sequencer.setupTransportLoop();

    // 播放测试音符
    playTestSound(sequencer);

  } catch (e) {
    console.error("初始化Tone.js音频时出错:", e);
    createDummySounds(sequencer);
  }
}

/**
 * 懒加载合成器：首次访问时创建 MonoSynth 及其效果链。
 *
 * @param {Object} sequencer - AudioSequencer 实例
 * @param {number} slotIndex - 插槽索引
 * @returns {Object|null} Tone.MonoSynth 实例或 null
 */
export function getOrCreateSynth(sequencer, slotIndex) {
  // 如果合成器已存在，直接返回
  if (sequencer.presetSounds[slotIndex]) {
    return sequencer.presetSounds[slotIndex];
  }

  // 确保Tone.js和主音量可用
  if (typeof Tone === 'undefined' || !sequencer.masterVolume) {
    return null;
  }

  const i = slotIndex;

  // 获取参数 - 优先从SynthPresetManager获取
  let waveform, envParams, filterParams, delayParams, reverbParams;
  let portamentoEnabled, portamentoTime;

  if (window.synthPresetManager) {
    waveform = window.synthPresetManager.presetWaveforms[i];
    envParams = window.synthPresetManager.presetEnvelopeParams[i];
    filterParams = window.synthPresetManager.presetFilterParams[i];
    delayParams = window.synthPresetManager.presetDelayParams[i];
    reverbParams = window.synthPresetManager.presetReverbParams[i];
    portamentoEnabled = window.synthPresetManager.presetPortamentoEnabled[i];
    portamentoTime = window.synthPresetManager.presetPortamentoTime[i];
  } else {
    const params = sequencer.synthParams[i];
    waveform = sequencer.synthUI.selectedWaveforms[i];
    envParams = {
      attack: params.attack,
      decay: params.decay,
      sustain: params.sustain,
      release: params.release
    };
    filterParams = {
      type: params.filterType,
      frequency: params.filterFreq,
      Q: params.filterQ
    };
    delayParams = {
      time: params.delayTime,
      feedback: params.delayFeedback,
      mix: params.delayWet
    };
    reverbParams = {
      decay: params.reverbDecay,
      mix: params.reverbWet
    };
    portamentoEnabled = sequencer.synthUI.portamento.enabled[i];
    portamentoTime = params.portamento;
  }

  // 创建PingPongDelay效果
  const delay = new Tone.PingPongDelay({
    delayTime: calculateDelayTime(sequencer.bpm, delayParams.time),
    feedback: delayParams.feedback,
    wet: sequencer.synthUI.delay.enabled[i] ? delayParams.mix : 0,
    maxDelay: DELAY_MAX_SECONDS
  });
  sequencer.delayEffects[i] = delay;

  // 创建Reverb效果
  const reverb = new Tone.Reverb({
    decay: reverbParams.decay,
    wet: sequencer.synthUI.reverb.enabled[i] ? reverbParams.mix : 0,
    preDelay: REVERB_PRE_DELAY
  });
  reverb.generate();
  sequencer.reverbEffects[i] = reverb;

  // 创建MonoSynth
  const synth = new Tone.MonoSynth({
    oscillator: { type: waveform },
    envelope: {
      attack: envParams.attack,
      decay: envParams.decay,
      sustain: envParams.sustain,
      release: envParams.release
    },
    filter: {
      type: filterParams.type,
      frequency: filterParams.frequency,
      Q: filterParams.Q
    },
    filterEnvelope: {
      attack: envParams.filterAttack || 0.01,
      decay: envParams.filterDecay || 0.1,
      sustain: envParams.filterSustain || 1.0,
      release: envParams.filterRelease || 0.1,
      baseFrequency: filterParams.frequency,
      octaves: filterParams.envAmount || 2,
      exponent: 2
    },
    portamento: portamentoEnabled ? portamentoTime : 0,
    volume: DEFAULT_VOLUME
  }).connect(delay);

  // 设置连接链: synth -> delay -> reverb -> master
  delay.connect(reverb);
  reverb.connect(sequencer.masterVolume);

  sequencer.presetSounds[i] = synth;
  return synth;
}

/**
 * 计算与BPM同步的delay时间（以秒为单位）。
 *
 * @param {number} bpm - 当前BPM
 * @param {number} beats - 拍数
 * @returns {number} 延迟时间（秒）
 */
export function calculateDelayTime(bpm, beats) {
  return 60 / bpm * beats;
}

/**
 * 更新所有delay效果的时间，用于BPM变化时调用。
 *
 * @param {Object} sequencer - AudioSequencer 实例
 */
export function updateDelayTimes(sequencer) {
  if (!sequencer.delayEffects || !sequencer.audioInitialized) return;

  for (let i = 0; i < sequencer.delayEffects.length; i++) {
    const delay = sequencer.delayEffects[i];
    const beats = sequencer.synthUI.delay.values[i];

    if (delay && typeof delay.delayTime !== 'undefined') {
      const delayTimeInSeconds = calculateDelayTime(sequencer.bpm, beats);
      delay.delayTime.value = delayTimeInSeconds;
    }
  }
}

/**
 * 更新混响参数。
 *
 * @param {Object} sequencer - AudioSequencer 实例
 */
export function updateReverbEffects(sequencer) {
  if (!sequencer.audioInitialized || !sequencer.reverbEffects) return;

  for (let i = 0; i < SLOT_COUNT; i++) {
    const reverb = sequencer.reverbEffects[i];
    if (!reverb) continue;

    const params = sequencer.synthParams[i];
    const isEnabled = sequencer.synthUI.reverb.enabled[i];

    if (params.reverbDecay !== reverb.decay) {
      reverb.decay = params.reverbDecay;
      reverb.generate();
    }
    reverb.wet.value = isEnabled ? params.reverbWet : 0;
  }
}

/**
 * 创建哑声音对象，用于错误处理。
 *
 * @param {Object} sequencer - AudioSequencer 实例
 */
export function createDummySounds(sequencer) {
  sequencer.presetSounds = [];

  for (let i = 0; i < SLOT_COUNT; i++) {
    const dummySynth = {
      triggerAttackRelease: function () {},
      dispose: function () {}
    };
    sequencer.presetSounds.push(dummySynth);
  }

  sequencer.audioInitialized = true;
}

/**
 * 播放测试音符确认音频工作。
 *
 * @param {Object} sequencer - AudioSequencer 实例
 */
export function playTestSound(sequencer) {
  if (typeof Tone === 'undefined' || Tone.context.state !== 'running') {
    return;
  }

  try {
    if (sequencer.presetSounds && sequencer.presetSounds.length > 0) {
      for (let i = 0; i < Math.min(sequencer.presetSounds.length, 2); i++) {
        setTimeout(() => {
          const note = i === 0 ? "C4" : "E4";
          try {
            const synth = sequencer.getOrCreateSynth(i);
            if (synth) {
              synth.triggerAttackRelease(note, 0.2, Tone.now() + i * 0.1);
            }
          } catch (innerErr) {
            console.warn(`播放测试音符 ${note} 失败:`, innerErr);
          }
        }, 100 + i * 100);
      }
    } else {
      console.warn("找不到预设声音对象");
      try {
        const tempSynth = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.1 }
        }).toDestination();

        tempSynth.triggerAttackRelease("C4", 0.2, Tone.now());
        setTimeout(() => { tempSynth.dispose(); }, 1000);
      } catch (synthErr) {
        console.error("创建临时合成器失败:", synthErr);
      }
    }
  } catch (e) {
    console.warn("播放测试音符失败:", e);
  }
}

// ======================== 音符工具函数 ========================

/**
 * 音名转换为 MIDI 音符号。
 *
 * @param {string} noteName - 音名（如 'C4', 'A4', 'G#2'）
 * @returns {number} MIDI 音符号
 */
export function noteNameToMidi(noteName) {
  if (!noteName || typeof noteName !== 'string') return 60;
  const match = noteName.match(/([A-G][#b]?)(\d+)/);
  if (!match) return 60;

  const note = match[1];
  const octave = parseInt(match[2]);
  const noteNumber = NOTE_TO_MIDI[note];
  if (noteNumber === undefined) return 60;

  return noteNumber + (octave + 1) * 12;
}

/**
 * MIDI 音符号转换为频率。
 *
 * @param {number} midiNote - MIDI 音符号
 * @returns {number} 频率（Hz）
 */
export function midiToFrequency(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * 音名直接转换为频率。
 *
 * @param {string} noteName - 音名
 * @returns {number} 频率（Hz）
 */
export function noteNameToFrequency(noteName) {
  const midi = noteNameToMidi(noteName);
  return midiToFrequency(midi);
}
