/**
 * SynthPresetManager.js - 用于管理合成器预设参数
 * 独立存储和管理每个插槽的合成器设置
 */

class SynthPresetManager {
    constructor() {
        // 初始化合成器属性
        this.presetWaveforms = ['sine', 'triangle', 'sawtooth', 'square', 'sine', 'triangle', 'sawtooth', 'square'];
        this.presetBaseNotes = ['C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4'];
        
        // 初始化包络参数数组 - 每个插槽独立存储
        this.presetEnvelopeParams = Array(8).fill().map(() => ({
            attack: 0.01,
            decay: 0.1,
            sustain: 0.5,
            release: 0.1
        }));
        
        // 初始化滤波器参数数组
        this.presetFilterParams = Array(8).fill().map(() => ({
            type: 'lowpass',
            frequency: 2000,
            Q: 1,
            gain: 0
        }));
        
        // 初始化延迟效果参数数组
        this.presetDelayParams = Array(8).fill().map(() => ({
            time: 0.25,
            feedback: 0.3,
            mix: 0.2
        }));
        
        // 初始化延迟效果启用状态
        this.presetDelayEnabled = Array(8).fill(false);
        
        // 初始化混响效果参数数组
        this.presetReverbParams = Array(8).fill().map(() => ({
            decay: 1.5,
            preDelay: 0.01,
            mix: 0.1
        }));
        
        // 初始化混响效果启用状态
        this.presetReverbEnabled = Array(8).fill(false);
        
        // 初始化滑音参数数组
        this.presetPortamentoEnabled = Array(8).fill(false);
        this.presetPortamentoTime = Array(8).fill(0.05);
        

    }
    
    /**
     * 初始化合成器预设系统
     */
    init() {
        // 确保全局访问
        window.synthPresetManager = this;
        
        // 兼容原有代码 - 将属性添加到window.metronome
        if (window.metronome) {
            window.metronome.presetWaveforms = this.presetWaveforms;
            window.metronome.presetBaseNotes = this.presetBaseNotes;
            window.metronome.presetEnvelopeParams = this.presetEnvelopeParams;
            window.metronome.presetFilterParams = this.presetFilterParams;
            window.metronome.presetDelayParams = this.presetDelayParams;
            window.metronome.presetReverbParams = this.presetReverbParams;
            window.metronome.presetPortamentoEnabled = this.presetPortamentoEnabled;
            window.metronome.presetPortamentoTime = this.presetPortamentoTime;
            
            // 同步效果启用状态
            if (window.metronome.synthUI) {
                if (!window.metronome.synthUI.delay) {
                    window.metronome.synthUI.delay = { enabled: Array(8).fill(false) };
                }
                if (!window.metronome.synthUI.reverb) {
                    window.metronome.synthUI.reverb = { enabled: Array(8).fill(false) };
                }
                
                // 复制状态值（如果有）
                window.metronome.synthUI.delay.enabled = [...this.presetDelayEnabled];
                window.metronome.synthUI.reverb.enabled = [...this.presetReverbEnabled];
            }
            
            // 添加定期同步功能，确保UI状态变化被保存
            this.setupSyncFromUI();
        }
        
        return this;
    }
    
    /**
     * 设置从UI同步效果器状态到SynthPresetManager的定期检查
     * 这确保即使忘记调用setDelayEnabled/setReverbEnabled，状态也能被正确保存
     */
    setupSyncFromUI() {
        // 每5秒检查一次，确保状态保持同步
        setInterval(() => {
            if (window.metronome && window.metronome.synthUI) {
                // 同步延迟效果状态
                if (window.metronome.synthUI.delay && window.metronome.synthUI.delay.enabled) {
                    for (let i = 0; i < 8; i++) {
                        if (this.presetDelayEnabled[i] !== window.metronome.synthUI.delay.enabled[i]) {
                            this.presetDelayEnabled[i] = window.metronome.synthUI.delay.enabled[i];

                        }
                    }
                }
                
                // 同步混响效果状态
                if (window.metronome.synthUI.reverb && window.metronome.synthUI.reverb.enabled) {
                    for (let i = 0; i < 8; i++) {
                        if (this.presetReverbEnabled[i] !== window.metronome.synthUI.reverb.enabled[i]) {
                            this.presetReverbEnabled[i] = window.metronome.synthUI.reverb.enabled[i];

                        }
                    }
                }
            }
        }, 5000); // 5秒检查一次
    }
    
