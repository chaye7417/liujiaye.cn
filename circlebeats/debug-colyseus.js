// Colyseus调试工具
console.log('🔧 加载Colyseus调试工具...');

// 添加状态监控
let lastKnownStates = {};
let monitoringInterval = null;

window.debugColyseus = function() {
    console.log('=== 🔍 Colyseus调试信息 ===');
    
    // 1. 检查连接状态
    console.log('📡 连接状态:', {
        colyseusConnected: window.colyseusConnected,
        colyseusRoom: !!window.colyseusRoom,
        sessionId: window.sessionId || (window.colyseusRoom ? window.colyseusRoom.sessionId : 'undefined')
    });
    
    // 2. 检查插槽状态
    if (window.colyseusSlotStates) {
        console.log('🎰 插槽状态:', {
            mySlot: window.colyseusSlotStates.mySlot,
            username: window.colyseusSlotStates.username,
            slots: window.colyseusSlotStates.data.slots,
            slotNames: window.colyseusSlotStates.data.slotNames
        });
    }
    
    // 3. 检查合成器状态
    if (window.metronome && window.metronome.synthUI) {
        const currentSlot = window.metronome.synthUI.currentSlot;
        console.log('🎹 合成器状态:', {
            currentSlot: currentSlot + 1,
            synthParams: window.metronome.synthParams[currentSlot],
            hasHandleMouseReleased: typeof window.metronome.handleSynthMouseReleased === 'function'
        });
    }
    
    // 4. 检查拖拽状态
    console.log('🖱️ 拖拽状态:', {
        isDraggingInOverview: window.isDraggingInOverview,
        isSynthDragging: window.isSynthDragging
    });
    
    // 5. 手动测试发送消息
    console.log('📤 尝试手动发送测试消息...');
    if (window.colyseusRoom && window.colyseusConnected) {
        try {
            window.colyseusRoom.send("updateSynthParams", {
                slotIndex: window.colyseusSlotStates ? window.colyseusSlotStates.mySlot : 0,
                params: JSON.stringify({test: true, timestamp: Date.now()}),
                timestamp: Date.now()
            });
            console.log('✅ 测试消息已发送');
        } catch (error) {
            console.error('❌ 发送测试消息失败:', error);
        }
    } else {
        console.warn('⚠️ 未连接到服务器，无法发送测试消息');
    }
};

// 开始实时监控状态变化
window.startStateMonitoring = function() {
    if (monitoringInterval) {
        console.log('⚠️ 监控已在运行中');
        return;
    }
    
    console.log('🔍 开始实时状态监控...');
    
    monitoringInterval = setInterval(() => {
        const currentStates = {
            colyseusConnected: window.colyseusConnected,
            colyseusRoom: !!window.colyseusRoom,
            mySlot: window.colyseusSlotStates ? window.colyseusSlotStates.mySlot : 'undefined',
            isDraggingInOverview: window.isDraggingInOverview,
            isSynthDragging: window.isSynthDragging,
            handleMouseReleasedExists: !!(window.metronome && window.metronome.handleSynthMouseReleased)
        };
        
        // 检查状态变化
        for (const key in currentStates) {
            if (lastKnownStates[key] !== currentStates[key]) {
                console.log(`🔄 状态变化: ${key} 从 ${lastKnownStates[key]} 变为 ${currentStates[key]}`);
                lastKnownStates[key] = currentStates[key];
            }
        }
        
        // 初始化上次已知状态
        if (Object.keys(lastKnownStates).length === 0) {
            lastKnownStates = {...currentStates};
            console.log('📊 初始状态记录:', lastKnownStates);
        }
    }, 1000); // 每秒检查一次
};

// 停止监控
window.stopStateMonitoring = function() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        console.log('⏹️ 状态监控已停止');
    }
};

// 监听服务器错误消息
window.addEventListener('load', function() {
    setTimeout(function() {
        if (window.colyseusRoom) {
            // 监听错误消息
            window.colyseusRoom.onMessage("error", (message) => {
                console.error('🚨 服务器错误消息:', message);
                alert('服务器错误: ' + message.message);
            });
            
            console.log('🎧 已设置服务器错误消息监听器');
        }
    }, 3000);
});

