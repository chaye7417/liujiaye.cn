/**
 * partySyncColyseus.js - 使用Colyseus进行多用户协作的联网模式
 * 该脚本负责处理与Colyseus服务器的连接、数据同步和用户插槽管理
 */

// 全局调试开关，默认关闭
window.debugColyseus = false;

// 通用节流函数：确保高频调用（如拖拽ADSR/滤波器）不会在每次mousemove时都发送WebSocket消息
// 在delay时间内最多执行一次，且保证最后一次调用一定会被执行（trailing call）
function throttle(fn, delay) {
  let lastCall = 0;
  let timer = null;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn.apply(this, args);
      }, delay - (now - lastCall));
    }
  };
}

// 添加一个全局变量，用于追踪在总览模式中是否存在拖拽操作
window.isDraggingInOverview = false;

// Colyseus连接相关变量
let colyseusClient = null;
let colyseusRoom = null;
let colyseusConnected = false;
let colyseusRoomName = "rhythm_room"; // 默认房间名，会在连接时自动创建

let colyseusServerUrl = "wss://liujiaye.cn:2567"; // 使用安全WebSocket连接
// let colyseusServerUrl = "ws://localhost:2567"; // 本地测试时使用
let sessionId = null; // 当前用户的会话ID
let dialogVisible = false; // 对话框是否可见
let isConnecting = false; // 连接锁，防止重复连接
let connectionRetryCount = 0; // 连接重试计数
let connectionSuccessful = false; // 连接是否成功的标志

// 定义节奏数据同步的计数器，用于检测变更
let syncCounter = 0;
let lastSyncedStates = Array(8).fill(null);

// 插槽选择相关变量
const colyseusSlotStates = {
  data: {
    slots: {},        // 存储每个插槽的使用状态 {slotId: sessionId}
    slotNames: {},    // 存储每个插槽的用户名称 {slotId: username}
    presets: [],      // 存储每个插槽的预设数据
    synthParams: [],  // 存储每个插槽的合成器参数
    bpm: 120          // 当前BPM值
  },
  mySlot: -1,         // 当前用户选择的插槽索引
  username: "用户" + Math.floor(Math.random() * 1000), // 随机用户名
  currentSessionId: null // 当前会话ID
};

// 弹窗UI相关
let colyseusDialogVisible = false;

// 设置上面添加的最大重试次数变量
let maxConnectionRetries = 3; // 最大重试次数

// 创建节流后的同步函数，避免拖拽时每次mousemove都发送WebSocket消息
const throttledSyncSynthParams = throttle((slotIndex, params) => {
  syncSynthParamsToServer(slotIndex, params);
}, 100); // 合成器参数：100ms节流

const throttledSyncAllSynthParams = throttle(() => {
  syncAllSynthParamsToServer();
}, 100); // 全量合成器参数：100ms节流

const throttledSyncBpm = throttle((bpm) => {
  syncBpmToServer(bpm);
}, 200); // BPM同步：200ms节流

const throttledSyncBaseNote = throttle((slotIndex, baseNote) => {
  syncBaseNoteToServer(slotIndex, baseNote);
}, 100); // 八度信息：100ms节流

// 在页面加载时初始化
window.addEventListener('load', () => {
  // 监听合成器参数变化以便同步（节流100ms，防止拖拽ADSR/滤波器时高频发送）
  window.addEventListener('synth-params-changed', (event) => {
    if (event.detail && colyseusConnected && colyseusSlotStates.mySlot !== -1) {
      throttledSyncSynthParams(colyseusSlotStates.mySlot, event.detail);
    }
  });

  // 监听合成器参数全量变化（节流100ms）
  window.addEventListener('synth-all-params-changed', (event) => {
    if (colyseusConnected && colyseusSlotStates.mySlot !== -1) {
      throttledSyncAllSynthParams();
    }
  });

  // 监听BPM变化（节流200ms）
  window.addEventListener('bpm-changed', (event) => {
    if (event.detail && colyseusConnected && colyseusSlotStates.mySlot !== -1) {
      throttledSyncBpm(event.detail.bpm);
    }
  });
  
  // 初始化slot数据结构
  for (let i = 0; i < 8; i++) {
    if (!colyseusSlotStates.data.slots[i]) {
      colyseusSlotStates.data.slots[i] = null;
    }
  }

  // 设置连接按钮的事件处理，确保只绑定一次
  setupConnectionButton();
});

// 设置连接按钮
function setupConnectionButton() {
  const connectButton = document.getElementById('colyseus-connect-button');
  if (!connectButton) return;
  const newButton = connectButton.cloneNode(true);
  if (connectButton.parentNode) {
    connectButton.parentNode.replaceChild(newButton, connectButton);
  }
  newButton.addEventListener('click', () => {
    // 检查是否已经连接成功，如果已连接，直接显示插槽选择界面
    if (colyseusConnected && colyseusRoom) {
      showColyseusDialog(); // 显示插槽选择界面
    } else {
      createConnectionDialog(); // 显示连接设置界面
    }
  });

}

// 连接到Colyseus服务器
function connectToColyseus() {
  // 防止重复连接
  if (isConnecting) {

    return;
  }
  
  // 如果已连接，只进行状态检查而不重新连接
  if (colyseusConnected && colyseusRoom) {

    return;
  }
  
  // 设置连接锁
  isConnecting = true;
  
  // 更新连接状态显示
  createConnectionStatus();
  updateConnectionStatus('connecting');
  

  
  // 显示连接进度条
  showConnectionProgress();
  
  try {
    // 连接开始时重置连接成功标志
    connectionSuccessful = false;
    
    // 确保Colyseus客户端已加载
    if (typeof Colyseus === 'undefined') {
      console.error("Colyseus客户端库未加载！");
      // 不隐藏进度条，让错误显示在进度条窗口中
      updateConnectionStatus('error', 'Colyseus客户端库未加载');
      showConnectionError('Colyseus客户端库未加载，请刷新页面重试');
      isConnecting = false;
      return;
    }
    
    // 创建Colyseus客户端
    colyseusClient = new Colyseus.Client(colyseusServerUrl);
    

    // 创建连接选项，确保格式正确
    const options = {
      username: colyseusSlotStates.username || "用户" + Math.floor(Math.random() * 1000),
      roomName: colyseusRoomName
    };
    

    
    // 设置连接超时
    const connectionTimeout = setTimeout(() => {
      console.error("连接超时!");
      if (!colyseusConnected) {
        connectionSuccessful = false; // 重置连接成功标志
        // 不隐藏进度条，让错误显示在进度条窗口中
        updateConnectionStatus('error', '连接超时');
        showConnectionError('服务器连接超时，请检查服务器状态或网络连接');
        isConnecting = false;
      }
    }, 10000);
    
    // 添加调试信息
    const debugInfo = document.getElementById('colyseus-debug-info');
    if (debugInfo) {
      debugInfo.innerHTML += '<div>正在连接到服务器...</div>';
    }
    
    // 尝试加入或创建房间，使用更清晰的Promise链
    colyseusClient.joinOrCreate(colyseusRoomName, options)
      .then(room => {
        // 清除连接超时
        clearTimeout(connectionTimeout);
        
        try {


          
          // 更新调试信息
          if (debugInfo) {
            debugInfo.innerHTML += '<div>已获取房间对象，检查WebSocket连接...</div>';
          }
          
          // 直接访问并监听底层WebSocket连接
          try {
            const rawWs = room.connection.transport.ws;

            
            // 添加原始消息监听用于调试 - 添加过滤功能
            rawWs.addEventListener('message', (event) => {
              // 只在调试模式下或欢迎消息时显示
              // 调试日志已移除
              
              // 尝试解析消息以查看是否包含welcome消息
              try {
                if (typeof event.data === 'string') {
                  const data = JSON.parse(event.data);
                  if (data.type && (data.type === "welcome" || data.type === "connection_success")) {

                    processWelcomeMessage(data.data || data);
                  }
                }
              } catch (e) {
                // 解析失败，但不输出错误
                // 调试日志已移除
              }
            });
            
            rawWs.addEventListener('error', (event) => {
              console.error("WebSocket错误:", event);
              if (debugInfo) {
                debugInfo.innerHTML += '<div style="color:red">WebSocket错误</div>';
              }
            });
            
            rawWs.addEventListener('close', (event) => {
              if (colyseusConnected) {
                updateConnectionStatus('error', `WebSocket连接关闭(${event.code})`);
                showConnectionError(`WebSocket连接意外关闭(${event.code})：${event.reason || '未知原因'}`);
              }
              if (debugInfo) {
                debugInfo.innerHTML += `<div style="color:orange">WebSocket连接关闭: ${event.code}</div>`;
              }
            });
            
            rawWs.addEventListener('open', (event) => {
              if (debugInfo) {
                debugInfo.innerHTML += '<div style="color:green">WebSocket连接已打开</div>';
              }
            });
          } catch (wsError) {
            console.warn("无法访问原始WebSocket对象:", wsError);
            if (debugInfo) {
              debugInfo.innerHTML += '<div style="color:red">无法访问WebSocket对象</div>';
            }
          }
          
          // 保存房间引用和会话ID
          colyseusRoom = room;
          colyseusConnected = true;
          sessionId = room.sessionId;
          
          // 强制同步会话ID到UI状态
          colyseusSlotStates.currentSessionId = sessionId;
          
          // 先更新连接状态，但不隐藏进度条，等待welcome消息
          updateConnectionStatus('connected');
          
          if (debugInfo) {
            debugInfo.innerHTML += '<div>已连接，等待欢迎消息...</div>';
          }
          
          // 使用带超时的Promise等待welcome消息
          const welcomeMessagePromise = new Promise((resolve, reject) => {
            // 在全局消息处理函数中持续等待welcome消息
            const messageHandler = (type, message) => {
              if (type === "welcome" || type === "connection_success") {
                resolve(message);
                // 移除事件监听器
                room.onMessage.remove(messageHandler);
              }
            };
            
            // 添加消息监听器
            room.onMessage("*", messageHandler);
            
            // 单独添加专用的welcome和connection_success消息监听器
            room.onMessage("welcome", (message) => {
              processWelcomeMessage(message);
              resolve(message);
            });
            
            room.onMessage("connection_success", (message) => {
              processWelcomeMessage(message);
              resolve(message);
            });
            
            // 5秒后如果没有收到welcome消息，也视为成功（自动超时）
            setTimeout(() => {
              if (debugInfo) {
                debugInfo.innerHTML += '<div style="color:orange">欢迎消息等待超时，继续处理</div>';
              }
              resolve({
                success: true,
                status: "connected",
                roomName: room.name,
                sessionId: room.sessionId,
                message: "自动创建的欢迎消息（超时）",
                connectedClients: room.clients ? room.clients.length : 1,
                maxClients: 16
              });
            }, 5000);
          });
          
          // 处理welcome消息（不论是否超时）
          welcomeMessagePromise.then(welcomeMessage => {
            
            // 隐藏进度条
            hideConnectionProgress();
            showConnectionSuccess();
            
            // 设置房间状态变化监听器
            setupRoomStateListeners(room);
            
            // 发送ping消息测试通信
            setTimeout(() => {
              if (room.connection && room.connection.isOpen) {
                // 不使用ping消息，改用服务器已注册的心跳消息
                room.send("heartbeat_response", { 
                  clientTime: Date.now(),
                  serverTime: Date.now()
                });

                if (debugInfo) {
                  debugInfo.innerHTML += '<div>已发送心跳测试消息</div>';
                }
              }
            }, 1000);
            
            // 添加延迟的手动请求初始状态功能
            setTimeout(() => {
              // 如果仍然连接着，请求一次完整的初始状态
              if (colyseusConnected && colyseusRoom) {
                colyseusRoom.send("requestInitialState");
              }
            }, 3000); // 延迟3秒请求，给自动同步足够时间
          });
        } catch (setupError) {
          console.error("设置房间监听器时出错:", setupError);
          hideConnectionProgress();
          updateConnectionStatus('error', '监听器设置失败');
          showConnectionError('监听器设置失败: ' + setupError.message);
          
          if (debugInfo) {
            debugInfo.innerHTML += `<div style="color:red">设置监听器错误: ${setupError.message}</div>`;
          }
          
          // 尝试清理可能部分建立的连接
          if (room) {
            try {
              room.leave();
            } catch (e) {
              console.warn("尝试断开连接时出错:", e);
            }
          }
        }
      })
      .catch(e => {
        // 清除连接超时
        clearTimeout(connectionTimeout);
        
        // 重置连接成功标志
        connectionSuccessful = false;
        
        console.error("连接到Colyseus服务器失败:", e);
        // 不隐藏进度条，让错误显示在进度条窗口中
        updateConnectionStatus('error', e.message || '服务器连接失败');
        showConnectionError(e.message || '无法连接到服务器');
        
        if (debugInfo) {
          debugInfo.innerHTML += `<div style="color:red">连接失败: ${e.message}</div>`;
        }
      })
      .finally(() => {
        // 释放连接锁
        isConnecting = false;
      });
  } catch (error) {
    console.error("创建Colyseus客户端时出错:", error);
    connectionSuccessful = false; // 重置连接成功标志
    // 不隐藏进度条，让错误显示在进度条窗口中
    updateConnectionStatus('error', error.message || '客户端创建失败');
    showConnectionError(error.message || 'Colyseus客户端创建失败');
    // 释放连接锁
    isConnecting = false;
  }
}

