/**
 * SynthUIRenderer.js
 * 合成器 UI 渲染、BPM控制、音高控制、按钮绘制
 * 从 Sketch.js 拆分而来
 */

// 绘制背景
function drawBackground() {
  // 移除深色背景，保持透明
}

// 绘制主面板
function drawPanel(x, y, w, h) {
  push();
  fill(40, 150); // 与环形背景相同的颜色，添加半透明效果
  stroke(30, 180); // 与内部中心圆颜色一致的深色，半透明
  strokeWeight(2);
  rect(x, y, w, h, 10);
  pop();
}

// 绘制标题
function drawTitle(x, y, title) {
  push();

  fill(200, 220); // 添加一点透明度
  textSize(20);
  textAlign(CENTER);
  text(title, x, y + 5);
  pop();
}

// 更新绘制模式选择器函数，添加悬停效果和指示当前预设是否有数据
function drawPatternSelector() {
  push();

  // 确保每次绘制时都获取最新的控制状态
  let currentControlledSlot = -1;
  let currentUserId = "";

  // 从多个可能的来源获取控制状态
  if (window.colyseusSlotStates && window.colyseusSlotStates.mySlot !== undefined) {
    currentControlledSlot = window.colyseusSlotStates.mySlot;
    currentUserId = window.sessionId || "";
  } else if (window.controlledSlotIndex !== undefined) {
    currentControlledSlot = window.controlledSlotIndex;
    currentUserId = window.myUserId || "";
  } else if (window.presetManager && window.presetManager.controlledSlotIndex !== undefined) {
    currentControlledSlot = window.presetManager.controlledSlotIndex;
    currentUserId = window.presetManager.myUserId || "";
  }

  for (let i = 0; i < ui.patternSelector.buttons.length; i++) {
    let button = ui.patternSelector.buttons[i];

    // 检查当前预设是否有数据
    let hasData = presetPatterns[i] &&
                  presetPatterns[i].variants &&
                  presetPatterns[i].variants.length > 0 &&
                  presetPatterns[i].variants[0].length > 0;

    // 获取此预设插槽的固定颜色
    let slotColor = color(presetSlotColors[i]);

    // 检查是否可编辑此插槽
    const isEditable = i === currentControlledSlot;

    // 检查此插槽是否被占用
    let isOwned = false;
    let slotOwnerId = "";

    if (window.colyseusSlotStates && window.colyseusSlotStates.data && window.colyseusSlotStates.data.slots) {
      isOwned = window.colyseusSlotStates.data.slots[i] !== undefined &&
               window.colyseusSlotStates.data.slots[i] !== null &&
               window.colyseusSlotStates.data.slots[i] !== "";
      slotOwnerId = isOwned ? window.colyseusSlotStates.data.slots[i] : "";
    } else if (window.slotOwners) {
      isOwned = window.slotOwners[i] !== undefined &&
               window.slotOwners[i] !== null &&
               window.slotOwners[i] !== "";
      slotOwnerId = isOwned ? window.slotOwners[i] : "";
    } else if (window.presetManager && window.presetManager.slotOwners) {
      isOwned = window.presetManager.slotOwners[i] !== undefined &&
               window.presetManager.slotOwners[i] !== null &&
               window.presetManager.slotOwners[i] !== "";
      slotOwnerId = isOwned ? window.presetManager.slotOwners[i] : "";
    }

    // 特殊情况：如果当前用户控制着这个插槽
    if (i === currentControlledSlot) {
      isOwned = true;
      slotOwnerId = currentUserId;
    }

    let isControlledByMe = isOwned && slotOwnerId === currentUserId;

    const isCurrentlyViewing = i === ui.currentPattern;

    // 按钮背景
    if (i === ui.currentPattern) {
      if (isEditable) {
        fill(slotColor);
      } else {
        slotColor.setAlpha(180);
        fill(slotColor);
      }
    } else if (i === ui.patternSelector.hoveredButton) {
      let hoverColor = color(presetSlotColors[i]);
      if (!isEditable && isOwned) {
        hoverColor = color(80, 80, 80, 180);
      } else {
        hoverColor.setAlpha(180);
      }
      fill(hoverColor);
    } else {
      let normalColor = color(presetSlotColors[i]);
      if (!isEditable && isOwned) {
        normalColor = color(60, 60, 60, 80);
      } else if (hasData) {
        normalColor.setAlpha(120);
      } else {
        normalColor.setAlpha(80);
      }
      fill(normalColor);
    }

    stroke(30, 180);
    strokeWeight(1);
    rect(button.x, button.y, button.w, button.h);

    // 按钮文字
    fill(hasData ? 255 : 200);
    textSize(16);
    textAlign(CENTER, CENTER);
    text(button.value, button.x + button.w/2, button.y + button.h/2);

    // 显示控制状态指示器
    if (isOwned) {
      if (isControlledByMe || i === currentControlledSlot || slotOwnerId === "") {
        noFill();
        stroke(255, 255, 0, 220);
        strokeWeight(2);
        rect(button.x - 1, button.y - 1, button.w + 2, button.h + 2);
      } else {
        fill(255, 220);
        textSize(8);
        textAlign(CENTER, BOTTOM);
        text("x", button.x + button.w/2, button.y - 2);
      }
    }
  }

  // 绘制变体选择器部分
  const currentSlot = ui.currentPattern;
  if (window.presetManager && window.presetManager.patterns &&
      window.presetManager.patterns[currentSlot]) {
    const slotData = window.presetManager.patterns[currentSlot];
    const currentVariant = slotData.currentVariant;
    const variantCount = slotData.variants.length;

    let totalWidth = 0;
    const buttonWidth = ui.variantSelector.buttonWidth;
    const buttonSpacing = 3;
    const addButtonWidth = buttonWidth;

    if (variantCount < window.presetManager.maxVariantsPerSlot) {
      totalWidth = variantCount * buttonWidth + (variantCount) * buttonSpacing + addButtonWidth;
    } else {
      totalWidth = variantCount * buttonWidth + (variantCount - 1) * buttonSpacing;
    }

    let startX = ui.centerX - totalWidth / 2;

    // 绘制变体按钮
    for (let i = 0; i < ui.variantSelector.buttons.length; i++) {
      let button = ui.variantSelector.buttons[i];

      if (i === currentVariant) {
        fill(presetSlotColors[currentSlot]);
      } else if (i === ui.variantSelector.hoveredButton) {
        fill(70, 200);
      } else {
        fill(50, 180);
      }

      stroke(30, 180);
      strokeWeight(1);
      rect(button.x, button.y, button.w, button.h, 3);

      fill(255, 220);
      textSize(10);
      textAlign(CENTER, CENTER);
      text(button.value, button.x + button.w/2, button.y + button.h/2);

      // 如果有多个变体且鼠标悬停在按钮上，绘制删除图标
      if (variantCount > 1 && i === ui.variantSelector.hoveredButton) {
        fill(244, 67, 54);
        noStroke();
        ellipse(button.x + button.w - 3, button.y + 3, 8, 8);

        fill(255);
        textSize(6);
        textAlign(CENTER, CENTER);
        text("x", button.x + button.w - 3, button.y + 2);
      }
    }

    // 如果未达到最大变体数量，绘制添加按钮
    if (variantCount < window.presetManager.maxVariantsPerSlot) {
      const addButton = {
        x: startX + variantCount * (buttonWidth + buttonSpacing),
        y: ui.variantSelector.y,
        w: addButtonWidth,
        h: ui.variantSelector.height
      };

      ui.variantSelector.addButton = addButton;

      const isHovered = mouseX >= addButton.x && mouseX <= addButton.x + addButton.w &&
                       mouseY >= addButton.y && mouseY <= addButton.y + addButton.h;

      fill(isHovered ? color(100, 200) : color(70, 180));
      stroke(30, 180);
      strokeWeight(1);
      rect(addButton.x, addButton.y, addButton.w, addButton.h, 3);

      fill(255, 220);
      textSize(12);
      textAlign(CENTER, CENTER);
      text("+", addButton.x + addButton.w/2, addButton.y + addButton.h/2 - 1);
    } else {
      ui.variantSelector.addButton = null;
    }
  }

  pop();
}

