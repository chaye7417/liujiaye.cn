/**
 * SlotSync.js - 插槽管理
 * 包含插槽占用/释放、状态同步、权限检查
 */

import {
  colyseusConnected, colyseusRoom, colyseusSlotStates,
  sessionId, dialogVisible,
  setDialogVisible
} from './NetworkState.js';
import { syncAllSynthParamsToServer, syncPresetToServer } from './ParamsSync.js';
import { showCustomMessage } from './ColyseusUI.js';

// ---- 状态同步到PresetManager ----

/**
 * 将Colyseus状态同步到PresetManager
 */
export function syncColyseusStateToPresetManager() {
  if (!window.presetManager) return;

  window.presetManager.controlledSlotIndex = colyseusSlotStates.mySlot;
  window.presetManager.isViewOnlyMode = colyseusSlotStates.mySlot === -1;
  window.presetManager.myUserId = sessionId;

  if (!window.presetManager.slotOwners) {
    window.presetManager.slotOwners = {};
  }

  for (let slotIndex = 0; slotIndex < 8; slotIndex++) {
    if (colyseusSlotStates.data.slots[slotIndex]) {
      window.presetManager.slotOwners[slotIndex] = colyseusSlotStates.data.slots[slotIndex];
    } else {
      delete window.presetManager.slotOwners[slotIndex];
    }
  }

  window.isViewOnlyMode = window.presetManager.isViewOnlyMode;
  window.controlledSlotIndex = window.presetManager.controlledSlotIndex;
  window.slotOwners = {...window.presetManager.slotOwners};
  window.myUserId = sessionId;
  window.colyseusConnected = colyseusConnected;
}

/**
 * 在收到服务器状态更新时同步到PresetManager
 */
export function handleServerStateUpdate() {
  syncColyseusStateToPresetManager();

  if (typeof updateUIPositions === 'function') {
    updateUIPositions();
  }
  if (typeof redraw === 'function') {
    redraw();
  }
}

// ---- 插槽状态更新 ----

/**
 * 更新插槽状态
 * @param {object} slots - 插槽状态对象
 */
export function updateSlotsFromState(slots) {
  if (!slots) return;

  for (const slotIndex in slots) {
    const slotNum = parseInt(slotIndex);
    if (!isNaN(slotNum) && slotNum >= 0 && slotNum < 8) {
      if (typeof slots[slotIndex] === 'object' && slots[slotIndex] !== null) {
        colyseusSlotStates.data.slots[slotNum] = slots[slotIndex].sessionId;
        if (slots[slotIndex].username) {
          colyseusSlotStates.data.slotNames[slotNum] = slots[slotIndex].username;
        }
      } else {
        colyseusSlotStates.data.slots[slotNum] = slots[slotIndex];
      }
    }
  }

  if (window.debugColyseus) {
    // 调试模式下输出详细信息
  }

  handleServerStateUpdate();
}

/**
 * 处理初始插槽信息
 * @param {object|Array} slots - 插槽信息
 */
export function processInitialSlots(slots) {
  for (let i = 0; i < 8; i++) {
    colyseusSlotStates.data.slots[i] = null;
    colyseusSlotStates.data.slotNames[i] = null;
  }

  if (Array.isArray(slots)) {
    for (let i = 0; i < slots.length && i < 8; i++) {
      if (slots[i]) {
        if (typeof slots[i] === 'object') {
          colyseusSlotStates.data.slots[i] = slots[i].sessionId;
          if (slots[i].username) {
            colyseusSlotStates.data.slotNames[i] = slots[i].username;
          }
        } else {
          colyseusSlotStates.data.slots[i] = slots[i];
        }
      }
    }
  } else {
    for (const slotIndex in slots) {
      const slotInfo = slots[slotIndex];
      if (!slotInfo) continue;

      const slotNum = parseInt(slotIndex);
      if (isNaN(slotNum) || slotNum < 0 || slotNum >= 8) continue;

      if (typeof slotInfo === 'object') {
        colyseusSlotStates.data.slots[slotNum] = slotInfo.sessionId;
        if (slotInfo.username) {
          colyseusSlotStates.data.slotNames[slotNum] = slotInfo.username;
        }
      } else {
        colyseusSlotStates.data.slots[slotNum] = slotInfo;
      }
    }
  }

  if (window.debugColyseus) {
    // 调试模式下输出详细信息
  }

  const event = new CustomEvent('colyseus-slots-updated', {
    detail: { timestamp: Date.now() }
  });
  window.dispatchEvent(event);
}

