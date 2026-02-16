/**
 * cat-ai-image-generator.js - 小猫AI图像生成器
 * 自动读取步进器数据，生成AI图像提示词并发送给Stable Diffusion
 */

class CatAIImageGenerator {
    constructor() {
        this.lastAnalyzedData = null;
        this.isGenerating = false;
        this.analysisInterval = null;
        this.analysisDelay = 5000; // 5秒后分析变化
        this.enabled = true;
        
        this.init();
    }
    
    init() {
        console.log('🐱 小猫AI图像生成器已启动');
        
        // 等待页面加载完成后再开始监控
        setTimeout(() => {
            this.startDataMonitoring();
            this.listenForChanges();
        }, 2000);
    }
    
    // 开始监控数据变化
    startDataMonitoring() {
        // 禁用自动监控，只使用手动触发避免重复请求
        console.log('🐱 自动监控已禁用，只使用手动触发模式');
        return;
        
        // 原来的自动监控代码已注释
        // setInterval(() => {
        //     if (this.enabled && !this.isGenerating && this.isChatVisible()) {
        //         this.checkForDataChanges();
        //     }
        // }, 3000);
    }
    
    // 检查小猫聊天界面是否可见
    isChatVisible() {
        const visualizerPanel = document.getElementById('visualizer-panel');
        const catSection = document.getElementById('cat-chat-section');
        
        return visualizerPanel && 
               catSection && 
               !visualizerPanel.classList.contains('hidden') &&
               getComputedStyle(catSection).display !== 'none';
    }
    
    // 检查数据是否发生变化
    checkForDataChanges() {
        const currentData = this.getCurrentRhythmData();
        
        if (!currentData || currentData.nodes.length === 0) {
            return;
        }
        
        // 生成数据指纹用于比较
        const currentFingerprint = this.generateDataFingerprint(currentData);
        
        if (this.lastAnalyzedData !== currentFingerprint) {
            console.log('🐱 检测到节奏数据变化，准备生成AI图像...');
            
            // 清除之前的延时分析
            if (this.analysisInterval) {
                clearTimeout(this.analysisInterval);
            }
            
            // 延时分析，避免频繁触发
            this.analysisInterval = setTimeout(() => {
                this.generateAIImage(currentData);
                this.lastAnalyzedData = currentFingerprint;
            }, this.analysisDelay);
        }
    }
    
    // 获取当前节奏数据
    getCurrentRhythmData() {
        try {
            // 从presetManager获取当前活跃节点
            const activeNodes = window.presetManager ? window.presetManager.getActiveNodes() : (window.nodes || []);
            
            if (!activeNodes || activeNodes.length === 0) {
                return null;
            }
            
            // 获取当前预设索引
            const currentPreset = window.ui ? window.ui.currentPattern : 0;
            
            // 获取步数
            const stepCount = window.ui ? window.ui.stepCount : 16;
            
            return {
                nodes: activeNodes,
                currentPreset: currentPreset,
                stepCount: stepCount,
                isPlaying: window.metronome ? window.metronome.isPlaying : false,
                currentBeat: window.metronome ? window.metronome.currentStep : 0
            };
        } catch (error) {
            console.warn('获取节奏数据失败:', error);
            return null;
        }
    }
    
    // 生成数据指纹用于变化检测
    generateDataFingerprint(data) {
        try {
            const fingerprint = {
                nodeCount: data.nodes.length,
                stepCount: data.stepCount,
                preset: data.currentPreset
            };
            
            // 为每个节点生成简化指纹
            fingerprint.nodePatterns = data.nodes.map(node => {
                if (!node.alpha) return '';
                
                // 只取前stepCount个步骤
                const steps = node.alpha.slice(0, data.stepCount);
                
                // 将alpha值转换为简单的开/关模式
                return steps.map(alpha => alpha > 0.5 ? '1' : '0').join('');
            });
            
            return JSON.stringify(fingerprint);
        } catch (error) {
            return '';
        }
    }
    
    // 生成AI图像
    generateAIImage(data) {
        if (this.isGenerating || !this.isChatVisible()) return;
        
        this.isGenerating = true;
        
        try {
            console.log('🐱 开始分析节奏并生成AI图像...');
            
            const analysis = this.performRhythmAnalysis(data);
            const description = this.generateRhythmDescription(analysis, data);
            
            // 通过用户输入框发送给小猫
            this.sendThroughUserInput(description);
            
        } catch (error) {
            console.error('AI图像生成失败:', error);
        } finally {
            this.isGenerating = false;
        }
    }
    