// 更新绘制分辨率控制函数，添加加减按钮
function drawResolution() {
  push();

  // 背景框
  fill(40, 180);
  stroke(30, 180);
  strokeWeight(1);
  rect(ui.centerX - 80, ui.resolution.rect.y, 160, 30, 5);

  // 文本显示
  fill(200);
  textAlign(CENTER, CENTER);
  textSize(16);
  text("Res: " + ui.resolution.value, ui.centerX, ui.resolution.rect.y + 15);

  const buttonFill = 40;
  const hoverFill = 50;

  // 减少按钮
  fill(ui.resolution.minusHovered ? hoverFill : buttonFill, 180);
  stroke(30, 180);
  strokeWeight(1);
  rect(ui.resolution.minusX, ui.resolution.rect.y, 30, 30, 5, 0, 0, 5);
  fill(200);
  textAlign(CENTER, CENTER);
  text("-", ui.resolution.minusX + 15, ui.resolution.rect.y + 15);

  // 增加按钮
  fill(ui.resolution.plusHovered ? hoverFill : buttonFill, 180);
  stroke(30, 180);
  strokeWeight(1);
  rect(ui.resolution.plusX, ui.resolution.rect.y, 30, 30, 0, 5, 5, 0);
  fill(200);
  textAlign(CENTER, CENTER);
  text("+", ui.resolution.plusX + 15, ui.resolution.rect.y + 15);

  pop();
}

