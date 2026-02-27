/**
 * CircleSequencer.js
 * 圆形序列器核心：setup/draw 生命周期、步进器绘制、UI位置更新、
 * 预设管理、分辨率/步数控制、OSC连接
 * 从 Sketch.js 拆分而来
 */

function preload() {
  // 预加载内容为空
}

function setup() {
  // 创建固定尺寸的画布，而不是自适应尺寸
  const fixedSize = 800;
  let canvas = createCanvas(fixedSize, fixedSize);
  canvas.parent('p5-container');

  // 确保canvas居中显示
  let p5Container = document.getElementById('p5-container');
  if (p5Container) {
    p5Container.style.display = 'flex';
    p5Container.style.justifyContent = 'center';
    p5Container.style.alignItems = 'center';
  }

  // 设置固定的缩放因子和直径
  scaleFactor = 1;
  diameter = fixedSize * 0.8;

  // AudioSequencer 通过 ES module 加载，可能还未就绪
  // 使用轮询等待机制确保兼容
  function initMetronome() {
    if (typeof window.AudioSequencer === 'undefined') {
      console.log('[CircleBeats] 等待 AudioSequencer 加载...');
      setTimeout(initMetronome, 50);
      return;
    }

    // initialize metronome
    metronome = new AudioSequencer(60, 100, 100);

    // 监听metronome-beat事件，用于与Tone.js Transport同步
    window.addEventListener('metronome-beat', function(e) {
      if (typeof metronome !== 'undefined') {
        const beatData = e.detail;
        redraw();
      }
    });

    // 确保音频上下文已解锁并准备好
    if (typeof userStartAudio === 'function') {
      userStartAudio().then(() => {
      }).catch(err => {
      });
    }

    // 设置初始分辨率
    metronome.setResolution("1/16");

    // 为所有预设插槽设置初始音高为C4
    if (metronome.baseNotes) {
      for (let i = 0; i < 8; i++) {
        metronome.baseNotes[i] = 'C4';
      }
    } else {
      metronome.baseNotes = ['C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4'];
    }

    // 应用初始BPM到运镜速度的映射
    setTimeout(() => {
      updateBPM(metronome.bpm);

      if (typeof window.setCameraAutoModeFromStepper === 'function') {
        window.setCameraAutoModeFromStepper(metronome.isPlaying);
      }
    }, 1000);

    // 在setup末尾添加，确保初始数据传递
    setTimeout(() => {
      try {
        if (nodes.length > 0) {
          const circleData = {
            nodes: nodes,
            currentPreset: ui.currentPattern,
            stepCount: ui.stepCount,
            resolution: ui.resolution.value,
            baseNote: metronome.baseNotes[ui.currentPattern] || 'C4'
          };

          const event = new CustomEvent('circle-data-change', {
            detail: circleData
          });
          window.dispatchEvent(event);
        }
      } catch (err) {
        console.error("初始化数据传递时出错:", err);
      }

      setTimeout(() => {
        try {
          if (window.circleOverview && typeof window.circleOverview.refresh === 'function') {
            window.circleOverview.refresh();
          }
        } catch (err) {
          console.error("初始化总览视图数据时出错:", err);
        }
      }, 1500);
    }, 2000);

    console.log('[CircleBeats] AudioSequencer 已初始化');
  }

  // 启动异步初始化
  initMetronome();

  // 设置当前预设为第一个预设插槽
  ui.currentPattern = 0;

  // 初始化音高控制相关数据
  ui.pitchControl.octaves = [1, 2, 3, 4, 5, 6, 7];
  ui.pitchControl.isVisible = false;
  ui.pitchControl.isDragging = false;

  // 初始化预设管理器
  if (window.presetManager) {
    const tempUserId = 'user_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    window.presetManager.init(tempUserId);

    // 确保预设管理器的变体数据结构正确初始化
    for (let i = 0; i < window.presetManager.patterns.length; i++) {
      if (!window.presetManager.patterns[i].hasOwnProperty('variants')) {
        const oldData = window.presetManager.patterns[i];
        window.presetManager.patterns[i] = {
          variants: [[]],
          currentVariant: 0
        };

        if (Array.isArray(oldData) && oldData.length > 0) {
          window.presetManager.patterns[i].variants[0] = JSON.parse(JSON.stringify(oldData));
        }
      }
    }

    // 更新全局引用
    window.presetPatterns = window.presetManager.patterns;
  }

  // 如果当前没有节点，添加一个使用预设1颜色的节点
  if (nodes.length === 0) {
    addRhythmPattern({
      index: 0,
      alpha: new Array(32).fill(0.1),
      color: window.presetManager ? window.presetManager.slotColors[0] : '#FF5252'
    });

    if (nodes.length > 0) {
      updateNodeColor(0, window.presetManager ? window.presetManager.slotColors[0] : '#FF5252');
    }
  } else if (nodes.length > 0) {
    updateNodeColor(0, window.presetManager ? window.presetManager.slotColors[0] : '#FF5252');
  }

  // 设置清除按钮
  setupClearButton();

  // 启用平滑处理
  smooth();

  // 初始化UI位置
  updateUIPositions();

  // 注册mouseOut事件处理
  canvas.mouseOut(mouseOut);

  // 确保变体选择器在初始化时可见
  ui.variantSelector.visible = true;
}

