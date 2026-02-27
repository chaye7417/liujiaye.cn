/**
 * AudioSequencer.js - 核心音频序列器类
 *
 * 包含 AudioSequencer 类的构造函数和播放/调度相关方法。
 * UI 绘制、鼠标事件、键盘事件等方法通过 index.js 以 prototype 混入方式挂载。
 */

import {
  DEFAULT_BPM,
  DEFAULT_BEATS_PER_MEASURE,
  DEFAULT_BEAT_FRACTION,
  DEFAULT_RESOLUTION,
  DEFAULT_SUBDIVISION,
  DEFAULT_BASE_NOTE,
  DEFAULT_SLOT_COLORS,
  SLOT_COUNT,
  BPM_MIN,
  BPM_MAX,
  WAVEFORMS,
  FILTER_TYPES,
  FILTER_FREQ_MIN,
  FILTER_FREQ_MAX,
  FILTER_CURVE_RESOLUTION,
  KEYBOARD_MAP,
  NOTE_TO_MIDI,
  UI_LAYOUT
} from './AudioConstants.js';

import {
  initSynthParams,
  initSound,
  getOrCreateSynth,
  createDummySounds,
  playTestSound,
  calculateDelayTime,
  updateDelayTimes,
  updateReverbEffects,
  noteNameToMidi,
  midiToFrequency,
  noteNameToFrequency
} from './SynthEngine.js';

/**
 * 音频序列器核心类。
 *
 * 管理音频播放、节拍调度、Transport 循环控制，
 * 以及与 Three.js 场景的同步。
 */
class AudioSequencer {
  constructor(bpm, beatsPerMeasure, beatFraction) {
    this.bpm = DEFAULT_BPM;
    this.beatsPerMeasure = DEFAULT_BEATS_PER_MEASURE;
    this.beatFraction = DEFAULT_BEAT_FRACTION;
    this.currentBeat = 0;
    this.isPlaying = false;
    this.resolution = DEFAULT_RESOLUTION;
    this.subdivision = DEFAULT_SUBDIVISION;

    // 添加标志位，表示音频系统是否已初始化
    this.audioInitialized = false;

    // 添加基础音高设置数组，为每个预设存储基础音高
    this.baseNotes = Array(SLOT_COUNT).fill(DEFAULT_BASE_NOTE);

    // 添加合成器UI相关属性
    this.synthUI = {
      visible: false,
      currentSlot: 0,
      previousSlot: 0,
      waveforms: WAVEFORMS.slice(),
      selectedWaveforms: ['sine', 'triangle', 'sawtooth', 'square', 'sine', 'triangle', 'sawtooth', 'square'],
      hoveredWaveform: -1,
      hoveredSlot: -1,
      hoveredADSRLabel: null,
      hoveredSegment: null,
      synthButton: {
        hovered: false
      },
      slotColors: window.presetSlotColors || DEFAULT_SLOT_COLORS.slice(),
      adsrDrag: {
        dragging: false,
        node: null,
      },
      // 过渡动画相关属性
      transition: {
        active: false,
        startTime: 0,
        duration: UI_LAYOUT.transitionDuration,
        startSlot: 0,
        endSlot: 0,
        startParams: null,
        endParams: null,
        currentParams: null,

        // 滤波器过渡相关属性
        filterActive: false,
        filterStartTime: 0,
        filterStartParams: null,
        filterEndParams: null,
        filterCurrentParams: null
      },
      // 包络页面切换
      envelopePage: 0,
      hoveredPageButton: -1,

      // 滤波器UI控制相关属性
      filter: {
        hoveredControl: null,
        dragging: {
          active: false,
          control: null,
          startValue: 0,
          startY: 0,
          startX: 0,
          startQValue: 1.0
        },
        types: FILTER_TYPES.slice(),
        selectedType: Array(SLOT_COUNT).fill('lowpass'),
        hoveredType: -1,
        displayMode: 0,
        freqRangeMin: FILTER_FREQ_MIN,
        freqRangeMax: FILTER_FREQ_MAX,
        curveResolution: FILTER_CURVE_RESOLUTION,
        curveValues: null
      },

      // 滑音开关相关属性
      portamento: {
        enabled: Array(SLOT_COUNT).fill(false),
        hovering: false,
        values: Array(SLOT_COUNT).fill(0)
      },

      // delay效果相关属性
      delay: {
        enabled: Array(SLOT_COUNT).fill(false),
        hovering: false,
        values: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        feedback: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]
      },

      // reverb效果相关属性
      reverb: {
        enabled: Array(SLOT_COUNT).fill(false),
        hovering: false,
        decay: [1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
        wet: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
        dragStart: null
      },
    };

    // 添加Transport事件ID，用于移除事件
    this.transportEventId = null;

    // 音名到MIDI音符号的映射
    this.noteToMidi = NOTE_TO_MIDI;

    // 键盘按键映射
    this.keyboardMap = KEYBOARD_MAP;

    // 跟踪当前正在按下的键，避免重复触发
    this.keysPressed = {};

    // 八度偏移量，用于Z/X键调整八度
    this.octaveOffset = 0;

    // 跟踪键盘演奏状态
    this.keyboardPlayState = {
      isPlaying: false,
      lastPlayedNote: null,
      activeKeys: []
    };

    // 初始化合成器参数 - 从SynthPresetManager获取参数或使用默认值
    this.synthParams = initSynthParams(this.synthUI);

    // 初始化测试音效 - 延迟初始化避免影响UI渲染
    setTimeout(() => {
      this.initSound();
    }, 500);

    // 设置合成器UI的事件监听
    this.setupSynthUIEvents();

    // 设置键盘事件监听
    this.setupKeyboardEvents();
  }

