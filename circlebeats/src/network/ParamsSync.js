/**
 * ParamsSync.js - 参数同步
 * 包含合成器参数、BPM、节奏pattern同步、八度信息同步、防抖节流
 */

import {
  colyseusConnected, colyseusRoom, colyseusSlotStates,
  sessionId, lastSyncedStates, syncCounter,
  setSyncCounter
} from './NetworkState.js';

// ---- BPM 同步 ----

/**
 * 更新BPM（从服务器状态）
 * @param {number} bpm - BPM值
 */
export function updateBpmFromState(bpm) {
  if (typeof bpm !== 'number' || bpm < 30 || bpm > 300) return;

  if (window.metronome && window.metronome.bpm !== bpm) {
    window.metronome.setBpm(bpm);
  }

  if (window.bpm !== undefined && window.bpm !== bpm) {
    window.bpm = bpm;
  }

  colyseusSlotStates.data.bpm = bpm;
}

/**
 * 同步BPM到服务器（节流由外层throttledSyncBpm控制，此处只做发送逻辑）
 * @param {number} bpm - BPM值
 */
export function syncBpmToServer(bpm) {
  if (!colyseusConnected || colyseusSlotStates.mySlot === -1) return;
  if (typeof bpm !== 'number' || bpm < 30 || bpm > 300) return;

  if (colyseusSlotStates.data.bpm !== bpm) {
    if (colyseusRoom) {
      colyseusRoom.send("updateBpm", { bpm });
      colyseusSlotStates.data.bpm = bpm;
    }
  }
}

// ---- 合成器参数同步 ----

/**
 * 从服务器同步合成器参数
 * @param {number} slotIndex - 插槽索引
 * @param {string|object} paramsJson - 参数JSON
 */
export function syncSynthParamsFromServer(slotIndex, paramsJson) {
  if (colyseusSlotStates.mySlot === slotIndex) return;
  if (!window.synthPresetManager) return;

  try {
    const params = typeof paramsJson === 'string' ? JSON.parse(paramsJson) : paramsJson;

    if (params.envelopeParams) {
      window.synthPresetManager.presetEnvelopeParams[slotIndex] = params.envelopeParams;
    }
    if (params.filterParams) {
      window.synthPresetManager.presetFilterParams[slotIndex] = params.filterParams;
    }
    if (params.waveform) {
      window.synthPresetManager.presetWaveforms[slotIndex] = params.waveform;
    }
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

    if (window.ui && window.ui.currentPattern === slotIndex &&
        window.metronome && window.metronome.synthUI) {
      updateSynthUIForSlot(slotIndex);
    }
  } catch (e) {
    console.error("解析或应用合成器参数时出错:", e);
  }
}

/**
 * 更新指定插槽的合成器UI
 * @param {number} slotIndex - 插槽索引
 */
export function updateSynthUIForSlot(slotIndex) {
  if (!window.metronome || !window.metronome.synthUI) return;

  try {
    if (typeof window.metronome.initSound === 'function') {
      window.metronome.initSound();
    }
    if (typeof window.redraw === 'function') {
      window.redraw();
    }
  } catch (e) {
    console.error("更新合成器UI时出错:", e);
  }
}

/**
 * 更新合成器参数（从服务器状态）
 * @param {Array} synthParams - 合成器参数数组
 */
export function updateSynthParamsFromState(synthParams) {
  if (!synthParams || !Array.isArray(synthParams)) return;

  for (let i = 0; i < synthParams.length && i < 8; i++) {
    if (i !== colyseusSlotStates.mySlot && synthParams[i]) {
      syncSynthParamsFromServer(i, synthParams[i]);
    }
  }
}

/**
 * 同步所有合成器参数到服务器
 */
export function syncAllSynthParamsToServer() {
  if (!colyseusConnected || colyseusSlotStates.mySlot === -1 || !colyseusRoom) return;
  if (window.isDraggingInOverview) return;
  if (!window.synthPresetManager) return;

  const slotIndex = colyseusSlotStates.mySlot;

  try {
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

    colyseusRoom.send("updateSynthParams", {
      slotIndex,
      params: JSON.stringify(params)
    });
  } catch (error) {
    console.error("发送合成器参数到服务器时出错:", error);
  }
}

/**
 * 同步单个合成器参数到服务器
 * @param {number} slotIndex - 插槽索引
 * @param {object} params - 参数对象
 */