// Setup connection button
function setupConnectionButton() {
  const connectButton = document.getElementById('connect-button');
  if (connectButton) {
    connectButton.addEventListener('click', window.connectToParty);
  }
}

// New function: Update step count
function updateStepCount(newCount) {
  newCount = Math.max(2, Math.min(32, newCount));

  if (newCount === ui.stepCount) return;

  ui.stepCount = newCount;

  for (let node of nodes) {
    // 调整alpha数组
    if (node.alpha) {
      if (newCount < node.alpha.length) {
        node.alpha = node.alpha.slice(0, newCount);
      }
      else if (newCount > node.alpha.length) {
        const extension = new Array(newCount - node.alpha.length).fill(0.1);
        node.alpha = [...node.alpha, ...extension];
      }
    }

    // 同样处理pitchOffset数组
    if (node.pitchOffset) {
      if (newCount < node.pitchOffset.length) {
        node.pitchOffset = node.pitchOffset.slice(0, newCount);
      } else if (newCount > node.pitchOffset.length) {
        const extension = new Array(newCount - node.pitchOffset.length).fill(0);
        node.pitchOffset = [...node.pitchOffset, ...extension];
      }
    }

    // 同样处理duration数组
    if (node.duration) {
      if (newCount < node.duration.length) {
        node.duration = node.duration.slice(0, newCount);
      } else if (newCount > node.duration.length) {
        const extension = new Array(newCount - node.duration.length).fill(1.0);
        node.duration = [...node.duration, ...extension];
      }
    }

    // 同样处理mergedTo数组
    if (node.mergedTo) {
      if (newCount < node.mergedTo.length) {
        node.mergedTo = node.mergedTo.slice(0, newCount);
      } else if (newCount > node.mergedTo.length) {
        const extension = new Array(newCount - node.mergedTo.length).fill(-1);
        node.mergedTo = [...node.mergedTo, ...extension];
      }
    }
  }

  if (window.metronome) {
    metronome.updateLoopLength(newCount);
  }

  const event = new CustomEvent('step-count-change', {
    detail: { stepCount: newCount }
  });
  window.dispatchEvent(event);

  window.saveCurrentPreset();

  triggerCircleDataChange();
}

