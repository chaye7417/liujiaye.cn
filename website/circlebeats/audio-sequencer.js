class AudioSequencer {
    constructor(bpm, beatsPerMeasure, beatFraction) {
      this.bpm = 120; // 默认BPM为120
      this.beatsPerMeasure = 4; // 默认4/4拍
      this.beatFraction = 4;
      this.currentBeat = 0;
      this.isPlaying = false;
      this.resolution = "16n"; // 使用Tone.js的音乐时间表示，16n表示十六分音符
      this.subdivision = 16; // 每小节的细分数量，默认16（对应16分音符）
      
      // 添加标志位，表示音频系统是否已初始化
      this.audioInitialized = false;
      
      // 添加基础音高设置数组，为每个预设存储基础音高
      // 默认每个预设使用中央C (C4)
      this.baseNotes = ['C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4'];
      
      // 添加合成器UI相关属性
      this.synthUI = {
        visible: false,
        currentSlot: 0,
        previousSlot: 0, // 添加前一个插槽索引，用于动画效果
        waveforms: ['sine', 'triangle', 'sawtooth', 'square'],
        selectedWaveforms: ['sine', 'triangle', 'sawtooth', 'square', 'sine', 'triangle', 'sawtooth', 'square'],
        hoveredWaveform: -1,
        hoveredSlot: -1,
        hoveredADSRLabel: null, // 'A' | 'D' | 'S' | 'R' | null
        hoveredSegment: null, // 'A' | 'D' | 'S' | 'R' | null - 表示当前悬浮的曲线段
        synthButton: {
          hovered: false  // 合成器按钮悬停状态
        },
        slotColors: window.presetSlotColors || [
          '#FF5252', '#FF9800', '#FFEB3B', '#4CAF50',
          '#2196F3', '#673AB7', '#E91E63', '#00BCD4'
        ],
        adsrDrag: {
          dragging: false,
          node: null, // 'A' | 'D' | 'S' | 'R'
        },
        // 添加过渡动画相关属性
        transition: {
          active: false,
          startTime: 0,
          duration: 300, // 过渡动画持续时间（毫秒）
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
          filterCurrentParams: null // 当前插值的滤波器参数值
        },
        // 添加包络页面切换
        envelopePage: 0, // 0=放大器包络，1=滤波器包络
        hoveredPageButton: -1, // 用于检测页面按钮悬停

        // 新增：滤波器UI控制相关属性
        filter: {
          hoveredControl: null, // 'freq' | 'res' | null
          dragging: {
            active: false,
            control: null, // 'freq' | 'res' | null
            startValue: 0,
            startY: 0,
            startX: 0,
            startQValue: 1.0 // 添加：保存初始共振值，用于垂直拖动调整
          },
          // 滤波器类型选择
          types: ['lowpass', 'highpass', 'bandpass', 'notch'], 
          selectedType: ['lowpass', 'lowpass', 'lowpass', 'lowpass', 'lowpass', 'lowpass', 'lowpass', 'lowpass'],
          hoveredType: -1,
          // 滤波器显示模式
          displayMode: 0, // 0=基本控制，1=高级控制
          // 频率范围显示
          freqRangeMin: 20,    // 最小频率 (Hz)
          freqRangeMax: 20000, // 最大频率 (Hz)
          // 曲线绘制参数
          curveResolution: 100, // 曲线分辨率点数
          curveValues: null     // 存储预计算的曲线值
        },
        
        // 新增：滑音开关相关属性
        portamento: {
          enabled: [false, false, false, false, false, false, false, false],  // 每个插槽独立的滑音开关状态
          hovering: false,       // 鼠标是否悬停在滑音开关上
          values: [0, 0, 0, 0, 0, 0, 0, 0] // 每个插槽的滑音时间值（秒）
        },
        
        // 新增：delay效果相关属性
        delay: {
          enabled: [false, false, false, false, false, false, false, false],  // 每个插槽独立的delay开关状态
          hovering: false,       // 鼠标是否悬停在delay开关上
          values: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], // 每个插槽的delay时间值（以拍为单位），默认为1/2拍
          feedback: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]        // 每个插槽的delay反馈值
        },
        
        // 新增：reverb效果相关属性
        reverb: {
          enabled: [false, false, false, false, false, false, false, false],  // 每个插槽独立的reverb开关状态
          hovering: false,       // 鼠标是否悬停在reverb开关上
          decay: [1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5],      // 每个插槽的reverb衰减时间（秒）
          wet: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],         // 每个插槽的reverb湿度值
          dragStart: null // 添加dragStart属性，用于跟踪鼠标拖动开始
        },
      };
      
      // 添加Transport事件ID，用于移除事件
      this.transportEventId = null;
      
      // 音名到MIDI音符号的映射
      this.noteToMidi = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
      };
      
      // 添加键盘按键映射 - 新增
      this.keyboardMap = {
        // 白键映射 (A-S-D-F-G-H-J-K-L-;-')
        'a': 'C4',  // C
        's': 'D4',  // D
        'd': 'E4',  // E
        'f': 'F4',  // F
        'g': 'G4',  // G
        'h': 'A4',  // A
        'j': 'B4',  // B
        'k': 'C5',  // 高八度C
        'l': 'D5',  // 高八度D
        ';': 'E5',  // 高八度E
        "'": 'F5',  // 高八度F
        
        // 黑键映射 (W-E-T-Y-U)
        'w': 'C#4', // C#
        'e': 'D#4', // D#
        't': 'F#4', // F#
        'y': 'G#4', // G#
        'u': 'A#4'  // A#
      };
      
      // 跟踪当前正在按下的键，避免重复触发
      this.keysPressed = {};
      
      // 添加八度偏移量，用于Z/X键调整八度
      this.octaveOffset = 0;
      
      // 跟踪键盘演奏状态
      this.keyboardPlayState = {
        isPlaying: false,      // 当前是否有音符在演奏
        lastPlayedNote: null,  // 最后演奏的音符
        activeKeys: []         // 当前激活的音符键列表
      };
      
      // 初始化合成器参数 - 从SynthPresetManager获取参数或使用默认值
      this.synthParams = Array(8).fill().map((_, index) => {
        // 检查SynthPresetManager是否存在
        if (window.synthPresetManager) {
          const envParams = window.synthPresetManager.presetEnvelopeParams[index] || {};
          const filterParams = window.synthPresetManager.presetFilterParams[index] || {};
          const delayParams = window.synthPresetManager.presetDelayParams[index] || {};
          const reverbParams = window.synthPresetManager.presetReverbParams[index] || {};
          const portamentoEnabled = window.synthPresetManager.presetPortamentoEnabled[index] || false;
          const portamentoTime = window.synthPresetManager.presetPortamentoTime[index] || 0.05;
          
          // 更新UI中的波形选择
          if (window.synthPresetManager.presetWaveforms && window.synthPresetManager.presetWaveforms[index]) {
            this.synthUI.selectedWaveforms[index] = window.synthPresetManager.presetWaveforms[index];
          }
          
          return {
            // 放大器包络参数
            volume: -10, // 默认音量
            attack: envParams.attack || 0.005,
            decay: envParams.decay || 0.1,
            sustain: envParams.sustain || 0.3,
            release: envParams.release || 0.1,
            // 滤波器参数
            filterType: filterParams.type || 'lowpass',
            filterFreq: filterParams.frequency || 20000,
            filterQ: filterParams.Q || 1,
            // 滤波器包络参数
            filterAttack: envParams.filterAttack || 0.01,
            filterDecay: envParams.filterDecay || 0.1,
            filterSustain: envParams.filterSustain || 1.0,
            filterRelease: envParams.filterRelease || 0.1,
            filterEnvAmount: filterParams.envAmount || 2,
            // 滑音参数
            portamento: portamentoTime,
            // delay参数
            delayEnabled: window.synthPresetManager.presetDelayEnabled[index] || false,
            delayTime: delayParams.time || 0.5,
            delayFeedback: delayParams.feedback || 0.3,
            delayWet: delayParams.mix || 0.3,
            // reverb参数
            reverbEnabled: window.synthPresetManager.presetReverbEnabled[index] || false,
            reverbDecay: reverbParams.decay || 1.5,
            reverbWet: reverbParams.mix || 0.3
          };
        } else {
          // 如果没有SynthPresetManager，使用默认值
          return {
            // 放大器包络参数
            volume: -10,
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
        }
      });
      
      // 初始化测试音效 - 延迟初始化避免影响UI渲染
      setTimeout(() => {
      this.initSound();
      }, 500);

      // 设置合成器UI的事件监听
      this.setupSynthUIEvents();
      
      // 设置键盘事件监听 - 新增
      this.setupKeyboardEvents();
    }
    
    // 新增：设置键盘事件监听
    setupKeyboardEvents() {
      // 键盘按下事件
      document.addEventListener('keydown', (event) => {
        // 获取按键对应的小写字符
        const key = event.key.toLowerCase();
        
        // 如果这个键已经被按下了，则忽略
        if (this.keysPressed[key]) return;
        
        // 标记按键为已按下
        this.keysPressed[key] = true;
        
        // 处理八度调整键 - Z下移，X上移
        if (key === 'z') {
          this.octaveOffset = Math.max(this.octaveOffset - 1, -2); // 限制最小偏移为-2个八度
          return;
        } else if (key === 'x') {
          this.octaveOffset = Math.min(this.octaveOffset + 1, 2); // 限制最大偏移为+2个八度
          return;
        }
        
        // 检查是否是映射中的音符按键
        if (this.keyboardMap[key]) {
          // 添加到活跃键列表
          this.keyboardPlayState.activeKeys.push(key);
          
          // 播放最新按下的音符
          this.playNoteByKeyboard(this.keyboardMap[key]);
          
          // 阻止默认行为，防止页面滚动等
          event.preventDefault();
        }
      });
      
      // 键盘释放事件
      document.addEventListener('keyup', (event) => {
        // 获取按键对应的小写字符
        const key = event.key.toLowerCase();
        
        // 如果键未被按下，直接返回
        if (!this.keysPressed[key]) return;
        
        // 标记按键为已释放
        this.keysPressed[key] = false;
        
        // 处理Z/X键释放
        if (key === 'z' || key === 'x') {
          return;
        }
        
        // 如果是映射中的音符按键
        if (this.keyboardMap[key]) {
          // 从活跃键列表中移除
          const index = this.keyboardPlayState.activeKeys.indexOf(key);
          if (index !== -1) {
            this.keyboardPlayState.activeKeys.splice(index, 1);
          }
          
          // 检查是否还有其他音符键被按下
          if (this.keyboardPlayState.activeKeys.length === 0) {
            // 没有活跃键，停止演奏
            this.releaseNoteByKeyboard(this.keyboardMap[key]);
          } else {
            // 还有其他键被按下，切换到最后一个活跃键的音符
            const lastKey = this.keyboardPlayState.activeKeys[this.keyboardPlayState.activeKeys.length - 1];
            this.playNoteByKeyboard(this.keyboardMap[lastKey]);
          }
          
          // 阻止默认行为
          event.preventDefault();
        }
      });
      
      // 窗口失焦时，释放所有按键
      window.addEventListener('blur', () => {
        // 清空活跃键列表
        this.keyboardPlayState.activeKeys = [];
        
        // 如果有音符在演奏，停止它
        if (this.keyboardPlayState.isPlaying && this.keyboardPlayState.lastPlayedNote) {
          this.releaseNoteByKeyboard(this.keyboardPlayState.lastPlayedNote);
          this.keyboardPlayState.isPlaying = false;
          this.keyboardPlayState.lastPlayedNote = null;
        }
        
        // 清空所有按键状态
        for (const key in this.keysPressed) {
          this.keysPressed[key] = false;
        }
        
        // 重置八度偏移
        this.octaveOffset = 0;
      });
    }
    
    // 新增：使用键盘触发音符
    playNoteByKeyboard(noteName) {
      // 确保音频系统已初始化
      if (!this.audioInitialized || typeof Tone === 'undefined') {
        console.warn("音频系统未初始化，无法播放键盘音符");
        return;
      }
      
      try {
        // 获取当前选中的合成器插槽
        const currentSlot = this.synthUI.currentSlot;
        
        // 确保合成器对象存在
        if (this.presetSounds && this.presetSounds[currentSlot]) {
          // 应用八度偏移调整音符
          let adjustedNote;
          if (this.octaveOffset !== 0) {
            // 使用Tone.js的Frequency API进行音符转换
            adjustedNote = Tone.Frequency(noteName).transpose(this.octaveOffset * 12).toNote();
          } else {
            adjustedNote = noteName;
          }
          
          // 更新最后演奏的音符
          this.keyboardPlayState.lastPlayedNote = adjustedNote;
          
          // 尝试启动音频上下文（如果尚未启动）
          if (Tone.context.state !== 'running') {
            Tone.start().then(() => {

              // 上下文启动后立即播放音符
              this.presetSounds[currentSlot].triggerAttack(adjustedNote, Tone.now());
              this.keyboardPlayState.isPlaying = true;
            }).catch(e => {
              console.warn("键盘触发启动音频上下文失败:", e);
            });
          } else {
            // 音频上下文已经运行，直接播放音符
            // 如果已经有音符演奏中，不需要重新触发attack，只需要设置频率
            if (this.keyboardPlayState.isPlaying) {
              // 使用setNote方法而不是triggerAttack，避免包络重新触发
              if (typeof this.presetSounds[currentSlot].setNote === 'function') {
                this.presetSounds[currentSlot].setNote(adjustedNote, Tone.now());
              } else {
                // 如果没有setNote方法，则先释放再重新触发
                this.presetSounds[currentSlot].triggerRelease("+0.01");
                this.presetSounds[currentSlot].triggerAttack(adjustedNote, "+0.02");
              }
            } else {
              // 第一次触发音符
              this.presetSounds[currentSlot].triggerAttack(adjustedNote, Tone.now());
              this.keyboardPlayState.isPlaying = true;
            }
            
            // 如果有可视化效果，可以添加闪烁
            if (typeof window.flashSphere === 'function') {
              window.flashSphere(currentSlot);
            }
            
            // 点亮小球
            if (typeof window.activateSphere === 'function') {
              window.activateSphere(currentSlot, true);
            }
            

          }
        } else {
          console.warn("找不到合成器对象，无法演奏键盘音符");
        }
      } catch (e) {
        console.warn("键盘触发音符失败:", e);
      }
    }
    
    // 新增：释放键盘触发的音符
    releaseNoteByKeyboard(noteName) {
      // 确保音频系统已初始化
      if (!this.audioInitialized || typeof Tone === 'undefined') {
        return;
      }
      
      try {
        // 获取当前选中的合成器插槽
        const currentSlot = this.synthUI.currentSlot;
        
        // 确保合成器对象存在
        if (this.presetSounds && this.presetSounds[currentSlot]) {
          // 应用与播放时相同的八度偏移
          let adjustedNote;
          if (this.octaveOffset !== 0) {
            // 使用Tone.js的Frequency API进行音符转换
            adjustedNote = Tone.Frequency(noteName).transpose(this.octaveOffset * 12).toNote();
          } else {
            adjustedNote = noteName;
          }
          
          // 重置演奏状态
          this.keyboardPlayState.isPlaying = false;
          this.keyboardPlayState.lastPlayedNote = null;
          
          // 释放音符
          this.presetSounds[currentSlot].triggerRelease(Tone.now());

          
          // 熄灭小球 - 调用Three.js场景中的函数将球体设为非激活状态
          if (typeof window.activateSphere === 'function') {
            window.activateSphere(currentSlot, false);

          }
        }
      } catch (e) {
        console.warn("键盘释放音符失败:", e);
      }
    }
    
    // 新增：设置合成器UI的事件监听
    setupSynthUIEvents() {
      // 添加切换按钮事件监听
      const toggleButton = document.getElementById('toggle-synth-button');
      if (toggleButton) {
        toggleButton.addEventListener('click', () => {
          this.synthUI.visible = !this.synthUI.visible;
          // 更新按钮文本
          toggleButton.textContent = this.synthUI.visible ? 'Hide Synth' : 'Show Synth';
          
          // 如果显示合成器UI，则隐藏步进器和乐谱
          if (this.synthUI.visible) {
            window.rhythmVisible = false;
            document.getElementById('toggle-rhythm-button').textContent = 'Show Rhythm';
            
            // 在显示合成器UI时，同步当前步进器选择的插槽
            if (window.ui && window.ui.currentPattern !== undefined) {
              this.synthUI.currentSlot = window.ui.currentPattern;
            }
            
            // 分发合成器UI可见性变化事件
            window.dispatchEvent(new CustomEvent('synth-ui-visibility-change', {
              detail: { visible: true }
            }));
          } else {
            // 如果隐藏合成器UI，则显示步进器和乐谱
            window.rhythmVisible = true;
            document.getElementById('toggle-rhythm-button').textContent = 'Hide Rhythm';
            
            // 分发合成器UI可见性变化事件
            window.dispatchEvent(new CustomEvent('synth-ui-visibility-change', {
              detail: { visible: false }
            }));
            
            // 分发节奏器可见性变化事件（因为我们刚刚设置了rhythmVisible为true）
            window.dispatchEvent(new CustomEvent('rhythm-visibility-change', {
              detail: { visible: true }
            }));
          }
          
          // 重绘界面
          if (typeof window.redraw === 'function') {
            window.redraw();
          }
        });
      }
      
      // 监听步进器插槽选择变化
      window.addEventListener('pattern-change', (event) => {
        if (event.detail && event.detail.patternIndex !== undefined) {
          // 更新合成器UI的当前插槽
          this.synthUI.currentSlot = event.detail.patternIndex;
          
          // 重绘界面
          if (typeof window.redraw === 'function') {
            window.redraw();
          }
        }
      });
    }

    // 新增：绘制合成器UI
    drawSynthUI() {
      if (!this.synthUI.visible) return;

      push();
      
      // 绘制标题
      fill(200, 220);
      textSize(20);
      textAlign(CENTER);
      text("", ui.centerX, ui.centerY - ui.panelHeight/2 + 30);
      
      // 绘制合成器返回按钮 (与步进器界面上的按钮位置一致)
      const buttonWidth = 100;
      const buttonHeight = 30;
      const buttonX = ui.panelX + ui.panelWidth - buttonWidth - 20; // 右边距20px
      const buttonY = ui.panelY + 20; // 上边距20px
      
      // 检查鼠标是否悬停在按钮上
      if (this.synthUI.synthButton.hovered) {
        fill(70, 70, 90, 220); // 悬停时的颜色
        stroke(100, 100, 120);
      } else {
        fill(50, 50, 70, 200); // 正常状态的颜色
        stroke(80, 80, 100);
      }
      
      // 绘制按钮背景
      strokeWeight(2);
      rect(buttonX, buttonY, buttonWidth, buttonHeight, 5);
      
      // 绘制按钮文本
      fill(220);
      textSize(14);
      textAlign(CENTER, CENTER);
      text("Hide Synth", buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);

      // 绘制预设插槽选择器
      this.drawPresetSlots();

      // 绘制波形选择器
      this.drawWaveformSelector();

      // 绘制合成器参数控制
      this.drawSynthParameters();
      
      // 新增：绘制滤波器控制界面
      this.drawFilterUI();
      
      // 新增：绘制滑音开关
      this.drawPortamentoSwitch();
      
      // 新增：绘制delay控制界面
      this.drawDelayControls();

      // 新增：绘制reverb控制UI
      this.drawReverbControls();

      pop();
    }

    // 新增：绘制预设插槽选择器
    drawPresetSlots() {
      push();
      
      // 计算按钮布局
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const startX = ui.centerX - totalWidth / 2;
      const startY = ui.centerY - ui.panelHeight/2 + 70;

      // 绘制每个插槽按钮
      for (let i = 0; i < 8; i++) {
        const x = startX + i * (buttonWidth + spacing);
        const y = startY;
        
        // 设置按钮颜色
        const isSelected = i === this.synthUI.currentSlot;
        const isHovered = i === this.synthUI.hoveredSlot;
        
        // 获取插槽颜色
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

        // 绘制插槽编号
        fill(255);
        textSize(12);
        textAlign(CENTER, CENTER);
        text(i + 1, x + buttonWidth/2, y + 10);
      }

      pop();
    }

    // 新增：绘制波形选择器
    drawWaveformSelector() {
      push();
      
      const currentSlot = this.synthUI.currentSlot;
      const waveforms = this.synthUI.waveforms;
      const selectedWaveform = this.synthUI.selectedWaveforms[currentSlot];
      
      // 计算按钮布局，与插槽对齐
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const startX = ui.centerX - totalWidth / 2;
      const startY = ui.centerY - ui.panelHeight/2 + 100; // 放置在插槽选择器下方
      
      const wfSize = totalWidth / 4 - spacing; // 每个波形宽度，4个波形平均分配总宽度
      
      // 绘制四种波形图标
      waveforms.forEach((waveform, i) => {
        const x = startX + i * (wfSize + spacing);
        const y = startY;
        const w = wfSize;
        const h = 25; // 将高度从50减少到25
        
        // 检查是否选中或悬停
        const isSelected = waveform === selectedWaveform;
        const isHovered = i === this.synthUI.hoveredWaveform;
        
        // 绘制图标背景
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
        
        // 绘制波形图案
        noFill();
        
        // 根据波形类型绘制不同图案
        const padding = 5;
        const graphH = h - padding * 2;
        const graphW = w - padding * 2;
        
        // 先绘制黑色阴影
        stroke(0, 200);
        strokeWeight(3);
        beginShape();
        switch (waveform) {
          case 'sine': // 正弦波
            for (let px = 0; px <= graphW; px++) {
              const py = sin(map(px, 0, graphW, 0, TWO_PI)) * graphH/2;
              vertex(x + px + padding, y + h/2 + py);
            }
            break;
          case 'triangle': // 三角波
            vertex(x + padding, y + h/2 + graphH/2);
            vertex(x + padding + graphW/4, y + h/2 - graphH/2);
            vertex(x + padding + graphW*3/4, y + h/2 + graphH/2);
            vertex(x + padding + graphW, y + h/2 - graphH/2);
            break;
          case 'sawtooth': // 锯齿波
            vertex(x + padding, y + h/2 + graphH/2);
            vertex(x + padding + graphW, y + h/2 - graphH/2);
            vertex(x + padding + graphW, y + h/2 + graphH/2);
            break;
          case 'square': // 方波
            vertex(x + padding, y + h/2 - graphH/2);
            vertex(x + padding + graphW/2, y + h/2 - graphH/2);
            vertex(x + padding + graphW/2, y + h/2 + graphH/2);
            vertex(x + padding + graphW, y + h/2 + graphH/2);
            break;
        }
        endShape();
        
        // 再绘制白色波形线条在上层
        strokeWeight(2);
        if (isSelected) {
          stroke(255, 255, 255);
        } else {
          stroke(255, 255, 255); // 将未选择的波形颜色从蓝绿色(0, 255, 255)改为白色(255, 255, 255)
        }
        
        beginShape();
        switch (waveform) {
          case 'sine': // 正弦波
            for (let px = 0; px <= graphW; px++) {
              const py = sin(map(px, 0, graphW, 0, TWO_PI)) * graphH/2;
              vertex(x + px + padding, y + h/2 + py);
            }
            break;
          case 'triangle': // 三角波
            vertex(x + padding, y + h/2 + graphH/2);
            vertex(x + padding + graphW/4, y + h/2 - graphH/2);
            vertex(x + padding + graphW*3/4, y + h/2 + graphH/2);
            vertex(x + padding + graphW, y + h/2 - graphH/2);
            break;
          case 'sawtooth': // 锯齿波
            vertex(x + padding, y + h/2 + graphH/2);
            vertex(x + padding + graphW, y + h/2 - graphH/2);
            vertex(x + padding + graphW, y + h/2 + graphH/2);
            break;
          case 'square': // 方波
            vertex(x + padding, y + h/2 - graphH/2);
            vertex(x + padding + graphW/2, y + h/2 - graphH/2);
            vertex(x + padding + graphW/2, y + h/2 + graphH/2);
            vertex(x + padding + graphW, y + h/2 + graphH/2);
            break;
        }
        endShape();
        
        // 添加波形标签，使用完整英文单词
        textAlign(CENTER, BOTTOM);
        textSize(10);
        fill(255); // 使用简单的白色文字
        noStroke(); // 删除描边
        
        // 显示完整的波形名称
        const waveformNames = {
          'sine': 'Sine',
          'triangle': 'Triangle',
          'sawtooth': 'Sawtooth',
          'square': 'Square'
        };
        // 将波形标签直接显示在波形图标下方，减少与按钮的间距冲突
        text(waveformNames[waveform], x + w/2, y + h + 12);
      });
      
      pop();
    }

    // 新增：绘制合成器参数控制
    drawSynthParameters() {
      push();
      const currentSlot = this.synthUI.currentSlot;
      
      // 获取当前插槽的主题色
      const slotColor = color(this.synthUI.slotColors[currentSlot]);
      
      // 确定使用哪个参数集，处理动画过渡
      let params;
      
      if (this.synthUI.transition.active) {
        // 计算过渡进度
        const now = Date.now();
        const elapsed = now - this.synthUI.transition.startTime;
        const duration = this.synthUI.transition.duration;
        
        if (elapsed >= duration) {
          // 过渡结束
          this.synthUI.transition.active = false;
          
          // 根据当前页面选择正确的参数集
          if (this.synthUI.envelopePage === 0) {
            // 放大器包络页面
            params = {
              attack: this.synthParams[currentSlot].attack,
              decay: this.synthParams[currentSlot].decay,
              sustain: this.synthParams[currentSlot].sustain,
              release: this.synthParams[currentSlot].release,
              volume: this.synthParams[currentSlot].volume
            };
          } else {
            // 滤波器包络页面
            params = {
              attack: this.synthParams[currentSlot].filterAttack || 0.05,
              decay: this.synthParams[currentSlot].filterDecay || 0.3,
              sustain: this.synthParams[currentSlot].filterSustain || 0.5,
              release: this.synthParams[currentSlot].filterRelease || 0.5,
              volume: this.synthParams[currentSlot].volume
            };
          }
        } else {
          // 计算非线性过渡进度（使用缓动函数）
          const progress = this.easeInOutCubic(elapsed / duration);
          
          // 更新过渡参数
          const startParams = this.synthUI.transition.startParams;
          const endParams = this.synthUI.transition.endParams;
          const currentParams = this.synthUI.transition.currentParams;
          
          // 使用缓动函数平滑插值
          currentParams.attack = this.lerp(startParams.attack, endParams.attack, progress);
          currentParams.decay = this.lerp(startParams.decay, endParams.decay, progress);
          currentParams.sustain = this.lerp(startParams.sustain, endParams.sustain, progress);
          currentParams.release = this.lerp(startParams.release, endParams.release, progress);
          
          // 使用插值后的参数
          params = currentParams;
        }
      } else {
        // 没有过渡动画，直接使用当前插槽参数
        if (this.synthUI.envelopePage === 0) {
          // 放大器包络页面
          params = {
            attack: this.synthParams[currentSlot].attack,
            decay: this.synthParams[currentSlot].decay,
            sustain: this.synthParams[currentSlot].sustain,
            release: this.synthParams[currentSlot].release,
            volume: this.synthParams[currentSlot].volume
          };
        } else {
          // 滤波器包络页面
          params = {
            attack: this.synthParams[currentSlot].filterAttack || 0.05,
            decay: this.synthParams[currentSlot].filterDecay || 0.3,
            sustain: this.synthParams[currentSlot].filterSustain || 0.5,
            release: this.synthParams[currentSlot].filterRelease || 0.5,
            volume: this.synthParams[currentSlot].volume
          };
        }
      }
      
      // 获取波形选择器位置信息，以便对齐
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100; // 插槽选择器下方
      const waveformHeight = 25; // 波形选择器的高度改为25
      
      // 增加波形选择器和包络切换按钮之间的间距
      const waveToEnvGap = 45; // 增加从30到45的间距，为波形标签提供足够空间
      
      // 包络线区域定义 - 放置在波形选择器下方，留出足够空间
      const envX = waveformStartX;  // 左边界与波形选择器对齐
      const envY = waveformStartY + waveformHeight + waveToEnvGap;  // 增加间距，避免与波形标签重叠
      const envW = totalWidth;  // 总宽度与插槽和波形选择器相同
      const envH = 90;  // 包络编辑器高度
      
      // 绘制页面切换按钮 - 放在包络编辑器上方
      const pageButtonY = envY - 25; // 放在包络线上方
      const pageButtonWidth = 120;
      const pageButtonHeight = 20;
      const pageButtonSpacing = 10;
      const cornerRadius = 5;
      
      // 放大器包络按钮
      const ampButtonX = ui.centerX - pageButtonWidth - pageButtonSpacing/2;
      
      // 绘制放大器按钮背景
      if (this.synthUI.envelopePage === 0) {
        // 激活状态
        fill(red(slotColor), green(slotColor), blue(slotColor), 220);
      } else if (this.synthUI.hoveredPageButton === 0) {
        // 悬停状态
        fill(red(slotColor), green(slotColor), blue(slotColor), 150);
      } else {
        // 非激活状态
        fill(40, 180);
      }
      stroke(30, 180);
      strokeWeight(1);
      rect(ampButtonX, pageButtonY, pageButtonWidth, pageButtonHeight, cornerRadius);
      
      // 按钮文字
      fill(255);
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(12);
      text("Amp Envelope", ampButtonX + pageButtonWidth/2, pageButtonY + pageButtonHeight/2);
      
      // 滤波器包络按钮
      const filterButtonX = ui.centerX + pageButtonSpacing/2;
      
      // 绘制滤波器按钮背景
      if (this.synthUI.envelopePage === 1) {
        // 激活状态
        fill(red(slotColor), green(slotColor), blue(slotColor), 220);
      } else if (this.synthUI.hoveredPageButton === 1) {
        // 悬停状态
        fill(red(slotColor), green(slotColor), blue(slotColor), 150);
      } else {
        // 非激活状态
        fill(40, 180);
      }
      stroke(30, 180);
      strokeWeight(1);
      rect(filterButtonX, pageButtonY, pageButtonWidth, pageButtonHeight, cornerRadius);
      
      // 按钮文字
      fill(255);
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(12);
      text("Filter Envelope", filterButtonX + pageButtonWidth/2, pageButtonY + pageButtonHeight/2);
      
      // 在包络区域和按钮之间添加一些间距
      const envBackgroundY = envY - 5; // 略微将背景上移，靠近按钮
      
      // 背景框
      fill(20, 180);
      stroke(40, 180);
      strokeWeight(1);
      rect(envX - 10, envBackgroundY, envW + 20, envH + 55, 5); // 背景框向上微调
      
      // 栅格线
      stroke(60, 120);
      strokeWeight(1);
      // 水平线
      for (let i = 0; i <= 4; i++) {
        const y = envY + 10 + (envH - 10) * i / 4; // 调整以匹配新的顶部边距
        line(envX, y, envX + envW, y);
      }
      // 垂直线
      for (let i = 0; i <= 4; i++) {
        const x = envX + (envW * i / 4);
        line(x, envY + 10, x, envY + envH); // 顶部从envY调整为envY + 10
      }
      
      // 参数范围 - 两个页面保持一致
      const minA = 0.001, maxA = 2.0;  // 秒
      const minD = 0.01, maxD = 2.0;   // 秒
      const minS = 0, maxS = 1;        // 0-1
      const minR = 0.01, maxR = 2.0;   // 秒
      
      // 取当前参数值 - 根据当前页面选择
      let A, D, S, R;
      let paramType = "";
      
      if (this.synthUI.envelopePage === 0) {
        // 放大器包络参数
        A = params.attack;
        D = params.decay;
        S = params.sustain;
        R = params.release;
        paramType = "amp";
      } else {
        // 滤波器包络参数
        A = params.attack; // 使用传入的参数，包含插值后的值
        D = params.decay;
        S = params.sustain;
        R = params.release;
        paramType = "filter";
      }
      
      // 固定时间比例，不再根据总时间动态缩放
      // 使用固定比例：A最大2秒，D最大2秒，S部分固定1秒，R最大2秒
      // 总宽度对应7秒（A:2s + D:2s + S:1s + R:2s）
      const maxTimeWidth = 7; // 秒
      const pxPerS = envW / maxTimeWidth;
      
      // 固定的时间点
      // A段末尾的时间点
      const tA = A;
      // D段末尾的时间点
      const tD = tA + D;
      // S段末尾的时间点
      const tS = tD + 1; // S段固定为1秒
      // R段末尾的时间点
      const tR = tS + R;
      
      // Y轴坐标
      const y0 = envY + envH;           // 基线（底部）
      const yMax = envY + 10;           // 最高点（增加10px边距，避免节点超出框体）
      
      // 节点坐标计算
      const ptA = { 
        x: envX + (tA / maxTimeWidth) * envW, 
        y: yMax 
      };
      const ptD = { 
        x: envX + (tD / maxTimeWidth) * envW, 
        y: yMax + (y0 - yMax) * (1 - S) 
      };
      const ptS = { 
        x: envX + (tS / maxTimeWidth) * envW, 
        y: ptD.y 
      };
      const ptR = { 
        x: envX + (tR / maxTimeWidth) * envW, 
        y: y0 
      };
      
      // 绘制包络线 - 分段绘制以支持不同透明度
      noFill();
      
      // 定义常量
      const normalOpacity = 100; // 降低到约40%透明度，使非高亮部分更淡
      const highlightOpacity = 255; // 100%透明度
      
      // 检查是否有段落高亮
      const isHighlighted = this.synthUI.hoveredSegment !== null;
      
      // 首先绘制所有非高亮段落（作为背景）
      strokeWeight(2);
      
      // 绘制A段（Attack）- 从原点到A点的直线
      if (!(isHighlighted && this.synthUI.hoveredSegment === 'A')) {
        stroke(255, 255, 255, normalOpacity);
        line(envX, y0, ptA.x, ptA.y);
      }
      
      // 绘制A-D段（Attack-Decay）
      if (!(isHighlighted && this.synthUI.hoveredSegment === 'D')) {
        stroke(255, 255, 255, normalOpacity);
        line(ptA.x, ptA.y, ptD.x, ptD.y);
      }
      
      // 绘制D-S段（Decay-Sustain）
      if (!(isHighlighted && this.synthUI.hoveredSegment === 'S')) {
        stroke(255, 255, 255, normalOpacity);
        line(ptD.x, ptD.y, ptS.x, ptS.y);
      }
      
      // 绘制S-R段（Sustain-Release）
      if (!(isHighlighted && this.synthUI.hoveredSegment === 'R')) {
        stroke(255, 255, 255, normalOpacity);
        line(ptS.x, ptS.y, ptR.x, ptR.y);
      }
      
      // 然后单独绘制高亮段落（在上层）
      if (isHighlighted) {
        // 为高亮的曲线段添加发光效果
        // 先绘制一个更宽的淡色背景线
        strokeWeight(6);
        // 使用插槽主题色作为发光效果，降低不透明度
        stroke(red(slotColor), green(slotColor), blue(slotColor), 50);
        
        if (this.synthUI.hoveredSegment === 'A') {
          line(envX, y0, ptA.x, ptA.y);
        } else if (this.synthUI.hoveredSegment === 'D') {
          line(ptA.x, ptA.y, ptD.x, ptD.y);
        } else if (this.synthUI.hoveredSegment === 'S') {
          line(ptD.x, ptD.y, ptS.x, ptS.y);
        } else if (this.synthUI.hoveredSegment === 'R') {
          line(ptS.x, ptS.y, ptR.x, ptR.y);
        }
        
        // 再绘制更粗的实际高亮线
        strokeWeight(3); // 增加线宽
        stroke(255, 255, 255, highlightOpacity); // 全白色
        
        if (this.synthUI.hoveredSegment === 'A') {
          line(envX, y0, ptA.x, ptA.y);
        } else if (this.synthUI.hoveredSegment === 'D') {
          line(ptA.x, ptA.y, ptD.x, ptD.y);
        } else if (this.synthUI.hoveredSegment === 'S') {
          line(ptD.x, ptD.y, ptS.x, ptS.y);
        } else if (this.synthUI.hoveredSegment === 'R') {
          line(ptS.x, ptS.y, ptR.x, ptR.y);
        }
      }
      
      // 绘制节点
      strokeWeight(1);
      
      // 绘制各个节点，根据悬浮状态调整描边
      // 先绘制所有非高亮节点
      for (let node of ['A', 'D', 'S', 'R']) {
        if (isHighlighted && this.synthUI.hoveredSegment === node) continue; // 跳过高亮节点
        
        // 获取节点坐标
        let nodeX, nodeY;
        if (node === 'A') {
          nodeX = ptA.x;
          nodeY = ptA.y;
        } else if (node === 'D') {
          nodeX = ptD.x;
          nodeY = ptD.y;
        } else if (node === 'S') {
          nodeX = ptS.x;
          nodeY = ptS.y;
        } else if (node === 'R') {
          nodeX = ptR.x;
          nodeY = ptR.y;
        }
        
        // 使用插槽主题色替换黄色
        fill(red(slotColor), green(slotColor), blue(slotColor), 150); // 较低透明度的填充
        noStroke(); // 移除描边，使用纯色圆点
        ellipse(nodeX, nodeY, 10, 10);
      }
      
      // 特殊处理：高亮线段的两个端点也应该高亮
      if (isHighlighted) {
        let startNode, endNode;
        if (this.synthUI.hoveredSegment === 'A') {
          // A段: 起点(envX, y0)和A点
          startNode = {x: envX, y: y0};
          endNode = {x: ptA.x, y: ptA.y};
        } else if (this.synthUI.hoveredSegment === 'D') {
          // D段: A点和D点
          startNode = {x: ptA.x, y: ptA.y};
          endNode = {x: ptD.x, y: ptD.y};
        } else if (this.synthUI.hoveredSegment === 'S') {
          // S段: D点和S点
          startNode = {x: ptD.x, y: ptD.y};
          endNode = {x: ptS.x, y: ptS.y};
        } else if (this.synthUI.hoveredSegment === 'R') {
          // R段: S点和R点
          startNode = {x: ptS.x, y: ptS.y};
          endNode = {x: ptR.x, y: ptR.y};
        }
        
        // 绘制发光效果，使用插槽主题色
        noStroke();
        fill(red(slotColor), green(slotColor), blue(slotColor), 50); // 使用主题色发光
        ellipse(endNode.x, endNode.y, 14, 14); // 略大的发光圆
        
        // 高亮端点，使用插槽主题色
        fill(red(slotColor), green(slotColor), blue(slotColor), 220); // 使用主题色填充
        noStroke(); // 不使用描边
        ellipse(endNode.x, endNode.y, 10, 10); // 主节点高亮
        
        // 如果不是A段，也高亮起点（A段的起点不是控制节点）
        if (this.synthUI.hoveredSegment !== 'A') {
          // 给起点也添加高亮效果，但稍弱一些
          noStroke();
          fill(red(slotColor), green(slotColor), blue(slotColor), 30); // 较弱的发光，使用主题色
          ellipse(startNode.x, startNode.y, 12, 12);
          
          fill(red(slotColor), green(slotColor), blue(slotColor), 180); // 稍暗的主题色
          noStroke(); // 不使用描边
          ellipse(startNode.x, startNode.y, 10, 10);
        }
      }
      
      // 绘制节点标签 - 自适应位置
      fill(255); 
      noStroke(); 
      textSize(12);
      
      // 计算标签位置的辅助函数
      const calcLabelPosition = (node, label) => {
        // 标准位置：上方和右侧
        const positions = [
          { align: [CENTER, BOTTOM], pos: [node.x, node.y - 6], priority: 2 }, // 上
          { align: [LEFT, CENTER], pos: [node.x + 6, node.y], priority: 1 }   // 右
        ];
        
        // 根据不同节点和场景调整优先级
        if (label === 'A') {
          // A总是优先在上方
          return positions[0];
        } else if (label === 'D') {
          // D标签始终保持在上方，不考虑其他条件
          return positions[0];
        } else if (label === 'S') {
          // S默认在右侧
          [positions[0], positions[1]] = [positions[1], positions[0]];
          // 如果S靠近右边界，则改为上方
          if (tS > maxTimeWidth * 0.85) {
            [positions[0], positions[1]] = [positions[1], positions[0]];
          }
          // 如果S节点很低（sustain很低），优先放上方
          if (S < 0.2) {
            [positions[0], positions[1]] = [positions[1], positions[0]];
          }
        } else if (label === 'R') {
          // 如果R靠近右边界，优先放上方，否则在右侧
          if (tR > maxTimeWidth * 0.9) {
            // 不变，保持上方优先
          } else {
            // 右侧优先
            [positions[0], positions[1]] = [positions[1], positions[0]];
          }
        }
        
        return positions[0];
      };
      
      // 在绘制标签前检查和调整标签位置，避免重叠
      const adjustLabelPositions = (positions) => {
        // D标签需要特殊处理，确保它总是在上方
        positions.forEach(p => {
          if (p.label === 'D') {
            p.align = [CENTER, BOTTOM];
            p.pos = [p.node.x, p.node.y - 6];
          }
        });
        
        // 特殊处理A和D标签，如果水平距离很近
        const aPos = positions.find(p => p.label === 'A');
        const dPos = positions.find(p => p.label === 'D');
        if (aPos && dPos) {
          const dx = Math.abs(aPos.pos[0] - dPos.pos[0]);
          if (dx < 20) {
            // 让A向左移，D向右移
            aPos.pos[0] -= 8;
            dPos.pos[0] += 8;
          }
        }
        
        // 检查每对标签之间是否有潜在重叠
        for (let i = 0; i < positions.length; i++) {
          // 跳过D标签，它已经特殊处理了
          if (positions[i].label === 'D') continue;
          
          for (let j = i + 1; j < positions.length; j++) {
            // 跳过D标签，它已经特殊处理了
            if (positions[j].label === 'D') continue;
            
            const posA = positions[i].pos;
            const posB = positions[j].pos;
            const alignA = positions[i].align;
            const alignB = positions[j].align;
            
            // 检测水平距离
            const dx = Math.abs(posA[0] - posB[0]);
            // 检测垂直距离
            const dy = Math.abs(posA[1] - posB[1]);
            
            // 如果两者都使用上方对齐且水平距离很小
            if (alignA[1] === BOTTOM && alignB[1] === BOTTOM && dx < 20) {
              // 稍微调整水平位置，一个向左一个向右
              posA[0] -= 8;
              posB[0] += 8;
            }
            // 如果两者都使用右侧对齐且垂直距离很小
            else if (alignA[0] === LEFT && alignB[0] === LEFT && dy < 20) {
              // 稍微调整垂直位置，一个向上一个向下
              if (posA[1] < posB[1]) {
                posA[1] -= 4;
                posB[1] += 4;
              } else {
                posA[1] += 4;
                posB[1] -= 4;
              }
            }
          }
        }
        return positions;
      };
      
      // 计算所有标签位置
      let positions = [
        { label: 'A', ...calcLabelPosition(ptA, 'A'), node: ptA },
        { label: 'D', ...calcLabelPosition(ptD, 'D'), node: ptD },
        { label: 'S', ...calcLabelPosition(ptS, 'S'), node: ptS },
        { label: 'R', ...calcLabelPosition(ptR, 'R'), node: ptR }
      ];
      
      // 调整以避免重叠
      positions = adjustLabelPositions(positions);
      
      // 绘制标签
      for (const p of positions) {
        textAlign(p.align[0], p.align[1]);
        text(p.label, p.pos[0], p.pos[1]);
      }
      
      // 格式化时间并创建显示标签
      const fmtTime = (v) => {
        if (v < 0.01) return Math.round(v * 1000) + 'ms';
        if (v < 1) return (v * 1000).toFixed(0) + ' ms';
        return v.toFixed(2) + ' s';
      };
      
      // 格式化dB值
      const fmtDB = (v) => {
        // 将0-1映射到-60dB到0dB，但限制最小值为-40dB以便显示
        if (v <= 0.001) return '-∞ dB';
        const db = 20 * Math.log10(v);
        if (db < -40) return '-40 dB';
        return db.toFixed(1) + ' dB';
      };
      
      // 新增：格式化百分比值
      const fmtPercent = (v) => {
        return Math.round(v * 100) + '%';
      };
      
      // 参数数值标签 - 使用固定位置，不随节点移动
      const labelY = envY + envH + 15; // 从20减小到15，更靠近包络线
      
      // 固定四个参数在均匀分布的位置
      const labelX1 = envX + envW * 0.125;                // 1/8位置
      const labelX2 = envX + envW * 0.375;                // 3/8位置
      const labelX3 = envX + envW * 0.625;                // 5/8位置
      const labelX4 = envX + envW * 0.875;                // 7/8位置
      
      // 减小字体大小，使标签更紧凑
      textAlign(CENTER, TOP);
      textSize(11); // 从13减小到11
      
      // 减小标签背景矩形的尺寸
      strokeWeight(1);
      stroke(60, 120);
      
      // 标签区域尺寸 - 增加宽度以容纳文字
      const labelWidth = 75; // 从50增加到75
      const labelHeight = 35; // 从30增加到35
      
      // 绘制所有标签的背景和内容
      const drawParamLabel = (x, y, letter, name, value, isHighlighted) => {
        // 根据高亮状态设置不同的样式
        if (isHighlighted) {
          // 高亮背景 - 更亮、更明显
          fill(60, 200); // 更不透明的背景
          strokeWeight(1.5);
          stroke(red(slotColor), green(slotColor), blue(slotColor), 180); // 使用主题色描边
          rect(x - labelWidth/2, y - 8, labelWidth, labelHeight, 3);
          
          // 添加上下箭头指示
          stroke(red(slotColor), green(slotColor), blue(slotColor), 220); // 更亮的箭头，使用主题色
          strokeWeight(1.5); // 更粗的箭头
          // 上箭头
          line(x, y - 3, x - 4, y + 1);
          line(x, y - 3, x + 4, y + 1);
          // 下箭头
          line(x, y + 25, x - 4, y + 21);
          line(x, y + 25, x + 4, y + 21);
          
          // 高亮文本
          fill(red(slotColor), green(slotColor), blue(slotColor), 255); // 使用主题色
          noStroke();
          textSize(12); // 稍大的文字
          text(name, x, y - 3);
          
          fill(red(slotColor), green(slotColor), blue(slotColor), 230); // 使用亮一点的主题色
          textSize(11);
          text(value, x, y + 12);
        } else {
          // 移除对所有标签显示背景框的代码
          // 直接显示普通文本
          fill(red(slotColor), green(slotColor), blue(slotColor), 180); // 使用主题色替代黄色，透明度降低
          noStroke();
          text(name, x, y - 3);
          
          fill(255, 180); // 较暗的值
          text(value, x, y + 12);
        }
      };
      
      // 判断是否高亮特定标签
      const isLabelHighlighted = (label) => {
        return this.synthUI.hoveredADSRLabel === label || this.synthUI.hoveredSegment === label;
      };
      
      // 设置标签名称
      let attackName = "Attack";
      let decayName = "Decay";
      let sustainName = "Sustain";
      let releaseName = "Release";
      
      // 如果是滤波器包络模式，修改标签名称以区分
      if (paramType === "filter") {
        attackName = "F-Attack";
        decayName = "F-Decay";
        sustainName = "F-Sustain";
        releaseName = "F-Release";
      }
      
      // 绘制四个参数标签
      drawParamLabel(labelX1, labelY, 'A', attackName, fmtTime(A), isLabelHighlighted('A'));
      drawParamLabel(labelX2, labelY, 'D', decayName, fmtTime(D), isLabelHighlighted('D'));
      drawParamLabel(labelX3, labelY, 'S', sustainName, fmtPercent(S), isLabelHighlighted('S'));
      drawParamLabel(labelX4, labelY, 'R', releaseName, fmtTime(R), isLabelHighlighted('R'));
      
      pop();
    }

    // 添加：缓动函数实现
    lerp(a, b, t) {
      return a + (b - a) * t;
    }
    
    // 缓入缓出三次方曲线 - 比二次方曲线更加平滑的过渡效果
    easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // 新增：处理合成器UI的鼠标事件
    handleSynthMouseMoved(mouseX, mouseY) {
      if (!this.synthUI.visible) return;
      
      // 检查合成器返回按钮悬停
      const synthButtonWidth = 100;
      const synthButtonHeight = 30;
      const synthButtonX = ui.panelX + ui.panelWidth - synthButtonWidth - 20;
      const synthButtonY = ui.panelY + 20;
      
      this.synthUI.synthButton.hovered = (mouseX >= synthButtonX && 
                                            mouseX <= synthButtonX + synthButtonWidth && 
                                            mouseY >= synthButtonY && 
                                            mouseY <= synthButtonY + synthButtonHeight);

      // 检查插槽悬停
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const startX = ui.centerX - totalWidth / 2;
      const startY = ui.centerY - ui.panelHeight/2 + 70;

      this.synthUI.hoveredSlot = -1;
      for (let i = 0; i < 8; i++) {
        const x = startX + i * (buttonWidth + spacing);
        if (mouseX >= x && mouseX <= x + buttonWidth &&
            mouseY >= startY && mouseY <= startY + 20) {
          this.synthUI.hoveredSlot = i;
          break;
        }
      }

      // 检查波形选择器悬停
      const wfStartY = ui.centerY - ui.panelHeight/2 + 100; // 与drawWaveformSelector中一致
      const wfSize = totalWidth / 4 - spacing; // 每个波形宽度
      
      this.synthUI.hoveredWaveform = -1;
      this.synthUI.waveforms.forEach((_, i) => {
        const x = startX + i * (wfSize + spacing);
        if (mouseX >= x && mouseX <= x + wfSize &&
            mouseY >= wfStartY && mouseY <= wfStartY + 25) { // 高度从50改为25
          this.synthUI.hoveredWaveform = i;
        }
      });
      
      // 检查包络页面切换按钮悬停 - 确保与drawSynthParameters中计算完全一致
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25;
      
      // 使用相同的间距值
      const waveToEnvGap = 45; // 与drawSynthParameters中一致
      
      // 包络线区域 - 恢复缺失的envW和envH变量
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth; // 恢复这个变量定义，与drawSynthParameters保持一致
      const envH = 90;        // 恢复这个变量定义，与drawSynthParameters保持一致
      
      // 重置页面按钮悬停状态
      this.synthUI.hoveredPageButton = -1;
      
      // 页面切换按钮 - 参数与drawSynthParameters中完全一致
      const pageButtonY = envY - 25; // 放在包络线上方
      const pageButtonWidth = 120;
      const pageButtonHeight = 20;
      const pageButtonSpacing = 10;
      
      // 放大器包络按钮
      const ampButtonX = ui.centerX - pageButtonWidth - pageButtonSpacing/2;
      if (mouseX >= ampButtonX && mouseX <= ampButtonX + pageButtonWidth &&
          mouseY >= pageButtonY && mouseY <= pageButtonY + pageButtonHeight) {
        this.synthUI.hoveredPageButton = 0;
      }
      
      // 滤波器包络按钮
      const filterButtonX = ui.centerX + pageButtonSpacing/2;
      if (mouseX >= filterButtonX && mouseX <= filterButtonX + pageButtonWidth &&
          mouseY >= pageButtonY && mouseY <= pageButtonY + pageButtonHeight) {
        this.synthUI.hoveredPageButton = 1;
      }
      
      // 检查ADSR参数标签悬停
      const envY2 = envY; // 直接使用计算好的envY，确保一致性
      
      // 标签位置
      const labelY = envY2 + envH + 15; // 从20减小到15，与绘制部分一致
      const labelHeight = 35; // 从30增加到35，与绘制时一致
      
      const labelX1 = envX + envW * 0.125; // Attack 标签位置
      const labelX2 = envX + envW * 0.375; // Decay 标签位置
      const labelX3 = envX + envW * 0.625; // Sustain 标签位置
      const labelX4 = envX + envW * 0.875; // Release 标签位置
      
      // 标签点击区域宽度
      const labelWidth = envW * 0.22; // 增加宽度比例，使其与新的标签宽度匹配
      
      // 重置悬停状态
      this.synthUI.hoveredADSRLabel = null;
      
      // 检查鼠标是否在标签区域
      if (mouseY >= labelY - 10 && mouseY <= labelY + labelHeight) {
        // Attack 标签
        if (mouseX >= labelX1 - labelWidth/2 && mouseX <= labelX1 + labelWidth/2) {
          this.synthUI.hoveredADSRLabel = 'A';
          this.synthUI.hoveredSegment = 'A'; // 设置当前悬浮的曲线段
          this.synthUI.hoveredEnvelope = true; // 当悬浮在标签上时，也视为悬浮在包络线上
        }
        // Decay 标签
        else if (mouseX >= labelX2 - labelWidth/2 && mouseX <= labelX2 + labelWidth/2) {
          this.synthUI.hoveredADSRLabel = 'D';
          this.synthUI.hoveredSegment = 'D'; // 设置当前悬浮的曲线段
          this.synthUI.hoveredEnvelope = true;
        }
        // Sustain 标签
        else if (mouseX >= labelX3 - labelWidth/2 && mouseX <= labelX3 + labelWidth/2) {
          this.synthUI.hoveredADSRLabel = 'S';
          this.synthUI.hoveredSegment = 'S'; // 设置当前悬浮的曲线段
          this.synthUI.hoveredEnvelope = true;
        }
        // Release 标签
        else if (mouseX >= labelX4 - labelWidth/2 && mouseX <= labelX4 + labelWidth/2) {
          this.synthUI.hoveredADSRLabel = 'R';
          this.synthUI.hoveredSegment = 'R'; // 设置当前悬浮的曲线段
          this.synthUI.hoveredEnvelope = true;
        } else {
          this.synthUI.hoveredEnvelope = false;
        }
      } else {
        // 检查鼠标是否悬浮在包络编辑器区域内
        if (mouseX >= envX && mouseX <= envX + envW && mouseY >= envY2 && mouseY <= envY2 + envH) {
          // 获取当前参数
          const currentSlot = this.synthUI.currentSlot;
          let params;
          
          // 根据当前页面获取不同的参数集
          if (this.synthUI.envelopePage === 0) {
            // 放大器包络
            params = {
              attack: this.synthParams[currentSlot].attack,
              decay: this.synthParams[currentSlot].decay,
              sustain: this.synthParams[currentSlot].sustain,
              release: this.synthParams[currentSlot].release
            };
          } else {
            // 滤波器包络
            params = {
              attack: this.synthParams[currentSlot].filterAttack,
              decay: this.synthParams[currentSlot].filterDecay,
              sustain: this.synthParams[currentSlot].filterSustain,
              release: this.synthParams[currentSlot].filterRelease
            };
          }
          
          let A = params.attack, D = params.decay, S = params.sustain, R = params.release;
          
          // 固定的时间点
          const maxTimeWidth = 7; // 秒
          const tA = A;
          const tD = tA + D;
          const tS = tD + 1; // S段固定1秒
          const tR = tS + R;
          
          // Y轴坐标计算
          const y0 = envY2 + envH;           // 基线（底部）
          const yMax = envY2 + 10;           // 最高点（增加10px边距，避免节点超出框体）
          
          // 节点坐标
          const ptA = { 
            x: envX + (tA / maxTimeWidth) * envW, 
            y: yMax 
          };
          const ptD = { 
            x: envX + (tD / maxTimeWidth) * envW, 
            y: yMax + (y0 - yMax) * (1 - S) 
          };
          const ptS = { 
            x: envX + (tS / maxTimeWidth) * envW, 
            y: ptD.y 
          };
          const ptR = { 
            x: envX + (tR / maxTimeWidth) * envW, 
            y: y0 
          };
          
          // 检查是否悬浮在ADSR节点上
          const nodes = [
            { x: ptA.x, y: ptA.y, label: 'A' },
            { x: ptD.x, y: ptD.y, label: 'D' },
            { x: ptS.x, y: ptS.y, label: 'S' },
            { x: ptR.x, y: ptR.y, label: 'R' }
          ];
          
          let overNode = false;
          for (const node of nodes) {
            if (dist(mouseX, mouseY, node.x, node.y) <= 10) {
              this.synthUI.hoveredADSRLabel = node.label;
              overNode = true;
              break;
            }
          }
          
          // 如果鼠标在包络编辑器区域但不在节点上，检查是否在包络线附近
          if (!overNode) {
            this.synthUI.hoveredADSRLabel = null;
            
            // 检查鼠标是否在包络线段附近
            // A段 - 直线
            if (this.ptLine(mouseX, mouseY, envX, y0, ptA.x, ptA.y, 5)) {
              this.synthUI.hoveredSegment = 'A'; // 设置当前悬浮的曲线段
              this.synthUI.hoveredEnvelope = true;
            }
            // A-D段
            else if (this.ptLine(mouseX, mouseY, ptA.x, ptA.y, ptD.x, ptD.y, 5)) {
              this.synthUI.hoveredSegment = 'D'; // 设置当前悬浮的曲线段
              this.synthUI.hoveredEnvelope = true;
            }
            // D-S段
            else if (this.ptLine(mouseX, mouseY, ptD.x, ptD.y, ptS.x, ptS.y, 5)) {
              this.synthUI.hoveredSegment = 'S'; // 设置当前悬浮的曲线段
              this.synthUI.hoveredEnvelope = true;
            }
            // S-R段
            else if (this.ptLine(mouseX, mouseY, ptS.x, ptS.y, ptR.x, ptR.y, 5)) {
              this.synthUI.hoveredSegment = 'R'; // 设置当前悬浮的曲线段
              this.synthUI.hoveredEnvelope = true;
            }
            else {
              this.synthUI.hoveredEnvelope = false;
              this.synthUI.hoveredSegment = null;
            }
          } else {
            this.synthUI.hoveredEnvelope = true;
            // 节点悬浮状态已经在上面的循环中设置了hoveredADSRLabel
            this.synthUI.hoveredSegment = this.synthUI.hoveredADSRLabel;
          }
        } else {
          this.synthUI.hoveredEnvelope = false;
          this.synthUI.hoveredSegment = null;
        }
      }
      
      // 新增：检测滤波器控制区域悬停
      this.checkFilterControlsHover(mouseX, mouseY);
      
      // 新增：检测滑音开关悬停
      this.checkPortamentoHover(mouseX, mouseY);
      
      // 新增：检测delay控制悬停
      this.checkDelayHover(mouseX, mouseY);
      
      // 新增：检测reverb控制悬停
      this.checkReverbHover(mouseX, mouseY);
    }
    
    // 新增：检测滤波器控制区域的悬停状态
    checkFilterControlsHover(mouseX, mouseY) {
      // 重置滤波器控制悬停状态
      this.synthUI.filter.hoveredControl = null;
      this.synthUI.filter.hoveredType = -1;
      
      // 计算滤波器UI的位置
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25;
      const waveToEnvGap = 45;
      
      // 包络线区域
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth;
      const envH = 90;
      
      // 滤波器UI放置在ADSR参数标签下方
      const filterY = envY + envH + 60; // 留出足够空间给ADSR参数标签
      const filterX = envX;
      const filterW = envW;
      const filterH = 120; // 减小滤波器UI的总高度
      
      // 检查是否在滤波器UI区域内
      if (mouseX < filterX - 10 || mouseX > filterX + filterW + 10 || 
          mouseY < filterY - 10 || mouseY > filterY + filterH + 10) {
        return; // 不在滤波器UI区域内
      }
      
      // 控制区域占总宽度的25%
      const controlsWidth = filterW * 0.25;
      
      // 检查左侧面板 - 基本控制
      if (mouseX >= filterX && mouseX <= filterX + controlsWidth) {
        const width = controlsWidth;
        const height = filterH - 20;
        const y = filterY + 10;
        const x = filterX;
        
        // 平均分配四个区域的高度，与drawFilterBasicControls中保持一致
        const margin = 5; // 控件之间的边距
        const usableHeight = height - margin * 3; // 减去所有边距后的可用高度
        const sectionHeight = usableHeight / 4; // 每个控件的高度
        
        // 初始位置 - 均匀分布
        const freqY = y + sectionHeight * 0.5 + margin * 0;
        const resY = y + sectionHeight * 1.5 + margin * 1;
        const typeY = y + sectionHeight * 2.5 + margin * 2;
        const envY = y + sectionHeight * 3.5 + margin * 3;
        
        // 控件尺寸
        const controlWidth = width * 0.8;
        const controlX = x + width/2;
        const labelWidth = 70;
        
        // 高亮时标签更大，非高亮时更小
        const freqHeight = this.synthUI.filter.hoveredControl === "freq" ? 32 : 28;
        const resHeight = this.synthUI.filter.hoveredControl === "res" ? 32 : 28;
        const typeHeight = this.synthUI.filter.hoveredControl === "type" ? 32 : 28;
        const envHeight = this.synthUI.filter.hoveredControl === "env" ? 32 : 28;
        
        // 检查FREQ标签区域
        if (mouseX >= controlX - labelWidth/2 && mouseX <= controlX + labelWidth/2 &&
            mouseY >= freqY - freqHeight/2 && mouseY <= freqY + freqHeight/2) {
          this.synthUI.filter.hoveredControl = "freq";
          return;
        }
        
        // 检查RES标签区域
        if (mouseX >= controlX - labelWidth/2 && mouseX <= controlX + labelWidth/2 &&
            mouseY >= resY - resHeight/2 && mouseY <= resY + resHeight/2) {
          this.synthUI.filter.hoveredControl = "res";
          return;
        }
        
        // 检查TYPE标签区域
        if (mouseX >= controlX - labelWidth/2 && mouseX <= controlX + labelWidth/2 &&
            mouseY >= typeY - typeHeight/2 && mouseY <= typeY + typeHeight/2) {
          this.synthUI.filter.hoveredControl = "type";
          this.synthUI.filter.hoveredType = 1; // 保持兼容性
          return;
        }
        
        // 检查ENV标签区域
        if (mouseX >= controlX - labelWidth/2 && mouseX <= controlX + labelWidth/2 &&
            mouseY >= envY - envHeight/2 && mouseY <= envY + envHeight/2) {
          this.synthUI.filter.hoveredControl = "env";
          return;
        }
      }
      
      // 检查右侧曲线区域的悬停
      const curveWidth = filterW * 0.75;
      const curveX = filterX + controlsWidth + 5;
      const curveY = filterY + 10;
      const curveHeight = filterH - 20;
      
      if (mouseX >= curveX && mouseX <= curveX + curveWidth - 10 && 
          mouseY >= curveY && mouseY <= curveY + curveHeight) {
        // 悬停在曲线区域上，设置特殊悬停状态
        this.synthUI.filter.hoveredControl = "curve";
      }
    }
    
    // 辅助函数：检查点到线段的距离是否小于阈值
    ptLine(px, py, x1, y1, x2, y2, threshold) {
      // 线段长度的平方
      const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
      if (l2 === 0) return dist(px, py, x1, y1) < threshold; // 如果线段是一个点
      
      // 计算投影点参数 t
      const t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
      
      // 如果投影点在线段外，计算到端点的距离
      if (t < 0) return dist(px, py, x1, y1) < threshold;
      if (t > 1) return dist(px, py, x2, y2) < threshold;
      
      // 投影点在线段上，计算到投影点的距离
      const projX = x1 + t * (x2 - x1);
      const projY = y1 + t * (y2 - y1);
      return dist(px, py, projX, projY) < threshold;
    }
    
    // 新增：处理合成器UI的点击事件
    handleSynthMouseClicked(mouseX, mouseY) {
      if (!this.synthUI.visible) return;
      
      // 处理合成器返回按钮点击
      if (this.synthUI.synthButton.hovered) {
        // 切换合成器UI可见性
        this.synthUI.visible = false;
        
        // 如果隐藏合成器UI，则显示步进器
        window.rhythmVisible = true;
        
        // 分发合成器UI可见性变化事件
        window.dispatchEvent(new CustomEvent('synth-ui-visibility-change', {
          detail: { visible: false }
        }));
        
        return true;
      }

      // 处理插槽点击
      if (this.synthUI.hoveredSlot !== -1) {
        // 如果点击了不同的插槽，设置动画过渡
        if (this.synthUI.hoveredSlot !== this.synthUI.currentSlot) {
          // 保存前一个插槽
          this.synthUI.previousSlot = this.synthUI.currentSlot;
          
          // 确定当前正在哪个页面（Amp或Filter）
          const isFilterPage = this.synthUI.envelopePage === 1;
          
          // 根据当前页面选择正确的参数作为起始参数
          if (isFilterPage) {
            // 在滤波器页面，使用滤波器包络参数
            this.synthUI.transition.startParams = {
              attack: this.synthParams[this.synthUI.currentSlot].filterAttack || 0.05,
              decay: this.synthParams[this.synthUI.currentSlot].filterDecay || 0.3,
              sustain: this.synthParams[this.synthUI.currentSlot].filterSustain || 0.5,
              release: this.synthParams[this.synthUI.currentSlot].filterRelease || 0.5,
              volume: this.synthParams[this.synthUI.currentSlot].volume
            };
            
            // 更新当前插槽
            this.synthUI.currentSlot = this.synthUI.hoveredSlot;
            
            // 设置目标参数为新插槽的滤波器包络参数
            this.synthUI.transition.endParams = {
              attack: this.synthParams[this.synthUI.currentSlot].filterAttack || 0.05,
              decay: this.synthParams[this.synthUI.currentSlot].filterDecay || 0.3,
              sustain: this.synthParams[this.synthUI.currentSlot].filterSustain || 0.5,
              release: this.synthParams[this.synthUI.currentSlot].filterRelease || 0.5,
              volume: this.synthParams[this.synthUI.currentSlot].volume
            };
          } else {
            // 在放大器页面，使用放大器包络参数
            this.synthUI.transition.startParams = {
              attack: this.synthParams[this.synthUI.currentSlot].attack,
              decay: this.synthParams[this.synthUI.currentSlot].decay,
              sustain: this.synthParams[this.synthUI.currentSlot].sustain,
              release: this.synthParams[this.synthUI.currentSlot].release,
              volume: this.synthParams[this.synthUI.currentSlot].volume
            };
            
            // 更新当前插槽
            this.synthUI.currentSlot = this.synthUI.hoveredSlot;
            
            // 设置目标参数为新插槽的放大器包络参数
            this.synthUI.transition.endParams = {
              attack: this.synthParams[this.synthUI.currentSlot].attack,
              decay: this.synthParams[this.synthUI.currentSlot].decay,
              sustain: this.synthParams[this.synthUI.currentSlot].sustain,
              release: this.synthParams[this.synthUI.currentSlot].release,
              volume: this.synthParams[this.synthUI.currentSlot].volume
            };
          }
          
          // 创建当前参数的副本用于动画
          this.synthUI.transition.currentParams = { ...this.synthUI.transition.startParams };
          
          // 激活包络过渡
          this.synthUI.transition.active = true;
          this.synthUI.transition.startTime = Date.now();
          
          // 添加：设置滤波器参数过渡
          // 获取前一个插槽的滤波器参数
          const prevSlot = this.synthUI.previousSlot;
          this.synthUI.transition.filterStartParams = {
            filterFreq: this.synthParams[prevSlot].filterFreq,
            filterQ: this.synthParams[prevSlot].filterQ,
            filterType: this.synthParams[prevSlot].filterType
          };
          
          // 获取新插槽的滤波器参数
          const newSlot = this.synthUI.currentSlot;
          this.synthUI.transition.filterEndParams = {
            filterFreq: this.synthParams[newSlot].filterFreq,
            filterQ: this.synthParams[newSlot].filterQ,
            filterType: this.synthParams[newSlot].filterType
          };
          
          // 创建当前滤波器参数的副本用于动画
          this.synthUI.transition.filterCurrentParams = { ...this.synthUI.transition.filterStartParams };
          
          // 激活滤波器过渡
          this.synthUI.transition.filterActive = true;
          this.synthUI.transition.filterStartTime = Date.now();
        } else {
          // 点击当前插槽，不需要动画
          this.synthUI.currentSlot = this.synthUI.hoveredSlot;
        }
        return true;
      }

      // 处理波形选择点击
      if (this.synthUI.hoveredWaveform !== -1) {
        const newWaveform = this.synthUI.waveforms[this.synthUI.hoveredWaveform];
        const currentSlot = this.synthUI.currentSlot;
        
        // 更新UI中的选择
        this.synthUI.selectedWaveforms[currentSlot] = newWaveform;
        
        // 更新SynthPresetManager中的波形
        if (window.synthPresetManager) {
          window.synthPresetManager.setWaveform(currentSlot, newWaveform);
        }
        
        // 更新合成器波形
        if (this.presetSounds && this.presetSounds[currentSlot]) {
          this.presetSounds[currentSlot].oscillator.type = newWaveform;
        }
        return true;
      }

      // 处理包络页面切换按钮 - 确保计算位置与绘制位置一致
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25;
      
      // 使用相同的间距值与drawSynthParameters保持一致
      const waveToEnvGap = 45;
      
      // 包络线区域 - 也需要添加envW用于后面的计算
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth; // 恢复这个变量定义
      const envH = 90;        // 恢复这个变量定义
      
      // 页面切换按钮参数 - 与drawSynthParameters完全一致
      const pageButtonY = envY - 25; // 放在包络线上方
      const pageButtonWidth = 120;
      const pageButtonHeight = 20;
      const pageButtonSpacing = 10;
      
      // 放大器包络按钮
      const ampButtonX = ui.centerX - pageButtonWidth - pageButtonSpacing/2;
      if (mouseX >= ampButtonX && mouseX <= ampButtonX + pageButtonWidth &&
          mouseY >= pageButtonY && mouseY <= pageButtonY + pageButtonHeight) {
        // 仅当切换到不同页面时添加过渡动画
        if (this.synthUI.envelopePage !== 0) {
          // 存储当前参数作为起始参数（从Filter到Amp）
          const currentSlot = this.synthUI.currentSlot;
          const filterParams = this.synthParams[currentSlot];
          
          // 存储开始参数（Filter包络）
          this.synthUI.transition.startParams = {
            attack: filterParams.filterAttack || 0.05,
            decay: filterParams.filterDecay || 0.3,
            sustain: filterParams.filterSustain || 0.5,
            release: filterParams.filterRelease || 0.5,
            volume: filterParams.volume
          };
          
          // 存储目标参数（Amp包络）
          this.synthUI.transition.endParams = {
            attack: filterParams.attack,
            decay: filterParams.decay,
            sustain: filterParams.sustain,
            release: filterParams.release,
            volume: filterParams.volume
          };
          
          // 创建当前参数的副本用于动画
          this.synthUI.transition.currentParams = { ...this.synthUI.transition.startParams };
          
          // 激活过渡动画
          this.synthUI.transition.active = true;
          this.synthUI.transition.startTime = Date.now();
        }
        
        // 切换到放大器包络页
        this.synthUI.envelopePage = 0;
        return true;
      }
      
      // 滤波器包络按钮
      const filterButtonX = ui.centerX + pageButtonSpacing/2;
      if (mouseX >= filterButtonX && mouseX <= filterButtonX + pageButtonWidth &&
          mouseY >= pageButtonY && mouseY <= pageButtonY + pageButtonHeight) {
        // 仅当切换到不同页面时添加过渡动画
        if (this.synthUI.envelopePage !== 1) {
          // 存储当前参数作为起始参数（从Amp到Filter）
          const currentSlot = this.synthUI.currentSlot;
          const filterParams = this.synthParams[currentSlot];
          
          // 存储开始参数（Amp包络）
          this.synthUI.transition.startParams = {
            attack: filterParams.attack,
            decay: filterParams.decay,
            sustain: filterParams.sustain,
            release: filterParams.release,
            volume: filterParams.volume
          };
          
          // 存储目标参数（Filter包络）
          this.synthUI.transition.endParams = {
            attack: filterParams.filterAttack || 0.05,
            decay: filterParams.filterDecay || 0.3,
            sustain: filterParams.filterSustain || 0.5,
            release: filterParams.filterRelease || 0.5,
            volume: filterParams.volume
          };
          
          // 创建当前参数的副本用于动画
          this.synthUI.transition.currentParams = { ...this.synthUI.transition.startParams };
          
          // 激活过渡动画
          this.synthUI.transition.active = true;
          this.synthUI.transition.startTime = Date.now();
        }
        
        // 切换到滤波器包络页
        this.synthUI.envelopePage = 1;
        return true;
      }

      // 新增：处理滑音开关点击
      if (this.synthUI.portamento.hovering) {
        const currentSlot = this.synthUI.currentSlot;
        
        if (this.synthUI.portamento.hovering === 'toggle') {
          // 切换当前插槽的滑音开关状态
          this.synthUI.portamento.enabled[currentSlot] = !this.synthUI.portamento.enabled[currentSlot];
          
          // 更新合成器
          if (this.presetSounds && this.presetSounds[currentSlot]) {
            // 如果启用滑音，设置保存的值，否则设置为0（禁用滑音）
            const portamentoTime = this.synthUI.portamento.enabled[currentSlot] ? 
              this.synthParams[currentSlot].portamento : 0;
              
            this.presetSounds[currentSlot].portamento = portamentoTime;

          }
          
          return true;
        } 
        // 处理滑音时间调整按钮
        else if (this.synthUI.portamento.enabled[currentSlot]) {
          if (this.synthUI.portamento.hovering === 'minus') {
            // 减小滑音时间
            let newValue = this.synthParams[currentSlot].portamento - 0.01;
            // 限制最小值为0.01秒
            newValue = Math.max(0.01, newValue);
            this.synthParams[currentSlot].portamento = newValue;
            
            // 更新合成器
            if (this.presetSounds && this.presetSounds[currentSlot]) {
              this.presetSounds[currentSlot].portamento = newValue;

            }
            
            return true;
          } 
          else if (this.synthUI.portamento.hovering === 'plus') {
            // 增加滑音时间
            let newValue = this.synthParams[currentSlot].portamento + 0.01;
            // 限制最大值为0.3秒
            newValue = Math.min(0.3, newValue);
            this.synthParams[currentSlot].portamento = newValue;
            
            // 更新合成器
            if (this.presetSounds && this.presetSounds[currentSlot]) {
              this.presetSounds[currentSlot].portamento = newValue;

            }
            
            return true;
          }
        }
      }

      // 新增：处理delay控制点击
      if (this.synthUI.delay.hovering) {
        const currentSlot = this.synthUI.currentSlot;
        
        if (this.synthUI.delay.hovering === 'toggle') {
          // 切换当前插槽的delay开关状态
          this.synthUI.delay.enabled[currentSlot] = !this.synthUI.delay.enabled[currentSlot];
          
          // 更新delay效果
          if (this.delayEffects && this.delayEffects[currentSlot]) {
            if (this.synthUI.delay.enabled[currentSlot]) {
              // 启用delay效果
              this.delayEffects[currentSlot].wet.value = 0.3; // 设置一个适当的湿度值
            } else {
              // 禁用delay效果
              this.delayEffects[currentSlot].wet.value = 0;
            }

          }
          
          // 同步延迟开关状态到SynthPresetManager
          if (window.synthPresetManager) {
            window.synthPresetManager.setDelayEnabled(currentSlot, this.synthUI.delay.enabled[currentSlot]);

          }
          
          return true;
        } 
        // 处理delay时间调整按钮
        else if (this.synthUI.delay.enabled[currentSlot]) {
          if (this.synthUI.delay.hovering === 'minus') {
            // 获取当前delay时间值
            let currentBeats = this.synthUI.delay.values[currentSlot];
            let newBeats;
            
            // 根据当前值选择下一个更小的时值
            if (currentBeats <= 0.125) newBeats = 0.125; // 保持最小值为1/8拍
            else if (currentBeats <= 0.25) newBeats = 0.125; // 从1/4降到1/8
            else if (currentBeats <= 0.5) newBeats = 0.25; // 从1/2降到1/4
            else if (currentBeats <= 1) newBeats = 0.5; // 从1降到1/2
            else if (currentBeats <= 1.5) newBeats = 1; // 从1.5降到1
            else newBeats = 1.5; // 从2降到1.5
            
            // 更新delay时间值
            this.synthUI.delay.values[currentSlot] = newBeats;
            
            // 计算实际的延迟时间（秒）
            const delayTimeInSeconds = this.calculateDelayTime(newBeats);
            
            // 更新delay效果
            if (this.delayEffects && this.delayEffects[currentSlot]) {
              this.delayEffects[currentSlot].delayTime.value = delayTimeInSeconds;

            }
            
            return true;
          } 
          else if (this.synthUI.delay.hovering === 'plus') {
            // 获取当前delay时间值
            let currentBeats = this.synthUI.delay.values[currentSlot];
            let newBeats;
            
            // 根据当前值选择下一个更大的时值
            if (currentBeats >= 2) newBeats = 2; // 保持最大值为2拍
            else if (currentBeats >= 1.5) newBeats = 2; // 从1.5增加到2
            else if (currentBeats >= 1) newBeats = 1.5; // 从1增加到1.5
            else if (currentBeats >= 0.5) newBeats = 1; // 从1/2增加到1
            else if (currentBeats >= 0.25) newBeats = 0.5; // 从1/4增加到1/2
            else newBeats = 0.25; // 从1/8增加到1/4
            
            // 更新delay时间值
            this.synthUI.delay.values[currentSlot] = newBeats;
            
            // 计算实际的延迟时间（秒）
            const delayTimeInSeconds = this.calculateDelayTime(newBeats);
            
            // 更新delay效果
            if (this.delayEffects && this.delayEffects[currentSlot]) {
              this.delayEffects[currentSlot].delayTime.value = delayTimeInSeconds;

            }
            
            return true;
          }
          // 添加对feedback滑块点击的处理
          else if (this.synthUI.delay.hovering === 'feedback') {
            // 获取当前选中的插槽
            const currentSlot = this.synthUI.currentSlot;
            
            // 计算滤波器UI的位置（用于参考）
            const buttonWidth = 30;
            const spacing = 5;
            const totalWidth = 8 * buttonWidth + 7 * spacing;
            const waveformStartX = ui.centerX - totalWidth / 2;
            const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
            const waveformHeight = 25;
            const waveToEnvGap = 45;
            
            // 包络线区域
            const envX = waveformStartX;
            const envY = waveformStartY + waveformHeight + waveToEnvGap;
            const envW = totalWidth;
            const envH = 90;
            
            // 滤波器UI放置在ADSR参数标签下方
            const filterY = envY + envH + 60;
            const filterX = envX;
            const filterW = envW;
            const filterH = 120;
            
            // 滑音控制界面位置
            const portSwitchX = filterX - 10;
            const portSwitchY = filterY + filterH + 5;
            const portSwitchWidth = filterW + 20;
            const portSwitchHeight = 30;
            
            // 放置delay控制紧贴在滑音控制下方，宽度保持一致，但增加高度
            const switchX = portSwitchX;
            const switchY = portSwitchY + portSwitchHeight + 5;
            const switchWidth = portSwitchWidth;
            
            // 第二行：反馈滑块
            const row2Y = switchY + 48;
            const fbLabelX = switchX + switchWidth/2 - 100 + 120;
            const fbX = fbLabelX + 70;
            const fbY = row2Y;
            const fbWidth = 80;
            
            // 计算点击位置对应的反馈值
            if (mouseX >= fbX - fbWidth && mouseX <= fbX) {
              // 计算反馈值 (0-1范围)
              const relativeX = mouseX - (fbX - fbWidth);
              const newValue = relativeX / fbWidth;
              // 限制在0-0.9范围内
              const limitedValue = Math.max(0, Math.min(0.9, newValue));
              
              // 更新反馈值
              this.synthUI.delay.feedback[currentSlot] = limitedValue;
              
              // 更新delay效果
              if (this.delayEffects && this.delayEffects[currentSlot]) {
                this.delayEffects[currentSlot].feedback.value = limitedValue;

              }
              
              return true;
            }
          }
        }
        
        return false;
      }

      return false;
    }
    
    // 新增方法: 将音名转换为MIDI音符号
    noteNameToMidi(noteName) {
      // 例如: 'C4' => 60, 'A4' => 69, 'G#2' => 44
      if (!noteName || typeof noteName !== 'string') return 60; // 默认为中央C (C4)
      
      // 提取音名和八度
      const match = noteName.match(/([A-G][#b]?)(\d+)/);
      if (!match) return 60;
      
      const note = match[1];
      const octave = parseInt(match[2]);
      
      // 计算MIDI音符
      const noteNumber = this.noteToMidi[note];
      if (noteNumber === undefined) return 60;
      
      return noteNumber + (octave + 1) * 12;
    }
    
    // 新增方法: 将MIDI音符号转换为频率
    midiToFrequency(midiNote) {
      return 440 * Math.pow(2, (midiNote - 69) / 12);
    }
    
    // 新增方法: 将音名直接转换为频率
    noteNameToFrequency(noteName) {
      const midi = this.noteNameToMidi(noteName);
      return this.midiToFrequency(midi);
    }
    
    // 新增方法: 设置特定预设的基础音高
    setBaseNote(presetIndex, noteName) {
      if (presetIndex >= 0 && presetIndex < 8) {
        this.baseNotes[presetIndex] = noteName;

        
        return true;
      }
      return false;
    }
    
    // 初始化音效 - 使用Tone.js
    initSound() {
      try {
        // 确保Tone已定义
        if (typeof Tone === 'undefined') {
          console.warn("Tone.js未加载，稍后将重试");
          setTimeout(() => this.initSound(), 1000);
          return;
        }
        
        // 尝试预先启动音频上下文
        if (Tone.context.state !== 'running') {

          
          // 添加一次性点击监听器解锁音频
          const unlockAudio = () => {

            Tone.start();
            document.body.removeEventListener('click', unlockAudio);
          };
          document.body.addEventListener('click', unlockAudio, {once: true});
        }
        
        // 设置全局Transport的BPM
        Tone.Transport.bpm.value = this.bpm;
        
        // 创建主音量控制
        this.masterVolume = new Tone.Volume(-6).toDestination(); // 设置适中的音量
        
        // 为各个预设创建独立的音效合成器
        this.presetSounds = [];
        this.delayEffects = []; // 新增存储delay效果的数组
        this.reverbEffects = []; // 新增存储reverb效果的数组
        
        // 创建8个独立的合成器，使用选定的波形和滤波器
        for (let i = 0; i < 8; i++) {
          // 获取参数 - 优先从SynthPresetManager获取
          let waveform, envParams, filterParams, delayParams, reverbParams;
          let portamentoEnabled, portamentoTime;
          
          if (window.synthPresetManager) {
            // 从SynthPresetManager获取参数
            waveform = window.synthPresetManager.presetWaveforms[i];
            envParams = window.synthPresetManager.presetEnvelopeParams[i];
            filterParams = window.synthPresetManager.presetFilterParams[i];
            delayParams = window.synthPresetManager.presetDelayParams[i];
            reverbParams = window.synthPresetManager.presetReverbParams[i];
            portamentoEnabled = window.synthPresetManager.presetPortamentoEnabled[i];
            portamentoTime = window.synthPresetManager.presetPortamentoTime[i];
            
            // 同步效果启用状态
            if (!this.synthUI.delay) {
              this.synthUI.delay = { enabled: Array(8).fill(false) };
            }
            if (!this.synthUI.reverb) {
              this.synthUI.reverb = { enabled: Array(8).fill(false) };
            }
            
            // 从SynthPresetManager同步效果启用状态
            this.synthUI.delay.enabled[i] = window.synthPresetManager.presetDelayEnabled[i];
            this.synthUI.reverb.enabled[i] = window.synthPresetManager.presetReverbEnabled[i];
          } else {
            // 回退到合成器本地参数
            const params = this.synthParams[i];
            waveform = this.synthUI.selectedWaveforms[i];
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
            portamentoEnabled = this.synthUI.portamento.enabled[i];
            portamentoTime = params.portamento;
          }
          
          // 创建PingPongDelay效果，实现左右声道交替的延迟效果
          const delay = new Tone.PingPongDelay({
            delayTime: this.calculateDelayTime(delayParams.time),
            feedback: delayParams.feedback,
            wet: this.synthUI.delay.enabled[i] ? delayParams.mix : 0,
            maxDelay: 2 // 允许最大2秒的延迟，支持低BPM情况
          });
          
          // 保存delay效果
          this.delayEffects.push(delay);
          
          // 创建Reverb效果
          const reverb = new Tone.Reverb({
            decay: reverbParams.decay,
            wet: this.synthUI.reverb.enabled[i] ? reverbParams.mix : 0,
            preDelay: 0.01 // 预延迟，增加空间感
          });
          
          // 将reverb效果预先生成，避免生成时造成音频卡顿
          reverb.generate();
          
          // 保存reverb效果
          this.reverbEffects.push(reverb);
          
          // 创建MonoSynth代替基本的Synth，增加滤波器功能
          const synth = new Tone.MonoSynth({
            oscillator: {
              type: waveform
            },
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
              exponent: 2 // 非线性曲线，更自然的滤波器变化
            },
            portamento: portamentoEnabled ? portamentoTime : 0,
            volume: -10 // 默认音量
          }).connect(delay);
          
          // 设置连接链: synth -> delay -> reverb -> master
          delay.connect(reverb);
          reverb.connect(this.masterVolume);
          
          this.presetSounds.push(synth);
        }
        
        // 初始化Tone.js正常完成
        this.audioInitialized = true;

        
        // 设置Transport循环
        this.setupTransportLoop();
        
        // 播放一个测试音符确认音频工作
        this.playTestSound();
        
      } catch (e) {
        console.error("初始化Tone.js音频时出错:", e);
        // 错误处理：创建一个哑声音对象，避免后续代码错误
        this.createDummySounds();
      }
    }
    
    // 设置Transport循环，使用Tone.js的时间线系统
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
    
    // 创建哑声音对象，用于错误处理
    createDummySounds() {
      this.presetSounds = [];
      
      // 创建8个模拟的合成器对象
      for (let i = 0; i < 8; i++) {
        // 创建一个假的合成器对象
        const dummySynth = {
          // 空函数实现，避免调用时报错
          triggerAttackRelease: function() {},
          dispose: function() {}
        };
        
        this.presetSounds.push(dummySynth);
      }
      
      // 标记为已初始化
      this.audioInitialized = true;

    }
  
    // 设置BPM
    setBpm(bpm) {
      // 确保BPM在合理范围内
      bpm = Math.max(30, Math.min(300, bpm));
      
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
    
    // 设置分辨率，并更新Transport循环
    setResolution(resolution) {
      // 将旧格式转换为Tone.js的时间表示格式
      switch(resolution) {
        case "1/4":
          this.resolution = "4n"; // 四分音符
          this.subdivision = 4;
          break;
        case "1/8":
          this.resolution = "8n"; // 八分音符
          this.subdivision = 8;
          break;
        case "1/16":
          this.resolution = "16n"; // 十六分音符
          this.subdivision = 16;
          break;
        case "1/32":
          this.resolution = "32n"; // 三十二分音符
          this.subdivision = 32;
          break;
        default:
          this.resolution = "16n"; // 默认为十六分音符
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
    
    // 触发节拍事件，通知UI更新
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
    
    // 检查是否需要播放节拍音效，然后调度音符
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
              const baseNote = this.baseNotes[currentPresetIndex] || 'C4';
              
              // 检查是否需要滑音 - 仅当当前插槽的滑音开关启用时才考虑滑音
              let needsPortamento = false;
              let nextNoteFreq = null;
              
              // 修改：当当前插槽的滑音开关启用时，检查下一个音符是否紧接着当前音符（没有间隔）
              if (this.synthUI.portamento.enabled[currentPresetIndex]) {
                if (nextStepIndex !== 0 || this.currentBeat < ui.stepCount * 4 - 1) {  // 避免最后一个音符滑向第一个
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
                // 更新：正确计算持续时间，考虑当前分辨率
                const subdivisionDuration = 60 / this.bpm / (this.subdivision / 4);
                const noteDuration = subdivisionDuration * duration;
                
                // 获取合成器
                const synth = this.presetSounds[synthIndex];
                
                // 更新：确保音符在时值结束时强制释放，即使包络尚未完成
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
                  // 提前一点点恢复，确保设置已经生效
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
              const baseNote = this.baseNotes[presetIndex] || 'C4';
              
              // 检查是否需要滑音 - 仅当当前插槽的滑音开关启用时才考虑滑音
              let needsPortamento = false;
              let nextNoteFreq = null;
              
              // 修改：当当前插槽的滑音开关启用时，检查下一个音符是否紧接着当前音符（没有间隔）
              if (this.synthUI.portamento.enabled[presetIndex]) {
                if (nextStepIndex !== 0 || this.currentBeat < ui.stepCount * 4 - 1) {  // 避免最后一个音符滑向第一个
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
                // 更新：正确计算持续时间，考虑当前分辨率
                const subdivisionDuration = 60 / this.bpm / (this.subdivision / 4);
                const noteDuration = subdivisionDuration * duration;
                
                // 使用对应预设的Tone合成器
                const synth = this.presetSounds[presetIndex];
                
                // 更新：确保音符在时值结束时强制释放，即使包络尚未完成
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
    
    // 直接与Three.js场景同步
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
          for (let presetIndex = 0; presetIndex < 8; presetIndex++) {
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
              // 即使不在视野内，也需要激活小球确保音符播放
              window.syncBallWithStepper(
                beat,             // 当前拍子
                stepIndex,        // 当前步进
                presetIndex,      // 预设索引
                isActive          // 是否激活
              );
              
              // 如果音符是活跃的，确保直接激活小球
              if (isActive && typeof window.activateSphere === 'function') {
                // 直接调用激活函数，确保音符能播放
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
                
                // 调用Three.js场景中的同步函数（可能会覆盖之前的调用，但确保当前编辑的预设总是正确的）
                window.syncBallWithStepper(
                  beat,          // 当前拍子
                  stepIndex,     // 当前步进
                  presetIndex,   // 使用节点的预设索引
                  isActive       // 是否激活
                );
                
                // 如果音符是活跃的，直接激活小球
                if (isActive && typeof window.activateSphere === 'function') {
                  // 直接调用激活函数，确保音符能播放
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
    
    // 开始/停止节拍器
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
            document.body.addEventListener('click', unlockAudio, {once: true});
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
    
    // 使用备用定时器进行节奏控制
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
    
    // 兼容原有系统的beat方法，保留以支持现有代码
    beat() {
      // 使用新的Tone.Transport系统处理拍子，不需要在此计算时间
      // 这个方法仅用于兼容现有代码，实际不执行任何操作
      return;
    }
    
    // 新增一个测试声音函数
    playTestSound() {
      // 如果音频上下文未启动，等待用户交互
      if (typeof Tone === 'undefined' || Tone.context.state !== 'running') {

        return;
      }
      
      try {
        if (this.presetSounds && this.presetSounds.length > 0) {
          // 使用第一个合成器播放一个短暂的中音C

          
          // 循环播放所有预设的声音，确保用户能听到反馈
          for (let i = 0; i < Math.min(this.presetSounds.length, 2); i++) {
            // 设置一个较短的延迟，确保合成器已准备好
            setTimeout(() => {
              // 第一个合成器播放C4，第二个播放E4，形成和谐的音色
              const note = i === 0 ? "C4" : "E4";
              try {
                // 明确指定当前时间，确保立即播放
                this.presetSounds[i].triggerAttackRelease(note, 0.2, Tone.now() + i * 0.1);

              } catch (innerErr) {
                console.warn(`播放测试音符 ${note} 失败:`, innerErr);
              }
            }, 100 + i * 100);
          }
        } else {
          console.warn("找不到预设声音对象");
          
          // 如果找不到预设声音，尝试创建一个临时合成器进行测试
          try {
            const tempSynth = new Tone.Synth({
              oscillator: {
                type: 'sine'
              },
              envelope: {
                attack: 0.01,
                decay: 0.2,
                sustain: 0.5,
                release: 0.1
              }
            }).toDestination();
            
            // 短暂播放一个音符
            tempSynth.triggerAttackRelease("C4", 0.2, Tone.now());

            
            // 使用完毕后释放资源
            setTimeout(() => {
              tempSynth.dispose();
            }, 1000);
          } catch (synthErr) {
            console.error("创建临时合成器失败:", synthErr);
          }
        }
      } catch (e) {
        console.warn("播放测试音符失败:", e);
      }
    }

    // 用于计算时间的方法，兼容原有代码
    calculateInterval() {
      // 此方法不再使用，但保留以兼容现有代码
      return;
    }

    // 鼠标事件处理：拖拽ADSR节点
    handleSynthMousePressed(mx, my) {
      if (!this.synthUI.visible) return false;
      
      // 设置全局拖拽标志，防止在点击和拖拽过程中触发同步
      window.isDraggingInOverview = true;
      const currentSlot = this.synthUI.currentSlot;
      const params = this.synthParams[currentSlot];
      
      // 获取波形选择器位置信息，以便定位包络编辑器
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25; // 波形选择器高度改为25
      
      // 更新间距与drawSynthParameters保持一致
      const waveToEnvGap = 45; // 增加从30到45的间距
      
      // 包络线区域
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth;
      const envH = 90; // 保持不变
      
      // 最大时间
      const maxTimeWidth = 7; // 秒
      
      // 确定当前正在编辑的是哪种包络
      const isFilterEnv = this.synthUI.envelopePage === 1;
      
      // 获取当前参数，根据当前显示的页面选择
      let A, D, S, R;
      
      // 两种页面使用相同的坐标计算系统，只是使用不同的参数
      if (isFilterEnv) {
        A = params.filterAttack || 0.05;
        D = params.filterDecay || 0.3;
        S = params.filterSustain || 0.5;
        R = params.filterRelease || 0.5;
      } else {
        A = params.attack;
        D = params.decay;
        S = params.sustain;
        R = params.release;
      }
      
      // 固定的时间点
      const tA = A;
      const tD = tA + D;
      const tS = tD + 1; // S段固定1秒
      const tR = tS + R;
      
      // Y轴计算
      const y0 = envY + envH;
      const yMax = envY + 10; // 最高点（增加10px边距，避免节点超出框体）
      
      // 节点坐标 - 与drawSynthParameters中的计算完全一致
      const ptA = { 
        x: envX + (tA / maxTimeWidth) * envW, 
        y: yMax 
      };
      const ptD = { 
        x: envX + (tD / maxTimeWidth) * envW, 
        y: yMax + (y0 - yMax) * (1 - S) 
      };
      const ptS = { 
        x: envX + (tS / maxTimeWidth) * envW, 
        y: ptD.y 
      };
      const ptR = { 
        x: envX + (tR / maxTimeWidth) * envW, 
        y: y0 
      };
      
      // 检查是否点击节点 - 增加节点的点击区域半径，使其更容易点击
      const nodes = [
        ['A', ptA, 15], // 增加点击半径从12到15
        ['D', ptD, 15], // 增加点击半径从12到15
        ['S', ptS, 15], // 增加点击半径从12到15
        ['R', ptR, 15]  // 增加点击半径从12到15
      ];
      
      for (let [name, pt, hitRadius] of nodes) {
        if (dist(mx, my, pt.x, pt.y) <= hitRadius) {
          this.synthUI.adsrDrag.dragging = true;
          this.synthUI.adsrDrag.node = name;
          return true;
        }
      }
      
      // 检查是否点击底部的ADSR参数标签
      const labelY = envY + envH + 15; // 从20减小到15，与绘制部分一致
      const labelHeight2 = 35; // 从30增加到35，与绘制时一致
      
      // 参数标签坐标
      const labelX1 = envX + envW * 0.125; // Attack 标签位置
      const labelX2 = envX + envW * 0.375; // Decay 标签位置
      const labelX3 = envX + envW * 0.625; // Sustain 标签位置
      const labelX4 = envX + envW * 0.875; // Release 标签位置
      
      // 标签点击区域宽度
      const labelWidth = envW * 0.22; // 增加宽度比例，使其与新的标签宽度匹配
      
      // 检查是否点击各个参数标签
      if (my >= labelY - 10 && my <= labelY + labelHeight2) {
        // Attack 标签
        if (mx >= labelX1 - labelWidth/2 && mx <= labelX1 + labelWidth/2) {
          this.synthUI.adsrDrag.dragging = true;
          this.synthUI.adsrDrag.node = 'A_label';
          this.synthUI.adsrDrag.startY = my;
          
          // 根据当前页面保存不同的起始值
          if (isFilterEnv) {
            this.synthUI.adsrDrag.startValue = params.filterAttack;
          } else {
            this.synthUI.adsrDrag.startValue = params.attack;
          }
          return true;
        }
        
        // Decay 标签
        if (mx >= labelX2 - labelWidth/2 && mx <= labelX2 + labelWidth/2) {
          this.synthUI.adsrDrag.dragging = true;
          this.synthUI.adsrDrag.node = 'D_label';
          this.synthUI.adsrDrag.startY = my;
          
          // 根据当前页面保存不同的起始值
          if (isFilterEnv) {
            this.synthUI.adsrDrag.startValue = params.filterDecay;
          } else {
            this.synthUI.adsrDrag.startValue = params.decay;
          }
          return true;
        }
        
        // Sustain 标签
        if (mx >= labelX3 - labelWidth/2 && mx <= labelX3 + labelWidth/2) {
          this.synthUI.adsrDrag.dragging = true;
          this.synthUI.adsrDrag.node = 'S_label';
          this.synthUI.adsrDrag.startY = my;
          
          // 根据当前页面保存不同的起始值
          if (isFilterEnv) {
            this.synthUI.adsrDrag.startValue = params.filterSustain;
          } else {
            this.synthUI.adsrDrag.startValue = params.sustain;
          }
          return true;
        }
        
        // Release 标签
        if (mx >= labelX4 - labelWidth/2 && mx <= labelX4 + labelWidth/2) {
          this.synthUI.adsrDrag.dragging = true;
          this.synthUI.adsrDrag.node = 'R_label';
          this.synthUI.adsrDrag.startY = my;
          
          // 根据当前页面保存不同的起始值
          if (isFilterEnv) {
            this.synthUI.adsrDrag.startValue = params.filterRelease;
          } else {
            this.synthUI.adsrDrag.startValue = params.release;
          }
          return true;
        }
      }
      
      // 检查是否点击了包络线段
      // 这将使得用户不仅可以点击节点，还可以直接点击线段进行拖动
      if (mx >= envX && mx <= envX + envW && my >= envY && my <= envY + envH) {
        // A段 - 直线
        if (this.ptLine(mx, my, envX, y0, ptA.x, ptA.y, 10)) {
          this.synthUI.adsrDrag.dragging = true;
          this.synthUI.adsrDrag.node = 'A';
          return true;
        }
        // A-D段
        else if (this.ptLine(mx, my, ptA.x, ptA.y, ptD.x, ptD.y, 10)) {
          this.synthUI.adsrDrag.dragging = true;
          this.synthUI.adsrDrag.node = 'D';
          return true;
        }
        // D-S段
        else if (this.ptLine(mx, my, ptD.x, ptD.y, ptS.x, ptS.y, 10)) {
          this.synthUI.adsrDrag.dragging = true;
          this.synthUI.adsrDrag.node = 'S';
          return true;
        }
        // S-R段
        else if (this.ptLine(mx, my, ptS.x, ptS.y, ptR.x, ptR.y, 10)) {
          this.synthUI.adsrDrag.dragging = true;
          this.synthUI.adsrDrag.node = 'R';
          return true;
        }
      }
      
      // 新增：检查是否点击滤波器控件
      const handled = this.handleFilterControlsPressed(mx, my);
      if (handled) {
        return true;
      }
      
      // 新增：处理delay反馈滑块拖动
      if (this.synthUI.delay.hovering === 'feedback') {
        // 获取当前选中的插槽
        const currentSlot = this.synthUI.currentSlot;
        
        // 保存拖动起点
        this.synthUI.delay.dragStart = {
          x: mx,
          y: my,
          value: this.synthUI.delay.feedback[currentSlot]
        };
        
        return true;
      }
      
      // 新增：处理reverb控制点击和拖动
      if (this.synthUI.reverb.hovering) {
        const currentSlot = this.synthUI.currentSlot;
        
        if (this.synthUI.reverb.hovering === 'toggle') {
          // 切换开关状态
          this.synthUI.reverb.enabled[currentSlot] = !this.synthUI.reverb.enabled[currentSlot];
          
          // 更新reverb效果
          if (this.reverbEffects && this.reverbEffects[currentSlot] && this.audioInitialized) {
            this.reverbEffects[currentSlot].wet.value = this.synthUI.reverb.enabled[currentSlot] ? 
              this.synthParams[currentSlot].reverbWet : 0;
          }
          
          // 同步混响开关状态到SynthPresetManager
          if (window.synthPresetManager) {
            window.synthPresetManager.setReverbEnabled(currentSlot, this.synthUI.reverb.enabled[currentSlot]);

          }
          
          return true;
        } else if (this.synthUI.reverb.hovering === 'decay') {
          // 保存拖动起点
          this.synthUI.reverb.dragStart = {
            x: mx,
            y: my,
            value: this.synthUI.reverb.decay[currentSlot]
          };
          
          return true;
        } else if (this.synthUI.reverb.hovering === 'wet') {
          // 保存拖动起点
          this.synthUI.reverb.dragStart = {
            x: mx,
            y: my,
            value: this.synthUI.reverb.wet[currentSlot]
          };
          
          return true;
        }
      }
      
      return false;
    }
    
    // 新增：处理滤波器控件的点击事件
    handleFilterControlsPressed(mx, my) {
      // 设置全局拖拽标志，防止在拖拽过程中触发同步
      window.isDraggingInOverview = true;
      
      const currentSlot = this.synthUI.currentSlot;
      const params = this.synthParams[currentSlot];
      
      // 计算滤波器UI的位置
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25;
      const waveToEnvGap = 45;
      
      // 包络线区域
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth;
      const envH = 90;
      
      // 滤波器UI放置在ADSR参数标签下方
      const filterY = envY + envH + 60;
      const filterX = envX;
      const filterW = envW;
      const filterH = 120;
      
      // 检查是否在滤波器UI区域内
      if (mx < filterX - 10 || mx > filterX + filterW + 10 || 
          my < filterY - 10 || my > filterY + filterH + 10) {
        return false; // 不在滤波器UI区域内
      }
      
      // 控制区域占总宽度的25%
      const controlsWidth = filterW * 0.25;
      
      // 检查左侧面板 - 基本控制
      if (mx >= filterX && mx <= filterX + controlsWidth) {
        const width = controlsWidth;
        const height = filterH - 20;
        const y = filterY + 10;
        const x = filterX;
        
        // 平均分配四个区域的高度，与drawFilterBasicControls中保持一致
        const margin = 5; // 控件之间的边距
        const usableHeight = height - margin * 3; // 减去所有边距后的可用高度
        const sectionHeight = usableHeight / 4; // 每个控件的高度
        
        // 初始位置 - 均匀分布
        const freqY = y + sectionHeight * 0.5 + margin * 0;
        const resY = y + sectionHeight * 1.5 + margin * 1;
        const typeY = y + sectionHeight * 2.5 + margin * 2;
        const envY = y + sectionHeight * 3.5 + margin * 3;
        
        // 控件尺寸
        const controlWidth = width * 0.8;
        const controlX = x + width/2;
        const labelWidth = 70;
        
        // 高亮时标签更大，非高亮时更小
        const freqHeight = 32; // 点击区域统一使用较大尺寸以便于点击
        const resHeight = 32;
        const typeHeight = 32;
        const envHeight = 32;
        
        // 检查FREQ标签区域
        if (mx >= controlX - labelWidth/2 && mx <= controlX + labelWidth/2 &&
            my >= freqY - freqHeight/2 && my <= freqY + freqHeight/2) {
          this.synthUI.filter.dragging.active = true;
          this.synthUI.filter.dragging.control = "freq";
          this.synthUI.filter.dragging.startX = mx;
          this.synthUI.filter.dragging.startY = my;
          this.synthUI.filter.dragging.startValue = params.filterFreq;
          return true;
        }
        
        // 检查RES标签区域
        if (mx >= controlX - labelWidth/2 && mx <= controlX + labelWidth/2 &&
            my >= resY - resHeight/2 && my <= resY + resHeight/2) {
          this.synthUI.filter.dragging.active = true;
          this.synthUI.filter.dragging.control = "res";
          this.synthUI.filter.dragging.startX = mx;
          this.synthUI.filter.dragging.startY = my;
          this.synthUI.filter.dragging.startValue = params.filterQ;
          return true;
        }
        
        // 检查TYPE标签区域
        if (mx >= controlX - labelWidth/2 && mx <= controlX + labelWidth/2 &&
            my >= typeY - typeHeight/2 && my <= typeY + typeHeight/2) {
          // 切换滤波器类型
          const currentType = params.filterType;
          const filterTypes = this.synthUI.filter.types;
          
          // 查找当前类型的索引
          const currentIndex = filterTypes.indexOf(currentType);
          
          // 计算下一个类型的索引
          const nextIndex = (currentIndex + 1) % filterTypes.length;
          
          // 获取新的滤波器类型
          const newFilterType = filterTypes[nextIndex];
          
          // 设置类型过渡动画
          this.synthUI.transition.filterActive = true;
          this.synthUI.transition.filterStartTime = Date.now();
          
          // 保存当前的滤波器参数作为起始值
          this.synthUI.transition.filterStartParams = {
            filterFreq: params.filterFreq,
            filterQ: params.filterQ,
            filterType: currentType
          };
          
          // 保存目标滤波器参数
          this.synthUI.transition.filterEndParams = {
            filterFreq: params.filterFreq,
            filterQ: params.filterQ,
            filterType: newFilterType
          };
          
          // 创建当前参数的副本用于动画
          this.synthUI.transition.filterCurrentParams = { ...this.synthUI.transition.filterStartParams };
          
          // 设置新的滤波器类型
          params.filterType = newFilterType;
          
          // 更新当前插槽的类型选择
          this.synthUI.filter.selectedType[currentSlot] = params.filterType;
          
          // 如果有合成器，立即更新滤波器类型
          if (this.presetSounds && this.presetSounds[currentSlot]) {
            this.presetSounds[currentSlot].filter.type = params.filterType;
          }
          

          return true;
        }
        
        // 检查ENV标签区域
        if (mx >= controlX - labelWidth/2 && mx <= controlX + labelWidth/2 &&
            my >= envY - envHeight/2 && my <= envY + envHeight/2) {
          // 循环切换滤波器包络深度值: 0 -> 1 -> 2 -> 4 -> 6 -> 0
          const currentAmount = params.filterEnvAmount;
          const envAmounts = [0, 1, 2, 4, 6];
          
          // 找到当前值在数组中的索引
          let currentIndex = envAmounts.indexOf(currentAmount);
          if (currentIndex === -1) {
            // 如果当前值不在列表中，找最接近的
            for (let i = 0; i < envAmounts.length; i++) {
              if (envAmounts[i] > currentAmount) {
                currentIndex = i - 1;
                break;
              }
            }
            if (currentIndex === -1) currentIndex = envAmounts.length - 1;
          }
          
          // 计算下一个值的索引
          const nextIndex = (currentIndex + 1) % envAmounts.length;
          
          // 设置新的包络深度值
          params.filterEnvAmount = envAmounts[nextIndex];
          
          // 如果有合成器，立即更新滤波器包络深度
          if (this.presetSounds && this.presetSounds[currentSlot]) {
            this.presetSounds[currentSlot].filterEnvelope.octaves = params.filterEnvAmount;
          }
          

          return true;
        }
      }
      
      // 检查右侧曲线区域的点击
      const curveWidth = filterW * 0.75;
      const curveX = filterX + controlsWidth + 5;
      const curveY = filterY + 10;
      const curveHeight = filterH - 20;
      
      if (mx >= curveX && mx <= curveX + curveWidth - 10 && 
          my >= curveY && my <= curveY + curveHeight) {
        // 激活拖拽模式
        this.synthUI.filter.dragging.active = true;
        this.synthUI.filter.dragging.control = "curve";
        this.synthUI.filter.dragging.startX = mx;
        this.synthUI.filter.dragging.startY = my;
        // 保存初始频率值
        this.synthUI.filter.dragging.startValue = params.filterFreq;
        // 保存初始共振值，用于垂直拖动调整
        this.synthUI.filter.dragging.startQValue = params.filterQ;
        return true;
      }
      
      return false;
    }
    
    handleSynthMouseDragged(mx, my) {
      // 设置全局拖拽标志，防止在拖拽过程中触发同步
      window.isDraggingInOverview = true;
      window.isSynthDragging = true; // 添加合成器专用的拖拽标记

      // 检查是否正在拖动reverb滑块，这个条件应该放在最前面优先检查
      if (this.synthUI.reverb.dragStart) {
        // 获取当前选中的插槽
        const currentSlot = this.synthUI.currentSlot;
        
        // 计算水平拖动距离
        const deltaX = mx - this.synthUI.reverb.dragStart.x;
        
        if (this.synthUI.reverb.hovering === 'decay') {
          // decay滑块参数
          const decayWidth = 60; // 滑块宽度
          
          // 计算新的衰减时间值（0.1-10秒范围内）
          const dragScale = 9.9 / decayWidth; // 将拖动距离映射到0.1-10秒范围
          let newValue = this.synthUI.reverb.dragStart.value + deltaX * dragScale;
          newValue = Math.max(0.1, Math.min(10, newValue)); // 限制在0.1-10秒范围内
          
          // 更新reverb衰减时间值
          this.synthUI.reverb.decay[currentSlot] = newValue;
          // 更新合成器参数
          this.synthParams[currentSlot].reverbDecay = newValue;
          
          // 更新混响效果
          if (this.reverbEffects && this.reverbEffects[currentSlot] && this.audioInitialized) {
            this.reverbEffects[currentSlot].decay = newValue;
            // 重新生成混响冲激响应
            this.reverbEffects[currentSlot].generate();
            
            // 输出调试信息

          }
          
          return true;
        } else if (this.synthUI.reverb.hovering === 'wet') {
          // wet滑块参数
          const wetWidth = 60; // 滑块宽度
          
          // 计算新的湿度值（0-1范围内）
          const dragScale = 1 / wetWidth; // 将拖动距离映射到0-1范围
          let newValue = this.synthUI.reverb.dragStart.value + deltaX * dragScale;
          newValue = Math.max(0, Math.min(1, newValue)); // 限制在0-1范围内
          
          // 更新reverb湿度值
          this.synthUI.reverb.wet[currentSlot] = newValue;
          // 更新合成器参数
          this.synthParams[currentSlot].reverbWet = newValue;
          
          // 更新混响效果
          if (this.reverbEffects && this.reverbEffects[currentSlot] && this.audioInitialized) {
            this.reverbEffects[currentSlot].wet.value = newValue;
            
            // 输出调试信息

          }
          
          return true;
        }
      }

      // 检查是否正在拖动delay反馈滑块，这个条件应该放在最前面优先检查
      if (this.synthUI.delay.dragStart) {
        // 获取当前选中的插槽
        const currentSlot = this.synthUI.currentSlot;
        
        // 计算水平拖动距离
        const deltaX = mx - this.synthUI.delay.dragStart.x;
        
        // 反馈滑块参数
        const fbWidth = 80; // 反馈滑块宽度，与绘制时保持一致
        
        // 计算新的反馈值（0-1范围内）
        const dragScale = 1 / fbWidth; // 将拖动距离映射到0-1范围
        let newValue = this.synthUI.delay.dragStart.value + deltaX * dragScale;
        newValue = Math.max(0, Math.min(0.9, newValue)); // 限制在0-0.9范围内
        
        // 更新delay反馈值
        this.synthUI.delay.feedback[currentSlot] = newValue;
        
        // 更新delay效果
        if (this.delayEffects && this.delayEffects[currentSlot]) {
          this.delayEffects[currentSlot].feedback.value = newValue;
            
            // 输出调试信息

          }
          
          return true;
      }
      
      // 检查其他拖动操作的条件
      if (!this.synthUI.visible) return false;
      
      if (this.synthUI.filter.dragging.active) {
        return this.handleFilterControlsDragged(mx, my);
      }
      
      if (!this.synthUI.adsrDrag.dragging) return false;
      
      // 以下是ADSR拖拽处理
      const currentSlot = this.synthUI.currentSlot;
      const params = this.synthParams[currentSlot];
      
      // 获取波形选择器位置信息，以便定位包络编辑器
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25; // 波形选择器高度改为25
      
      // 更新间距与drawSynthParameters保持一致
      const waveToEnvGap = 45; // 增加从30到45的间距
      
      // 包络线区域
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth;
      const envH = 90; // 保持不变
      
      // 最大时间
      const maxTimeWidth = 7; // 秒
      
      // Y轴计算
      const y0 = envY + envH;
      const yMax = envY + 10; // 最高点（增加10px边距，避免节点超出框体）
      
      // 确定当前正在编辑的是哪种包络
      const isFilterEnv = this.synthUI.envelopePage === 1;
      
      // 拖拽逻辑 - 包络线上的节点
      if (this.synthUI.adsrDrag.node === 'A') {
        // 只能水平拖动A
        let t = ((mx - envX) / envW) * maxTimeWidth;
        t = constrain(t, 0.001, 2.0);
        
        // 根据当前页面更新不同的参数
        if (isFilterEnv) {
          params.filterAttack = t;
        } else {
          params.attack = t;
        }
        
      } else if (this.synthUI.adsrDrag.node === 'D') {
        // D节点可以水平和垂直拖动
        // 水平方向控制Decay时间
        let tA;
        if (isFilterEnv) {
          tA = params.filterAttack;
        } else {
          tA = params.attack;
        }
        
        let t = ((mx - envX) / envW) * maxTimeWidth - tA;
        t = constrain(t, 0.01, 2.0);
        
        // 垂直方向控制Sustain电平
        // 限制鼠标Y位置不能小于yMax（确保不超出编辑器顶部）
        let effectiveY = Math.max(my, yMax);
        let s = 1 - (effectiveY - yMax) / (y0 - yMax);
        s = constrain(s, 0.001, 1.0);
        
        // 根据当前页面更新不同的参数
        if (isFilterEnv) {
          params.filterDecay = t;
          params.filterSustain = s;
        } else {
          params.decay = t;
          params.sustain = s;
        }
        
      } else if (this.synthUI.adsrDrag.node === 'S') {
        // S只能垂直拖动
        // 限制鼠标Y位置不能小于yMax（确保不超出编辑器顶部）
        let effectiveY = Math.max(my, yMax);
        let s = 1 - (effectiveY - yMax) / (y0 - yMax);
        s = constrain(s, 0.001, 1.0);
        
        // 根据当前页面更新不同的参数
        if (isFilterEnv) {
          params.filterSustain = s;
        } else {
          params.sustain = s;
        }
        
      } else if (this.synthUI.adsrDrag.node === 'R') {
        // R只能水平拖动
        let tA, tD, tS;
        if (isFilterEnv) {
          tA = params.filterAttack;
          tD = tA + params.filterDecay;
        } else {
          tA = params.attack;
          tD = tA + params.decay;
        }
        tS = tD + 1; // S段固定1秒
        
        let t = ((mx - envX) / envW) * maxTimeWidth - tS;
        t = constrain(t, 0.01, 2.0);
        
        // 根据当前页面更新不同的参数
        if (isFilterEnv) {
          params.filterRelease = t;
        } else {
          params.release = t;
        }
      }
      // 拖拽逻辑 - 底部参数标签
      else if (this.synthUI.adsrDrag.node === 'A_label') {
        // 上下拖动调整Attack (现在向上增大，向下减小)
        const deltaY = this.synthUI.adsrDrag.startY - my;
        // 将拖动距离映射为参数变化，向上拖动增大值，向下拖动减小值
        // 每像素变化约0.01秒，但缩放系数可以调整
        const scale = 0.01;
        const newValue = this.synthUI.adsrDrag.startValue + deltaY * scale; // 改变符号，使向上拖动增大
        
        // 根据当前页面更新不同的参数
        if (isFilterEnv) {
          params.filterAttack = constrain(newValue, 0.001, 2.0);
        } else {
          params.attack = constrain(newValue, 0.001, 2.0);
        }
      }
      else if (this.synthUI.adsrDrag.node === 'D_label') {
        // 上下拖动调整Decay
        const deltaY = this.synthUI.adsrDrag.startY - my;
        const scale = 0.01;
        const newValue = this.synthUI.adsrDrag.startValue + deltaY * scale; // 改变符号，使向上拖动增大
        
        // 根据当前页面更新不同的参数
        if (isFilterEnv) {
          params.filterDecay = constrain(newValue, 0.01, 2.0);
        } else {
          params.decay = constrain(newValue, 0.01, 2.0);
        }
      }
      else if (this.synthUI.adsrDrag.node === 'S_label') {
        // 上下拖动调整Sustain (0-1范围值)
        const deltaY = this.synthUI.adsrDrag.startY - my;
        // 每像素变化0.005，向上增大
        const scale = 0.005;
        const newValue = this.synthUI.adsrDrag.startValue + deltaY * scale; // 改变符号，使向上拖动增大
        
        // 根据当前页面更新不同的参数
        if (isFilterEnv) {
          params.filterSustain = constrain(newValue, 0.001, 1.0);
        } else {
          params.sustain = constrain(newValue, 0.001, 1.0);
        }
      }
      else if (this.synthUI.adsrDrag.node === 'R_label') {
        // 上下拖动调整Release
        const deltaY = this.synthUI.adsrDrag.startY - my;
        const scale = 0.01;
        const newValue = this.synthUI.adsrDrag.startValue + deltaY * scale; // 改变符号，使向上拖动增大
        
        // 根据当前页面更新不同的参数
        if (isFilterEnv) {
          params.filterRelease = constrain(newValue, 0.01, 2.0);
        } else {
          params.release = constrain(newValue, 0.01, 2.0);
        }
      }
      
      // 更新SynthPresetManager中的参数
      if (window.synthPresetManager) {
        if (isFilterEnv) {
          // 更新滤波器包络参数
          window.synthPresetManager.presetFilterParams[currentSlot].envAmount = params.filterEnvAmount;
          
          // 滤波器包络参数需要单独存储
          const filterEnvParams = {
            filterAttack: params.filterAttack,
            filterDecay: params.filterDecay,
            filterSustain: params.filterSustain,
            filterRelease: params.filterRelease
          };
          
          // 将滤波器包络参数添加到包络参数中
          Object.assign(window.synthPresetManager.presetEnvelopeParams[currentSlot], filterEnvParams);
        } else {
          // 更新放大器包络
          window.synthPresetManager.setEnvelopeParams(currentSlot, {
            attack: params.attack,
            decay: params.decay,
            sustain: params.sustain,
            release: params.release
          });
        }
      }
      
      // 实时同步到合成器
      if (this.presetSounds && this.presetSounds[currentSlot]) {
        // 创建要更新的参数对象
        const updateParams = {};
        
        // 根据当前页面添加不同的参数
        if (isFilterEnv) {
          // 更新滤波器包络
          updateParams.filterEnvelope = {
            attack: params.filterAttack,
            decay: params.filterDecay,
            sustain: params.filterSustain,
            release: params.filterRelease,
            baseFrequency: params.filterFreq,
            octaves: params.filterEnvAmount  // 添加包络深度参数更新
          };
        } else {
          // 更新放大器包络
          updateParams.envelope = {
            attack: params.attack,
            decay: params.decay,
            sustain: params.sustain,
            release: params.release
          };
        }
        
        // 设置合成器参数
        this.presetSounds[currentSlot].set(updateParams);
      }
      
      return true;
    }
    
    // 新增：处理滤波器控件的拖动事件
    handleFilterControlsDragged(mx, my) {
      // 设置全局拖拽标志，防止在拖拽过程中触发同步
      window.isDraggingInOverview = true;
      
      const currentSlot = this.synthUI.currentSlot;
      const params = this.synthParams[currentSlot];
      
      // 获取当前拖动控件类型
      const control = this.synthUI.filter.dragging.control;
      
      if (control === "freq") {
        // 频率标签拖动处理
        // 使用垂直拖动来调整频率值
        const deltaY = this.synthUI.filter.dragging.startY - my;
        
        // 将垂直距离映射到对数刻度的频率变化
        // 频率范围: 20Hz - 20kHz
        const startFreq = this.synthUI.filter.dragging.startValue;
        
        // 使用对数映射使调整更自然
        // 上移增加，下移减少
        // 每100像素增加/减少1个八度
        const octaveChange = deltaY / 100;
        const newFreq = startFreq * Math.pow(2, octaveChange);
        
        // 限制在有效范围内
        params.filterFreq = constrain(newFreq, this.synthUI.filter.freqRangeMin, this.synthUI.filter.freqRangeMax);
        
      } else if (control === "res") {
        // 共振标签拖动处理
        // 使用垂直拖动来调整共振值
        const deltaY = this.synthUI.filter.dragging.startY - my;
        
        // 将垂直距离映射到共振范围
        // 共振范围: 0.1 - 20
        const startQ = this.synthUI.filter.dragging.startValue;
        
        // 使用非线性映射使调整更自然
        // 较小值区域需要细微调整，较大值区域可以大幅度调整
        // 缩放比例: 小值区域较小，大值区域较大
        // 注意：scale值为正，使向上拖动增大Q值
        let scale = 0.02;
        if (startQ > 5) scale = 0.1;
        else if (startQ > 1) scale = 0.05;
        
        // 确保向上拖动增大Q值，向下拖动减小Q值
        // deltaY为正表示向上拖动，为负表示向下拖动
        const newQ = startQ + deltaY * scale;
        
        // 限制共振在合理范围内
        params.filterQ = constrain(newQ, 0.1, 20);
      } else if (control === "curve") {
        // 曲线区域拖拽处理 - 计算UI位置与handleFilterControlsPressed中保持一致
        const buttonWidth = 30;
        const spacing = 5;
        const totalWidth = 8 * buttonWidth + 7 * spacing;
        const waveformStartX = ui.centerX - totalWidth / 2;
        const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
        const waveformHeight = 25;
        const waveToEnvGap = 45;
        
        // 包络线区域
        const envX = waveformStartX;
        const envY = waveformStartY + waveformHeight + waveToEnvGap;
        const envW = totalWidth;
        const envH = 90;
        
        // 滤波器UI放置在ADSR参数标签下方
        const filterY = envY + envH + 60;
        const filterX = envX;
        const filterW = envW;
        const filterH = 120;
        
        // 控制区域占总宽度的25%
        const controlsWidth = filterW * 0.25;
        
        // 曲线区域
        const curveWidth = filterW * 0.75;
        const curveX = filterX + controlsWidth + 5;
        const curveY = filterY + 10; // 曲线区域Y起点
        const curveHeight = filterH - 20; // 曲线区域高度
        
        // 水平拖动调整频率
        // 限制mx在曲线区域内
        const effectiveX = constrain(mx, curveX, curveX + curveWidth - 10);
        const normX = (effectiveX - curveX) / (curveWidth - 10);
        
        // 使用对数映射转换为频率
        const newFreq = Math.pow(10, 
          Math.log10(this.synthUI.filter.freqRangeMin) + 
          normX * (Math.log10(this.synthUI.filter.freqRangeMax) - Math.log10(this.synthUI.filter.freqRangeMin))
        );
        
        // 更新频率参数
        params.filterFreq = constrain(newFreq, this.synthUI.filter.freqRangeMin, this.synthUI.filter.freqRangeMax);
        
        // 修改：垂直拖动调整共振（RES）值
        // 上下拖动小球而非曲线
        
        // 限制my在曲线区域内
        const effectiveY = constrain(my, curveY, curveY + curveHeight);
        
        // 计算相对于曲线中点的位置
        // 在中心位置时保持初始Q值，向上拖动增加Q值，向下拖动减小Q值
        // 使小球能从中心位置上下移动
        const centerY = curveY + curveHeight/2;
        const distanceFromCenter = centerY - effectiveY; // 正值表示在中心上方，负值表示在中心下方
        
        // 获取初始共振值
        const startQ = this.synthUI.filter.dragging.startQValue || 1.0;
        
        // 垂直位置映射为Q值的指数变化
        // 使用非线性映射，要比原来的更加敏感，让小球能跟随鼠标移动
        const scaleFactor = 0.05; // 增加敏感度
        let newQ;
        
        if (distanceFromCenter > 0) {
          // 向上拖动，增加Q值（指数增长）
          newQ = startQ * Math.exp(distanceFromCenter * scaleFactor);
        } else {
          // 向下拖动，减小Q值（指数衰减）
          newQ = startQ * Math.exp(distanceFromCenter * scaleFactor);
        }
        
        // 限制共振在合理范围内
        params.filterQ = constrain(newQ, 0.1, 20);
      }
      
      // 实时更新合成器参数
      if (this.presetSounds && this.presetSounds[currentSlot]) {
        // 创建更新对象
        const updateParams = {
          filter: {
            frequency: params.filterFreq,
            Q: params.filterQ
          }
        };
        
        // 同时更新滤波器包络的基础频率，确保频率控制正常工作
        if (this.presetSounds[currentSlot].filterEnvelope) {
          updateParams.filterEnvelope = {
            baseFrequency: params.filterFreq
          };
        }
        
        // 立即应用更新
        this.presetSounds[currentSlot].set(updateParams);
            
            // 输出调试信息

          }
          
          return true;
        }
    
    handleSynthMouseReleased() {
      const currentSlot = this.synthUI.currentSlot;
      const params = this.synthParams[currentSlot];
      
      // 在鼠标释放前，标记此时还在拖拽过程中，防止过早同步
      window.isDraggingInOverview = true;
      
      // 获取当前拖拽状态，如果不是在拖拽状态，直接返回
      const wasDragging = window.isSynthDragging === true;
      
      try {
        // 重置ADSR拖拽状态
        if (this.synthUI.adsrDrag.dragging) {
          // 在释放鼠标时更新SynthPresetManager
          if (window.synthPresetManager) {
            // 检查是哪个页面的ADSR参数
            if (this.synthUI.envelopePage === 0) {
              // 放大器包络
              window.synthPresetManager.setEnvelopeParams(currentSlot, {
                attack: params.attack,
                decay: params.decay,
                sustain: params.sustain,
                release: params.release
              });
            } else {
              // 滤波器包络 - 将参数添加到包络参数中
              const filterEnvParams = {
                filterAttack: params.filterAttack,
                filterDecay: params.filterDecay,
                filterSustain: params.filterSustain,
                filterRelease: params.filterRelease
              };
              Object.assign(window.synthPresetManager.presetEnvelopeParams[currentSlot], filterEnvParams);
              
              // 为滤波器包络参数添加触发事件
              if (window.synthPresetManager.dispatchSynthParamsChanged) {
                window.synthPresetManager.dispatchSynthParamsChanged(currentSlot, {
                  filter: window.synthPresetManager.presetFilterParams[currentSlot],
                  envelope: window.synthPresetManager.presetEnvelopeParams[currentSlot]
                });
              }
            }
          }
          
          this.synthUI.adsrDrag.dragging = false;
          this.synthUI.adsrDrag.node = null;
        }
        
        // 重置滤波器拖拽状态
        if (this.synthUI.filter.dragging.active) {
          // 在释放鼠标时更新SynthPresetManager
          if (window.synthPresetManager) {
            window.synthPresetManager.setFilterParams(currentSlot, {
              type: params.filterType,
              frequency: params.filterFreq,
              Q: params.filterQ,
              envAmount: params.filterEnvAmount
            });
          }
          
          this.synthUI.filter.dragging.active = false;
          this.synthUI.filter.dragging.control = null;
        }
        
        // 重置delay反馈滑块拖动状态
        if (this.synthUI.delay.dragStart) {
          // 获取当前选中的插槽和最终设置的值
          const finalValue = this.synthUI.delay.feedback[currentSlot];
          
          // 更新SynthPresetManager中的delay参数
          if (window.synthPresetManager) {
            window.synthPresetManager.setDelayParams(currentSlot, {
              time: params.delayTime,
              feedback: finalValue,
              mix: params.delayWet
            });
          }
          
          // 记录日志确认最终值
          if (this.delayEffects && this.delayEffects[currentSlot]) {

          }
          
          // 清除拖动状态
          this.synthUI.delay.dragStart = null;
        }
        
        // 重置reverb拖动状态
        if (this.synthUI.reverb.dragStart) {
          // 获取最终设置的值
          const finalDecayValue = this.synthUI.reverb.decay[currentSlot];
          const finalWetValue = this.synthUI.reverb.wet[currentSlot];
          
          // 更新SynthPresetManager中的reverb参数
          if (window.synthPresetManager) {
            window.synthPresetManager.setReverbParams(currentSlot, {
              decay: finalDecayValue,
              preDelay: 0.01, // 固定值
              mix: finalWetValue
            });
          }
          
          // 记录日志确认最终值
          if (this.reverbEffects && this.reverbEffects[currentSlot]) {


          }
          
          // 清除拖动状态
          this.synthUI.reverb.dragStart = null;
        }
        
        // 重置portamento拖动状态
        if (this.synthUI.portamento.dragStart) {
          // 获取最终设置的值
          const finalTimeValue = this.synthUI.portamento.time[currentSlot];
          
          // 更新SynthPresetManager中的portamento参数
          if (window.synthPresetManager) {
            window.synthPresetManager.setPortamentoTime(currentSlot, finalTimeValue);
          }
          
          // 记录日志确认最终值

          
          // 清除拖动状态
          this.synthUI.portamento.dragStart = null;
        }
        
        // 只有在实际进行了拖拽操作后，才触发参数同步
        if (wasDragging && window.synthPresetManager && window.synthPresetManager.dispatchSynthParamsChanged) {
          // 延迟一帧再触发同步
          setTimeout(() => {
            // 确保是在当前插槽控制范围内才触发同步
            if (window.presetManager && window.presetManager.canEditSlot && 
                window.presetManager.canEditSlot(currentSlot)) {
              // 全局综合触发一次参数变化事件，包含所有参数
              // 同时确保isSynthDragging已经重置为false
              window.isSynthDragging = false;
              
              // 执行同步操作
              window.synthPresetManager.dispatchSynthParamsChanged(currentSlot);
              console.log(`合成器参数已同步到服务器，插槽: ${currentSlot + 1}`);

              // 如果还有更直接的同步函数，也调用它
              if (window.syncAllSynthParamsToServer && typeof window.syncAllSynthParamsToServer === 'function') {
                window.syncAllSynthParamsToServer();
              }
              
              // 触发全量合成器参数变化事件
              window.dispatchEvent(new CustomEvent('synth-all-params-changed', {
                detail: { slotIndex: currentSlot }
              }));
            }
          }, 10);
        }
      } finally {
        // 重置合成器拖拽状态
        window.isSynthDragging = false;
        
        // 无论如何，确保在操作完成后重置拖拽标志
        setTimeout(() => {
          window.isDraggingInOverview = false;

        }, 50); // 给一点缓冲时间确保参数同步完成
      }
    }
    
    // 新增：绘制滤波器控制界面
    drawFilterUI() {
      push();
      const currentSlot = this.synthUI.currentSlot;
      
      // 获取当前插槽的主题色
      const slotColor = color(this.synthUI.slotColors[currentSlot]);
      
      // 获取当前合成器的滤波器参数
      const params = this.synthParams[currentSlot];
      
      // 计算滤波器UI的位置
      // 获取包络编辑器的位置信息，以便放置滤波器UI
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25;
      const waveToEnvGap = 45;
      
      // 包络线区域
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth;
      const envH = 90;
      
      // 滤波器UI放置在ADSR参数标签下方
      const filterY = envY + envH + 60; // 留出足够空间给ADSR参数标签
      const filterX = envX;
      const filterW = envW;
      const filterH = 120; // 减小滤波器UI的总高度
      
      // 背景框
      fill(20, 180);
      stroke(40, 180);
      strokeWeight(1);
      rect(filterX - 10, filterY - 10, filterW + 20, filterH + 20, 5);
      
      // 重新调整布局 - 曲线图占据主要空间，控制区更小
      // 曲线区域占据总宽度的75%
      const curveWidth = filterW * 0.75;
      const controlsWidth = filterW - curveWidth;
      
      // 分隔线位置调整
      stroke(60, 120);
      strokeWeight(1);
      line(filterX + controlsWidth, filterY + 10, filterX + controlsWidth, filterY + filterH - 10);
      
      // 绘制左侧面板 - 控制区（频率和共振）- 现在是较小区域
      this.drawFilterBasicControls(filterX, filterY + 10, controlsWidth, filterH - 20);
      
      // 绘制右侧面板 - 曲线区域 - 现在占据更大空间
      this.drawFilterResponseCurve(filterX + controlsWidth + 5, filterY + 10, curveWidth - 10, filterH - 20);
      
      pop();
    }
    
    // 新增：绘制滤波器基本控制（频率和共振）
    drawFilterBasicControls(x, y, width, height) {
      push();
      const currentSlot = this.synthUI.currentSlot;
      const params = this.synthParams[currentSlot];
      const slotColor = color(this.synthUI.slotColors[currentSlot]);
      
      // 重新调整布局 - 将左侧面板平均划分为四个部分
      // 1. 顶部区域: FREQ控件 (占25%)
      // 2. 第二区域: RES控件 (占25%)
      // 3. 第三区域: 滤波器类型选择器 (占25%)
      // 4. 底部区域: 滤波器包络深度控制 (占25%)
      
      // 平均分配四个区域的高度，但增加边距以避免重叠
      const margin = 5; // 控件之间的边距
      const usableHeight = height - margin * 3; // 减去所有边距后的可用高度
      const sectionHeight = usableHeight / 4; // 每个控件的高度
      
      // 高亮的控件ID（用于动态调整位置）
      const highlightedControl = this.synthUI.filter.hoveredControl;
      
      // 计算各控件的Y坐标，考虑当前悬停状态
      // 当某个控件高亮时，其他控件会稍微挪开位置
      let freqY, resY, typeY, envY;
      
      // 初始位置 - 均匀分布
      freqY = y + sectionHeight * 0.5 + margin * 0;
      resY = y + sectionHeight * 1.5 + margin * 1;
      typeY = y + sectionHeight * 2.5 + margin * 2;
      envY = y + sectionHeight * 3.5 + margin * 3;
      
      // 根据悬停状态调整位置
      if (highlightedControl === "freq") {
        // FREQ高亮，下面的控件都稍微下移
        resY += 5;
        typeY += 5;
        envY += 5;
      } else if (highlightedControl === "res") {
        // RES高亮，上面的控件上移，下面的控件下移
        freqY -= 5;
        typeY += 5;
        envY += 5;
      } else if (highlightedControl === "type") {
        // TYPE高亮，上面的控件上移，下面的控件下移
        freqY -= 5;
        resY -= 5;
        envY += 5;
      } else if (highlightedControl === "env") {
        // ENV高亮，上面的控件都稍微上移
        freqY -= 5;
        resY -= 5;
        typeY -= 5;
      }
      
      // 控件的通用宽度和水平位置
      const controlWidth = width * 0.8;
      const controlX = x + width/2;
      
      // 绘制FREQ标签和数值 - 调整后的位置
      this.drawFilterParamLabel(
        controlX, freqY, 
        "FREQ", 
        this.freqToString(params.filterFreq),
        highlightedControl === "freq",
        slotColor
      );
      
      // 绘制RES标签和数值 - 调整后的位置
      this.drawFilterParamLabel(
        controlX, resY, 
        "RES",
        `${Math.round(params.filterQ * 10) / 10}`,
        highlightedControl === "res",
        slotColor
      );
      
      // 绘制滤波器类型控制 - 调整后的位置
      this.drawFilterParamLabel(
        controlX, typeY,
        "TYPE",
        params.filterType.toUpperCase(),
        highlightedControl === "type",
        slotColor
      );
      
      // 绘制包络深度控制 - 调整后的位置
      this.drawFilterParamLabel(
        controlX, envY,
        "ENV",
        `${params.filterEnvAmount} OCT`,
        highlightedControl === "env",
        slotColor
      );
      
      pop();
    }
    
    // 新增：绘制滤波器响应曲线
    drawFilterResponseCurve(x, y, width, height) {
      push();
      const currentSlot = this.synthUI.currentSlot;
      const params = this.synthParams[currentSlot];
      const slotColor = color(this.synthUI.slotColors[currentSlot]);
      
      // 判断是否正在进行滤波器类型过渡动画
      const isFilterTransitioning = this.synthUI.transition.filterActive;
      
      // 确定当前要显示的滤波器参数（可能是过渡中的插值参数）
      let filterFreq = params.filterFreq;
      let filterQ = params.filterQ;
      let filterType = params.filterType;
      
      // 如果正在过渡，计算插值参数
      if (isFilterTransitioning) {
        const now = Date.now();
        const elapsed = now - this.synthUI.transition.filterStartTime;
        const duration = 300; // 过渡动画持续300毫秒
        
        // 计算过渡进度，使用缓动函数
        let t = Math.min(1.0, elapsed / duration);
        
        // 使用平滑的缓动函数（例如，ease-in-out）
        t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        
        // 如果动画已完成，关闭过渡状态
        if (elapsed >= duration) {
          this.synthUI.transition.filterActive = false;
        } else {
          // 当过渡进行中时，使用起始和目标参数的线性插值
          const startParams = this.synthUI.transition.filterStartParams;
          const endParams = this.synthUI.transition.filterEndParams;
          
          // 对频率和Q值进行插值
          filterFreq = startParams.filterFreq * (1-t) + endParams.filterFreq * t;
          filterQ = startParams.filterQ * (1-t) + endParams.filterQ * t;
          
          // 对于类型，我们需要混合两种滤波器响应而不是简单插值
          // 我们将保留两种类型的信息，稍后在绘制曲线时使用
        }
      }
      
      // 曲线区域直接使用整个空间
      const curveY = y;
      const curveHeight = height;
      
      // 绘制曲线背景和网格
      fill(10, 180);
      stroke(60, 100);
      strokeWeight(1);
      rect(x, curveY, width, curveHeight, 3);
      
      // 绘制网格线
      stroke(60, 80);
      strokeWeight(0.5);
      
      // 水平网格线
      for (let i = 1; i < 4; i++) {
        line(x, curveY + curveHeight * i/4, x + width, curveY + curveHeight * i/4);
      }
      
      // 垂直网格线 - 对数刻度的频率线
      const freqPoints = [100, 1000, 10000];
      for (let freq of freqPoints) {
        const normX = (Math.log10(freq) - Math.log10(this.synthUI.filter.freqRangeMin)) / (Math.log10(this.synthUI.filter.freqRangeMax) - Math.log10(this.synthUI.filter.freqRangeMin));
        line(x + width * normX, curveY, x + width * normX, curveY + curveHeight);
      }
      
      // 计算并绘制滤波器响应曲线
      const resolution = 100; // 提高曲线分辨率
      
      stroke(red(slotColor), green(slotColor), blue(slotColor), 220);
      strokeWeight(2);
      noFill();
      beginShape();
      
      // 如果在过渡中，需要绘制两条曲线并混合它们
      if (isFilterTransitioning && this.synthUI.transition.filterActive) {
        const now = Date.now();
        const elapsed = now - this.synthUI.transition.filterStartTime;
        const duration = 300; // 与上面保持一致
        let t = Math.min(1.0, elapsed / duration);
        t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        
        const startParams = this.synthUI.transition.filterStartParams;
        const endParams = this.synthUI.transition.filterEndParams;
        
        // 直接绘制混合曲线
        for (let i = 0; i <= resolution; i++) {
          // 使用对数刻度计算频率
          const tFreq = i / resolution;
          const freq = Math.pow(10, Math.log10(this.synthUI.filter.freqRangeMin) + tFreq * (Math.log10(this.synthUI.filter.freqRangeMax) - Math.log10(this.synthUI.filter.freqRangeMin)));
          
          // 计算起始滤波器类型的响应
          const startResponse = this.calculateFilterResponse(freq, startParams.filterFreq, startParams.filterQ, startParams.filterType);
          
          // 计算目标滤波器类型的响应
          const endResponse = this.calculateFilterResponse(freq, endParams.filterFreq, endParams.filterQ, endParams.filterType);
          
          // 混合两种响应
          const response = startResponse * (1-t) + endResponse * t;
          
          // 将垂直响应缩小为原来的一半
          const scaledResponse = response * 0.5;
          
          // 映射到图形坐标
          const px = x + width * tFreq;
          const py = curveY + curveHeight * (1 - scaledResponse);
          
          vertex(px, py);
        }
      } else {
        // 正常绘制单一曲线（非过渡状态）
        for (let i = 0; i <= resolution; i++) {
          // 使用对数刻度计算频率
          const t = i / resolution;
          const freq = Math.pow(10, Math.log10(this.synthUI.filter.freqRangeMin) + t * (Math.log10(this.synthUI.filter.freqRangeMax) - Math.log10(this.synthUI.filter.freqRangeMin)));
          
          // 计算响应值
          const response = this.calculateFilterResponse(freq, filterFreq, filterQ, filterType);
          
          // 将垂直响应缩小为原来的一半
          const scaledResponse = response * 0.5;
          
          // 映射到图形坐标
          const px = x + width * t;
          const py = curveY + curveHeight * (1 - scaledResponse);
          
          vertex(px, py);
        }
      }
      
      endShape();
      
      // 计算滤波器截止频率的X坐标
      const cutoffX = x + width * ((Math.log10(filterFreq) - Math.log10(this.synthUI.filter.freqRangeMin)) / (Math.log10(this.synthUI.filter.freqRangeMax) - Math.log10(this.synthUI.filter.freqRangeMin)));
      
      // 删除截止频率竖线
      
      // 计算小球的Y位置：基于共振值Q
      // 使用对数映射，将Q值范围[0.1, 20]映射到曲线高度
      // 较高的Q值使小球位置更高
      const qNormalized = (Math.log(filterQ) - Math.log(0.1)) / (Math.log(20) - Math.log(0.1));
      // 在曲线区域的10%-90%之间映射，避免太靠近边缘
      const ballY = curveY + curveHeight * (1 - qNormalized * 0.8 - 0.1);
      
      // 检查鼠标是否悬浮在小球上
      const isHoveringBall = this.synthUI.filter.hoveredControl === "curve" || 
                              dist(mouseX, mouseY, cutoffX, ballY) < 12;
      
      // 添加截止频率圆形指示器，使用插槽的主题色
      if (isHoveringBall) {
        // 悬浮状态 - 添加白色描边
        stroke(255, 230);
        strokeWeight(2);
        fill(red(slotColor), green(slotColor), blue(slotColor), 220);
        ellipse(cutoffX, ballY, 16, 16);
      } else {
        // 非悬浮状态 - 无描边
        noStroke();
        fill(red(slotColor), green(slotColor), blue(slotColor), 220);
        ellipse(cutoffX, ballY, 16, 16);
      }
      
      // 频率值显示
      fill(255);
      textSize(11); // 从12改为11，与包络编辑器底部标签保持一致
      textAlign(CENTER, BOTTOM);
      noStroke(); // 确保文本没有描边
      text(this.freqToString(filterFreq), x + width/2, curveY + curveHeight - 5);
      
      pop();
    }
    
    // 新增：绘制滤波器参数标签（类似ADSR标签）
    drawFilterParamLabel(x, y, name, value, isHighlighted, slotColor) {
      push();
      
      // 标签区域尺寸 - 减小高度以避免重叠
      const labelWidth = 70;
      const labelHeight = isHighlighted ? 32 : 28; // 高亮时稍大，非高亮时更小
      
      // 根据高亮状态设置不同的样式
      if (isHighlighted) {
        // 高亮背景 - 更亮、更明显
        fill(60, 200); // 更不透明的背景
        strokeWeight(1.5);
        stroke(red(slotColor), green(slotColor), blue(slotColor), 180); // 使用主题色描边
        rect(x - labelWidth/2, y - labelHeight/2, labelWidth, labelHeight, 4);
        
        // 添加上下箭头指示 - 移到靠近边缘的位置
        stroke(red(slotColor), green(slotColor), blue(slotColor), 220); // 更亮的箭头，使用主题色
        strokeWeight(1.5); // 更粗的箭头
        // 上箭头 - 贴近顶部
        line(x, y - labelHeight/2 + 4, x - 3, y - labelHeight/2 + 7);
        line(x, y - labelHeight/2 + 4, x + 3, y - labelHeight/2 + 7);
        // 下箭头 - 贴近底部
        line(x, y + labelHeight/2 - 4, x - 3, y + labelHeight/2 - 7);
        line(x, y + labelHeight/2 - 4, x + 3, y + labelHeight/2 - 7);
        
        // 高亮文本 - 文本位置更加紧凑
        fill(red(slotColor), green(slotColor), blue(slotColor), 255); // 使用主题色
        noStroke();
        textSize(11);
        textAlign(CENTER, CENTER);
        text(name, x, y - 6); // 调整位置，更靠近顶部
        
        // 为TYPE类型处理过渡动画
        if (name === "TYPE" && this.synthUI.transition.filterActive) {
          // 获取过渡进度
          const now = Date.now();
          const elapsed = now - this.synthUI.transition.filterStartTime;
          const duration = 300;
          let t = Math.min(1.0, elapsed / duration);
          t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          
          // 获取起始和目标类型
          const startType = this.synthUI.transition.filterStartParams.filterType;
          const endType = this.synthUI.transition.filterEndParams.filterType;
          
          // 绘制过渡中的类型文本
          fill(red(slotColor), green(slotColor), blue(slotColor), 230 * (1-t)); // 当前值逐渐淡出
          textSize(11);
          text(startType.toUpperCase(), x, y + 6); // 调整位置，更靠近底部
          
          fill(red(slotColor), green(slotColor), blue(slotColor), 230 * t); // 新值逐渐淡入
          textSize(11);
          text(endType.toUpperCase(), x, y + 6); // 调整位置，更靠近底部
        } else {
          // 正常显示参数值
          fill(red(slotColor), green(slotColor), blue(slotColor), 230); // 使用亮一点的主题色
          textSize(11);
          text(value, x, y + 6); // 调整位置，更靠近底部
        }
      } else {
        // 普通文本 - 非高亮时更加紧凑
        // 使用半透明背景使控件更容易区分
        fill(30, 120);
        noStroke();
        rect(x - labelWidth/2, y - labelHeight/2, labelWidth, labelHeight, 3);
        
        // 标签
        fill(red(slotColor), green(slotColor), blue(slotColor), 180); // 使用主题色替代黄色，透明度降低
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(11);
        text(name, x, y - 5); // 调整位置，更靠近顶部
        
        // 为TYPE类型处理过渡动画
        if (name === "TYPE" && this.synthUI.transition.filterActive) {
          // 获取过渡进度
          const now = Date.now();
          const elapsed = now - this.synthUI.transition.filterStartTime;
          const duration = 300;
          let t = Math.min(1.0, elapsed / duration);
          t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          
          // 获取起始和目标类型
          const startType = this.synthUI.transition.filterStartParams.filterType;
          const endType = this.synthUI.transition.filterEndParams.filterType;
          
          // 绘制过渡中的类型文本
          fill(255, 180 * (1-t)); // 当前值逐渐淡出
          text(startType.toUpperCase(), x, y + 5); // 调整位置，更靠近底部
          
          fill(255, 180 * t); // 新值逐渐淡入
          text(endType.toUpperCase(), x, y + 5); // 调整位置，更靠近底部
        } else {
          // 正常显示参数值
          fill(255, 180); // 较暗的值
          text(value, x, y + 5); // 调整位置，更靠近底部
        }
      }
      
      pop();
    }
    
    // 辅助方法：计算滤波器响应
    calculateFilterResponse(freq, cutoff, Q, type) {
      // 正确实现滤波器响应计算，包括共振效果
      const w = freq / cutoff; // 归一化频率
      
      /* 关于Q值与共振的关系：
       * Q值表示共振的强度和带宽：
       * - Q值越大，共振峰越突出/尖锐
       * - 1/Q表示带宽，Q越大带宽越窄
       * - 在截止频率处，共振峰的高度与Q值成正比
       * - 这种行为在所有滤波器类型中都是一致的
       */
      
      // 根据滤波器类型计算响应 - 使用更准确的滤波器方程
      switch (type) {
        case 'lowpass':
          // 低通滤波器：在截止频率下方通过，共振在截止频率处产生峰值
          {
            // 参照低通滤波器的改进，类似地改进高通滤波器
            const logW = Math.log10(w);
            
            // 基础低通响应
            let response = 1.0;
            
            if (w > 1.0) {
              // 截止频率之后的衰减 - 使用更快的衰减率
              response = 1.0 / Math.pow(w, 4); // 加速衰减
            } else {
              // 截止频率之前保持平稳
              response = 1.0;
            }
            
            // 添加共振峰
            if (Q > 0.5) {
              const proximity = Math.exp(-80 * Math.pow(logW, 2));
              const normQ = Math.min(4, (Q - 0.5) / 5);
              const resonanceGain = normQ * 2;
              
              response += proximity * resonanceGain;
            }
            
            return Math.min(2.0, Math.max(0, response));
          }
          
        case 'highpass':
          // 高通滤波器：在截止频率上方通过，共振在截止频率处产生峰值
          {
            // 参照低通滤波器的改进，类似地改进高通滤波器
            const logW = Math.log10(w);
            
            // 基础高通响应
            let response = 0;
            
            if (w < 1.0) {
              // 截止频率之前快速衰减
              response = Math.pow(w, 4); // 加速衰减
            } else {
              // 截止频率之后保持平稳
              response = 1.0;
            }
            
            // 添加共振峰
            if (Q > 0.5) {
              const proximity = Math.exp(-80 * Math.pow(logW, 2));
              const normQ = Math.min(4, (Q - 0.5) / 5);
              const resonanceGain = normQ * 2;
              
              response += proximity * resonanceGain;
            }
            
            return Math.min(2.0, Math.max(0, response));
          }
          
        case 'bandpass':
          // 带通滤波器：只在截止频率附近通过
          {
            // 带通滤波器会自然在中心频率处形成峰值
            // Q值直接控制带宽(带宽 = 中心频率 / Q)
            const bw = 1.0 / Math.max(0.1, Q); // 限制最小带宽
            
            // 计算带通响应 - Q值越大，峰值越窄但高度不变
            const response = Math.exp(-Math.pow(Math.log(w) / (bw/2), 2) / 2);
            
            // 对于带通滤波器，我们保持峰值高度不变，只改变宽度
            return response;
          }
          
        case 'notch':
          // 陷波滤波器：在截止频率处阻断，Q控制带宽
          {
            // 带阻滤波器 = 1 - 带通滤波器
            const bw = 1.0 / Math.max(0.1, Q);
            
            // 计算带通响应
            const bandpassResponse = Math.exp(-Math.pow(Math.log(w) / (bw/2), 2) / 2);
            
            // 陷波 = 1 - 带通
            return 1.0 - bandpassResponse;
          }
          
        case 'allpass':
          // 全通滤波器：通过所有频率，但在截止频率处产生相位变化
          return 1;
          
        default:
          return 1;
      }
    }
    
    // 辅助方法：对数缩放
    logScale(value, min, max) {
      if (min <= 0) min = 0.001; // 避免对数值为0或负数
      return (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
    }
    
    // 辅助方法：对数归一化
    logNormalize(value, min, max) {
      if (min <= 0) min = 0.001; // 避免对数值为0或负数
      return (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
    }
    
    // 辅助方法：计算以10为底的对数
    log10(value) {
      return Math.log(value) / Math.LN10;
    }
    
    // 辅助方法：频率转字符串
    freqToString(freq) {
      if (freq >= 1000) {
        return `${(freq / 1000).toFixed(1)} kHz`;
      } else {
        return `${Math.round(freq)} Hz`;
      }
    }
    
    // 辅助方法：格式化滤波器类型
    formatFilterType(type) {
      switch (type) {
        case 'lowpass': return 'Low Pass';
        case 'highpass': return 'High Pass';
        case 'bandpass': return 'Band Pass';
        case 'notch': return 'Notch';
        case 'allpass': return 'All Pass';
        default: return type;
      }
    }
    
    // 新增：绘制滑音开关方法
    drawPortamentoSwitch() {
      push();
      
      const currentSlot = this.synthUI.currentSlot;
      const slotColor = color(this.synthUI.slotColors[currentSlot]);
      const portamentoEnabled = this.synthUI.portamento.enabled[currentSlot]; // 使用当前插槽的滑音状态
      const isHovering = this.synthUI.portamento.hovering;
      
      // 计算滤波器UI的位置（用于参考）
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25;
      const waveToEnvGap = 45;
      
      // 包络线区域
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth;
      const envH = 90;
      
      // 滤波器UI放置在ADSR参数标签下方
      const filterY = envY + envH + 60;
      const filterX = envX;
      const filterW = envW;
      const filterH = 120;
      
      // 修改：放置滑音开关紧贴在滤波器UI下方，宽度保持一致
      const switchX = filterX - 10; // 与滤波器背景框左边缘对齐
      const switchY = filterY + filterH + 5; // 减小间距，紧贴滤波器UI
      const switchWidth = filterW + 20; // 与滤波器背景框宽度一致
      const switchHeight = 30;
      
      // 绘制开关背景
      fill(20, 180);
      stroke(40, 180);
      strokeWeight(1);
      rect(switchX, switchY, switchWidth, switchHeight, 5);
      
      // 绘制滑音开关标签
      fill(255);
      noStroke();
      textAlign(LEFT, CENTER);
      textSize(12);
      text("Portamento:", switchX + 10, switchY + switchHeight/2);
      
      // 绘制开关状态 - 移动到右侧，为调节按钮和时间显示留出更多空间
      const toggleX = switchX + switchWidth - 40;
      const toggleY = switchY + switchHeight/2;
      const toggleWidth = 30;
      const toggleHeight = 16;
      
      // 绘制开关轨道
      stroke(60);
      strokeWeight(1);
      if (portamentoEnabled) {
        // 启用状态 - 使用主题色
        fill(red(slotColor), green(slotColor), blue(slotColor), 150);
      } else {
        // 禁用状态 - 使用暗灰色
        fill(60);
      }
      rect(toggleX, toggleY - toggleHeight/2, toggleWidth, toggleHeight, toggleHeight/2);
      
      // 绘制开关滑块
      noStroke();
      if (portamentoEnabled) {
        // 启用状态 - 滑块在右侧
        if (isHovering === 'toggle') {
          // 悬停状态 - 使用亮一点的主题色
          fill(red(slotColor), green(slotColor), blue(slotColor), 255);
        } else {
          // 非悬停状态 - 使用主题色
          fill(red(slotColor), green(slotColor), blue(slotColor), 220);
        }
        ellipse(toggleX + toggleWidth - toggleHeight/2, toggleY, toggleHeight, toggleHeight);
      } else {
        // 禁用状态 - 滑块在左侧
        if (isHovering === 'toggle') {
          // 悬停状态 - 使用亮白色
          fill(255);
        } else {
          // 非悬停状态 - 使用灰白色
          fill(200);
        }
        ellipse(toggleX + toggleHeight/2, toggleY, toggleHeight, toggleHeight);
      }
      
      // 如果滑音启用，显示当前滑音时间值和调节按钮
      if (portamentoEnabled) {
        // 将滑音时间值和调节按钮放在中间位置，与开关保持足够距离
        const valueX = switchX + switchWidth/2 - 20; // 居中显示
        
        // 显示当前插槽的滑音时间值
        const portamentoTime = this.synthParams[currentSlot].portamento;
        
        textAlign(CENTER, CENTER);
        fill(red(slotColor), green(slotColor), blue(slotColor), 220);
        textSize(11);
        text(`${Math.round(portamentoTime * 1000)} ms`, valueX, toggleY);
        
        // 重新布局调节按钮（+/-），放在时间值的两侧
        const btnSize = 16;
        const btnSpacing = 30; // 增加间距
        const minusX = valueX - btnSpacing;
        const plusX = valueX + btnSpacing;
        const btnY = toggleY;
        
        // 减号按钮
        fill(40);
        if (this.synthUI.portamento.hovering === 'minus') {
          stroke(red(slotColor), green(slotColor), blue(slotColor), 180);
        } else {
          stroke(60);
        }
        strokeWeight(1);
        rect(minusX - btnSize/2, btnY - btnSize/2, btnSize, btnSize, 3);
        
        // 减号符号
        stroke(255);
        strokeWeight(2);
        line(minusX - btnSize/3, btnY, minusX + btnSize/3, btnY);
        
        // 加号按钮
        fill(40);
        if (this.synthUI.portamento.hovering === 'plus') {
          stroke(red(slotColor), green(slotColor), blue(slotColor), 180);
        } else {
          stroke(60);
        }
        strokeWeight(1);
        rect(plusX - btnSize/2, btnY - btnSize/2, btnSize, btnSize, 3);
        
        // 加号符号
        stroke(255);
        strokeWeight(2);
        line(plusX - btnSize/3, btnY, plusX + btnSize/3, btnY);
        line(plusX, btnY - btnSize/3, plusX, btnY + btnSize/3);
      }
      
      pop();
    }
    
    // 更新检查滑音开关悬停的方法，以匹配新的布局
    checkPortamentoHover(mouseX, mouseY) {
      // 重置滑音开关悬停状态
      this.synthUI.portamento.hovering = false;
      
        // 获取当前选中的插槽
        const currentSlot = this.synthUI.currentSlot;
        
      // 计算滤波器UI的位置（用于参考）
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25;
      const waveToEnvGap = 45;
      
      // 包络线区域
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth;
      const envH = 90;
      
      // 滤波器UI放置在ADSR参数标签下方
      const filterY = envY + envH + 60;
      const filterX = envX;
      const filterW = envW;
      const filterH = 120;
      
      // 修改：放置滑音开关紧贴在滤波器UI下方，宽度保持一致
      const switchX = filterX - 10; // 与滤波器背景框左边缘对齐
      const switchY = filterY + filterH + 5; // 减小间距，紧贴滤波器UI
      const switchWidth = filterW + 20; // 与滤波器背景框宽度一致
      const switchHeight = 30;
      
      // 检查是否在滑音开关区域内
      if (mouseX >= switchX && mouseX <= switchX + switchWidth && 
          mouseY >= switchY && mouseY <= switchY + switchHeight) {
        
        // 检查是否悬停在开关滑块上
        const toggleX = switchX + switchWidth - 40;
        const toggleY = switchY + switchHeight/2;
        const toggleWidth = 30;
        const toggleHeight = 16;
        
        if (mouseX >= toggleX && mouseX <= toggleX + toggleWidth && 
            mouseY >= toggleY - toggleHeight/2 && mouseY <= toggleY + toggleHeight/2) {
          this.synthUI.portamento.hovering = 'toggle';
          return true;
        }
        
        // 如果滑音已启用，检查是否悬停在+/-按钮上
        if (this.synthUI.portamento.enabled[currentSlot]) {
          const btnSize = 16;
          const valueX = switchX + switchWidth/2 - 20; // 居中显示
          const btnSpacing = 30; // 增加间距，与绘制函数保持一致
          const minusX = valueX - btnSpacing;
          const plusX = valueX + btnSpacing;
          const btnY = toggleY;
          
          // 检查减号按钮
          if (mouseX >= minusX - btnSize/2 && mouseX <= minusX + btnSize/2 &&
              mouseY >= btnY - btnSize/2 && mouseY <= btnY + btnSize/2) {
            this.synthUI.portamento.hovering = 'minus';
            return true;
          }
          
          // 检查加号按钮
          if (mouseX >= plusX - btnSize/2 && mouseX <= plusX + btnSize/2 &&
              mouseY >= btnY - btnSize/2 && mouseY <= btnY + btnSize/2) {
            this.synthUI.portamento.hovering = 'plus';
            return true;
          }
        }
        
        this.synthUI.portamento.hovering = true;
        return true;
      }
      
      return false;
    }
    
    // 新增：绘制delay控制UI的方法
    drawDelayControls() {
      push();
      
      const currentSlot = this.synthUI.currentSlot;
      const slotColor = color(this.synthUI.slotColors[currentSlot]);
      const delayEnabled = this.synthUI.delay.enabled[currentSlot]; // 使用当前插槽的delay状态
      const isHovering = this.synthUI.delay.hovering;
      
      // 计算滤波器UI的位置（用于参考）
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25;
      const waveToEnvGap = 45;
      
      // 包络线区域
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth;
      const envH = 90;
      
      // 滤波器UI放置在ADSR参数标签下方
      const filterY = envY + envH + 60;
      const filterX = envX;
      const filterW = envW;
      const filterH = 120;
      
      // 滑音控制界面位置
      const portSwitchX = filterX - 10;
      const portSwitchY = filterY + filterH + 5;
      const portSwitchWidth = filterW + 20;
      const portSwitchHeight = 30;
      
      // 放置delay控制紧贴在滑音控制下方，宽度保持一致，但增加高度
      const switchX = portSwitchX;
      const switchY = portSwitchY + portSwitchHeight + 5;
      const switchWidth = portSwitchWidth;
      const switchHeight = 60;
      
      // 绘制delay背景
      fill(20, 180);
      stroke(40, 180);
      strokeWeight(1);
      rect(switchX, switchY, switchWidth, switchHeight, 5);
      
      // 绘制顶部标题
      fill(255);
      noStroke();
      textAlign(CENTER, TOP);
      textSize(12);
      text("Delay Effect", switchX + switchWidth/2, switchY + 8);
      
      // 第一行：开关和时间控制
      const row1Y = switchY + 28;
      
      // 开关标签
      fill(255);
      noStroke();
      textAlign(LEFT, CENTER);
      textSize(12);
      text("Enable:", switchX + 15, row1Y);
      
      // 开关位置
      const toggleX = switchX + 80;
      const toggleY = row1Y;
      const toggleWidth = 30;
      const toggleHeight = 16;
      
      // 绘制开关轨道
      stroke(60);
      strokeWeight(1);
      if (delayEnabled) {
        // 启用状态 - 使用主题色
        fill(red(slotColor), green(slotColor), blue(slotColor), 150);
      } else {
        // 禁用状态 - 使用暗灰色
        fill(60);
      }
      rect(toggleX, toggleY - toggleHeight/2, toggleWidth, toggleHeight, toggleHeight/2);
      
      // 绘制开关滑块
      noStroke();
      if (delayEnabled) {
        // 启用状态 - 滑块在右侧
        if (isHovering === 'toggle') {
          // 悬停状态 - 使用亮一点的主题色
          fill(red(slotColor), green(slotColor), blue(slotColor), 255);
        } else {
          // 非悬停状态 - 使用主题色
          fill(red(slotColor), green(slotColor), blue(slotColor), 220);
        }
        ellipse(toggleX + toggleWidth - toggleHeight/2, toggleY, toggleHeight + 2, toggleHeight + 2);
      } else {
        // 禁用状态 - 滑块在左侧
        if (isHovering === 'toggle') {
          // 悬停状态 - 使用亮白色
          fill(255);
        } else {
          // 非悬停状态 - 使用灰白色
          fill(200);
        }
        ellipse(toggleX + toggleHeight/2, toggleY, toggleHeight + 2, toggleHeight + 2);
      }
      
      // 如果delay启用，显示时间和反馈控制
      if (delayEnabled) {
        // 删除时间控制标签，直接显示时间值
        // 第二行：时间值和反馈控制
        const row2Y = switchY + 48;
        
        // 时间值显示和控制按钮 - 由于删除了标签，可以向左移一些
        const valueX = switchX + switchWidth/2 - 110; // 放置在左侧并略微调整位置
        const valueY = row2Y;
        
        // 显示当前插槽的delay时间值（以拍为单位）
        const delayBeats = this.synthUI.delay.values[currentSlot];
        
        textAlign(CENTER, CENTER);
        fill(red(slotColor), green(slotColor), blue(slotColor), 220);
        textSize(12);
        
        // 将delay值显示为音符时值（1/4, 1/8, 1/16等）
        let delayText = "";
        if (delayBeats === 0.125) delayText = "1/8";
        else if (delayBeats === 0.25) delayText = "1/4";
        else if (delayBeats === 0.5) delayText = "1/2";
        else if (delayBeats === 1) delayText = "1";
        else if (delayBeats === 1.5) delayText = "1 1/2";
        else if (delayBeats === 2) delayText = "2";
        else delayText = delayBeats.toString();
        
        const btnSize = 20; // 增大按钮尺寸
        const btnSpacing = 40; // 增加间距
        const minusX = valueX - btnSpacing/2;
        const plusX = valueX + btnSpacing/2;
        const btnY = valueY;
        
        // 减号按钮
        fill(40);
        if (this.synthUI.delay.hovering === 'minus') {
          stroke(red(slotColor), green(slotColor), blue(slotColor), 180);
        } else {
          stroke(60);
        }
        strokeWeight(1);
        rect(minusX - btnSize/2, btnY - btnSize/2, btnSize, btnSize, 4);
        
        // 减号符号
        stroke(255);
        strokeWeight(2);
        line(minusX - btnSize/3, btnY, minusX + btnSize/3, btnY);
        
        // 时间值显示
        fill(255);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(13);
        text(delayText, valueX, valueY);
        
        // 加号按钮
        fill(40);
        if (this.synthUI.delay.hovering === 'plus') {
          stroke(red(slotColor), green(slotColor), blue(slotColor), 180);
        } else {
          stroke(60);
        }
        strokeWeight(1);
        rect(plusX - btnSize/2, btnY - btnSize/2, btnSize, btnSize, 4);
        
        // 加号符号
        stroke(255);
        strokeWeight(2);
        line(plusX - btnSize/3, btnY, plusX + btnSize/3, btnY);
        line(plusX, btnY - btnSize/3, plusX, btnY + btnSize/3);
        
        // 反馈控制 - 由于删除了时间标签，可以适当调整位置
        const fbLabelX = valueX + 140; // 稍微增加距离，使布局更均匀
        const fbX = fbLabelX + 70;
        const fbY = row2Y;
        
        // 反馈标签 - 将文字向左移动，但保持对齐方式
        fill(255);
        noStroke();
        textAlign(RIGHT, CENTER);
        textSize(12);
        text("Feedback:", fbLabelX - 20, fbY); // 向左移动20像素
        
        // 反馈值
        const fbValue = this.synthUI.delay.feedback[currentSlot];
        
        // 绘制反馈滑块背景 - 位置不变
        fill(40, 180);
        stroke(60);
        strokeWeight(1);
        const fbWidth = 80; // 增大滑块宽度
        const fbHeight = 8; // 增大滑块高度
        rect(fbX - fbWidth, fbY - fbHeight/2, fbWidth, fbHeight, 4);
        
        // 绘制反馈滑块填充
        noStroke();
        fill(red(slotColor), green(slotColor), blue(slotColor), 180);
        const fillWidth = fbWidth * fbValue;
        rect(fbX - fbWidth, fbY - fbHeight/2, fillWidth, fbHeight, 4);
        
        // 绘制反馈滑块手柄
        fill(red(slotColor), green(slotColor), blue(slotColor), 220);
        if (this.synthUI.delay.hovering === 'feedback') {
          stroke(255, 180);
          strokeWeight(1);
        } else {
          noStroke();
        }
        const handleX = fbX - fbWidth + fillWidth;
        const handleSize = 14; // 增大手柄尺寸
        ellipse(handleX, fbY, handleSize, handleSize);
        
        // 显示反馈百分比
        fill(255);
        noStroke();
        textAlign(LEFT, CENTER);
        textSize(10);
        text(`${Math.round(fbValue * 100)}%`, fbX + 10, fbY);
      }
      
      pop();
    }
    
    // 修改检查delay控制悬停状态的方法，使其匹配新的布局
    checkDelayHover(mouseX, mouseY) {
      // 重置delay悬停状态
      this.synthUI.delay.hovering = false;
      
      // 获取当前选中的插槽
      const currentSlot = this.synthUI.currentSlot;
      
      // 计算滤波器UI的位置（用于参考）
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25;
      const waveToEnvGap = 45;
      
      // 包络线区域
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth;
      const envH = 90;
      
      // 滤波器UI放置在ADSR参数标签下方
      const filterY = envY + envH + 60;
      const filterX = envX;
      const filterW = envW;
      const filterH = 120;
      
      // 滑音控制界面位置
      const portSwitchX = filterX - 10;
      const portSwitchY = filterY + filterH + 5;
      const portSwitchWidth = filterW + 20;
      const portSwitchHeight = 30;
      
      // 放置delay控制紧贴在滑音控制下方，宽度保持一致，但增加高度
      const switchX = portSwitchX;
      const switchY = portSwitchY + portSwitchHeight + 5;
      const switchWidth = portSwitchWidth;
      const switchHeight = 60; // 高度与drawDelayControls保持一致
      
      // 检查是否在delay控制区域内
      if (mouseX >= switchX && mouseX <= switchX + switchWidth && 
          mouseY >= switchY && mouseY <= switchY + switchHeight) {
        
        // 第一行：开关和时间控制
        const row1Y = switchY + 28;
        
        // 开关位置
        const toggleX = switchX + 80;
        const toggleY = row1Y;
        const toggleWidth = 30;
        const toggleHeight = 16;
        
        // 检查是否悬停在开关上
        if (mouseX >= toggleX && mouseX <= toggleX + toggleWidth && 
            mouseY >= toggleY - toggleHeight/2 - 5 && mouseY <= toggleY + toggleHeight/2 + 5) {
          this.synthUI.delay.hovering = 'toggle';
          return true;
        }
        
        // 如果delay已启用，检查是否悬停在其他控件上
        if (this.synthUI.delay.enabled[currentSlot]) {
          // 第二行：时间值和反馈控制
          const row2Y = switchY + 48;
          
          // 时间控制按钮
          const valueX = switchX + switchWidth/2 - 100;
          const btnSize = 20;
          const btnSpacing = 40;
          const minusX = valueX - btnSpacing/2;
          const plusX = valueX + btnSpacing/2;
          const btnY = row2Y;
          
          // 检查减号按钮
          if (mouseX >= minusX - btnSize/2 && mouseX <= minusX + btnSize/2 &&
              mouseY >= btnY - btnSize/2 && mouseY <= btnY + btnSize/2) {
            this.synthUI.delay.hovering = 'minus';
            return true;
          }
          
          // 检查加号按钮
          if (mouseX >= plusX - btnSize/2 && mouseX <= plusX + btnSize/2 &&
              mouseY >= btnY - btnSize/2 && mouseY <= btnY + btnSize/2) {
            this.synthUI.delay.hovering = 'plus';
            return true;
          }
          
          // 反馈滑块位置
          const fbLabelX = valueX + 120;
          const fbX = fbLabelX + 70;
          const fbY = row2Y;
          const fbWidth = 80;
          const fbHeight = 20; // 扩大点击区域
          
          // 检查反馈滑块
          if (mouseX >= fbX - fbWidth && mouseX <= fbX + 20 && 
              mouseY >= fbY - fbHeight/2 && mouseY <= fbY + fbHeight/2) {
            this.synthUI.delay.hovering = 'feedback';
            return true;
          }
        }
        
        this.synthUI.delay.hovering = true;
        return true;
      }
      
      return false;
    }
    
    // 新增：计算与BPM同步的delay时间（以秒为单位）
    calculateDelayTime(beats) {
      // 从拍数转换为秒，delay时间 = 60 / BPM * 拍数
      return 60 / this.bpm * beats;
    }
    
    // 新增：更新delay时间，用于BPM变化时调用
    updateDelayTimes() {
      if (!this.delayEffects || !this.audioInitialized) return;
      
      for (let i = 0; i < this.delayEffects.length; i++) {
        const delay = this.delayEffects[i];
        const beats = this.synthUI.delay.values[i];
        
        if (delay && typeof delay.delayTime !== 'undefined') {
          // 计算新的delay时间
          const delayTimeInSeconds = this.calculateDelayTime(beats);
          // 更新delay时间
          delay.delayTime.value = delayTimeInSeconds;
        }
      }
    }
    
    // 新增：绘制reverb控制UI的方法
    drawReverbControls() {
      push();
      
      const currentSlot = this.synthUI.currentSlot;
      const slotColor = color(this.synthUI.slotColors[currentSlot]);
      const reverbEnabled = this.synthUI.reverb.enabled[currentSlot]; // 使用当前插槽的reverb状态
      const isHovering = this.synthUI.reverb.hovering;
      
      // 计算滤波器UI的位置（用于参考）
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25;
      const waveToEnvGap = 45;
      
      // 包络线区域
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth;
      const envH = 90;
      
      // 滤波器UI放置在ADSR参数标签下方
      const filterY = envY + envH + 60;
      const filterX = envX;
      const filterW = envW;
      const filterH = 120;
      
      // 滑音控制界面位置
      const portSwitchX = filterX - 10;
      const portSwitchY = filterY + filterH + 5;
      const portSwitchWidth = filterW + 20;
      const portSwitchHeight = 30;
      
      // delay控制位置
      const delaySwitchX = portSwitchX;
      const delaySwitchY = portSwitchY + portSwitchHeight + 5;
      const delaySwitchWidth = portSwitchWidth;
      const delaySwitchHeight = 60;
      
      // 放置reverb控制紧贴在delay控制下方，宽度保持一致
      const switchX = delaySwitchX;
      const switchY = delaySwitchY + delaySwitchHeight + 5; // 紧贴delay控制
      const switchWidth = delaySwitchWidth;
      const switchHeight = 60; // 与delay控制相同高度
      
      // 绘制reverb背景
      fill(20, 180);
      stroke(40, 180);
      strokeWeight(1);
      rect(switchX, switchY, switchWidth, switchHeight, 5);
      
      // 绘制顶部标题
      fill(255);
      noStroke();
      textAlign(CENTER, TOP);
      textSize(12);
      text("Reverb Effect", switchX + switchWidth/2, switchY + 8);
      
      // 第一行：开关和衰减时间控制
      const row1Y = switchY + 28;
      
      // 开关标签
      fill(255);
      noStroke();
      textAlign(LEFT, CENTER);
      textSize(12);
      text("Enable:", switchX + 15, row1Y);
      
      // 开关位置
      const toggleX = switchX + 80;
      const toggleY = row1Y;
      const toggleWidth = 30;
      const toggleHeight = 16;
      
      // 绘制开关轨道
      stroke(60);
      strokeWeight(1);
      if (reverbEnabled) {
        // 启用状态 - 使用主题色
        fill(red(slotColor), green(slotColor), blue(slotColor), 150);
      } else {
        // 禁用状态 - 使用暗灰色
        fill(60);
      }
      rect(toggleX, toggleY - toggleHeight/2, toggleWidth, toggleHeight, toggleHeight/2);
      
      // 绘制开关滑块
      noStroke();
      if (reverbEnabled) {
        // 启用状态 - 滑块在右侧
        if (isHovering === 'toggle') {
          // 悬停状态 - 使用亮一点的主题色
          fill(red(slotColor), green(slotColor), blue(slotColor), 255);
        } else {
          // 非悬停状态 - 使用主题色
          fill(red(slotColor), green(slotColor), blue(slotColor), 220);
        }
        ellipse(toggleX + toggleWidth - toggleHeight/2, toggleY, toggleHeight + 2, toggleHeight + 2);
      } else {
        // 禁用状态 - 滑块在左侧
        if (isHovering === 'toggle') {
          // 悬停状态 - 使用亮白色
          fill(255);
        } else {
          // 非悬停状态 - 使用灰白色
          fill(200);
        }
        ellipse(toggleX + toggleHeight/2, toggleY, toggleHeight + 2, toggleHeight + 2);
      }
      
      // 如果reverb启用，显示衰减时间和湿度控制
      if (reverbEnabled) {
        // 第二行：衰减时间值和湿度控制
        const row2Y = switchY + 48;
        
        // 左侧：衰减时间控制
        // 衰减时间标签
        fill(255);
        noStroke();
        textAlign(RIGHT, CENTER);
        textSize(12);
        text("Decay:", switchX + 65, row2Y);
        
        // 衰减时间控制
        const decayX = switchX + 130;
        const decayY = row2Y;
        
        // 显示当前插槽的衰减时间值（秒）
        const decayTime = this.synthUI.reverb.decay[currentSlot];
        
        // 绘制衰减时间滑块背景
        fill(40, 180);
        stroke(60);
        strokeWeight(1);
        const decayWidth = 60;
        const decayHeight = 8;
        rect(decayX - decayWidth, decayY - decayHeight/2, decayWidth, decayHeight, 4);
        
        // 绘制衰减时间滑块填充
        noStroke();
        fill(red(slotColor), green(slotColor), blue(slotColor), 180);
        // 将衰减时间映射到0-1范围，用于计算填充宽度
        // 衰减时间范围为0.1-10秒
        const normalizedDecay = (decayTime - 0.1) / (10 - 0.1);
        const fillWidth = decayWidth * normalizedDecay;
        rect(decayX - decayWidth, decayY - decayHeight/2, fillWidth, decayHeight, 4);
        
        // 绘制衰减时间滑块手柄
        fill(red(slotColor), green(slotColor), blue(slotColor), 220);
        if (this.synthUI.reverb.hovering === 'decay') {
          stroke(255, 180);
          strokeWeight(1);
        } else {
          noStroke();
        }
        const handleX = decayX - decayWidth + fillWidth;
        const handleSize = 14;
        ellipse(handleX, decayY, handleSize, handleSize);
        
        // 显示衰减时间值
        fill(255);
        noStroke();
        textAlign(LEFT, CENTER);
        textSize(10);
        text(`${decayTime.toFixed(1)}s`, decayX + 5, decayY);
        
        // 右侧：湿度控制
        const wetLabelX = switchX + switchWidth - 95;
        const wetX = switchX + switchWidth - 30;
        const wetY = row2Y;
        
        // 湿度标签
        fill(255);
        noStroke();
        textAlign(RIGHT, CENTER);
        textSize(12);
        text("Wet:", wetLabelX, wetY);
        
        // 湿度值
        const wetValue = this.synthUI.reverb.wet[currentSlot];
        
        // 绘制湿度滑块背景
        fill(40, 180);
        stroke(60);
        strokeWeight(1);
        const wetWidth = 60;
        const wetHeight = 8;
        rect(wetX - wetWidth, wetY - wetHeight/2, wetWidth, wetHeight, 4);
        
        // 绘制湿度滑块填充
        noStroke();
        fill(red(slotColor), green(slotColor), blue(slotColor), 180);
        const wetFillWidth = wetWidth * wetValue;
        rect(wetX - wetWidth, wetY - wetHeight/2, wetFillWidth, wetHeight, 4);
        
        // 绘制湿度滑块手柄
        fill(red(slotColor), green(slotColor), blue(slotColor), 220);
        if (this.synthUI.reverb.hovering === 'wet') {
          stroke(255, 180);
          strokeWeight(1);
        } else {
          noStroke();
        }
        const wetHandleX = wetX - wetWidth + wetFillWidth;
        const wetHandleSize = 14;
        ellipse(wetHandleX, wetY, wetHandleSize, wetHandleSize);
        
        // 显示湿度百分比
        fill(255);
        noStroke();
        textAlign(LEFT, CENTER);
        textSize(10);
        text(`${Math.round(wetValue * 100)}%`, wetX + 5, wetY);
      }
      
      pop();
    }
    
    // 新增：检查reverb控制悬停状态的方法
    checkReverbHover(mouseX, mouseY) {
      // 重置reverb悬停状态
      this.synthUI.reverb.hovering = false;
      
      const currentSlot = this.synthUI.currentSlot;
      const reverbEnabled = this.synthUI.reverb.enabled[currentSlot];
      
      // 计算滤波器UI的位置（用于参考）
      const buttonWidth = 30;
      const spacing = 5;
      const totalWidth = 8 * buttonWidth + 7 * spacing;
      const waveformStartX = ui.centerX - totalWidth / 2;
      const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
      const waveformHeight = 25;
      const waveToEnvGap = 45;
      
      // 包络线区域
      const envX = waveformStartX;
      const envY = waveformStartY + waveformHeight + waveToEnvGap;
      const envW = totalWidth;
      const envH = 90;
      
      // 滤波器UI放置在ADSR参数标签下方
      const filterY = envY + envH + 60;
      const filterX = envX;
      const filterW = envW;
      const filterH = 120;
      
      // 滑音控制界面位置
      const portSwitchX = filterX - 10;
      const portSwitchY = filterY + filterH + 5;
      const portSwitchWidth = filterW + 20;
      const portSwitchHeight = 30;
      
      // delay控制位置
      const delaySwitchX = portSwitchX;
      const delaySwitchY = portSwitchY + portSwitchHeight + 5;
      const delaySwitchWidth = portSwitchWidth;
      const delaySwitchHeight = 60;
      
      // reverb控制位置
      const switchX = delaySwitchX;
      const switchY = delaySwitchY + delaySwitchHeight + 5;
      const switchWidth = delaySwitchWidth;
      const switchHeight = 60;
      
      // 检查鼠标是否在reverb控制区域内
      if (mouseX >= switchX && mouseX <= switchX + switchWidth &&
          mouseY >= switchY && mouseY <= switchY + switchHeight) {
        
        // 第一行（开关）Y位置
        const row1Y = switchY + 28;
        
        // 开关位置
        const toggleX = switchX + 80;
        const toggleY = row1Y;
        const toggleWidth = 30;
        const toggleHeight = 16;
        
        // 检查开关悬停
        if (mouseX >= toggleX && mouseX <= toggleX + toggleWidth &&
            mouseY >= toggleY - toggleHeight/2 - 5 && mouseY <= toggleY + toggleHeight/2 + 5) {
          this.synthUI.reverb.hovering = 'toggle';
          return true;
        }
        
        // 如果reverb启用，检查衰减时间和湿度滑块
        if (reverbEnabled) {
          // 第二行Y位置
          const row2Y = switchY + 48;
          
          // 衰减时间滑块
          const decayX = switchX + 130;
          const decayY = row2Y;
          const decayWidth = 60;
          const decayHeight = 8;
          const decayHandleSize = 14;
          
          // 检查衰减时间滑块悬停
          const decayHandleX = decayX - decayWidth + decayWidth * 
            ((this.synthUI.reverb.decay[currentSlot] - 0.1) / (10 - 0.1));
          
          if (dist(mouseX, mouseY, decayHandleX, decayY) <= decayHandleSize/2 + 5 ||
              (mouseX >= decayX - decayWidth && mouseX <= decayX &&
               mouseY >= decayY - decayHeight/2 - 5 && mouseY <= decayY + decayHeight/2 + 5)) {
            this.synthUI.reverb.hovering = 'decay';
            return true;
          }
          
          // 湿度滑块
          const wetX = switchX + switchWidth - 30;
          const wetY = row2Y;
          const wetWidth = 60;
          const wetHeight = 8;
          const wetHandleSize = 14;
          
          // 检查湿度滑块悬停
          const wetHandleX = wetX - wetWidth + wetWidth * this.synthUI.reverb.wet[currentSlot];
          
          if (dist(mouseX, mouseY, wetHandleX, wetY) <= wetHandleSize/2 + 5 ||
              (mouseX >= wetX - wetWidth && mouseX <= wetX &&
               mouseY >= wetY - wetHeight/2 - 5 && mouseY <= wetY + wetHeight/2 + 5)) {
            this.synthUI.reverb.hovering = 'wet';
            return true;
          }
        }
        
        // 鼠标在reverb控制区域内，但不在特定控件上
        this.synthUI.reverb.hovering = true;
        return true;
      }
      
      return false;
    }
    
    // 新增：更新混响参数的方法
    updateReverbEffects() {
      if (!this.audioInitialized || !this.reverbEffects) return;
      
      for (let i = 0; i < 8; i++) {
        const reverb = this.reverbEffects[i];
        if (!reverb) continue;
        
        const params = this.synthParams[i];
        const isEnabled = this.synthUI.reverb.enabled[i];
        
        // 更新混响衰减时间
        if (params.reverbDecay !== reverb.decay) {
          reverb.decay = params.reverbDecay;
          // 重新生成混响冲激响应
          reverb.generate();
        }
        
        // 更新混响湿度
        reverb.wet.value = isEnabled ? params.reverbWet : 0;
      }
    }
  } 