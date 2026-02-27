/**
 * InputHandler.js
 * 鼠标/触摸/键盘交互处理
 * 从 Sketch.js 拆分而来
 */

// 添加鼠标事件处理函数
function mouseMoved() {
  // 检查用户是否有权限点击交互
  if (window.isUserAllowedToClick && !window.isUserAllowedToClick(mouseX, mouseY)) {
    // 如果没有权限，将鼠标指针设置为禁止样式
    document.body.style.cursor = 'not-allowed';
    return false;
  } else {
    // 恢复默认鼠标指针
    document.body.style.cursor = 'default';
  }

  // 如果合成器UI可见，将事件委托给合成器UI处理
  if (metronome.synthUI.visible) {
    metronome.handleSynthMouseMoved(mouseX, mouseY);
    return false;
  }

  // 检查是否悬停在导入/导出按钮上
  ui.importExportButton.hovered = (mouseX >= ui.importExportButton.x &&
                                  mouseX <= ui.importExportButton.x + ui.importExportButton.width &&
                                  mouseY >= ui.importExportButton.y &&
                                  mouseY <= ui.importExportButton.y + ui.importExportButton.height);

  // 检查是否悬停在合成器按钮上
  ui.synthButton.hovered = (mouseX >= ui.synthButton.x &&
                           mouseX <= ui.synthButton.x + ui.synthButton.width &&
                           mouseY >= ui.synthButton.y &&
                           mouseY <= ui.synthButton.y + ui.synthButton.height);

  // 原有的mouseMoved处理代码
  // 更新模式选择器按钮悬停状态
  let hovered = false;
  for (let i = 0; i < ui.patternSelector.buttons.length; i++) {
    let button = ui.patternSelector.buttons[i];
    if (mouseX >= button.x && mouseX <= button.x + button.w &&
        mouseY >= button.y && mouseY <= button.y + button.h) {
      ui.patternSelector.hoveredButton = i;
      hovered = true;
      break;
    }
  }
  if (!hovered) {
    ui.patternSelector.hoveredButton = -1;
  }

  // 更新变体选择器按钮悬停状态
  let variantHovered = false;
  for (let i = 0; i < ui.variantSelector.buttons.length; i++) {
    let button = ui.variantSelector.buttons[i];
    if (mouseX >= button.x && mouseX <= button.x + button.w &&
        mouseY >= button.y && mouseY <= button.y + button.h) {
      ui.variantSelector.hoveredButton = i;
      variantHovered = true;

      // 检查是否悬停在按钮的右上角（删除按钮区域）
      button.isDeleteHovered = (mouseX >= button.x + button.w - 8) &&
                               (mouseX <= button.x + button.w) &&
                               (mouseY >= button.y) &&
                               (mouseY <= button.y + 8);
      break;
    }
  }
  if (!variantHovered) {
    ui.variantSelector.hoveredButton = -1;
  }

  // 检查是否悬停在步进器上
  let previousHoveredStep = ui.stepSequencer.hoveredStep; // 保存之前的悬停步骤
  ui.stepSequencer.hoveredStep = -1;

  // 计算鼠标相对于中心的位置
  let dx = mouseX - ui.centerX;
  let dy = mouseY - ui.centerY;
  let distToCenter = sqrt(dx*dx + dy*dy);

  // 检查鼠标是否在步进器环上
  if (distToCenter >= ui.innerRadius && distToCenter <= ui.stepRadius) {
    // 计算角度
    let angle = atan2(dy, dx);
    angle = (angle + TWO_PI) % TWO_PI; // 将角度转换为0-2PI范围

    // 计算鼠标在哪个步进位置
    let stepIndex = floor(((angle + HALF_PI + TWO_PI) % TWO_PI) / TWO_PI * ui.stepCount);

    // 检查该步进是否被合并到其他步进
    if (nodes.length > 0 && nodes[0].mergedTo && nodes[0].mergedTo[stepIndex] !== -1) {
      // 如果该步进被合并，则将悬停索引设置为它所合并到的步进
      stepIndex = nodes[0].mergedTo[stepIndex];
    }

    ui.stepSequencer.hoveredStep = stepIndex;

    // 如果有五线谱功能，高亮对应的音符
    if (window.abcjs && typeof window.abcjs.highlightNote === 'function' && stepIndex >= 0) {
      // 计算调整后的音符索引
      const mappedIndex = getMappedNoteIndex(stepIndex);
      window.abcjs.highlightNote(mappedIndex);
    }
  } else {
    // 如果鼠标不在步进器上，清除五线谱高亮
    if (window.abcjs && typeof window.abcjs.highlightNote === 'function' && previousHoveredStep >= 0) {
      window.abcjs.highlightNote(-1); // 传递-1表示清除所有高亮
    }
  }

  // 检查是否悬停在BPM控制按钮上
  ui.bpmControl.minusHovered = false;
  ui.bpmControl.plusHovered = false;
  ui.bpmControl.hovered = false;

  if (mouseX >= ui.bpmControl.minusX && mouseX <= ui.bpmControl.minusX + 30 &&
      mouseY >= ui.bpmControl.y && mouseY <= ui.bpmControl.y + 30) {
    ui.bpmControl.minusHovered = true;
  }

  if (mouseX >= ui.bpmControl.plusX && mouseX <= ui.bpmControl.plusX + 30 &&
      mouseY >= ui.bpmControl.y && mouseY <= ui.bpmControl.y + 30) {
    ui.bpmControl.plusHovered = true;
  }

  if (mouseX >= ui.bpmControl.rect.x && mouseX <= ui.bpmControl.rect.x + ui.bpmControl.rect.w &&
      mouseY >= ui.bpmControl.rect.y && mouseY <= ui.bpmControl.rect.y + ui.bpmControl.rect.h) {
    ui.bpmControl.hovered = true;
  }

  // 检查是否悬停在八度控制按钮上
  ui.pitchControl.octaveControl.minusHovered = false;
  ui.pitchControl.octaveControl.plusHovered = false;
  ui.pitchControl.octaveControl.hovered = false;

  if (mouseX >= ui.pitchControl.octaveControl.minusX && mouseX <= ui.pitchControl.octaveControl.minusX + 30 &&
      mouseY >= ui.pitchControl.octaveControl.y && mouseY <= ui.pitchControl.octaveControl.y + 30) {
    ui.pitchControl.octaveControl.minusHovered = true;
  }

  if (mouseX >= ui.pitchControl.octaveControl.plusX && mouseX <= ui.pitchControl.octaveControl.plusX + 30 &&
      mouseY >= ui.pitchControl.octaveControl.y && mouseY <= ui.pitchControl.octaveControl.y + 30) {
    ui.pitchControl.octaveControl.plusHovered = true;
  }

  if (mouseX >= ui.pitchControl.octaveControl.rect.x && mouseX <= ui.pitchControl.octaveControl.rect.x + ui.pitchControl.octaveControl.rect.w &&
      mouseY >= ui.pitchControl.octaveControl.y && mouseY <= ui.pitchControl.octaveControl.y + ui.pitchControl.octaveControl.h) {
    ui.pitchControl.octaveControl.hovered = true;
  }

  return false;
}