// New function: Update resolution
function updateResolution(newIndex) {
  ui.resolution.currentIndex = newIndex;
  ui.resolution.value = ui.resolution.values[newIndex];
  metronome.setResolution(ui.resolution.value);

  const resolutionChangeEvent = new CustomEvent('resolution-change', {
    detail: {
      value: ui.resolution.value,
      index: newIndex
    }
  });
  window.dispatchEvent(resolutionChangeEvent);

  const circleData = {
    nodes: nodes,
    currentPreset: ui.currentPattern
  };

  if (window.circleToABC && typeof window.circleToABC.convertToABC === 'function') {
    const abcNotation = window.circleToABC.convertToABC(circleData);

    if (window.abcjs && typeof window.abcjs.setTune === 'function') {
      window.abcjs.setTune(abcNotation);

      if (typeof window.abcjs.render === 'function') {
        window.abcjs.render();

        if (typeof window.abcjs.highlightNote === 'function') {
          const mappedIndex = getMappedNoteIndex(highlightIndex);
          window.abcjs.highlightNote(mappedIndex);
        }
      }
    }
  } else {
    triggerCircleDataChange();
  }
}

// Clear button event handler setup
function setupClearButton() {
  // 这个函数现在已经不需要了，保留空函数以确保兼容
}

// Window size change adjust canvas
function windowResized() {
  updateUIPositions();
  redraw();
}

function draw() {
  // metronome 异步初始化，未就绪前跳过绘制
  if (typeof metronome === 'undefined' || !metronome) {
    clear();
    return;
  }

  // 如果步进器设置为不可见，且画布透明度为0，则完全跳过绘制
  if (!window.rhythmVisible && window.p5CanvasOpacity === 0 && !metronome.synthUI.visible) {
    return;
  }

  clear();

  updateUIPositions();

  const shouldDrawUI = window.p5CanvasOpacity > 0;

  if (shouldDrawUI) {
    drawBackground();
    drawPanel(ui.panelX, ui.panelY, ui.panelWidth, ui.panelHeight);

    if (metronome.synthUI.visible) {
      metronome.drawSynthUI();
    } else if (window.rhythmVisible) {
      drawTitle(ui.centerX, ui.centerY - ui.panelHeight/2 + 30, "");
      drawImportExportButton();
      drawSynthButton();
      drawPatternSelector();
      drawStepSequencer();
      // drawResolution(); // 暂时注释掉分辨率控制，有BUG
      drawClearButton();
      drawBpmControl();
      drawPitchControlButton();
    }
  }
}

