/**
 * 全局语言管理系统
 * 管理所有UI界面的中英文切换
 */

class LanguageManager {
    constructor() {
        this.currentLanguage = 'EN'; // 默认英文
        this.listeners = []; // 语言变化监听器
        this.translations = {
            // 音乐可视化器相关
            musicVisualizer: {
                EN: {
                    initialized: '🎵 Music Visualizer Initialized',
                    shown: 'Music Visualizer Shown',
                    hidden: 'Music Visualizer Hidden',
                    enableFirst: '❌ Please enable Music Visualizer first (Press V)',
                    aiGeneratorNotLoaded: '❌ AI Image Generator not loaded',
                    captureSuccess: '✅ Image captured successfully',
                    autoCapture: {
                        enabled: '🔄 Auto capture enabled',
                        disabled: '⏸️ Auto capture disabled',
                        interval: 'interval',
                        minNotes: 'min notes'
                    },
                    capture: {
                        manual: '📸 Manual Capture',
                        auto: '🔄 Auto Capture',
                        notes: 'notes'
                    },
                    animation: {
                        started: '🎬 AI Image Birth Animation Started',
                        startPosition: '📍 Start Position',
                        targetPosition: '🎯 Target Position', 
                        targetSize: '📐 Target Size',
                        duration: '⏱️ Total Duration',
                        flyingStarted: '✈️ Flying Animation Started',
                        flyingCompleted: '✈️ Flying Animation Completed, Starting Expansion',
                        expandingStarted: '🔍 Expanding Animation Started',
                        expandingCompleted: '🔍 Expanding Animation Completed',
                        sequenceCompleted: '🎬 AI Image Birth Animation Sequence Completed',
                        finalMessage: '✨ AI Image perfectly expanded and positioned',
                        panelMessage: '🖼️ Real AI generated image will display in right panel',
                        endMessage: '🎊 Animation sequence ended cleanly!'
                    },
                    shortcuts: {
                        title: '📸 Capture Function Shortcuts:',
                        show: 'V - Show/Hide Visualizer',
                        capture: 'C - Manual Capture Current Frame',
                        autoToggle: 'X - Toggle Auto Capture Mode',
                        export: 'Z - Export Capture Statistics',
                        aiPanel: 'A - Open AI Image Generation Panel'
                    },
                    globalFunctions: {
                        title: '🌐 Global Functions:',
                        capture: 'captureWaterfall() - Manual Capture',
                        getData: 'getWaterfallImage() - Get Image Data (for cloud)',
                        autoToggle: 'toggleAutoCapture() - Toggle Auto Capture'
                    },
                    testFunctions: {
                        title: '🎬 AI Animation Test Functions:',
                        test: 'testAIBirthAnimation() - Test AI Image Birth Animation (Real Image Version)'
                    },
                    testTarget: '🎯 Expansion Target Area'
                },
                CN: {
                    initialized: '🎵 音高瀑布流可视化器已初始化',
                    shown: '音高瀑布流可视化器已显示',
                    hidden: '音高瀑布流可视化器已隐藏',
                    enableFirst: '❌ 请先启动音乐可视化器 (按V键)',
                    aiGeneratorNotLoaded: '❌ AI图像生成器未加载',
                    captureSuccess: '✅ 图像捕获成功',
                    autoCapture: {
                        enabled: '🔄 自动捕获已启用',
                        disabled: '⏸️ 自动捕获已禁用',
                        interval: '间隔',
                        minNotes: '最小音符数'
                    },
                    capture: {
                        manual: '📸 手动捕获',
                        auto: '🔄 自动捕获',
                        notes: '音符'
                    },
                    animation: {
                        started: '🎬 启动AI图像诞生动画',
                        startPosition: '📍 起始位置',
                        targetPosition: '🎯 目标位置',
                        targetSize: '📐 目标尺寸', 
                        duration: '⏱️ 总时长',
                        flyingStarted: '✈️ 飞行动画开始',
                        flyingCompleted: '✈️ 飞行动画完成，开始放大动画',
                        expandingStarted: '🔍 放大动画开始',
                        expandingCompleted: '🔍 放大动画完成',
                        sequenceCompleted: '🎬 AI图像诞生动画序列完美结束',
                        finalMessage: '✨ AI图像已完美放大并回到正位',
                        panelMessage: '🖼️ 实际AI生成的图像即将显示在右侧面板',
                        endMessage: '🎊 动画序列干净利落地结束！'
                    },
                    shortcuts: {
                        title: '📸 捕获功能快捷键:',
                        show: 'V - 显示/隐藏可视化器',
                        capture: 'C - 手动捕获当前帧',
                        autoToggle: 'X - 切换自动捕获模式',
                        export: 'Z - 导出捕获统计信息',
                        aiPanel: 'A - 打开AI图像生成面板'
                    },
                    globalFunctions: {
                        title: '🌐 全局函数:',
                        capture: 'captureWaterfall() - 手动捕获',
                        getData: 'getWaterfallImage() - 获取图像数据（用于云端）',
                        autoToggle: 'toggleAutoCapture() - 切换自动捕获'
                    },
                    testFunctions: {
                        title: '🎬 AI动画测试函数:',
                        test: 'testAIBirthAnimation() - 测试AI图像诞生动画（真实图像版本）'
                    },
                    testTarget: '🎯 放大目标区域'
                }
            },
            
            // 控制按钮相关
            controls: {
                EN: {
                    hideRhythm: 'Hide Rhythm',
                    showRhythm: 'Show Rhythm',
                    show3DScene: 'Show 3D Scene',
                    hide3DScene: 'Hide 3D Scene',
                    networkCollaboration: 'Network Collaboration',
                    visualizer: '🎵 Visualizer',
                    hideVisualizer: '🎵 Hide Visualizer',
                    overview: '📊 Overview',
                    hideOverview: '📊 Hide Overview'
                },
                CN: {
                    hideRhythm: '隐藏节拍器',
                    showRhythm: '显示节拍器',
                    show3DScene: '显示3D场景',
                    hide3DScene: '隐藏3D场景',
                    networkCollaboration: '联网协作',
                    visualizer: '🎵 可视化器',
                    hideVisualizer: '🎵 隐藏可视化器',
                    overview: '📊 总览',
                    hideOverview: '📊 隐藏总览'
                }
            },
            
            // 可视化器面板相关
            visualizerPanel: {
                EN: {
                    title: '🎵 Music Visualizer',
                    waterfall: 'Waterfall',
                    capture: '📸',
                    autoCapture: '🔄',
                    aiProcess: '🎨',
                    clear: '🗑️',
                    catAnalyzer: '🐱 Paint',
                    aiImagePlaceholder: '🖼️ SD Redrawn Image will display here',
                    aiImageSubtext: 'Capture waterfall then click "🎨"',
                    aiLoading: '🔄 AI is processing...'
                },
                CN: {
                    title: '🎵 音乐可视化器',
                    waterfall: '瀑布流',
                    capture: '📸',
                    autoCapture: '🔄',
                    aiProcess: '🎨',
                    clear: '🗑️',
                    catAnalyzer: '🐱 作画',
                    aiImagePlaceholder: '🖼️ SD重绘图像将显示在这里',
                    aiImageSubtext: '捕获瀑布流后点击"🎨"',
                    aiLoading: '🔄 AI正在处理中...'
                }
            },
            
            // 小猫聊天相关
            catChat: {
                EN: {
                    placeholder: 'Chat with the cat... 🐱',
                    welcome: "Hello! I'm your creative cat artist. I can turn your rhythms into AI art! Meow~ 🎨",
                    thinking: 'Thinking...'
                },
                CN: {
                    placeholder: '和小猫说话吧... 🐱',
                    welcome: '你好！我是小猫画家，能把你的节奏变成AI艺术！喵～ 🎨',
                    thinking: '正在思考...'
                }
            }
        };
        
        this.init();
    }
    
