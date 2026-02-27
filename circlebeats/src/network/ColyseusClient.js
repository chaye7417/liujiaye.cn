/**
 * ColyseusClient.js - 连接管理
 * 包含WebSocket连接、重连逻辑、心跳、房间状态监听器设置
 */

import {
  colyseusClient, colyseusRoom, colyseusConnected, colyseusRoomName,
  colyseusServerUrl, colyseusSlotStates, sessionId,
  isConnecting, connectionSuccessful, connectionRetryCount,
  setColyseusClient, setColyseusRoom, setColyseusConnected,
  setSessionId, setIsConnecting, setConnectionSuccessful
} from './NetworkState.js';

import {
  showConnectionProgress, hideConnectionProgress, showConnectionSuccess,
  showConnectionError, createConnectionStatus, updateConnectionStatus,
  showNotification, showCustomMessage, showUserJoinedNotification,
  updateRoomNameDisplay
} from './ColyseusNotifications.js';

import {
  showColyseusDialog, createConnectionDialog
} from './ColyseusDialogs.js';

import {
  updateSlotsFromState, processInitialSlots, handleServerStateUpdate,
  clearSlotStepData
} from './SlotSync.js';

import {
  updatePresetsFromState, updateSynthParamsFromState, updateBpmFromState,
  syncPresetToServer, syncSynthParamsFromServer, syncBaseNoteFromServer,
  processInitialPresets, processInitialSynthParams, processInitialBaseNotes,
  updateBaseNotesFromState, checkAndSyncCircleData, syncAllSynthParamsToServer,
  syncBpmToServer
} from './ParamsSync.js';

// ---- 连接按钮设置 ----

/**
 * 设置连接按钮
 */
export function setupConnectionButton() {
  const connectButton = document.getElementById('colyseus-connect-button');
  if (!connectButton) return;
  const newButton = connectButton.cloneNode(true);
  if (connectButton.parentNode) {
    connectButton.parentNode.replaceChild(newButton, connectButton);
  }
  newButton.addEventListener('click', () => {
    if (colyseusConnected && colyseusRoom) {
      showColyseusDialog();
    } else {
      createConnectionDialog();
    }
  });
}

// ---- 连接到Colyseus服务器 ----

/**
 * 连接到Colyseus服务器
 */