// 更新UI元素位置的函数，在draw中调用
function updateUIPositions() {
  ui.centerX = width / 2;
  ui.centerY = height / 2;
  ui.panelWidth = min(width * 0.8, 400);
  ui.panelHeight = min(height * 0.9, 600);
  ui.panelX = ui.centerX - ui.panelWidth/2;
  ui.panelY = ui.centerY - ui.panelHeight/2;
  ui.stepRadius = min(ui.panelWidth, ui.panelHeight) * 0.25;
  ui.innerRadius = ui.stepRadius * 0.5;

  // 更新导入/导出按钮位置
  ui.importExportButton.width = 100;
  ui.importExportButton.height = 30;
  ui.importExportButton.x = ui.panelX + 20;
  ui.importExportButton.y = ui.panelY + 20;

  // 更新合成器按钮位置
  ui.synthButton.width = 100;
  ui.synthButton.height = 30;
  ui.synthButton.x = ui.panelX + ui.panelWidth - ui.synthButton.width - 20;
  ui.synthButton.y = ui.panelY + 20;

  // 更新模式选择器位置
  ui.patternSelector.y = ui.centerY - ui.panelHeight/2 + 70;
  ui.patternSelector.buttons = [];

  let totalWidth = 8 * ui.patternSelector.buttonWidth + 7 * ui.patternSelector.spacing;
  let buttonStartX = ui.centerX - totalWidth / 2;

  for (let i = 1; i <= 8; i++) {
    let buttonX = buttonStartX + (i-1) * (ui.patternSelector.buttonWidth + ui.patternSelector.spacing);
    ui.patternSelector.buttons.push({
      x: buttonX,
      y: ui.patternSelector.y - 10,
      w: ui.patternSelector.buttonWidth,
      h: 20,
      value: i
    });
  }

  // 更新变体选择器位置
  ui.variantSelector.y = ui.patternSelector.y + 25;
  ui.variantSelector.buttons = [];

  let variantCount = 1;
  if (window.presetManager && window.presetManager.patterns &&
      window.presetManager.patterns[ui.currentPattern] &&
      window.presetManager.patterns[ui.currentPattern].variants) {
    variantCount = window.presetManager.patterns[ui.currentPattern].variants.length;
  }

  let variantButtonWidth = ui.variantSelector.buttonWidth;
  let variantSpacing = 3;
  let variantTotalWidth = variantCount * variantButtonWidth + (variantCount - 1) * variantSpacing;

  const maxVariants = window.presetManager ? window.presetManager.maxVariantsPerSlot : 8;
  if (variantCount < maxVariants) {
    variantTotalWidth += variantButtonWidth + variantSpacing;
  }

  let variantStartX = ui.centerX - variantTotalWidth / 2;

  for (let i = 0; i < variantCount; i++) {
    let buttonX = variantStartX + i * (variantButtonWidth + variantSpacing);
    ui.variantSelector.buttons.push({
      x: buttonX,
      y: ui.variantSelector.y,
      w: variantButtonWidth,
      h: ui.variantSelector.height,
      value: i + 1,
      isDeleteHovered: false
    });
  }

  // 设置活动变体按钮
  if (window.presetManager && window.presetManager.patterns &&
      window.presetManager.patterns[ui.currentPattern] &&
      window.presetManager.patterns[ui.currentPattern].hasOwnProperty('currentVariant')) {
    ui.variantSelector.activeButton = window.presetManager.patterns[ui.currentPattern].currentVariant;
  } else {
    ui.variantSelector.activeButton = 0;
  }

  ui.variantSelector.visible = true;
  ui.variantSelector.addButton = null;

  // 更新步进器位置
  const sequencerY = ui.centerY + ui.stepRadius + 10;

  // 更新步数控制位置
  ui.stepCountControls.y = sequencerY + 10;
  ui.stepCountControls.minusX = ui.centerX - 80;
  ui.stepCountControls.plusX = ui.centerX + 50;

  // 更新分辨率控制位置
  ui.resolution.rect = {
    x: ui.centerX - 80,
    y: ui.stepCountControls.y + 40,
    w: 160,
    h: 30
  };
  ui.resolution.minusX = ui.centerX - 80;
  ui.resolution.plusX = ui.centerX + 50;

  // 更新BPM控制位置
  ui.bpmControl.y = ui.resolution.rect.y + 40;
  ui.bpmControl.minusX = ui.centerX - 80;
  ui.bpmControl.plusX = ui.centerX + 50;
  ui.bpmControl.rect = {
    x: ui.centerX - 80,
    y: ui.bpmControl.y,
    w: 160,
    h: 30
  };

  // 更新八度控制位置
  ui.pitchControl.octaveControl.y = ui.bpmControl.y + 40;
  ui.pitchControl.octaveControl.minusX = ui.centerX - 80;
  ui.pitchControl.octaveControl.plusX = ui.centerX + 50;
  ui.pitchControl.octaveControl.rect = {
    x: ui.centerX - 80,
    y: ui.pitchControl.octaveControl.y,
    w: 160,
    h: 30
  };
}

