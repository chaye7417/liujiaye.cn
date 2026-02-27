/**
 * src/network/index.js - 网络模块桶文件
 * 汇总导出所有网络模块，并将必要的函数和状态挂载到 window 对象
 */

// ---- 导入所有模块 ----
import { throttle } from './NetworkUtils.js';

import {
  colyseusSlotStates, colyseusConnected, colyseusRoom,
  colyseusRoomName, sessionId, dialogVisible,
  setColyseusRoomName
} from './NetworkState.js';

import {
  connectToColyseus, disconnectFromColyseus,
  setupConnectionButton, reconnectIfNeeded
} from './ColyseusClient.js';

import {
  selectColyseusSlot, enterColyseusViewMode,
  showSlotSelectionDialog, canEditColyseusSlot,
  setColyseusViewOnlyMode, isUserAllowedToClick,
  handleServerStateUpdate, clearSlotStepData
} from './SlotSync.js';

import {
  syncSynthParamsToServer, syncAllSynthParamsToServer,
  syncBpmToServer, syncPresetToServer,
  syncBaseNoteToServer, syncImmediately,
  checkAndSyncCircleData
} from './ParamsSync.js';

import {
  showColyseusDialog, createConnectionDialog
} from './ColyseusDialogs.js';

import {
  showNotification, showCustomMessage
} from './ColyseusNotifications.js';

// ---- 创建节流后的同步函数 ----
const throttledSyncSynthParams = throttle((slotIndex, params) => {
  syncSynthParamsToServer(slotIndex, params);
}, 100);

const throttledSyncAllSynthParams = throttle(() => {
  syncAllSynthParamsToServer();
}, 100);

const throttledSyncBpm = throttle((bpm) => {
  syncBpmToServer(bpm);
}, 200);

const throttledSyncBaseNote = throttle((slotIndex, baseNote) => {
  syncBaseNoteToServer(slotIndex, baseNote);
}, 100);

// ---- 全局同步函数 ----

/**
 * 触发Colyseus数据同步
 */
function syncColyseusData() {
  if (!colyseusConnected || !colyseusRoom || !colyseusRoom.connection || !colyseusRoom.connection.isOpen) {
    if (colyseusConnected) {
      console.warn("同步数据时检测到WebSocket连接已关闭，尝试重置连接状态");
      reconnectIfNeeded();
    }
    return;
  }

  try {
    checkAndSyncCircleData();

    if (window.synthPresetManager && colyseusSlotStates.mySlot !== -1) {
      syncAllSynthParamsToServer();
    }

    if (window.metronome && colyseusSlotStates.mySlot !== -1) {
      syncBpmToServer(window.metronome.bpm);
    }
  } catch (syncError) {
    console.error("同步数据时出错:", syncError);
    if (syncError.message && (syncError.message.includes("WebSocket") || syncError.message.includes("connection"))) {
      reconnectIfNeeded();
    }
  }
}

// ---- 页面加载初始化 ----
window.addEventListener('load', () => {
  // 监听合成器参数变化（节流100ms）
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

  // 设置连接按钮
  setupConnectionButton();
});

// ---- 圆环数据变化监听（防抖300ms） ----
let circleDataChangeDebounceTimer = null;
window.addEventListener('circle-data-change', (event) => {
  if (circleDataChangeDebounceTimer) {
    clearTimeout(circleDataChangeDebounceTimer);
  }
  circleDataChangeDebounceTimer = setTimeout(() => {
    syncColyseusData();
    circleDataChangeDebounceTimer = null;
  }, 300);
});

// ---- BPM变化事件监听 ----
window.addEventListener('bpm-change', (event) => {
  if (!event.detail || !event.detail.bpm) return;
  if (colyseusConnected && colyseusSlotStates.mySlot !== -1) {
    throttledSyncBpm(event.detail.bpm);
  }
});

// ---- 页面卸载时断开连接 ----
window.addEventListener('beforeunload', () => {
  if (colyseusConnected && colyseusRoom) {
    colyseusRoom.leave();
  }
});

// ---- 定期同步（每30秒） ----
setInterval(() => {
  if (colyseusConnected && colyseusSlotStates.mySlot !== -1) {
    syncColyseusData();
  }
}, 30000);

// ---- 挂载到 window 对象 ----

// 连接管理
window.connectToColyseus = connectToColyseus;
window.disconnectFromColyseus = disconnectFromColyseus;
window.reconnectIfNeeded = reconnectIfNeeded;

// 插槽管理
window.selectColyseusSlot = selectColyseusSlot;
window.enterColyseusViewMode = enterColyseusViewMode;
window.showSlotSelectionDialog = showSlotSelectionDialog;
window.canEditColyseusSlot = canEditColyseusSlot;
window.setColyseusViewOnlyMode = setColyseusViewOnlyMode;
window.isUserAllowedToClick = isUserAllowedToClick;

// 同步函数
window.syncColyseusData = syncColyseusData;
window.syncImmediately = syncImmediately;
window.syncBaseNoteToServer = throttledSyncBaseNote;

// 步进变化通知
window.notifyStepChange = function(slotIndex) {
  if (!colyseusConnected) return false;
  if (colyseusSlotStates.mySlot !== slotIndex) return false;
  return syncImmediately(slotIndex);
};

// 调试
window.toggleColyseusDebug = function() {
  window.debugColyseus = !window.debugColyseus;
  return window.debugColyseus;
};

// 状态对象
window.colyseusSlotStates = colyseusSlotStates;
window.slotDialogShown = false;

// UI函数（供ColyseusUI.js内部按钮事件使用）
window._showColyseusDialog = showColyseusDialog;
window._createConnectionDialog = createConnectionDialog;

// ---- 导出 ----
export {
  // NetworkUtils
  throttle,
  // ColyseusClient
  connectToColyseus, disconnectFromColyseus, reconnectIfNeeded,
  // SlotSync
  selectColyseusSlot, enterColyseusViewMode,
  showSlotSelectionDialog, canEditColyseusSlot,
  setColyseusViewOnlyMode, isUserAllowedToClick,
  handleServerStateUpdate, clearSlotStepData,
  // ParamsSync
  syncSynthParamsToServer, syncAllSynthParamsToServer,
  syncBpmToServer, syncPresetToServer,
  syncBaseNoteToServer, syncImmediately,
  checkAndSyncCircleData,
  // ColyseusUI
  showColyseusDialog, createConnectionDialog,
  showNotification, showCustomMessage,
  // State
  colyseusSlotStates
};