// 绘制BPM控制
function drawBpmControl() {
  push();

  // 背景框
  fill(40, 180);
  stroke(30, 180);
  strokeWeight(1);
  rect(ui.centerX - 80, ui.bpmControl.y, 160, 30, 5);

  // 根据悬停/拖动状态改变BPM值区域的颜色
  if (ui.bpmControl.isDragging) {
    fill(70, 180);
  } else if (ui.bpmControl.hovered) {
    fill(50, 180);
  } else {
    fill(40, 180);
  }

  // 绘制BPM值区域
  stroke(30, 180);
  rect(ui.centerX - 80, ui.bpmControl.rect.y, 160, ui.bpmControl.rect.h, 3);

  // 文本显示
  fill(200);
  textAlign(CENTER, CENTER);
  textSize(16);

  if (ui.bpmControl.isEditing) {
    text(ui.bpmControl.editValue + "|", ui.centerX, ui.bpmControl.y + 15);

    fill(200, 200, 0);
    textSize(10);
    text("按回车确认", ui.centerX, ui.bpmControl.y - 10);
  } else {
    text("BPM: " + ui.bpmControl.value, ui.centerX, ui.bpmControl.y + 15);
  }

  pop();
}

// 替换原有的drawPitchControlButton函数
function drawPitchControlButton() {
  push();

  const currentPresetIndex = ui.currentPattern;

  // 获取当前预设的音高设置
  const baseNote = metronome.baseNotes[currentPresetIndex] || 'C4';

  const match = baseNote.match(/([A-G][#b]?)(\d+)/);
  const octave = match ? match[2] : '4';

  // 背景框
  fill(40, 180);
  stroke(30, 180);
  strokeWeight(1);
  rect(ui.pitchControl.octaveControl.rect.x, ui.pitchControl.octaveControl.y, ui.pitchControl.octaveControl.rect.w, ui.pitchControl.octaveControl.rect.h, 5);

  // 文本显示
  fill(200);
  textAlign(CENTER, CENTER);
  textSize(16);
  text("Octave: C" + octave, ui.centerX, ui.pitchControl.octaveControl.y + 15);

  const buttonFill = 40;
  const hoverFill = 50;

  // 减少按钮
  fill(ui.pitchControl.octaveControl.minusHovered ? hoverFill : buttonFill, 180);
  stroke(30, 180);
  strokeWeight(1);
  rect(ui.pitchControl.octaveControl.minusX, ui.pitchControl.octaveControl.y, 30, 30, 5, 0, 0, 5);
  fill(200);
  textAlign(CENTER, CENTER);
  text("-", ui.pitchControl.octaveControl.minusX + 15, ui.pitchControl.octaveControl.y + 15);

  // 增加按钮
  fill(ui.pitchControl.octaveControl.plusHovered ? hoverFill : buttonFill, 180);
  stroke(30, 180);
  strokeWeight(1);
  rect(ui.pitchControl.octaveControl.plusX, ui.pitchControl.octaveControl.y, 30, 30, 0, 5, 5, 0);
  fill(200);
  textAlign(CENTER, CENTER);
  text("+", ui.pitchControl.octaveControl.plusX + 15, ui.pitchControl.octaveControl.y + 15);

  pop();
}

// 绘制合成器按钮
function drawSynthButton() {
  push();

  if (ui.synthButton.hovered) {
    fill(70, 70, 90, 220);
    stroke(100, 100, 120);
  } else {
    fill(50, 50, 70, 200);
    stroke(80, 80, 100);
  }

  strokeWeight(2);
  rect(ui.synthButton.x, ui.synthButton.y, ui.synthButton.width, ui.synthButton.height, 5);

  fill(220);
  textSize(14);
  textAlign(CENTER, CENTER);
  text(metronome.synthUI.visible ? "Hide Synth" : "Show Synth",
       ui.synthButton.x + ui.synthButton.width / 2,
       ui.synthButton.y + ui.synthButton.height / 2);

  pop();
}

// 添加新函数drawClearButton用于绘制Clear Rhythm按钮
function drawClearButton() {
  push();

  const buttonWidth = 160;
  const buttonHeight = 30;
  const buttonX = ui.centerX - buttonWidth/2;
  const buttonY = ui.bpmControl.y - buttonHeight - 10;

  const isHovered = mouseX >= buttonX && mouseX <= buttonX + buttonWidth &&
                   mouseY >= buttonY && mouseY <= buttonY + buttonHeight;

  if (isHovered) {
    fill(70, 180);
  } else {
    fill(40, 180);
  }

  stroke(30, 180);
  strokeWeight(1);
  rect(buttonX, buttonY, buttonWidth, buttonHeight, 5);

  fill(200);
  textAlign(CENTER, CENTER);
  textSize(16);
  text("Clear Rhythm", ui.centerX, buttonY + buttonHeight/2);

  // 存储按钮信息
  ui.clearButton = {
    x: buttonX,
    y: buttonY,
    width: buttonWidth,
    height: buttonHeight,
    hovered: isHovered
  };

  pop();
}

// 绘制导入/导出按钮
function drawImportExportButton() {
  push();

  if (ui.importExportButton.hovered) {
    fill(70, 70, 90, 220);
    stroke(100, 100, 120);
  } else {
    fill(50, 50, 70, 200);
    stroke(80, 80, 100);
  }

  strokeWeight(2);
  rect(ui.importExportButton.x, ui.importExportButton.y, ui.importExportButton.width, ui.importExportButton.height, 5);

  fill(220);
  textSize(14);
  textAlign(CENTER, CENTER);
  text("Import/Export",
       ui.importExportButton.x + ui.importExportButton.width / 2,
       ui.importExportButton.y + ui.importExportButton.height / 2);

  pop();
}

// 新增函数：绘制OSC连接状态指示
function drawOscStatus() {
  if (isOscConnected) {
    push();
    noStroke();
    fill(156, 39, 176);
    ellipse(width - 15, 15, 10, 10);
    pop();
  }
}