// 更新绘制环形步进器函数
function drawStepSequencer() {
  if (!window.rhythmVisible) return;

  push();

  const canEdit = isEditable();

  // 绘制中心圆
  fill(30);
  stroke(30);
  strokeWeight(2);
  ellipse(ui.centerX, ui.centerY, ui.innerRadius * 2);

  // 绘制整个环形背景
  const borderWidth = 4;
  fill(40);
  noStroke();
  ellipse(ui.centerX, ui.centerY, ui.stepRadius * 2 - borderWidth);

  // 挖空中心区域形成环
  fill(30);
  noStroke();
  ellipse(ui.centerX, ui.centerY, ui.innerRadius * 2);

  const gapWidth = 3;

  // 获取当前节点的颜色
  let nodeColor = color(presetSlotColors[ui.currentPattern]);
  let nodeBeatColor = color(presetSlotColors[ui.currentPattern]);
  nodeBeatColor.setAlpha(180);

  if (nodes.length > 0) {
    nodeColor = color(nodes[0].color);

    if (nodes[0].beatColor) {
      if (Array.isArray(nodes[0].beatColor)) {
        nodeBeatColor = color(
          nodes[0].beatColor[0],
          nodes[0].beatColor[1],
          nodes[0].beatColor[2],
          180
        );
      } else {
        nodeBeatColor = color(nodes[0].beatColor);
        nodeBeatColor.setAlpha(180);
      }
    }
  }

  // 绘制步进扇形
  for (let i = 0; i < ui.stepCount; i++) {
    // 跳过被合并的步进
    if (nodes.length > 0 && nodes[0].mergedTo && nodes[0].mergedTo[i] !== -1) {
      continue;
    }

    let angle = TWO_PI * (i / ui.stepCount) - HALF_PI;
    let nextAngle = TWO_PI * ((i + 1) / ui.stepCount) - HALF_PI;

    let active = false;
    if (nodes.length > 0 && nodes[0].alpha) {
      active = nodes[0].alpha[i % 32] > 0.5;
    }

    let isCurrent = false;
    if (metronome.isPlaying && metronome.currentBeat % ui.stepCount === i) {
      isCurrent = true;
    }

    let isHovered = (i === ui.stepSequencer.hoveredStep);

    let pitchOffset = 0;
    let duration = 1.0;
    if (nodes.length > 0) {
      if (nodes[0].pitchOffset) {
        pitchOffset = nodes[0].pitchOffset[i % 32];
      }
      if (nodes[0].duration) {
        duration = nodes[0].duration[i % 32];
      }
    }

    let fullAngleRange = nextAngle - angle;

    // 处理持续时间大于1.0的情况
    if (active && duration > 1.0) {
      const sectorsToOccupy = Math.ceil(duration);
      const remainingFraction = duration - Math.floor(duration);

      if (Math.abs(duration - 16.0) < 0.001) {
        nextAngle = angle + TWO_PI - 0.01;
      } else if (sectorsToOccupy >= ui.stepCount) {
        nextAngle = angle + TWO_PI - 0.01;
      } else {
        const maxSectorsToUse = Math.min(sectorsToOccupy - 1, ui.stepCount - 1);
        nextAngle = TWO_PI * ((i + maxSectorsToUse) / ui.stepCount) - HALF_PI;

        if (remainingFraction > 0 && i + maxSectorsToUse < ui.stepCount) {
          const additionalAngle = fullAngleRange * remainingFraction;
          nextAngle += additionalAngle;
        }

        if (nextAngle < angle) {
          nextAngle += TWO_PI;
        }
      }
    }
    // 处理持续时间小于1.0的情况
    else if (active && duration < 1.0) {
      fullAngleRange = nextAngle - angle;
      const newAngleRange = fullAngleRange * duration;
      nextAngle = angle + newAngleRange;
    }

    // 设置扇形颜色
    if (active) {
      let beatColorWithPitch = color(nodeBeatColor);
      let nodeColorWithPitch = color(nodeColor);

      if (pitchOffset !== 0) {
        if (pitchOffset > 0) {
          const brightnessFactor = map(pitchOffset, 0, 12, 0, 0.4);
          beatColorWithPitch = lerpColor(nodeBeatColor, color(255), brightnessFactor);
          nodeColorWithPitch = lerpColor(nodeColor, color(255), brightnessFactor);
        }
        else if (pitchOffset < 0) {
          const darknessFactor = map(pitchOffset, 0, -12, 0, 0.5);
          beatColorWithPitch = lerpColor(nodeBeatColor, color(0), darknessFactor);
          nodeColorWithPitch = lerpColor(nodeColor, color(0), darknessFactor);
        }
      }

      if (isCurrent) {
        fill(nodeColorWithPitch);
      } else if (isHovered) {
        let c = lerpColor(nodeColorWithPitch, color(255), 0.2);
        fill(c);
      } else {
        fill(beatColorWithPitch);
      }
    } else {
      if (isCurrent) {
        fill(60, 180);
      } else if (isHovered) {
        fill(60, 130);
      } else {
        fill(60, 100);
      }
    }

    noStroke();

    // 根据音高偏移调整扇形半径
    let stepRadius = ui.stepRadius;
    if (active) {
      const defaultRadius = ui.innerRadius + (ui.stepRadius - ui.innerRadius) * 0.6;

      if (pitchOffset !== 0) {
        stepRadius = map(
          pitchOffset,
          -12, 12,
          ui.innerRadius + 10,
          ui.stepRadius - 2
        );
      } else {
        stepRadius = defaultRadius;
      }
    }

    // 绘制扇形填充部分
    const fillRadius = stepRadius - borderWidth/2;
    arc(ui.centerX, ui.centerY, fillRadius * 2, fillRadius * 2, angle, nextAngle, PIE);

    // 绘制扇形的描边
    stroke(30);
    strokeWeight(gapWidth);
    noFill();

    arc(ui.centerX, ui.centerY, stepRadius * 2 - borderWidth/2, stepRadius * 2 - borderWidth/2, angle, nextAngle, OPEN);

    // 绘制两条径向线条作为扇形边缘
    line(
      ui.centerX,
      ui.centerY,
      ui.centerX + cos(angle) * (stepRadius - borderWidth/2),
      ui.centerY + sin(angle) * (stepRadius - borderWidth/2)
    );

    line(
      ui.centerX,
      ui.centerY,
      ui.centerX + cos(nextAngle) * (stepRadius - borderWidth/2),
      ui.centerY + sin(nextAngle) * (stepRadius - borderWidth/2)
    );
  }

  // 绘制外部边框
  noFill();
  stroke(30);
  strokeWeight(borderWidth);
  ellipse(ui.centerX, ui.centerY, ui.stepRadius * 2);

  // 重新绘制内圆
  fill(30);
  noStroke();
  ellipse(ui.centerX, ui.centerY, ui.innerRadius * 2);

  // 绘制播放按钮
  if (metronome.isPlaying) {
    fill(nodes.length > 0 ? nodeColor : color(presetSlotColors[ui.currentPattern]));
    noStroke();
    rect(ui.centerX - 15, ui.centerY - 15, 10, 30, 2);
    rect(ui.centerX + 5, ui.centerY - 15, 10, 30, 2);
  } else {
    fill(nodes.length > 0 ? nodeColor : color(presetSlotColors[ui.currentPattern]));
    noStroke();
    beginShape();
    vertex(ui.centerX - 10, ui.centerY - 15);
    vertex(ui.centerX + 15, ui.centerY);
    vertex(ui.centerX - 10, ui.centerY + 15);
    endShape(CLOSE);
  }

  pop();
}