// 添加鼠标离开画布时的处理，确保清除五线谱高亮
function mouseOut() {
  // 清除五线谱高亮
  if (window.abcjs && typeof window.abcjs.highlightNote === 'function') {
    window.abcjs.highlightNote(-1); // 清除所有高亮
  }
}

// 鼠标按下处理
function mousePressed() {
  // 如果合成器UI可见，处理ADSR节点拖拽
  if (metronome.synthUI && metronome.synthUI.visible) {
    if (metronome.handleSynthMousePressed(mouseX, mouseY)) return true;
  }

  // 如果步进器不可见，完全禁止所有鼠标事件处理
  if (!window.rhythmVisible || window.p5CanvasOpacity === 0) {
    return false;
  }

  // 检查是否点击了BPM控制器
  if (mouseY >= ui.bpmControl.y && mouseY <= ui.bpmControl.y + ui.bpmControl.height) {
    // 如果点击了BPM中央区域（不是加减按钮）
    if (mouseX >= ui.bpmControl.rect.x && mouseX <= ui.bpmControl.rect.x + ui.bpmControl.rect.w) {
      if (ui.bpmControl.isEditing) {
        // 已经在编辑中，不做任何操作
        return true;
      } else {
        // 开始拖动操作
        ui.bpmControl.isDragging = true;
        ui.bpmControl.dragStartY = mouseY;
        ui.bpmControl.dragStartBpm = ui.bpmControl.value;
        return true;
      }
    }
  }

  // 检查是否点击了环形步进器上的已激活步进点
  let dx = mouseX - ui.centerX;
  let dy = mouseY - ui.centerY;
  let distToCenter = sqrt(dx*dx + dy*dy);

  if (distToCenter >= ui.innerRadius && distToCenter <= ui.stepRadius) {
    // 在环形步进器范围内
    let angle = atan2(dy, dx) + HALF_PI; // 调整以12点钟方向为0
    if (angle < 0) angle += TWO_PI;

    // 计算点击的步进索引
    let stepIndex = floor(angle / TWO_PI * ui.stepCount) % ui.stepCount;

    // 检查该步进是否被合并到其他步进
    if (nodes.length > 0 && nodes[0].mergedTo && nodes[0].mergedTo[stepIndex] !== -1) {
      // 如果该步进被合并，使用它所合并到的步进
      stepIndex = nodes[0].mergedTo[stepIndex];
    }

    // 检查该步进是否已激活
    if (nodes.length > 0 && nodes[0].alpha && nodes[0].alpha[stepIndex] > 0.5) {
      // 如果步进已激活，标记开始拖动
      dragState.isDragging = true;
      dragState.stepIndex = stepIndex;
      dragState.lastY = mouseY;
      dragState.lastX = mouseX; // 记录初始X坐标
      dragState.dragMode = null; // 初始时不确定拖动模式
    }
  }

  return true;
}