    init() {
        // 从localStorage读取保存的语言设置
        const savedLanguage = localStorage.getItem('interface-language');
        if (savedLanguage && (savedLanguage === 'EN' || savedLanguage === 'CN')) {
            this.currentLanguage = savedLanguage;
        }
        
        // 设置语言切换按钮的初始状态
        this.updateLanguageButton();
        
        // 监听语言切换按钮
        this.setupLanguageToggle();
        
        console.log(`🌐 Language Manager initialized with ${this.currentLanguage}`);
    }
    
    setupLanguageToggle() {
        const languageBtn = document.getElementById('language-toggle-btn');
        if (languageBtn) {
            languageBtn.addEventListener('click', () => {
                this.toggleLanguage();
            });
        }
    }
    
    toggleLanguage() {
        this.currentLanguage = this.currentLanguage === 'EN' ? 'CN' : 'EN';
        
        // 保存到localStorage
        localStorage.setItem('interface-language', this.currentLanguage);
        
        // 更新按钮显示
        this.updateLanguageButton();
        
        // 通知所有监听器
        this.notifyLanguageChange();
        
        console.log(`🌐 Language switched to: ${this.currentLanguage}`);
    }
    
    updateLanguageButton() {
        const languageBtn = document.getElementById('language-toggle-btn');
        if (languageBtn) {
            languageBtn.textContent = this.currentLanguage;
        }
    }
    
    getCurrentLanguage() {
        return this.currentLanguage;
    }
    
    isEnglish() {
        return this.currentLanguage === 'EN';
    }
    
    isChinese() {
        return this.currentLanguage === 'CN';
    }
    
    // 获取翻译文本
    getText(category, key, subKey = null) {
        try {
            const categoryData = this.translations[category];
            if (!categoryData) return key;
            
            const languageData = categoryData[this.currentLanguage];
            if (!languageData) return key;
            
            if (subKey) {
                const subData = languageData[key];
                if (subData && subData[subKey]) {
                    return subData[subKey];
                }
                return subKey;
            } else {
                return languageData[key] || key;
            }
        } catch (error) {
            console.warn('Translation error:', error);
            return subKey || key;
        }
    }
    
    // 添加语言变化监听器
    addLanguageChangeListener(callback) {
        this.listeners.push(callback);
    }
    
    // 移除语言变化监听器
    removeLanguageChangeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    
    // 通知所有监听器语言已变化
    notifyLanguageChange() {
        this.listeners.forEach(callback => {
            try {
                callback(this.currentLanguage);
            } catch (error) {
                console.warn('Language change listener error:', error);
            }
        });
    }
    
    // 更新所有UI文本
    updateAllUI() {
        this.notifyLanguageChange();
    }
}

// 创建全局语言管理器实例
window.languageManager = new LanguageManager();

// 导出到全局作用域
window.LanguageManager = LanguageManager; 