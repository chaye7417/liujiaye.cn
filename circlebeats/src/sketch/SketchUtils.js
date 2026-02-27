/**
 * SketchUtils.js
 * 工具函数：颜色计算、几何辅助、数据触发、音高映射
 * 从 Sketch.js 拆分而来
 */

// 辅助函数：将HEX颜色转换为RGB
function hexToRgb(hex) {
  // 移除井号(如果有)
  hex = hex.replace(/^#/, '');

  // 解析RGB值
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return {r, g, b};
}

// 添加一个新的辅助函数，用于将步进索引映射到五线谱音符索引
function getMappedNoteIndex(stepIndex) {
  // 如果索引无效，直接返回
  if (stepIndex < 0) return -1;

  // 如果没有节点数据或未初始化合并数组，直接返回原索引
  if (!nodes.length || !nodes[0].mergedTo) return stepIndex;

  // 计算此步进前面被合并的步进数量
  let skippedSteps = 0;
  for (let i = 0; i < stepIndex; i++) {
    // 如果是被合并的步进，计数加一
    if (nodes[0].mergedTo[i] !== -1) {
      skippedSteps++;
    }
  }

  // 返回调整后的索引（原索引减去前面被合并的步进数量）
  return stepIndex - skippedSteps;
}

// Generate random color - 修改为使用当前预设颜色
function getRandomColor() {
  // 返回当前预设插槽的固定颜色
  return window.presetManager.getSlotColor(ui.currentPattern);
}

// 辅助函数：判断当前是否允许编辑
// 当节拍器播放时返回false，暂停时返回true
function isEditable() {
  // 返回true允许在播放过程中编辑
  return true; // 修改为始终允许编辑
}

// 添加一个函数，用于触发圆环数据变化事件
function triggerCircleDataChange() {
  try {
    // 保存当前悬停的步进索引或拖动中的步进索引
    let highlightIndex = -1;
    if (dragState.isDragging && dragState.stepIndex !== -1) {
      highlightIndex = dragState.stepIndex;
    } else if (ui.stepSequencer.hoveredStep !== -1) {
      highlightIndex = ui.stepSequencer.hoveredStep;
    }

    // 确保首先保存当前预设到内存
    window.saveCurrentPreset();

    // 构建当前圆环数据
    const circleData = {
      nodes: nodes,
      currentPreset: ui.currentPattern,
      stepCount: ui.stepCount,           // 添加步数信息
      resolution: ui.resolution.value,   // 添加分辨率信息
      baseNote: metronome.baseNotes[ui.currentPattern] || 'C4' // 添加当前音高信息
    };

    // 创建并触发事件
    const event = new CustomEvent('circle-data-change', {
      detail: circleData
    });
    window.dispatchEvent(event);

    // 安全地更新总览视图数据
    try {
      // 如果总览视图可用，优先使用updateCircleData方法更新当前插槽
      if (window.circleOverview) {
        // 首先更新当前焦点插槽的数据
        if (typeof window.circleOverview.updateCircleData === 'function') {
          window.circleOverview.updateCircleData(ui.currentPattern, circleData);
        }

        // 如果总览视图是可见的，那么使用refresh方法一次性更新所有插槽
        // 这比依次调用updateSingleSlotData更有效率
        if (window.circleOverview.visible && typeof window.circleOverview.refresh === 'function') {
          // 延迟一点调用refresh，避免在同一帧中多次刷新
          setTimeout(() => {
            try {
              window.circleOverview.refresh();
            } catch (err) {
              console.error("刷新总览视图时出错:", err);
            }
          }, 50);
        }
        // 如果总览视图不可见，或者没有refresh方法，再考虑逐个更新未聚焦的插槽
        else if (typeof window.circleOverview.updateSingleSlotData === 'function') {
          // 由于不可见，这里只更新当前插槽的兄弟插槽中最近修改的几个，而不是全部
          // 优先更新当前插槽附近的插槽
          const nearbySlots = [
            (ui.currentPattern + 1) % 8,
            (ui.currentPattern + 7) % 8,  // -1，但处理负数
            (ui.currentPattern + 2) % 8,
            (ui.currentPattern + 6) % 8   // -2，但处理负数
          ];

          // 只更新附近的插槽
          for (let slotIndex of nearbySlots) {
            try {
              window.circleOverview.updateSingleSlotData(slotIndex);
            } catch (err) {
              console.error(`更新插槽 ${slotIndex + 1} 数据时出错:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error("更新总览视图数据时出错:", err);
    }

    // 简化同步策略 - 只使用一种同步方式，减少重复同步

    // 首先检查是否有权限同步此插槽以及是否在拖拽中
    const hasPermission = window.canEditColyseusSlot ? window.canEditColyseusSlot(ui.currentPattern) :
                         (window.presetManager &&
                          typeof window.presetManager.canEditSlot === 'function' &&
                          window.presetManager.canEditSlot(ui.currentPattern));

    // 如果在拖拽中，跳过同步，拖拽完成后会在mouseReleased中同步
    if (dragState.isDragging) {

      return;
    }

    // 只有当用户有权限编辑当前插槽时才执行同步
    if (hasPermission) {

      // 优先使用即时同步方法
      if (window.syncImmediately && typeof window.syncImmediately === 'function') {
        try {
          window.syncImmediately(ui.currentPattern);

          // 如果即时同步成功，不执行其他同步
          return;
        } catch (e) {
          console.error("极速同步失败，尝试备用方案:", e);
        }
      }

      // 备用方案1: 使用步进变化通知
      if (window.notifyStepChange && typeof window.notifyStepChange === 'function') {
        try {
          window.notifyStepChange(ui.currentPattern);
          return;
        } catch (e) {
          console.error("步进变化通知失败，尝试下一个备用方案:", e);
        }
      }

      // 备用方案2: 使用完整预设同步
      if (window.syncPresetToServer && typeof window.syncPresetToServer === 'function') {
        try {
          window.syncPresetToServer(ui.currentPattern);
          return;
        } catch (e) {
          console.error("预设同步失败:", e);
        }
      }
    } else {
      if (dragState.isDragging) {

      } else {

      }
    }
  } catch (err) {
    console.error("触发圆环数据变化时出错:", err);
  }
}

// 添加一个函数，用于仅本地更新五线谱，不进行网络同步
function triggerLocalAbcUpdate() {
  // 保存当前悬停的步进索引或拖动中的步进索引
  let highlightIndex = -1;
  if (dragState.isDragging && dragState.stepIndex !== -1) {
    highlightIndex = dragState.stepIndex;
  } else if (ui.stepSequencer.hoveredStep !== -1) {
    highlightIndex = ui.stepSequencer.hoveredStep;
  }

  // 构建当前圆环数据
  const circleData = {
    nodes: nodes,
    currentPreset: ui.currentPattern,
    stepCount: ui.stepCount,
    resolution: ui.resolution.value,
    baseNote: metronome.baseNotes[ui.currentPattern] || 'C4'
  };

  // 直接更新ABC记谱法，不依赖事件传播
  if (window.circleToABC && typeof window.circleToABC.convertToABC === 'function') {
    try {
      const abcNotation = window.circleToABC.convertToABC(circleData);

      // 如果ABC编辑器可用，直接更新
      if (window.abcjs && typeof window.abcjs.setTune === 'function') {
        // 确保abcNotation有效
        if (abcNotation && typeof abcNotation === 'string') {
          window.abcjs.setTune(abcNotation);

          // 立即渲染更新后的五线谱
          if (typeof window.abcjs.render === 'function') {
            window.abcjs.render();

            // 确保五线谱可见
            if (window.abcjs.forceShow && window.renderState && window.renderState.rhythmVisible) {
              setTimeout(() => window.abcjs.forceShow(), 100);
            }

            // 在五线谱渲染完成后立即恢复高亮状态
            if (highlightIndex !== -1 && typeof window.abcjs.highlightNote === 'function') {
              // 计算调整后的音符索引
              const mappedIndex = getMappedNoteIndex(highlightIndex);
              // 直接应用高亮，无需等待
              window.abcjs.highlightNote(mappedIndex);
            }
          }
        }
      }
    } catch (error) {
      // console.error("更新本地ABC记谱法时出错:", error);
    }
  }
}

// Update node color function
function updateNodeColor(nodeIndex, newColor) {
  if (nodeIndex < 0 || nodeIndex >= nodes.length) return;

  // 使用presetManager更新节点颜色
  window.presetManager.updateNodeColor(nodes[nodeIndex], ui.currentPattern);

  // 添加：立即触发圆环数据更新，使五线谱刷新
  triggerCircleDataChange();
}

// Add a rhythm pattern to existing node list
function addRhythmPattern(pattern) {
  // 调用presetManager的addRhythmPattern方法
  window.presetManager.addRhythmPattern(pattern);

  // 在添加节奏模式后触发事件
  triggerCircleDataChange();
}

function applyRhythmPatterns(rhythmPatterns) {
  // Clear existing nodes
  nodes = [];

  // Apply each rhythm pattern
  rhythmPatterns.forEach(pattern => {
    addRhythmPattern(pattern);
  });

  // 触发圆环数据变化事件
  triggerCircleDataChange();
}

function clearAllPatterns() {
  // 使用presetManager清除所有模式
  window.presetManager.clearAllPatterns();

  // 触发圆环数据变化事件
  triggerCircleDataChange();
}

// 新的函数：保存当前预设
window.saveCurrentPreset = function(variantIndex) {
  // 检查当前预设索引是否有效
  if (ui.currentPattern >= 0 && ui.currentPattern < window.presetPatterns.length) {
    // 使用预设管理器保存当前编辑到指定变体
    return window.presetManager.saveCurrentPreset(ui.currentPattern, null, variantIndex);
  }
  return false;
};

// 更新節拍器BPM函数，移除OSC事件发送相关代码
function updateBPM(newBpm) {
  // 确保BPM在合理范围内
  newBpm = constrain(newBpm, 30, 300);

  // 使用metronome的setBpm方法，而不是直接设置属性
  metronome.setBpm(newBpm);

  // 更新UI中的BPM值
  ui.bpmControl.value = newBpm;

  // 映射BPM到运镜路径速度
  if (typeof window.updateCameraPathSpeed === 'function') {
    // 线性映射公式: pathSpeed = (BPM / 60)
    // 这样BPM每增加60，路径速度就增加1
    const pathSpeed = newBpm / 60;

    // 限制在合理范围内
    const clampedPathSpeed = constrain(pathSpeed, 0.5, 5.0);

    // 调用three-scene.js中的函数更新路径速度
    window.updateCameraPathSpeed(clampedPathSpeed);
  }

  // 触发一个自定义事件，通知系统BPM已更改
  const bpmChangeEvent = new CustomEvent('bpm-change', {
    detail: {
      value: newBpm,
      timestamp: Date.now()
    }
  });
  window.dispatchEvent(bpmChangeEvent);

  // 如果存在Colyseus同步函数，调用它
  if (window.syncBpmChangeToServer && typeof window.syncBpmChangeToServer === 'function') {
    window.syncBpmChangeToServer(newBpm);
  }
}

// 更改预设的八度
function changePresetOctave(presetIndex, direction) {
  // 获取当前基础音高
  const baseNote = metronome.baseNotes[presetIndex] || 'C4';

  // 解析八度
  const match = baseNote.match(/([A-G][#b]?)(\d+)/);
  let octave = match ? parseInt(match[2]) : 4;

  // 计算新的八度，扩展范围到1-7
  octave = Math.max(Math.min(octave + direction, 7), 1); // 限制在1-7之间

  // 更新基础音高，音符固定为C
  const newBaseNote = 'C' + octave;
  metronome.setBaseNote(presetIndex, newBaseNote);

  // 同步八度信息到Colyseus服务器
  if (window.syncBaseNoteToServer && typeof window.syncBaseNoteToServer === 'function') {
    window.syncBaseNoteToServer(presetIndex, newBaseNote);
  } else if (window.syncPresetToServer && typeof window.syncPresetToServer === 'function') {
    window.syncPresetToServer(ui.currentPattern);
  }

  // 触发圆环数据变化事件
  triggerCircleDataChange();
}

// 处理音高设置面板上的点击事件
function handlePitchControlPanelClick() {
  // 删除此函数
}

// 更改预设的音符
function changePresetNote(presetIndex, direction) {
  // 删除此函数
}