// 鼠标拖动处理
function mouseDragged() {
  // 如果合成器UI可见，处理ADSR节点拖拽
  if (metronome.synthUI && metronome.synthUI.visible) {
    if (metronome.handleSynthMouseDragged(mouseX, mouseY)) return true;
  }

  // 如果步进器不可见，完全禁止所有鼠标事件处理
  if (!window.rhythmVisible || window.p5CanvasOpacity === 0) {
    return false;
  }

  // 检查是否点击了BPM控制器
  if (ui.bpmControl.isDragging) {
    // 计算拖动距离
    const deltaY = ui.bpmControl.dragStartY - mouseY;

    // 转换为BPM变化量（每拖动1像素改变1BPM）
    const bpmChange = Math.floor(deltaY / 2); // 除以2使调整更平滑

    // 计算新的BPM值
    const newBpm = constrain(ui.bpmControl.dragStartBpm + bpmChange, 30, 300);

    // 如果BPM有变化，更新本地值
    if (newBpm !== ui.bpmControl.value) {
      // 只更新本地UI值，不调用updateBPM来避免同步
      ui.bpmControl.value = newBpm;
      metronome.bpm = newBpm;
      metronome.calculateInterval();

      // 映射BPM到运镜路径速度
      if (typeof window.updateCameraPathSpeed === 'function') {
        const pathSpeed = newBpm / 60;
        const clampedPathSpeed = constrain(pathSpeed, 0.5, 5.0);
        window.updateCameraPathSpeed(clampedPathSpeed);
      }
    }

    return true;
  }

  // 如果当前正在拖动步进点
  if (dragState.isDragging && dragState.stepIndex !== -1) {
    // 确保五线谱中的高亮状态保持，即使在拖动过程中
    if (window.abcjs && typeof window.abcjs.highlightNote === 'function') {
      const mappedIndex = getMappedNoteIndex(dragState.stepIndex);
      window.abcjs.highlightNote(mappedIndex);
    }

    // 计算垂直和水平移动距离
    const deltaY = dragState.lastY - mouseY;
    const deltaX = mouseX - dragState.lastX;

    // 确定拖动模式：如果尚未确定，则根据初始移动方向确定
    if (dragState.dragMode === null) {
      if (abs(deltaY) >= 5) {
        dragState.dragMode = 'pitch'; // 垂直拖动 - 调整音高
      } else if (abs(deltaX) >= 5) {
        dragState.dragMode = 'duration'; // 水平拖动 - 调整持续时间
      } else {
        // 即使在等待确定拖动模式的阶段，也要保持高亮状态
        if (window.abcjs && typeof window.abcjs.highlightNote === 'function') {
          const mappedIndex = getMappedNoteIndex(dragState.stepIndex);
          window.abcjs.highlightNote(mappedIndex);
        }
        return true; // 移动距离太小，暂不确定模式
      }
    }

    // 根据拖动模式执行不同的操作
    if (dragState.dragMode === 'pitch') {
      // 垂直移动操作 - 调整音高
      _handlePitchDrag(deltaY);
    } else if (dragState.dragMode === 'duration') {
      // 水平移动操作 - 调整持续时间
      _handleDurationDrag(deltaX);
    }
  }

  return true;
}