// 新的函数：加载指定预设
function loadPreset(presetIndex, variantIndex) {
  if (presetIndex >= 0 && presetIndex < window.presetPatterns.length) {
    window.saveCurrentPreset();

    ui.currentPattern = presetIndex;

    window.dispatchEvent(new CustomEvent('pattern-change', {
      detail: { patternIndex: presetIndex }
    }));

    window.presetManager.loadPreset(presetIndex, variantIndex);

    window.presetPatterns = window.presetManager.patterns;

    triggerCircleDataChange();

    if (window.circleOverview && typeof window.circleOverview.updateSingleSlotData === 'function') {
      for (let slotIndex = 0; slotIndex < 8; slotIndex++) {
        window.circleOverview.updateSingleSlotData(slotIndex);
      }
    }

    ui.variantSelector.visible = true;

    if (window.presetManager && window.presetManager.patterns[presetIndex]) {
      ui.variantSelector.activeButton = window.presetManager.patterns[presetIndex].currentVariant;
    }

    if (typeof updateUIPositions === 'function') {
      updateUIPositions();
    }

    if (typeof redraw === 'function') {
      redraw();
    }

    return true;
  }
  return false;
}

// 更新連接到OSC函數
function connectToOsc() {
  const oscButton = document.getElementById('osc-button');
  if (oscButton) {
    oscButton.disabled = true;
    oscButton.textContent = 'Connecting OSC...';
  }

  try {
    if (typeof oscAdapter === 'undefined') {
      throw new Error("OSC adapter not available");
    }

    const success = metronome.connectOsc(8000, 12000);
    isOscConnected = success;

    if (success) {
      if (oscButton) {
        oscButton.textContent = 'OSC Connected';
        oscButton.style.backgroundColor = '#9C27B0';
      }

      setupOscEventHandlers();

    } else {
      throw new Error("Failed to connect to OSC");
    }
  } catch (error) {
    alert("Failed to connect to OSC bridge. Make sure the bridge.js is running. Error: " + error.message);

    if (oscButton) {
      oscButton.disabled = false;
      oscButton.textContent = 'Connect OSC';
    }
  }
}