// ---- 插槽选择与释放 ----

/**
 * 选择插槽控制
 * @param {number} slotIndex - 插槽索引
 * @returns {boolean} 是否选择成功
 */
export function selectColyseusSlot(slotIndex) {
  if (!colyseusConnected || !colyseusRoom) {
    console.warn("未连接到Colyseus服务器，无法选择插槽");
    return false;
  }

  if (colyseusSlotStates.data.slots[slotIndex] != null &&
      colyseusSlotStates.data.slots[slotIndex] !== sessionId) {
    showCustomMessage(`插槽 ${slotIndex + 1} 已被其他用户占用!`, "warning");
    return false;
  }

  // 如果当前控制着其他插槽，先释放它
  if (colyseusSlotStates.mySlot !== -1 && colyseusSlotStates.mySlot !== slotIndex) {
    const oldSlotIndex = colyseusSlotStates.mySlot;
    colyseusRoom.send("releaseSlot", { slotIndex: oldSlotIndex });

    if (colyseusSlotStates.data && colyseusSlotStates.data.slots) {
      delete colyseusSlotStates.data.slots[oldSlotIndex];
    }
    if (window.presetManager && window.presetManager.slotOwners) {
      delete window.presetManager.slotOwners[oldSlotIndex];
    }
    if (window.slotOwners) {
      delete window.slotOwners[oldSlotIndex];
    }
  }

  colyseusSlotStates.mySlot = slotIndex;
  colyseusRoom.send("claimSlot", {
    slotIndex,
    username: colyseusSlotStates.username
  });

  if (window.presetManager) {
    window.presetManager.controlledSlotIndex = slotIndex;
    window.presetManager.isViewOnlyMode = false;
  }

  window.controlledSlotIndex = slotIndex;
  window.isViewOnlyMode = false;

  if (window.synthPresetManager) {
    syncAllSynthParamsToServer();
  }

  if (window.presetPatterns && window.presetPatterns[slotIndex]) {
    syncPresetToServer(slotIndex);
  }

  handleServerStateUpdate();

  if (window.loadPreset && typeof window.loadPreset === 'function') {
    window.loadPreset(slotIndex);
  } else {
    if (typeof window.updateUIPositions === 'function') {
      window.updateUIPositions();
    }
    if (typeof window.redraw === 'function') {
      window.redraw();
    }
  }

  setDialogVisible(false);
  return true;
}

/**
 * 进入观看模式，不控制任何插槽
 * @returns {boolean} 是否成功进入观看模式
 */
export function enterColyseusViewMode() {
  if (!colyseusConnected || !colyseusRoom) return;

  if (colyseusSlotStates.mySlot !== -1) {
    const oldSlotIndex = colyseusSlotStates.mySlot;
    colyseusRoom.send("releaseSlot", { slotIndex: oldSlotIndex });

    if (colyseusSlotStates.data && colyseusSlotStates.data.slots) {
      delete colyseusSlotStates.data.slots[oldSlotIndex];
    }
    if (window.presetManager && window.presetManager.slotOwners) {
      delete window.presetManager.slotOwners[oldSlotIndex];
    }
    if (window.slotOwners) {
      delete window.slotOwners[oldSlotIndex];
    }
  }

  colyseusSlotStates.mySlot = -1;

  if (window.presetManager) {
    window.presetManager.controlledSlotIndex = -1;
    window.presetManager.isViewOnlyMode = true;
  }

  window.controlledSlotIndex = -1;
  window.isViewOnlyMode = true;

  handleServerStateUpdate();
  setDialogVisible(false);
  return true;
}

// ---- 清空插槽数据 ----

/**
 * 清空插槽步进数据
 * @param {number} slotIndex - 插槽索引
 */