// 处理欢迎消息
function processWelcomeMessage(message) {
  // 更新调试信息
  const debugInfo = document.getElementById('colyseus-debug-info');
  if (debugInfo) {
    debugInfo.innerHTML += `<div>收到欢迎消息: ${JSON.stringify(message).substring(0, 50)}...</div>`;
  }
  
  // 确保隐藏进度条（双重保障）
  hideConnectionProgress();
  
  // 处理连接成功信息
  if (message.success && message.status === "connected") {
    
    // 设置连接成功标志
    connectionSuccessful = true;
    
    // 确保成功UI已显示
    showConnectionSuccess();
    
    // 更新连接状态
    updateConnectionStatus('connected', `${message.connectedClients}人在线`);
    
    // 保存房间信息
    if (message.roomName) {
      window.colyseusWelcomeRoomName = message.roomName;
      
      // 立即更新UI显示
      updateRoomNameDisplay(message.roomName, message.connectedClients);
      
      // 只有在连接成功时才显示插槽选择对话框
      setTimeout(() => {
        if (connectionSuccessful) {
          showColyseusDialog();
        }
      }, 500);
    }
  } else {
    // 收到非标准格式的消息，可能是连接问题

    
    // 不显示插槽选择对话框，而是显示错误提示
    showConnectionError("服务器响应格式不正确，请重试连接");
    
    // 更新连接状态
    updateConnectionStatus('error', '服务器响应格式不正确');
  }
}

// 设置房间状态变化监听器
function setupRoomStateListeners(room) {
  if (!room) {
    console.error("setupRoomStateListeners: room对象为空");
    return;
  }
  
  try {
    // 监听房间连接状态变化
    room.onLeave((code) => {

      colyseusConnected = false;
      colyseusRoom = null;
      colyseusSlotStates.mySlot = -1;
      sessionId = null;
      connectionSuccessful = false; // 重置连接成功标志
      
      // 确保隐藏进度条
      hideConnectionProgress();
      
      // 更新UI状态
      updateConnectionStatus('disconnected');
      
      // 显示断开连接通知
      if (code === 1000) {
        // 正常关闭
        showNotification("已断开连接", "normal");
      } else {
        // 异常关闭
        showNotification(`连接已断开 (代码: ${code})`, "error");
        
        // 如果是被踢出房间，显示提示
        if (code === 4000) {
          showCustomMessage("你已被踢出房间或房间已关闭。", "error");
        }
      }
    });
    
    // 监听连接错误
    room.onError((code, message) => {
      console.error(`房间错误: ${code} - ${message}`);
      connectionSuccessful = false; // 重置连接成功标志
      hideConnectionProgress();
      updateConnectionStatus('error', message);
      showConnectionError(message || `连接错误 (${code})`);
    });
    
    // 监听状态变化 - 首次获取完整状态
    room.onStateChange.once((state) => {
      
      // 确保连接成功UI已经显示
      hideConnectionProgress();
      
      // 显示房间名称
      if (state.roomName) {
        window.colyseusWelcomeRoomName = state.roomName;
        updateRoomNameDisplay(state.roomName, room.clients?.length || 1);
      }
      
      // 初始化状态
      try {
        initializeFromState(state);
      } catch (initError) {
        console.error("初始化状态时出错:", initError);
      }
    });
    
    // 持续监听状态变化
    room.onStateChange((state) => {
      try {
        // 更新插槽占用状态
        if (state.slots) {
          updateSlotsFromState(state.slots);
        }
        
        // 更新其他状态...
        if (state.presets) {
          updatePresetsFromState(state.presets);
        }
        
        if (state.synthParams) {
          updateSynthParamsFromState(state.synthParams);
        }
        
        if (state.bpm !== undefined) {
          updateBpmFromState(state.bpm);
        }
        
        // 同步状态到PresetManager
        handleServerStateUpdate();
      } catch (updateError) {
        console.error("处理状态更新时出错:", updateError);
      }
    });
    
    // 注释掉可能导致错误的代码，使用onStateChange替代
    // 更新:不再使用 room.state.listen，因为该方法在当前Colyseus版本中可能不可用
    /*
    if (room.state) {
      room.state.listen("bpm", (value) => {
        updateBpmFromState(value);
      });
      
      // 监听插槽变化
      for (let i = 0; i < 8; i++) {
        room.state.listen(`slots.${i}`, (sessionId, previousSessionId) => {

          colyseusSlotStates.data.slots[i] = sessionId;
        });
      }
    } else {
      console.warn("房间状态尚未初始化，无法添加状态监听器");
    }
    */
    
    // 设置消息处理器
    
    // 监听服务器心跳
    room.onMessage("heartbeat", (message) => {
      // 不记录日志，静默处理心跳
      
      // 计算延迟（如果有客户端时间戳）
      if (message.timestamp) {
        const latency = Date.now() - message.timestamp;
        
        // 仅更新UI显示延迟，不输出到控制台
        const statusElem = document.getElementById('colyseus-connection-status');
        if (statusElem) {
          const currentText = statusElem.textContent;
          if (currentText.includes('已连接')) {
            statusElem.textContent = `已连接 (延迟: ${latency}ms)`;
          }
        }
      }
      
      // 响应心跳消息
      room.send("heartbeat_response", {
        clientTime: Date.now(),
        serverTime: message.timestamp
      });
      
      // 更新在线人数显示
      if (message.clientCount !== undefined) {
        const statusElem = document.getElementById('colyseus-connection-status');
        if (statusElem) {
          statusElem.textContent = `已连接 (${message.clientCount}人在线)`;
        }
      }
    });
    
    // 监听房间状态响应消息
    room.onMessage("roomState", (state) => {
      console.log("收到房间状态响应:", state);
      
      try {
        // 更新插槽状态
        if (state.slots) {
          updateSlotsFromState(state.slots);
        }
        
        // 更新预设数据
        if (state.presets) {
          updatePresetsFromState(state.presets);
        }
        
        // 更新合成器参数
        if (state.synthParams) {
          updateSynthParamsFromState(state.synthParams);
        }
        
        // 更新八度信息
        if (state.baseNotes) {
          updateBaseNotesFromState(state.baseNotes);
        }
        
        // 更新BPM
        if (state.bpm !== undefined) {
          updateBpmFromState(state.bpm);
        }
        
        showNotification("已更新房间状态", "success");
      } catch (e) {
        console.error("处理房间状态响应时出错:", e);
      }
    });
    
    // 添加处理插槽信息更新的消息
    room.onMessage("slotsInfoUpdated", (message) => {

      
      try {
        // 记录之前的插槽状态，用于检测变化
        const previousSlots = {};
        for (let i = 0; i < 8; i++) {
          previousSlots[i] = colyseusSlotStates.data.slots[i];
          previousSlots[`name${i}`] = colyseusSlotStates.data.slotNames[i];
        }
        
        // 更新插槽和用户名信息
        if (message.slots) {
          // 直接采用服务器提供的数据，不做额外处理
          updateSlotsFromState(message.slots);
          
          // 仅处理服务器明确标记的已释放插槽，移除激进的检测
          if (message.releasedSlots && Array.isArray(message.releasedSlots) && message.releasedSlots.length > 0) {
            message.releasedSlots.forEach(slotIndex => {

              
              // 清空该插槽的步进数据
              clearSlotStepData(slotIndex);
            });
          }
          
          // 触发自定义事件，通知总览视图刷新
          const event = new CustomEvent('colyseus-slots-updated', {
            detail: { 
              timestamp: message.timestamp,
              releasedSlots: message.releasedSlots || []
            }
          });
          window.dispatchEvent(event);
          
          // 直接刷新总览视图
          if (window.circleOverview && typeof window.circleOverview.refresh === 'function') {
            window.circleOverview.refresh();
          }
        }
      } catch (e) {
        console.error("处理插槽信息更新消息时出错:", e);
      }
    });
    
    // 监听欢迎消息
    room.onMessage("welcome", (message) => {
      processWelcomeMessage(message);
    });
    
    // 连接成功消息
    room.onMessage("connection_success", (message) => {
      processWelcomeMessage(message);
    });
    
    // 添加处理初始化数据的消息
    room.onMessage("room_initial_state", (data) => {

      
      // 处理初始化数据
      try {
        // 处理预设数据
        if (data.presets) {
          processInitialPresets(data.presets);
        }
        
        // 处理合成器参数
        if (data.synthParams) {
          processInitialSynthParams(data.synthParams);
        }
        
        // 处理八度信息
        if (data.baseNotes) {
          processInitialBaseNotes(data.baseNotes);
        }
        
        // 处理插槽信息
        if (data.slots) {
          processInitialSlots(data.slots);
        }
        
        // 处理BPM
        if (data.bpm) {
          updateBpmFromState(data.bpm);
        }
        

        
        // 触发圆环数据变化事件以更新UI
        if (typeof window.triggerCircleDataChange === 'function') {
          setTimeout(() => {
            window.triggerCircleDataChange();
          }, 500); // 延迟半秒确保数据已加载
        }
        
        // 刷新总览视图
        if (window.circleOverview && typeof window.circleOverview.refresh === 'function') {
          setTimeout(() => {
            window.circleOverview.refresh();
          }, 1000); // 延迟1秒确保所有数据已加载
        }
        
      } catch (error) {
        console.error("处理房间初始状态数据时出错:", error);
      }
    });
    
    // 插槽操作响应
    room.onMessage("slotClaimResponse", (message) => {

      if (!message.success) {
        showCustomMessage(message.message || `无法申请插槽 ${message.slotIndex + 1}`, "warning");
      }
    });
    
    room.onMessage("slotReleaseResponse", (message) => {

      if (!message.success) {
        console.warn(message.message || `无法释放插槽 ${message.slotIndex + 1}`);
      }
    });
    
    // 用户加入/离开消息
    room.onMessage("userJoined", (message) => {

      updateRoomNameDisplay(window.colyseusWelcomeRoomName, message.connectedClients);
      
      if (window.showNotifications) {
        showUserJoinedNotification(message.sessionId);
      }
    });
    
    room.onMessage("userLeft", (message) => {

      updateRoomNameDisplay(window.colyseusWelcomeRoomName, message.connectedClients);
      
      // 处理用户离开时释放的插槽
      if (message.releasedSlots && Array.isArray(message.releasedSlots)) {
        message.releasedSlots.forEach(slotIndex => {

          
          // 清空该插槽的步进数据
          clearSlotStepData(slotIndex);
        });
      }
    });
    
    // 错误消息
    room.onMessage("error", (message) => {
      console.error("服务器错误:", message);
      hideConnectionProgress();
      showCustomMessage(message.message || "服务器错误", "error");
    });
    
    // 监听预设更新通知
    room.onMessage("presetUpdated", (message) => {
      const { slotIndex, timestamp, priority, preset, cleared } = message;
      

      
      // 如果该插槽不是当前用户控制的，则立即更新本地数据
      if (colyseusSlotStates.mySlot !== slotIndex) {
        try {
          // 检查是否是清空预设的标记
          if (cleared || (preset && preset === "")) {

            clearSlotStepData(slotIndex);
            return;
          }
          
          // 优先使用消息中包含的完整预设数据（如果有）
          const presetData = preset || (room.state && room.state.presets && room.state.presets[slotIndex]);
          
          if (presetData) {
            // 解析预设数据
            const parsedPreset = typeof presetData === 'string' ? 
                              JSON.parse(presetData) : presetData;
            
            if (window.presetPatterns && window.presetPatterns[slotIndex]) {
              // 直接更新本地数据，不做任何额外检查，最大速度
              window.presetPatterns[slotIndex] = parsedPreset;

              
              // 立即刷新UI和声音引擎
              if (window.ui && window.ui.currentPattern === slotIndex) {
                if (window.presetManager && typeof window.presetManager.loadPreset === 'function') {
                  window.presetManager.loadPreset(slotIndex);
                }
              }
              
              // 强制立即触发UI更新
              if (typeof window.triggerCircleDataChange === 'function') {
                // 直接调用，不使用setTimeout
                window.triggerCircleDataChange();
              }
              
              // 如果有音频引擎，立即更新音频
              if (window.metronome && window.metronome.updateSteps) {
                window.metronome.updateSteps();
              }
            }
          }
        } catch (e) {
          console.error(`处理插槽 ${slotIndex + 1} 的预设更新时出错:`, e);
        }
      }
    });
    
    // 添加强制UI更新的消息处理程序
    room.onMessage("forceUIUpdate", (message) => {
      const { slotIndex } = message;

      
      // 立即触发UI更新
      if (typeof window.triggerCircleDataChange === 'function') {
        window.triggerCircleDataChange();
      }
      
      // 重新加载预设（如果当前正在查看）
      if (window.ui && window.ui.currentPattern === slotIndex) {
        if (window.presetManager && typeof window.presetManager.loadPreset === 'function') {
          window.presetManager.loadPreset(slotIndex);
        }
      }
    });
    
    // 添加同步响应的处理
    room.onMessage("syncNowResponse", (message) => {

    });
    
    // 添加状态强制同步请求的处理
    room.onMessage("stateSyncRequired", (message) => {

      
      // 如果当前控制着某个插槽，重新同步所有数据
      if (colyseusConnected && colyseusSlotStates.mySlot !== -1) {
        // 立即强制同步
        window.syncColyseusData();
        
        // 如果仍在查看相同的插槽，立即刷新UI
        if (window.ui && window.ui.currentPattern === colyseusSlotStates.mySlot) {
          if (typeof window.triggerCircleDataChange === 'function') {
            window.triggerCircleDataChange();
          }
        }
      }
    });
    
    // 监听八度信息更新通知
    room.onMessage("baseNoteUpdated", (message) => {
      const { slotIndex, baseNote, timestamp } = message;
      console.log(`收到插槽 ${slotIndex + 1} 的八度信息更新: ${baseNote}`);
      
      try {
        // 同步八度信息
        syncBaseNoteFromServer(slotIndex, baseNote);
        
        // 触发圆环数据变化事件以更新UI
        if (typeof window.triggerCircleDataChange === 'function') {
          setTimeout(() => {
            window.triggerCircleDataChange();
          }, 100);
        }
      } catch (e) {
        console.error("处理八度信息更新时出错:", e);
      }
    });
    
    // 🔥 新增：监听合成器参数更新通知
    room.onMessage("synthParamsUpdated", (message) => {
      const { slotIndex, params, timestamp } = message;
      console.log(`🎹 收到插槽 ${slotIndex + 1} 的合成器参数更新`);
      
      try {
        // 只同步不是当前用户控制的插槽
        if (colyseusSlotStates.mySlot !== slotIndex) {
          syncSynthParamsFromServer(slotIndex, params);
          console.log(`✅ 已同步插槽 ${slotIndex + 1} 的合成器参数`);
        } else {
          console.log(`⏭️ 跳过同步自己控制的插槽 ${slotIndex + 1}`);
        }
      } catch (e) {
        console.error("处理合成器参数更新时出错:", e);
      }
    });
    
    // 错误消息
    room.onMessage("error", (message) => {
      console.error("服务器错误:", message);
      hideConnectionProgress();
      showCustomMessage(message.message || "服务器错误", "error");
    });

  } catch (error) {
    console.error("设置房间监听器时出错:", error);
    hideConnectionProgress();
  }
}

