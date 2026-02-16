/**
 * MusicVisualizer.js - 音高瀑布流可视化器
 * 捕获实际触发的音符数据，生成类似钢琴卷帘的瀑布流效果
 * 复用three-scene.js的触发接口
 */

class MusicVisualizer {
    constructor() {
        this.isEnabled = false;
        this.p5Instance = null;
        this.canvas = null;
        this.container = null;
        
        // 图像捕获相关设置
        this.captureSettings = {
            isCapturing: false,           // 是否正在捕获
            autoCapture: false,           // 自动捕获模式
            captureInterval: 2000,        // 自动捕获间隔(毫秒)
            lastCaptureTime: 0,           // 上次捕获时间
            captureCount: 0,              // 捕获计数器
            captureFormat: 'png',         // 捕获格式
            captureQuality: 0.9,          // 捕获质量
            minNotesForCapture: 3         // 触发捕获的最小音符数量
        };
        
        // AI图像诞生动画系统
        this.aiImageAnimation = {
            isActive: false,              // 动画是否激活
            imageData: null,              // 生成的图像数据
            imageElement: null,           // 加载的图像元素
            imageLoaded: false,           // 图像是否已加载
            container: null,              // 独立的全屏动画容器
            canvas: null,                 // 动画专用canvas
            context: null,                // canvas上下文
            animationFrame: null,         // 动画帧ID
            particles: [],                // 粒子效果
            birthEffect: {
                active: false,
                startTime: 0,
                duration: 1500,           // 诞生效果持续时间
                centerX: 0,               // 诞生中心X（全屏坐标）
                centerY: 0,               // 诞生中心Y（全屏坐标）
                maxRadius: 80             // 最大半径
            },
            flyingImage: {
                active: false,
                x: 0,                     // 当前位置X（全屏坐标）
                y: 0,                     // 当前位置Y（全屏坐标）
                startX: 0,                // 起始位置X（全屏坐标）
                startY: 0,                // 起始位置Y（全屏坐标）
                targetX: 0,               // 目标位置X（全屏坐标）
                targetY: 0,               // 目标位置Y（全屏坐标）
                size: 60,                 // 图像大小
                startTime: 0,
                duration: 2000,           // 飞行动画持续时间
                rotation: 0               // 旋转角度
            },
            expandingImage: {
                active: false,
                x: 0,                     // 放大时的位置X
                y: 0,                     // 放大时的位置Y
                startSize: 60,            // 开始放大时的大小
                targetSize: 200,          // 目标大小
                currentSize: 60,          // 当前大小
                targetWidth: 200,         // 目标宽度
                targetHeight: 200,        // 目标高度
                startTime: 0,
                duration: 1000,           // 放大动画持续时间
                rotation: 0,
                opacity: 1.0              // 透明度
            }
        };
        
        // AI图像诞生动画系统
        this.aiImageAnimation = {
            isActive: false,              // 动画是否激活
            imageData: null,              // 生成的图像数据
            imageElement: null,           // 加载的图像元素
            imageLoaded: false,           // 图像是否已加载
            container: null,              // 独立的全屏动画容器
            canvas: null,                 // 动画专用canvas
            context: null,                // canvas上下文
            animationFrame: null,         // 动画帧ID
            particles: [],                // 粒子效果
            birthEffect: {
                active: false,
                startTime: 0,
                duration: 1500,           // 诞生效果持续时间
                centerX: 0,               // 诞生中心X（全屏坐标）
                centerY: 0,               // 诞生中心Y（全屏坐标）
                maxRadius: 80             // 最大半径
            },
            flyingImage: {
                active: false,
                x: 0,                     // 当前位置X（全屏坐标）
                y: 0,                     // 当前位置Y（全屏坐标）
                startX: 0,                // 起始位置X（全屏坐标）
                startY: 0,                // 起始位置Y（全屏坐标）
                targetX: 0,               // 目标位置X（全屏坐标）
                targetY: 0,               // 目标位置Y（全屏坐标）
                size: 60,                 // 图像大小
                startTime: 0,
                duration: 2000,           // 飞行动画持续时间
                rotation: 0               // 旋转角度
            },
            expandingImage: {
                active: false,
                x: 0,                     // 放大时的位置X
                y: 0,                     // 放大时的位置Y
                startSize: 60,            // 开始放大时的大小
                targetSize: 200,          // 目标大小
                currentSize: 60,          // 当前大小
                targetWidth: 200,         // 目标宽度
                targetHeight: 200,        // 目标高度
                startTime: 0,
                duration: 1000,           // 放大动画持续时间
                rotation: 0,
                opacity: 1.0              // 透明度
            }
        };
        
        // 音符瀑布流数据
        this.noteStream = {
            activeNotes: [],           // 当前正在显示的音符
            maxNotes: 100,            // 最大显示音符数量
            scrollSpeed: 2,           // 瀑布流滚动速度
            noteWidth: 30,            // 音符宽度
            noteHeight: 8,            // 音符高度
            fadeTime: 3000            // 音符淡出时间(毫秒)
        };
        
        // 音高范围设置
        this.pitchRange = {
            minPitch: -24,            // 最低音高偏移
            maxPitch: 24,             // 最高音高偏移
            totalRange: 48,           // 总音高范围
            keyHeight: 12             // 每个半音的高度
        };
        
        // 可视化区域设置
        this.visualArea = {
            width: 380,               // 可视化区域宽度
            height: 240,              // 可视化区域高度
            marginLeft: 10,           // 左边距
            marginTop: 30             // 上边距
        };
        
        // 颜色主题
        this.colorTheme = {
            background: [10, 10, 15],                    // 深色背景
            pianoKeys: [30, 30, 40],                     // 钢琴键背景
            whiteKeys: [50, 50, 60],                     // 白键颜色
            blackKeys: [20, 20, 25],                     // 黑键颜色
            noteColors: [                                // 音符颜色（根据预设）
                [255, 107, 107], [78, 205, 196], [69, 183, 209],
                [150, 206, 180], [254, 202, 87], [255, 159, 243],
                [84, 160, 255], [95, 39, 205], [0, 210, 211],
                [255, 159, 67], [238, 90, 36], [15, 185, 177]
            ],
            gridLines: [40, 40, 50],                     // 网格线颜色
            timeAxis: [100, 100, 120],                   // 时间轴颜色
            text: [200, 200, 220]                        // 文字颜色
        };
        
        this.init();
    }
    
    init() {
        this.createContainer();
        this.createAnimationContainer();
        this.setupEventListeners();
        this.initP5Instance();
        
        // 添加语言变化监听器
        if (window.languageManager) {
            window.languageManager.addLanguageChangeListener((language) => {
                this.updateTexts(language);
            });
        }
        
        console.log(this.getText('initialized'));
    }
    
    // 获取多语言文本的辅助方法
    getText(key, subKey = null) {
        if (window.languageManager) {
            return window.languageManager.getText('musicVisualizer', key, subKey);
        }
        // 备用文本（如果语言管理器未加载）
        const fallbackTexts = {
            initialized: '🎵 Music Visualizer Initialized',
            shown: 'Music Visualizer Shown',
            hidden: 'Music Visualizer Hidden',
            enableFirst: '❌ Please enable Music Visualizer first (Press V)',
            aiGeneratorNotLoaded: '❌ AI Image Generator not loaded'
        };
        return fallbackTexts[key] || key;
    }
    
    // 更新文本（当语言变化时调用）
    updateTexts(language) {
        // 这里可以更新任何需要动态更新的文本
        // 目前主要是console.log，不需要特别处理
    }
    