export function connectToColyseus() {
  if (isConnecting) return;
  if (colyseusConnected && colyseusRoom) return;

  setIsConnecting(true);
  createConnectionStatus();
  updateConnectionStatus('connecting');
  showConnectionProgress();

  try {
    setConnectionSuccessful(false);

    if (typeof Colyseus === 'undefined') {
      console.error("Colyseus客户端库未加载！");
      updateConnectionStatus('error', 'Colyseus客户端库未加载');
      showConnectionError('Colyseus客户端库未加载，请刷新页面重试');
      setIsConnecting(false);
      return;
    }

    setColyseusClient(new Colyseus.Client(colyseusServerUrl));

    const options = {
      username: colyseusSlotStates.username || "用户" + Math.floor(Math.random() * 1000),
      roomName: colyseusRoomName
    };

    const connectionTimeout = setTimeout(() => {
      console.error("连接超时!");
      if (!colyseusConnected) {
        setConnectionSuccessful(false);
        updateConnectionStatus('error', '连接超时');
        showConnectionError('服务器连接超时，请检查服务器状态或网络连接');
        setIsConnecting(false);
      }
    }, 10000);

    const debugInfo = document.getElementById('colyseus-debug-info');
    if (debugInfo) {
      debugInfo.innerHTML += '<div>正在连接到服务器...</div>';
    }

    // 注意：这里需要使用模块作用域的 colyseusClient 变量的最新值
    // 由于 setColyseusClient 已经更新了模块变量，需要重新获取
    const client = new Colyseus.Client(colyseusServerUrl);
    setColyseusClient(client);

    client.joinOrCreate(colyseusRoomName, options)
      .then(room => {
        clearTimeout(connectionTimeout);

        try {
          if (debugInfo) {
            debugInfo.innerHTML += '<div>已获取房间对象，检查WebSocket连接...</div>';
          }

          // 监听底层WebSocket
          try {
            const rawWs = room.connection.transport.ws;
            rawWs.addEventListener('message', (event) => {
              try {
                if (typeof event.data === 'string') {
                  const data = JSON.parse(event.data);
                  if (data.type && (data.type === "welcome" || data.type === "connection_success")) {
                    processWelcomeMessage(data.data || data);
                  }
                }
              } catch (e) {
                // 解析失败，静默处理
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

          setColyseusRoom(room);
          setColyseusConnected(true);
          setSessionId(room.sessionId);
          colyseusSlotStates.currentSessionId = room.sessionId;

          updateConnectionStatus('connected');

          if (debugInfo) {
            debugInfo.innerHTML += '<div>已连接，等待欢迎消息...</div>';
          }

          // 等待welcome消息
          const welcomeMessagePromise = new Promise((resolve, reject) => {
            const messageHandler = (type, message) => {
              if (type === "welcome" || type === "connection_success") {
                resolve(message);
                room.onMessage.remove(messageHandler);
              }
            };
            room.onMessage("*", messageHandler);
            room.onMessage("welcome", (message) => {
              processWelcomeMessage(message);
              resolve(message);
            });
            room.onMessage("connection_success", (message) => {
              processWelcomeMessage(message);
              resolve(message);
            });
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

          welcomeMessagePromise.then(welcomeMessage => {
            hideConnectionProgress();
            showConnectionSuccess();
            setupRoomStateListeners(room);

            setTimeout(() => {
              if (room.connection && room.connection.isOpen) {
                room.send("heartbeat_response", {
                  clientTime: Date.now(),
                  serverTime: Date.now()
                });
                if (debugInfo) {
                  debugInfo.innerHTML += '<div>已发送心跳测试消息</div>';
                }
              }
            }, 1000);

            setTimeout(() => {
              if (colyseusConnected && colyseusRoom) {
                colyseusRoom.send("requestInitialState");
              }
            }, 3000);
          });
        } catch (setupError) {
          console.error("设置房间监听器时出错:", setupError);
          hideConnectionProgress();
          updateConnectionStatus('error', '监听器设置失败');
          showConnectionError('监听器设置失败: ' + setupError.message);

          if (debugInfo) {
            debugInfo.innerHTML += `<div style="color:red">设置监听器错误: ${setupError.message}</div>`;
          }

          if (room) {
            try { room.leave(); } catch (e) {
              console.warn("尝试断开连接时出错:", e);
            }
          }
        }
      })
      .catch(e => {
        clearTimeout(connectionTimeout);
        setConnectionSuccessful(false);
        console.error("连接到Colyseus服务器失败:", e);
        updateConnectionStatus('error', e.message || '服务器连接失败');
        showConnectionError(e.message || '无法连接到服务器');

        if (debugInfo) {
          debugInfo.innerHTML += `<div style="color:red">连接失败: ${e.message}</div>`;
        }
      })
      .finally(() => {
        setIsConnecting(false);
      });
  } catch (error) {
    console.error("创建Colyseus客户端时出错:", error);
    setConnectionSuccessful(false);
    updateConnectionStatus('error', error.message || '客户端创建失败');
    showConnectionError(error.message || 'Colyseus客户端创建失败');
    setIsConnecting(false);
  }
}

// ---- 欢迎消息处理 ----

/**
 * 处理欢迎消息
 * @param {object} message - 欢迎消息数据
 */
export function processWelcomeMessage(message) {
  const debugInfo = document.getElementById('colyseus-debug-info');
  if (debugInfo) {
    debugInfo.innerHTML += `<div>收到欢迎消息: ${JSON.stringify(message).substring(0, 50)}...</div>`;
  }

  hideConnectionProgress();

  if (message.success && message.status === "connected") {
    setConnectionSuccessful(true);
    showConnectionSuccess();
    updateConnectionStatus('connected', `${message.connectedClients}人在线`);

    if (message.roomName) {
      window.colyseusWelcomeRoomName = message.roomName;
      updateRoomNameDisplay(message.roomName, message.connectedClients);

      setTimeout(() => {
        if (connectionSuccessful) {
          showColyseusDialog();
        }
      }, 500);
    }
  } else {
    showConnectionError("服务器响应格式不正确，请重试连接");
    updateConnectionStatus('error', '服务器响应格式不正确');
  }
}

// ---- 房间状态监听器 ----

/**
 * 设置房间状态变化监听器
 * @param {object} room - Colyseus房间对象
 */
export function setupRoomStateListeners(room) {
  if (!room) {
    console.error("setupRoomStateListeners: room对象为空");
    return;
  }

  try {
    // 监听离开事件
    room.onLeave((code) => {
      setColyseusConnected(false);
      setColyseusRoom(null);
      colyseusSlotStates.mySlot = -1;
      setSessionId(null);
      setConnectionSuccessful(false);
      hideConnectionProgress();
      updateConnectionStatus('disconnected');

      if (code === 1000) {
        showNotification("已断开连接", "normal");
      } else {
        showNotification(`连接已断开 (代码: ${code})`, "error");
        if (code === 4000) {
          showCustomMessage("你已被踢出房间或房间已关闭。", "error");
        }
      }
    });

    // 监听连接错误
    room.onError((code, message) => {
      console.error(`房间错误: ${code} - ${message}`);
      setConnectionSuccessful(false);
      hideConnectionProgress();
      updateConnectionStatus('error', message);
      showConnectionError(message || `连接错误 (${code})`);
    });

    // 首次获取完整状态
    room.onStateChange.once((state) => {
      hideConnectionProgress();
      if (state.roomName) {
        window.colyseusWelcomeRoomName = state.roomName;
        updateRoomNameDisplay(state.roomName, room.clients?.length || 1);
      }
      try {
        initializeFromState(state);
      } catch (initError) {
        console.error("初始化状态时出错:", initError);
      }
    });

    // 持续监听状态变化
    room.onStateChange((state) => {
      try {
        if (state.slots) updateSlotsFromState(state.slots);
        if (state.presets) updatePresetsFromState(state.presets);
        if (state.synthParams) updateSynthParamsFromState(state.synthParams);
        if (state.bpm !== undefined) updateBpmFromState(state.bpm);
        handleServerStateUpdate();
      } catch (updateError) {
        console.error("处理状态更新时出错:", updateError);
      }
    });

    // 心跳消息
    room.onMessage("heartbeat", (message) => {
      if (message.timestamp) {
        const latency = Date.now() - message.timestamp;
        const statusElem = document.getElementById('colyseus-connection-status');
        if (statusElem) {
          const currentText = statusElem.textContent;
          if (currentText.includes('已连接')) {
            statusElem.textContent = `已连接 (延迟: ${latency}ms)`;
          }
        }
      }
      room.send("heartbeat_response", {
        clientTime: Date.now(),
        serverTime: message.timestamp
      });
      if (message.clientCount !== undefined) {
        const statusElem = document.getElementById('colyseus-connection-status');
        if (statusElem) {
          statusElem.textContent = `已连接 (${message.clientCount}人在线)`;
        }
      }
    });

    // 房间状态响应
    room.onMessage("roomState", (state) => {
      console.log("收到房间状态响应:", state);
      try {
        if (state.slots) updateSlotsFromState(state.slots);
        if (state.presets) updatePresetsFromState(state.presets);
        if (state.synthParams) updateSynthParamsFromState(state.synthParams);
        if (state.baseNotes) updateBaseNotesFromState(state.baseNotes);
        if (state.bpm !== undefined) updateBpmFromState(state.bpm);
        showNotification("已更新房间状态", "success");
      } catch (e) {
        console.error("处理房间状态响应时出错:", e);
      }
    });

    // 插槽信息更新
    room.onMessage("slotsInfoUpdated", (message) => {
      try {
        if (message.slots) {
          updateSlotsFromState(message.slots);

          if (message.releasedSlots && Array.isArray(message.releasedSlots) && message.releasedSlots.length > 0) {
            message.releasedSlots.forEach(slotIndex => {
              clearSlotStepData(slotIndex);
            });
          }

          const event = new CustomEvent('colyseus-slots-updated', {
            detail: {
              timestamp: message.timestamp,
              releasedSlots: message.releasedSlots || []
            }
          });
          window.dispatchEvent(event);

          if (window.circleOverview && typeof window.circleOverview.refresh === 'function') {
            window.circleOverview.refresh();
          }
        }
      } catch (e) {
        console.error("处理插槽信息更新消息时出错:", e);
      }
    });

    // 欢迎/连接成功消息
    room.onMessage("welcome", (message) => { processWelcomeMessage(message); });
    room.onMessage("connection_success", (message) => { processWelcomeMessage(message); });

    // 初始化数据
    room.onMessage("room_initial_state", (data) => {
      try {
        if (data.presets) processInitialPresets(data.presets);
        if (data.synthParams) processInitialSynthParams(data.synthParams);
        if (data.baseNotes) processInitialBaseNotes(data.baseNotes);
        if (data.slots) processInitialSlots(data.slots);
        if (data.bpm) updateBpmFromState(data.bpm);

        if (typeof window.triggerCircleDataChange === 'function') {
          setTimeout(() => { window.triggerCircleDataChange(); }, 500);
        }
        if (window.circleOverview && typeof window.circleOverview.refresh === 'function') {
          setTimeout(() => { window.circleOverview.refresh(); }, 1000);
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

    // 用户加入/离开
    room.onMessage("userJoined", (message) => {
      updateRoomNameDisplay(window.colyseusWelcomeRoomName, message.connectedClients);
      if (window.showNotifications) {
        showUserJoinedNotification(message.sessionId);
      }
    });
    room.onMessage("userLeft", (message) => {
      updateRoomNameDisplay(window.colyseusWelcomeRoomName, message.connectedClients);
      if (message.releasedSlots && Array.isArray(message.releasedSlots)) {
        message.releasedSlots.forEach(slotIndex => {
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

    // 预设更新
    room.onMessage("presetUpdated", (message) => {
      const { slotIndex, timestamp, priority, preset, cleared } = message;
      if (colyseusSlotStates.mySlot !== slotIndex) {
        try {
          if (cleared || (preset && preset === "")) {
            clearSlotStepData(slotIndex);
            return;
          }
          const presetData = preset || (room.state && room.state.presets && room.state.presets[slotIndex]);
          if (presetData) {
            const parsedPreset = typeof presetData === 'string' ?
                                JSON.parse(presetData) : presetData;
            if (window.presetPatterns && window.presetPatterns[slotIndex]) {
              window.presetPatterns[slotIndex] = parsedPreset;
              if (window.ui && window.ui.currentPattern === slotIndex) {
                if (window.presetManager && typeof window.presetManager.loadPreset === 'function') {
                  window.presetManager.loadPreset(slotIndex);
                }
              }
              if (typeof window.triggerCircleDataChange === 'function') {
                window.triggerCircleDataChange();
              }
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

    // 强制UI更新
    room.onMessage("forceUIUpdate", (message) => {
      const { slotIndex } = message;
      if (typeof window.triggerCircleDataChange === 'function') {
        window.triggerCircleDataChange();
      }
      if (window.ui && window.ui.currentPattern === slotIndex) {
        if (window.presetManager && typeof window.presetManager.loadPreset === 'function') {
          window.presetManager.loadPreset(slotIndex);
        }
      }
    });

    // 同步响应
    room.onMessage("syncNowResponse", (message) => {});

    // 状态强制同步请求
    room.onMessage("stateSyncRequired", (message) => {
      if (colyseusConnected && colyseusSlotStates.mySlot !== -1) {
        window.syncColyseusData();
        if (window.ui && window.ui.currentPattern === colyseusSlotStates.mySlot) {
          if (typeof window.triggerCircleDataChange === 'function') {
            window.triggerCircleDataChange();
          }
        }
      }
    });

    // 八度信息更新
    room.onMessage("baseNoteUpdated", (message) => {
      const { slotIndex, baseNote, timestamp } = message;
      console.log(`收到插槽 ${slotIndex + 1} 的八度信息更新: ${baseNote}`);
      try {
        syncBaseNoteFromServer(slotIndex, baseNote);
        if (typeof window.triggerCircleDataChange === 'function') {
          setTimeout(() => { window.triggerCircleDataChange(); }, 100);
        }
      } catch (e) {
        console.error("处理八度信息更新时出错:", e);
      }
    });

    // 合成器参数更新
    room.onMessage("synthParamsUpdated", (message) => {
      const { slotIndex, params, timestamp } = message;
      console.log(`收到插槽 ${slotIndex + 1} 的合成器参数更新`);
      try {
        if (colyseusSlotStates.mySlot !== slotIndex) {
          syncSynthParamsFromServer(slotIndex, params);
          console.log(`已同步插槽 ${slotIndex + 1} 的合成器参数`);
        }
      } catch (e) {
        console.error("处理合成器参数更新时出错:", e);
      }
    });

  } catch (error) {
    console.error("设置房间监听器时出错:", error);
    hideConnectionProgress();
  }
}

// ---- 初始化 ----

/**
 * 从初始状态初始化数据
 * @param {object} state - 房间状态
 */
export function initializeFromState(state) {
  if (!state) return;

  try {
    if (state.slots) processInitialSlots(state.slots);
    if (state.presets) processInitialPresets(state.presets);
    if (state.synthParams) processInitialSynthParams(state.synthParams);
    if (state.bpm !== undefined) updateBpmFromState(state.bpm);
    handleServerStateUpdate();
  } catch (error) {
    console.error("初始化状态时出错:", error);
  }
}

// ---- 断开连接 ----

/**
 * 断开连接
 */
export function disconnectFromColyseus() {
  if (!colyseusConnected || !colyseusRoom) return;

  try {
    if (colyseusSlotStates.mySlot !== -1) {
      colyseusRoom.send("releaseSlot", { slotIndex: colyseusSlotStates.mySlot });
    }
    colyseusRoom.leave();
    setColyseusRoom(null);
    setColyseusConnected(false);
    colyseusSlotStates.mySlot = -1;
    setSessionId(null);
    setConnectionSuccessful(false);
    updateConnectionStatus('disconnected');
  } catch (error) {
    console.error("断开连接时出错:", error);
  }
}

// ---- 重连 ----

/**
 * 重连函数
 */
export function reconnectIfNeeded() {
  if ((!colyseusRoom || !colyseusRoom.connection || !colyseusRoom.connection.isOpen) && colyseusConnected) {
    setColyseusConnected(false);
    setTimeout(() => {
      connectToColyseus();
    }, 2000);
  }
}
