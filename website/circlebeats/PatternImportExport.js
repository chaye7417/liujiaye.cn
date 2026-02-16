/**
 * PatternImportExport.js - 用于导入导出节奏圆环的步进数据和合成器参数
 * 支持单个插槽的独立保存和加载功能
 */

class PatternImportExport {
    constructor() {
        this.initialized = false;
        this.exportButton = null;
        this.importInput = null;
    }

    /**
     * 初始化导入导出功能
     */
    init() {
        if (this.initialized) return;
        
        // 创建隐藏的文件输入元素用于导入
        this.createImportInput();
        
        // 记录初始化完成
        this.initialized = true;

    }

    /**
     * 创建隐藏的文件输入元素
     */
    createImportInput() {
        // 创建隐藏的文件输入元素
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'pattern-import-input';
        input.accept = '.json';
        input.style.display = 'none';
        document.body.appendChild(input);
        
        // 添加文件选择事件处理
        input.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                const file = event.target.files[0];
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    try {
                        // 解析JSON数据
                        const data = JSON.parse(e.target.result);
                        
                        // 获取目标插槽索引
                        const targetSlot = parseInt(input.dataset.targetSlot, 10);
                        if (targetSlot >= 0 && targetSlot <= 7) {

                            
                            // 修改数据中的slotIndex为目标插槽
                            data.slotIndex = targetSlot;
                            
                            // 导入处理过的数据
                        this.importPatternData(data);
                        } else {
                            console.error('导入失败: 无效的目标插槽索引', input.dataset.targetSlot);
                            alert('导入失败: 无效的目标插槽索引');
                        }
                    } catch (error) {
                        console.error('导入文件解析失败:', error);
                        alert('导入失败: 文件格式不正确');
                    }
                };
                