// 内部辅助：处理音高拖拽
function _handlePitchDrag(deltaY) {
  // 垂直移动超过一定阈值才改变音高
  if (abs(deltaY) >= 3) { // 3像素的阈值
    // 向上拖动增加音高，向下拖动降低音高
    const pitchChange = deltaY > 0 ? 1 : -1;

    // 更新节点的音高偏移
    if (nodes.length > 0 && nodes[0].pitchOffset) {
      // 限制音高偏移范围在-12到12之间
      const currentPitch = nodes[0].pitchOffset[dragState.stepIndex];
      const newPitch = constrain(currentPitch + pitchChange, -12, 12);

      // 只有音高确实发生变化时才更新
      if (newPitch !== currentPitch) {
        nodes[0].pitchOffset[dragState.stepIndex] = newPitch;

        // 标记实际发生了拖动（音高变化）
        dragState.hadPitchChange = true;

        // 更新本地五线谱
        triggerLocalAbcUpdate();

        // 声音反馈
        if (typeof metronome !== 'undefined' && metronome.presetSounds) {
          const synthIndex = Math.min(ui.currentPattern, metronome.presetSounds.length - 1);

          // 获取当前预设插槽的八度设置
          const currentPresetIndex = ui.currentPattern;
          const baseNote = metronome.baseNotes[currentPresetIndex] || 'C4';

          // 使用Tone.js的音符生成方式替代手动频率计算
          try {
            // 计算实际音符，加入音高偏移
            const noteOffset = newPitch;

            // 使用Tone.js的Frequency API计算实际音符
            const actualNote = Tone.Frequency(baseNote).transpose(noteOffset);

            // 使用当前预设的Tone合成器播放声音
            const synth = metronome.presetSounds[synthIndex];

            // 短促播放音符作为反馈
            synth.triggerAttackRelease(actualNote, 0.1, Tone.now());

          } catch (e) {
            console.warn('拖拽音高反馈失败:', e);
          }
        }
      }
    }

    // 更新lastY
    dragState.lastY = mouseY;
  }

  // 无论是否有实际的音高变化，始终保持音符高亮状态
  if (window.abcjs && typeof window.abcjs.highlightNote === 'function') {
    const mappedIndex = getMappedNoteIndex(dragState.stepIndex);
    window.abcjs.highlightNote(mappedIndex);
  }
}