// 添加OSC事件处理函数
function setupOscEventHandlers() {
  oscAdapter.on('/cc', (value) => {
    const controller = value[0];
    const ccValue = value[1];

    switch (controller) {
      case 1:
        const newBpm = 20 + ccValue * 180 / 127;
        updateBPM(Math.round(newBpm));
        break;
      case 2:
        const steps = 4 + Math.floor(ccValue * 8 / 127) * 4;
        updateStepCount(steps);
        break;
      case 3:
        const resolutionIndex = Math.floor(ccValue * 4 / 127);
        updateResolution(resolutionIndex);
        break;
    }
  });

  oscAdapter.on('/custom/trigger', (value) => {
    const triggerType = value[0];

    if (triggerType === 'clear') {
      clearAllPatterns();
    } else if (triggerType === 'random') {
      createRandomPattern();
    }
  });

  oscAdapter.send('/test', 1);
  oscAdapter.send('/test/array', [1, 2, 3]);

  setInterval(() => {
    if (isOscConnected) {
      oscAdapter.send('/heartbeat', 1);
    }
  }, 5000);
}

// 创建随机节奏模式
function createRandomPattern() {
  if (!isEditable()) {
    return;
  }

  const selectedColor = presetSlotColors[ui.currentPattern];
  const pattern = new Array(32).fill(0.1);

  for (let i = 0; i < 32; i++) {
    if (Math.random() > 0.7) {
      pattern[i] = 1.0;
    }
  }

  addRhythmPattern({
    index: 0,
    alpha: pattern,
    color: selectedColor
  });

  if (window.syncPresetToServer && typeof window.syncPresetToServer === 'function') {
    window.syncPresetToServer(ui.currentPattern);
  }
}

// 确保在初始加载后变体选择器立即可见
window.addEventListener('load', function() {
  if (ui && ui.variantSelector) {
    ui.variantSelector.visible = true;

    if (typeof updateUIPositions === 'function') {
      updateUIPositions();
    }

    if (typeof redraw === 'function') {
      redraw();
    }
  }

  const colyseusConnectButton = document.getElementById('colyseus-connect-button');
  if (colyseusConnectButton && typeof window.showColyseusDialog === 'function') {
    colyseusConnectButton.addEventListener('click', window.showColyseusDialog);
  }
});
