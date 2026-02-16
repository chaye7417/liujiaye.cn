/**
 * 修复合成器参数实时同步问题
 * 
 * 问题分析：
 * 1. 合成器参数变化时需要正确触发 synth-params-changed 事件
 * 2. 事件需要包含完整的参数数据
 * 3. 需要确保只有控制该插槽的用户才能发送同步
 * 4. 接收端需要正确解析和应用参数
 */

(function() {
    console.log('🔧 开始修复合成器参数实时同步问题...');
    
    // 1. 增强合成器参数变化事件的触发机制
    function enhanceSynthParamsSync() {
        // 确保 SynthPresetManager 存在
        if (!window.synthPresetManager) {
            console.error('❌ SynthPresetManager 不存在，无法修复同步');
            return;
        }
        
        // 增强 dispatchSynthParamsChanged 方法
        const originalDispatch = window.synthPresetManager.dispatchSynthParamsChanged;
        
        window.synthPresetManager.dispatchSynthParamsChanged = function(slotIndex, params) {
            if (slotIndex < 0 || slotIndex > 7) return;
            
            // 检查是否在拖拽过程中
            if (window.isSynthDragging === true) {
                console.log(`⏸️ 拖拽中，跳过同步插槽 ${slotIndex + 1}`);
                return;
            }
            
            // 检查是否有权限
            if (window.colyseusSlotStates && window.colyseusSlotStates.mySlot !== slotIndex) {
                console.log(`❌ 无权同步插槽 ${slotIndex + 1}，当前控制插槽: ${window.colyseusSlotStates.mySlot + 1}`);
                return;
            }
            
            // 获取完整的参数数据
            const fullParams = params || this.getSlotSynthParams(slotIndex);
            
            console.log(`🎹 触发合成器参数同步事件，插槽: ${slotIndex + 1}`, fullParams);
            
            // 触发事件
            window.dispatchEvent(new CustomEvent('synth-params-changed', {
                detail: fullParams
            }));
            
            // 同时触发全量同步事件
            window.dispatchEvent(new CustomEvent('synth-all-params-changed', {
                detail: { slotIndex: slotIndex }
            }));
        };
        
        console.log('✅ 增强了合成器参数变化事件触发机制');
    }
    
    // 2. 修复合成器参数接收和应用机制
    function fixSynthParamsReceiving() {
        // 增强 syncSynthParamsFromServer 函数
        if (window.syncSynthParamsFromServer) {
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
                    
                    // 应用所有类型的参数
                    if (params.envelopeParams) {
                        window.synthPresetManager.presetEnvelopeParams[slotIndex] = params.envelopeParams;
                        console.log(`✅ 更新包络参数`);
                    }
                    
                    if (params.filterParams) {
                        window.synthPresetManager.presetFilterParams[slotIndex] = params.filterParams;
                        console.log(`✅ 更新滤波器参数`);
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
                    
                    // 🔥 关键修复：立即应用参数到当前活跃的合成器实例
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
                        
                        // 如果有合成器UI，更新它
                        if (window.metronome && window.metronome.synthUI) {
                            updateSynthUIForSlot(slotIndex);
                            console.log(`🎛️ 更新合成器UI`);
                        }
                    }
                    
                    console.log(`✅ 成功同步插槽 ${slotIndex + 1} 的合成器参数`);
                    
                } catch (e) {
                    console.error('❌ 解析或应用合成器参数时出错:', e);
                    console.error('原始参数:', paramsJson);
                }
            };
            
            console.log('✅ 增强了合成器参数接收机制');
        }
    }
    
    // 3. 添加额外的参数变化监听器
    function addExtraListeners() {
        // 监听波形变化
        if (window.synthPresetManager && window.synthPresetManager.setWaveform) {
            const originalSetWaveform = window.synthPresetManager.setWaveform;
            
            window.synthPresetManager.setWaveform = function(slotIndex, waveform) {
                originalSetWaveform.call(this, slotIndex, waveform);
                
                // 立即触发同步
                setTimeout(() => {
                    if (window.colyseusSlotStates && window.colyseusSlotStates.mySlot === slotIndex) {
                        this.dispatchSynthParamsChanged(slotIndex, { waveform });
                        console.log(`🎵 波形变化已同步: ${waveform}`);
                    }
                }, 10);
            };
        }
        
        // 监听效果启用状态变化
        ['setDelayEnabled', 'setReverbEnabled', 'setPortamentoEnabled'].forEach(methodName => {
            if (window.synthPresetManager && window.synthPresetManager[methodName]) {
                const originalMethod = window.synthPresetManager[methodName];
                
                window.synthPresetManager[methodName] = function(slotIndex, enabled) {
                    originalMethod.call(this, slotIndex, enabled);
                    
                    // 立即触发同步
                    setTimeout(() => {
                        if (window.colyseusSlotStates && window.colyseusSlotStates.mySlot === slotIndex) {
                            this.dispatchSynthParamsChanged(slotIndex);
                            console.log(`🔧 ${methodName} 变化已同步: ${enabled}`);
                        }
                    }, 10);
                };
            }
        });
        
        console.log('✅ 添加了额外的参数变化监听器');
    }
    
    // 4. 添加调试和测试功能
    function addDebugFeatures() {
        // 测试合成器参数同步
        window.testSynthParamsSync = function(slotIndex) {
            slotIndex = slotIndex || (window.colyseusSlotStates ? window.colyseusSlotStates.mySlot : 0);
            
            if (slotIndex < 0 || slotIndex > 7) {
                console.error('❌ 无效的插槽索引');
                return;
            }
            
            console.log(`🧪 测试插槽 ${slotIndex + 1} 的合成器参数同步...`);
            
            // 模拟参数变化
            if (window.synthPresetManager) {
                // 随机改变一些参数
                const testWaveforms = ['sine', 'triangle', 'sawtooth', 'square'];
                const randomWaveform = testWaveforms[Math.floor(Math.random() * testWaveforms.length)];
                
                window.synthPresetManager.setWaveform(slotIndex, randomWaveform);
                
                // 随机改变包络参数
                window.synthPresetManager.setEnvelopeParams(slotIndex, {
                    attack: Math.random() * 0.5 + 0.01,
                    decay: Math.random() * 0.5 + 0.1,
                    sustain: Math.random() * 0.8 + 0.2,
                    release: Math.random() * 1.0 + 0.1
                });
                
                console.log(`✅ 测试完成，已触发随机参数变化`);
            }
        };
        
        // 强制同步当前插槽的所有参数
        window.forceSyncSynthParams = function() {
            if (!window.colyseusSlotStates || window.colyseusSlotStates.mySlot === -1) {
                console.error('❌ 未选择插槽或未连接');
                return;
            }
            
            const slotIndex = window.colyseusSlotStates.mySlot;
            console.log(`🔄 强制同步插槽 ${slotIndex + 1} 的所有合成器参数`);
            
            if (window.synthPresetManager) {
                window.synthPresetManager.dispatchSynthParamsChanged(slotIndex);
                console.log(`✅ 强制同步完成`);
            }
        };
        
        // 显示当前插槽的参数状态
        window.showSynthParamsStatus = function(slotIndex) {
            slotIndex = slotIndex !== undefined ? slotIndex : 
                       (window.colyseusSlotStates ? window.colyseusSlotStates.mySlot : 0);
            
            if (slotIndex < 0 || slotIndex > 7) {
                console.error('❌ 无效的插槽索引');
                return;
            }
            
            console.log(`📊 插槽 ${slotIndex + 1} 的合成器参数状态:`);
            
            if (window.synthPresetManager) {
                const params = window.synthPresetManager.getSlotSynthParams(slotIndex);
                console.table(params);
            }
        };
        
        console.log('✅ 添加了调试功能');
        console.log('可用命令:');
        console.log('  testSynthParamsSync(slotIndex) - 测试参数同步');
        console.log('  forceSyncSynthParams() - 强制同步当前插槽参数');
        console.log('  showSynthParamsStatus(slotIndex) - 显示参数状态');
    }
    
    // 5. 执行所有修复
    try {
        enhanceSynthParamsSync();
        fixSynthParamsReceiving();
        addExtraListeners();
        addDebugFeatures();
        
        console.log('🎉 合成器参数实时同步修复完成！');
        console.log('现在其他用户的合成器参数变化应该能够实时同步了。');
        
        // 添加状态监控
        let lastSyncTime = 0;
        window.addEventListener('synth-params-changed', (event) => {
            const now = Date.now();
            if (now - lastSyncTime > 1000) { // 只每秒记录一次，避免日志泛滥
                console.log('🎹 合成器参数同步事件触发:', event.detail);
                lastSyncTime = now;
            }
        });
        
    } catch (error) {
        console.error('❌ 修复过程中出现错误:', error);
    }
})(); 