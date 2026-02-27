/**
 * ClickHandler.js
 * mouseClicked 和 keyPressed 事件处理
 * 从 InputHandler.js 进一步拆分
 */

// 修改mouseClicked函数
function mouseClicked() {
  // metronome 异步初始化，未就绪前跳过
  if (typeof metronome === 'undefined' || !metronome) return false;

  // 检查用户是否有权限点击交互
  if (window.isUserAllowedToClick && !window.isUserAllowedToClick(mouseX, mouseY)) {
    if (window.colyseusConnected && window.colyseusSlotStates && window.colyseusSlotStates.mySlot === -1) {
      if (typeof window.showSlotSelectionDialog === 'function' && !window.slotDialogShown) {
        window.slotDialogShown = true;
        window.showSlotSelectionDialog();
      }
    }
    return false;
  }

  // 如果合成器UI可见，处理合成器UI的点击
  if (metronome.synthUI.visible) {
    return metronome.handleSynthMouseClicked(mouseX, mouseY);
  }

  // 检查是否点击了导入/导出按钮
  if (ui.importExportButton.hovered) {
    if (window.patternImportExport && typeof window.patternImportExport.showImportExportDialog === 'function') {
      window.patternImportExport.showImportExportDialog(ui.currentPattern);
    }
    return;
  }

  // 检查是否点击了合成器按钮
  if (ui.synthButton.hovered) {
    metronome.synthUI.visible = !metronome.synthUI.visible;

    if (metronome.synthUI.visible) {
      window.rhythmVisible = false;
      window.dispatchEvent(new CustomEvent('synth-ui-visibility-change', {
        detail: { visible: true }
      }));
    } else {
      window.rhythmVisible = true;
      window.dispatchEvent(new CustomEvent('synth-ui-visibility-change', {
        detail: { visible: false }
      }));
    }

    return;
  }

  // 如果步进器不可见，完全禁止所有鼠标事件处理
  if (!window.rhythmVisible || window.p5CanvasOpacity === 0) {
    return false;
  }

  // 添加拖拽保护
  const currentTime = millis();
  if (dragState.dragProtectionActive) {
    if (currentTime - dragState.releaseTime < 300) {
      if (currentTime - dragState.releaseTime >= 270) {
        dragState.dragProtectionActive = false;
        dragState.wasDragging = false;
      }
      return false;
    } else {
      dragState.dragProtectionActive = false;
      dragState.wasDragging = false;
    }
  }

  if (dragState.wasDragging) {
    dragState.wasDragging = false;
  }

  // 检查是否点击了模式选择器按钮
  for (let i = 0; i < ui.patternSelector.buttons.length; i++) {
    let button = ui.patternSelector.buttons[i];
    if (mouseX >= button.x && mouseX <= button.x + button.w &&
        mouseY >= button.y && mouseY <= button.y + button.h) {

      if (nodes.length > 0) {
        window.saveCurrentPreset();
      }

      loadPreset(i);

      window.dispatchEvent(new CustomEvent('pattern-change', {
        detail: { patternIndex: i }
      }));

      return;
    }
  }

  // 检查是否点击了变体选择器的添加按钮
  if (ui.variantSelector.addButton) {
    const addButton = ui.variantSelector.addButton;
    if (mouseX >= addButton.x && mouseX <= addButton.x + addButton.w &&
        mouseY >= addButton.y && mouseY <= addButton.y + addButton.h) {

      const currentSlot = ui.currentPattern;

      const wasDragging = window.isDraggingInOverview;
      window.isDraggingInOverview = false;

      const currentVariantIndex = window.presetManager.patterns[currentSlot].currentVariant;

      window.presetManager.saveCurrentPreset(currentSlot, null, currentVariantIndex);

      const variants = window.presetManager.patterns[currentSlot].variants;
      const newVariantIndex = variants.length;
      window.presetManager.saveCurrentPreset(currentSlot, [], newVariantIndex);

      window.presetManager.loadPreset(currentSlot, newVariantIndex);

      triggerCircleDataChange();

      setTimeout(() => {
        window.isDraggingInOverview = wasDragging;
      }, 100);

      return;
    }
  }

  // 检查是否点击了变体选择器按钮
  for (let i = 0; i < ui.variantSelector.buttons.length; i++) {
    let button = ui.variantSelector.buttons[i];
    if (mouseX >= button.x && mouseX <= button.x + button.w &&
        mouseY >= button.y && mouseY <= button.y + button.h) {

      const currentSlot = ui.currentPattern;

      const wasDragging = window.isDraggingInOverview;
      window.isDraggingInOverview = false;

      const variants = window.presetManager.patterns[currentSlot].variants;

      // 检查是否点击了删除按钮区域
      if (variants.length > 1 &&
          mouseX >= button.x + button.w - 8 && mouseX <= button.x + button.w &&
          mouseY >= button.y && mouseY <= button.y + 8) {

        const currentVariantIndex = window.presetManager.patterns[currentSlot].currentVariant;
        variants.splice(i, 1);

        if (i === currentVariantIndex) {
          window.presetManager.patterns[currentSlot].currentVariant = i > 0 ? i - 1 : 0;
        } else if (i < currentVariantIndex) {
          window.presetManager.patterns[currentSlot].currentVariant--;
        }

        window.presetManager.loadPreset(currentSlot, window.presetManager.patterns[currentSlot].currentVariant);
        triggerCircleDataChange();

        if (window.circleOverview && typeof window.circleOverview.updateSingleSlotData === 'function') {
          for (let slotIndex = 0; slotIndex < 8; slotIndex++) {
            window.circleOverview.updateSingleSlotData(slotIndex);
          }
        }
      } else {
        const currentVariantIndex = window.presetManager.patterns[currentSlot].currentVariant;

        if (i !== currentVariantIndex) {
          window.presetManager.saveCurrentPreset(currentSlot, null, currentVariantIndex);
          window.presetManager.loadPreset(currentSlot, i);
          triggerCircleDataChange();
        }
      }

      setTimeout(() => {
        window.isDraggingInOverview = wasDragging;
      }, 100);

      return;
    }
  }

  // 检查鼠标位置相对于中心的距离
  let dx = mouseX - ui.centerX;
  let dy = mouseY - ui.centerY;
  let distToCenter = sqrt(dx*dx + dy*dy);

  // 如果步进器不可见，跳过步进器相关的点击处理
  if (!window.rhythmVisible) {
    if (distToCenter <= ui.innerRadius) {
      metronome.beatToggle();
      return;
    }

    if (mouseY >= ui.bpmControl.y && mouseY <= ui.bpmControl.y + 30) {
      if (mouseX >= ui.centerX - 80 && mouseX <= ui.centerX + 80) {
        if (!ui.bpmControl.isEditing && !ui.bpmControl.isDragging) {
          ui.bpmControl.isEditing = true;
          ui.bpmControl.editValue = ui.bpmControl.value.toString();
          return;
        }
        return;
      }
    }

    return;
  }

  // 检查是否点击了步进器
  if (distToCenter >= ui.innerRadius && distToCenter <= ui.stepRadius) {
    let angle = atan2(dy, dx) + HALF_PI;
    if (angle < 0) angle += TWO_PI;

    let stepIndex = floor(angle / TWO_PI * ui.stepCount) % ui.stepCount;

    if (nodes.length > 0 && nodes[0].mergedTo && nodes[0].mergedTo[stepIndex] !== -1) {
      stepIndex = nodes[0].mergedTo[stepIndex];
    }

    if (nodes.length === 0) {
      let selectedColor = presetSlotColors[ui.currentPattern];
      addRhythmPattern({
        index: 0,
        alpha: new Array(32).fill(0.1),
        color: selectedColor
      });
    }

    if (nodes[0].alpha) {
      const isActive = nodes[0].alpha[stepIndex] > 0.5;

      if (isActive) {
        nodes[0].alpha[stepIndex] = 0.1;
        if (nodes[0].pitchOffset) {
          nodes[0].pitchOffset[stepIndex] = 0;
        }
        if (nodes[0].duration) {
          nodes[0].duration[stepIndex] = 1.0;
        }
        if (nodes[0].mergedTo) {
          for (let i = 0; i < nodes[0].mergedTo.length; i++) {
            if (nodes[0].mergedTo[i] === stepIndex) {
              nodes[0].mergedTo[i] = -1;
            }
          }
        }
      } else {
        nodes[0].alpha[stepIndex] = 1.0;
      }

      window.saveCurrentPreset();
      triggerCircleDataChange();
    }

    return;
  }

  // 检查是否点击了中心圆（播放/暂停）
  if (distToCenter <= ui.innerRadius) {
    metronome.beatToggle();
    return;
  }

  // 检查是否点击了八度控制按钮
  if (mouseY >= ui.pitchControl.octaveControl.y && mouseY <= ui.pitchControl.octaveControl.y + 30) {
    const currentPresetIndex = ui.currentPattern;

    if (mouseX >= ui.pitchControl.octaveControl.minusX && mouseX <= ui.pitchControl.octaveControl.minusX + 30) {
      changePresetOctave(currentPresetIndex, -1);
      return;
    }
    else if (mouseX >= ui.pitchControl.octaveControl.plusX && mouseX <= ui.pitchControl.octaveControl.plusX + 30) {
      changePresetOctave(currentPresetIndex, 1);
      return;
    }
  }

  // 检查是否点击了Clear按钮
  if (ui.clearButton && ui.clearButton.hovered) {
    clearAllPatterns();
    return;
  }
}