export function clearSlotStepData(slotIndex) {
  if (slotIndex < 0 || slotIndex >= 8) return;

  if (window.presetPatterns && window.presetPatterns[slotIndex]) {
    try {
      const emptyPreset = JSON.parse(JSON.stringify(window.presetPatterns[slotIndex]));
      if (emptyPreset.variants) {
        emptyPreset.variants.forEach((variant, variantIndex) => {
          if (variant && variant.length > 0 && variant[0].alpha) {
            for (let i = 0; i < variant[0].alpha.length; i++) {
              variant[0].alpha[i] = 0;
            }
          }
        });
      }
      window.presetPatterns[slotIndex] = emptyPreset;

      if (window.ui && window.ui.currentPattern === slotIndex) {
        if (window.presetManager && typeof window.presetManager.loadPreset === 'function') {
          window.presetManager.loadPreset(slotIndex);
        }
        if (typeof window.triggerCircleDataChange === 'function') {
          window.triggerCircleDataChange();
        }
      }

      if (window.circleOverview && typeof window.circleOverview.updateSingleSlotData === 'function') {
        window.circleOverview.updateSingleSlotData(slotIndex);
      }
    } catch (error) {
      console.error(`清空插槽 ${slotIndex + 1} 的步进数据时出错:`, error);
    }
  }
}

// ---- 权限检查 ----

/**
 * 显示插槽选择对话框
 */
export function showSlotSelectionDialog() {
  if (!colyseusConnected || !colyseusRoom) {
    // 通过全局函数调用，避免循环依赖
    if (window._createConnectionDialog) {
      window._createConnectionDialog();
    }
    return;
  }

  if (window._showColyseusDialog) {
    window._showColyseusDialog();
  }

  setDialogVisible(true);
  window.slotDialogShown = true;
}

/**
 * 检查用户是否可以编辑特定插槽
 * @param {number} slotIndex - 要检查的插槽索引
 * @returns {boolean} 是否可以编辑该插槽
 */
export function canEditColyseusSlot(slotIndex) {
  if (!colyseusConnected || !colyseusRoom) return true;
  if (colyseusSlotStates.mySlot === -1) return false;
  return slotIndex === colyseusSlotStates.mySlot;
}

/**
 * 设置观看模式，不控制任何插槽
 * @returns {boolean} 是否成功
 */
export function setColyseusViewOnlyMode() {
  window.slotDialogShown = false;
  return enterColyseusViewMode();
}

/**
 * 检查用户是否有权限进行点击交互
 * @param {number} x - 鼠标X坐标
 * @param {number} y - 鼠标Y坐标
 * @returns {boolean} 是否允许点击
 */
export function isUserAllowedToClick(x, y) {
  if (!colyseusConnected || !colyseusRoom) return true;

  const connectButton = document.getElementById('colyseus-connect-button');
  if (connectButton) {
    const rect = connectButton.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return true;
    }
  }

  if (dialogVisible) return true;

  if (colyseusSlotStates.mySlot !== -1) {
    if (window.ui && window.ui.patternSelector && window.ui.patternSelector.buttons) {
      for (let i = 0; i < window.ui.patternSelector.buttons.length; i++) {
        let button = window.ui.patternSelector.buttons[i];
        if (x >= button.x && x <= button.x + button.w &&
            y >= button.y && y <= button.y + button.h) {
          return i === colyseusSlotStates.mySlot;
        }
      }
    }

    if (window.ui && window.ui.centerX && window.ui.centerY) {
      const distToCenter = Math.sqrt(Math.pow(x - window.ui.centerX, 2) + Math.pow(y - window.ui.centerY, 2));
      if (distToCenter <= window.ui.stepRadius && distToCenter >= window.ui.innerRadius) {
        return window.ui.currentPattern === colyseusSlotStates.mySlot;
      }
    }

    if (window.ui && window.ui.variantSelector) {
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
      if (window.ui.variantSelector.addButton) {
        const addButton = window.ui.variantSelector.addButton;
        if (x >= addButton.x && x <= addButton.x + addButton.w &&
            y >= addButton.y && y <= addButton.y + addButton.h) {
          return window.ui.currentPattern === colyseusSlotStates.mySlot;
        }
      }
    }
    return true;
  }

  if (window.ui && window.ui.centerX && window.ui.centerY && window.ui.stepRadius) {
    const distToCenter = Math.sqrt(Math.pow(x - window.ui.centerX, 2) + Math.pow(y - window.ui.centerY, 2));
    if (distToCenter <= window.ui.stepRadius + 30) return false;

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

  return true;
}