// 显示通知
function showNotification(message, type = "normal") {
  // 检查是否已存在相同内容的通知
  const existingNotifications = document.querySelectorAll('.colyseus-notification');
  let notificationExists = false;
  
  for (let i = 0; i < existingNotifications.length; i++) {
    if (existingNotifications[i].textContent === message) {
      // 找到了相同内容的通知，重置其计时器而不是创建新通知
      const notification = existingNotifications[i];
      
      // 清除该通知之前的消失计时器
      const timerId = notification.getAttribute('data-timer-id');
      if (timerId) {
        clearTimeout(parseInt(timerId));
      }
      
      // 重新设置消失计时器
      const newTimerId = setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(30px)';
        
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
            // 重新调整剩余通知的位置
            repositionNotifications();
          }
        }, 300);
      }, 3000);
      
      // 保存新计时器ID
      notification.setAttribute('data-timer-id', newTimerId.toString());
      
      // 标记已存在相同通知
      notificationExists = true;
      break;
    }
  }
  
  // 如果没有相同内容的通知，则创建新通知
  if (!notificationExists) {
    // 获取当前通知数量用于计算位置
    const notificationCount = existingNotifications.length;
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'colyseus-notification';
    notification.style.position = 'fixed';
    notification.style.top = `${20 + notificationCount * 60}px`; // 根据已有通知数量计算垂直位置
    notification.style.right = '20px';
    notification.style.padding = '10px 15px';
    notification.style.borderRadius = '4px';
    notification.style.color = '#fff';
    notification.style.zIndex = '10000';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.style.transition = 'all 0.3s ease-in-out';
    notification.style.minWidth = '200px';
    notification.style.maxWidth = '300px';
    notification.style.wordWrap = 'break-word';
    notification.style.fontSize = '13px';
    
    // 根据类型设置样式
    if (type === "error") {
      notification.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
    } else if (type === "success") {
      notification.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
    } else {
      notification.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
    }
    
    notification.textContent = message;
    
    // 设置消失计时器并保存ID
    const timerId = setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(30px)';
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
          // 重新调整剩余通知的位置
          repositionNotifications();
        }
      }, 300);
    }, 3000);
    
    notification.setAttribute('data-timer-id', timerId.toString());
    document.body.appendChild(notification);
  }
}

// 辅助函数：重新调整所有通知的位置
function repositionNotifications() {
  const notifications = document.querySelectorAll('.colyseus-notification');
  notifications.forEach((note, index) => {
    note.style.top = `${20 + index * 60}px`;
  });
}

// 显示连接进度条
function showConnectionProgress() {
  // 检查是否已存在
  let progressContainer = document.getElementById('colyseus-progress-container');
  if (progressContainer) {
    progressContainer.style.display = 'flex';
    return;
  }
  
  progressContainer = document.createElement('div');
  progressContainer.id = 'colyseus-progress-container';
  progressContainer.style.position = 'fixed';
  progressContainer.style.top = '0';
  progressContainer.style.left = '0';
  progressContainer.style.width = '100%';
  progressContainer.style.height = '100%';
  progressContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  progressContainer.style.display = 'flex';
  progressContainer.style.justifyContent = 'center';
  progressContainer.style.alignItems = 'center';
  progressContainer.style.flexDirection = 'column';
  progressContainer.style.zIndex = '10000';
  
  const progressBox = document.createElement('div');
  progressBox.style.backgroundColor = 'rgba(40, 40, 40, 0.97)';
  progressBox.style.padding = '30px';
  progressBox.style.borderRadius = '12px';
  progressBox.style.textAlign = 'center';
  progressBox.style.color = '#fff';
  progressBox.style.width = '400px';
  
  const progressTitle = document.createElement('h3');
  progressTitle.id = 'colyseus-progress-title';
  progressTitle.textContent = '正在连接到服务器...';
  progressTitle.style.marginBottom = '20px';
  
  const progressBar = document.createElement('div');
  progressBar.style.width = '100%';
  progressBar.style.height = '10px';
  progressBar.style.backgroundColor = '#333';
  progressBar.style.borderRadius = '5px';
  progressBar.style.overflow = 'hidden';
  
  const progressIndicator = document.createElement('div');
  progressIndicator.id = 'colyseus-progress-indicator';
  progressIndicator.style.width = '0%';
  progressIndicator.style.height = '100%';
  progressIndicator.style.backgroundColor = '#4CAF50';
  progressIndicator.style.transition = 'width 0.2s';
  
  // 添加服务器信息显示
  const serverInfoDiv = document.createElement('div');
  serverInfoDiv.style.marginTop = '10px';
  serverInfoDiv.style.fontSize = '12px';
  serverInfoDiv.style.color = '#ccc';
  serverInfoDiv.innerHTML = `<div>服务器: <span style="color:#fff">${colyseusServerUrl}</span></div>
                            <div>房间: <span style="color:#fff">${colyseusRoomName}</span></div>
                            <div>用户名: <span style="color:#fff">${colyseusSlotStates.username}</span></div>`;
  
  // 添加调试信息区域，增加高度显示更多信息
  const debugInfo = document.createElement('div');
  debugInfo.id = 'colyseus-debug-info';
  debugInfo.style.marginTop = '15px';
  debugInfo.style.fontSize = '12px';
  debugInfo.style.color = '#aaa';
  debugInfo.style.width = '100%';
  debugInfo.style.wordWrap = 'break-word';
  debugInfo.style.textAlign = 'left';
  debugInfo.style.height = '120px'; // 增加高度
  debugInfo.style.overflow = 'auto';
  debugInfo.style.backgroundColor = 'rgba(0,0,0,0.3)';
  debugInfo.style.padding = '5px';
  debugInfo.style.borderRadius = '4px';
  debugInfo.innerHTML = '<div>正在初始化连接...</div>';
  
  // 添加重试按钮，但默认隐藏
  const retryButton = document.createElement('button');
  retryButton.id = 'colyseus-retry-button';
  retryButton.textContent = '重试连接';
  retryButton.style.marginTop = '20px';
  retryButton.style.padding = '8px 20px';
  retryButton.style.backgroundColor = '#3f51b5';
  retryButton.style.color = 'white';
  retryButton.style.border = 'none';
  retryButton.style.borderRadius = '4px';
  retryButton.style.cursor = 'pointer';
  retryButton.style.display = 'none'; // 默认隐藏
  retryButton.addEventListener('click', function() {
    // 重置连接状态 - 强制隐藏当前进度条
    hideConnectionProgress(true);
    setTimeout(() => {
      // 重试连接
      connectToColyseus();
    }, 500);
  });
  
  // 添加取消按钮
  const cancelButton = document.createElement('button');
  cancelButton.id = 'colyseus-cancel-button';
  cancelButton.textContent = '取消';
  cancelButton.style.marginTop = '10px';
  cancelButton.style.padding = '6px 15px';
  cancelButton.style.backgroundColor = 'transparent';
  cancelButton.style.color = '#ccc';
  cancelButton.style.border = '1px solid #666';
  cancelButton.style.borderRadius = '4px';
  cancelButton.style.cursor = 'pointer';
  cancelButton.addEventListener('click', function() {
    // 强制隐藏进度条窗口
    hideConnectionProgress(true);
  });
  
  progressBar.appendChild(progressIndicator);
  progressBox.appendChild(progressTitle);
  progressBox.appendChild(progressBar);
  progressBox.appendChild(serverInfoDiv);
  progressBox.appendChild(debugInfo);
  progressBox.appendChild(retryButton);
  progressBox.appendChild(cancelButton);
  progressContainer.appendChild(progressBox);
  
  document.body.appendChild(progressContainer);
  
  // 模拟进度增长，让进度条动起来
  let progress = 0;
  let lastPhase = '';
  const progressInterval = setInterval(() => {
    progress += 5;
    if (progress > 90) { // 最多到90%，留下10%等待实际连接成功
      clearInterval(progressInterval);
    }
    const indicator = document.getElementById('colyseus-progress-indicator');
    if (indicator) {
      indicator.style.width = `${progress}%`;
    }
    
    // 更新调试信息，显示当前连接状态
    const debugInfoElem = document.getElementById('colyseus-debug-info');
    if (debugInfoElem) {
      let phase = '';
      
      if (progress < 30) {
        phase = '初始化WebSocket连接...';
      } else if (progress < 60) {
        phase = '等待服务器响应...';
      } else if (progress < 85) {
        phase = '等待欢迎消息...';
      } else {
        phase = '准备完成连接...';
      }
      
      // 仅在阶段变化时添加新消息
      if (phase !== lastPhase) {
        debugInfoElem.innerHTML += `<div>${phase}</div>`;
        lastPhase = phase;
        
        // 自动滚动到底部
        debugInfoElem.scrollTop = debugInfoElem.scrollHeight;
      }
    }
  }, 400); // 降低速度，给更多时间显示连接过程
  
  // 保存interval ID用于清除
  progressContainer.dataset.intervalId = progressInterval;
  
  // 10秒后如果还没完成，显示重试按钮
  setTimeout(() => {
    const retryBtn = document.getElementById('colyseus-retry-button');
    if (retryBtn && !colyseusConnected) {
      const debugInfoElem = document.getElementById('colyseus-debug-info');
      if (debugInfoElem) {
        debugInfoElem.innerHTML += '<div style="color:orange">连接似乎需要较长时间，您可以尝试重试...</div>';
        // 自动滚动到底部
        debugInfoElem.scrollTop = debugInfoElem.scrollHeight;
      }
      retryBtn.style.display = 'inline-block';
    }
  }, 10000);
}

// 隐藏连接进度条
function hideConnectionProgress(force = false) {
  // 清除超时定时器
  if (window.colyseusProgressTimeout) {
    clearTimeout(window.colyseusProgressTimeout);
    window.colyseusProgressTimeout = null;
  }
  
  const progressContainer = document.getElementById('colyseus-progress-container');
  if (progressContainer) {
    // 清除进度条动画
    if (progressContainer.dataset.intervalId) {
      clearInterval(parseInt(progressContainer.dataset.intervalId));
      progressContainer.dataset.intervalId = null;
    }
    
    // 先将进度设为100%
    const progressIndicator = document.getElementById('colyseus-progress-indicator');
    if (progressIndicator) {
      progressIndicator.style.width = '100%';
    }
    
    // 如果连接成功或强制隐藏，则关闭进度条窗口
    if (connectionSuccessful || force) {
      // 记录日志表明UI正在关闭
      const debugInfoElem = document.getElementById('colyseus-debug-info');
      if (debugInfoElem) {
        debugInfoElem.innerHTML += '<div style="color:green">进度界面即将关闭...</div>';
        debugInfoElem.scrollTop = debugInfoElem.scrollHeight;
      }
      
      // 短暂延迟后移除进度条
      setTimeout(() => {
        if (progressContainer.parentNode) {
          progressContainer.parentNode.removeChild(progressContainer);
        }
      }, 500);
    } else {
      // 如果是连接失败，保留进度条窗口用于显示错误信息

    }
  }
}

// 显示连接成功提示
function showConnectionSuccess() {
  // 检查是否已存在
  let successContainer = document.getElementById('colyseus-success-container');
  if (successContainer) {
    return;
  }
  
  // 先将连接进度条的进度设为100%
  const progressIndicator = document.getElementById('colyseus-progress-indicator');
  if (progressIndicator) {
    progressIndicator.style.width = '100%';
    progressIndicator.style.backgroundColor = '#4CAF50';
  }
  
  // 更新标题
  const progressTitle = document.getElementById('colyseus-progress-title');
  if (progressTitle) {
    progressTitle.textContent = '连接成功!';
    progressTitle.style.color = '#4CAF50';
  }
  
  // 添加成功信息到调试区域
  const debugInfoElem = document.getElementById('colyseus-debug-info');
  if (debugInfoElem) {
    debugInfoElem.innerHTML += '<div style="color:#4CAF50;font-weight:bold">✓ 连接成功!</div>';
    debugInfoElem.innerHTML += '<div>会话ID: ' + sessionId + '</div>';
    debugInfoElem.innerHTML += '<div>即将进入插槽选择...</div>';
    debugInfoElem.scrollTop = debugInfoElem.scrollHeight;
  }
  
  // 显示通知
  showNotification("已成功连接到节奏环协作服务器", "success");
  
  // 隐藏重试按钮，如果它存在
  const retryBtn = document.getElementById('colyseus-retry-button');
  if (retryBtn) {
    retryBtn.style.display = 'none';
  }
  
  // 修改取消按钮为继续按钮
  const cancelBtn = document.getElementById('colyseus-cancel-button');
  if (cancelBtn) {
    cancelBtn.textContent = '继续';
    cancelBtn.style.backgroundColor = '#4CAF50';
    cancelBtn.style.color = 'white';
    cancelBtn.style.border = 'none';
  }
}

// 从初始状态初始化数据
function initializeFromState(state) {
  if (!state) return;
  
  try {
    // 处理插槽数据
    if (state.slots) {
      processInitialSlots(state.slots);
    }
    
    // 处理预设数据
    if (state.presets) {
      processInitialPresets(state.presets);
    }
    
    // 处理合成器参数
    if (state.synthParams) {
      processInitialSynthParams(state.synthParams);
    }
    
    // 处理BPM
    if (state.bpm !== undefined) {
      updateBpmFromState(state.bpm);
    }
    
    // 同步状态到PresetManager
    handleServerStateUpdate();
    
  } catch (error) {
    console.error("初始化状态时出错:", error);
  }
}

