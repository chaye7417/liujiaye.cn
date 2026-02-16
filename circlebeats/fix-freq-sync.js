/**
 * 修复合成器FREQ(滤波器频率)参数同步问题
 * 
 * 问题分析：
 * 1. 滤波器频率在不同地方使用不同的属性名：filterFreq vs frequency
 * 2. 同步时数据结构不一致导致FREQ参数丢失
 * 3. applySynthParamsToActiveInstance没有正确应用频率参数
 */

(function() {
    console.log('🔧 开始修复FREQ参数同步问题...');
    
    // 1. 修复SynthPresetManager的getSlotSynthParams方法，确保FREQ参数格式正确
    function fixGetSlotSynthParams() {
        if (!window.synthPresetManager || !window.synthPresetManager.getSlotSynthParams) {
            console.error('❌ SynthPresetManager.getSlotSynthParams 不存在');
            return;
        }
        
        const originalGetParams = window.synthPresetManager.getSlotSynthParams;
        
        window.synthPresetManager.getSlotSynthParams = function(slotIndex) {
            const params = originalGetParams.call(this, slotIndex);
            
            if (params && params.filter) {
                // 🔥 关键修复：确保滤波器参数包含所有必要字段，统一命名
                const filterParams = params.filter;
                
                // 统一频率参数命名，同时保留两种格式以确保兼容性
                if (filterParams.frequency !== undefined) {
                    filterParams.freq = filterParams.frequency;
                    filterParams.filterFreq = filterParams.frequency;
                } else if (filterParams.filterFreq !== undefined) {
                    filterParams.frequency = filterParams.filterFreq;
                    filterParams.freq = filterParams.filterFreq;
                } else if (filterParams.freq !== undefined) {
                    filterParams.frequency = filterParams.freq;
                    filterParams.filterFreq = filterParams.freq;
                }
                
                console.log(`🎛️ 统一插槽 ${slotIndex + 1} 的滤波器频率参数: ${filterParams.frequency}Hz`);
            }
            
            return params;
        };
        
        console.log('✅ 修复了getSlotSynthParams方法中的频率参数格式');
    }
    
    // 2. 修复setFilterParams方法，确保正确同步
    function fixSetFilterParams() {
        if (!window.synthPresetManager || !window.synthPresetManager.setFilterParams) {
            console.error('❌ SynthPresetManager.setFilterParams 不存在');
            return;
        }
        
        const originalSetFilter = window.synthPresetManager.setFilterParams;
        
        window.synthPresetManager.setFilterParams = function(slotIndex, filterParams) {
            if (slotIndex < 0 || slotIndex > 7) {
                console.error('无效的插槽索引:', slotIndex);
                return;
            }
            
            // 🔥 关键修复：统一频率参数命名
            if (filterParams) {
                const normalizedParams = { ...filterParams };
                
                // 统一频率参数：如果存在任何形式的频率参数，都转换为标准的frequency
                if (normalizedParams.filterFreq !== undefined) {
                    normalizedParams.frequency = normalizedParams.filterFreq;
                } else if (normalizedParams.freq !== undefined) {
                    normalizedParams.frequency = normalizedParams.freq;
                }
                
                console.log(`🎛️ 设置插槽 ${slotIndex + 1} 滤波器参数，频率: ${normalizedParams.frequency}Hz`);
                
                // 调用原方法
                originalSetFilter.call(this, slotIndex, normalizedParams);
                
                // 🔥 额外修复：立即同步到metronome.synthParams
                if (window.metronome && window.metronome.synthParams && window.metronome.synthParams[slotIndex]) {
                    window.metronome.synthParams[slotIndex].filterFreq = normalizedParams.frequency;
                    window.metronome.synthParams[slotIndex].filterType = normalizedParams.type;
                    window.metronome.synthParams[slotIndex].filterQ = normalizedParams.Q;
                    
                    console.log(`🔄 已同步到metronome.synthParams[${slotIndex}].filterFreq = ${normalizedParams.frequency}`);
                }
                
                // 🔥 立即应用到活跃的合成器实例
                if (window.metronome && window.metronome.presetSounds && window.metronome.presetSounds[slotIndex]) {
                    const synth = window.metronome.presetSounds[slotIndex];
                    if (synth.filter) {
                        synth.filter.frequency.value = normalizedParams.frequency;
                        synth.filter.Q.value = normalizedParams.Q;
                        synth.filter.type = normalizedParams.type;
                        
                        console.log(`🎵 已应用到合成器实例，频率: ${normalizedParams.frequency}Hz`);
                    }
                }
            } else {
                // 如果参数为空，调用原方法
                originalSetFilter.call(this, slotIndex, filterParams);
            }
        };
        
        console.log('✅ 修复了setFilterParams方法中的频率参数同步');
    }
    
    // 3. 修复applySynthParamsToActiveInstance方法
    function fixApplySynthParamsToActiveInstance() {
        if (!window.synthPresetManager || !window.synthPresetManager.applySynthParamsToActiveInstance) {
            console.error('❌ SynthPresetManager.applySynthParamsToActiveInstance 不存在');
            return;
        }
        
        const originalApply = window.synthPresetManager.applySynthParamsToActiveInstance;
        
        window.synthPresetManager.applySynthParamsToActiveInstance = function(slotIndex) {
            // 先调用原方法
            const result = originalApply.call(this, slotIndex);
            
            // 🔥 关键修复：确保滤波器频率正确应用
            if (window.metronome && window.metronome.presetSounds && window.metronome.presetSounds[slotIndex]) {
                const synth = window.metronome.presetSounds[slotIndex];
                const filterParams = this.presetFilterParams[slotIndex];
                
                if (synth.filter && filterParams) {
                    // 强制更新滤波器频率
                    const frequency = filterParams.frequency || filterParams.filterFreq || filterParams.freq || 2000;
                    synth.filter.frequency.value = frequency;
                    synth.filter.Q.value = filterParams.Q || 1;
                    synth.filter.type = filterParams.type || 'lowpass';
                    
                    console.log(`🔄 强制应用插槽 ${slotIndex + 1} 滤波器频率: ${frequency}Hz`);
                    
                    // 同时更新滤波器包络的基础频率
                    if (synth.filterEnvelope) {
                        synth.filterEnvelope.baseFrequency = frequency;
                    }
                }
            }
            
            return result;
        };
        
        console.log('✅ 修复了applySynthParamsToActiveInstance方法中的频率应用');
    }
    
    // 4. 修复syncSynthParamsFromServer函数中的频率参数处理
    function fixSyncSynthParamsFromServer() {
        if (!window.syncSynthParamsFromServer) {
            console.error('❌ syncSynthParamsFromServer 函数不存在');
            return;
        }
        
        // 在fix-synth-sync.js基础上进一步增强
        const originalSync = window.syncSynthParamsFromServer;
        
        window.syncSynthParamsFromServer = function(slotIndex, paramsJson) {
            console.log(`📥 收到插槽 ${slotIndex + 1} 的合成器参数更新`);
            
            // 如果当前用户控制这个插槽，不从服务器更新
            if (window.colyseusSlotStates && window.colyseusSlotStates.mySlot === slotIndex) {
                console.log(`⏭️ 跳过同步自己控制的插槽 ${slotIndex + 1}`);
                return;
            }
            
            // 确保SynthPresetManager存在
            if (!window.synthPresetManager) {
                console.error('❌ SynthPresetManager 不存在，无法应用参数');
                return;
            }
            
            try {
                // 解析参数
                const params = typeof paramsJson === 'string' ? JSON.parse(paramsJson) : paramsJson;
                console.log(`🔄 解析参数成功:`, params);
                
                // 🔥 关键修复：特别处理滤波器参数
                if (params.filterParams || params.filter) {
                    const filterData = params.filterParams || params.filter;
                    
                    // 统一频率参数命名
                    let frequency = filterData.frequency || filterData.filterFreq || filterData.freq;
                    if (frequency !== undefined) {
                        const normalizedFilter = {
                            type: filterData.type || 'lowpass',
                            frequency: frequency,
                            Q: filterData.Q || 1,
                            gain: filterData.gain || 0,
                            envAmount: filterData.envAmount || 2
                        };
                        
                        console.log(`🎛️ 统一滤波器参数，频率: ${frequency}Hz`);
                        
                        // 直接设置到预设管理器
                        window.synthPresetManager.presetFilterParams[slotIndex] = normalizedFilter;
                        
                        // 立即同步到metronome.synthParams
                        if (window.metronome && window.metronome.synthParams && window.metronome.synthParams[slotIndex]) {
                            window.metronome.synthParams[slotIndex].filterFreq = frequency;
                            window.metronome.synthParams[slotIndex].filterType = normalizedFilter.type;
                            window.metronome.synthParams[slotIndex].filterQ = normalizedFilter.Q;
                            window.metronome.synthParams[slotIndex].filterEnvAmount = normalizedFilter.envAmount;
                        }
                        
                        console.log(`✅ 更新滤波器参数，频率: ${frequency}Hz`);
                    }
                }
                
                // 处理其他参数（包络、波形等）
                if (params.envelopeParams) {
                    window.synthPresetManager.presetEnvelopeParams[slotIndex] = params.envelopeParams;
                    console.log(`✅ 更新包络参数`);
                }
                
                if (params.waveform) {
                    window.synthPresetManager.presetWaveforms[slotIndex] = params.waveform;
                    console.log(`✅ 更新波形: ${params.waveform}`);
                }
                
                // 更新效果参数
                if (params.delayEnabled !== undefined) {
                    window.synthPresetManager.presetDelayEnabled[slotIndex] = params.delayEnabled;
                    console.log(`✅ 更新延迟启用状态: ${params.delayEnabled}`);
                }
                
                if (params.delayParams) {
                    window.synthPresetManager.presetDelayParams[slotIndex] = params.delayParams;
                    console.log(`✅ 更新延迟参数`);
                }
                
                if (params.reverbEnabled !== undefined) {
                    window.synthPresetManager.presetReverbEnabled[slotIndex] = params.reverbEnabled;
                    console.log(`✅ 更新混响启用状态: ${params.reverbEnabled}`);
                }
                
                if (params.reverbParams) {
                    window.synthPresetManager.presetReverbParams[slotIndex] = params.reverbParams;
                    console.log(`✅ 更新混响参数`);
                }
                
                if (params.portamentoEnabled !== undefined) {
                    window.synthPresetManager.presetPortamentoEnabled[slotIndex] = params.portamentoEnabled;
                    console.log(`✅ 更新滑音启用状态: ${params.portamentoEnabled}`);
                }
                
                if (params.portamentoTime !== undefined) {
                    window.synthPresetManager.presetPortamentoTime[slotIndex] = params.portamentoTime;
                    console.log(`✅ 更新滑音时间: ${params.portamentoTime}`);
                }
                
                // 🔥 关键修复：立即应用所有参数到合成器实例
                if (window.synthPresetManager.applySynthParamsToActiveInstance) {
                    window.synthPresetManager.applySynthParamsToActiveInstance(slotIndex);
                    console.log(`🔄 应用参数到合成器实例`);
                }
                
                // 如果当前正在查看此插槽，立即更新UI
                if (window.ui && window.ui.currentPattern === slotIndex) {
                    // 强制更新UI
                    if (typeof window.redraw === 'function') {
                        window.redraw();
                        console.log(`🎨 更新UI显示`);
                    }
                }
                
                console.log(`✅ 成功同步插槽 ${slotIndex + 1} 的合成器参数（包含FREQ）`);
                
            } catch (e) {
                console.error('❌ 解析或应用合成器参数时出错:', e);
                console.error('原始参数:', paramsJson);
            }
        };
        
        console.log('✅ 修复了syncSynthParamsFromServer中的频率参数处理');
    }
    
    // 5. 添加FREQ参数测试工具
    function addFreqTestTools() {
        // 测试FREQ参数同步
        window.testFreqSync = function(slotIndex, newFreq) {
            slotIndex = slotIndex !== undefined ? slotIndex : 
                       (window.colyseusSlotStates ? window.colyseusSlotStates.mySlot : 0);
            newFreq = newFreq || (Math.random() * 18000 + 100); // 100Hz - 18kHz
            
            if (slotIndex < 0 || slotIndex > 7) {
                console.error('❌ 无效的插槽索引');
                return;
            }
            
            console.log(`🧪 测试插槽 ${slotIndex + 1} 的FREQ参数同步，新频率: ${Math.round(newFreq)}Hz`);
            
            if (window.synthPresetManager) {
                // 设置新的滤波器频率
                window.synthPresetManager.setFilterParams(slotIndex, {
                    type: window.synthPresetManager.presetFilterParams[slotIndex].type,
                    frequency: newFreq,
                    Q: window.synthPresetManager.presetFilterParams[slotIndex].Q
                });
                
                console.log(`✅ FREQ测试完成，已设置频率为: ${Math.round(newFreq)}Hz`);
            }
        };
        
        // 显示当前FREQ参数状态
        window.showFreqStatus = function(slotIndex) {
            slotIndex = slotIndex !== undefined ? slotIndex : 
                       (window.colyseusSlotStates ? window.colyseusSlotStates.mySlot : 0);
            
            if (slotIndex < 0 || slotIndex > 7) {
                console.error('❌ 无效的插槽索引');
                return;
            }
            
            console.log(`📊 插槽 ${slotIndex + 1} 的FREQ参数状态:`);
            
            if (window.synthPresetManager && window.synthPresetManager.presetFilterParams[slotIndex]) {
                const filterParams = window.synthPresetManager.presetFilterParams[slotIndex];
                console.log('  SynthPresetManager.presetFilterParams:', filterParams);
                console.log(`  频率: ${filterParams.frequency}Hz`);
            }
            
            if (window.metronome && window.metronome.synthParams && window.metronome.synthParams[slotIndex]) {
                const synthParams = window.metronome.synthParams[slotIndex];
                console.log('  metronome.synthParams:', {
                    filterFreq: synthParams.filterFreq,
                    filterType: synthParams.filterType,
                    filterQ: synthParams.filterQ
                });
            }
            
            if (window.metronome && window.metronome.presetSounds && window.metronome.presetSounds[slotIndex]) {
                const synth = window.metronome.presetSounds[slotIndex];
                if (synth.filter) {
                    console.log('  实际合成器滤波器:', {
                        frequency: synth.filter.frequency.value,
                        type: synth.filter.type,
                        Q: synth.filter.Q.value
                    });
                }
            }
        };
        
        console.log('✅ 添加了FREQ参数测试工具');
        console.log('可用命令:');
        console.log('  testFreqSync(slotIndex, frequency) - 测试FREQ同步');
        console.log('  showFreqStatus(slotIndex) - 显示FREQ状态');
    }
    
    // 6. 执行所有修复
    try {
        fixGetSlotSynthParams();
        fixSetFilterParams();
        fixApplySynthParamsToActiveInstance();
        fixSyncSynthParamsFromServer();
        addFreqTestTools();
        
        console.log('🎉 FREQ参数同步修复完成！');
        console.log('现在滤波器频率应该能够正确同步了。');
        
    } catch (error) {
        console.error('❌ FREQ修复过程中出现错误:', error);
    }
})(); 