    // 执行节奏分析
    performRhythmAnalysis(data) {
        const analysis = {
            complexity: 0,
            density: 0,
            patterns: [],
            rhythm_type: 'unknown',
            interesting_features: [],
            // 音高分析数据
            pitch_analysis: {
                overall_pitch_variation: false,
                average_pitch_range: 0,
                average_pitch_complexity: 0,
                tracks_with_melody: 0
            },
            // 和声分析数据
            harmony_analysis: null
        };
        
        let totalPitchRange = 0;
        let totalPitchComplexity = 0;
        let tracksWithPitch = 0;
        
        data.nodes.forEach((node, nodeIndex) => {
            if (!node.alpha) return;
            
            const steps = node.alpha.slice(0, data.stepCount);
            const nodeAnalysis = this.analyzeNodePattern(steps, data.stepCount);
            
            // 分析音高
            const pitchAnalysis = this.analyzePitchPattern(node, data.stepCount);
            
            analysis.patterns.push({
                track: nodeIndex + 1,
                ...nodeAnalysis,
                ...pitchAnalysis
            });
            
            analysis.complexity += nodeAnalysis.complexity;
            analysis.density += nodeAnalysis.density;
            
            // 统计音高数据
            if (pitchAnalysis.hasPitchVariation) {
                tracksWithPitch++;
                totalPitchRange += pitchAnalysis.pitchRange;
                totalPitchComplexity += pitchAnalysis.pitchComplexity;
            }
        });
        
        // 计算平均值
        if (data.nodes.length > 0) {
            analysis.complexity /= data.nodes.length;
            analysis.density /= data.nodes.length;
        }
        
        // 计算音高分析结果
        if (tracksWithPitch > 0) {
            analysis.pitch_analysis.overall_pitch_variation = true;
            analysis.pitch_analysis.average_pitch_range = totalPitchRange / tracksWithPitch;
            analysis.pitch_analysis.average_pitch_complexity = totalPitchComplexity / tracksWithPitch;
            analysis.pitch_analysis.tracks_with_melody = tracksWithPitch;
        }
        
        // 分析和声和音程
        analysis.harmony_analysis = this.analyzeHarmonyAndIntervals(data);
        
        // 判断节奏类型
        analysis.rhythm_type = this.determineRhythmType(analysis);
        
        // 分析有趣特征
        analysis.interesting_features = this.findInterestingFeatures(data, analysis);
        
        return analysis;
    }
    
    // 分析单个节点模式
    analyzeNodePattern(steps, stepCount) {
        let activeSteps = 0;
        let consecutiveBeats = 0;
        let maxConsecutive = 0;
        let patterns = [];
        
        // 计算活跃步骤和连续节拍
        for (let i = 0; i < steps.length; i++) {
            if (steps[i] > 0.5) {
                activeSteps++;
                consecutiveBeats++;
                maxConsecutive = Math.max(maxConsecutive, consecutiveBeats);
            } else {
                if (consecutiveBeats > 0) {
                    patterns.push(consecutiveBeats);
                    consecutiveBeats = 0;
                }
            }
        }
        
        const density = activeSteps / stepCount;
        const complexity = this.calculateComplexity(steps);
        
        return {
            activeSteps,
            density,
            complexity,
            maxConsecutive,
            patterns: patterns
        };
    }
    
    // 分析音高变化
    analyzePitchPattern(node, stepCount) {
        if (!node.pitchOffset || !Array.isArray(node.pitchOffset)) {
            return {
                hasPitchVariation: false,
                pitchRange: 0,
                pitchComplexity: 0
            };
        }
        
        const pitches = node.pitchOffset.slice(0, stepCount);
        const activePitches = [];
        
        // 只考虑活跃步骤的音高
        for (let i = 0; i < Math.min(stepCount, node.alpha?.length || 0); i++) {
            if (node.alpha[i] > 0.5) {
                activePitches.push(pitches[i] || 0);
            }
        }
        
        if (activePitches.length === 0) {
            return {
                hasPitchVariation: false,
                pitchRange: 0,
                pitchComplexity: 0
            };
        }
        
        // 分析音高范围
        const minPitch = Math.min(...activePitches);
        const maxPitch = Math.max(...activePitches);
        const pitchRange = maxPitch - minPitch;
        
        // 分析音高复杂度（变化频率）
        let pitchChanges = 0;
        for (let i = 1; i < activePitches.length; i++) {
            if (activePitches[i] !== activePitches[i-1]) {
                pitchChanges++;
            }
        }
        const pitchComplexity = activePitches.length > 1 ? pitchChanges / (activePitches.length - 1) : 0;
        
        return {
            hasPitchVariation: pitchRange > 0,
            pitchRange: pitchRange,
            pitchComplexity: pitchComplexity,
            uniquePitches: [...new Set(activePitches)].length
        };
    }
    