  // ======================== 委托到 SynthEngine 的方法 ========================

  /**
   * 初始化音效系统（委托到 SynthEngine.initSound）。
   */
  initSound() {
    initSound(this);
  }

  /**
   * 懒加载合成器（委托到 SynthEngine.getOrCreateSynth）。
   *
   * @param {number} slotIndex - 插槽索引
   * @returns {Object|null} Tone.MonoSynth 实例或 null
   */
  getOrCreateSynth(slotIndex) {
    return getOrCreateSynth(this, slotIndex);
  }

  /**
   * 创建哑声音对象（委托到 SynthEngine.createDummySounds）。
   */
  createDummySounds() {
    createDummySounds(this);
  }

  /**
   * 播放测试音符（委托到 SynthEngine.playTestSound）。
   */
  playTestSound() {
    playTestSound(this);
  }

  /**
   * 计算与BPM同步的delay时间（委托到 SynthEngine.calculateDelayTime）。
   *
   * @param {number} beats - 拍数
   * @returns {number} 延迟时间（秒）
   */
  calculateDelayTime(beats) {
    return calculateDelayTime(this.bpm, beats);
  }

  /**
   * 更新所有delay效果的时间（委托到 SynthEngine.updateDelayTimes）。
   */
  updateDelayTimes() {
    updateDelayTimes(this);
  }

  /**
   * 更新混响参数（委托到 SynthEngine.updateReverbEffects）。
   */
  updateReverbEffects() {
    updateReverbEffects(this);
  }

  /**
   * 音名转换为MIDI音符号（委托到 SynthEngine.noteNameToMidi）。
   *
   * @param {string} noteName - 音名
   * @returns {number} MIDI 音符号
   */
  noteNameToMidi(noteName) {
    return noteNameToMidi(noteName);
  }

  /**
   * MIDI音符号转换为频率（委托到 SynthEngine.midiToFrequency）。
   *
   * @param {number} midiNote - MIDI 音符号
   * @returns {number} 频率（Hz）
   */
  midiToFrequency(midiNote) {
    return midiToFrequency(midiNote);
  }

  /**
   * 音名直接转换为频率（委托到 SynthEngine.noteNameToFrequency）。
   *
   * @param {string} noteName - 音名
   * @returns {number} 频率（Hz）
   */
  noteNameToFrequency(noteName) {
    return noteNameToFrequency(noteName);
  }

  // ======================== 核心播放/调度方法 ========================

  /**
   * 设置特定预设的基础音高。
   *
   * @param {number} presetIndex - 预设索引
   * @param {string} noteName - 音名（如 'C4'）
   * @returns {boolean} 是否设置成功
   */
  setBaseNote(presetIndex, noteName) {
    if (presetIndex >= 0 && presetIndex < SLOT_COUNT) {
      this.baseNotes[presetIndex] = noteName;
      return true;
    }
    return false;
  }