// 创建一个函数来强制占用插槽
window.forceClaimSlot = function(slotIndex) {
    if (!window.colyseusRoom || !window.colyseusConnected) {
        console.error('❌ 未连接到服务器');
        return;
    }
    
    console.log(`🎯 强制占用插槽 ${slotIndex + 1}...`);
    
    window.colyseusRoom.send("claimSlot", {
        slotIndex: slotIndex,
        username: window.colyseusSlotStates ? window.colyseusSlotStates.username : 'TestUser'
    });
    
    // 更新本地状态
    if (window.colyseusSlotStates) {
        window.colyseusSlotStates.mySlot = slotIndex;
    }
    
    console.log(`✅ 插槽占用请求已发送`);
};

// 创建测试合成器参数同步的函数
window.testSynthSync = function() {
    console.log('🧪 测试合成器参数同步...');
    
    if (!window.colyseusRoom || !window.colyseusConnected) {
        console.error('❌ 未连接到服务器');
        return false;
    }
    
    if (!window.colyseusSlotStates || window.colyseusSlotStates.mySlot === -1) {
        console.error('❌ 没有控制任何插槽');
        return false;
    }
    
    const currentSlot = window.colyseusSlotStates.mySlot;
    const testParams = {
        test: true,
        timestamp: Date.now(),
        attack: 0.1,
        decay: 0.2,
        sustain: 0.5,
        release: 0.3
    };
    
    console.log(`📤 发送测试参数到插槽 ${currentSlot + 1}:`, testParams);
    
    try {
        window.colyseusRoom.send("updateSynthParams", {
            slotIndex: currentSlot,
            params: JSON.stringify(testParams),
            timestamp: Date.now()
        });
        
        console.log('✅ 测试参数已发送');
        return true;
    } catch (error) {
        console.error('❌ 发送测试参数失败:', error);
        return false;
    }
};

// 强制重置拖拽状态
window.resetDragStates = function() {
    console.log('🔄 重置所有拖拽状态...');
    
    window.isDraggingInOverview = false;
    window.isSynthDragging = false;
    
    if (window.metronome && window.metronome.synthUI) {
        if (window.metronome.synthUI.adsrDrag) {
            window.metronome.synthUI.adsrDrag.dragging = false;
        }
        if (window.metronome.synthUI.filter && window.metronome.synthUI.filter.dragging) {
            window.metronome.synthUI.filter.dragging.active = false;
        }
        if (window.metronome.synthUI.delay) {
            window.metronome.synthUI.delay.dragStart = null;
        }
        if (window.metronome.synthUI.reverb) {
            window.metronome.synthUI.reverb.dragStart = null;
        }
    }
    
    console.log('✅ 拖拽状态已重置');
};

// 检查鼠标释放函数是否被覆盖
window.checkMouseReleaseHandler = function() {
    if (window.metronome && window.metronome.handleSynthMouseReleased) {
        const funcStr = window.metronome.handleSynthMouseReleased.toString();
        const isOurFunction = funcStr.includes('[简单修复]');
        
        console.log('🔍 鼠标释放处理函数检查:', {
            exists: true,
            isOurPatchedVersion: isOurFunction,
            functionLength: funcStr.length
        });
        
        if (!isOurFunction) {
            console.warn('⚠️ 检测到鼠标释放函数可能被覆盖，需要重新应用补丁');
        }
    } else {
        console.error('❌ 鼠标释放处理函数不存在');
    }
};

console.log('🔧 Colyseus调试工具已加载');
console.log('📋 可用命令:');
console.log('  - debugColyseus() : 查看完整调试信息');
console.log('  - startStateMonitoring() : 开始实时监控状态变化');
console.log('  - stopStateMonitoring() : 停止状态监控');
console.log('  - forceClaimSlot(0-7) : 强制占用指定插槽');
console.log('  - testSynthSync() : 测试合成器参数同步');
console.log('  - resetDragStates() : 重置所有拖拽状态');
console.log('  - checkMouseReleaseHandler() : 检查鼠标释放函数'); 