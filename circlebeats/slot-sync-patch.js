/**
 * slot-sync-patch.js
 * 
 * 修复 audio-sequencer.js 和 Sketch.js 之间插槽选择不同步的问题
 * 
 * 问题描述：
 * - Sketch.js 使用 ui.currentPattern 来跟踪当前选中的插槽
 * - audio-sequencer.js 使用 this.synthUI.currentSlot 来跟踪插槽选择
 * - 这两个状态没有保持同步，导致界面显示不一致
 * 
 * 解决方案：
 * 1. 建立双向同步机制
 * 2. 当其中一个状态改变时，自动更新另一个
 * 3. 提供全局函数来统一管理插槽选择
 */

(function() {
    'use strict';
    
    console.log('插槽同步补丁已加载');
    
    // 等待相关对象初始化
    function waitForObjects() {
        return new Promise((resolve) => {
            const checkObjects = () => {
                if (window.ui && window.metronome && window.metronome.synthUI) {
                    resolve();
                } else {
                    setTimeout(checkObjects, 100);
                }
            };
            checkObjects();
        });
    }
    
    // 初始化同步补丁
    async function initSlotSyncPatch() {
        await waitForObjects();
        
        console.log('开始初始化插槽同步补丁...');
        
        // 同步插槽选择的核心函数
        function syncSlotSelection(newSlot, source) {
            // 确保插槽编号在有效范围内
            if (newSlot < 0 || newSlot > 7) {
                console.warn('无效的插槽编号:', newSlot);
                return;
            }
            
            console.log(`插槽同步: ${newSlot} (来源: ${source})`);
            
            // 更新 Sketch.js 的当前模式
            if (window.ui && window.ui.currentPattern !== newSlot) {
                window.ui.currentPattern = newSlot;
                console.log('已更新 ui.currentPattern:', newSlot);
            }
            
            // 更新 audio-sequencer.js 的当前插槽
            if (window.metronome && window.metronome.synthUI && window.metronome.synthUI.currentSlot !== newSlot) {
                window.metronome.synthUI.currentSlot = newSlot;
                console.log('已更新 synthUI.currentSlot:', newSlot);
            }
            
            // 触发相关事件通知其他组件
            const slotChangeEvent = new CustomEvent('slot-changed', {
                detail: { 
                    slotIndex: newSlot,
                    source: source 
                }
            });
            window.dispatchEvent(slotChangeEvent);
            
            // 如果存在预设变更事件，也触发它
            if (typeof window.triggerPresetChange === 'function') {
                window.triggerPresetChange(newSlot);
            }
        }
        
        // 将同步函数暴露给全局作用域
        window.syncSlotSelection = syncSlotSelection;
        
        // 拦截 Sketch.js 中的插槽选择逻辑
        function patchSketchSlotSelection() {
            // 查找并拦截模式选择器的点击事件
            const originalMousePressed = window.mousePressed;
            
            window.mousePressed = function() {
                // 调用原始的mousePressed函数
                const result = originalMousePressed ? originalMousePressed.apply(this, arguments) : undefined;
                
                // 检查是否点击了模式选择器
                if (window.ui && window.ui.patternSelector && window.ui.patternSelector.buttons) {
                    const mouseX = window.mouseX || 0;
                    const mouseY = window.mouseY || 0;
                    
                    for (let i = 0; i < window.ui.patternSelector.buttons.length; i++) {
                        const button = window.ui.patternSelector.buttons[i];
                        if (button && mouseX >= button.x && mouseX <= button.x + button.width &&
                            mouseY >= button.y && mouseY <= button.y + button.height) {
                            
                            // 如果点击了不同的插槽，进行同步
                            if (i !== window.ui.currentPattern) {
                                console.log('检测到Sketch.js插槽选择变化:', i);
                                syncSlotSelection(i, 'Sketch.js');
                            }
                            break;
                        }
                    }
                }
                
                return result;
            };
        }
        
        // 拦截 audio-sequencer.js 中的插槽选择逻辑
        function patchAudioSequencerSlotSelection() {
            // 拦截合成器UI的插槽选择
            if (window.metronome && typeof window.metronome.handleSynthMouseClicked === 'function') {
                const originalHandleSynthMouseClicked = window.metronome.handleSynthMouseClicked;
                
                window.metronome.handleSynthMouseClicked = function(mouseX, mouseY) {
                    const originalSlot = this.synthUI.currentSlot;
                    
                    // 调用原始函数
                    const result = originalHandleSynthMouseClicked.call(this, mouseX, mouseY);
                    
                    // 检查插槽是否发生了变化
                    if (this.synthUI.currentSlot !== originalSlot) {
                        console.log('检测到audio-sequencer.js插槽选择变化:', this.synthUI.currentSlot);
                        syncSlotSelection(this.synthUI.currentSlot, 'audio-sequencer.js');
                    }
                    
                    return result;
                };
            }
        }
        
        // 添加键盘快捷键支持 (1-8 键切换插槽)
        function addKeyboardSlotSelection() {
            const originalKeyPressed = window.keyPressed;
            
            window.keyPressed = function() {
                // 调用原始的keyPressed函数
                const result = originalKeyPressed ? originalKeyPressed.apply(this, arguments) : undefined;
                
                // 检查数字键 1-8
                if (window.key >= '1' && window.key <= '8') {
                    const newSlot = parseInt(window.key) - 1; // 转换为0-7的索引
                    console.log('键盘快捷键选择插槽:', newSlot);
                    syncSlotSelection(newSlot, 'keyboard');
                }
                
                return result;
            };
        }
        
        // 添加周期性同步检查，确保状态始终一致
        function addPeriodicSync() {
            setInterval(() => {
                if (window.ui && window.metronome && window.metronome.synthUI) {
                    const sketchSlot = window.ui.currentPattern;
                    const audioSlot = window.metronome.synthUI.currentSlot;
                    
                    // 如果发现不同步，以Sketch.js为准进行同步
                    if (sketchSlot !== audioSlot) {
                        console.log('发现插槽状态不同步，执行自动同步:', sketchSlot);
                        window.metronome.synthUI.currentSlot = sketchSlot;
                        
                        // 触发同步事件
                        const slotChangeEvent = new CustomEvent('slot-changed', {
                            detail: { 
                                slotIndex: sketchSlot,
                                source: 'auto-sync' 
                            }
                        });
                        window.dispatchEvent(slotChangeEvent);
                    }
                }
            }, 1000); // 每秒检查一次
        }
        
        // 提供一个全局函数来手动设置插槽
        window.setCurrentSlot = function(slotIndex) {
            if (typeof slotIndex === 'number' && slotIndex >= 0 && slotIndex <= 7) {
                syncSlotSelection(slotIndex, 'manual');
                console.log('手动设置插槽:', slotIndex);
            } else {
                console.error('无效的插槽索引:', slotIndex);
            }
        };
        
        // 提供一个函数来获取当前插槽
        window.getCurrentSlot = function() {
            return window.ui ? window.ui.currentPattern : 0;
        };
        
        // 应用所有补丁
        patchSketchSlotSelection();
        patchAudioSequencerSlotSelection();
        addKeyboardSlotSelection();
        addPeriodicSync();
        
        // 执行初始同步，确保两个状态一致
        const initialSlot = window.ui ? window.ui.currentPattern : 0;
        syncSlotSelection(initialSlot, 'initial');
        
        console.log('插槽同步补丁初始化完成');
        
        // 添加一些调试工具
        window.slotSyncDebug = {
            getSketchSlot: () => window.ui ? window.ui.currentPattern : null,
            getAudioSlot: () => window.metronome && window.metronome.synthUI ? window.metronome.synthUI.currentSlot : null,
            forceSync: (slot) => syncSlotSelection(slot, 'debug'),
            checkSync: () => {
                const sketch = window.ui ? window.ui.currentPattern : null;
                const audio = window.metronome && window.metronome.synthUI ? window.metronome.synthUI.currentSlot : null;
                console.log('插槽同步状态检查:');
                console.log('  Sketch.js currentPattern:', sketch);
                console.log('  audio-sequencer.js currentSlot:', audio);
                console.log('  同步状态:', sketch === audio ? '✅ 已同步' : '❌ 未同步');
                return sketch === audio;
            }
        };
        
        console.log('调试工具已添加到 window.slotSyncDebug');
    }
    
    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSlotSyncPatch);
    } else {
        // 延迟执行，确保其他脚本已加载
        setTimeout(initSlotSyncPatch, 1000);
    }
    
})(); 