// 内部辅助：处理持续时间拖拽
function _handleDurationDrag(deltaX) {
  // 水平移动超过一定阈值才改变持续时间
  if (abs(deltaX) >= 3) { // 3像素的阈值
    // 根据当前持续时间动态调整变化量
    let durationChange;
    const currentDuration = nodes[0].duration ? nodes[0].duration[dragState.stepIndex] : 1.0;

    if (currentDuration > 4.0) {
      durationChange = deltaX > 0 ? 0.5 : -0.5;
    } else if (currentDuration > 1.0) {
      durationChange = deltaX > 0 ? 0.1 : -0.1;
    } else {
      durationChange = deltaX > 0 ? 0.05 : -0.05;
    }

    // 更新节点的持续时间
    if (nodes.length > 0 && nodes[0].duration) {
      // 限制持续时间范围在0.05(5%)到16.0(1600%)之间
      const newDuration = constrain(currentDuration + durationChange, 0.05, 16.0);

      // 只有持续时间确实发生变化时才更新
      if (abs(newDuration - currentDuration) > 0.001) {
        nodes[0].duration[dragState.stepIndex] = newDuration;

        // 处理合并标记的更新
        if (nodes[0].mergedTo) {
          _updateMergeMarkers(dragState.stepIndex, newDuration);
        }

        // 标记实际发生了拖动（持续时间变化）
        dragState.hadDurationChange = true;

        // 更新本地五线谱
        triggerLocalAbcUpdate();
      }
    }

    // 更新lastX
    dragState.lastX = mouseX;
  }

  // 无论是否有实际的持续时间变化，始终保持音符高亮状态
  if (window.abcjs && typeof window.abcjs.highlightNote === 'function') {
    const mappedIndex = getMappedNoteIndex(dragState.stepIndex);
    window.abcjs.highlightNote(mappedIndex);
  }
}

// 内部辅助：更新合并标记
function _updateMergeMarkers(stepIndex, newDuration) {
  // 首先清除之前可能存在的所有合并标记
  for (let i = 0; i < nodes[0].mergedTo.length; i++) {
    if (nodes[0].mergedTo[i] === stepIndex) {
      nodes[0].mergedTo[i] = -1;
    }
  }

  // 如果持续时间超过1.0，设置后续步进的合并标记
  if (Math.abs(newDuration - 16.0) < 0.001) {
    // 特殊处理最大持续时间16.0的情况
    for (let i = 1; i < ui.stepCount; i++) {
      const targetIndex = (stepIndex + i) % ui.stepCount;
      nodes[0].mergedTo[targetIndex] = stepIndex;
    }
  } else if (Math.ceil(newDuration) >= ui.stepCount) {
    // 处理超过一圈的情况
    for (let i = 1; i < ui.stepCount; i++) {
      const targetIndex = (stepIndex + i) % ui.stepCount;
      nodes[0].mergedTo[targetIndex] = stepIndex;
    }
  } else {
    // 正常处理其他情况
    const fullStepsOccupied = Math.ceil(newDuration);
    for (let i = 1; i < fullStepsOccupied; i++) {
      const targetIndex = (stepIndex + i) % ui.stepCount;
      nodes[0].mergedTo[targetIndex] = stepIndex;
    }
  }
}