// 更新插槽状态
function updateSlotsFromState(slots) {
  if (!slots) return;
  
  // 只操作服务器明确提供的插槽数据，不清空任何其他插槽
  for (const slotIndex in slots) {
    const slotNum = parseInt(slotIndex);
    if (!isNaN(slotNum) && slotNum >= 0 && slotNum < 8) {
      if (typeof slots[slotIndex] === 'object' && slots[slotIndex] !== null) {
        // 如果是包含sessionId的对象
        colyseusSlotStates.data.slots[slotNum] = slots[slotIndex].sessionId;
        // 如果有用户名信息，也更新它
        if (slots[slotIndex].username) {
          colyseusSlotStates.data.slotNames[slotNum] = slots[slotIndex].username;
        }
      } else {
        // 如果直接是sessionId字符串
        colyseusSlotStates.data.slots[slotNum] = slots[slotIndex];
      }
    }
  }
  
  // 简化日志，仅在调试模式下输出详细信息
  if (window.debugColyseus) {


  }
  
  // 同步状态到PresetManager
  handleServerStateUpdate();
}

// 更新预设数据
function updatePresetsFromState(presets) {
  if (!presets || !Array.isArray(presets)) return;
  
  // 更新所有有数据的预设，除了自己控制的插槽
  for (let i = 0; i < presets.length && i < 8; i++) {
    // 只更新其他人控制的插槽
    if (i !== colyseusSlotStates.mySlot && presets[i]) {
      const presetData = presets[i];
      
      try {
        // 解析预设数据
        const parsedPreset = typeof presetData === 'string' ? 
                             JSON.parse(presetData) : presetData;
        
        // 更新本地预设数据
        if (window.presetPatterns && window.presetPatterns[i]) {
          window.presetPatterns[i] = parsedPreset;
        }
        
        // 如果当前正在查看该预设，重新加载它
        if (window.ui && window.ui.currentPattern === i) {
          if (window.presetManager && typeof window.presetManager.loadPreset === 'function') {
            window.presetManager.loadPreset(i);
          }
        }
      } catch (e) {
        console.error(`解析插槽 ${i+1} 的预设数据时出错:`, e);
      }
    }
  }
  
  // 触发圆环数据变化事件以更新UI
  if (typeof window.triggerCircleDataChange === 'function') {
    window.triggerCircleDataChange();
  }
}

// 更新合成器参数
function updateSynthParamsFromState(synthParams) {
  if (!synthParams || !Array.isArray(synthParams)) return;
  
  // 更新所有有数据的合成器参数，除了自己控制的插槽
  for (let i = 0; i < synthParams.length && i < 8; i++) {
    // 只更新其他人控制的插槽
    if (i !== colyseusSlotStates.mySlot && synthParams[i]) {
      syncSynthParamsFromServer(i, synthParams[i]);
    }
  }
}

// 更新BPM
function updateBpmFromState(bpm) {
  if (typeof bpm !== 'number' || bpm < 30 || bpm > 300) return;
  
  // 更新全局BPM
  if (window.metronome && window.metronome.bpm !== bpm) {
    window.metronome.setBpm(bpm);

  }
  
  // 更新UI变量
  if (window.bpm !== undefined && window.bpm !== bpm) {
    window.bpm = bpm;
  }
  
  // 存储在本地状态中
  colyseusSlotStates.data.bpm = bpm;
}

// 同步BPM到服务器（节流由外层throttledSyncBpm控制，此处只做发送逻辑）
function syncBpmToServer(bpm) {
  if (!colyseusConnected || colyseusSlotStates.mySlot === -1) return;

  // 确保BPM在有效范围内
  if (typeof bpm !== 'number' || bpm < 30 || bpm > 300) return;

  // 检查是否有实际变化，只有BPM实际改变时才发送
  if (colyseusSlotStates.data.bpm !== bpm) {
    if (colyseusRoom) {
      colyseusRoom.send("updateBpm", { bpm });
      colyseusSlotStates.data.bpm = bpm; // 更新本地缓存
    }
  }
}

// 选择插槽控制
function selectColyseusSlot(slotIndex) {
  if (!colyseusConnected || !colyseusRoom) {
    console.warn("未连接到Colyseus服务器，无法选择插槽");
    return false;
  }
  
  // 检查插槽是否已被占用
  if (colyseusSlotStates.data.slots[slotIndex] != null && 
      colyseusSlotStates.data.slots[slotIndex] !== sessionId) {
    showCustomMessage(`插槽 ${slotIndex + 1} 已被其他用户占用!`, "warning");
    return false;
  }
  
  // 如果当前控制着其他插槽，先释放它
  if (colyseusSlotStates.mySlot !== -1 && colyseusSlotStates.mySlot !== slotIndex) {
    // 记录旧插槽索引以便之后清空
    const oldSlotIndex = colyseusSlotStates.mySlot;
    
    // 释放当前控制的插槽
    colyseusRoom.send("releaseSlot", { slotIndex: oldSlotIndex });
    
    // 重要：在本地立即清除旧插槽的占用状态，不等待服务器响应
    // 这样UI就能立即更新，避免旧插槽显示叉号
    if (colyseusSlotStates.data && colyseusSlotStates.data.slots) {
      delete colyseusSlotStates.data.slots[oldSlotIndex];
    }
    
    // 同时更新presetManager中的slotOwners
    if (window.presetManager && window.presetManager.slotOwners) {
      delete window.presetManager.slotOwners[oldSlotIndex];
    }
    
    // 更新全局slotOwners变量
    if (window.slotOwners) {
      delete window.slotOwners[oldSlotIndex];
    }
  }
  
  // 更新本地状态
  colyseusSlotStates.mySlot = slotIndex;
  
  // 发送占用插槽请求到服务器
  colyseusRoom.send("claimSlot", { 
    slotIndex, 
    username: colyseusSlotStates.username
  });
  

  
  // 如果有预设管理器，设置控制插槽
  if (window.presetManager) {
    window.presetManager.controlledSlotIndex = slotIndex;
    window.presetManager.isViewOnlyMode = false;
  }
  
  // 如果有全局变量，同步状态
  window.controlledSlotIndex = slotIndex;
  window.isViewOnlyMode = false;
  
  // 同步当前的合成器参数到服务器
  if (window.synthPresetManager) {
    syncAllSynthParamsToServer();
  }
  
  // 同步当前的预设模式到服务器
  if (window.presetPatterns && window.presetPatterns[slotIndex]) {
    syncPresetToServer(slotIndex);
  }
  
  // 同步状态到PresetManager
  handleServerStateUpdate();
  
  // 自动切换到所选插槽
  if (window.loadPreset && typeof window.loadPreset === 'function') {
    // 加载所选插槽的预设
    window.loadPreset(slotIndex);
  } else {
    // 如果loadPreset函数不可用，手动刷新UI
    if (typeof window.updateUIPositions === 'function') {
      window.updateUIPositions();
    }
    
    // 手动强制重绘
    if (typeof window.redraw === 'function') {
      window.redraw();
    }
  }
  
  // 关闭对话框
  dialogVisible = false;
  
  return true;
}

// 进入观看模式，不控制任何插槽
function enterColyseusViewMode() {
  if (!colyseusConnected || !colyseusRoom) return;
  
  // 如果当前控制着某个插槽，先释放它
  if (colyseusSlotStates.mySlot !== -1) {
    // 记录要释放的插槽
    const oldSlotIndex = colyseusSlotStates.mySlot;
    
    // 发送释放插槽请求
    colyseusRoom.send("releaseSlot", { slotIndex: oldSlotIndex });
    
    // 同样立即在本地清除插槽占用状态
    if (colyseusSlotStates.data && colyseusSlotStates.data.slots) {
      delete colyseusSlotStates.data.slots[oldSlotIndex];
    }
    
    // 同时更新presetManager中的slotOwners
    if (window.presetManager && window.presetManager.slotOwners) {
      delete window.presetManager.slotOwners[oldSlotIndex];
    }
    
    // 更新全局slotOwners变量
    if (window.slotOwners) {
      delete window.slotOwners[oldSlotIndex];
    }
  }
  
  // 更新本地状态
  colyseusSlotStates.mySlot = -1;
  
  // 如果有预设管理器，设置观看模式
  if (window.presetManager) {
    window.presetManager.controlledSlotIndex = -1;
    window.presetManager.isViewOnlyMode = true;
  }
  
  // 同步全局变量
  window.controlledSlotIndex = -1;
  window.isViewOnlyMode = true;
  
  // 同步状态到PresetManager
  handleServerStateUpdate();
  
  // 关闭对话框
  dialogVisible = false;
  
  return true;
}

// 从服务器同步合成器参数
function syncSynthParamsFromServer(slotIndex, paramsJson) {
  // 如果当前用户控制这个插槽，不从服务器更新
  if (colyseusSlotStates.mySlot === slotIndex) return;
  
  // 确保SynthPresetManager存在
  if (!window.synthPresetManager) return;
  
  try {
    // 解析参数
    const params = typeof paramsJson === 'string' ? JSON.parse(paramsJson) : paramsJson;
    
    // 更新合成器参数
    if (params.envelopeParams) {
      window.synthPresetManager.presetEnvelopeParams[slotIndex] = params.envelopeParams;
    }
    
    if (params.filterParams) {
      window.synthPresetManager.presetFilterParams[slotIndex] = params.filterParams;
    }
    
    if (params.waveform) {
      window.synthPresetManager.presetWaveforms[slotIndex] = params.waveform;
    }
    
    // 更新效果参数
    if (params.delayEnabled !== undefined) {
      window.synthPresetManager.presetDelayEnabled[slotIndex] = params.delayEnabled;
    }
    
    if (params.delayParams) {
      window.synthPresetManager.presetDelayParams[slotIndex] = params.delayParams;
    }
    
    if (params.reverbEnabled !== undefined) {
      window.synthPresetManager.presetReverbEnabled[slotIndex] = params.reverbEnabled;
    }
    
    if (params.reverbParams) {
      window.synthPresetManager.presetReverbParams[slotIndex] = params.reverbParams;
    }
    
    if (params.portamentoEnabled !== undefined) {
      window.synthPresetManager.presetPortamentoEnabled[slotIndex] = params.portamentoEnabled;
    }
    
    if (params.portamentoTime !== undefined) {
      window.synthPresetManager.presetPortamentoTime[slotIndex] = params.portamentoTime;
    }
    
    // 如果当前正在查看此插槽，立即更新合成器参数
    if (window.ui && window.ui.currentPattern === slotIndex && 
        window.metronome && window.metronome.synthUI) {
      // 更新合成器UI
      updateSynthUIForSlot(slotIndex);
    }
    

    
  } catch (e) {
    console.error("解析或应用合成器参数时出错:", e);
  }
}

// 更新指定插槽的合成器UI
function updateSynthUIForSlot(slotIndex) {
  // 确保有合成器对象
  if (!window.metronome || !window.metronome.synthUI) return;
  
  try {
    // 如果有合成器初始化函数，调用它来更新参数
    if (typeof window.metronome.initSound === 'function') {
      window.metronome.initSound();
    }
    
    // 重新绘制UI
    if (typeof window.redraw === 'function') {
      window.redraw();
    }
  } catch (e) {
    console.error("更新合成器UI时出错:", e);
  }
}

// 检测节奏圆环数据变化并同步
function checkAndSyncCircleData() {
  // 如果未连接或不控制任何插槽，不同步
  if (!colyseusConnected || colyseusSlotStates.mySlot === -1) return;
  
  // 如果在总览模式中正在拖拽，跳过同步
  if (window.isDraggingInOverview) {

    return;
  }
  
  const slotIndex = colyseusSlotStates.mySlot;
  
  // 检测是否需要同步预设数据
  if (window.presetPatterns && window.presetPatterns[slotIndex]) {
    const currentPattern = window.presetPatterns[slotIndex];
    const lastPattern = lastSyncedStates[slotIndex];
    
    // 使用严格比较：只在实际有变化时同步，移除频繁的强制同步
          if (!lastPattern || JSON.stringify(currentPattern) !== JSON.stringify(lastPattern)) {
        syncPresetToServer(slotIndex);
        
        // 更新上次同步的状态
        lastSyncedStates[slotIndex] = JSON.parse(JSON.stringify(currentPattern));
        // 减少日志输出

      } else {
        // 如果没有变化，则不打印同步日志，降低日志干扰
      }
    
    // 仍然增加计数器以便跟踪
    syncCounter++;
  }
}

// 同步预设模式到服务器
function syncPresetToServer(slotIndex) {
  // 权限检查：必须已连接，且只能同步自己控制的插槽
  if (!colyseusConnected || !colyseusRoom) {
    console.warn("未连接到Colyseus服务器，无法同步预设");
    return false;
  }
  
  // 严格检查当前用户是否有权限同步该插槽
  if (colyseusSlotStates.mySlot !== slotIndex) {
    console.warn(`无权同步插槽 ${slotIndex + 1}，当前控制的是插槽 ${colyseusSlotStates.mySlot + 1 || '无'}`);
    return false;
  }
  
  // 获取当前的预设数据
  const preset = window.presetPatterns[slotIndex];
  if (!preset) {
    console.warn(`插槽 ${slotIndex + 1} 没有预设数据，无法同步`);
    return false;
  }
  
  try {
    // 为提升性能，添加缓存比较，避免重复发送相同数据
    const presetJSON = JSON.stringify(preset);
    const lastPresetCache = window.lastSyncedPresetJSON || {};
    
    // 只在数据有变化时发送
    if (presetJSON !== lastPresetCache[slotIndex]) {
      // 记录本次发送的数据用于下次比较
      if (!window.lastSyncedPresetJSON) window.lastSyncedPresetJSON = {};
      window.lastSyncedPresetJSON[slotIndex] = presetJSON;
      
      // 使用高优先级消息发送预设数据
      colyseusRoom.send("updatePreset", {
        slotIndex,
        preset: presetJSON,
        timestamp: Date.now() // 添加时间戳以便调试和优先级排序
      });
      
      // 控制台日志太多，取消输出

      return true;
    } else {
      // 无变化，但依然算同步成功
      return true;
    }
  } catch (error) {
    console.error("发送预设数据到服务器时出错:", error);
    return false;
  }
}