    /**
     * 获取指定插槽的所有合成器参数
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @returns {Object} 合成器参数对象
     */
    getSlotSynthParams(slotIndex) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return null;
        }
        
        return {
            waveform: this.presetWaveforms[slotIndex] || 'sine',
            baseNote: this.presetBaseNotes[slotIndex] || 'C4',
            envelope: { ...this.presetEnvelopeParams[slotIndex] },
            filter: { ...this.presetFilterParams[slotIndex] },
            delay: { 
                ...this.presetDelayParams[slotIndex],
                enabled: this.presetDelayEnabled[slotIndex] || false
            },
            reverb: { 
                ...this.presetReverbParams[slotIndex],
                enabled: this.presetReverbEnabled[slotIndex] || false
            },
            portamento: this.presetPortamentoEnabled[slotIndex] || false,
            portamentoTime: this.presetPortamentoTime[slotIndex] || 0
        };
    }
    
    /**
     * 分发合成器参数变化事件，通知服务器同步
     * 此方法仅在鼠标释放后调用，避免拖拽过程中频繁同步
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @param {Object} params - 要同步的参数对象
     * @private
     */
    dispatchSynthParamsChanged(slotIndex, params) {
        if (slotIndex < 0 || slotIndex > 7) return;
        
        // 检查是否在拖拽过程中，如果是则不触发同步
        if (window.isSynthDragging === true) {

            return;
        }
        
        // 创建一个包含所有必要参数的对象
        const fullParams = params || this.getSlotSynthParams(slotIndex);
        
        // 触发自定义事件通知服务器
        window.dispatchEvent(new CustomEvent('synth-params-changed', {
            detail: fullParams
        }));
        

    }
    
    /**
     * 设置指定插槽的波形
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @param {string} waveform - 波形类型 ('sine', 'triangle', 'sawtooth', 'square')
     */
    setWaveform(slotIndex, waveform) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return;
        }
        
        const validWaveforms = ['sine', 'triangle', 'sawtooth', 'square'];
        if (!validWaveforms.includes(waveform)) {
            console.error('无效的波形类型:', waveform);
            return;
        }
        
        this.presetWaveforms[slotIndex] = waveform;
        
        // 更新到metronome对象保持兼容性
        if (window.metronome) {
            window.metronome.presetWaveforms = this.presetWaveforms;
        }
        

        
        // 触发参数变化事件
        this.dispatchSynthParamsChanged(slotIndex, { waveform });
    }
    
    /**
     * 设置指定插槽的基础音符
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @param {string} noteName - 音符名称 (例如 'C4')
     */
    setBaseNote(slotIndex, noteName) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return;
        }
        
        this.presetBaseNotes[slotIndex] = noteName;
        
        // 更新到metronome对象保持兼容性
        if (window.metronome) {
            window.metronome.presetBaseNotes = this.presetBaseNotes;
        }
        

        
        // 触发参数变化事件
        this.dispatchSynthParamsChanged(slotIndex, { baseNote: this.presetBaseNotes[slotIndex] });
    }
    
    /**
     * 设置指定插槽的包络参数
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @param {Object} envelopeParams - 包络参数对象 {attack, decay, sustain, release}
     */
    setEnvelopeParams(slotIndex, envelopeParams) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return;
        }
        
        const currentParams = this.presetEnvelopeParams[slotIndex] || {
            attack: 0.01,
            decay: 0.1,
            sustain: 0.5,
            release: 0.1
        };
        
        // 合并新参数，保留未提供的现有值
        this.presetEnvelopeParams[slotIndex] = {
            ...currentParams,
            ...envelopeParams
        };
        
        // 更新到metronome对象保持兼容性
        if (window.metronome) {
            window.metronome.presetEnvelopeParams = this.presetEnvelopeParams;
        }
        

        
        // 触发参数变化事件
        this.dispatchSynthParamsChanged(slotIndex, { envelope: this.presetEnvelopeParams[slotIndex] });
    }
    
    /**
     * 设置指定插槽的滤波器参数
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @param {Object} filterParams - 滤波器参数对象 {type, frequency, Q, gain}
     */
    setFilterParams(slotIndex, filterParams) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return;
        }
        
        const currentParams = this.presetFilterParams[slotIndex] || {
            type: 'lowpass',
            frequency: 2000,
            Q: 1,
            gain: 0
        };
        
        // 合并新参数，保留未提供的现有值
        this.presetFilterParams[slotIndex] = {
            ...currentParams,
            ...filterParams
        };
        
        // 更新到metronome对象保持兼容性
        if (window.metronome) {
            window.metronome.presetFilterParams = this.presetFilterParams;
        }
        

        
        // 触发参数变化事件
        this.dispatchSynthParamsChanged(slotIndex, { filter: this.presetFilterParams[slotIndex] });
    }
    
    /**
     * 设置指定插槽的延迟效果参数
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @param {Object} delayParams - 延迟效果参数对象 {time, feedback, mix}
     */
    setDelayParams(slotIndex, delayParams) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return;
        }
        
        const currentParams = this.presetDelayParams[slotIndex] || {
            time: 0.25,
            feedback: 0.3,
            mix: 0.2
        };
        
        // 合并新参数，保留未提供的现有值
        this.presetDelayParams[slotIndex] = {
            ...currentParams,
            ...delayParams
        };
        
        // 更新到metronome对象保持兼容性
        if (window.metronome) {
            window.metronome.presetDelayParams = this.presetDelayParams;
        }
        

        
        // 触发参数变化事件，添加启用状态
        this.dispatchSynthParamsChanged(slotIndex, { 
            delay: {
                ...this.presetDelayParams[slotIndex],
                enabled: this.presetDelayEnabled[slotIndex]
            } 
        });
    }
    
    /**
     * 设置指定插槽的延迟效果启用状态
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @param {boolean} enabled - 是否启用延迟效果
     */
    setDelayEnabled(slotIndex, enabled) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return;
        }
        
        this.presetDelayEnabled[slotIndex] = !!enabled;
        
        // 更新到metronome对象保持兼容性
        if (window.metronome && window.metronome.synthUI && window.metronome.synthUI.delay) {
            window.metronome.synthUI.delay.enabled[slotIndex] = this.presetDelayEnabled[slotIndex];
        }
        

        
        // 触发参数变化事件
        this.dispatchSynthParamsChanged(slotIndex, { 
            delay: {
                ...this.presetDelayParams[slotIndex],
                enabled: this.presetDelayEnabled[slotIndex]
            }
        });
    }
    
    /**
     * 设置指定插槽的混响效果参数
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @param {Object} reverbParams - 混响效果参数对象 {decay, preDelay, mix}
     */
    setReverbParams(slotIndex, reverbParams) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return;
        }
        
        const currentParams = this.presetReverbParams[slotIndex] || {
            decay: 1.5,
            preDelay: 0.01,
            mix: 0.1
        };
        
        // 合并新参数，保留未提供的现有值
        this.presetReverbParams[slotIndex] = {
            ...currentParams,
            ...reverbParams
        };
        
        // 更新到metronome对象保持兼容性
        if (window.metronome) {
            window.metronome.presetReverbParams = this.presetReverbParams;
        }
        

        
        // 触发参数变化事件，添加启用状态
        this.dispatchSynthParamsChanged(slotIndex, { 
            reverb: {
                ...this.presetReverbParams[slotIndex],
                enabled: this.presetReverbEnabled[slotIndex]
            } 
        });
    }
    
    /**
     * 设置指定插槽的混响效果启用状态
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @param {boolean} enabled - 是否启用混响效果
     */
    setReverbEnabled(slotIndex, enabled) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return;
        }
        
        this.presetReverbEnabled[slotIndex] = !!enabled;
        
        // 更新到metronome对象保持兼容性
        if (window.metronome && window.metronome.synthUI && window.metronome.synthUI.reverb) {
            window.metronome.synthUI.reverb.enabled[slotIndex] = this.presetReverbEnabled[slotIndex];
        }
        

        
        // 触发参数变化事件
        this.dispatchSynthParamsChanged(slotIndex, { 
            reverb: {
                ...this.presetReverbParams[slotIndex],
                enabled: this.presetReverbEnabled[slotIndex]
            }
        });
    }
    
    /**
     * 设置指定插槽的滑音启用状态
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @param {boolean} enabled - 是否启用滑音
     */
    setPortamentoEnabled(slotIndex, enabled) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return;
        }
        
        this.presetPortamentoEnabled[slotIndex] = !!enabled;
        
        // 更新到metronome对象保持兼容性
        if (window.metronome) {
            window.metronome.presetPortamentoEnabled = this.presetPortamentoEnabled;
        }
        

        
        // 触发参数变化事件
        this.dispatchSynthParamsChanged(slotIndex, { 
            portamentoEnabled: this.presetPortamentoEnabled[slotIndex],
            portamentoTime: this.presetPortamentoTime[slotIndex]
        });
    }
    
    /**
     * 设置指定插槽的滑音时间
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @param {number} time - 滑音时间 (秒)
     */
    setPortamentoTime(slotIndex, time) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return;
        }
        
        if (typeof time !== 'number' || time < 0) {
            console.error('无效的滑音时间:', time);
            return;
        }
        
        this.presetPortamentoTime[slotIndex] = time;
        
        // 更新到metronome对象保持兼容性
        if (window.metronome) {
            window.metronome.presetPortamentoTime = this.presetPortamentoTime;
        }
        

        
        // 触发参数变化事件
        this.dispatchSynthParamsChanged(slotIndex, { 
            portamentoEnabled: this.presetPortamentoEnabled[slotIndex],
            portamentoTime: this.presetPortamentoTime[slotIndex]
        });
    }
    
    /**
     * 复制一个插槽的所有合成器参数到另一个插槽
     * @param {number} sourceSlotIndex - 源插槽索引 (0-7)
     * @param {number} targetSlotIndex - 目标插槽索引 (0-7)
     */
    copySlotParams(sourceSlotIndex, targetSlotIndex) {
        if (sourceSlotIndex < 0 || sourceSlotIndex > 7 || targetSlotIndex < 0 || targetSlotIndex > 7) {
            console.error('无效的插槽索引, 源:', sourceSlotIndex, '目标:', targetSlotIndex);
            return false;
        }
        
        // 复制波形
        this.presetWaveforms[targetSlotIndex] = this.presetWaveforms[sourceSlotIndex];
        
        // 复制基础音符
        this.presetBaseNotes[targetSlotIndex] = this.presetBaseNotes[sourceSlotIndex];
        
        // 复制包络参数
        this.presetEnvelopeParams[targetSlotIndex] = { ...this.presetEnvelopeParams[sourceSlotIndex] };
        
        // 复制滤波器参数
        this.presetFilterParams[targetSlotIndex] = { ...this.presetFilterParams[sourceSlotIndex] };
        
        // 复制延迟参数
        this.presetDelayParams[targetSlotIndex] = { ...this.presetDelayParams[sourceSlotIndex] };
        this.presetDelayEnabled[targetSlotIndex] = this.presetDelayEnabled[sourceSlotIndex];
        
        // 复制混响参数
        this.presetReverbParams[targetSlotIndex] = { ...this.presetReverbParams[sourceSlotIndex] };
        this.presetReverbEnabled[targetSlotIndex] = this.presetReverbEnabled[sourceSlotIndex];
        
        // 复制滑音参数
        this.presetPortamentoEnabled[targetSlotIndex] = this.presetPortamentoEnabled[sourceSlotIndex];
        this.presetPortamentoTime[targetSlotIndex] = this.presetPortamentoTime[sourceSlotIndex];
        
        // 更新到metronome对象保持兼容性
        if (window.metronome) {
            window.metronome.presetWaveforms = this.presetWaveforms;
            window.metronome.presetBaseNotes = this.presetBaseNotes;
            window.metronome.presetEnvelopeParams = this.presetEnvelopeParams;
            window.metronome.presetFilterParams = this.presetFilterParams;
            window.metronome.presetDelayParams = this.presetDelayParams;
            window.metronome.presetReverbParams = this.presetReverbParams;
            window.metronome.presetPortamentoEnabled = this.presetPortamentoEnabled;
            window.metronome.presetPortamentoTime = this.presetPortamentoTime;
            
            // 同步效果状态
            if (window.metronome.synthUI) {
                if (window.metronome.synthUI.delay) {
                    window.metronome.synthUI.delay.enabled[targetSlotIndex] = this.presetDelayEnabled[targetSlotIndex];
                }
                if (window.metronome.synthUI.reverb) {
                    window.metronome.synthUI.reverb.enabled[targetSlotIndex] = this.presetReverbEnabled[targetSlotIndex];
                }
            }
        }
        

        return true;
    }
    
    /**
     * 重置指定插槽的所有合成器参数到默认值
     * @param {number} slotIndex - 插槽索引 (0-7)
     */
    resetSlotParams(slotIndex) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return false;
        }
        
        // 重置波形
        this.presetWaveforms[slotIndex] = 'sine';
        
        // 重置基础音符
        this.presetBaseNotes[slotIndex] = 'C4';
        
        // 重置包络参数
        this.presetEnvelopeParams[slotIndex] = {
            attack: 0.01,
            decay: 0.1,
            sustain: 0.5,
            release: 0.1
        };
        
        // 重置滤波器参数
        this.presetFilterParams[slotIndex] = {
            type: 'lowpass',
            frequency: 2000,
            Q: 1,
            gain: 0
        };
        
        // 重置延迟参数
        this.presetDelayParams[slotIndex] = {
            time: 0.25,
            feedback: 0.3,
            mix: 0.2
        };
        this.presetDelayEnabled[slotIndex] = false;
        
        // 重置混响参数
        this.presetReverbParams[slotIndex] = {
            decay: 1.5,
            preDelay: 0.01,
            mix: 0.1
        };
        this.presetReverbEnabled[slotIndex] = false;
        
        // 重置滑音参数
        this.presetPortamentoEnabled[slotIndex] = false;
        this.presetPortamentoTime[slotIndex] = 0.05;
        
        // 更新到metronome对象保持兼容性
        if (window.metronome) {
            window.metronome.presetWaveforms = this.presetWaveforms;
            window.metronome.presetBaseNotes = this.presetBaseNotes;
            window.metronome.presetEnvelopeParams = this.presetEnvelopeParams;
            window.metronome.presetFilterParams = this.presetFilterParams;
            window.metronome.presetDelayParams = this.presetDelayParams;
            window.metronome.presetReverbParams = this.presetReverbParams;
            window.metronome.presetPortamentoEnabled = this.presetPortamentoEnabled;
            window.metronome.presetPortamentoTime = this.presetPortamentoTime;
            
            // 同步效果状态
            if (window.metronome.synthUI) {
                if (window.metronome.synthUI.delay) {
                    window.metronome.synthUI.delay.enabled[slotIndex] = false;
                }
                if (window.metronome.synthUI.reverb) {
                    window.metronome.synthUI.reverb.enabled[slotIndex] = false;
                }
            }
        }
        

        return true;
    }
    
    /**
     * 从JSON对象导入合成器参数到指定插槽
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @param {Object} paramsJson - 包含合成器参数的JSON对象
     */
    importParamsFromJson(slotIndex, paramsJson) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return false;
        }
        
        try {
            // 检查JSON对象是否有效
            if (!paramsJson || typeof paramsJson !== 'object') {
                console.error('无效的JSON参数对象');
                return false;
            }
            

            
            // 导入波形
            if (paramsJson.waveform) {
                this.setWaveform(slotIndex, paramsJson.waveform);
            }
            
            // 导入基础音符
            if (paramsJson.baseNote) {
                this.setBaseNote(slotIndex, paramsJson.baseNote);
            }
            
            // 导入包络参数
            if (paramsJson.envelope) {
                this.setEnvelopeParams(slotIndex, paramsJson.envelope);
            }
            
            // 导入滤波器参数
            if (paramsJson.filter) {
                this.setFilterParams(slotIndex, paramsJson.filter);
            }
            
            // 导入延迟参数
            if (paramsJson.delay) {
                // 确保分离enabled状态进行特殊处理
                if (typeof paramsJson.delay === 'object') {
                    const delayParams = {...paramsJson.delay};
                    const enabled = delayParams.enabled;
                    delete delayParams.enabled;
                    
                    // 先设置参数
                    this.setDelayParams(slotIndex, delayParams);
                    
                    // 再单独设置开关状态
                    if (enabled !== undefined) {

                        this.setDelayEnabled(slotIndex, enabled);
                    }
                }
            }
            
            // 导入混响参数
            if (paramsJson.reverb) {
                // 确保分离enabled状态进行特殊处理
                if (typeof paramsJson.reverb === 'object') {
                    const reverbParams = {...paramsJson.reverb};
                    const enabled = reverbParams.enabled;
                    delete reverbParams.enabled;
                    
                    // 先设置参数
                    this.setReverbParams(slotIndex, reverbParams);
                    
                    // 再单独设置开关状态
                    if (enabled !== undefined) {

                        this.setReverbEnabled(slotIndex, enabled);
                    }
                }
            }
            
            // 导入滑音参数
            if (paramsJson.portamento !== undefined) {
                this.setPortamentoEnabled(slotIndex, paramsJson.portamento);
            }
            
            if (paramsJson.portamentoTime !== undefined) {
                this.setPortamentoTime(slotIndex, paramsJson.portamentoTime);
            }
            
            // 立即将参数应用到活动实例
            this.applySynthParamsToActiveInstance(slotIndex);
            

            return true;
        } catch (error) {
            console.error('导入合成器参数出错:', error);
            return false;
        }
    }
    
    /**
     * 导出指定插槽的合成器参数为JSON对象
     * @param {number} slotIndex - 插槽索引 (0-7)
     * @returns {Object} 包含所有合成器参数的JSON对象
     */
    exportParamsAsJson(slotIndex) {
        if (slotIndex < 0 || slotIndex > 7) {
            console.error('无效的插槽索引:', slotIndex);
            return null;
        }
        
        try {
            // 创建包含所有参数的导出对象
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                slotIndex: slotIndex,
                waveform: this.presetWaveforms[slotIndex] || 'sine',
                baseNote: this.presetBaseNotes[slotIndex] || 'C4',
                envelope: { ...this.presetEnvelopeParams[slotIndex] },
                filter: { ...this.presetFilterParams[slotIndex] },
                delay: { 
                    ...this.presetDelayParams[slotIndex],
                    enabled: this.presetDelayEnabled[slotIndex] || false
                },
                reverb: { 
                    ...this.presetReverbParams[slotIndex],
                    enabled: this.presetReverbEnabled[slotIndex] || false
                },
                portamento: this.presetPortamentoEnabled[slotIndex] || false,
                portamentoTime: this.presetPortamentoTime[slotIndex] || 0
            };
            

            return exportData;
        } catch (error) {
            console.error('导出合成器参数出错:', error);
            return null;
        }
    }
    
    /**
     * 同步合成器参数与当前实例化的合成器
     * @param {number} slotIndex - 需要同步的插槽索引 (0-7)
     */
    applySynthParamsToActiveInstance(slotIndex) {
        if (slotIndex < 0 || slotIndex > 7 || !window.metronome || !window.metronome.presetSounds) {
            return false;
        }
        
        try {
            const synth = window.metronome.presetSounds[slotIndex];
            if (!synth) return false;
            
            // 获取当前插槽的参数
            const waveform = this.presetWaveforms[slotIndex];
            const envelopeParams = this.presetEnvelopeParams[slotIndex];
            const filterParams = this.presetFilterParams[slotIndex];
            const portamentoEnabled = this.presetPortamentoEnabled[slotIndex];
            const portamentoTime = this.presetPortamentoTime[slotIndex];
            
            // 同步到metronome.synthParams - 这对于ADSR和Filter参数非常重要
            if (window.metronome.synthParams && window.metronome.synthParams[slotIndex]) {
                // 更新放大器包络参数
                if (envelopeParams) {
                    window.metronome.synthParams[slotIndex].attack = envelopeParams.attack;
                    window.metronome.synthParams[slotIndex].decay = envelopeParams.decay;
                    window.metronome.synthParams[slotIndex].sustain = envelopeParams.sustain;
                    window.metronome.synthParams[slotIndex].release = envelopeParams.release;
                    
                    // 更新滤波器包络参数 - 拷贝相同的ADSR值，因为当前系统设计如此
                    window.metronome.synthParams[slotIndex].filterAttack = envelopeParams.attack;
                    window.metronome.synthParams[slotIndex].filterDecay = envelopeParams.decay;
                    window.metronome.synthParams[slotIndex].filterSustain = envelopeParams.sustain;
                    window.metronome.synthParams[slotIndex].filterRelease = envelopeParams.release;
                }
                
                // 更新滤波器参数
                if (filterParams) {
                    window.metronome.synthParams[slotIndex].filterType = filterParams.type;
                    window.metronome.synthParams[slotIndex].filterFreq = filterParams.frequency;
                    window.metronome.synthParams[slotIndex].filterQ = filterParams.Q;
                    
                    // 设置滤波器包络深度，默认为2
                    window.metronome.synthParams[slotIndex].filterEnvAmount = filterParams.envAmount || 2;
                }
                
                // 更新滑音参数
                window.metronome.synthParams[slotIndex].portamento = portamentoEnabled ? portamentoTime : 0;
                
                // 更新延迟参数
                const delayParams = this.presetDelayParams[slotIndex];
                const delayEnabled = this.presetDelayEnabled[slotIndex];
                if (delayParams) {
                    window.metronome.synthParams[slotIndex].delayTime = delayParams.time;
                    window.metronome.synthParams[slotIndex].delayFeedback = delayParams.feedback;
                    window.metronome.synthParams[slotIndex].delayWet = delayParams.mix;
                    window.metronome.synthParams[slotIndex].delayEnabled = delayEnabled;
                }
                
                // 更新混响参数
                const reverbParams = this.presetReverbParams[slotIndex];
                const reverbEnabled = this.presetReverbEnabled[slotIndex];
                if (reverbParams) {
                    window.metronome.synthParams[slotIndex].reverbDecay = reverbParams.decay;
                    window.metronome.synthParams[slotIndex].reverbWet = reverbParams.mix;
                    window.metronome.synthParams[slotIndex].reverbEnabled = reverbEnabled;
                }
                

            }
            
            // 更新合成器
            if (synth.oscillator) {
                synth.oscillator.type = waveform;
            }
            
            if (synth.envelope) {
                synth.envelope.attack = envelopeParams.attack;
                synth.envelope.decay = envelopeParams.decay;
                synth.envelope.sustain = envelopeParams.sustain;
                synth.envelope.release = envelopeParams.release;
            }
            
            if (synth.filter) {
                synth.filter.type = filterParams.type;
                synth.filter.frequency.value = filterParams.frequency;
                synth.filter.Q.value = filterParams.Q;
            }
            
            // 更新滑音
            synth.portamento = portamentoEnabled ? portamentoTime : 0;
            
            // 更新延迟效果
            const delayParams = this.presetDelayParams[slotIndex];
            const delayEnabled = this.presetDelayEnabled[slotIndex];
            
            // 首先同步UI状态
            if (window.metronome.synthUI) {
                // 确保 synthUI.delay 存在
                if (!window.metronome.synthUI.delay) {
                    window.metronome.synthUI.delay = { enabled: Array(8).fill(false) };
                }
                // 同步延迟开关状态到UI
                if (!window.metronome.synthUI.delay.enabled) {
                    window.metronome.synthUI.delay.enabled = Array(8).fill(false);
                }
                window.metronome.synthUI.delay.enabled[slotIndex] = !!delayEnabled;
                
                // 确保 synthUI.reverb 存在
                if (!window.metronome.synthUI.reverb) {
                    window.metronome.synthUI.reverb = { enabled: Array(8).fill(false) };
                }
                // 同步混响开关状态到UI
                if (!window.metronome.synthUI.reverb.enabled) {
                    window.metronome.synthUI.reverb.enabled = Array(8).fill(false);
                }
                window.metronome.synthUI.reverb.enabled[slotIndex] = !!this.presetReverbEnabled[slotIndex];
            }
            
            // 更新延迟效果参数和状态
            if (window.metronome.delayEffects && window.metronome.delayEffects[slotIndex]) {
                const delay = window.metronome.delayEffects[slotIndex];
                
                delay.delayTime.value = delayParams.time;
                delay.feedback.value = delayParams.feedback;
                delay.wet.value = delayEnabled ? delayParams.mix : 0;
                
                console.log(`插槽${slotIndex + 1}延迟效果参数已应用:`, 
                    {时间: delayParams.time, 反馈: delayParams.feedback, 混合: delayParams.mix, 开关: delayEnabled});
            }
            
            // 更新混响效果参数和状态
            const reverbParams = this.presetReverbParams[slotIndex];
            const reverbEnabled = this.presetReverbEnabled[slotIndex];
            
            if (window.metronome.reverbEffects && window.metronome.reverbEffects[slotIndex]) {
                const reverb = window.metronome.reverbEffects[slotIndex];
                
                reverb.decay = reverbParams.decay;
                reverb.preDelay = reverbParams.preDelay;
                reverb.wet.value = reverbEnabled ? reverbParams.mix : 0;
                
                // 确保混响启用状态正确应用
                if (reverbEnabled && typeof reverb.generate === 'function') {
                    // 如果开启了混响，重新生成冲激响应
                    try {
                        reverb.generate();
                    } catch (e) {
                        console.warn(`重新生成插槽${slotIndex + 1}混响冲激响应时出错:`, e);
                    }
                }
                
                console.log(`插槽${slotIndex + 1}混响效果参数已应用:`, 
                    {衰减: reverbParams.decay, 前置延迟: reverbParams.preDelay, 混合: reverbParams.mix, 开关: reverbEnabled});
            }
            

            return true;
        } catch (error) {
            console.error('应用合成器参数到活动实例时出错:', error);
            return false;
        }
    }
}

// 创建全局实例
window.synthPresetManager = new SynthPresetManager();

// 在页面加载完成后初始化
window.addEventListener('load', () => {
    window.synthPresetManager.init();
}); 