    // 计算复杂度
    calculateComplexity(steps) {
        let changes = 0;
        let prevState = steps[0] > 0.5;
        
        for (let i = 1; i < steps.length; i++) {
            const currentState = steps[i] > 0.5;
            if (currentState !== prevState) {
                changes++;
            }
            prevState = currentState;
        }
        
        return changes / steps.length;
    }
    
    // 确定节奏类型
    determineRhythmType(analysis) {
        const avgDensity = analysis.density;
        const avgComplexity = analysis.complexity;
        
        if (avgDensity > 0.7) {
            return avgComplexity > 0.4 ? 'complex_dense' : 'simple_dense';
        } else if (avgDensity > 0.3) {
            return avgComplexity > 0.4 ? 'complex_moderate' : 'simple_moderate';
        } else {
            return avgComplexity > 0.4 ? 'complex_sparse' : 'simple_sparse';
        }
    }
    
    // 寻找有趣的特征
    findInterestingFeatures(data, analysis) {
        const features = [];
        
        // 检查多轨道
        if (data.nodes.length > 1) {
            features.push('多轨道编曲');
        }
        
        // 检查复杂模式
        if (analysis.complexity > 0.6) {
            features.push('复杂节奏变化');
        }
        
        // 检查稀疏模式
        if (analysis.density < 0.2) {
            features.push('极简主义风格');
        }
        
        // 检查密集模式
        if (analysis.density > 0.8) {
            features.push('密集节拍');
        }
        
        // 检查和声问题
        if (analysis.harmony_analysis && analysis.harmony_analysis.hasHarmony) {
            if (analysis.harmony_analysis.harmonicClashes > 0) {
                if (analysis.harmony_analysis.clashDensity > 0.3) {
                    features.push('严重不协和');
                } else {
                    features.push('不协和音程');
                }
            } else {
                features.push('和声协调');
            }
        }
        
        // 检查音高相关特征
        if (analysis.pitch_analysis.overall_pitch_variation) {
            if (analysis.pitch_analysis.average_pitch_range >= 5) {
                features.push('宽音域旋律');
            } else if (analysis.pitch_analysis.average_pitch_range >= 2) {
                features.push('音高变化');
            }
            
            if (analysis.pitch_analysis.average_pitch_complexity > 0.7) {
                features.push('频繁音高变化');
            }
            
            if (analysis.pitch_analysis.tracks_with_melody > 1) {
                features.push('多声部旋律');
            }
        } else {
            features.push('单音高模式');
        }
        
        // 检查对称性
        const hasSymmetry = this.checkSymmetry(data);
        if (hasSymmetry) {
            features.push('对称结构');
        }
        
        return features;
    }
    
    // 检查对称性
    checkSymmetry(data) {
        if (data.nodes.length === 0) return false;
        
        const firstNode = data.nodes[0];
        if (!firstNode.alpha) return false;
        
        const steps = firstNode.alpha.slice(0, data.stepCount);
        const halfPoint = Math.floor(steps.length / 2);
        
        for (let i = 0; i < halfPoint; i++) {
            const leftActive = steps[i] > 0.5;
            const rightActive = steps[steps.length - 1 - i] > 0.5;
            if (leftActive !== rightActive) {
                return false;
            }
        }
        
        return true;
    }
    