// 同步所有合成器参数到服务器
function syncAllSynthParamsToServer() {
  if (!colyseusConnected || colyseusSlotStates.mySlot === -1 || !colyseusRoom) return;
  
  // 如果在总览模式中正在拖拽，跳过同步
  if (window.isDraggingInOverview) {

    return;
  }
  
  // 检查是否有合成器管理器
  if (!window.synthPresetManager) return;
  
  const slotIndex = colyseusSlotStates.mySlot;
  
  try {
    // 获取当前插槽的所有合成器参数
    const params = {
      envelopeParams: window.synthPresetManager.presetEnvelopeParams[slotIndex],
      filterParams: window.synthPresetManager.presetFilterParams[slotIndex],
      waveform: window.synthPresetManager.presetWaveforms[slotIndex],
      delayEnabled: window.synthPresetManager.presetDelayEnabled[slotIndex],
      delayParams: window.synthPresetManager.presetDelayParams[slotIndex],
      reverbEnabled: window.synthPresetManager.presetReverbEnabled[slotIndex],
      reverbParams: window.synthPresetManager.presetReverbParams[slotIndex],
      portamentoEnabled: window.synthPresetManager.presetPortamentoEnabled[slotIndex],
      portamentoTime: window.synthPresetManager.presetPortamentoTime[slotIndex]
    };
    
    // 发送到服务器
    colyseusRoom.send("updateSynthParams", {
      slotIndex,
      params: JSON.stringify(params)
    });
    

  } catch (error) {
    console.error("发送合成器参数到服务器时出错:", error);
  }
}

// 同步单个合成器参数到服务器
function syncSynthParamsToServer(slotIndex, params) {
  if (!colyseusConnected || colyseusSlotStates.mySlot !== slotIndex || !colyseusRoom) return;
  
  // 如果在总览模式中正在拖拽，跳过同步
  if (window.isDraggingInOverview) {

    return;
  }
  
  try {
    // 发送到服务器
    colyseusRoom.send("updateSynthParams", {
      slotIndex,
      params: JSON.stringify(params)
    });
    

  } catch (error) {
    console.error("发送合成器参数到服务器时出错:", error);
  }
}

// 增加触发同步的辅助方法
window.syncColyseusData = function() {
  // 严格检查WebSocket连接状态
  if (!colyseusConnected || !colyseusRoom || !colyseusRoom.connection || !colyseusRoom.connection.isOpen) {
    // 检测到连接问题，尝试重新连接
    if (colyseusConnected) {
      console.warn("同步数据时检测到WebSocket连接已关闭，尝试重置连接状态");
      reconnectIfNeeded();
    }
    return;
  }
  
  try {
    // 立即检查并同步圆环数据
    checkAndSyncCircleData();
    
    // 如果有合成器数据，同步它
    if (window.synthPresetManager && colyseusSlotStates.mySlot !== -1) {
      syncAllSynthParamsToServer();
    }
    
    // 同步当前BPM
    if (window.metronome && colyseusSlotStates.mySlot !== -1) {
      syncBpmToServer(window.metronome.bpm);
    }
  } catch (syncError) {
    console.error("同步数据时出错:", syncError);
    // 检查是否是WebSocket错误
    if (syncError.message && (syncError.message.includes("WebSocket") || syncError.message.includes("connection"))) {
      reconnectIfNeeded();
    }
  }
};

// 监听圆环数据变化事件 - 使用防抖来避免高频同步
let circleDataChangeDebounceTimer = null;
window.addEventListener('circle-data-change', (event) => {
  // 清除之前的定时器
  if (circleDataChangeDebounceTimer) {
    clearTimeout(circleDataChangeDebounceTimer);
  }
  
  // 设置一个新的定时器，300ms后执行同步
  circleDataChangeDebounceTimer = setTimeout(() => {
    window.syncColyseusData();
    circleDataChangeDebounceTimer = null;
  }, 300);
});

// 监听BPM变化事件（使用节流，200ms）
window.addEventListener('bpm-change', (event) => {
  if (!event.detail || !event.detail.bpm) return;

  // 如果是当前用户控制的插槽，同步BPM到服务器
  if (colyseusConnected && colyseusSlotStates.mySlot !== -1) {
    throttledSyncBpm(event.detail.bpm);
  }
});

// 当页面关闭或刷新时，自动离开房间
window.addEventListener('beforeunload', () => {
  if (colyseusConnected && colyseusRoom) {

    colyseusRoom.leave();
  }
});

// 定期同步数据，确保所有用户保持同步 - 但降低频率到每30秒同步一次
setInterval(() => {
  if (colyseusConnected && colyseusSlotStates.mySlot !== -1) {
    window.syncColyseusData();
  }
}, 30000); // 每30秒同步一次

// 公开到window对象，使其他模块可以调用
window.connectToColyseus = connectToColyseus;
window.disconnectFromColyseus = disconnectFromColyseus;
window.selectColyseusSlot = selectColyseusSlot;
window.enterColyseusViewMode = enterColyseusViewMode;
window.colyseusSlotStates = colyseusSlotStates; // 导出插槽状态用于调试

// 弹窗UI入口：点击联网协作按钮后弹出
function showColyseusDialog() {
  if (colyseusDialogVisible) return;
  colyseusDialogVisible = true;
  
  // 先删除可能存在的旧对话框
  const existingDialog = document.getElementById('colyseus-slot-dialog');
  if (existingDialog && existingDialog.parentNode) {
    existingDialog.parentNode.removeChild(existingDialog);
  }
  
  // 主动从服务器请求最新的房间状态
  if (colyseusConnected && colyseusRoom) {

    
    // 显示加载提示
    showNotification("正在获取最新房间信息...", "normal");
    
    // 向服务器请求最新状态
    colyseusRoom.send("requestRoomState", {
      timestamp: Date.now()
    });
    
    // 等待一小段时间后再创建对话框，确保有时间接收到最新状态
    setTimeout(() => {


      createColyseusDialog();
    }, 300);
  } else {
    // 如果未连接，直接创建对话框
    createColyseusDialog();
  }
}

// 创建弹窗UI
function createColyseusDialog() {
  // 检查是否已存在
  let dialog = document.getElementById('colyseus-slot-dialog');
  if (dialog) {
    dialog.style.display = 'block';
    return;
  }
  
  // 打印当前插槽状态用于调试


  
  // 如果仍然连接着但插槽数据为空，尝试再次请求
  if (colyseusConnected && colyseusRoom && (!colyseusSlotStates.data.slots || Object.keys(colyseusSlotStates.data.slots).length === 0)) {
    console.warn("插槽数据可能不完整，尝试再次请求...");
    // 不阻塞UI，继续创建对话框
  }

  dialog = document.createElement('div');
  dialog.id = 'colyseus-slot-dialog';
  dialog.style.position = 'fixed';
  dialog.style.top = '50%';
  dialog.style.left = '50%';
  dialog.style.transform = 'translate(-50%, -50%)';
  dialog.style.backgroundColor = 'rgba(40, 40, 40, 0.97)';
  dialog.style.padding = '24px 20px 16px 20px';
  dialog.style.borderRadius = '12px';
  dialog.style.boxShadow = '0 0 32px rgba(0,0,0,0.5)';
  dialog.style.zIndex = '9999';
  dialog.style.minWidth = '340px';
  dialog.style.maxWidth = '90vw';
  dialog.style.color = '#fff';
  dialog.style.fontFamily = 'Arial, sans-serif';

  // 如果有已保存的房间名，添加房间名称显示
  if (window.colyseusWelcomeRoomName) {
    const roomNameElem = document.createElement('div');
    roomNameElem.id = 'colyseus-room-name-display';
    roomNameElem.textContent = `当前房间: ${window.colyseusWelcomeRoomName}`;
    roomNameElem.style.textAlign = 'center';
    roomNameElem.style.marginBottom = '10px';
    roomNameElem.style.color = '#fff';
    dialog.appendChild(roomNameElem);
  }

  // 标题
  const title = document.createElement('h2');
  title.textContent = '选择一个插槽进行控制';
  title.style.textAlign = 'center';
  title.style.marginBottom = '12px';
  dialog.appendChild(title);

  // 用户信息
  const userInfo = document.createElement('div');
  userInfo.textContent = `会话ID: ${sessionId || ''} | 用户名: ${colyseusSlotStates.username}`;
  userInfo.style.textAlign = 'center';
  userInfo.style.fontSize = '13px';
  userInfo.style.color = '#ccc';
  userInfo.style.marginBottom = '10px';
  dialog.appendChild(userInfo);
  
  // 说明文字
  const helpText = document.createElement('div');
  if (colyseusSlotStates.mySlot !== -1) {
    helpText.textContent = `你当前控制插槽 ${colyseusSlotStates.mySlot + 1}。点击其他插槽可以更换控制。`;
  } else {
    helpText.textContent = "请选择一个插槽进行控制，或进入观看模式。";
  }
  helpText.style.textAlign = 'center';
  helpText.style.fontSize = '14px';
  helpText.style.color = '#eee';
  helpText.style.marginBottom = '16px';
  dialog.appendChild(helpText);

  // 插槽按钮区
  const slotContainer = document.createElement('div');
  slotContainer.style.display = 'flex';
  slotContainer.style.flexWrap = 'wrap';
  slotContainer.style.justifyContent = 'center';
  slotContainer.style.gap = '10px';
  slotContainer.style.marginBottom = '18px';

  // 设置预设颜色数组
  const slotColors = [
    '#FF5252', // 红色
    '#FF9800', // 橙色
    '#FFEB3B', // 黄色
    '#4CAF50', // 绿色
    '#2196F3', // 蓝色
    '#673AB7', // 紫色
    '#E91E63', // 粉色
    '#00BCD4'  // 青色
  ];

  for (let i = 0; i < 8; i++) {
    // 正确判断插槽状态
    const isOccupied = colyseusSlotStates.data.slots[i] != null;
    const isMySlot = isOccupied && colyseusSlotStates.data.slots[i] === sessionId;
    const isControlled = colyseusSlotStates.mySlot === i;
    
    // 获取插槽用户名
    const slotUsername = colyseusSlotStates.data.slotNames[i] || '未知用户';
    
    const button = document.createElement('div'); // 使用div而不是button，更灵活的样式
    button.style.padding = '12px 0';
    button.style.width = '95px';
    button.style.borderRadius = '8px';
    button.style.cursor = isOccupied && !isMySlot ? 'not-allowed' : 'pointer';
    
    // 使用对应插槽的颜色
    const baseColor = slotColors[i];
    const slotColor = isControlled ? baseColor : (isOccupied && !isMySlot ? '#555' : '#333');
    const borderColor = isControlled ? baseColor : (isMySlot ? baseColor : 'transparent');
    
    button.style.background = slotColor;
    button.style.color = '#fff';
    button.style.fontWeight = isControlled ? 'bold' : 'normal';
    button.style.boxShadow = isControlled ? `0 0 10px ${baseColor}` : 'none';
    button.style.border = `2px solid ${borderColor}`;
    button.style.margin = '0 2px';
    button.style.fontSize = '16px';
    button.style.display = 'flex';
    button.style.flexDirection = 'column';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.position = 'relative';
    button.style.transition = 'all 0.2s ease';

    // 插槽编号
    const slotNumber = document.createElement('div');
    slotNumber.textContent = `插槽 ${i + 1}`;
    slotNumber.style.fontWeight = 'bold';
    slotNumber.style.fontSize = '15px';
    button.appendChild(slotNumber);

    // 状态指示
    const status = document.createElement('div');
    status.style.fontSize = '12px';
    status.style.marginTop = '5px';
    status.style.color = '#eee';
    
    if (isControlled) {
      status.textContent = '✓ 正在控制';
      status.style.color = '#8fff8f';
    } else if (isMySlot) {
      status.textContent = '可以恢复控制';
      status.style.color = '#8fffff';
    } else if (isOccupied) {
      status.textContent = `被占用`;
      status.style.color = '#ffaaaa';
      
      // 添加用户名提示
      const tooltip = document.createElement('div');
      tooltip.textContent = slotUsername;
      tooltip.style.position = 'absolute';
      tooltip.style.bottom = '-25px';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translateX(-50%)';
      tooltip.style.backgroundColor = 'rgba(0,0,0,0.8)';
      tooltip.style.padding = '3px 6px';
      tooltip.style.borderRadius = '4px';
      tooltip.style.fontSize = '11px';
      tooltip.style.whiteSpace = 'nowrap';
      tooltip.style.display = 'none';
      tooltip.style.zIndex = '10000';
      button.appendChild(tooltip);
      
      // 鼠标悬停显示用户名
      button.onmouseover = () => {
        tooltip.style.display = 'block';
      };
      button.onmouseout = () => {
        tooltip.style.display = 'none';
      };
    } else {
      status.textContent = '可用';
      status.style.color = '#aaaaaa';
    }
    button.appendChild(status);

    // 点击事件 - 只有未被占用或是我的插槽才能点击
    if (!isOccupied || isMySlot) {
      button.onclick = () => {
        selectColyseusSlot(i);
        closeColyseusDialog();
      };
      
      // 添加悬停效果
      button.onmouseover = () => {
        button.style.background = isControlled ? baseColor : '#444';
        button.style.boxShadow = `0 0 8px ${baseColor}`;
      };
      button.onmouseout = () => {
        button.style.background = slotColor;
        button.style.boxShadow = isControlled ? `0 0 10px ${baseColor}` : 'none';
      };
    }
    
    slotContainer.appendChild(button);
  }
  dialog.appendChild(slotContainer);

  // 观看模式按钮
  const viewBtn = document.createElement('button');
  const isInViewMode = colyseusSlotStates.mySlot === -1;
  viewBtn.textContent = isInViewMode ? '✓ 当前为观看模式' : '进入观看模式 (不控制任何插槽)';
  viewBtn.style.width = '100%';
  viewBtn.style.padding = '12px';
  viewBtn.style.marginBottom = '12px';
  viewBtn.style.background = isInViewMode ? '#8e24aa' : '#9C27B0';
  viewBtn.style.color = '#fff';
  viewBtn.style.border = 'none';
  viewBtn.style.borderRadius = '6px';
  viewBtn.style.cursor = 'pointer';
  viewBtn.style.fontWeight = isInViewMode ? 'bold' : 'normal';
  viewBtn.style.boxShadow = isInViewMode ? '0 0 8px #9C27B0' : 'none';
  
  viewBtn.onmouseover = () => {
    viewBtn.style.background = '#aa2fbf';
    viewBtn.style.boxShadow = '0 0 8px #9C27B0';
  };
  viewBtn.onmouseout = () => {
    viewBtn.style.background = isInViewMode ? '#8e24aa' : '#9C27B0';
    viewBtn.style.boxShadow = isInViewMode ? '0 0 8px #9C27B0' : 'none';
  };
  
  viewBtn.onclick = () => {
    enterColyseusViewMode();
    closeColyseusDialog();
  };
  dialog.appendChild(viewBtn);

  // 断开连接按钮
  const disconnectBtn = document.createElement('button');
  disconnectBtn.textContent = '断开连接';
  disconnectBtn.style.width = '100%';
  disconnectBtn.style.padding = '10px';
  disconnectBtn.style.marginBottom = '10px';
  disconnectBtn.style.background = '#F44336';
  disconnectBtn.style.color = '#fff';
  disconnectBtn.style.border = 'none';
  disconnectBtn.style.borderRadius = '6px';
  disconnectBtn.style.cursor = 'pointer';
  
  disconnectBtn.onmouseover = () => {
    disconnectBtn.style.background = '#d32f2f';
  };
  disconnectBtn.onmouseout = () => {
    disconnectBtn.style.background = '#F44336';
  };
  
  disconnectBtn.onclick = () => {
    disconnectFromColyseus();
    closeColyseusDialog();
  };
  dialog.appendChild(disconnectBtn);

  // 关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.style.width = '100%';
  closeBtn.style.padding = '10px';
  closeBtn.style.background = '#555';
  closeBtn.style.color = '#fff';
  closeBtn.style.border = 'none';
  closeBtn.style.borderRadius = '6px';
  closeBtn.style.cursor = 'pointer';
  
  closeBtn.onmouseover = () => {
    closeBtn.style.background = '#666';
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.background = '#555';
  };
  
  closeBtn.onclick = closeColyseusDialog;
  dialog.appendChild(closeBtn);

  document.body.appendChild(dialog);
}