  /**
   * 设置Transport循环，使用Tone.js的时间线系统。
   */
  setupTransportLoop() {
    // 首先确保Tone.js可用
    if (typeof Tone === 'undefined') {
      console.warn("Tone.js未加载，无法设置Transport循环");
      return;
    }

    try {
      // 清除之前可能存在的事件
      if (this.transportEventId !== null) {
        Tone.Transport.clear(this.transportEventId);
      }

      // 计算当前分辨率对应的Tone.js时间单位
      const timeUnit = this.resolution; // 例如 "16n"

      // 使用scheduleRepeat设置循环事件
      this.transportEventId = Tone.Transport.scheduleRepeat((time) => {
        // 更新当前拍子计数
        this.currentBeat = (this.currentBeat + 1) % 32;

        // 通知UI更新 - 使用自定义事件
        this.dispatchBeatEvent(time);

        // 同步到p5party共享对象 - 只同步节拍位置和时间戳
        if (typeof shared !== 'undefined' && shared && shared.metronome) {
          shared.metronome.currentBeat = this.currentBeat;
          shared.metronome.lastBeatTimestamp = Date.now();
        }

        // 播放当前拍子的音效
        this.playScheduledBeats(time);

        // 直接与Three.js场景通信
        this.syncWithThreeJS();
      }, timeUnit);

      // 确保Transport的BPM与当前设置一致
      Tone.Transport.bpm.value = this.bpm;

    } catch (err) {
      console.error("设置Transport循环时出错:", err);

      // 即使Tone.js有问题，我们也尝试使用setTimeout作为备用
      // 这确保即使声音播放失败，UI和可视化效果仍能继续工作
      if (this._backupTimerId) {
        clearTimeout(this._backupTimerId);
      }

      const startBackupTimer = () => {
        // 计算基于BPM和分辨率的间隔时间（毫秒）
        const interval = (60000 / this.bpm) / this.subdivision;

        this._backupTimerId = setTimeout(() => {
          // 更新当前拍子
          this.currentBeat = (this.currentBeat + 1) % 32;

          // 触发UI更新事件
          this.dispatchBeatEvent(Tone.now ? Tone.now() : performance.now() / 1000);

          // 同步到Three.js场景
          this.syncWithThreeJS();

          // 如果仍在播放，继续设置下一个计时器
          if (this.isPlaying) {
            startBackupTimer();
          }
        }, interval);
      };

      // 如果正在播放，启动备用定时器
      if (this.isPlaying) {
        startBackupTimer();
      }
    }
  }