    // 生成节奏描述
    generateRhythmDescription(analysis, data) {
        // 检查当前语言设置
        const languageBtn = document.getElementById('language-toggle-btn');
        const isEnglish = languageBtn && languageBtn.textContent === 'EN';
        
        const stepCount = data.stepCount;
        const trackCount = data.nodes.length;
        const currentPreset = data.currentPreset + 1;
        
        if (isEnglish) {
            // 英文描述 - 结构化清晰
            let description = `Please analyze my rhythm pattern:\n\n`;
            description += `- Pattern: ${stepCount} steps, Preset ${currentPreset}\n`;
            description += `- Tracks: ${trackCount}\n`;
            
            // 节奏分析
            description += `- Rhythm: `;
            if (analysis.density > 0.7) {
                description += 'Dense beats';
            } else if (analysis.density > 0.3) {
                description += 'Moderate density';
            } else {
                description += 'Sparse beats';
            }
            
            if (analysis.complexity > 0.5) {
                description += ', complex patterns';
            } else {
                description += ', simple patterns';
            }
            
            // 音高分析
            description += `\n- Melody: `;
            if (analysis.pitch_analysis.overall_pitch_variation) {
                description += `Has pitch changes (range: ${Math.round(analysis.pitch_analysis.average_pitch_range)} semitones)`;
            } else {
                description += 'Single pitch only';
            }
            
            // 和声分析
            if (analysis.harmony_analysis && analysis.harmony_analysis.harmonicClashes > 0) {
                description += `\n- Harmony: ${analysis.harmony_analysis.harmonicClashes} dissonant intervals found`;
            } else if (trackCount > 1) {
                description += `\n- Harmony: No dissonance detected`;
            }
            
            description += `\n\nWhat do you think about this composition?`;
            
            return description;
        } else {
            // 中文描述 - 结构化清晰
            let description = `请分析我的节奏模式：\n\n`;
            description += `- 模式：${stepCount}步，预设${currentPreset}\n`;
            description += `- 音轨：${trackCount}个\n`;
            
            // 节奏分析
            description += `- 节奏：`;
            if (analysis.density > 0.7) {
                description += '密集节拍';
            } else if (analysis.density > 0.3) {
                description += '适中密度';
            } else {
                description += '稀疏节拍';
            }
            
            if (analysis.complexity > 0.5) {
                description += '，复杂模式';
            } else {
                description += '，简单模式';
            }
            
            // 音高分析
            description += `\n- 旋律：`;
            if (analysis.pitch_analysis.overall_pitch_variation) {
                description += `有音高变化（跨度：${Math.round(analysis.pitch_analysis.average_pitch_range)}半音）`;
            } else {
                description += '单一音高';
            }
            
            // 和声分析
            if (analysis.harmony_analysis && analysis.harmony_analysis.harmonicClashes > 0) {
                description += `\n- 和声：发现${analysis.harmony_analysis.harmonicClashes}个不协和音程`;
            } else if (trackCount > 1) {
                description += `\n- 和声：未发现不协和`;
            }
            
            description += `\n\n你觉得这个作品怎么样？`;
            
            return description;
        }
    }
    
    // 通过用户输入框发送消息
    sendThroughUserInput(message) {
        try {
            // 获取输入框和发送按钮
            const inputElement = document.getElementById('cat-input');
            const sendButton = document.getElementById('cat-send-btn');
            
            if (!inputElement || !sendButton) {
                console.warn('🐱 找不到输入框或发送按钮');
                return;
            }
            
            // 检查输入框是否被禁用
            if (inputElement.disabled) {
                console.log('🐱 输入框正在使用中，等待后重试...');
                setTimeout(() => {
                    this.sendThroughUserInput(message);
                }, 3000);
                return;
            }
            
            console.log('🐱 通过输入框发送分析请求:', message);
            
            // 设置输入框的值
            inputElement.value = message;
            
            // 模拟发送按钮点击
            sendButton.click();
            
        } catch (error) {
            console.error('通过用户输入发送失败:', error);
        }
    }
    
    // 监听各种变化事件
    listenForChanges() {
        // 禁用所有自动触发，只保留手动触发避免重复请求
        console.log('🐱 自动变化监听已禁用，只使用手动触发模式');
        return;
        
        // 原来的自动监听代码已注释
        // // 监听播放开始
        // if (window.metronome) {
        //     const originalPlay = window.metronome.play;
        //     if (typeof originalPlay === 'function') {
        //         window.metronome.play = () => {
        //             const result = originalPlay.call(window.metronome);
        //             
        //             if (this.enabled && this.isChatVisible()) {
        //                 setTimeout(() => {
        //                     console.log('🐱 检测到播放开始，分析节奏...');
        //                     this.triggerAnalysis();
        //                 }, 3000);
        //             }
        //             
        //             return result;
        //         };
        //     }
        // }
        
        // // 监听预设切换
        // if (window.ui) {
        //     const originalSetPattern = window.ui.setPattern;
        //     if (typeof originalSetPattern === 'function') {
        //         window.ui.setPattern = (patternIndex) => {
        //             const result = originalSetPattern.call(window.ui, patternIndex);
        //             
        //             setTimeout(() => {
        //                 if (this.enabled && this.isChatVisible()) {
        //                     console.log('🐱 检测到预设切换，准备分析...');
        //                     this.lastAnalyzedData = null; // 强制重新分析
        //                 }
        //             }, 1000);
        //             
        //             return result;
        //         };
        //     }
        // }
        
        // // 监听circle-data-change事件
        // document.addEventListener('circle-data-change', () => {
        //     if (this.enabled && this.isChatVisible()) {
        //         console.log('🐱 检测到圆环数据变化...');
        //         setTimeout(() => {
        //             this.checkForDataChanges();
        //         }, 2000);
        //     }
        // });
    }
    