// 关闭弹窗UI
function closeColyseusDialog() {
  colyseusDialogVisible = false;
  const dialog = document.getElementById('colyseus-slot-dialog');
  if (dialog) dialog.style.display = 'none';
}

// 创建连接信息输入对话框
function createConnectionDialog() {
  // 检查是否已存在
  let dialog = document.getElementById('colyseus-connection-dialog');
  if (dialog) {
    dialog.style.display = 'block';
    return;
  }

  dialog = document.createElement('div');
  dialog.id = 'colyseus-connection-dialog';
  dialog.style.position = 'fixed';
  dialog.style.top = '50%';
  dialog.style.left = '50%';
  dialog.style.transform = 'translate(-50%, -50%)';
  dialog.style.backgroundColor = 'rgba(40, 40, 40, 0.97)';
  dialog.style.padding = '24px 20px 16px 20px';
  dialog.style.borderRadius = '12px';
  dialog.style.boxShadow = '0 0 32px rgba(0,0,0,0.5)';
  dialog.style.zIndex = '9999';
  dialog.style.minWidth = '340px';
  dialog.style.maxWidth = '90vw';
  dialog.style.color = '#fff';
  dialog.style.fontFamily = 'Arial, sans-serif';

  // 标题
  const title = document.createElement('h2');
  title.textContent = '联网协作设置';
  title.style.textAlign = 'center';
  title.style.marginBottom = '20px';
  dialog.appendChild(title);

  // 服务器说明
  const serverInfo = document.createElement('div');
  serverInfo.textContent = '选择一个预设房间名称或直接输入房间名称';
  serverInfo.style.textAlign = 'center';
  serverInfo.style.fontSize = '12px';
  serverInfo.style.marginBottom = '15px';
  serverInfo.style.color = '#aaa';
  dialog.appendChild(serverInfo);

  // 用户名输入
  const usernameLabel = document.createElement('div');
  usernameLabel.textContent = '用户名:';
  usernameLabel.style.marginBottom = '5px';
  dialog.appendChild(usernameLabel);

  const usernameInput = document.createElement('input');
  usernameInput.id = 'colyseus-username-input';
  usernameInput.type = 'text';
  usernameInput.value = colyseusSlotStates.username;
  usernameInput.style.width = '100%';
  usernameInput.style.padding = '8px';
  usernameInput.style.borderRadius = '6px';
  usernameInput.style.border = '1px solid #555';
  usernameInput.style.marginBottom = '15px';
  usernameInput.style.backgroundColor = '#222';
  usernameInput.style.color = '#fff';
  // 阻止键盘事件传播，避免被全局监听器捕获
  usernameInput.addEventListener('keydown', (event) => {
    event.stopPropagation();
  });
  usernameInput.addEventListener('keyup', (event) => {
    event.stopPropagation();
  });
  usernameInput.addEventListener('keypress', (event) => {
    event.stopPropagation();
  });
  dialog.appendChild(usernameInput);

  // 房间名称选择或输入
  const roomLabel = document.createElement('div');
  roomLabel.textContent = '房间名称:';
  roomLabel.style.marginBottom = '5px';
  dialog.appendChild(roomLabel);

  // 创建房间选择下拉菜单
  const roomSelect = document.createElement('select');
  roomSelect.id = 'colyseus-room-select';
  roomSelect.style.width = '100%';
  roomSelect.style.padding = '8px';
  roomSelect.style.borderRadius = '6px';
  roomSelect.style.border = '1px solid #555';
  roomSelect.style.marginBottom = '10px';
  roomSelect.style.backgroundColor = '#222';
  roomSelect.style.color = '#fff';
  
  // 预设房间选项
  const presetRooms = [
    { value: "rhythm_room", label: "默认房间 (rhythm_room)" },
    { value: "custom_room", label: "自定义房间" },
    { value: "music_room", label: "音乐房间" },
    { value: "party_room", label: "派对房间" },
    { value: "jam_room", label: "即兴演奏房间" },
    { value: "band_room", label: "乐队房间" }
  ];
  
  // 添加数字后缀的房间
  for (let i = 1; i <= 10; i++) {
    presetRooms.push({ value: `rhythm_room_${i}`, label: `节奏房间 ${i}` });
  }
  
  // 添加自定义输入选项
  presetRooms.push({ value: "custom", label: "- 输入自定义房间名 -" });
  
  // 添加选项到下拉菜单
  presetRooms.forEach(room => {
    const option = document.createElement('option');
    option.value = room.value;
    option.textContent = room.label;
    roomSelect.appendChild(option);
  });
  
  // 设置默认选中值
  roomSelect.value = "rhythm_room";
  
  // 阻止键盘事件传播
  roomSelect.addEventListener('keydown', (event) => {
    event.stopPropagation();
  });
  
  dialog.appendChild(roomSelect);

  // 自定义房间名输入框（默认隐藏）
  const roomInput = document.createElement('input');
  roomInput.id = 'colyseus-room-input';
  roomInput.type = 'text';
  roomInput.placeholder = '请输入自定义房间名';
  roomInput.value = colyseusRoomName;
  roomInput.style.width = '100%';
  roomInput.style.padding = '8px';
  roomInput.style.borderRadius = '6px';
  roomInput.style.border = '1px solid #555';
  roomInput.style.marginBottom = '20px';
  roomInput.style.backgroundColor = '#222';
  roomInput.style.color = '#fff';
  roomInput.style.display = 'none'; // 默认隐藏
  
  // 阻止键盘事件传播，避免被全局监听器捕获
  roomInput.addEventListener('keydown', (event) => {
    event.stopPropagation();
  });
  roomInput.addEventListener('keyup', (event) => {
    event.stopPropagation();
  });
  roomInput.addEventListener('keypress', (event) => {
    event.stopPropagation();
  });
  dialog.appendChild(roomInput);
  
  // 下拉菜单变化时的处理
  roomSelect.addEventListener('change', () => {
    if (roomSelect.value === 'custom') {
      // 如果选择自定义，显示输入框
      roomInput.style.display = 'block';
      roomInput.focus();
    } else {
      // 否则隐藏输入框
      roomInput.style.display = 'none';
    }
  });

  // 添加对话框整体的点击事件阻止冒泡，防止点击对话框时被背景处理函数捕获
  dialog.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  // 连接按钮
  const connectBtn = document.createElement('button');
  connectBtn.id = 'colyseus-connect-btn';
  connectBtn.textContent = '连接';
  connectBtn.style.width = '100%';
  connectBtn.style.padding = '10px';
  connectBtn.style.marginBottom = '10px';
  connectBtn.style.background = '#4CAF50';
  connectBtn.style.color = '#fff';
  connectBtn.style.border = 'none';
  connectBtn.style.borderRadius = '6px';
  connectBtn.style.cursor = 'pointer';
  connectBtn.onclick = () => {
    const username = document.getElementById('colyseus-username-input').value.trim();
    const roomSelect = document.getElementById('colyseus-room-select');
    const customRoomInput = document.getElementById('colyseus-room-input');
    
    // 确定房间名称
    let roomName;
    if (roomSelect.value === 'custom') {
      roomName = customRoomInput.value.trim();
    } else {
      roomName = roomSelect.value;
    }
    
    if (!username) {
      showCustomMessage('请输入用户名', "warning");
      return;
    }
    
    if (!roomName) {
      showCustomMessage('请选择或输入房间名称', "warning");
      return;
    }
    
    // 更新连接参数
    colyseusSlotStates.username = username;
    colyseusRoomName = roomName;
    
    // 关闭连接对话框
    closeConnectionDialog();
    
    // 连接到服务器，成功后会自动显示插槽选择对话框
    connectToColyseus();
    
    // 移除自动显示插槽选择对话框的逻辑，改为在welcome消息处理时显示
  };
  dialog.appendChild(connectBtn);

  // 取消按钮
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.width = '100%';
  cancelBtn.style.padding = '10px';
  cancelBtn.style.background = '#555';
  cancelBtn.style.color = '#fff';
  cancelBtn.style.border = 'none';
  cancelBtn.style.borderRadius = '6px';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.onclick = closeConnectionDialog;
  dialog.appendChild(cancelBtn);

  document.body.appendChild(dialog);
  
  // 确保输入框获得焦点时，不会被其他事件监听器干扰
  usernameInput.focus();
  setTimeout(() => {
    // 延迟再次聚焦，确保在UI渲染后生效
    usernameInput.focus();
  }, 100);
}

// 关闭连接对话框
function closeConnectionDialog() {
  const dialog = document.getElementById('colyseus-connection-dialog');
  if (dialog) dialog.style.display = 'none';
}

// 添加连接状态显示
function createConnectionStatus() {
  // 检查是否已存在
  let statusElem = document.getElementById('colyseus-connection-status');
  if (statusElem) {
    return statusElem;
  }
  
  // 创建状态显示元素
  statusElem = document.createElement('div');
  statusElem.id = 'colyseus-connection-status';
  statusElem.style.position = 'fixed';
  statusElem.style.bottom = '10px';
  statusElem.style.right = '10px';
  statusElem.style.padding = '5px 10px';
  statusElem.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  statusElem.style.color = '#fff';
  statusElem.style.fontSize = '12px';
  statusElem.style.borderRadius = '4px';
  statusElem.style.zIndex = '9998';
  statusElem.textContent = '未连接';
  
  document.body.appendChild(statusElem);
  return statusElem;
}

// 更新连接状态显示
function updateConnectionStatus(status, details = '') {
  const statusElem = createConnectionStatus();
  
  if (status === 'connecting') {
    statusElem.textContent = '正在连接...';
    statusElem.style.backgroundColor = 'rgba(255, 152, 0, 0.7)';
  } else if (status === 'connected') {
    statusElem.textContent = `已连接 ${details ? '(' + details + ')' : ''}`;
    statusElem.style.backgroundColor = 'rgba(76, 175, 80, 0.7)';
  } else if (status === 'disconnected') {
    statusElem.textContent = '未连接';
    statusElem.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  } else if (status === 'error') {
    statusElem.textContent = `连接错误 ${details ? '(' + details + ')' : ''}`;
    statusElem.style.backgroundColor = 'rgba(244, 67, 54, 0.7)';
  }
}

// 显示用户加入通知
function showUserJoinedNotification(sessionId) {
  // 创建一个临时的通知
  const notification = document.createElement('div');
  notification.style.position = 'fixed';
  notification.style.bottom = '40px';
  notification.style.right = '10px';
  notification.style.padding = '5px 10px';
  notification.style.backgroundColor = 'rgba(76, 175, 80, 0.7)';
  notification.style.color = '#fff';
  notification.style.fontSize = '12px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '9997';
  notification.style.opacity = '1';
  notification.style.transition = 'opacity 0.5s';
  notification.textContent = `新用户加入房间`;
  
  document.body.appendChild(notification);
  
  // 2秒后移除通知
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 500);
  }, 2000);
}