function keyPressed() {
  // 如果BPM控制器处于编辑模式，处理输入
  if (ui.bpmControl.isEditing) {
    if (keyCode === ENTER || keyCode === RETURN) {
      const newBpm = parseInt(ui.bpmControl.editValue);
      if (!isNaN(newBpm) && newBpm >= 30 && newBpm <= 300) {
        updateBPM(newBpm);
      } else {
        ui.bpmControl.editValue = ui.bpmControl.value.toString();
      }
      ui.bpmControl.isEditing = false;
      return false;
    }
    else if (keyCode === ESCAPE) {
      ui.bpmControl.isEditing = false;
      return false;
    }
    else if (keyCode === BACKSPACE) {
      if (ui.bpmControl.editValue.length > 0) {
        ui.bpmControl.editValue = ui.bpmControl.editValue.slice(0, -1);
      }
      return false;
    }
    else if ((keyCode >= 48 && keyCode <= 57) || (keyCode >= 96 && keyCode <= 105)) {
      const digit = keyCode >= 96 ? keyCode - 96 : keyCode - 48;
      if (ui.bpmControl.editValue.length < 3) {
        ui.bpmControl.editValue += digit.toString();
      }
      return false;
    }

    return false;
  }

  // 检查是否有编辑权限
  const hasEditPermission = !isViewOnlyMode && controlledSlotIndex !== -1;

  // Toggle play/pause with spacebar
  if (keyCode === 32) { // Space
    metronome.beatToggle();
    return false;
  }

  // 以下按键需要编辑权限
  if (!hasEditPermission) {
    return false;
  }

  if (keyCode === 107 || keyCode === 187) { // + key
    if (ui.stepCount < maxSteps) {
      updateStepCount(ui.stepCount + 1);
    }
    return false;
  }

  else if (keyCode === 109 || keyCode === 189) { // - key
    if (ui.stepCount > minSteps) {
      updateStepCount(ui.stepCount - 1);
    }
    return false;
  }

  else if (keyCode === UP_ARROW) {
    updateBPM(metronome.bpm + 1);
    return false;
  }

  else if (keyCode === DOWN_ARROW) {
    updateBPM(metronome.bpm - 1);
    return false;
  }

  else if (keyCode === UP_ARROW && keyIsDown(SHIFT)) {
    updateBPM(metronome.bpm + 10);
    return false;
  }

  else if (keyCode === DOWN_ARROW && keyIsDown(SHIFT)) {
    updateBPM(metronome.bpm - 10);
    return false;
  }

  else if (keyCode === 113) { // F2
    metronome.beatToggle();
    return false;
  }

  else if (keyCode === 77) { // M key
    return false;
  }

  else if (keyCode === 68) { // D key
    if (!(window.canEditColyseusSlot ? window.canEditColyseusSlot(ui.currentPattern) :
          (window.presetManager && window.presetManager.canEditSlot ?
           window.presetManager.canEditSlot(ui.currentPattern) : false))) {
      return false;
    }

      const selectedColor = presetSlotColors[ui.currentPattern];
      createDefaultRhythm(selectedColor);
      window.syncSharedFromLocal();
    return false;
  }

  else if (keyCode === 84) { // T key
    metronome.beatToggle();
    return false;
  }

  else if (keyCode === 76) { // L key
    return false;
  }

  else if (keyCode === 67) { // C key
    if (!(window.canEditColyseusSlot ? window.canEditColyseusSlot(ui.currentPattern) :
          (window.presetManager && window.presetManager.canEditSlot ?
           window.presetManager.canEditSlot(ui.currentPattern) : false))) {
      return false;
    }

    nodes = [];
    window.syncSharedFromLocal();
    return false;
  }

  else if (keyCode === 83) { // S key
    if (isConnected) {
      if (window.showSlotSelectionDialog && typeof window.showSlotSelectionDialog === 'function') {
        window.showSlotSelectionDialog();
      }
    }
    return false;
  }

  // 变体切换快捷键 ([ 和 ] 键)
  if (keyCode === 219) { // [ 键
    const currentSlot = ui.currentPattern;
    if (window.presetManager) {
      window.presetManager.cycleVariant(currentSlot, -1);

      if (window.presetManager.patterns[currentSlot]) {
        ui.variantSelector.activeButton = window.presetManager.patterns[currentSlot].currentVariant;
      }

      ui.variantSelector.visible = true;

      if (window.colyseusConnected && window.presetManager.canEditSlot(currentSlot)) {
        if (window.syncPresetToServer && typeof window.syncPresetToServer === 'function') {
          window.syncPresetToServer(currentSlot);
        }
      }
    }
    return false;
  } else if (keyCode === 221) { // ] 键
    const currentSlot = ui.currentPattern;
    if (window.presetManager) {
      window.presetManager.cycleVariant(currentSlot, 1);

      if (window.presetManager.patterns[currentSlot]) {
        ui.variantSelector.activeButton = window.presetManager.patterns[currentSlot].currentVariant;
      }

      ui.variantSelector.visible = true;

      if (window.colyseusConnected && window.presetManager.canEditSlot(currentSlot)) {
        if (window.syncPresetToServer && typeof window.syncPresetToServer === 'function') {
          window.syncPresetToServer(currentSlot);
        }
      }
    }
    return false;
  }
}