  /**
   * 设置BPM。
   *
   * @param {number} bpm - 目标BPM
   * @returns {AudioSequencer} 当前实例，支持链式调用
   */
  setBpm(bpm) {
    // 确保BPM在合理范围内
    bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, bpm));

    // 更新本地BPM值
    this.bpm = bpm;

    // 更新delay时间，使其与新的BPM同步
    this.updateDelayTimes();

    // 计算基于BPM的播放间隔（毫秒）
    this.interval = (60000 / this.bpm) / this.subdivision;

    // 同步到Tone.js Transport
    if (typeof Tone !== 'undefined' && Tone.Transport) {
      // 立即设置Transport BPM
      Tone.Transport.bpm.value = this.bpm;

      // 如果Transport正在播放，尝试应用新的速度
      if (Tone.Transport.state === "started" && this.isPlaying) {
        // 暂时暂停Transport
        Tone.Transport.pause();

        // 清除并重新设置Transport循环，使用新的BPM
        if (this.transportEventId !== null) {
          Tone.Transport.clear(this.transportEventId);
        }

        // 重新设置Transport循环
        this.setupTransportLoop();

        // 恢复播放
        Tone.Transport.start();

      } else {
        // 即使没有播放，也重新设置循环，确保下次播放时使用新的BPM
        this.setupTransportLoop();
      }
    }

    // 返回当前实例，支持链式调用
    return this;
  }

  /**
   * 设置分辨率，并更新Transport循环。
   *
   * @param {string} resolution - 分辨率（如 '1/4', '1/8', '1/16', '1/32'）
   */
  setResolution(resolution) {
    // 将旧格式转换为Tone.js的时间表示格式
    switch (resolution) {
      case "1/4":
        this.resolution = "4n";
        this.subdivision = 4;
        break;
      case "1/8":
        this.resolution = "8n";
        this.subdivision = 8;
        break;
      case "1/16":
        this.resolution = "16n";
        this.subdivision = 16;
        break;
      case "1/32":
        this.resolution = "32n";
        this.subdivision = 32;
        break;
      default:
        this.resolution = "16n";
        this.subdivision = 16;
    }

    // 如果Transport已启动，需要重新设置循环
    if (this.isPlaying) {
      // 暂时停止Transport
      const wasPlaying = Tone.Transport.state === "started";
      if (wasPlaying) {
        Tone.Transport.pause();
      }

      // 重新设置Transport循环
      this.setupTransportLoop();

      // 如果之前在播放，则恢复播放
      if (wasPlaying) {
        Tone.Transport.start();
      }
    } else {
      // 未播放状态下，只需要重新设置循环即可
      this.setupTransportLoop();
    }
  }

  /**
   * 触发节拍事件，通知UI更新。
   *
   * @param {number} time - 当前时间
   */
  dispatchBeatEvent(time) {
    // 创建自定义事件，包含当前拍子信息
    const event = new CustomEvent('metronome-beat', {
      detail: {
        beat: this.currentBeat,
        time: time,
        timestamp: Date.now()
      }
    });

    // 触发事件
    window.dispatchEvent(event);
  }

  /**
   * 检查是否需要播放节拍音效，然后调度音符。
   *
   * @param {number} time - Tone.js 调度时间
   */
  playScheduledBeats(time) {
    // 仅当音频系统已初始化时才播放
    if (!this.audioInitialized || typeof Tone === 'undefined') {
      console.warn("音频系统未初始化，无法播放声音");
      return;
    }

    try {
      // 获取步进器UI和当前步骤
      const ui = window.ui || { stepCount: 16, currentPattern: 0 };
      const stepIndex = this.currentBeat % ui.stepCount;
      const nextStepIndex = (stepIndex + 1) % ui.stepCount; // 获取下一个步骤的索引

      // 方法1：处理当前预设的声音 - 直接使用当前nodes数据
      if (typeof nodes !== 'undefined' && nodes.length > 0) {
        // 获取当前预设索引
        const currentPresetIndex = ui.currentPattern;

        // 确保合成器索引在有效范围内
        const synthIndex = Math.min(currentPresetIndex, this.presetSounds.length - 1);

        // 使用当前节点数据播放声音
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].alpha && nodes[i].alpha[stepIndex] > 0.5) {
            // 获取音高偏移（如果有）
            const pitchOffset = nodes[i].pitchOffset ? nodes[i].pitchOffset[stepIndex] : 0;

            // 获取持续时间（如果有）
            const duration = nodes[i].duration ? nodes[i].duration[stepIndex] : 1.0;

            // 使用基础音高设置计算音符
            const baseNote = this.baseNotes[currentPresetIndex] || DEFAULT_BASE_NOTE;

            // 检查是否需要滑音 - 仅当当前插槽的滑音开关启用时才考虑滑音
            let needsPortamento = false;
            let nextNoteFreq = null;

            // 当当前插槽的滑音开关启用时，检查下一个音符是否紧接着当前音符
            if (this.synthUI.portamento.enabled[currentPresetIndex]) {
              if (nextStepIndex !== 0 || this.currentBeat < ui.stepCount * 4 - 1) {
                if (nodes[i].alpha && nodes[i].alpha[nextStepIndex] > 0.5) {
                  const nextPitchOffset = nodes[i].pitchOffset ? nodes[i].pitchOffset[nextStepIndex] : 0;

                  // 如果下一个音符的音高与当前音符不同，则启用滑音
                  if (nextPitchOffset !== pitchOffset) {
                    needsPortamento = true;

                    // 计算下一个音符的实际音符
                    const nextNote = Tone.Frequency(baseNote).transpose(nextPitchOffset);
                    nextNoteFreq = nextNote.toFrequency();
                  }
                }
              }
            }

            try {
              // 计算实际音符，加入音高偏移
              const noteOffset = pitchOffset;

              // 使用Tone.js的Frequency API计算实际音符
              const actualNote = Tone.Frequency(baseNote).transpose(noteOffset);

              // 计算实际持续时间（以秒为单位）
              // 正确计算持续时间，考虑当前分辨率
              const subdivisionDuration = 60 / this.bpm / (this.subdivision / 4);
              const noteDuration = subdivisionDuration * duration;

              // 获取合成器（懒加载）
              const synth = this.getOrCreateSynth(synthIndex);

              // 确保音符在时值结束时强制释放，即使包络尚未完成
              const now = Tone.now();
              const playTime = time > 0 ? time : now;

              // 设置滑音时间（如果需要）
              if (needsPortamento && synth && typeof synth.portamento !== 'undefined') {
                // 保存原始的滑音设置，稍后恢复
                const originalPortamento = synth.portamento;

                // 设置新的滑音时间 - 使用当前插槽的滑音时间设置
                const portamentoTime = this.synthParams[synthIndex].portamento;
                synth.portamento = portamentoTime;

                // 使用triggerAttack，不释放前一个音符
                synth.triggerAttack(actualNote, playTime);

                // 计算下一个音符的时间
                const nextNoteTime = playTime + subdivisionDuration;

                // 在下一个音符即将到来之前恢复原始滑音设置
                Tone.Transport.scheduleOnce(() => {
                  synth.portamento = originalPortamento;
                }, Tone.now() + subdivisionDuration * 0.9);
              } else {
                // 普通播放 - 使用triggerAttackRelease
                if (synth) {
                  // 使用triggerAttackRelease，确保音符在指定时长后结束
                  synth.triggerAttackRelease(actualNote, noteDuration, playTime);
                }
              }

            } catch (noteError) {
              console.warn("播放音符时出错:", noteError);
            }
          }
        }
      }

      // 方法2：处理所有其他预设的声音 - 使用预设数据
      const presetPatterns = window.presetPatterns || [];

      // 遍历所有预设，跳过当前选中的预设（因为已经在上面处理过）
      for (let presetIndex = 0; presetIndex < this.presetSounds.length; presetIndex++) {
        // 跳过当前已经处理过的预设
        if (presetIndex === (window.ui ? window.ui.currentPattern : 0)) continue;

        // 检查这个预设是否有节点数据
        if (presetPatterns[presetIndex] &&
            presetPatterns[presetIndex].variants &&
            presetPatterns[presetIndex].variants.length > 0) {
          // 获取当前变体索引
          const currentVariant = presetPatterns[presetIndex].currentVariant || 0;
          // 获取活动变体的第一个节点（如果存在）
          const presetVariant = presetPatterns[presetIndex].variants[currentVariant] || [];
          const presetNode = presetVariant.length > 0 ? presetVariant[0] : null;

          // 检查当前步骤是否激活
          if (presetNode && presetNode.alpha && presetNode.alpha[stepIndex] > 0.5) {
            // 获取音高偏移（如果有）
            const pitchOffset = presetNode.pitchOffset ? presetNode.pitchOffset[stepIndex] : 0;

            // 获取持续时间（如果有）
            const duration = presetNode.duration ? presetNode.duration[stepIndex] : 1.0;

            // 使用基础音高设置计算音符
            const baseNote = this.baseNotes[presetIndex] || DEFAULT_BASE_NOTE;

            // 检查是否需要滑音 - 仅当当前插槽的滑音开关启用时才考虑滑音
            let needsPortamento = false;
            let nextNoteFreq = null;

            // 当当前插槽的滑音开关启用时，检查下一个音符是否紧接着当前音符
            if (this.synthUI.portamento.enabled[presetIndex]) {
              if (nextStepIndex !== 0 || this.currentBeat < ui.stepCount * 4 - 1) {
                if (presetNode.alpha && presetNode.alpha[nextStepIndex] > 0.5) {
                  const nextPitchOffset = presetNode.pitchOffset ? presetNode.pitchOffset[nextStepIndex] : 0;

                  // 如果下一个音符的音高与当前音符不同，则启用滑音
                  if (nextPitchOffset !== pitchOffset) {
                    needsPortamento = true;

                    // 计算下一个音符的实际音符
                    const nextNote = Tone.Frequency(baseNote).transpose(nextPitchOffset);
                    nextNoteFreq = nextNote.toFrequency();
                  }
                }
              }
            }

            try {
              // 计算实际音符，加入音高偏移
              const noteOffset = pitchOffset;

              // 使用Tone.js的Frequency API计算实际音符
              const actualNote = Tone.Frequency(baseNote).transpose(noteOffset);

              // 计算实际持续时间（以秒为单位）
              // 正确计算持续时间，考虑当前分辨率
              const subdivisionDuration = 60 / this.bpm / (this.subdivision / 4);
              const noteDuration = subdivisionDuration * duration;

              // 使用对应预设的Tone合成器（懒加载）
              const synth = this.getOrCreateSynth(presetIndex);

              // 确保音符在时值结束时强制释放，即使包络尚未完成
              const now = Tone.now();
              const playTime = time > 0 ? time : now;

              // 设置滑音时间（如果需要）
              if (needsPortamento && synth && typeof synth.portamento !== 'undefined') {
                // 保存原始的滑音设置，稍后恢复
                const originalPortamento = synth.portamento;

                // 设置新的滑音时间 - 使用当前插槽的滑音时间设置
                const portamentoTime = this.synthParams[presetIndex].portamento;
                synth.portamento = portamentoTime;

                // 使用triggerAttack，不释放前一个音符
                synth.triggerAttack(actualNote, playTime);

                // 计算下一个音符的时间
                const nextNoteTime = playTime + subdivisionDuration;

                // 在下一个音符即将到来之前恢复原始滑音设置
                Tone.Transport.scheduleOnce(() => {
                  synth.portamento = originalPortamento;
                }, Tone.now() + subdivisionDuration * 0.9);
              } else {
                // 使用triggerAttackRelease，确保音符在指定时长后结束
                synth.triggerAttackRelease(actualNote, noteDuration, playTime);
              }
            } catch (noteError) {
              console.warn("播放预设音符时出错:", noteError);
            }
          }
        }
      }
    } catch (e) {
      console.error("播放音效时出错:", e);
    }
  }

  /**
   * 直接与Three.js场景同步。
   */
  syncWithThreeJS() {
    try {
      // 检查是否有Three.js通信接口
      if (typeof window.syncBallWithStepper === 'function') {
        const ui = window.ui || { stepCount: 16, currentPattern: 0 };
        const stepIndex = this.currentBeat % ui.stepCount;

        // 当前拍号（4/4）
        const beat = Math.floor(this.currentBeat / 4);

        // 获取所有预设数据
        const presetPatterns = window.presetPatterns || [];

        // 遍历所有预设(最多8个)，检查每个预设当前步骤是否激活
        for (let presetIndex = 0; presetIndex < SLOT_COUNT; presetIndex++) {
          let isActive = false;

          // 检查这个预设是否有节点
          if (presetPatterns[presetIndex] &&
              presetPatterns[presetIndex].variants &&
              presetPatterns[presetIndex].variants.length > 0) {
            // 获取当前变体索引
            const currentVariant = presetPatterns[presetIndex].currentVariant || 0;
            // 获取活动变体的第一个节点（如果存在）
            const presetVariant = presetPatterns[presetIndex].variants[currentVariant] || [];
            const presetNode = presetVariant.length > 0 ? presetVariant[0] : null;

            // 检查当前步骤是否激活
            if (presetNode && presetNode.alpha && presetNode.alpha[stepIndex] > 0.5) {
              isActive = true;
            }

            // 调用Three.js场景中的同步函数来激活对应的球
            window.syncBallWithStepper(
              beat,
              stepIndex,
              presetIndex,
              isActive
            );

            // 如果音符是活跃的，确保直接激活小球
            if (isActive && typeof window.activateSphere === 'function') {
              window.activateSphere(presetIndex, true);

              // 添加闪烁效果
              if (typeof window.flashSphere === 'function') {
                window.flashSphere(presetIndex);
              }
            }

            // 发送自定义事件，以便其他组件可以响应
            const event = new CustomEvent('rhythm-beat', {
              detail: {
                beat: beat,
                step: stepIndex,
                preset: presetIndex,
                active: isActive,
                timestamp: Date.now()
              }
            });
            window.dispatchEvent(event);
          }
        }

        // 另外，如果当前有活跃的节点，也需要处理（这处理当前正在编辑的预设）
        if (typeof nodes !== 'undefined' && nodes.length > 0) {
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i] && nodes[i].alpha) {
              // 如果当前步进是活跃的，直接调用Three.js同步函数
              const isActive = nodes[i].alpha[stepIndex] > 0.5;

              // 从节点中获取预设索引，默认为当前预设
              const presetIndex = nodes[i].presetIndex !== undefined ? nodes[i].presetIndex : ui.currentPattern;

              // 调用Three.js场景中的同步函数
              window.syncBallWithStepper(
                beat,
                stepIndex,
                presetIndex,
                isActive
              );

              // 如果音符是活跃的，直接激活小球
              if (isActive && typeof window.activateSphere === 'function') {
                window.activateSphere(presetIndex, true);

                // 添加闪烁效果
                if (typeof window.flashSphere === 'function') {
                  window.flashSphere(presetIndex);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('与Three.js场景同步时出错:', e);
    }
  }

  /**
   * 开始/停止节拍器。
   */
  beatToggle() {
    this.isPlaying = !this.isPlaying;

    if (this.isPlaying) {
      // 重置当前步进位置为-1，这样第一次增加后会变成0
      this.currentBeat = -1;

      // 尝试启动Tone.js上下文和Transport
      if (typeof Tone !== 'undefined') {
        // 首先尝试启动音频上下文
        Tone.start().then(() => {

          // 重新设置Transport循环，确保使用最新设置
          this.setupTransportLoop();

          // 立即增加到第一拍
          this.currentBeat = 0;

          // 手动触发一次节拍事件
          this.dispatchBeatEvent(Tone.now());

          // 立即播放第一个步进的声音
          if (this.audioInitialized) {
            try {
              this.playScheduledBeats(Tone.now());
              // 立即同步到3D场景
              this.syncWithThreeJS();
            } catch (err) {
              console.warn("手动触发第一拍失败:", err);
            }
          }

          // 启动Transport，从下一拍开始
          Tone.Transport.start();

        }).catch(err => {
          console.warn("启动Tone.js上下文失败，将使用备用定时器:", err);

          // 如果Tone.js启动失败，使用备用setTimeout方法
          this.useBackupTimer();

          // 添加一次性点击监听器，在用户下次点击时再次尝试启动Tone.js
          const unlockAudio = () => {
            Tone.start().then(() => {
              // 启动成功后，如果仍然在播放状态，则切换回Tone.js
              if (this.isPlaying) {
                // 清除备用定时器
                if (this._backupTimerId) {
                  clearTimeout(this._backupTimerId);
                  this._backupTimerId = null;
                }

                // 重新设置Transport
                this.setupTransportLoop();
                Tone.Transport.start();
              }
            });
            document.body.removeEventListener('click', unlockAudio);
          };
          document.body.addEventListener('click', unlockAudio, { once: true });
        });
      } else {
        // 如果Tone.js不可用，直接使用备用定时器
        console.warn("Tone.js不可用，使用备用定时器");
        this.useBackupTimer();
      }
    } else {
      // 停止播放

      // 停止Tone.Transport
      if (typeof Tone !== 'undefined' && Tone.Transport) {
        Tone.Transport.stop();
      }

      // 停止备用定时器
      if (this._backupTimerId) {
        clearTimeout(this._backupTimerId);
        this._backupTimerId = null;
      }
    }

    // 同步控制相机自动运镜模式
    if (typeof window.setCameraAutoModeFromStepper === 'function') {
      window.setCameraAutoModeFromStepper(this.isPlaying);
    }
  }

  /**
   * 使用备用定时器进行节奏控制。
   */
  useBackupTimer() {
    // 清除可能存在的旧定时器
    if (this._backupTimerId) {
      clearTimeout(this._backupTimerId);
    }

    // 计算基于BPM和分辨率的间隔时间（毫秒）
    const interval = (60000 / this.bpm) / this.subdivision;

    // 立即触发第一拍
    this.currentBeat = 0;

    // 手动触发一次节拍事件和场景同步
    this.dispatchBeatEvent(performance.now() / 1000);
    this.syncWithThreeJS();

    // 启动循环定时器
    const startBackupTimer = () => {
      this._backupTimerId = setTimeout(() => {
        // 更新当前拍子
        this.currentBeat = (this.currentBeat + 1) % 32;

        // 触发UI更新事件
        const now = performance.now() / 1000;
        this.dispatchBeatEvent(now);

        // 尝试播放节拍声音（如果可能）
        if (this.audioInitialized) {
          try {
            this.playScheduledBeats(now);
          } catch (e) {
            console.warn("播放定时节拍声音失败:", e);
          }
        }

        // 同步到Three.js场景
        this.syncWithThreeJS();

        // 如果仍在播放，继续设置下一个计时器
        if (this.isPlaying) {
          startBackupTimer();
        }
      }, interval);
    };

    startBackupTimer();
  }

  /**
   * 兼容原有系统的beat方法，保留以支持现有代码。
   */
  beat() {
    // 使用新的Tone.Transport系统处理拍子，不需要在此计算时间
    // 这个方法仅用于兼容现有代码，实际不执行任何操作
    return;
  }

  /**
   * 用于计算时间的方法，兼容原有代码。
   */
  calculateInterval() {
    // 此方法不再使用，但保留以兼容现有代码
    return;
  }
}

export default AudioSequencer;
