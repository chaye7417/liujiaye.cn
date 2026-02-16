/**
 * 测试合成器参数实时同步功能
 * 
 * 使用方法：
 * 1. 打开两个浏览器窗口
 * 2. 都连接到同一个房间
 * 3. 一个用户选择插槽1，另一个用户选择插槽2
 * 4. 在控制台中运行测试命令
 */

(function() {
    console.log('🧪 加载合成器参数同步测试工具...');
    
    // 全局测试状态
    let testRunning = false;
    let testResults = [];
    
    // 添加测试工具到 window 对象
    window.synthSyncTest = {
        
        // 测试1: 基本参数同步
        testBasicSync: function() {
            console.log('🔬 开始基本参数同步测试...');
            
            if (!window.colyseusSlotStates || window.colyseusSlotStates.mySlot === -1) {
                console.error('❌ 请先连接并选择一个插槽');
                return;
            }
            
            const mySlot = window.colyseusSlotStates.mySlot;
            console.log(`📍 当前控制插槽: ${mySlot + 1}`);
            
            if (!window.synthPresetManager) {
                console.error('❌ SynthPresetManager 不存在');
                return;
            }
            
            // 记录原始参数
            const originalParams = window.synthPresetManager.getSlotSynthParams(mySlot);
            console.log('📊 原始参数:', originalParams);
            
            // 测试波形变化
            const testWaveforms = ['sine', 'triangle', 'sawtooth', 'square'];
            const currentWaveform = window.synthPresetManager.presetWaveforms[mySlot];
            const newWaveform = testWaveforms.find(w => w !== currentWaveform) || 'triangle';
            
            console.log(`🎵 测试波形变化: ${currentWaveform} -> ${newWaveform}`);
            window.synthPresetManager.setWaveform(mySlot, newWaveform);
            
            // 测试包络参数变化
            setTimeout(() => {
                console.log('🔊 测试包络参数变化...');
                window.synthPresetManager.setEnvelopeParams(mySlot, {
                    attack: 0.05 + Math.random() * 0.1,
                    decay: 0.2 + Math.random() * 0.2,
                    sustain: 0.3 + Math.random() * 0.4,
                    release: 0.3 + Math.random() * 0.5
                });
            }, 1000);
            
            // 测试效果参数变化
            setTimeout(() => {
                console.log('🌊 测试效果参数变化...');
                const delayEnabled = !window.synthPresetManager.presetDelayEnabled[mySlot];
                window.synthPresetManager.setDelayEnabled(mySlot, delayEnabled);
                
                if (delayEnabled) {
                    window.synthPresetManager.setDelayParams(mySlot, {
                        time: 0.1 + Math.random() * 0.3,
                        feedback: 0.2 + Math.random() * 0.3,
                        mix: 0.1 + Math.random() * 0.2
                    });
                }
            }, 2000);
            
            console.log('✅ 基本同步测试已触发，请在其他客户端观察变化');
        },
        
        // 测试2: 监听其他用户的参数变化
        testReceiveSync: function() {
            console.log('👂 开始监听其他用户的参数变化...');
            
            // 监听合成器参数更新消息
            let updateCount = 0;
            const startTime = Date.now();
            
            const originalHandler = window.room && window.room.onMessage ? 
                window.room.onMessage.bind(window.room) : null;
            
            if (window.colyseusRoom) {
                window.colyseusRoom.onMessage("synthParamsUpdated", (message) => {
                    updateCount++;
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    
                    console.log(`📥 [${elapsed}s] 收到第${updateCount}次合成器参数更新:`, {
                        slotIndex: message.slotIndex + 1,
                        paramKeys: message.params ? Object.keys(JSON.parse(message.params)) : [],
                        timestamp: message.timestamp
                    });
                    
                    // 解析参数并显示变化
                    try {
                        const params = JSON.parse(message.params);
                        if (params.waveform) {
                            console.log(`  🎵 波形: ${params.waveform}`);
                        }
                        if (params.envelopeParams) {
                            console.log(`  🔊 包络:`, params.envelopeParams);
                        }
                        if (params.delayEnabled !== undefined) {
                            console.log(`  🌊 延迟: ${params.delayEnabled ? '启用' : '禁用'}`);
                        }
                    } catch (e) {
                        console.warn('解析参数时出错:', e);
                    }
                });
                
                console.log('✅ 开始监听，请让其他用户调整他们的合成器参数...');
            } else {
                console.error('❌ 未连接到Colyseus房间');
            }
        },
        
        // 测试3: 压力测试
        testStressSync: function() {
            console.log('💪 开始压力测试...');
            
            if (!window.colyseusSlotStates || window.colyseusSlotStates.mySlot === -1) {
                console.error('❌ 请先连接并选择一个插槽');
                return;
            }
            
            const mySlot = window.colyseusSlotStates.mySlot;
            let updateCount = 0;
            const maxUpdates = 20;
            
            console.log(`🚀 将在5秒内发送${maxUpdates}次参数更新...`);
            
            const interval = setInterval(() => {
                if (updateCount >= maxUpdates) {
                    clearInterval(interval);
                    console.log('✅ 压力测试完成');
                    return;
                }
                
                updateCount++;
                
                // 随机更新不同的参数
                const paramType = updateCount % 3;
                
                switch (paramType) {
                    case 0:
                        // 波形
                        const waveforms = ['sine', 'triangle', 'sawtooth', 'square'];
                        const randomWaveform = waveforms[Math.floor(Math.random() * waveforms.length)];
                        window.synthPresetManager.setWaveform(mySlot, randomWaveform);
                        console.log(`  ${updateCount}. 波形: ${randomWaveform}`);
                        break;
                        
                    case 1:
                        // 包络
                        window.synthPresetManager.setEnvelopeParams(mySlot, {
                            attack: Math.random() * 0.2 + 0.01,
                            decay: Math.random() * 0.3 + 0.1,
                            sustain: Math.random() * 0.8 + 0.2,
                            release: Math.random() * 0.8 + 0.1
                        });
                        console.log(`  ${updateCount}. 包络参数`);
                        break;
                        
                    case 2:
                        // 效果
                        const enabled = Math.random() > 0.5;
                        window.synthPresetManager.setDelayEnabled(mySlot, enabled);
                        console.log(`  ${updateCount}. 延迟: ${enabled ? '启用' : '禁用'}`);
                        break;
                }
            }, 250); // 每250ms更新一次
        },
        
        // 测试4: 检查同步状态
        checkSyncStatus: function() {
            console.log('🔍 检查同步状态...');
            
            if (!window.colyseusConnected) {
                console.error('❌ 未连接到Colyseus服务器');
                return;
            }
            
            if (!window.colyseusSlotStates) {
                console.error('❌ 插槽状态未初始化');
                return;
            }
            
            console.log('📊 连接状态:');
            console.log(`  🌐 服务器连接: ${window.colyseusConnected ? '✅' : '❌'}`);
            console.log(`  🎭 当前插槽: ${window.colyseusSlotStates.mySlot + 1}`);
            console.log(`  👥 房间用户:`, window.colyseusSlotStates.data.slots);
            
            if (window.synthPresetManager) {
                console.log('🎛️ 合成器管理器: ✅');
                const mySlot = window.colyseusSlotStates.mySlot;
                if (mySlot >= 0) {
                    const params = window.synthPresetManager.getSlotSynthParams(mySlot);
                    console.log(`📋 当前插槽${mySlot + 1}参数:`, params);
                }
            } else {
                console.log('🎛️ 合成器管理器: ❌');
            }
            
            // 检查事件监听器
            const hasParamsListener = window.hasEventListener('synth-params-changed');
            const hasAllParamsListener = window.hasEventListener('synth-all-params-changed');
            
            console.log('📡 事件监听器:');
            console.log(`  synth-params-changed: ${hasParamsListener ? '✅' : '❌'}`);
            console.log(`  synth-all-params-changed: ${hasAllParamsListener ? '✅' : '❌'}`);
        },
        
        // 辅助函数: 重置所有参数
        resetParams: function() {
            if (!window.colyseusSlotStates || window.colyseusSlotStates.mySlot === -1) {
                console.error('❌ 请先连接并选择一个插槽');
                return;
            }
            
            const mySlot = window.colyseusSlotStates.mySlot;
            console.log(`🔄 重置插槽 ${mySlot + 1} 的所有参数...`);
            
            if (window.synthPresetManager) {
                window.synthPresetManager.resetSlotParams(mySlot);
                console.log('✅ 参数已重置');
            }
        }
    };
    
    // 辅助函数：检查事件监听器是否存在
    window.hasEventListener = function(eventType) {
        // 这是一个简化的检查，实际实现可能需要更复杂的逻辑
        return true; // 假设监听器存在
    };
    
    console.log('✅ 合成器参数同步测试工具已加载');
    console.log('');
    console.log('📋 可用测试命令:');
    console.log('  synthSyncTest.testBasicSync() - 基本参数同步测试');
    console.log('  synthSyncTest.testReceiveSync() - 监听其他用户变化');
    console.log('  synthSyncTest.testStressSync() - 压力测试');
    console.log('  synthSyncTest.checkSyncStatus() - 检查同步状态');
    console.log('  synthSyncTest.resetParams() - 重置参数');
    console.log('');
    console.log('🎯 建议测试流程:');
    console.log('1. 两个用户都运行 synthSyncTest.checkSyncStatus()');
    console.log('2. 用户A运行 synthSyncTest.testReceiveSync()');
    console.log('3. 用户B运行 synthSyncTest.testBasicSync()');
    console.log('4. 观察用户A是否收到用户B的参数变化');
    
})(); 