export function syncSynthParamsToServer(slotIndex, params) {
  if (!colyseusConnected || colyseusSlotStates.mySlot !== slotIndex || !colyseusRoom) return;
  if (window.isDraggingInOverview) return;

  try {
    colyseusRoom.send("updateSynthParams", {
      slotIndex,
      params: JSON.stringify(params)
    });
  } catch (error) {
    console.error("发送合成器参数到服务器时出错:", error);
  }
}

/**
 * 处理初始合成器参数
 * @param {object} synthParams - 合成器参数对象
 */
export function processInitialSynthParams(synthParams) {
  for (const slotIndex in synthParams) {
    const paramsData = synthParams[slotIndex];
    if (!paramsData) continue;

    const slotNum = parseInt(slotIndex);
    if (isNaN(slotNum) || slotNum < 0 || slotNum >= 8) continue;
    if (colyseusSlotStates.mySlot === slotNum) continue;

    syncSynthParamsFromServer(slotNum, paramsData);
  }
}

// ---- 预设数据同步 ----

/**
 * 更新预设数据（从服务器状态）
 * @param {Array} presets - 预设数据数组
 */
export function updatePresetsFromState(presets) {
  if (!presets || !Array.isArray(presets)) return;

  for (let i = 0; i < presets.length && i < 8; i++) {
    if (i !== colyseusSlotStates.mySlot && presets[i]) {
      const presetData = presets[i];
      try {
        const parsedPreset = typeof presetData === 'string' ?
                             JSON.parse(presetData) : presetData;
        if (window.presetPatterns && window.presetPatterns[i]) {
          window.presetPatterns[i] = parsedPreset;
        }
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

  if (typeof window.triggerCircleDataChange === 'function') {
    window.triggerCircleDataChange();
  }
}

/**
 * 同步预设模式到服务器
 * @param {number} slotIndex - 插槽索引
 * @returns {boolean} 是否同步成功
 */
export function syncPresetToServer(slotIndex) {
  if (!colyseusConnected || !colyseusRoom) {
    console.warn("未连接到Colyseus服务器，无法同步预设");
    return false;
  }
  if (colyseusSlotStates.mySlot !== slotIndex) {
    console.warn(`无权同步插槽 ${slotIndex + 1}，当前控制的是插槽 ${colyseusSlotStates.mySlot + 1 || '无'}`);
    return false;
  }

  const preset = window.presetPatterns[slotIndex];
  if (!preset) {
    console.warn(`插槽 ${slotIndex + 1} 没有预设数据，无法同步`);
    return false;
  }

  try {
    const presetJSON = JSON.stringify(preset);
    const lastPresetCache = window.lastSyncedPresetJSON || {};

    if (presetJSON !== lastPresetCache[slotIndex]) {
      if (!window.lastSyncedPresetJSON) window.lastSyncedPresetJSON = {};
      window.lastSyncedPresetJSON[slotIndex] = presetJSON;

      colyseusRoom.send("updatePreset", {
        slotIndex,
        preset: presetJSON,
        timestamp: Date.now()
      });
      return true;
    } else {
      return true;
    }
  } catch (error) {
    console.error("发送预设数据到服务器时出错:", error);
    return false;
  }
}

/**
 * 处理初始预设数据
 * @param {object} presets - 预设数据对象
 */
export function processInitialPresets(presets) {
  for (const slotIndex in presets) {
    const presetData = presets[slotIndex];
    if (!presetData) continue;

    const slotNum = parseInt(slotIndex);
    if (isNaN(slotNum) || slotNum < 0 || slotNum >= 8) continue;

    try {
      if (colyseusSlotStates.mySlot === slotNum) continue;
      const parsedPreset = typeof presetData === 'string' ?
                           JSON.parse(presetData) : presetData;
      if (window.presetPatterns && window.presetPatterns[slotNum]) {
        window.presetPatterns[slotNum] = parsedPreset;
      }
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

// ---- 圆环数据同步 ----

/**
 * 检测节奏圆环数据变化并同步
 */
export function checkAndSyncCircleData() {
  if (!colyseusConnected || colyseusSlotStates.mySlot === -1) return;
  if (window.isDraggingInOverview) return;

  const slotIndex = colyseusSlotStates.mySlot;

  if (window.presetPatterns && window.presetPatterns[slotIndex]) {
    const currentPattern = window.presetPatterns[slotIndex];
    const lastPattern = lastSyncedStates[slotIndex];

    if (!lastPattern || JSON.stringify(currentPattern) !== JSON.stringify(lastPattern)) {
      syncPresetToServer(slotIndex);
      lastSyncedStates[slotIndex] = JSON.parse(JSON.stringify(currentPattern));
    }
    setSyncCounter(syncCounter + 1);
  }
}

// ---- 八度信息同步 ----

/**
 * 同步八度信息到服务器
 * @param {number} slotIndex - 插槽索引
 * @param {string} baseNote - 八度信息
 * @returns {boolean} 是否同步成功
 */
export function syncBaseNoteToServer(slotIndex, baseNote) {
  if (!colyseusConnected || !colyseusRoom) {
    console.warn("未连接到Colyseus服务器，无法同步八度信息");
    return false;
  }
  if (colyseusSlotStates.mySlot !== slotIndex) {
    console.warn(`无权同步插槽 ${slotIndex + 1} 的八度信息，当前控制的是插槽 ${colyseusSlotStates.mySlot + 1 || '无'}`);
    return false;
  }

  try {
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

/**
 * 从服务器同步八度信息
 * @param {number} slotIndex - 插槽索引
 * @param {string} baseNote - 八度信息
 */
export function syncBaseNoteFromServer(slotIndex, baseNote) {
  if (colyseusSlotStates.mySlot === slotIndex) return;

  try {
    if (window.metronome && window.metronome.baseNotes) {
      window.metronome.baseNotes[slotIndex] = baseNote;
      console.log(`已从服务器同步插槽 ${slotIndex + 1} 的八度信息: ${baseNote}`);

      if (window.ui && window.ui.currentPattern === slotIndex) {
        if (typeof window.redraw === 'function') {
          window.redraw();
        }
      }
    }
  } catch (e) {
    console.error("应用八度信息时出错:", e);
  }
}

/**
 * 更新八度信息（从服务器状态）
 * @param {object} baseNotes - 八度信息对象
 */
export function updateBaseNotesFromState(baseNotes) {
  if (!baseNotes) return;

  for (const slotIndex in baseNotes) {
    const baseNote = baseNotes[slotIndex];
    if (!baseNote) continue;

    const slotNum = parseInt(slotIndex);
    if (isNaN(slotNum) || slotNum < 0 || slotNum >= 8) continue;
    if (colyseusSlotStates.mySlot === slotNum) continue;

    syncBaseNoteFromServer(slotNum, baseNote);
    console.log(`已更新插槽 ${slotNum + 1} 的八度信息: ${baseNote}`);
  }
}

/**
 * 处理初始八度信息
 * @param {object} baseNotes - 八度信息对象
 */
export function processInitialBaseNotes(baseNotes) {
  for (const slotIndex in baseNotes) {
    const baseNote = baseNotes[slotIndex];
    if (!baseNote) continue;

    const slotNum = parseInt(slotIndex);
    if (isNaN(slotNum) || slotNum < 0 || slotNum >= 8) continue;
    if (colyseusSlotStates.mySlot === slotNum) continue;

    syncBaseNoteFromServer(slotNum, baseNote);
    console.log(`已处理插槽 ${slotNum + 1} 的初始八度信息: ${baseNote}`);
  }
}

// ---- 立即同步 ----

/**
 * 立即同步函数，确保同步成功
 * @param {number} slotIndex - 插槽索引
 * @returns {boolean} 是否同步成功
 */
export function syncImmediately(slotIndex) {
  if (colyseusSlotStates.mySlot !== slotIndex) {
    console.warn(`无权同步插槽 ${slotIndex + 1}，当前控制的是插槽 ${colyseusSlotStates.mySlot + 1 || '无'}`);
    return false;
  }
  if (window.isDraggingInOverview) return false;

  try {
    const preset = window.presetPatterns[slotIndex];
    if (preset) {
      const presetJSON = JSON.stringify(preset);
      if (colyseusRoom && colyseusRoom.connection && colyseusRoom.connection.isOpen) {
        try {
          colyseusRoom.send("updatePreset", {
            slotIndex,
            preset: presetJSON,
            priority: "critical",
            timestamp: Date.now(),
            isCritical: true
          });
          colyseusRoom.send("syncNow", {
            timestamp: Date.now(),
            slotIndex: slotIndex
          });
          return true;
        } catch (sendError) {
          console.error("发送步进数据时出错:", sendError);
          if (window.reconnectIfNeeded) {
            window.reconnectIfNeeded();
          }
          return false;
        }
      } else {
        console.warn(`步进数据同步失败：WebSocket连接已关闭，尝试重新连接...`);
        if (window.reconnectIfNeeded) {
          window.reconnectIfNeeded();
        }
        return false;
      }
    }
  } catch (error) {
    console.error("极速同步步进数据失败:", error);
    return false;
  }
  return false;
}