    createContainer() {
        // 创建可视化容器
        this.container = document.createElement('div');
        this.container.id = 'music-visualizer-container';
        this.container.className = 'visualizer-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            height: 280px;
            background: transparent;
            border: none;
            z-index: 1000;
            display: none;
            overflow: hidden;
            pointer-events: none;
        `;
        
        document.body.appendChild(this.container);
    }
    
    createAnimationContainer() {
        // 创建独立的全屏动画容器
        this.aiImageAnimation.container = document.createElement('div');
        this.aiImageAnimation.container.id = 'ai-animation-overlay';
        this.aiImageAnimation.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: transparent;
            z-index: 9999;
            pointer-events: none;
            display: none;
        `;
        
        // 创建动画专用canvas
        this.aiImageAnimation.canvas = document.createElement('canvas');
        this.aiImageAnimation.canvas.width = window.innerWidth;
        this.aiImageAnimation.canvas.height = window.innerHeight;
        this.aiImageAnimation.canvas.style.cssText = `
            width: 100%;
            height: 100%;
        `;
        
        this.aiImageAnimation.context = this.aiImageAnimation.canvas.getContext('2d');
        this.aiImageAnimation.container.appendChild(this.aiImageAnimation.canvas);
        document.body.appendChild(this.aiImageAnimation.container);
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            if (this.aiImageAnimation.canvas) {
                this.aiImageAnimation.canvas.width = window.innerWidth;
                this.aiImageAnimation.canvas.height = window.innerHeight;
            }
        });
        
        console.log('🎬 独立动画容器已创建');
    }
    
    setupEventListeners() {
        // 监听实际的音符触发事件
        this.setupNoteCapture();
        
        // 键盘快捷键
        document.addEventListener('keydown', (event) => {
            if (event.key === 'v' || event.key === 'V') {
                this.toggle();
            }
            // C键 - 手动捕获当前帧
            else if (event.key === 'c' || event.key === 'C') {
                if (this.isEnabled) {
                    this.captureCurrentFrame('manual');
                }
            }
            // X键 - 切换自动捕获模式
            else if (event.key === 'x' || event.key === 'X') {
                if (this.isEnabled) {
                    this.toggleAutoCapture();
                }
            }
            // Z键 - 导出所有捕获的图像信息
            else if (event.key === 'z' || event.key === 'Z') {
                if (this.isEnabled) {
                    this.exportCaptureInfo();
                }
            }
            // A键 - 打开AI图像生成面板
            else if (event.key === 'a' || event.key === 'A') {
                if (this.isEnabled && window.aiImageGenerator) {
                    window.aiImageGenerator.togglePanel();
                } else if (!this.isEnabled) {
                    console.log('❌ 请先启动音乐可视化器 (按V键)');
                } else if (!window.aiImageGenerator) {
                    console.log('❌ AI图像生成器未加载');
                }
            }
        });
    }
    
    setupNoteCapture() {
        const self = this;
        
        // 方法1: 钩入audio-sequencer.js中的playScheduledBeats方法
        const waitForAudioSequencer = () => {
            // 等待window.metronome（AudioSequencer实例）加载
            if (window.metronome && window.metronome.playScheduledBeats) {
                console.log('✅ 找到AudioSequencer实例，开始钩入playScheduledBeats方法');
                
                // 保存原始的playScheduledBeats方法
                const originalPlayScheduledBeats = window.metronome.playScheduledBeats;
                
                // 包装playScheduledBeats方法以捕获音符数据
                window.metronome.playScheduledBeats = function(time) {
                    // 在调用原始方法之前，捕获当前状态
                    const ui = window.ui || { stepCount: 16, currentPattern: 0 };
                    const stepIndex = this.currentBeat % ui.stepCount;
                    const beat = Math.floor(this.currentBeat / 4);
                    
                    // 调用原始方法（这会触发实际的音符播放）
                    const result = originalPlayScheduledBeats.call(this, time);
                    
                    // 在原始方法调用后，如果可视化器启用，捕获触发的音符
                    if (self.isEnabled) {
                        self.captureNotesFromCurrentState(beat, stepIndex, time);
                    }
                    
                    return result;
                };
                
                console.log('✅ 成功钩入AudioSequencer.playScheduledBeats方法');
            } else {
                console.log('⏳ 等待AudioSequencer加载...');
                setTimeout(waitForAudioSequencer, 500);
            }
        };
        
        // 方法2: 直接钩入Tone.js的triggerAttackRelease方法
        const hookToneJS = () => {
            if (typeof Tone !== 'undefined' && Tone.Synth) {
                console.log('✅ 找到Tone.js，开始钩入triggerAttackRelease方法');
                
                // 保存原始的triggerAttackRelease方法
                const originalTriggerAttackRelease = Tone.Synth.prototype.triggerAttackRelease;
                
                // 包装triggerAttackRelease方法
                Tone.Synth.prototype.triggerAttackRelease = function(note, duration, time, velocity) {
                    // 调用原始方法
                    const result = originalTriggerAttackRelease.call(this, note, duration, time, velocity);
                    
                    // 如果可视化器启用，捕获音符信息
                    if (self.isEnabled) {
                        // 尝试从当前状态获取音符信息
                        self.captureNoteFromToneJS(note, duration, time, velocity, this);
                    }
                    
                    return result;
                };
                
                console.log('✅ 成功钩入Tone.Synth.triggerAttackRelease方法');
            } else {
                console.log('⏳ 等待Tone.js加载...');
                setTimeout(hookToneJS, 500);
            }
        };
        
        // 方法3: 监听beat事件作为备用
        window.addEventListener('beat', (event) => {
            if (self.isEnabled && event.detail) {
                console.log('beat事件捕获:', event.detail);
                const beatData = event.detail;
                if (beatData.active) {
                    self.captureNoteFromBeatEvent(beatData);
                }
            }
        });
        
        // 启动钩子
        waitForAudioSequencer();
        hookToneJS();
        
        // 添加手动测试方法
        window.testMusicVisualizer = () => {
            if (self.isEnabled) {
                // 手动添加测试音符
                for (let i = 0; i < 5; i++) {
                    self.addNoteToStream({
                        step: i,
                        preset: i % 3,
                        pitch: 60 + i * 2, // C4, D4, E4, F#4, G#4
                        velocity: 0.5 + (i * 0.1),
                        baseNote: 'C4',
                        pitchOffset: i * 2,
                        duration: 1.0 + i * 0.5, // 不同的持续时间
                        durationSeconds: (1.0 + i * 0.5) * 0.5,
                        time: Date.now(),
                        beat: 0
                    });
                }
                console.log('✅ 已添加5个测试音符到瀑布流');
            } else {
                console.log('❌ 请先显示音乐可视化器 (按V键)');
            }
        };
        
        console.log('🎵 音乐可视化器触发接口已设置完成');
        console.log('💡 运行 testMusicVisualizer() 来测试功能');
    }
    
    captureNotesFromCurrentState(beat, stepIndex, time) {
        // 从当前状态捕获所有激活的音符
        
        // 方法1: 从当前nodes获取数据
        if (typeof window.nodes !== 'undefined' && window.nodes.length > 0) {
            const ui = window.ui || { stepCount: 16, currentPattern: 0 };
            const currentPresetIndex = ui.currentPattern;
            
            for (let i = 0; i < window.nodes.length; i++) {
                const node = window.nodes[i];
                if (node.alpha && node.alpha[stepIndex] > 0.5) {
                    this.processNodeData(node, stepIndex, currentPresetIndex, beat, time);
                }
            }
        }
        
        // 方法2: 从presetPatterns获取其他预设的数据
        const presetPatterns = window.presetPatterns || [];
        for (let presetIndex = 0; presetIndex < presetPatterns.length; presetIndex++) {
            if (presetPatterns[presetIndex] && 
                presetPatterns[presetIndex].variants &&
                presetPatterns[presetIndex].variants.length > 0) {
                    
                const currentVariant = presetPatterns[presetIndex].currentVariant || 0;
                const presetVariant = presetPatterns[presetIndex].variants[currentVariant] || [];
                const presetNode = presetVariant.length > 0 ? presetVariant[0] : null;
                
                if (presetNode && presetNode.alpha && presetNode.alpha[stepIndex] > 0.5) {
                    this.processNodeData(presetNode, stepIndex, presetIndex, beat, time);
                }
            }
        }
    }
    
    captureNoteFromToneJS(note, duration, time, velocity, synthInstance) {
        // 从Tone.js的triggerAttackRelease调用中捕获音符信息
        
        // 尝试确定这是哪个预设的合成器
        let presetIndex = 0;
        if (window.metronome && window.metronome.presetSounds) {
            presetIndex = window.metronome.presetSounds.indexOf(synthInstance);
            if (presetIndex === -1) presetIndex = 0; // 如果找不到，默认为0
        }
        
        // 获取当前步骤信息
        const ui = window.ui || { stepCount: 16, currentPattern: 0 };
        const stepIndex = window.metronome ? (window.metronome.currentBeat % ui.stepCount) : 0;
        const beat = window.metronome ? Math.floor(window.metronome.currentBeat / 4) : 0;
        
        // 解析音符频率到MIDI音高
        let midiPitch = 60; // 默认C4
        try {
            if (typeof note === 'string') {
                // 音符名称转换为MIDI
                midiPitch = this.noteNameToMidi(note);
            } else if (typeof note === 'number') {
                // 如果是频率，转换为MIDI
                midiPitch = this.frequencyToMidi(note);
            }
        } catch (err) {
            console.warn('音符解析失败:', note, err);
        }
        
        // 获取速度（如果没有提供，使用默认值）
        const noteVelocity = velocity || 0.8;
        
        // 计算持续时间（从秒转换为步长倍数）
        let durationSteps = 1.0;
        if (window.metronome && duration) {
            const bpm = window.metronome.bpm || 120;
            const subdivision = window.metronome.subdivision || 16;
            const subdivisionDuration = 60 / bpm / (subdivision / 4);
            durationSteps = duration / subdivisionDuration;
        }
        
        // 添加到瀑布流
        this.addNoteToStream({
            step: stepIndex,
            preset: presetIndex,
            pitch: midiPitch,
            velocity: noteVelocity,
            duration: durationSteps,
            durationSeconds: duration || 0.5,
            baseNote: `C4`, // 从Tone.js无法反推基础音符，使用默认值
            pitchOffset: 0, // 从Tone.js无法反推偏移，使用默认值
            time: Date.now(),
            beat: beat
        });
        
        console.log(`ToneJS捕获音符: 预设${presetIndex}, 音符${note}, 时值${durationSteps.toFixed(2)}, 力度${noteVelocity.toFixed(2)}`);
    }
    
    captureNoteFromBeatEvent(beatData) {
        // 从beat事件中捕获音符信息
        const step = beatData.step || 0;
        const preset = beatData.preset || 0;
        const beat = beatData.beat || 0;
        
        // 这种情况下需要从当前状态获取详细信息
        this.captureNotesFromCurrentState(beat, step, Date.now());
    }
    
    processNodeData(node, stepIndex, presetIndex, beat, time) {
        // 处理单个节点的数据
        const velocity = node.alpha[stepIndex];
        const pitchOffset = node.pitchOffset ? node.pitchOffset[stepIndex] : 0;
        const duration = node.duration ? node.duration[stepIndex] : 1.0;
        
        // 获取预设的基础音高
        let baseNote = 'C4';
        if (window.metronome && window.metronome.baseNotes && window.metronome.baseNotes[presetIndex]) {
            baseNote = window.metronome.baseNotes[presetIndex];
        }
        
        // 计算最终音高
        const finalPitch = this.calculateFinalPitch(baseNote, pitchOffset);
        
        // 计算实际时值（秒）
        let noteDurationSeconds = 0.5;
        if (window.metronome && window.metronome.bpm) {
            const bpm = window.metronome.bpm;
            const subdivision = window.metronome.subdivision || 16;
            const subdivisionDuration = 60 / bpm / (subdivision / 4);
            noteDurationSeconds = subdivisionDuration * duration;
        }
        
        // 添加音符到瀑布流
        this.addNoteToStream({
            step: stepIndex,
            preset: presetIndex,
            pitch: finalPitch,
            velocity: velocity,
            duration: duration,
            durationSeconds: noteDurationSeconds,
            baseNote: baseNote,
            pitchOffset: pitchOffset,
            time: Date.now(),
            beat: beat
        });
        
        console.log(`状态捕获音符: 预设${presetIndex}, 步骤${stepIndex}, 音高${finalPitch}, 力度${velocity.toFixed(2)}, 时值${duration.toFixed(2)}`);
    }
    
    noteNameToMidi(noteName) {
        // 将音符名称转换为MIDI音高数字
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        
        // 解析音符名称 (例如 "C4", "F#3", "Bb5")
        const match = noteName.match(/([A-G][#b]?)(\d+)/);
        if (!match) return 60; // 默认C4
        
        const note = match[1];
        const octave = parseInt(match[2]);
        
        return (octave + 1) * 12 + (noteMap[note] || 0);
    }
    
    frequencyToMidi(frequency) {
        // 将频率转换为MIDI音高数字
        return Math.round(69 + 12 * Math.log2(frequency / 440));
    }
    
    captureNoteFromStepperEvent(beat, step, preset, active) {
        // 保留旧的方法以兼容，但使用新的processNodeData逻辑
        if (!active) return;
        
        // 从当前状态获取该步骤的详细信息
        this.captureNotesFromCurrentState(beat, step, Date.now());
    }
    
    calculateFinalPitch(baseNote, pitchOffset) {
        // 解析基础音符 (例如 "C4" -> C + 4)
        const match = baseNote.match(/([A-G][#b]?)(\d+)/);
        if (!match) return 60; // 默认中央C
        
        const noteName = match[1];
        const octave = parseInt(match[2]);
        
        // 音符到MIDI音高的映射
        const noteToMidi = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        
        const baseMidi = (octave + 1) * 12 + (noteToMidi[noteName] || 0);
        return baseMidi + pitchOffset;
    }
    
    addNoteToStream(noteData) {
        // 计算基于持续时间的宽度，使用与drawNote相同的映射逻辑
        const baseDuration = noteData.duration || 1.0;
        let calculatedWidth;
        
        if (baseDuration <= 0.25) {
            // 非常短的音符 (≤1/4步长) - 很窄
            calculatedWidth = 3;
        } else if (baseDuration <= 0.5) {
            // 短音符 (≤1/2步长) - 线性映射到4-6像素
            calculatedWidth = 3 + (baseDuration - 0.25) / 0.25 * 3;
        } else if (baseDuration <= 1.0) {
            // 正常音符 (≤1步长) - 线性映射到6-12像素
            calculatedWidth = 6 + (baseDuration - 0.5) / 0.5 * 6;
        } else if (baseDuration <= 2.0) {
            // 中长音符 (1-2步长) - 线性映射到12-24像素
            calculatedWidth = 12 + (baseDuration - 1.0) * 12;
        } else if (baseDuration <= 4.0) {
            // 长音符 (2-4步长) - 线性映射到24-48像素
            calculatedWidth = 24 + (baseDuration - 2.0) / 2.0 * 24;
        } else {
            // 超长音符 (>4步长) - 映射到48-80像素
            calculatedWidth = 48 + Math.min((baseDuration - 4.0) / 4.0, 1.0) * 32;
        }
        
        // 确保宽度在合理范围内
        calculatedWidth = Math.max(3, Math.min(80, calculatedWidth));
        
        // 添加新音符到瀑布流
        const note = {
            ...noteData,
            x: this.visualArea.width,  // 从右侧开始
            y: this.pitchToY(noteData.pitch),
            width: calculatedWidth,    // 使用计算后的宽度
            height: this.noteStream.noteHeight,
            alpha: 255,
            startTime: Date.now()
        };
        
        this.noteStream.activeNotes.push(note);
        
        // 限制最大音符数量
        if (this.noteStream.activeNotes.length > this.noteStream.maxNotes) {
            this.noteStream.activeNotes.shift();
        }
        
        console.log(`添加音符: 预设${noteData.preset}, 音高${noteData.pitch}, 步骤${noteData.step}, 时值${baseDuration.toFixed(2)}, 宽度${calculatedWidth.toFixed(1)}px`);
    }
    
    pitchToY(midiPitch) {
        // 将MIDI音高转换为Y坐标
        const centralC = 60; // C4
        const pitchOffset = midiPitch - centralC;
        
        // 将音高映射到可视化区域
        const centerY = this.visualArea.height / 2;
        const y = centerY - (pitchOffset * this.pitchRange.keyHeight);
        
        // 确保在可视范围内
        return Math.max(10, Math.min(this.visualArea.height - 20, y));
    }
    
    initP5Instance() {
        const sketch = (p) => {
            p.setup = () => {
                const canvas = p.createCanvas(400, 250);
                canvas.parent(this.container);
                p.colorMode(p.RGB);
                p.frameRate(60); // 提高帧率以获得流畅的瀑布流效果
                // 设置透明背景
                canvas.elt.style.background = 'transparent';
            };
            
            p.draw = () => {
                if (!this.isEnabled) return;
                
                // 清空画布，使用透明背景
                p.clear();
                
                // 绘制背景网格和钢琴键
                this.drawBackground(p);
                
                // 更新和绘制音符瀑布流
                this.updateAndDrawNotes(p);
                
                // 自动捕获逻辑
                this.handleAutoCapture();
                
                // 绘制捕获状态指示器
                this.drawCaptureIndicator(p);
            };
        };
        
        this.p5Instance = new p5(sketch);
    }
    
    drawBackground(p) {
        // 保持背景完全透明，不绘制任何网格线或背景元素
        return;
    }
    
    updateAndDrawNotes(p) {
        const currentTime = Date.now();
        
        // 更新音符位置和透明度
        for (let i = this.noteStream.activeNotes.length - 1; i >= 0; i--) {
            const note = this.noteStream.activeNotes[i];
            
            // 向左移动
            note.x -= this.noteStream.scrollSpeed;
            
            // 计算透明度（基于时间和位置）
            const age = currentTime - note.startTime;
            const positionFade = p.map(note.x, this.visualArea.width, 0, 1, 0.3);
            const timeFade = p.map(age, 0, this.noteStream.fadeTime, 1, 0);
            note.alpha = Math.max(0, Math.min(255, 255 * positionFade * timeFade));
            
            // 如果音符移出屏幕或完全透明，移除它
            if (note.x + note.width < this.visualArea.marginLeft || note.alpha <= 10) {
                this.noteStream.activeNotes.splice(i, 1);
                continue;
            }
            
            // 绘制音符
            this.drawNote(p, note);
        }
    }
    
    drawNote(p, note) {
        // 获取插槽颜色 - 使用多种方式尝试获取正确的插槽颜色
        let noteColor = [100, 255, 200]; // 默认青绿色作为备用
        
        try {
            // 方法1: 尝试从window.presetManager获取
            if (window.presetManager && typeof window.presetManager.getSlotColor === 'function') {
                const colorHex = window.presetManager.getSlotColor(note.preset);
                if (colorHex) {
                    // 将十六进制颜色转换为RGB
                    const hex = colorHex.replace('#', '');
                    const r = parseInt(hex.substr(0, 2), 16);
                    const g = parseInt(hex.substr(2, 2), 16);
                    const b = parseInt(hex.substr(4, 2), 16);
                    noteColor = [r, g, b];
                }
            }
            // 方法2: 尝试从全局presetSlotColors数组获取
            else if (window.presetSlotColors && window.presetSlotColors[note.preset]) {
                const colorHex = window.presetSlotColors[note.preset];
                if (colorHex) {
                    const hex = colorHex.replace('#', '');
                    const r = parseInt(hex.substr(0, 2), 16);
                    const g = parseInt(hex.substr(2, 2), 16);
                    const b = parseInt(hex.substr(4, 2), 16);
                    noteColor = [r, g, b];
                }
            }
            // 方法3: 尝试从window.presetManager.slotColors获取
            else if (window.presetManager && window.presetManager.slotColors && window.presetManager.slotColors[note.preset]) {
                const colorHex = window.presetManager.slotColors[note.preset];
                if (colorHex) {
                    const hex = colorHex.replace('#', '');
                    const r = parseInt(hex.substr(0, 2), 16);
                    const g = parseInt(hex.substr(2, 2), 16);
                    const b = parseInt(hex.substr(4, 2), 16);
                    noteColor = [r, g, b];
                }
            }
            // 方法4: 使用备用的预定义颜色（与Sketch.js中的predefinedColors对应）
            else {
                const predefinedColors = [
                    [255, 82, 82],   // 红色 #FF5252
                    [255, 152, 0],   // 橙色 #FF9800  
                    [255, 235, 59],  // 黄色 #FFEB3B
                    [76, 175, 80],   // 绿色 #4CAF50
                    [33, 150, 243],  // 蓝色 #2196F3
                    [103, 58, 183],  // 紫色 #673AB7
                    [233, 30, 99],   // 粉色 #E91E63
                    [0, 188, 212]    // 青色 #00BCD4
                ];
                
                const colorIndex = note.preset % predefinedColors.length;
                noteColor = predefinedColors[colorIndex];
            }
        } catch (err) {
            console.warn('获取插槽颜色失败，使用默认颜色:', err);
            // 使用备用颜色
            const fallbackColors = [
                [255, 82, 82],   // 红色
                [255, 152, 0],   // 橙色  
                [255, 235, 59],  // 黄色
                [76, 175, 80],   // 绿色
                [33, 150, 243],  // 蓝色
                [103, 58, 183],  // 紫色
                [233, 30, 99],   // 粉色
                [0, 188, 212]    // 青色
            ];
            const colorIndex = note.preset % fallbackColors.length;
            noteColor = fallbackColors[colorIndex];
        }
        
        const [r, g, b] = noteColor;
        
        // 根据速度调整亮度和高度
        const alpha = p.map(note.velocity, 0, 1, 0.6, 1.0);
        const noteHeight = p.map(note.velocity, 0, 1, 12, 20);
        
        // 根据持续时间调整音符宽度
        // duration是以步长为单位的倍数（如1.0表示一个步长，2.0表示两个步长）
        const baseDuration = note.duration || 1.0;
        
        // 使用更合理的宽度映射
        let noteWidth;
        if (baseDuration <= 0.25) {
            // 非常短的音符 (≤1/4步长) - 很窄
            noteWidth = 3;
        } else if (baseDuration <= 0.5) {
            // 短音符 (≤1/2步长) - 线性映射到4-6像素
            noteWidth = 3 + (baseDuration - 0.25) / 0.25 * 3;
        } else if (baseDuration <= 1.0) {
            // 正常音符 (≤1步长) - 线性映射到6-12像素
            noteWidth = 6 + (baseDuration - 0.5) / 0.5 * 6;
        } else if (baseDuration <= 2.0) {
            // 中长音符 (1-2步长) - 线性映射到12-24像素
            noteWidth = 12 + (baseDuration - 1.0) * 12;
        } else if (baseDuration <= 4.0) {
            // 长音符 (2-4步长) - 线性映射到24-48像素
            noteWidth = 24 + (baseDuration - 2.0) / 2.0 * 24;
        } else {
            // 超长音符 (>4步长) - 映射到48-80像素
            noteWidth = 48 + Math.min((baseDuration - 4.0) / 4.0, 1.0) * 32;
        }
        
        // 确保宽度在合理范围内
        noteWidth = p.constrain(noteWidth, 3, 80);
        
        // 如果持续时间非常长（>4倍），在音符上显示时值文字
        if (baseDuration >= 4.0) {
            p.fill(255, 255, 255, alpha * 200);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(8);
            p.text(`×${baseDuration.toFixed(1)}`, note.x, note.y);
        }
        
        // 设置颜色和透明度
        p.fill(r, g, b, alpha * 255);
        p.noStroke();
        
        // 绘制主音符矩形
        const cornerRadius = baseDuration > 1.0 ? 3 : 2;
        p.rect(note.x - noteWidth/2, note.y - noteHeight/2, noteWidth, noteHeight, cornerRadius);
        
        // 如果是长音符，添加特殊的边框效果
        if (baseDuration > 1.5) {
            // 绘制外边框，表示这是一个长音符
            p.stroke(r + 30, g + 30, b + 30, alpha * 180);
            p.strokeWeight(1.5);
            p.noFill();
            p.rect(note.x - noteWidth/2, note.y - noteHeight/2, noteWidth, noteHeight, cornerRadius);
            
            // 添加内部分段线，表示音符持续时间
            if (baseDuration >= 2.0) {
                p.stroke(r + 50, g + 50, b + 50, alpha * 120);
                p.strokeWeight(0.5);
                
                // 每个步长添加一条分段线
                const segmentWidth = noteWidth / baseDuration;
                for (let i = 1; i < Math.floor(baseDuration); i++) {
                    const lineX = note.x - noteWidth/2 + (i * segmentWidth);
                    p.line(lineX, note.y - noteHeight/2 + 2, lineX, note.y + noteHeight/2 - 2);
                }
            }
        } else {
            // 普通音符的高亮边缘效果
            p.stroke(r + 50, g + 50, b + 50, alpha * 200);
            p.strokeWeight(1);
            p.noFill();
            p.rect(note.x - noteWidth/2, note.y - noteHeight/2, noteWidth, noteHeight, cornerRadius);
        }
    }
    
    midiToPitchName(midiPitch) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiPitch / 12) - 1;
        const noteName = noteNames[midiPitch % 12];
        return `${noteName}${octave}`;
    }
    
    drawInfoPanel(p) {
        // 不显示任何信息面板，保持瀑布流纯净
        return;
    }
    
    show() {
        this.isEnabled = true;
        this.container.style.display = 'block';
        console.log(this.getText('shown'));
    }
    
    hide() {
        this.isEnabled = false;
        this.container.style.display = 'none';
        console.log(this.getText('hidden'));
    }
    
    toggle() {
        if (this.isEnabled) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    destroy() {
        if (this.p5Instance) {
            this.p5Instance.remove();
        }
        if (this.container) {
            this.container.remove();
        }
        if (this.aiImageAnimation.container) {
            this.aiImageAnimation.container.remove();
        }
        // 停止动画循环
        if (this.aiImageAnimation.animationFrame) {
            cancelAnimationFrame(this.aiImageAnimation.animationFrame);
        }
    }
    
    // =============== 图像捕获功能 ===============
    
    /**
     * 手动捕获当前帧
     * @param {string} source - 捕获来源 ('manual', 'auto', 'event')
     */
    captureCurrentFrame(source = 'manual') {
        if (!this.p5Instance || !this.isEnabled) {
            console.warn('无法捕获：可视化器未启用');
            return null;
        }
        
        try {
            // 获取canvas元素
            const canvas = this.p5Instance.canvas;
            if (!canvas) {
                console.warn('无法找到canvas元素');
                return null;
            }
            
            // 生成文件名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const noteCount = this.noteStream.activeNotes.length;
            const filename = `waterfall_${source}_${timestamp}_notes${noteCount}`;
            
            // 捕获图像
            const dataURL = canvas.toDataURL(`image/${this.captureSettings.captureFormat}`, this.captureSettings.captureQuality);
            
            // 更新捕获统计
            this.captureSettings.captureCount++;
            this.captureSettings.lastCaptureTime = Date.now();
            
            // 自动下载图像
            this.downloadImage(dataURL, filename);
            
            // 显示捕获成功提示
            this.showCaptureNotification(source, noteCount);
            
            console.log(`${this.getText('captureSuccess')}: ${filename}, ${this.getText('capture', 'notes')}: ${noteCount}, ${source}`);
            
            return {
                dataURL: dataURL,
                filename: filename,
                timestamp: timestamp,
                noteCount: noteCount,
                source: source,
                dimensions: {
                    width: canvas.width,
                    height: canvas.height
                }
            };
            
        } catch (error) {
            console.error('图像捕获失败:', error);
            return null;
        }
    }
    
    /**
     * 下载图像文件
     */
    downloadImage(dataURL, filename) {
        const link = document.createElement('a');
        link.download = `${filename}.${this.captureSettings.captureFormat}`;
        link.href = dataURL;
        
        // 临时添加到DOM并点击
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * 切换自动捕获模式
     */
    toggleAutoCapture() {
        this.captureSettings.autoCapture = !this.captureSettings.autoCapture;
        
        if (this.captureSettings.autoCapture) {
            console.log(`${this.getText('autoCapture', 'enabled')} (${this.getText('autoCapture', 'interval')}: ${this.captureSettings.captureInterval}ms, ${this.getText('autoCapture', 'minNotes')}: ${this.captureSettings.minNotesForCapture})`);
        } else {
            console.log(this.getText('autoCapture', 'disabled'));
        }
        
        // 显示状态变化
        this.showCaptureNotification(this.captureSettings.autoCapture ? 'auto_on' : 'auto_off');
    }
    
    /**
     * 处理自动捕获逻辑
     */
    handleAutoCapture() {
        if (!this.captureSettings.autoCapture) return;
        
        const currentTime = Date.now();
        const timeSinceLastCapture = currentTime - this.captureSettings.lastCaptureTime;
        
        // 检查是否到了捕获间隔
        if (timeSinceLastCapture >= this.captureSettings.captureInterval) {
            // 检查当前是否有足够的音符值得捕获
            const activeNoteCount = this.noteStream.activeNotes.length;
            
            if (activeNoteCount >= this.captureSettings.minNotesForCapture) {
                this.captureCurrentFrame('auto');
            }
        }
    }
    
    /**
     * 绘制捕获状态指示器
     */
    drawCaptureIndicator(p) {
        // 不显示任何捕获状态指示器
        return;
    }
    
    /**
     * 显示捕获通知
     */
    showCaptureNotification(type, noteCount = 0) {
        // 创建临时通知元素
        const notification = document.createElement('div');
        
        let message = '';
        let bgColor = '';
        
        switch (type) {
            case 'manual':
                message = `${this.getText('capture', 'manual')} (${noteCount} ${this.getText('capture', 'notes')})`;
                bgColor = 'rgba(0, 150, 255, 0.9)';
                break;
            case 'auto':
                message = `${this.getText('capture', 'auto')} (${noteCount} ${this.getText('capture', 'notes')})`;
                bgColor = 'rgba(255, 100, 0, 0.9)';
                break;
            case 'auto_on':
                message = this.getText('autoCapture', 'enabled');
                bgColor = 'rgba(0, 200, 0, 0.9)';
                break;
            case 'auto_off':
                message = this.getText('autoCapture', 'disabled');
                bgColor = 'rgba(200, 0, 0, 0.9)';
                break;
            default:
                message = this.getText('captureSuccess');
                bgColor = 'rgba(100, 100, 100, 0.9)';
        }
        
        notification.innerHTML = message;
        notification.style.cssText = `
            position: fixed;
            top: 50px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 8px 16px;
            border-radius: 5px;
            font-size: 12px;
            font-family: monospace;
            z-index: 10000;
            animation: slideInOut 2s ease-in-out;
        `;
        
        // 添加动画样式
        if (!document.getElementById('capture-notification-style')) {
            const style = document.createElement('style');
            style.id = 'capture-notification-style';
            style.textContent = `
                @keyframes slideInOut {
                    0% { transform: translateX(100%); opacity: 0; }
                    20% { transform: translateX(0); opacity: 1; }
                    80% { transform: translateX(0); opacity: 1; }
                    100% { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // 2秒后移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    }
    
    /**
     * 导出捕获信息摘要
     */
    exportCaptureInfo() {
        const info = {
            totalCaptures: this.captureSettings.captureCount,
            autoCapture: this.captureSettings.autoCapture,
            captureInterval: this.captureSettings.captureInterval,
            lastCaptureTime: new Date(this.captureSettings.lastCaptureTime).toISOString(),
            currentActiveNotes: this.noteStream.activeNotes.length,
            settings: {
                format: this.captureSettings.captureFormat,
                quality: this.captureSettings.captureQuality,
                minNotesForCapture: this.captureSettings.minNotesForCapture
            }
        };
        
        console.log('🎵 音高瀑布流捕获统计:', info);
        
        // 复制到剪贴板
        navigator.clipboard.writeText(JSON.stringify(info, null, 2)).then(() => {
            this.showCaptureNotification('info_copied');
            console.log('📋 捕获信息已复制到剪贴板');
        }).catch(err => {
            console.warn('无法复制到剪贴板:', err);
        });
        
        return info;
    }
    
    /**
     * 设置捕获参数
     */
    setCaptureSettings(settings) {
        Object.assign(this.captureSettings, settings);
        console.log('🔧 捕获设置已更新:', this.captureSettings);
    }
    
    /**
     * 获取当前画布的数据URL（不下载）
     */
    getCanvasDataURL() {
        if (!this.p5Instance || !this.isEnabled) {
            return null;
        }
        
        try {
            const canvas = this.p5Instance.canvas;
            return canvas.toDataURL(`image/${this.captureSettings.captureFormat}`, this.captureSettings.captureQuality);
        } catch (error) {
            console.error('获取canvas数据失败:', error);
            return null;
        }
    }
    
    // =============== AI图像诞生动画功能 ===============
    
    /**
     * 启动AI图像诞生动画
     * @param {string} imageURL - 生成的AI图像URL
     * @param {object} targetElement - 目标容器元素 (可选)
     */
    startAIImageBirthAnimation(imageURL, targetElement = null) {
        if (!this.isEnabled || !imageURL) {
            console.warn('无法启动AI诞生动画：可视化器未启用或图像URL为空');
            return;
        }
        
        console.log('🎬 启动AI图像诞生动画');
        
        console.log(this.getText('animation', 'started'));
        
        // 重置动画状态
        this.aiImageAnimation.isActive = true;
        this.aiImageAnimation.imageData = imageURL;
        this.aiImageAnimation.particles = [];
        this.aiImageAnimation.imageLoaded = false;
        this.aiImageAnimation.imageElement = null;
        
        // 显示动画容器
        this.aiImageAnimation.container.style.display = 'block';
        
        // 开始加载真实的AI图像
        this.loadAIImage(imageURL);
        
        // 计算起始位置（瀑布流中心的全屏坐标）
        const waterfallRect = this.container.getBoundingClientRect();
        const startX = waterfallRect.left + waterfallRect.width / 2;
        const startY = waterfallRect.top + waterfallRect.height / 2;
        
        // 设置起始位置
        this.aiImageAnimation.birthEffect.centerX = startX;
        this.aiImageAnimation.birthEffect.centerY = startY;
        this.aiImageAnimation.flyingImage.startX = startX;
        this.aiImageAnimation.flyingImage.startY = startY;
        this.aiImageAnimation.flyingImage.x = startX;
        this.aiImageAnimation.flyingImage.y = startY;
        
        // 计算目标位置和尺寸（全屏坐标）
        if (targetElement) {
            const targetRect = targetElement.getBoundingClientRect();
            this.aiImageAnimation.flyingImage.targetX = targetRect.left + targetRect.width / 2;
            this.aiImageAnimation.flyingImage.targetY = targetRect.top + targetRect.height / 2;
            
            // 设置放大动画的目标参数
            this.aiImageAnimation.expandingImage.x = targetRect.left + targetRect.width / 2;
            this.aiImageAnimation.expandingImage.y = targetRect.top + targetRect.height / 2;
            this.aiImageAnimation.expandingImage.targetWidth = targetRect.width;
            this.aiImageAnimation.expandingImage.targetHeight = targetRect.height;
            this.aiImageAnimation.expandingImage.targetSize = Math.max(targetRect.width, targetRect.height);
        } else {
            // 默认目标位置（右下角）
            this.aiImageAnimation.flyingImage.targetX = window.innerWidth - 100;
            this.aiImageAnimation.flyingImage.targetY = window.innerHeight - 100;
            
            // 默认放大参数
            this.aiImageAnimation.expandingImage.x = window.innerWidth - 100;
            this.aiImageAnimation.expandingImage.y = window.innerHeight - 100;
            this.aiImageAnimation.expandingImage.targetWidth = 200;
            this.aiImageAnimation.expandingImage.targetHeight = 200;
            this.aiImageAnimation.expandingImage.targetSize = 200;
        }
        
        // 启动诞生效果
        this.aiImageAnimation.birthEffect.active = true;
        this.aiImageAnimation.birthEffect.startTime = Date.now();
        
        // 生成诞生粒子
        this.generateBirthParticles();
        
        // 启动动画循环
        this.startAnimationLoop();
        
        // 1.5秒后启动飞行动画
        setTimeout(() => {
            this.startFlyingImageAnimation();
        }, this.aiImageAnimation.birthEffect.duration);
        
        console.log(`🌟 AI图像诞生动画序列开始`);
        console.log(`   📍 起始位置: (${startX.toFixed(0)}, ${startY.toFixed(0)})`);
        console.log(`   🎯 目标位置: (${this.aiImageAnimation.flyingImage.targetX.toFixed(0)}, ${this.aiImageAnimation.flyingImage.targetY.toFixed(0)})`);
        console.log(`   📐 目标尺寸: ${this.aiImageAnimation.expandingImage.targetWidth}x${this.aiImageAnimation.expandingImage.targetHeight}px`);
        console.log(`   ⏱️ 总时长: 4.5秒 (诞生1.5s + 飞行2s + 放大1s)`);
    }
    
    /**
     * 加载AI图像
     */
    loadAIImage(imageURL) {
        console.log('🖼️ 开始加载AI图像...');
        
        this.aiImageAnimation.imageElement = new Image();
        this.aiImageAnimation.imageElement.crossOrigin = 'anonymous';
        
        this.aiImageAnimation.imageElement.onload = () => {
            this.aiImageAnimation.imageLoaded = true;
            console.log('✅ AI图像加载成功');
            console.log(`   📐 图像尺寸: ${this.aiImageAnimation.imageElement.width}x${this.aiImageAnimation.imageElement.height}px`);
        };
        
        this.aiImageAnimation.imageElement.onerror = (error) => {
            console.error('❌ AI图像加载失败:', error);
            this.aiImageAnimation.imageLoaded = false;
            // 即使加载失败，也继续动画（使用占位符）
        };
        
        // 开始加载
        this.aiImageAnimation.imageElement.src = imageURL;
    }
    
    /**
     * 启动动画循环
     */
    startAnimationLoop() {
        if (!this.aiImageAnimation.animationFrame) {
            const animate = () => {
                if (this.aiImageAnimation.isActive) {
                    this.updateAndDrawAnimation();
                    this.aiImageAnimation.animationFrame = requestAnimationFrame(animate);
                } else {
                    this.aiImageAnimation.animationFrame = null;
                    // 延迟隐藏动画容器，确保右侧面板图像有时间显示
                    setTimeout(() => {
                        this.aiImageAnimation.container.style.display = 'none';
                    }, 100);
                }
            };
            this.aiImageAnimation.animationFrame = requestAnimationFrame(animate);
        }
    }
    
    /**
     * 生成诞生粒子效果
     */
    generateBirthParticles() {
        const centerX = this.aiImageAnimation.birthEffect.centerX;
        const centerY = this.aiImageAnimation.birthEffect.centerY;
        
        // 生成围绕瀑布流的粒子
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            const radius = 20 + Math.random() * 40;
            
            this.aiImageAnimation.particles.push({
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
                vx: Math.cos(angle) * (2 + Math.random() * 3),
                vy: Math.sin(angle) * (2 + Math.random() * 3),
                size: 3 + Math.random() * 5,
                color: [100 + Math.random() * 155, 150 + Math.random() * 105, 200 + Math.random() * 55],
                alpha: 255,
                life: 1.0,
                decay: 0.01 + Math.random() * 0.02
            });
        }
        
        // 添加一些从音符位置发射的粒子（需要转换坐标）
        const waterfallRect = this.container.getBoundingClientRect();
        this.noteStream.activeNotes.forEach(note => {
            if (Math.random() < 0.3) { // 30%的音符参与
                for (let i = 0; i < 3; i++) {
                    // 将音符位置转换为全屏坐标
                    const noteScreenX = waterfallRect.left + note.x;
                    const noteScreenY = waterfallRect.top + note.y;
                    
                    this.aiImageAnimation.particles.push({
                        x: noteScreenX,
                        y: noteScreenY,
                        vx: (centerX - noteScreenX) * 0.02 + (Math.random() - 0.5) * 2,
                        vy: (centerY - noteScreenY) * 0.02 + (Math.random() - 0.5) * 2,
                        size: 2 + Math.random() * 3,
                        color: [note.preset * 30 % 255, 100 + Math.random() * 100, 200],
                        alpha: 180,
                        life: 1.0,
                        decay: 0.015 + Math.random() * 0.01
                    });
                }
            }
        });
    }
    
    /**
     * 启动飞行图像动画
     */
    startFlyingImageAnimation() {
        // 结束诞生效果
        this.aiImageAnimation.birthEffect.active = false;
        
        // 启动飞行动画
        this.aiImageAnimation.flyingImage.active = true;
        this.aiImageAnimation.flyingImage.startTime = Date.now();
        
        // 重置飞行图像位置和状态
        this.aiImageAnimation.flyingImage.x = this.aiImageAnimation.flyingImage.startX;
        this.aiImageAnimation.flyingImage.y = this.aiImageAnimation.flyingImage.startY;
        this.aiImageAnimation.flyingImage.rotation = 0;
        
        console.log('✈️ 飞行动画开始');
        console.log(`   从 (${this.aiImageAnimation.flyingImage.startX.toFixed(0)}, ${this.aiImageAnimation.flyingImage.startY.toFixed(0)}) 到 (${this.aiImageAnimation.flyingImage.targetX.toFixed(0)}, ${this.aiImageAnimation.flyingImage.targetY.toFixed(0)})`);
    }
    
    /**
     * 更新和绘制AI动画（使用独立canvas）
     */
    updateAndDrawAnimation() {
        if (!this.aiImageAnimation.isActive || !this.aiImageAnimation.context) return;
        
        const ctx = this.aiImageAnimation.context;
        const currentTime = Date.now();
        
        // 清空画布
        ctx.clearRect(0, 0, this.aiImageAnimation.canvas.width, this.aiImageAnimation.canvas.height);
        
        // 更新和绘制诞生效果
        if (this.aiImageAnimation.birthEffect.active) {
            this.updateAndDrawBirthEffect(ctx, currentTime);
        }
        
        // 更新和绘制粒子
        this.updateAndDrawParticles(ctx);
        
        // 更新和绘制飞行图像
        if (this.aiImageAnimation.flyingImage.active) {
            this.updateAndDrawFlyingImage(ctx, currentTime);
        }
        
        // 更新和绘制放大图像
        if (this.aiImageAnimation.expandingImage.active) {
            this.updateAndDrawExpandingImage(ctx, currentTime);
        }
    }
    
    /**
     * 更新和绘制诞生效果
     */
    updateAndDrawBirthEffect(ctx, currentTime) {
        const effect = this.aiImageAnimation.birthEffect;
        const elapsed = currentTime - effect.startTime;
        const progress = Math.min(elapsed / effect.duration, 1.0);
        
        // 绘制能量波纹
        for (let i = 0; i < 3; i++) {
            const waveProgress = (progress + i * 0.3) % 1.0;
            const radius = waveProgress * effect.maxRadius;
            const alpha = (1.0 - waveProgress) * 0.6;
            
            ctx.beginPath();
            ctx.arc(effect.centerX, effect.centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
            ctx.lineWidth = 2 - waveProgress;
            ctx.stroke();
        }
        
        // 绘制中心发光效果
        const glowAlpha = Math.sin(progress * Math.PI) * 0.4;
        const centerRadius = 20 + Math.sin(elapsed * 0.01) * 5;
        
        ctx.beginPath();
        ctx.arc(effect.centerX, effect.centerY, centerRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(150, 220, 255, ${glowAlpha})`;
        ctx.fill();
        
        // 绘制魔法线条从音符连接到中心
        const waterfallRect = this.container.getBoundingClientRect();
        this.noteStream.activeNotes.forEach((note, index) => {
            if (index % 3 === 0) { // 每三个音符画一条线
                const lineAlpha = Math.sin(progress * Math.PI + index) * 0.3;
                
                // 将音符位置转换为全屏坐标
                const noteScreenX = waterfallRect.left + note.x;
                const noteScreenY = waterfallRect.top + note.y;
                
                ctx.beginPath();
                ctx.moveTo(noteScreenX, noteScreenY);
                ctx.lineTo(effect.centerX, effect.centerY);
                ctx.strokeStyle = `rgba(${note.preset * 40 % 255}, 150, 255, ${lineAlpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        });
    }
    
    /**
     * 更新和绘制粒子
     */
    updateAndDrawParticles(ctx) {
        for (let i = this.aiImageAnimation.particles.length - 1; i >= 0; i--) {
            const particle = this.aiImageAnimation.particles[i];
            
            // 更新粒子
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= particle.decay;
            particle.alpha = particle.life;
            
            // 移除死亡的粒子
            if (particle.life <= 0) {
                this.aiImageAnimation.particles.splice(i, 1);
                continue;
            }
            
            const alpha = particle.alpha;
            const size = particle.size * particle.life;
            
            // 绘制发光效果
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, size * 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${alpha * 0.3})`;
            ctx.fill();
            
            // 绘制主粒子
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${alpha})`;
            ctx.fill();
        }
    }
    
    /**
     * 更新和绘制飞行图像
     */
    updateAndDrawFlyingImage(ctx, currentTime) {
        const flyingImg = this.aiImageAnimation.flyingImage;
        const elapsed = currentTime - flyingImg.startTime;
        const progress = Math.min(elapsed / flyingImg.duration, 1.0);
        
        // 使用easeInOutCubic缓动函数
        const easeProgress = progress < 0.5 
            ? 4 * progress * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        // 更新位置
        flyingImg.x = flyingImg.startX + (flyingImg.targetX - flyingImg.startX) * easeProgress;
        flyingImg.y = flyingImg.startY + (flyingImg.targetY - flyingImg.startY) * easeProgress;
        
        // 添加轻微的摆动
        flyingImg.y += Math.sin(elapsed * 0.005) * 10 * (1 - progress);
        
        // 更新旋转
        flyingImg.rotation += 2; // 慢速旋转
        
        // 计算大小（开始小，然后变大，最后变小）
        let size = flyingImg.size;
        if (progress < 0.3) {
            size *= (0.5 + progress / 0.3 * 0.5); // 从50%到100%
        } else if (progress > 0.8) {
            size *= (1.0 - (progress - 0.8) / 0.2 * 0.3); // 从100%到70%
        }
        
        // 绘制飞行轨迹
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.4 * (1 - progress)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        const trailLength = 20;
        for (let i = 0; i < trailLength; i++) {
            const trailProgress = Math.max(0, easeProgress - i * 0.02);
            const trailX = flyingImg.startX + (flyingImg.targetX - flyingImg.startX) * trailProgress;
            const trailY = flyingImg.startY + (flyingImg.targetY - flyingImg.startY) * trailProgress + Math.sin((elapsed - i * 100) * 0.005) * 10 * (1 - trailProgress);
            
            if (i === 0) {
                ctx.moveTo(trailX, trailY);
            } else {
                ctx.lineTo(trailX, trailY);
            }
        }
        ctx.stroke();
        
        // 绘制飞行图像的阴影
        ctx.beginPath();
        ctx.arc(flyingImg.x + 5, flyingImg.y + 5, size / 2 + 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.2 * (1 - progress)})`;
        ctx.fill();
        
        // 保存canvas状态，进行旋转绘制
        ctx.save();
        ctx.translate(flyingImg.x, flyingImg.y);
        ctx.rotate(flyingImg.rotation * Math.PI / 180);
        
        // 绘制发光边框
        ctx.beginPath();
        ctx.rect(-size/2, -size/2, size, size);
        ctx.strokeStyle = `rgba(200, 230, 255, ${0.6 * (1 - progress * 0.5)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 绘制真实的AI图像或占位符
        if (this.aiImageAnimation.imageLoaded && this.aiImageAnimation.imageElement) {
            // 使用真实的AI图像
            try {
                ctx.drawImage(this.aiImageAnimation.imageElement, -size/2, -size/2, size, size);
                
                // 在图像上添加轻微的发光遮罩
                ctx.beginPath();
                ctx.rect(-size/2, -size/2, size, size);
                ctx.fillStyle = `rgba(100, 200, 255, ${0.2 * (1 - progress * 0.5)})`;
                ctx.fill();
            } catch (error) {
                console.warn('绘制AI图像失败，使用占位符:', error);
                this.drawImagePlaceholder(ctx, size);
            }
        } else {
            // 使用占位符
            this.drawImagePlaceholder(ctx, size);
        }
        
        // 恢复canvas状态
        ctx.restore();
        
        // 检查飞行动画是否完成
        if (progress >= 1.0) {
            this.aiImageAnimation.flyingImage.active = false;
            console.log('✈️ 飞行动画完成，开始放大动画');
            
            // 启动放大动画
            this.startExpandingImageAnimation();
        }
    }
    
    /**
     * 绘制图像占位符
     */
    drawImagePlaceholder(ctx, size) {
        // 绘制主要图像背景
        ctx.beginPath();
        ctx.rect(-size/2, -size/2, size, size);
        ctx.fillStyle = `rgba(100, 200, 100, 0.8)`;
        ctx.fill();
        
        // 绘制AI图标文字
        ctx.fillStyle = `rgba(255, 255, 255, 0.9)`;
        ctx.font = `${size * 0.3}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎨', 0, 0);
    }
    
    /**
     * 绘制放大时的占位符
     */
    drawExpandingPlaceholder(ctx, width, height, progress, opacity) {
        // 绘制主体（从绿色AI图标渐变到透明，为真实图像让路）
        const bgOpacity = opacity * (1 - progress * 0.8); // 背景逐渐消失
        ctx.beginPath();
        ctx.rect(-width/2, -height/2, width, height);
        ctx.fillStyle = `rgba(100, 200, 100, ${bgOpacity})`;
        ctx.fill();
        
        // 绘制AI图标（逐渐缩小并淡出）
        if (bgOpacity > 0.1) {
            const iconSize = Math.max(12, width * 0.2 * (1 - progress * 0.7));
            ctx.fillStyle = `rgba(255, 255, 255, ${bgOpacity})`;
            ctx.font = `${iconSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🎨', 0, 0);
        }
    }
    
    /**
     * 启动放大图像动画
     */
    startExpandingImageAnimation() {
        const expanding = this.aiImageAnimation.expandingImage;
        
        // 设置放大动画初始状态
        expanding.active = true;
        expanding.startTime = Date.now();
        expanding.startSize = this.aiImageAnimation.flyingImage.size;
        expanding.currentSize = expanding.startSize;
        expanding.rotation = this.aiImageAnimation.flyingImage.rotation;
        expanding.opacity = 1.0;
        
        console.log('🔍 放大动画开始');
        console.log(`   📏 从 ${expanding.startSize}px 放大到 ${expanding.targetWidth}x${expanding.targetHeight}px`);
        console.log(`   🎯 将铺满整个目标容器`);
    }
    
    /**
     * 更新和绘制放大图像
     */
    updateAndDrawExpandingImage(ctx, currentTime) {
        const expanding = this.aiImageAnimation.expandingImage;
        const elapsed = currentTime - expanding.startTime;
        const progress = Math.min(elapsed / expanding.duration, 1.0);
        
        // 使用easeOutCubic缓动函数（更适合放大效果）
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        // 计算当前尺寸
        expanding.currentSize = expanding.startSize + (expanding.targetSize - expanding.startSize) * easeProgress;
        
        // 计算宽高（保持比例或填充容器）
        let width, height;
        if (expanding.targetWidth && expanding.targetHeight) {
            // 填充整个容器
            width = expanding.startSize + (expanding.targetWidth - expanding.startSize) * easeProgress;
            height = expanding.startSize + (expanding.targetHeight - expanding.startSize) * easeProgress;
        } else {
            // 等比例放大
            width = height = expanding.currentSize;
        }
        
        // 逐渐将旋转归零到正位
        expanding.rotation = expanding.rotation * (1 - easeProgress * 0.8); // 逐渐回到正位
        
        // 保存canvas状态
        ctx.save();
        ctx.translate(expanding.x, expanding.y);
        ctx.rotate(expanding.rotation * Math.PI / 180);
        
        // 绘制放大的阴影
        ctx.beginPath();
        ctx.rect(-width/2 + 3, -height/2 + 3, width, height);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * expanding.opacity * (1 - progress * 0.5)})`;
        ctx.fill();
        
        // 绘制发光边框（带脉动效果）
        const pulseIntensity = 1 + Math.sin(elapsed * 0.008) * 0.3; // 脉动效果
        const borderOpacity = 0.8 * expanding.opacity * (1 - progress * 0.3) * pulseIntensity;
        
        // 外发光
        ctx.beginPath();
        ctx.rect(-width/2 - 2, -height/2 - 2, width + 4, height + 4);
        ctx.strokeStyle = `rgba(100, 200, 255, ${borderOpacity * 0.3})`;
        ctx.lineWidth = 6 * (1 - progress * 0.3);
        ctx.stroke();
        
        // 主边框
        ctx.beginPath();
        ctx.rect(-width/2, -height/2, width, height);
        ctx.strokeStyle = `rgba(200, 230, 255, ${borderOpacity})`;
        ctx.lineWidth = 3 * (1 - progress * 0.5);
        ctx.stroke();
        
        // 绘制真实的AI图像或占位符（逐渐放大）
        if (this.aiImageAnimation.imageLoaded && this.aiImageAnimation.imageElement) {
            // 使用真实的AI图像
            try {
                ctx.drawImage(this.aiImageAnimation.imageElement, -width/2, -height/2, width, height);
                
                // 在图像上添加渐变消失的发光遮罩
                const overlayOpacity = expanding.opacity * (1 - progress * 0.9);
                if (overlayOpacity > 0.05) {
                    ctx.beginPath();
                    ctx.rect(-width/2, -height/2, width, height);
                    ctx.fillStyle = `rgba(100, 200, 255, ${overlayOpacity * 0.3})`;
                    ctx.fill();
                }
            } catch (error) {
                console.warn('绘制放大AI图像失败，使用占位符:', error);
                this.drawExpandingPlaceholder(ctx, width, height, progress, expanding.opacity);
            }
        } else {
            // 使用占位符
            this.drawExpandingPlaceholder(ctx, width, height, progress, expanding.opacity);
        }
        
        // 绘制放大时的边缘粒子效果
        if (progress > 0.2) {
            const particleCount = 8;
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2;
                const distance = Math.max(width, height) / 2 + 10 + Math.sin(elapsed * 0.01 + i) * 5;
                const particleX = Math.cos(angle) * distance;
                const particleY = Math.sin(angle) * distance;
                const particleSize = 3 + Math.sin(elapsed * 0.015 + i) * 2;
                const particleOpacity = (progress - 0.2) * 0.6 * (1 - (progress - 0.2) / 0.8);
                
                ctx.beginPath();
                ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(100, 200, 255, ${particleOpacity})`;
                ctx.fill();
            }
        }
        
        // 如果接近完成，绘制"即将显示真实图像"的提示
        if (progress > 0.7) {
            const textOpacity = (progress - 0.7) / 0.3;
            ctx.fillStyle = `rgba(255, 255, 255, ${textOpacity * 0.8})`;
            ctx.font = `${Math.min(16, width * 0.08)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🖼️', 0, height * 0.15);
        }
        
        // 恢复canvas状态
        ctx.restore();
        
        // 检查放大动画是否完成
        if (progress >= 1.0) {
            expanding.active = false;
            expanding.rotation = 0; // 确保最终旋转为正位
            
            // 直接结束整个动画
            this.aiImageAnimation.isActive = false;
            console.log('🔍 放大动画完成');
            console.log('🎬 AI图像诞生动画序列完美结束');
            
            // 触发最终完成效果
            this.onAIAnimationComplete();
        }
    }
    

    
    /**
     * 动画完成时的回调
     */
    onAIAnimationComplete() {
        // 这里可以触发一些完成后的效果
        console.log('✨ AI图像已完美放大并回到正位');
        console.log('🖼️ 实际AI生成的图像即将显示在右侧面板');
        console.log('🎊 动画序列干净利落地结束！');
    }
}

// 初始化音乐可视化器
function initMusicVisualizer() {
    // 等待必要组件加载完成
    if (typeof p5 === 'undefined') {
        console.warn('P5.js未加载，音乐可视化器初始化失败');
        return;
    }
    
    window.musicVisualizer = new MusicVisualizer();
    
    // 添加全局切换函数
    window.toggleMusicVisualizer = () => {
        if (window.musicVisualizer) {
            window.musicVisualizer.toggle();
        }
    };
    
    // 添加全局捕获函数
    window.captureWaterfall = (source = 'manual') => {
        if (window.musicVisualizer) {
            return window.musicVisualizer.captureCurrentFrame(source);
        }
        return null;
    };
    
    // 添加全局获取数据URL函数（用于云端处理）
    window.getWaterfallImage = () => {
        if (window.musicVisualizer) {
            return window.musicVisualizer.getCanvasDataURL();
        }
        return null;
    };
    
    // 添加全局自动捕获切换函数
    window.toggleAutoCapture = () => {
        if (window.musicVisualizer) {
            window.musicVisualizer.toggleAutoCapture();
        }
    };
    
    // 添加全局AI动画测试函数
    window.testAIBirthAnimation = () => {
        if (window.musicVisualizer && window.musicVisualizer.isEnabled) {
            // 使用一个测试图像URL
            const testImageURL = 'data:image/svg+xml;utf8,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="%234CAF50"/><text x="50" y="50" font-family="monospace" font-size="14" fill="white" text-anchor="middle" dy=".3em">🎨</text></svg>';
            
            // 创建一个测试目标元素，位于屏幕右下角
            let testTarget = document.getElementById('test-animation-target');
            if (!testTarget) {
                testTarget = document.createElement('div');
                testTarget.id = 'test-animation-target';
                testTarget.style.cssText = `
                    position: fixed;
                    bottom: 50px;
                    right: 50px;
                    width: 200px;
                    height: 150px;
                    background: rgba(76, 175, 80, 0.2);
                    border: 3px dashed #4CAF50;
                    border-radius: 8px;
                    z-index: 1000;
                    pointer-events: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: monospace;
                    color: #4CAF50;
                    font-size: 12px;
                `;
                
                // 使用多语言文本
                const targetText = window.languageManager ? 
                    window.languageManager.getText('musicVisualizer', 'testTarget') : 
                    '🎯 Expansion Target Area';
                testTarget.innerHTML = targetText;
                testTarget.setAttribute('title', '真实AI图像将放大并铺满这个区域');
                document.body.appendChild(testTarget);
                
                // 6秒后移除测试目标（等动画完全结束）
                setTimeout(() => {
                    if (testTarget.parentNode) {
                        testTarget.parentNode.removeChild(testTarget);
                    }
                }, 6000);
            }
            
            window.musicVisualizer.startAIImageBirthAnimation(testImageURL, testTarget);
            
            // 使用多语言文本输出日志
            if (window.languageManager) {
                console.log(window.languageManager.getText('musicVisualizer', 'animation', 'started'));
            } else {
            console.log('🎬 测试AI诞生动画已启动');
            }
        } else {
            // 使用多语言文本
            const errorText = window.languageManager ? 
                window.languageManager.getText('musicVisualizer', 'enableFirst') : 
                '❌ 请先启动音乐可视化器 (按V键)';
            console.log(errorText);
        }
    };
    
    // 使用多语言文本输出初始化信息
    if (window.languageManager) {
        console.log(window.languageManager.getText('musicVisualizer', 'initialized'));
        console.log(window.languageManager.getText('musicVisualizer', 'shortcuts', 'title'));
        console.log('  ' + window.languageManager.getText('musicVisualizer', 'shortcuts', 'show'));
        console.log('  ' + window.languageManager.getText('musicVisualizer', 'shortcuts', 'capture'));
        console.log('  ' + window.languageManager.getText('musicVisualizer', 'shortcuts', 'autoToggle'));
        console.log('  ' + window.languageManager.getText('musicVisualizer', 'shortcuts', 'export'));
        console.log('  ' + window.languageManager.getText('musicVisualizer', 'shortcuts', 'aiPanel'));
        console.log(window.languageManager.getText('musicVisualizer', 'globalFunctions', 'title'));
        console.log('  ' + window.languageManager.getText('musicVisualizer', 'globalFunctions', 'capture'));
        console.log('  ' + window.languageManager.getText('musicVisualizer', 'globalFunctions', 'getData'));
        console.log('  ' + window.languageManager.getText('musicVisualizer', 'globalFunctions', 'autoToggle'));
        console.log(window.languageManager.getText('musicVisualizer', 'testFunctions', 'title'));
        console.log('  ' + window.languageManager.getText('musicVisualizer', 'testFunctions', 'test'));
    } else {
        // 备用文本（如果语言管理器未加载）
    console.log('🎵 音高瀑布流可视化器已初始化');
    console.log('📸 捕获功能快捷键:');
    console.log('  V - 显示/隐藏可视化器');
    console.log('  C - 手动捕获当前帧');
    console.log('  X - 切换自动捕获模式');
    console.log('  Z - 导出捕获统计信息');
    console.log('  A - 打开AI图像生成面板');
    console.log('🌐 全局函数:');
    console.log('  captureWaterfall() - 手动捕获');
    console.log('  getWaterfallImage() - 获取图像数据（用于云端）');
    console.log('  toggleAutoCapture() - 切换自动捕获');
    console.log('🎬 AI动画测试函数:');
    console.log('  testAIBirthAnimation() - 测试AI图像诞生动画（真实图像版本）');
    }
}

// 在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保其他组件已加载
    setTimeout(initMusicVisualizer, 1000);
});

// 如果页面已经加载完成，立即初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initMusicVisualizer, 100);
} 