// 鼠标松开处理
function mouseReleased() {
  // 如果合成器UI可见，处理ADSR节点拖拽
  if (metronome.synthUI && metronome.synthUI.visible) {
    metronome.handleSynthMouseReleased();
  }

  // 重置BPM控制拖动状态
  if (ui.bpmControl.isDragging) {
    // 在拖动结束时，如果有修改，同步BPM值
    updateBPM(ui.bpmControl.value);
    ui.bpmControl.isDragging = false;
  }

  // 如果步进器不可见，完全禁止所有鼠标事件处理
  if (!window.rhythmVisible || window.p5CanvasOpacity === 0) {
    return false;
  }

  // 如果之前在拖动步进点
  if (dragState.isDragging || dragState.wasDragging) {
    // 保存当前步进索引，以便下面使用
    const stepIndex = dragState.stepIndex;

    // 标记拖动已完成但刚刚结束
    dragState.isDragging = false;

    // 只有当实际发生了拖动时，才设置wasDragging为true
    dragState.wasDragging = dragState.hadPitchChange || dragState.hadDurationChange;

    // 如果有实际拖拽发生，激活拖拽保护
    if (dragState.wasDragging) {
      dragState.dragProtectionActive = true;
      dragState.releaseTime = millis();
    }

    // 保存当前预设 - 确保数据已保存到内存中
    window.saveCurrentPreset();

    // 首先检查是否有权限同步此插槽
    const hasPermission = window.canEditColyseusSlot ? window.canEditColyseusSlot(ui.currentPattern) :
                         (window.presetManager &&
                          typeof window.presetManager.canEditSlot === 'function' &&
                          window.presetManager.canEditSlot(ui.currentPattern));

    // 只有在鼠标释放后才同步数据
    if (hasPermission && window.notifyStepChange && dragState.wasDragging) {
      // 拖拽完成后同步数据到服务器
      window.notifyStepChange(ui.currentPattern);
    }

    // 只有当有权限时才执行实际的同步操作
    if (hasPermission) {

      // 1. 直接调用最优先级的即时同步函数
      if (window.syncImmediately && typeof window.syncImmediately === 'function') {
        try {
          window.syncImmediately(ui.currentPattern);

        } catch (e) {
          console.error("即时同步失败:", e);
        }
      }

      // 2. 触发五线谱更新和网络同步 - 始终执行同步
      triggerCircleDataChange();

      // 3. 额外调用同步函数以确保数据立即同步到服务器
      if (window.notifyStepChange && typeof window.notifyStepChange === 'function') {
        // 立即同步
        window.notifyStepChange(ui.currentPattern);
      }

      // 4. 如果存在Colyseus直接同步函数，但只调用一次
      if (window.syncNodeChangesToServer && typeof window.syncNodeChangesToServer === 'function') {
        window.syncNodeChangesToServer();
      }

      // 5. 直接调用预设同步函数
      if (window.syncPresetToServer && typeof window.syncPresetToServer === 'function') {
        try {
          window.syncPresetToServer(ui.currentPattern);

        } catch (e) {
          console.error("预设同步失败:", e);
        }
      }

      // 新增：确保总览视图更新所有插槽的数据
      if (window.circleOverview && typeof window.circleOverview.updateSingleSlotData === 'function') {
        for (let slotIndex = 0; slotIndex < 8; slotIndex++) {
          window.circleOverview.updateSingleSlotData(slotIndex);
        }
      }
    } else {

      // 即使无权同步，也需要触发本地UI更新
      triggerLocalAbcUpdate();

      // 新增：确保总览视图更新所有插槽的数据
      if (window.circleOverview && typeof window.circleOverview.updateSingleSlotData === 'function') {
        for (let slotIndex = 0; slotIndex < 8; slotIndex++) {
          window.circleOverview.updateSingleSlotData(slotIndex);
        }
      }
    }

    // 清除标记
    dragState.hadPitchChange = false;
    dragState.hadDurationChange = false;

    // 即使没有变化，也更新一次本地五线谱
    triggerLocalAbcUpdate();

    // 拖动结束后，无论是否有更改，始终确保五线谱中的音符高亮状态正确
    if (window.abcjs && typeof window.abcjs.highlightNote === 'function' && stepIndex !== -1) {
      const mappedIndex = getMappedNoteIndex(stepIndex);
      window.abcjs.highlightNote(mappedIndex);
    }

    // 延时后将步进索引设为悬停状态，保持UI一致性
    if (stepIndex !== -1) {
      ui.stepSequencer.hoveredStep = stepIndex;
    }
  }

  return true;
}

// mouseClicked 和 keyPressed 已移至 ClickHandler.js