// 显示连接失败，在进度条窗口内显示错误
function showConnectionError(errorMsg) {

  
  // 检查进度条窗口是否存在
  const progressContainer = document.getElementById('colyseus-progress-container');
  if (progressContainer) {
    // 进度条存在，在其中显示错误
    const progressTitle = document.getElementById('colyseus-progress-title');
    if (progressTitle) {
      // 更改标题显示错误
      progressTitle.textContent = '连接失败';
      progressTitle.style.color = '#F44336';
    }
    
    // 更改进度条颜色为红色
    const progressIndicator = document.getElementById('colyseus-progress-indicator');
    if (progressIndicator) {
      progressIndicator.style.width = '100%';
      progressIndicator.style.backgroundColor = '#F44336';
    }
    
    // 更新调试信息区域显示错误
    const debugInfoElem = document.getElementById('colyseus-debug-info');
    if (debugInfoElem) {
      debugInfoElem.innerHTML += `<div style="color:#F44336;font-weight:bold">✗ 连接失败: ${errorMsg || '未知错误'}</div>`;
      debugInfoElem.scrollTop = debugInfoElem.scrollHeight;
    }
    
    // 显示重试按钮
    const retryBtn = document.getElementById('colyseus-retry-button');
    if (retryBtn) {
      retryBtn.style.display = 'inline-block';
      retryBtn.style.backgroundColor = '#F44336';
      retryBtn.style.color = 'white';
    }
    
    // 更改取消按钮为关闭按钮
    const cancelBtn = document.getElementById('colyseus-cancel-button');
    if (cancelBtn) {
      cancelBtn.textContent = '关闭';
      cancelBtn.style.backgroundColor = '#666';
      cancelBtn.style.color = 'white';
      cancelBtn.style.border = 'none';
    }
    
    // 不隐藏进度条窗口，让用户可以看到错误信息
    return;
  }
  
  // 作为备用，如果进度条不存在，则显示一个普通的错误提示
  let errorContainer = document.getElementById('colyseus-error-container');
  if (errorContainer) {
    errorContainer.style.display = 'flex';
    return;
  }
  
  errorContainer = document.createElement('div');
  errorContainer.id = 'colyseus-error-container';
  errorContainer.style.position = 'fixed';
  errorContainer.style.top = '20px';
  errorContainer.style.right = '20px';
  errorContainer.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
  errorContainer.style.color = '#fff';
  errorContainer.style.padding = '15px 20px';
  errorContainer.style.borderRadius = '6px';
  errorContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
  errorContainer.style.zIndex = '9999';
  errorContainer.style.display = 'flex';
  errorContainer.style.flexDirection = 'column';
  errorContainer.style.transition = 'opacity 0.5s';
  
  // 错误消息
  const message = document.createElement('div');
  message.innerHTML = `<strong>连接失败</strong><br/>${errorMsg || '服务器连接出错'}`;
  message.style.marginBottom = '10px';
  
  // 重试按钮
  const retryButton = document.createElement('button');
  retryButton.textContent = '重试连接';
  retryButton.style.padding = '5px 10px';
  retryButton.style.backgroundColor = '#fff';
  retryButton.style.color = '#F44336';
  retryButton.style.border = 'none';
  retryButton.style.borderRadius = '4px';
  retryButton.style.cursor = 'pointer';
  retryButton.style.alignSelf = 'center';
  
  retryButton.onclick = () => {
    // 移除错误提示
    if (errorContainer.parentNode) {
      errorContainer.parentNode.removeChild(errorContainer);
    }
    
    // 如果未超过最大重试次数，重试连接
    if (connectionRetryCount < maxConnectionRetries) {
      connectionRetryCount++;

      connectToColyseus();
    } else {
      showCustomMessage(`已达到最大重试次数(${maxConnectionRetries})，请稍后再试或检查服务器状态。`, "error");
      connectionRetryCount = 0; // 重置计数器
    }
  };
  
  errorContainer.appendChild(message);
  errorContainer.appendChild(retryButton);
  document.body.appendChild(errorContainer);
  
  // 7秒后自动消失
  setTimeout(() => {
    if (errorContainer.parentNode) {
      errorContainer.style.opacity = '0';
      setTimeout(() => {
        if (errorContainer.parentNode) {
          errorContainer.parentNode.removeChild(errorContainer);
        }
      }, 500);
    }
  }, 7000);
}

// 更新房间名称显示
function updateRoomNameDisplay(roomName, connectedClients) {
  if (!roomName) return;
  
  // 更新插槽对话框中的房间名称
  const roomNameElem = document.getElementById('colyseus-room-name-display');
  if (roomNameElem) {
    roomNameElem.textContent = `当前房间: ${roomName} (${connectedClients}人在线)`;
  }
  
  // 更新连接状态
  const statusElem = document.getElementById('colyseus-connection-status');
  if (statusElem) {
    statusElem.textContent = `已连接 (${connectedClients}人在线)`;
  }
}

// 断开连接
function disconnectFromColyseus() {
  if (!colyseusConnected || !colyseusRoom) return;
  
  try {
    // 先释放所有占用的插槽
    if (colyseusSlotStates.mySlot !== -1) {
      colyseusRoom.send("releaseSlot", { slotIndex: colyseusSlotStates.mySlot });
    }
    
    // 离开房间
    colyseusRoom.leave();
    
    // 重置状态
    colyseusRoom = null;
    colyseusConnected = false;
    colyseusSlotStates.mySlot = -1;
    sessionId = null;
    connectionSuccessful = false; // 重置连接成功标志
    
    // 更新连接状态
    updateConnectionStatus('disconnected');
    

  } catch (error) {
    console.error("断开连接时出错:", error);
  }
}

// 添加最激进的步进数据变化监听函数
window.notifyStepChange = function(slotIndex) {
  // 检查权限和连接状态
  if (!colyseusConnected) {

    return false;
  }
  
  if (colyseusSlotStates.mySlot !== slotIndex) {

    return false;
  }
  
  // 减少日志输出

  
  // 立即调用全局同步函数
  return window.syncImmediately(slotIndex);
};

// 添加重连函数
function reconnectIfNeeded() {
  // 如果连接已关闭但状态仍为已连接，尝试重新连接
  if ((!colyseusRoom || !colyseusRoom.connection || !colyseusRoom.connection.isOpen) && colyseusConnected) {

    colyseusConnected = false;
    
    // 等待一段时间后尝试重新连接
    setTimeout(() => {

      connectToColyseus();
    }, 2000);
  }
}

// 注释掉高频同步，改用事件驱动方式
// setInterval(() => {
//   if (colyseusConnected && colyseusSlotStates.mySlot !== -1) {
//     window.syncColyseusData();
//   }
// }, 100); // 每100毫秒同步一次，极致实时性

// 添加自定义消息提示函数，替代alert
function showCustomMessage(message, type = 'info') {
  // 检查是否已存在消息框
  let messageBox = document.getElementById('colyseus-custom-message');
  if (messageBox) {
    // 如果存在，更新它的内容并重新显示
    document.body.removeChild(messageBox);
  }
  
  // 创建消息框
  messageBox = document.createElement('div');
  messageBox.id = 'colyseus-custom-message';
  messageBox.style.position = 'fixed';
  messageBox.style.top = '50%';
  messageBox.style.left = '50%';
  messageBox.style.transform = 'translate(-50%, -50%)';
  messageBox.style.padding = '20px';
  messageBox.style.borderRadius = '8px';
  messageBox.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
  messageBox.style.zIndex = '10001';
  messageBox.style.minWidth = '300px';
  messageBox.style.maxWidth = '80%';
  messageBox.style.textAlign = 'center';
  messageBox.style.fontFamily = 'Arial, sans-serif';
  messageBox.style.transition = 'opacity 0.3s';
  
  // 根据类型设置样式
  if (type === 'error') {
    messageBox.style.backgroundColor = 'rgba(220, 53, 69, 0.95)';
    messageBox.style.color = 'white';
  } else if (type === 'warning') {
    messageBox.style.backgroundColor = 'rgba(255, 193, 7, 0.95)';
    messageBox.style.color = 'black';
  } else {
    messageBox.style.backgroundColor = 'rgba(40, 40, 40, 0.95)';
    messageBox.style.color = 'white';
  }
  
  // 添加消息文本
  const messageText = document.createElement('div');
  messageText.innerHTML = message;
  messageText.style.marginBottom = '15px';
  messageBox.appendChild(messageText);
  
  // 添加关闭按钮
  const closeButton = document.createElement('button');
  closeButton.textContent = '确定';
  closeButton.style.padding = '8px 20px';
  closeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  closeButton.style.color = '#333';
  closeButton.style.border = 'none';
  closeButton.style.borderRadius = '4px';
  closeButton.style.cursor = 'pointer';
  closeButton.onclick = function() {
    messageBox.style.opacity = '0';
    setTimeout(() => {
      if (messageBox.parentNode) {
        messageBox.parentNode.removeChild(messageBox);
      }
    }, 300);
  };
  messageBox.appendChild(closeButton);
  
  // 显示消息框
  document.body.appendChild(messageBox);
  
  // 自动关闭（5秒后）
  setTimeout(() => {
    if (messageBox.parentNode) {
      messageBox.style.opacity = '0';
      setTimeout(() => {
        if (messageBox.parentNode) {
          messageBox.parentNode.removeChild(messageBox);
        }
      }, 300);
    }
  }, 5000);
}
// 新增立即同步函数，确保同步成功
function syncImmediately(slotIndex) {
  // 首先检查权限
  if (colyseusSlotStates.mySlot !== slotIndex) {
    console.warn(`无权同步插槽 ${slotIndex + 1}，当前控制的是插槽 ${colyseusSlotStates.mySlot + 1 || '无'}`);
    return false;
  }
  
  // 如果在总览模式中正在拖拽，跳过同步
  if (window.isDraggingInOverview) {

    return false;
  }
  
  // 100% 优先级实时同步步进数据
  try {
    const preset = window.presetPatterns[slotIndex];
    if (preset) {
      const presetJSON = JSON.stringify(preset);
      
      // 发送关键优先级步进更新消息
      if (colyseusRoom && colyseusRoom.connection && colyseusRoom.connection.isOpen) {
        // 连接检查：确保WebSocket连接正常
        try {
          // 发送同步请求，带上最高优先级标志
          colyseusRoom.send("updatePreset", {
            slotIndex,
            preset: presetJSON,
            priority: "critical", // 使用最高优先级
            timestamp: Date.now(),
            isCritical: true      // 标记为关键数据
          });
          
          // 额外确认消息，确保服务器收到
          colyseusRoom.send("syncNow", { 
            timestamp: Date.now(),
            slotIndex: slotIndex
          });
          
          // 减少日志输出

          
            // 移除重复同步，提高性能
          
          return true; // 同步成功
        } catch (sendError) {
          console.error("发送步进数据时出错:", sendError);
          // 重新连接策略
          reconnectIfNeeded();
          return false;
        }
      } else {
        console.warn(`步进数据同步失败：WebSocket连接已关闭，尝试重新连接...`);
        // 连接已关闭，尝试重新连接
        reconnectIfNeeded();
        return false;
      }
    }
  } catch (error) {
    console.error("极速同步步进数据失败:", error);
    return false;
  }
  
  return false; // 默认返回失败
};

// 将syncImmediately函数暴露到全局作用域，供Sketch.js直接调用
window.syncImmediately = syncImmediately;

// 添加调试信息开关函数
window.toggleColyseusDebug = function() {
  window.debugColyseus = !window.debugColyseus;

  return window.debugColyseus;
};

// 处理初始预设数据
function processInitialPresets(presets) {
  // 预设以对象形式传递，键是插槽索引
  for (const slotIndex in presets) {
    const presetData = presets[slotIndex];
    if (!presetData) continue;
    
    const slotNum = parseInt(slotIndex);
    if (isNaN(slotNum) || slotNum < 0 || slotNum >= 8) continue;
    
    try {
      // 如果当前用户控制此插槽，跳过更新
      if (colyseusSlotStates.mySlot === slotNum) continue;
      
      // 解析预设数据
      const parsedPreset = typeof presetData === 'string' ? 
                           JSON.parse(presetData) : presetData;
      
      // 更新本地预设数据
      if (window.presetPatterns && window.presetPatterns[slotNum]) {
        window.presetPatterns[slotNum] = parsedPreset;

      }
      
      // 如果当前正在查看该预设，立即重新加载
      if (window.ui && window.ui.currentPattern === slotNum) {
        if (window.presetManager && typeof window.presetManager.loadPreset === 'function') {
          window.presetManager.loadPreset(slotNum);

        }
      }
    } catch (e) {
      console.error(`处理插槽 ${slotNum + 1} 的初始预设数据时出错:`, e);
    }
  }
}

// 处理初始合成器参数
function processInitialSynthParams(synthParams) {
  // 合成器参数以对象形式传递，键是插槽索引
  for (const slotIndex in synthParams) {
    const paramsData = synthParams[slotIndex];
    if (!paramsData) continue;
    
    const slotNum = parseInt(slotIndex);
    if (isNaN(slotNum) || slotNum < 0 || slotNum >= 8) continue;
    
    // 如果当前用户控制此插槽，跳过更新
    if (colyseusSlotStates.mySlot === slotNum) continue;
    
    // 使用现有函数同步合成器参数
    syncSynthParamsFromServer(slotNum, paramsData);

  }
}

// 处理初始插槽信息
function processInitialSlots(slots) {
  // 首先重置所有插槽状态
  for (let i = 0; i < 8; i++) {
    colyseusSlotStates.data.slots[i] = null;
    colyseusSlotStates.data.slotNames[i] = null;
  }
  
  if (Array.isArray(slots)) {
    // 如果是数组格式
    for (let i = 0; i < slots.length && i < 8; i++) {
      if (slots[i]) {
        if (typeof slots[i] === 'object') {
          // 如果是包含sessionId的对象
          colyseusSlotStates.data.slots[i] = slots[i].sessionId;
          // 如果有用户名信息，也更新它
          if (slots[i].username) {
            colyseusSlotStates.data.slotNames[i] = slots[i].username;
          }
        } else {
          // 如果直接是sessionId字符串
          colyseusSlotStates.data.slots[i] = slots[i];
        }
      }
    }
  } else {
    // 如果是对象格式，键是插槽索引
    for (const slotIndex in slots) {
      const slotInfo = slots[slotIndex];
      if (!slotInfo) continue;
      
      const slotNum = parseInt(slotIndex);
      if (isNaN(slotNum) || slotNum < 0 || slotNum >= 8) continue;
      
      if (typeof slotInfo === 'object') {
        // 如果是包含sessionId的对象
        colyseusSlotStates.data.slots[slotNum] = slotInfo.sessionId;
        // 如果有用户名信息，也更新它
        if (slotInfo.username) {
          colyseusSlotStates.data.slotNames[slotNum] = slotInfo.username;
        }
      } else {
        // 如果直接是sessionId字符串
        colyseusSlotStates.data.slots[slotNum] = slotInfo;
      }
    }
  }
  
  // 简化日志，仅在调试模式下输出详细信息
  if (window.debugColyseus) {


  }
  
  // 触发事件通知总览视图更新
  const event = new CustomEvent('colyseus-slots-updated', {
    detail: { timestamp: Date.now() }
  });
  window.dispatchEvent(event);
}