                reader.readAsText(file);
            }
        });
        
        this.importInput = input;
    }

    /**
     * 导出当前选中插槽的数据
     * @param {number} slotIndex - 要导出的插槽索引
     */
    exportSlot(slotIndex) {

        
        if (slotIndex < 0 || slotIndex >= 8) {
            console.error('无效的插槽索引:', slotIndex);
            alert('导出失败: 无效的插槽索引');
            return;
        }
        
        try {
            // 获取插槽数据

            const slotData = this.getSlotData(slotIndex);
            
            // 转换为JSON字符串

            const jsonData = JSON.stringify(slotData, null, 2);
            
            // 创建下载

            this.downloadJSON(jsonData, `rhythm-pattern-slot-${slotIndex + 1}.json`);
            

            alert(`已成功导出插槽 ${slotIndex + 1} 的数据！`);
        } catch (error) {
            console.error('导出数据失败:', error);
            alert('导出失败: ' + error.message);
        }
    }

    /**
     * 收集指定插槽的完整数据
     * @param {number} slotIndex - 要收集数据的插槽索引
     * @returns {Object} 插槽的完整数据
     */
    getSlotData(slotIndex) {
        try {
            // 检查必要的全局变量是否存在
            if (!window.presetPatterns) {
                console.error('导出失败: window.presetPatterns 未定义');
                throw new Error('系统初始化问题: 预设模式数据不可用');
            }
            
            if (!window.presetPatterns[slotIndex]) {
                console.error(`导出失败: window.presetPatterns[${slotIndex}] 未定义`);
                throw new Error(`插槽 ${slotIndex + 1} 数据不可用`);
            }
            
            // 安全获取插槽颜色
            let slotColor = '#FF5252'; // 默认红色
            if (window.presetSlotColors && window.presetSlotColors[slotIndex]) {
                slotColor = window.presetSlotColors[slotIndex];
            } else if (window.presetManager && window.presetManager.slotColors && window.presetManager.slotColors[slotIndex]) {
                slotColor = window.presetManager.slotColors[slotIndex];
            }
            
            // 获取步进时值数据（如果可用）
            let timeValues = null;
            if (window.timeValues && window.timeValues[slotIndex]) {
                timeValues = window.timeValues[slotIndex];
            }
            
            // 获取音符释放时间数据（短音符时值）
            let noteReleaseTimes = null;
            if (window.noteReleaseTimes && window.noteReleaseTimes[slotIndex]) {
                noteReleaseTimes = window.noteReleaseTimes[slotIndex];
            }
            
            // 获取延长音符时值数据（处理大于100%的音符）
            let extendedNoteTimes = null;
            if (window.extendedNoteTimes && window.extendedNoteTimes[slotIndex]) {
                extendedNoteTimes = window.extendedNoteTimes[slotIndex];
            } else if (window.noteDurations && window.noteDurations[slotIndex]) {
                extendedNoteTimes = window.noteDurations[slotIndex];
            }
            
            // 获取音高数据（首先尝试从window.pitchValues获取）
            let pitchValues = null;
            
            // 首先检查全局pitchValues
            if (window.pitchValues && window.pitchValues[slotIndex]) {
                pitchValues = window.pitchValues[slotIndex];
            } 
            // 如果全局没有，尝试从当前变体的节点中获取pitchOffset
            else {
                pitchValues = this.extractPitchValuesFromNodes(slotIndex);
            }
            
            // 基本插槽数据
            const slotData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                slotIndex: slotIndex,
                slotColor: slotColor,
                patterns: {
                    variants: window.presetPatterns[slotIndex].variants || [[]],
                    currentVariant: window.presetPatterns[slotIndex].currentVariant || 0,
                    // 添加步进时值和音高信息（如果可用）
                    timeValues: timeValues,
                    pitchValues: pitchValues,
                    noteReleaseTimes: noteReleaseTimes,
                    extendedNoteTimes: extendedNoteTimes
                },
                synth: this.getSynthParameters(slotIndex)
            };
            

            return slotData;
        } catch (error) {
            console.error('收集插槽数据时出错:', error);
            throw error;
        }
    }
    
    /**
     * 从节点中提取音高值数据
     * @param {number} slotIndex - 插槽索引
     * @returns {Array|null} 音高值数组或null
     */
    extractPitchValuesFromNodes(slotIndex) {
        try {
            // 获取当前变体的节点
            const currentVariant = window.presetPatterns[slotIndex].currentVariant || 0;
            const nodes = window.presetPatterns[slotIndex].variants[currentVariant];
            
            if (!nodes || !nodes.length) {

                return null;
            }
            
            // 通常第一个节点包含音高数据
            const mainNode = nodes[0];
            if (!mainNode || !mainNode.pitchOffset || !mainNode.pitchOffset.length) {

                return null;
            }
            
            // 复制音高数据
            const pitchValues = [...mainNode.pitchOffset];

            
            return pitchValues;
        } catch (error) {
            console.error('提取音高值时出错:', error);
            return null;
        }
    }

    /**
     * 获取合成器参数
     * @param {number} slotIndex - 插槽索引
     * @returns {Object} 合成器参数
     */
    getSynthParameters(slotIndex) {
        try {

            
            // 优先使用新的SynthPresetManager
            if (window.synthPresetManager) {
                const params = window.synthPresetManager.getSlotSynthParams(slotIndex);
                if (params) {

                    return params;
                }
            }
            
            // 如果找不到SynthPresetManager，回退到旧的方式
            // 安全检查：metronome对象
            if (!window.metronome) {

                return {};
            }
            
            // 创建默认值
            const defaultEnvelope = { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 };
            const defaultFilter = { type: 'lowpass', frequency: 2000, Q: 1, gain: 0 };
            const defaultDelay = { time: 0.25, feedback: 0.3, mix: 0.2 };
            const defaultReverb = { decay: 1.5, preDelay: 0.01, mix: 0.1 };
            
            // 安全地获取合成器参数，提供默认值
            const safeGet = (obj, prop, defaultVal) => {
                try {
                    return (obj && obj[prop] !== undefined) ? obj[prop] : defaultVal;
                } catch (e) {

                    return defaultVal;
                }
            };
            
            // 基本参数
            let waveform = 'sine';
            let baseNote = 'C4';
            
            // 安全检查：presetWaveforms
            if (window.metronome.presetWaveforms && window.metronome.presetWaveforms[slotIndex] !== undefined) {
                waveform = window.metronome.presetWaveforms[slotIndex];
            } else {

            }
            
            // 安全检查：baseNotes
            if (window.metronome.presetBaseNotes && window.metronome.presetBaseNotes[slotIndex] !== undefined) {
                baseNote = window.metronome.presetBaseNotes[slotIndex];
            } else if (window.metronome.baseNotes && window.metronome.baseNotes[slotIndex] !== undefined) {
                baseNote = window.metronome.baseNotes[slotIndex];
            } else {

            }
            
            // 检查包络参数是否存在
            let envelope = { ...defaultEnvelope };
            if (window.metronome.presetEnvelopeParams && window.metronome.presetEnvelopeParams[slotIndex]) {
                const envParams = window.metronome.presetEnvelopeParams[slotIndex];
                envelope = {
                    attack: safeGet(envParams, 'attack', defaultEnvelope.attack),
                    decay: safeGet(envParams, 'decay', defaultEnvelope.decay),
                    sustain: safeGet(envParams, 'sustain', defaultEnvelope.sustain),
                    release: safeGet(envParams, 'release', defaultEnvelope.release)
                };
            } else {

            }
            
            // 检查滤波器参数是否存在
            let filter = { ...defaultFilter };
            if (window.metronome.presetFilterParams && window.metronome.presetFilterParams[slotIndex]) {
                const filterParams = window.metronome.presetFilterParams[slotIndex];
                filter = {
                    type: safeGet(filterParams, 'type', defaultFilter.type),
                    frequency: safeGet(filterParams, 'frequency', defaultFilter.frequency),
                    Q: safeGet(filterParams, 'Q', defaultFilter.Q),
                    gain: safeGet(filterParams, 'gain', defaultFilter.gain)
                };
            } else {

            }
            
            // 检查延迟参数是否存在
            let delay = { ...defaultDelay };
            if (window.metronome.presetDelayParams && window.metronome.presetDelayParams[slotIndex]) {
                const delayParams = window.metronome.presetDelayParams[slotIndex];
                delay = {
                    time: safeGet(delayParams, 'time', defaultDelay.time),
                    feedback: safeGet(delayParams, 'feedback', defaultDelay.feedback),
                    mix: safeGet(delayParams, 'mix', defaultDelay.mix)
                };
            } else {

            }
            
            // 检查混响参数是否存在
            let reverb = { ...defaultReverb };
            if (window.metronome.presetReverbParams && window.metronome.presetReverbParams[slotIndex]) {
                const reverbParams = window.metronome.presetReverbParams[slotIndex];
                reverb = {
                    decay: safeGet(reverbParams, 'decay', defaultReverb.decay),
                    preDelay: safeGet(reverbParams, 'preDelay', defaultReverb.preDelay),
                    mix: safeGet(reverbParams, 'mix', defaultReverb.mix)
                };
            } else {

            }
            
            // 检查滑音参数是否存在
            let portamento = false;
            let portamentoTime = 0;
            
            if (window.metronome.presetPortamentoEnabled !== undefined && 
                window.metronome.presetPortamentoEnabled[slotIndex] !== undefined) {
                portamento = window.metronome.presetPortamentoEnabled[slotIndex];
            }
            
            if (window.metronome.presetPortamentoTime !== undefined && 
                window.metronome.presetPortamentoTime[slotIndex] !== undefined) {
                portamentoTime = window.metronome.presetPortamentoTime[slotIndex];
            }
            
            // 创建合成器参数对象
            const synthParams = {
                waveform,
                baseNote,
                envelope,
                filter,
                delay,
                reverb,
                portamento,
                portamentoTime
            };
            

            return synthParams;
        } catch (error) {
            console.error('获取合成器参数时出错:', error);
            // 返回一个基本的默认参数集
            return {
                waveform: 'sine',
                baseNote: 'C4',
                envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 },
                filter: { type: 'lowpass', frequency: 2000, Q: 1, gain: 0 },
                delay: { time: 0.25, feedback: 0.3, mix: 0.2 },
                reverb: { decay: 1.5, preDelay: 0.01, mix: 0.1 },
                portamento: false,
                portamentoTime: 0
            };
        }
    }

    /**
     * 创建并下载JSON文件
     * @param {string} jsonData - JSON数据字符串
     * @param {string} filename - 文件名
     */
    downloadJSON(jsonData, filename) {
        try {

            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            

            a.click();
            
            // 清理
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

            }, 100);
        } catch (error) {
            console.error('下载JSON文件时出错:', error);
            alert('下载失败: ' + error.message);
        }
    }

    /**
     * 本地检查是否有权限编辑插槽（兼容没有PresetManager的情况）
     * @param {number} slotIndex - 插槽索引
     * @returns {boolean} 是否有权限编辑
     */
    canEditSlot(slotIndex) {
        // 如果存在PresetManager，使用它的权限检查
        if (window.presetManager && typeof window.presetManager.canEditSlot === 'function') {
            return window.presetManager.canEditSlot(slotIndex);
        }
        
        // 如果没有PresetManager但处于观看模式，任何插槽都不能编辑
        if (window.isViewOnlyMode) {
            return false;
        }
        
        // 如果有controlledSlotIndex，只能编辑该插槽
        if (window.controlledSlotIndex !== undefined && window.controlledSlotIndex !== -1) {
            return slotIndex === window.controlledSlotIndex;
        }
        
        // 如果有slotOwners和myUserId，只能编辑自己拥有的插槽
        if (window.slotOwners && window.myUserId) {
            return window.slotOwners[slotIndex] === window.myUserId;
        }
        
        // 如果没有任何控制机制，允许编辑所有插槽
        return true;
    }

    /**
     * 导入所选文件中的数据
     * @param {Object} data - 导入的JSON数据
     */
    importPatternData(data) {
        if (!data || !data.version || data.slotIndex === undefined || data.slotIndex < 0 || data.slotIndex > 7) {
            alert('导入失败: 文件格式不正确或缺少必要数据');
            return;
        }
        
        const slotIndex = data.slotIndex;
        
        // 使用自己的canEditSlot方法检查权限
        if (!this.canEditSlot(slotIndex)) {
            alert(`导入失败: 您没有编辑插槽 ${slotIndex + 1} 的权限`);
            return;
        }
        
        let changesApplied = false;
        
        try {

            
            // 导入步进模式数据
            if (data.patterns && data.patterns.variants) {
                // 保存当前备份
                const oldPatterns = JSON.parse(JSON.stringify(window.presetPatterns[slotIndex]));
                
                // 导入前先准备和保存音高数据
                // 注意：即使导入的patterns.pitchValues为空，我们也会从原始节点中提取音高数据，确保不丢失
                const pitchValuesToApply = this.preparePitchValuesForImport(data, slotIndex);
                
                // 应用新模式数据
                window.presetPatterns[slotIndex].variants = data.patterns.variants;
                window.presetPatterns[slotIndex].currentVariant = data.patterns.currentVariant || 0;
                
                // 保存音高数据到全局对象，用于后续应用
                if (pitchValuesToApply) {
                    // 确保目标数组存在
                    if (!window.pitchValues) window.pitchValues = [];
                    window.pitchValues[slotIndex] = pitchValuesToApply;
                }
                
                // 如果有步进时值数据，也进行导入
                if (data.patterns.timeValues) {
                    // 确保目标数组存在
                    if (!window.timeValues) window.timeValues = [];
                    window.timeValues[slotIndex] = data.patterns.timeValues;
                }
                
                // 如果有音符释放时间数据（短音符），也进行导入
                if (data.patterns.noteReleaseTimes) {
                    // 确保目标数组存在
                    if (!window.noteReleaseTimes) window.noteReleaseTimes = [];
                    window.noteReleaseTimes[slotIndex] = data.patterns.noteReleaseTimes;
                }
                
                // 如果有延长音符时值数据，也进行导入
                if (data.patterns.extendedNoteTimes) {
                    // 根据系统使用的变量名来选择存储位置
                    if (window.extendedNoteTimes !== undefined) {
                        if (!window.extendedNoteTimes) window.extendedNoteTimes = [];
                        window.extendedNoteTimes[slotIndex] = data.patterns.extendedNoteTimes;
                    } else if (window.noteDurations !== undefined) {
                        if (!window.noteDurations) window.noteDurations = [];
                        window.noteDurations[slotIndex] = data.patterns.extendedNoteTimes;
                    }
                }
                

                changesApplied = true;
            }
            
            // 导入合成器参数
            if (data.synth && window.metronome) {
                this.applySynthParameters(slotIndex, data.synth);
                changesApplied = true;
            }
            
            if (changesApplied) {
                // 应用当前变体
                const currentVariantIndex = window.presetPatterns[slotIndex].currentVariant;
                
                // 完整的恢复流程
                this.applyFullImportChanges(slotIndex, currentVariantIndex);
                

                alert(`成功导入到插槽 ${slotIndex + 1} 的数据`);
            } else {
                alert('导入文件不包含有效的模式或合成器数据');
            }
        } catch (error) {
            console.error('导入数据应用失败:', error);
            alert('导入失败: ' + error.message);
        }
    }
    
    /**
     * 准备导入时使用的音高值数据
     * @param {Object} importData - 导入的JSON数据
     * @param {number} slotIndex - 插槽索引
     * @returns {Array|null} 处理后的音高值数组或null
     */
    preparePitchValuesForImport(importData, slotIndex) {
        try {
            // 首先检查导入数据中是否包含音高数据
            if (importData.patterns && importData.patterns.pitchValues) {

                return importData.patterns.pitchValues;
            }
            
            // 如果导入数据没有音高数据，尝试从当前节点中提取
            const extractedValues = this.extractPitchValuesFromNodes(slotIndex);
            if (extractedValues) {

                return extractedValues;
            }
            
            // 如果以上方法都无法获取音高数据，创建默认的0数组

            return Array(32).fill(0);
        } catch (error) {
            console.error('准备音高值数据时出错:', error);
            return Array(32).fill(0); // 默认值
        }
    }

    /**
     * 完整应用导入的变更
     * @param {number} slotIndex - 插槽索引
     * @param {number} variantIndex - 变体索引
     */
    applyFullImportChanges(slotIndex, variantIndex) {
        try {
            // 步骤1: 加载预设 - 优先使用presetManager的loadPreset方法
            if (window.presetManager && typeof window.presetManager.loadPreset === 'function') {
                window.presetManager.loadPreset(slotIndex, variantIndex);
            } else if (typeof window.loadPreset === 'function') {
                // 兼容旧版API
                window.loadPreset(slotIndex, variantIndex);
            }
            
            // 步骤2: 如果存在音高和时值数据，确保它们被应用
            if (window.timeValues && window.timeValues[slotIndex] && window.applyTimeValues) {
                window.applyTimeValues(slotIndex);
            }
            
            // 步骤2.5: 应用所有音符时值数据（短音符和长音符）
            // 优先使用统一的应用方法（如果存在）
            let noteTimesApplied = false;
            
            // 首先尝试使用可能存在的综合应用函数
            if (typeof window.applyAllNoteTimings === 'function') {

                window.applyAllNoteTimings(slotIndex);
                noteTimesApplied = true;
            } else if (window.metronome && typeof window.metronome.applyAllNoteTimings === 'function') {

                window.metronome.applyAllNoteTimings(slotIndex);
                noteTimesApplied = true;
            }
            
            // 如果没有统一方法，分别应用不同类型的时值数据
            if (!noteTimesApplied) {

                
                // 应用短音符释放时间（如果存在）
                if (window.noteReleaseTimes && window.noteReleaseTimes[slotIndex]) {

                    if (typeof window.applyNoteReleaseTimes === 'function') {
                        window.applyNoteReleaseTimes(slotIndex);
                    } else if (window.metronome && typeof window.metronome.applyNoteReleaseTimes === 'function') {
                        window.metronome.applyNoteReleaseTimes(slotIndex);
                    }
                }
                
                // 应用延长音符时值（如果存在）
                const hasExtendedTimes = window.extendedNoteTimes && window.extendedNoteTimes[slotIndex];
                const hasNoteDurations = window.noteDurations && window.noteDurations[slotIndex];
                
                if (hasExtendedTimes || hasNoteDurations) {

                    // 尝试各种可能的应用函数
                    if (typeof window.applyExtendedNoteTimes === 'function' && hasExtendedTimes) {
                        window.applyExtendedNoteTimes(slotIndex);
                    } else if (typeof window.applyNoteDurations === 'function' && hasNoteDurations) {
                        window.applyNoteDurations(slotIndex);
                    } else if (window.metronome) {
                        if (typeof window.metronome.applyExtendedNoteTimes === 'function' && hasExtendedTimes) {
                            window.metronome.applyExtendedNoteTimes(slotIndex);
                        } else if (typeof window.metronome.applyNoteDurations === 'function' && hasNoteDurations) {
                            window.metronome.applyNoteDurations(slotIndex);
                        }
                    }
                }
            }
            
            // 直接应用音高数据到节点的pitchOffset上
            if (window.pitchValues && window.pitchValues[slotIndex]) {
                this.applyPitchValuesToNodes(slotIndex);
            }
            
            // 步骤3: 触发圈数据变化事件以更新UI
            if (typeof window.triggerCircleDataChange === 'function') {
                window.triggerCircleDataChange();
            }
            
            // 步骤4: 如果在协作模式下，同步到共享状态
            if (window.presetManager && window.shared) {
                window.presetManager.syncToShared();
            }
            
            // 步骤5: 强制重新渲染UI和更新音频引擎
            if (window.metronome) {
                // 更新节拍器状态
                if (typeof window.metronome.updatePatternDisplay === 'function') {
                    window.metronome.updatePatternDisplay();
                }
                
                // 确保合成器参数应用到当前活动实例
                if (window.synthPresetManager) {
                    window.synthPresetManager.applySynthParamsToActiveInstance(slotIndex);
                }
            }
            

            return true;
        } catch (error) {
            console.error('应用导入变更时出错:', error);
            return false;
        }
    }
    
    /**
     * 将导入的音高值应用到节点的pitchOffset上
     * @param {number} slotIndex - 插槽索引
     */
    applyPitchValuesToNodes(slotIndex) {
        try {
            // 确保pitchValues数据存在
            if (!window.pitchValues || !window.pitchValues[slotIndex]) {

                return false;
            }
            
            const pitchValues = window.pitchValues[slotIndex];

            
            // 获取当前变体索引
            const currentVariant = window.presetPatterns[slotIndex].currentVariant || 0;
            
            // 获取当前变体的节点数据
            const currentNodes = window.presetPatterns[slotIndex].variants[currentVariant];
            if (!currentNodes || !currentNodes.length) {

                return false;
            }
            
            // 找到主节点（通常是第一个）并应用音高值
            const mainNode = currentNodes[0];
            if (!mainNode) {

                return false;
            }
            
            // 确保节点有pitchOffset数组
            if (!mainNode.pitchOffset) {
                mainNode.pitchOffset = [];
            }
            
            // 应用音高值
            const stepsCount = mainNode.alpha ? mainNode.alpha.length : 32;
            for (let i = 0; i < stepsCount; i++) {
                if (pitchValues[i] !== undefined) {
                    // 确保pitchOffset数组足够长
                    while (mainNode.pitchOffset.length <= i) {
                        mainNode.pitchOffset.push(0);
                    }
                    mainNode.pitchOffset[i] = pitchValues[i];
                }
            }
            

            return true;
        } catch (error) {
            console.error('应用音高值时出错:', error);
            return false;
        }
    }

    /**
     * 应用导入的合成器参数
     * @param {number} slotIndex - 插槽索引
     * @param {Object} synthParams - 合成器参数
     */
    applySynthParameters(slotIndex, synthParams) {
        try {

            
            // 优先使用SynthPresetManager
            if (window.synthPresetManager) {
                const success = window.synthPresetManager.importParamsFromJson(slotIndex, synthParams);
                if (success) {

                    
                    // 实时应用到当前活动的合成器实例
                    window.synthPresetManager.applySynthParamsToActiveInstance(slotIndex);
                    return true;
                }
            }
            
            // 如果SynthPresetManager不可用或应用失败，使用旧方法
            if (!window.metronome) {

                return false;
            }
            
            // 安全应用：确保参数对象存在后再设置
            const safeApply = (targetObj, targetProp, value) => {
                try {
                    if (!targetObj[targetProp]) {
                        targetObj[targetProp] = [];
                    }
                    if (!targetObj[targetProp][slotIndex]) {
                        // 如果该索引不存在，使用数组填充
                        while (targetObj[targetProp].length <= slotIndex) {
                            targetObj[targetProp].push(undefined);
                        }
                    }
                    targetObj[targetProp][slotIndex] = value;
                    return true;
                } catch (e) {
                    console.error(`设置 ${targetProp} 失败:`, e);
                    return false;
                }
            };
            
            // 应用基本合成参数
            if (synthParams.waveform) {
                if (safeApply(window.metronome, 'presetWaveforms', synthParams.waveform)) {

                }
            }
            
            if (synthParams.baseNote) {
                // 尝试设置presetBaseNotes
                let success = false;
                if (window.metronome.presetBaseNotes !== undefined) {
                    success = safeApply(window.metronome, 'presetBaseNotes', synthParams.baseNote);
                }
                
                // 如果失败，尝试设置baseNotes
                if (!success && window.metronome.baseNotes !== undefined) {
                    success = safeApply(window.metronome, 'baseNotes', synthParams.baseNote);
                }
                
                if (success) {

                }
            }
            
            // 确保这些参数对象都存在
            if (!window.metronome.presetEnvelopeParams) window.metronome.presetEnvelopeParams = [];
            if (!window.metronome.presetFilterParams) window.metronome.presetFilterParams = [];
            if (!window.metronome.presetDelayParams) window.metronome.presetDelayParams = [];
            if (!window.metronome.presetReverbParams) window.metronome.presetReverbParams = [];
            if (!window.metronome.presetPortamentoEnabled) window.metronome.presetPortamentoEnabled = [];
            if (!window.metronome.presetPortamentoTime) window.metronome.presetPortamentoTime = [];
            
            // 应用ADSR包络参数
            if (synthParams.envelope) {
                // 创建默认包络
                const defaultEnvelope = { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 };
                
                // 获取当前包络或创建新的
                let currentEnvelope = window.metronome.presetEnvelopeParams[slotIndex] || { ...defaultEnvelope };
                
                // 合并新参数
                window.metronome.presetEnvelopeParams[slotIndex] = {
                    ...currentEnvelope,
                    ...synthParams.envelope
                };
                

            }
            
            // 应用滤波器参数
            if (synthParams.filter) {
                // 创建默认滤波器
                const defaultFilter = { type: 'lowpass', frequency: 2000, Q: 1, gain: 0 };
                
                // 获取当前滤波器或创建新的
                let currentFilter = window.metronome.presetFilterParams[slotIndex] || { ...defaultFilter };
                
                // 合并新参数
                window.metronome.presetFilterParams[slotIndex] = {
                    ...currentFilter,
                    ...synthParams.filter
                };
                

            }
            
            // 应用延迟效果参数
            if (synthParams.delay) {
                // 创建默认延迟
                const defaultDelay = { time: 0.25, feedback: 0.3, mix: 0.2 };
                
                // 获取当前延迟或创建新的
                let currentDelay = window.metronome.presetDelayParams[slotIndex] || { ...defaultDelay };
                
                // 合并新参数，排除enabled属性
                const { enabled, ...otherDelayParams } = synthParams.delay;
                window.metronome.presetDelayParams[slotIndex] = {
                    ...currentDelay,
                    ...otherDelayParams
                };
                
                // 单独处理延迟启用状态
                if (enabled !== undefined) {
                    // 确保synthUI.delay.enabled数组存在
                    if (!window.metronome.synthUI) {
                        window.metronome.synthUI = {};
                    }
                    if (!window.metronome.synthUI.delay) {
                        window.metronome.synthUI.delay = { enabled: Array(8).fill(false) };
                    }
                    if (!window.metronome.synthUI.delay.enabled) {
                        window.metronome.synthUI.delay.enabled = Array(8).fill(false);
                    }
                    
                    // 设置延迟启用状态
                    window.metronome.synthUI.delay.enabled[slotIndex] = !!enabled;
                    
                    // 直接应用到效果实例
                    if (window.metronome.delayEffects && window.metronome.delayEffects[slotIndex]) {
                        const delayEffect = window.metronome.delayEffects[slotIndex];
                        const mix = window.metronome.presetDelayParams[slotIndex].mix || 0.2;
                        delayEffect.wet.value = enabled ? mix : 0;
                    }
                }
                

            }
            
            // 应用混响效果参数
            if (synthParams.reverb) {
                // 创建默认混响
                const defaultReverb = { decay: 1.5, preDelay: 0.01, mix: 0.1 };
                
                // 获取当前混响或创建新的
                let currentReverb = window.metronome.presetReverbParams[slotIndex] || { ...defaultReverb };
                
                // 合并新参数，排除enabled属性
                const { enabled, ...otherReverbParams } = synthParams.reverb;
                window.metronome.presetReverbParams[slotIndex] = {
                    ...currentReverb,
                    ...otherReverbParams
                };
                
                // 单独处理混响启用状态
                if (enabled !== undefined) {
                    // 确保synthUI.reverb.enabled数组存在
                    if (!window.metronome.synthUI) {
                        window.metronome.synthUI = {};
                    }
                    if (!window.metronome.synthUI.reverb) {
                        window.metronome.synthUI.reverb = { enabled: Array(8).fill(false) };
                    }
                    if (!window.metronome.synthUI.reverb.enabled) {
                        window.metronome.synthUI.reverb.enabled = Array(8).fill(false);
                    }
                    
                    // 设置混响启用状态
                    window.metronome.synthUI.reverb.enabled[slotIndex] = !!enabled;
                    
                    // 直接应用到效果实例
                    if (window.metronome.reverbEffects && window.metronome.reverbEffects[slotIndex]) {
                        const reverbEffect = window.metronome.reverbEffects[slotIndex];
                        const mix = window.metronome.presetReverbParams[slotIndex].mix || 0.1;
                        reverbEffect.wet.value = enabled ? mix : 0;
                        
                        // 如果启用了混响，尝试重新生成冲激响应
                        if (enabled && typeof reverbEffect.generate === 'function') {
                            try {
                                reverbEffect.generate();
                            } catch (e) {
                                console.warn('重新生成混响冲激响应时出错:', e);
                            }
                        }
                    }
                }
                

            }
            
            // 应用滑音参数
            if (synthParams.portamento !== undefined) {
                safeApply(window.metronome, 'presetPortamentoEnabled', synthParams.portamento);

            }
            
            if (synthParams.portamentoTime !== undefined) {
                safeApply(window.metronome, 'presetPortamentoTime', synthParams.portamentoTime);

            }
            
            // 应用到活动的合成器实例
            if (window.metronome.presetSounds && window.metronome.presetSounds[slotIndex]) {
                try {
                    const synth = window.metronome.presetSounds[slotIndex];
                    
                    // 应用波形
                    if (synthParams.waveform && synth.oscillator) {
                        synth.oscillator.type = synthParams.waveform;
                    }
                    
                    // 应用包络
                    if (synthParams.envelope && synth.envelope) {
                        synth.envelope.attack = synthParams.envelope.attack;
                        synth.envelope.decay = synthParams.envelope.decay;
                        synth.envelope.sustain = synthParams.envelope.sustain;
                        synth.envelope.release = synthParams.envelope.release;
                    }
                    
                    // 应用滤波器
                    if (synthParams.filter && synth.filter) {
                        synth.filter.type = synthParams.filter.type;
                        if (synth.filter.frequency) {
                            synth.filter.frequency.value = synthParams.filter.frequency;
                        }
                        if (synth.filter.Q) {
                            synth.filter.Q.value = synthParams.filter.Q;
                        }
                    }
                    
                    // 应用滑音
                    if (synthParams.portamento !== undefined) {
                        const portamentoTime = synthParams.portamentoTime || 0.05;
                        synth.portamento = synthParams.portamento ? portamentoTime : 0;
                    }
                    

                } catch (e) {
                    console.error('应用参数到活动合成器时出错:', e);
                }
            }
            

            return true;
        } catch (error) {
            console.error('应用合成器参数时出错:', error);
            return false;
        }
    }

    /**
     * 打开导入文件选择框
     * @param {number} targetSlotIndex - 要导入到的目标插槽索引
     */
    openImportDialog(targetSlotIndex) {
        if (!this.importInput) {
            this.createImportInput();
        }
        
        // 确保目标插槽索引有效
        if (targetSlotIndex === undefined || targetSlotIndex < 0 || targetSlotIndex > 7) {
            console.error('无效的目标插槽索引:', targetSlotIndex);
            alert('无法打开导入对话框: 无效的插槽索引');
            return;
        }
        
        // 使用内部兼容方法检查权限
        if (!this.canEditSlot(targetSlotIndex)) {
            alert(`您没有编辑插槽 ${targetSlotIndex + 1} 的权限，无法导入`);
            return;
        }
        
        // 存储目标插槽索引到input元素的dataset属性
        this.importInput.dataset.targetSlot = targetSlotIndex;

        
        // 清空input的value，确保同一文件可以重复选择
        this.importInput.value = '';
        
        // 打开文件选择对话框
        this.importInput.click();
    }

    /**
     * 创建导入导出界面
     * @param {number} currentSlotIndex - 当前选中的插槽索引
     */
    showImportExportDialog(currentSlotIndex) {
        // 检查是否已有对话框打开
        let dialog = document.getElementById('import-export-dialog');
        if (dialog) {
            document.body.removeChild(dialog);
        }
        
        // 创建对话框
        dialog = document.createElement('div');
        dialog.id = 'import-export-dialog';
        dialog.className = 'import-export-dialog';
        
        // 设置对话框内容
        dialog.innerHTML = `
            <div class="dialog-header">
                <h2>Import/Export Slot ${currentSlotIndex + 1} Data</h2>
                <button class="close-button">×</button>
            </div>
            <div class="dialog-content">
                <p>You can export the current slot data as a JSON file, or import data from a JSON file to the current slot.</p>
                <div class="dialog-buttons">
                    <button id="export-button" class="dialog-button export-button">Export Slot ${currentSlotIndex + 1}</button>
                    <button id="import-button" class="dialog-button import-button">Import to Slot ${currentSlotIndex + 1}</button>
                </div>
            </div>
        `;
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .import-export-dialog {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: rgba(34, 34, 34, 0.95);
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.7);
                z-index: 9999;
                color: white;
                font-family: Arial, sans-serif;
                text-align: center;
                min-width: 350px;
                max-width: 90%;
            }
            
            .dialog-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                padding-bottom: 10px;
            }
            
            .dialog-header h2 {
                margin: 0;
                font-size: 18px;
                color: #fff;
            }
            
            .close-button {
                background: none;
                border: none;
                color: #aaa;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                margin: 0;
                line-height: 1;
            }
            
            .close-button:hover {
                color: #fff;
            }
            
            .dialog-content {
                margin-bottom: 15px;
            }
            
            .dialog-content p {
                margin-bottom: 20px;
                color: #ccc;
                font-size: 14px;
            }
            
            .dialog-buttons {
                display: flex;
                gap: 10px;
                justify-content: center;
            }
            
            .dialog-button {
                background-color: #555;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                min-width: 150px;
                transition: background-color 0.2s;
            }
            
            .dialog-button:hover {
                background-color: #666;
            }
            
            .export-button {
                background-color: #4CAF50;
            }
            
            .export-button:hover {
                background-color: #5BBF60;
            }
            
            .import-button {
                background-color: #2196F3;
            }
            
            .import-button:hover {
                background-color: #42A6F3;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(dialog);
        
        // 添加事件处理
        const closeButton = dialog.querySelector('.close-button');
        closeButton.addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        // 导出按钮
        const exportButton = document.getElementById('export-button');
        exportButton.addEventListener('click', () => {
            this.exportSlot(currentSlotIndex);
            document.body.removeChild(dialog);
        });
        
        // 导入按钮
        const importButton = document.getElementById('import-button');
        importButton.addEventListener('click', () => {
            this.openImportDialog(currentSlotIndex);
            document.body.removeChild(dialog);
        });
        
        // 点击对话框外部关闭
        document.addEventListener('click', (event) => {
            if (document.getElementById('import-export-dialog') && 
                !document.getElementById('import-export-dialog').contains(event.target) &&
                event.target.id !== 'export-import-button') {
                document.body.removeChild(dialog);
            }
        }, { once: true });
    }
}

// 创建全局实例
window.patternImportExport = new PatternImportExport();

// 在页面加载完成后初始化
window.addEventListener('load', () => {
    window.patternImportExport.init();
}); 