    // 立即触发分析
    triggerAnalysis() {
        if (!this.isChatVisible()) {
            console.log('🐱 小猫聊天界面不可见，跳过分析');
            return;
        }
        
        const currentData = this.getCurrentRhythmData();
        if (currentData && currentData.nodes.length > 0) {
            this.generateAIImage(currentData);
            this.lastAnalyzedData = this.generateDataFingerprint(currentData);
        }
    }
    
    // 启用/禁用自动分析
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`🐱 自动AI图像生成已${enabled ? '启用' : '禁用'}`);
        
        if (!enabled && this.analysisInterval) {
            clearTimeout(this.analysisInterval);
            this.analysisInterval = null;
        }
    }
    
    // 手动触发分析
    manualAnalyze() {
        console.log('🐱 手动触发AI图像生成...');
        this.lastAnalyzedData = null; // 强制重新分析
        this.triggerAnalysis();
    }
    
    // 分析音程和和声
    analyzeHarmonyAndIntervals(data) {
        if (data.nodes.length < 2) {
            return {
                hasHarmony: false,
                dissonantIntervals: [],
                harmonicClashes: 0
            };
        }
        
        const dissonantIntervals = [];
        let harmonicClashes = 0;
        
        // 检查每个步骤的同时发声音符
        for (let step = 0; step < data.stepCount; step++) {
            const simultaneousPitches = [];
            
            // 收集这一步所有活跃的音高
            data.nodes.forEach((node, nodeIndex) => {
                if (node.alpha && node.alpha[step] > 0.5) {
                    const pitch = (node.pitchOffset && node.pitchOffset[step]) || 0;
                    simultaneousPitches.push({
                        pitch: pitch,
                        track: nodeIndex + 1
                    });
                }
            });
            
            // 分析音程关系
            if (simultaneousPitches.length >= 2) {
                for (let i = 0; i < simultaneousPitches.length; i++) {
                    for (let j = i + 1; j < simultaneousPitches.length; j++) {
                        const interval = Math.abs(simultaneousPitches[i].pitch - simultaneousPitches[j].pitch) % 12;
                        
                        // 检测不协和音程
                        if (this.isDissonantInterval(interval)) {
                            dissonantIntervals.push({
                                step: step + 1,
                                interval: interval,
                                tracks: [simultaneousPitches[i].track, simultaneousPitches[j].track]
                            });
                            harmonicClashes++;
                        }
                    }
                }
            }
        }
        
        return {
            hasHarmony: data.nodes.length > 1,
            dissonantIntervals: dissonantIntervals,
            harmonicClashes: harmonicClashes,
            clashDensity: harmonicClashes / data.stepCount
        };
    }
    
    // 判断是否为不协和音程
    isDissonantInterval(interval) {
        // 不协和音程：小二度(1)、大二度(2)、小七度(10)、大七度(11)、三全音(6)
        const dissonantIntervals = [1, 2, 6, 10, 11];
        return dissonantIntervals.includes(interval);
    }
}

// 创建全局实例
window.catAIImageGenerator = new CatAIImageGenerator();

// 导出到全局作用域
window.triggerCatRhythmAnalysis = () => {
    if (window.catAIImageGenerator) {
        window.catAIImageGenerator.manualAnalyze();
    }
};

window.toggleCatRhythmAnalyzer = (enabled) => {
    if (window.catAIImageGenerator) {
        window.catAIImageGenerator.setEnabled(enabled);
    }
};

console.log('🐱 小猫AI图像生成器模块已加载完成'); 