// 添加一个函数用于清空插槽步进数据
function clearSlotStepData(slotIndex) {
  if (slotIndex < 0 || slotIndex >= 8) return;
  
  // 清空预设数据
  if (window.presetPatterns && window.presetPatterns[slotIndex]) {
    try {
      // 创建一个空的预设，保留结构但清空实际数据
      const emptyPreset = JSON.parse(JSON.stringify(window.presetPatterns[slotIndex]));
      
      // 清空预设中的节点
      if (emptyPreset.variants) {
        emptyPreset.variants.forEach((variant, variantIndex) => {
          if (variant && variant.length > 0 && variant[0].alpha) {
            // 将所有步骤的alpha值设为0（禁用所有步骤）
            for (let i = 0; i < variant[0].alpha.length; i++) {
              variant[0].alpha[i] = 0;
            }
          }
        });
      }
      
      // 更新预设数据
      window.presetPatterns[slotIndex] = emptyPreset;
      

      
      // 如果当前视图显示的是这个插槽，刷新视图
      if (window.ui && window.ui.currentPattern === slotIndex) {
        if (window.presetManager && typeof window.presetManager.loadPreset === 'function') {
          window.presetManager.loadPreset(slotIndex);
        }
        
        // 触发圆环数据变化事件更新UI
        if (typeof window.triggerCircleDataChange === 'function') {
          window.triggerCircleDataChange();
        }
      }
      
      // 更新总览视图中的圆环数据
      if (window.circleOverview && typeof window.circleOverview.updateSingleSlotData === 'function') {
        window.circleOverview.updateSingleSlotData(slotIndex);
      }
    } catch (error) {
      console.error(`清空插槽 ${slotIndex + 1} 的步进数据时出错:`, error);
    }
  }
}

/**
 * 显示插槽选择对话框
 * 用户需要选择一个插槽才能编辑内容
 */
function showSlotSelectionDialog() {
  if (!colyseusConnected || !colyseusRoom) {
    // 如果未连接，先显示连接对话框
    createConnectionDialog();
    return;
  }

  // 创建或更新插槽选择对话框
  createColyseusDialog();

  // 确保对话框可见
  dialogVisible = true;
  
  // 设置对话框显示标志
  window.slotDialogShown = true;
}

/**
 * 检查用户是否可以编辑特定插槽
 * 此函数与Sketch.js中的canEditSlot函数对应，用于权限检查
 * @param {number} slotIndex - 要检查的插槽索引
 * @returns {boolean} - 是否可以编辑该插槽
 */
function canEditColyseusSlot(slotIndex) {
  // 如果未连接到服务器，默认可编辑
  if (!colyseusConnected || !colyseusRoom) {
    return true;
  }
  
  // 检查是否处于观看模式
  if (colyseusSlotStates.mySlot === -1) {
    return false;
  }
  
  // 检查插槽是否为当前用户控制的插槽
  return slotIndex === colyseusSlotStates.mySlot;
}

/**
 * 设置观看模式，不控制任何插槽
 */
function setColyseusViewOnlyMode() {
  // 重置插槽对话框显示标志，允许下次点击时再次显示
  window.slotDialogShown = false;
  return enterColyseusViewMode();
}

// 暴露函数到全局作用域，供Sketch.js调用
window.showSlotSelectionDialog = showSlotSelectionDialog;
window.canEditColyseusSlot = canEditColyseusSlot;
window.setColyseusViewOnlyMode = setColyseusViewOnlyMode;

// 将Colyseus状态同步到PresetManager
function syncColyseusStateToPresetManager() {
  if (!window.presetManager) return;
  
  // 同步控制的插槽索引
  window.presetManager.controlledSlotIndex = colyseusSlotStates.mySlot;
  
  // 同步观看模式状态
  window.presetManager.isViewOnlyMode = colyseusSlotStates.mySlot === -1;
  
  // 同步用户ID
  window.presetManager.myUserId = sessionId;
  
  // 同步插槽所有者信息
  if (!window.presetManager.slotOwners) {
    window.presetManager.slotOwners = {};
  }
  
  // 将服务器的插槽状态同步到预设管理器
  for (let slotIndex = 0; slotIndex < 8; slotIndex++) {
    if (colyseusSlotStates.data.slots[slotIndex]) {
      window.presetManager.slotOwners[slotIndex] = colyseusSlotStates.data.slots[slotIndex];
    } else {
      delete window.presetManager.slotOwners[slotIndex];
    }
  }
  
  // 同步全局变量以保持一致性
  window.isViewOnlyMode = window.presetManager.isViewOnlyMode;
  window.controlledSlotIndex = window.presetManager.controlledSlotIndex;
  window.slotOwners = {...window.presetManager.slotOwners};
  window.myUserId = sessionId;
  
  // 设置全局连接状态标志
  window.colyseusConnected = colyseusConnected;
}

// 在收到服务器状态更新时同步到PresetManager
function handleServerStateUpdate() {
  syncColyseusStateToPresetManager();
  
  // 更新UI界面
  if (typeof updateUIPositions === 'function') {
    updateUIPositions();
  }
  
  // 重绘界面
  if (typeof redraw === 'function') {
    redraw();
  }
}

/**
 * 检查用户是否有权限进行点击交互
 * 
 * 检查逻辑：
 * 1. 如果未连接到Colyseus，允许所有点击
 * 2. 如果已连接并选择了插槽，检查当前操作的插槽是否为用户控制的插槽
 * 3. 如果已连接但未选择插槽，只允许点击UI元素和连接按钮
 * 
 * @param {number} x - 鼠标X坐标
 * @param {number} y - 鼠标Y坐标
 * @returns {boolean} - 是否允许点击
 */
function isUserAllowedToClick(x, y) {
  // 如果未连接到Colyseus服务器，允许点击
  if (!colyseusConnected || !colyseusRoom) {
    return true;
  }
  
  // 检查是否点击了连接按钮（始终允许）
  const connectButton = document.getElementById('colyseus-connect-button');
  if (connectButton) {
    const rect = connectButton.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return true;
    }
  }
  
  // 检查是否正在显示插槽选择对话框（始终允许）
  if (dialogVisible) {
    return true;
  }
  
  // 如果已选择插槽，检查当前UI操作是否在用户的插槽上
  if (colyseusSlotStates.mySlot !== -1) {
    // 检查是否在操作模式选择器按钮
    if (window.ui && window.ui.patternSelector && window.ui.patternSelector.buttons) {
      for (let i = 0; i < window.ui.patternSelector.buttons.length; i++) {
        let button = window.ui.patternSelector.buttons[i];
        if (x >= button.x && x <= button.x + button.w &&
            y >= button.y && y <= button.y + button.h) {
          // 如果点击的是模式选择器按钮，检查是否是用户的插槽
          return i === colyseusSlotStates.mySlot;
        }
      }
    }
    
    // 检查是否点击了步进器
    if (window.ui && window.ui.centerX && window.ui.centerY) {
      const distToCenter = Math.sqrt(Math.pow(x - window.ui.centerX, 2) + Math.pow(y - window.ui.centerY, 2));
      
      // 如果点击在步进器范围内，只有当前显示的是用户插槽时才允许
      if (distToCenter <= window.ui.stepRadius && distToCenter >= window.ui.innerRadius) {
        return window.ui.currentPattern === colyseusSlotStates.mySlot;
      }
    }
    
    // 检查是否点击了变体选择器
    if (window.ui && window.ui.variantSelector) {
      // 检查变体按钮
      const buttons = window.ui.variantSelector.buttons;
      if (buttons) {
        for (let i = 0; i < buttons.length; i++) {
          const button = buttons[i];
          if (x >= button.x && x <= button.x + button.w &&
              y >= button.y && y <= button.y + button.h) {
            return window.ui.currentPattern === colyseusSlotStates.mySlot;
          }
        }
      }
      
      // 检查添加变体按钮
      if (window.ui.variantSelector.addButton) {
        const addButton = window.ui.variantSelector.addButton;
        if (x >= addButton.x && x <= addButton.x + addButton.w &&
            y >= addButton.y && y <= addButton.y + addButton.h) {
          return window.ui.currentPattern === colyseusSlotStates.mySlot;
        }
      }
    }
    
    // 允许其他UI元素的点击
    return true;
  }
  
  // 如果用户未选择插槽，只允许点击UI控件，不允许点击步进器或预设
  if (window.ui && window.ui.centerX && window.ui.centerY && window.ui.stepRadius) {
    const distToCenter = Math.sqrt(Math.pow(x - window.ui.centerX, 2) + Math.pow(y - window.ui.centerY, 2));
    
    // 不允许点击步进器和周围区域
    if (distToCenter <= window.ui.stepRadius + 30) {
      return false;
    }
    
    // 不允许点击模式选择器
    if (window.ui.patternSelector && window.ui.patternSelector.buttons) {
      for (let i = 0; i < window.ui.patternSelector.buttons.length; i++) {
        let button = window.ui.patternSelector.buttons[i];
        if (x >= button.x && x <= button.x + button.w &&
            y >= button.y && y <= button.y + button.h) {
          return false;
        }
      }
    }
  }
  
  // 默认允许点击其他UI元素
  return true;
}

// 暴露函数到全局作用域，供Sketch.js调用
window.isUserAllowedToClick = isUserAllowedToClick;

// 将插槽状态暴露给全局作用域，以便其他文件可以访问
window.colyseusSlotStates = colyseusSlotStates;

// 用于控制插槽选择对话框显示的标志
window.slotDialogShown = false;

// 同步八度信息到服务器
function syncBaseNoteToServer(slotIndex, baseNote) {
  if (!colyseusConnected || !colyseusRoom) {
    console.warn("未连接到Colyseus服务器，无法同步八度信息");
    return false;
  }
  
  // 严格检查当前用户是否有权限同步该插槽
  if (colyseusSlotStates.mySlot !== slotIndex) {
    console.warn(`无权同步插槽 ${slotIndex + 1} 的八度信息，当前控制的是插槽 ${colyseusSlotStates.mySlot + 1 || '无'}`);
    return false;
  }
  
  try {
    // 发送八度信息到服务器
    colyseusRoom.send("updateBaseNote", {
      slotIndex,
      baseNote,
      timestamp: Date.now()
    });
    
    console.log(`已同步插槽 ${slotIndex + 1} 的八度信息到服务器: ${baseNote}`);
    return true;
  } catch (error) {
    console.error("发送八度信息到服务器时出错:", error);
    return false;
  }
}

// 从服务器同步八度信息
function syncBaseNoteFromServer(slotIndex, baseNote) {
  // 如果当前用户控制这个插槽，不从服务器更新
  if (colyseusSlotStates.mySlot === slotIndex) return;
  
  try {
    // 更新本地的八度信息
    if (window.metronome && window.metronome.baseNotes) {
      window.metronome.baseNotes[slotIndex] = baseNote;
      console.log(`已从服务器同步插槽 ${slotIndex + 1} 的八度信息: ${baseNote}`);
      
      // 如果当前正在查看此插槽，更新UI显示
      if (window.ui && window.ui.currentPattern === slotIndex) {
        // 触发UI更新
        if (typeof window.redraw === 'function') {
          window.redraw();
        }
      }
    }
  } catch (e) {
    console.error("应用八度信息时出错:", e);
  }
}

// 更新八度信息
function updateBaseNotesFromState(baseNotes) {
  if (!baseNotes) return;
  
  // 更新所有有数据的八度信息
  for (const slotIndex in baseNotes) {
    const baseNote = baseNotes[slotIndex];
    if (!baseNote) continue;
    
    const slotNum = parseInt(slotIndex);
    if (isNaN(slotNum) || slotNum < 0 || slotNum >= 8) continue;
    
    // 如果当前用户控制此插槽，跳过更新
    if (colyseusSlotStates.mySlot === slotNum) continue;
    
    // 使用现有函数同步八度信息
    syncBaseNoteFromServer(slotNum, baseNote);
    console.log(`已更新插槽 ${slotNum + 1} 的八度信息: ${baseNote}`);
  }
}

// 更新BPM

// 处理初始八度信息
function processInitialBaseNotes(baseNotes) {
  // 八度信息以对象形式传递，键是插槽索引
  for (const slotIndex in baseNotes) {
    const baseNote = baseNotes[slotIndex];
    if (!baseNote) continue;
    
    const slotNum = parseInt(slotIndex);
    if (isNaN(slotNum) || slotNum < 0 || slotNum >= 8) continue;
    
    // 如果当前用户控制此插槽，跳过更新
    if (colyseusSlotStates.mySlot === slotNum) continue;
    
    // 使用现有函数同步八度信息
    syncBaseNoteFromServer(slotNum, baseNote);
    console.log(`已处理插槽 ${slotNum + 1} 的初始八度信息: ${baseNote}`);
  }
}

// 将八度信息同步函数暴露到全局作用域（使用节流版本，100ms）
window.syncBaseNoteToServer = throttledSyncBaseNote;

// 将插槽状态暴露给全局作用域，以便其他文件可以访问
window.colyseusSlotStates = colyseusSlotStates;

