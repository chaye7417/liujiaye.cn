// 支持与three.js的整合
if (typeof window.p5CanvasOpacity === 'undefined') {
  window.p5CanvasOpacity = 1.0;
}

// 步进器可见性控制
if (typeof window.rhythmVisible === 'undefined') {
  window.rhythmVisible = true;
}

var showOuterRing = true;
var showTopText = false;
const outerRingTextArray = "1-2-3-4-1-2-3-4-1-2-3-4-1-2-3-4-".split('');
let isConnected = false; // 连接状态指示器

// 预设颜色数组，只保留16种最常用的颜色
const predefinedColors = [
  // 明亮色系
  '#FF5252', // 红色
  '#FF9800', // 橙色
  '#FFEB3B', // 黄色
  '#4CAF50', // 绿色
  '#2196F3', // 蓝色
  '#673AB7', // 紫色
  '#E91E63', // 粉色
  '#00BCD4', // 青色
  
  // 柔和色系
  '#FF8A80', // 柔和红
  '#FFD180', // 柔和橙
  '#FFFF8D', // 柔和黄
  '#B9F6CA', // 柔和绿
  '#80D8FF', // 柔和蓝
  '#B388FF', // 柔和紫
  '#F8BBD0', // 柔和粉
  '#84FFFF'  // 柔和青
];

// 添加变量记录拖动状态
let dragState = {
  isDragging: false,
  stepIndex: -1,
  lastY: 0,
  lastX: 0,
  wasDragging: false, // 标记表示刚刚完成了拖动操作
  hadPitchChange: false, // 标记表示拖动过程中实际发生了音高变化
  dragMode: null, // 'pitch' 或 'duration' 表示当前拖动模式
  hadDurationChange: false, // 标记表示拖动过程中实际发生了持续时间变化
  releaseTime: 0, // 记录鼠标释放的时间
  dragProtectionActive: false // 拖拽保护标志
};

function preload() {
  // 预加载内容为空
}

function setup() {
  // 创建固定尺寸的画布，而不是自适应尺寸
  const fixedSize = 800; // 使用800x800的固定尺寸
  let canvas = createCanvas(fixedSize, fixedSize);
  canvas.parent('p5-container'); // 指定父容器
  
  // 确保canvas居中显示
  let p5Container = document.getElementById('p5-container');
  if (p5Container) {
    p5Container.style.display = 'flex';
    p5Container.style.justifyContent = 'center';
    p5Container.style.alignItems = 'center';
  }
  
  // 设置固定的缩放因子和直径
  scaleFactor = 1;
  diameter = fixedSize * 0.8; // 直径为画布的80%
  
  // initialize metronome
  metronome = new AudioSequencer(60, 100, 100);
  
  // 监听metronome-beat事件，用于与Tone.js Transport同步
  window.addEventListener('metronome-beat', function(e) {
    // 更新当前拍子，确保UI同步
    if (typeof metronome !== 'undefined') {
      // 使用来自事件的拍子数据
      const beatData = e.detail;
      // 不直接设置currentBeat，因为metronome对象自己会管理
      // 但可以在这里处理UI刷新或其他与拍子同步的逻辑
      redraw(); // 触发重绘以更新UI
    }
  });
  
  // 确保音频上下文已解锁并准备好
  if (typeof userStartAudio === 'function') {
    userStartAudio().then(() => {
      // 音频上下文已启动
    }).catch(err => {
      // 启动音频上下文失败，请等待用户交互
    });
  }
  
  // 设置初始分辨率
  metronome.setResolution("1/16");
  
  // 设置当前预设为第一个预设插槽
  ui.currentPattern = 0;
  
  // 为所有预设插槽设置初始音高为C4
  if (metronome.baseNotes) {
    for (let i = 0; i < 8; i++) {
      metronome.baseNotes[i] = 'C4';
    }
  } else {
    metronome.baseNotes = ['C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4'];
  }
  
  // 初始化音高控制相关数据
  ui.pitchControl.octaves = [1, 2, 3, 4, 5, 6, 7];
  ui.pitchControl.isVisible = false;
  ui.pitchControl.isDragging = false;
  
  // 初始化预设管理器
  if (window.presetManager) {
    // 生成一个临时用户ID
    const tempUserId = 'user_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    window.presetManager.init(tempUserId);
    
    // 确保预设管理器的变体数据结构正确初始化
    for (let i = 0; i < window.presetManager.patterns.length; i++) {
      // 检查是否是旧格式的数据结构
      if (!window.presetManager.patterns[i].hasOwnProperty('variants')) {
        // 创建新的变体数据结构
        const oldData = window.presetManager.patterns[i];
        window.presetManager.patterns[i] = {
          variants: [[]],
          currentVariant: 0
        };
        
        // 如果有旧数据，迁移到第一个变体
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
    // 使用预设1的红色创建节点
    addRhythmPattern({
      index: 0,
      alpha: new Array(32).fill(0.1),
      color: window.presetManager ? window.presetManager.slotColors[0] : '#FF5252' // 使用预设1的红色
    });
    
    // 确保节点的beatColor正确设置
    if (nodes.length > 0) {
      updateNodeColor(0, window.presetManager ? window.presetManager.slotColors[0] : '#FF5252');
    }
  } else if (nodes.length > 0) {
    // 确保现有节点使用预设1的颜色
    updateNodeColor(0, window.presetManager ? window.presetManager.slotColors[0] : '#FF5252');
  }
	
  // 设置清除按钮
  setupClearButton();
  
  // 启用平滑处理，增强视觉效果
  smooth();
  
  // 初始化UI位置
  updateUIPositions();
  
  // 应用初始BPM到运镜速度的映射
  // 使用setTimeout确保等到three-scene.js加载完成后再调用
  setTimeout(() => {
    // 调用一次updateBPM来初始化运镜速度
    updateBPM(metronome.bpm);
    
    // 初始化相机自动运镜状态与步进器状态同步
    if (typeof window.setCameraAutoModeFromStepper === 'function') {
      window.setCameraAutoModeFromStepper(metronome.isPlaying);
    }
  }, 1000); // 延迟1秒确保three-scene.js已完全加载
  
  // 在setup末尾添加，确保初始数据传递
  setTimeout(() => {
    try {
      // 触发圆环数据变化事件，但不立即更新总览视图数据
      // 这里我们手动创建一个事件，但不调用updateSingleSlotData
      if (nodes.length > 0) {
        const circleData = {
          nodes: nodes,
          currentPreset: ui.currentPattern,
          stepCount: ui.stepCount,
          resolution: ui.resolution.value,
          baseNote: metronome.baseNotes[ui.currentPattern] || 'C4'
        };
        
        // 创建并触发事件
        const event = new CustomEvent('circle-data-change', {
          detail: circleData
        });
        window.dispatchEvent(event);
        

      }
    } catch (err) {
      console.error("初始化数据传递时出错:", err);
    }
    
    // 再延迟一段时间后才进行总览视图的完整初始化
    setTimeout(() => {
      try {
        if (window.circleOverview && typeof window.circleOverview.refresh === 'function') {
          // 使用refresh方法一次性更新所有数据，而不是循环调用updateSingleSlotData
          window.circleOverview.refresh();

        }
      } catch (err) {
        console.error("初始化总览视图数据时出错:", err);
      }
    }, 1500); // 比初始数据触发再等1.5秒，确保所有组件都已加载完成
  }, 2000); // 延长到2秒，确保所有组件完全初始化
  
  // 注册mouseOut事件处理，确保在鼠标离开画布时清除五线谱高亮
  canvas.mouseOut(mouseOut);
  
  // 添加：确保变体选择器在初始化时可见
  ui.variantSelector.visible = true;
}

// Setup connection button
function setupConnectionButton() {
  const connectButton = document.getElementById('connect-button');
  if (connectButton) {
    connectButton.addEventListener('click', window.connectToParty);
  }
}

// Connect to p5.party 函数已移除，改为使用 window.connectToParty

// ... 保留其他代码 ...

// New function: Update step count
function updateStepCount(newCount) {
  // 检查新步数是否在有效范围内（2-32步）
  newCount = Math.max(2, Math.min(32, newCount));
  
  if (newCount === ui.stepCount) return; // 如果步数没有变化，不执行任何操作
  
  // 更新UI对象中的步数
  ui.stepCount = newCount;
  
  // 遍历所有节点，调整alpha、pitchOffset和duration数组的长度
  for (let node of nodes) {
    // 调整alpha数组
    if (node.alpha) {
      // 如果新的步数小于当前alpha数组长度，截断数组
      if (newCount < node.alpha.length) {
        node.alpha = node.alpha.slice(0, newCount);
      } 
      // 如果新的步数大于当前alpha数组长度，扩展数组并填充0.1
      else if (newCount > node.alpha.length) {
        const extension = new Array(newCount - node.alpha.length).fill(0.1);
        node.alpha = [...node.alpha, ...extension];
      }
    }
    
    // 同样处理pitchOffset数组（如果存在）
    if (node.pitchOffset) {
      if (newCount < node.pitchOffset.length) {
        node.pitchOffset = node.pitchOffset.slice(0, newCount);
      } else if (newCount > node.pitchOffset.length) {
        const extension = new Array(newCount - node.pitchOffset.length).fill(0);
        node.pitchOffset = [...node.pitchOffset, ...extension];
      }
    }
    
    // 同样处理duration数组（如果存在）
    if (node.duration) {
      if (newCount < node.duration.length) {
        node.duration = node.duration.slice(0, newCount);
      } else if (newCount > node.duration.length) {
        const extension = new Array(newCount - node.duration.length).fill(1.0);
        node.duration = [...node.duration, ...extension];
      }
    }
    
    // 同样处理mergedTo数组（如果存在）
    if (node.mergedTo) {
      if (newCount < node.mergedTo.length) {
        node.mergedTo = node.mergedTo.slice(0, newCount);
      } else if (newCount > node.mergedTo.length) {
        const extension = new Array(newCount - node.mergedTo.length).fill(-1);
        node.mergedTo = [...node.mergedTo, ...extension];
      }
    }
  }
  
  // 如果metronome存在，更新其循环长度
  if (window.metronome) {
    metronome.updateLoopLength(newCount);
  }
  
  // 触发步数变化事件
  const event = new CustomEvent('step-count-change', {
    detail: { stepCount: newCount }
  });
  window.dispatchEvent(event);
  
  // 保存当前预设
  window.saveCurrentPreset();
  
  // 触发圆环数据变化事件
  triggerCircleDataChange();
}

// New function: Update resolution
function updateResolution(newIndex) {
  ui.resolution.currentIndex = newIndex;
  ui.resolution.value = ui.resolution.values[newIndex];
  metronome.setResolution(ui.resolution.value);
  
  // 派发分辨率变化事件
  const resolutionChangeEvent = new CustomEvent('resolution-change', {
    detail: {
      value: ui.resolution.value,
      index: newIndex
    }
  });
  window.dispatchEvent(resolutionChangeEvent);
  
  // 暂存当前节点数据，以便更新5线谱
  const circleData = {
    nodes: nodes,
    currentPreset: ui.currentPattern
  };
  
  // 直接更新ABC五线谱，不通过事件传播
  if (window.circleToABC && typeof window.circleToABC.convertToABC === 'function') {
    const abcNotation = window.circleToABC.convertToABC(circleData);
    
    if (window.abcjs && typeof window.abcjs.setTune === 'function') {
      window.abcjs.setTune(abcNotation);
      
      // 确保重新渲染
      if (typeof window.abcjs.render === 'function') {
        window.abcjs.render();
        
        // 在五线谱渲染完成后立即恢复高亮状态
        if (typeof window.abcjs.highlightNote === 'function') {
          // 计算调整后的音符索引
          const mappedIndex = getMappedNoteIndex(highlightIndex);
          // 直接应用高亮，无需等待
          window.abcjs.highlightNote(mappedIndex);
        }
      }
    }
  } else {
    // 备选方案：触发圆环数据变化事件
    triggerCircleDataChange();
  }
}

// Clear button event handler setup
function setupClearButton() {
  // 这个函数现在已经不需要了，因为Clear按钮已经移到步进器界面中
  // 保留这个空函数以确保其他可能调用它的代码不会出错

}

// Generate random color - 修改为使用当前预设颜色
function getRandomColor() {
  // 返回当前预设插槽的固定颜色
  return window.presetManager.getSlotColor(ui.currentPattern);
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

// MIDI文件加载功能已移除

// Window size change adjust canvas
function windowResized() {
  // 不再调整画布大小，保持固定尺寸
  // 取消调用updateCanvasSize()
  
  // 但仍然需要更新UI位置
  updateUIPositions();
  
  // 重新绘制界面
  redraw();
}

function draw() {
  // 如果步进器设置为不可见，且画布透明度为0，则完全跳过绘制
  if (!window.rhythmVisible && window.p5CanvasOpacity === 0 && !metronome.synthUI.visible) {
    return;
  }

  // 使用带透明度的背景
  clear(); // 清除画布
  
  // 更新UI位置
  updateUIPositions();
  
  // 检查是否需要绘制UI元素
  const shouldDrawUI = window.p5CanvasOpacity > 0;
  
  if (shouldDrawUI) {
    // 绘制背景
    drawBackground();
    
    // 绘制主面板背景
    drawPanel(ui.panelX, ui.panelY, ui.panelWidth, ui.panelHeight);
    
    // 如果合成器UI可见，绘制合成器UI
    if (metronome.synthUI.visible) {
      metronome.drawSynthUI();
    } else if (window.rhythmVisible) {
      // 否则绘制步进器UI
      drawTitle(ui.centerX, ui.centerY - ui.panelHeight/2 + 30, "");
      drawImportExportButton(); // 添加导入/导出按钮
      drawSynthButton(); // 添加合成器按钮
      drawPatternSelector();
      drawStepSequencer();
      // drawResolution(); // 暂时注释掉分辨率控制，有BUG
      drawClearButton(); // 添加Clear Rhythm按钮
      drawBpmControl();
      drawPitchControlButton();
    }
  }
}

// 绘制背景
function drawBackground() {
  // 移除深色背景，保持透明
  // background(25); // 更深的背景色，与圆环颜色方案一致
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

// 存储UI元素的全局变量，以便在mouseClicked函数中使用
window.ui = {
  panelWidth: 0,
  panelHeight: 0,
  panelX: 0,
  panelY: 0,
  stepRadius: 0,
  innerRadius: 0,
  centerX: 0,
  centerY: 0,
  importExportButton: {
    x: 0,
    y: 0,
    width: 100,
    height: 30,
    hovered: false
  },
  synthButton: {
    x: 0,
    y: 0,
    width: 100,
    height: 30,
    hovered: false
  },
  patternSelector: {
    y: 0,
    buttonWidth: 30,
    spacing: 5,
    buttons: [],
    hoveredButton: -1
  },
  resolution: {
    value: "1/16",
    rect: {x: 0, y: 0, w: 0, h: 0},
    hovered: false,
    minusX: 0,
    plusX: 0,
    minusHovered: false,
    plusHovered: false,
    values: ["1/4", "1/8", "1/16", "1/32"],
    currentIndex: 2
  },
  stepSequencer: {
    hoveredStep: -1
  },
  stepCountControls: {
    y: 0,
    minusX: 0,
    plusX: 0,
    width: 160,
    height: 30,
    minusHovered: false,
    plusHovered: false
  },
  bpmControl: {
    y: 0,
    minusX: 0,
    plusX: 0,
    width: 160,
    height: 30,
    minusHovered: false,
    plusHovered: false,
    value: 120,
    isDragging: false,
    isEditing: false,
    editValue: "",
    rect: {x: 0, y: 0, w: 120, h: 30},
    hovered: false,
    dragStartY: 0,
    dragStartBpm: 0
  },
  // 简化音高设置控制，只保留八度设置
  pitchControl: {
    octaveControl: {
      y: 0,
      minusX: 0,
      plusX: 0,
      width: 160,
      height: 30,
      minusHovered: false,
      plusHovered: false,
      rect: {x: 0, y: 0, w: 160, h: 30},
      hovered: false
    },
    octaves: [1, 2, 3, 4, 5, 6, 7]
  },
  stepCount: 16,
  currentPattern: 0, // 当前选中的模式，默认为第一个预设插槽
  playButton: {
    x: 0,
    y: 0,
    size: 0
  },
  // 添加变体选择器UI配置
  variantSelector: {
    visible: false,
    buttonWidth: 20,
    height: 20,
    buttons: [],
    hoveredButton: -1,
    activeButton: 0
  },
};

// 更新函数中使用window.ui而不是ui
let ui = window.ui;

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
  
  // 更新导入/导出按钮位置 - 放在面板左上角
  ui.importExportButton.width = 100;
  ui.importExportButton.height = 30;
  ui.importExportButton.x = ui.panelX + 20; // 左边距20px
  ui.importExportButton.y = ui.panelY + 20; // 上边距20px
  
  // 更新合成器按钮位置 - 放在面板右上角
  ui.synthButton.width = 100;
  ui.synthButton.height = 30;
  ui.synthButton.x = ui.panelX + ui.panelWidth - ui.synthButton.width - 20; // 右边距20px
  ui.synthButton.y = ui.panelY + 20; // 上边距20px
  
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
  
  // 修改这里：确保总是更新变体选择器的位置和按钮，无论visible状态如何
  // 更新变体选择器位置 - 放在模式选择器下方
  ui.variantSelector.y = ui.patternSelector.y + 25;
  ui.variantSelector.buttons = [];
  
  // 获取当前插槽的变体数量
  let variantCount = 1; // 默认至少有一个变体
  if (window.presetManager && window.presetManager.patterns && 
      window.presetManager.patterns[ui.currentPattern] && 
      window.presetManager.patterns[ui.currentPattern].variants) {
    variantCount = window.presetManager.patterns[ui.currentPattern].variants.length;
  }
  
  // 添加变体选择按钮
  let variantButtonWidth = ui.variantSelector.buttonWidth;
  let variantSpacing = 3;
  let variantTotalWidth = variantCount * variantButtonWidth + (variantCount - 1) * variantSpacing;
  
  // 如果未达到最大变体数量，则为加号按钮预留空间
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
      value: i + 1, // 变体从1开始显示编号
      isDeleteHovered: false // 添加删除按钮悬停状态标志
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
  
  // 确保变体选择器可见
  ui.variantSelector.visible = true;
  ui.variantSelector.addButton = null; // 初始化添加按钮引用
  
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
  
  // 更新八度控制位置 - 放在BPM控制下方
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
  
  // 检查是否悬停在步进数量控制按钮上 - 暂时注释掉，有BUG
  /*
  ui.stepCountControls.minusHovered = false;
  ui.stepCountControls.plusHovered = false;
  
  if (mouseX >= ui.stepCountControls.minusX && mouseX <= ui.stepCountControls.minusX + 30 &&
      mouseY >= ui.stepCountControls.y && mouseY <= ui.stepCountControls.y + 30) {
    ui.stepCountControls.minusHovered = true;
  }
  
  if (mouseX >= ui.stepCountControls.plusX && mouseX <= ui.stepCountControls.plusX + 30 &&
      mouseY >= ui.stepCountControls.y && mouseY <= ui.stepCountControls.y + 30) {
    ui.stepCountControls.plusHovered = true;
  }
  */
  
  // 检查是否悬停在分辨率控制按钮上 - 暂时注释掉，有BUG
  /*
  ui.resolution.minusHovered = false;
  ui.resolution.plusHovered = false;
  
  if (mouseX >= ui.resolution.minusX && mouseX <= ui.resolution.minusX + 30 &&
      mouseY >= ui.resolution.rect.y && mouseY <= ui.resolution.rect.y + 30) {
    ui.resolution.minusHovered = true;
  }
  
  if (mouseX >= ui.resolution.plusX && mouseX <= ui.resolution.plusX + 30 &&
      mouseY >= ui.resolution.rect.y && mouseY <= ui.resolution.rect.y + 30) {
    ui.resolution.plusHovered = true;
  }
  */
  
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
            
            // 移除拖拽过程中的实时同步，仅在mouseReleased中同步
            
            // 声音反馈
            if (typeof metronome !== 'undefined' && metronome.presetSounds) {
              const synthIndex = Math.min(ui.currentPattern, metronome.presetSounds.length - 1);
              
              // 获取当前预设插槽的八度设置
              const currentPresetIndex = ui.currentPattern;
              const baseNote = metronome.baseNotes[currentPresetIndex] || 'C4';
              const match = baseNote.match(/([A-G][#b]?)(\d+)/);
              const octave = match ? parseInt(match[2]) : 4;
              
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
                
                // 输出调试信息

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
    } else if (dragState.dragMode === 'duration') {
      // 水平移动操作 - 调整持续时间
      // 水平移动超过一定阈值才改变持续时间
      if (abs(deltaX) >= 3) { // 3像素的阈值
        // 向右拖动增加持续时间，向左拖动减少持续时间
        // 微调幅度，每次移动3个像素改变持续时间
        // 根据当前持续时间动态调整变化量，高值时变化更快
        let durationChange;
        const currentDuration = nodes[0].duration ? nodes[0].duration[dragState.stepIndex] : 1.0;
        
        if (currentDuration > 4.0) {
          // 超过400%时变化更快
          durationChange = deltaX > 0 ? 0.5 : -0.5;
        } else if (currentDuration > 1.0) {
          // 超过100%时变化更快
          durationChange = deltaX > 0 ? 0.1 : -0.1;
        } else {
          // 100%以下时变化较慢
          durationChange = deltaX > 0 ? 0.05 : -0.05;
        }
        
        // 更新节点的持续时间
        if (nodes.length > 0 && nodes[0].duration) {
          // 限制持续时间范围在0.05(5%)到16.0(1600%)之间
          const newDuration = constrain(currentDuration + durationChange, 0.05, 16.0);
          
          // 只有持续时间确实发生变化时才更新
          if (abs(newDuration - currentDuration) > 0.001) {
            const previousDuration = nodes[0].duration[dragState.stepIndex];
            nodes[0].duration[dragState.stepIndex] = newDuration;
            
            // 处理合并标记的更新
            if (nodes[0].mergedTo) {
              // 获取当前步进索引
              const stepIndex = dragState.stepIndex;
              
              // 首先清除之前可能存在的所有合并标记
              // 1. 清除当前步进之前已合并的所有步进标记
              for (let i = 0; i < nodes[0].mergedTo.length; i++) {
                if (nodes[0].mergedTo[i] === stepIndex) {
                  nodes[0].mergedTo[i] = -1;
                }
              }
              
              // 2. 如果持续时间超过1.0，设置后续步进的合并标记
              if (Math.abs(newDuration - 16.0) < 0.001) {
                // 当达到1600%时，确保正好合并整个圆的所有步进
                // 使用ui.stepCount而不是固定值16，确保适应不同的步进器设置
                for (let i = 1; i < ui.stepCount; i++) {
                  // 计算要合并的步进索引，确保在有效范围内循环
                  const targetIndex = (stepIndex + i) % ui.stepCount;
                  // 标记该步进被合并到当前步进
                  nodes[0].mergedTo[targetIndex] = stepIndex;
                }
              } else if (Math.ceil(newDuration) >= ui.stepCount) {
                // 处理超过一圈的情况
                for (let i = 1; i < ui.stepCount; i++) {
                  // 计算要合并的步进索引，确保在有效范围内循环
                  const targetIndex = (stepIndex + i) % ui.stepCount;
                  // 标记该步进被合并到当前步进
                  nodes[0].mergedTo[targetIndex] = stepIndex;
                }
              } else {
                // 正常处理其他情况
                // 计算完全占用的步进数(包括当前步进)
                const fullStepsOccupied = Math.ceil(newDuration);
                // 设置所有会被合并的步进标记
                for (let i = 1; i < fullStepsOccupied; i++) {
                  // 计算要合并的步进索引，确保在有效范围内循环
                  const targetIndex = (stepIndex + i) % ui.stepCount;
                  // 标记该步进被合并到当前步进
                  nodes[0].mergedTo[targetIndex] = stepIndex;
                }
              }
            }
            
            // 标记实际发生了拖动（持续时间变化）
            dragState.hadDurationChange = true;
            
            // 更新本地五线谱
            triggerLocalAbcUpdate();
            
            // 移除拖拽过程中的实时同步，仅在mouseReleased中同步
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
  }
  
  return true;
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
    // 这里是关键，如果没有实际的音高或持续时间变化，不应该标记为拖动过
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
        
        // 移除多次同步尝试，减少同步次数
      }
      
      // 4. 如果存在Colyseus直接同步函数，但只调用一次
      if (window.syncNodeChangesToServer && typeof window.syncNodeChangesToServer === 'function') {
        // 立即同步一次
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
        // 遍历所有插槽，更新所有插槽数据到总览视图
        for (let slotIndex = 0; slotIndex < 8; slotIndex++) {
          window.circleOverview.updateSingleSlotData(slotIndex);
        }
      }
    } else {

      // 即使无权同步，也需要触发本地UI更新
      triggerLocalAbcUpdate();
      
      // 新增：确保总览视图更新所有插槽的数据
      if (window.circleOverview && typeof window.circleOverview.updateSingleSlotData === 'function') {
        // 遍历所有插槽，更新所有插槽数据到总览视图
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
      // 保证高亮状态持续，不需要先清除再设置
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
    
    // 检查是否可编辑此插槽 - 强制重新检查而不是缓存
    const isEditable = i === currentControlledSlot;
    
    // 检查此插槽是否被占用 - 直接从最新数据获取
    let isOwned = false;
    let slotOwnerId = "";
    
         // 尝试从所有可能的数据源获取插槽所有权信息
     if (window.colyseusSlotStates && window.colyseusSlotStates.data && window.colyseusSlotStates.data.slots) {
       // 更精确的判断：只有当值不是undefined、null或空字符串时才认为是被占用
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
     
     // 特殊情况：如果当前用户控制着这个插槽，那么它一定是被占用的
     if (i === currentControlledSlot) {
       isOwned = true;
       slotOwnerId = currentUserId;
     }
    
    // 检查此插槽是否被当前用户控制 - 直接比较ID
    let isControlledByMe = isOwned && slotOwnerId === currentUserId;
    
    const isCurrentlyViewing = i === ui.currentPattern;
    
    // 按钮背景
    if (i === ui.currentPattern) {
      // 使用预设插槽的固定颜色
      if (isEditable) {
        // 如果当前用户拥有此插槽，使用完全不透明的颜色
        fill(slotColor);
      } else {
        // 如果只是在查看此插槽，使用半透明的颜色
        slotColor.setAlpha(180);
        fill(slotColor);
      }
    } else if (i === ui.patternSelector.hoveredButton) {
      // 悬停时，使用稍微亮一点的预设颜色
      let hoverColor = color(presetSlotColors[i]);
      if (!isEditable && isOwned) {
        // 如果此插槽被占用且无法编辑，显示为深灰色
        hoverColor = color(80, 80, 80, 180);
      } else {
        hoverColor.setAlpha(180);
      }
      fill(hoverColor);
    } else {
      // 正常状态，使用暗淡的预设颜色
      let normalColor = color(presetSlotColors[i]);
      if (!isEditable && isOwned) {
        // 如果此插槽被占用且无法编辑，显示为灰色
        normalColor = color(60, 60, 60, 80);
      } else if (hasData) {
        normalColor.setAlpha(120); // 有数据的预设使用稍微亮一点的颜色
      } else {
        normalColor.setAlpha(80); // 无数据的预设更透明
      }
      fill(normalColor);
    }
    
    stroke(30, 180); // 与内部中心圆颜色一致的深色，添加半透明效果
    strokeWeight(1);
    rect(button.x, button.y, button.w, button.h);
    
    // 按钮文字
    fill(hasData ? 255 : 200); // 有数据的预设使用更亮的文字颜色
    textSize(16);
    textAlign(CENTER, CENTER);
    text(button.value, button.x + button.w/2, button.y + button.h/2);
    
    // 显示控制状态指示器
    if (isOwned) {
      // 判断是否为当前用户控制
      // 1. 要么插槽ID匹配当前用户ID
      // 2. 要么这个插槽是当前用户选择的插槽
      // 3. 要么插槽没有被任何人占用（空字符串）
      if (isControlledByMe || i === currentControlledSlot || slotOwnerId === "") {
        // 如果当前用户控制此插槽，显示一个黄色边框
        noFill();
        stroke(255, 255, 0, 220); // 黄色，添加一点透明度
        strokeWeight(2);
        rect(button.x - 1, button.y - 1, button.w + 2, button.h + 2);
      } else {
        // 如果被其他用户占用，显示一个锁定图标
        fill(255, 220); // 添加一点透明度
        textSize(8);
        textAlign(CENTER, BOTTOM);
        text("×", button.x + button.w/2, button.y - 2);
      }
    }
  }
  
  // 绘制变体选择器部分保持不变
  // 获取当前插槽的变体数据
  const currentSlot = ui.currentPattern;
  if (window.presetManager && window.presetManager.patterns && 
      window.presetManager.patterns[currentSlot]) {
    const slotData = window.presetManager.patterns[currentSlot];
    const currentVariant = slotData.currentVariant;
    const variantCount = slotData.variants.length;
    
    // 删除变体信息标签 "Variants:"
    // fill(200, 200); // 半透明白色
    // noStroke();
    // textSize(12);
    // textAlign(CENTER, BOTTOM);
    // text("Variants:", ui.centerX, ui.variantSelector.y - 3);
    
    // 绘制变体按钮
    let totalWidth = 0;
    const buttonWidth = ui.variantSelector.buttonWidth;
    const buttonSpacing = 3;
    const addButtonWidth = buttonWidth;
    
    // 计算变体按钮组的总宽度（包括添加按钮）
    if (variantCount < window.presetManager.maxVariantsPerSlot) {
      totalWidth = variantCount * buttonWidth + (variantCount) * buttonSpacing + addButtonWidth;
    } else {
      totalWidth = variantCount * buttonWidth + (variantCount - 1) * buttonSpacing;
    }
    
    // 计算起始X坐标，使按钮组居中
    let startX = ui.centerX - totalWidth / 2;
    
    // 绘制变体按钮
    for (let i = 0; i < ui.variantSelector.buttons.length; i++) {
      let button = ui.variantSelector.buttons[i];
      
      // 决定按钮颜色
      if (i === currentVariant) {
        // 当前选中的变体
        fill(presetSlotColors[currentSlot]); // 使用插槽颜色
      } else if (i === ui.variantSelector.hoveredButton) {
        // 悬停状态
        fill(70, 200); // 半透明亮灰色
      } else {
        // 普通状态
        fill(50, 180); // 半透明灰色
      }
      
      // 绘制按钮
      stroke(30, 180);
      strokeWeight(1);
      rect(button.x, button.y, button.w, button.h, 3); // 圆角矩形
      
      // 按钮文字 - 显示变体编号
      fill(255, 220);
      textSize(10);
      textAlign(CENTER, CENTER);
      text(button.value, button.x + button.w/2, button.y + button.h/2);
      
      // 如果有多个变体且鼠标悬停在按钮上，绘制删除图标
      if (variantCount > 1 && i === ui.variantSelector.hoveredButton) {
        // 绘制删除按钮
        fill(244, 67, 54);  // 红色
        noStroke();
        ellipse(button.x + button.w - 3, button.y + 3, 8, 8);
        
        // 绘制 X 符号
        fill(255);
        textSize(6);
        textAlign(CENTER, CENTER);
        text("×", button.x + button.w - 3, button.y + 2);
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
      
      // 存储添加按钮数据
      ui.variantSelector.addButton = addButton;
      
      // 检查鼠标是否悬停在添加按钮上
      const isHovered = mouseX >= addButton.x && mouseX <= addButton.x + addButton.w &&
                       mouseY >= addButton.y && mouseY <= addButton.y + addButton.h;
      
      // 绘制添加按钮 - 改为灰色透明
      fill(isHovered ? color(100, 200) : color(70, 180)); // 灰色，悬停时更亮
      stroke(30, 180);
      strokeWeight(1);
      rect(addButton.x, addButton.y, addButton.w, addButton.h, 3);
      
      // 绘制 + 符号
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

// 更新绘制环形步进器函数，添加可见性判断和音高偏移视觉指示
function drawStepSequencer() {
  // 如果步进器设置为不可见，则不绘制
  if (!window.rhythmVisible) return;
  
  push();
  
  // 获取当前是否可编辑状态
  const canEdit = isEditable();
  
  // 绘制中心圆
  fill(30); // 恢复为不透明的中心圆
  stroke(30); // 将描边颜色改为30，与间距和外部描边保持一致
  strokeWeight(2);
  ellipse(ui.centerX, ui.centerY, ui.innerRadius * 2);
  
  // 首先绘制整个环形背景（调整大小，减去描边宽度以避免重叠）
  const borderWidth = 4; // 描边宽度
  fill(40); // 恢复为不透明的环形背景
  noStroke(); // 先不绘制描边
  ellipse(ui.centerX, ui.centerY, ui.stepRadius * 2 - borderWidth);
  
  // 挖空中心区域形成环
  fill(30); // 恢复为不透明的中心区域
  noStroke();
  ellipse(ui.centerX, ui.centerY, ui.innerRadius * 2);
  
  // 设置统一的间距宽度(像素)
  const gapWidth = 3; // 间距宽度，单位为像素
  
  // 获取当前节点的颜色，如果有的话
  let nodeColor = color(presetSlotColors[ui.currentPattern]); // 使用当前预设插槽的固定颜色
  let nodeBeatColor = color(presetSlotColors[ui.currentPattern]); // 使用相同的颜色，但透明度降低
  nodeBeatColor.setAlpha(180);
  
  if (nodes.length > 0) {
    // 优先使用节点的颜色（已经在loadPreset中设置为预设插槽的固定颜色）
    nodeColor = color(nodes[0].color);
    
    // 如果节点有beatColor属性，使用它
    if (nodes[0].beatColor) {
      if (Array.isArray(nodes[0].beatColor)) {
        // 如果beatColor是数组，创建color对象
        nodeBeatColor = color(
          nodes[0].beatColor[0], 
          nodes[0].beatColor[1], 
          nodes[0].beatColor[2], 
          180 // 使用较高的不透明度
        );
      } else {
        // 如果已经是颜色字符串，则直接使用
        nodeBeatColor = color(nodes[0].beatColor);
        nodeBeatColor.setAlpha(180);
      }
    }
  }
  
  // 绘制步进扇形
  for (let i = 0; i < ui.stepCount; i++) {
    // 检查该步进是否被合并到其他步进中，如果是则跳过绘制
    if (nodes.length > 0 && nodes[0].mergedTo && nodes[0].mergedTo[i] !== -1) {
      continue; // 跳过被合并的步进
    }
    
    let angle = TWO_PI * (i / ui.stepCount) - HALF_PI;
    let nextAngle = TWO_PI * ((i + 1) / ui.stepCount) - HALF_PI;
    
    let active = false;
    
    // 检查是否有节点数据
    if (nodes.length > 0 && nodes[0].alpha) {
      active = nodes[0].alpha[i % 32] > 0.5;
    }
    
    // 当前步进
    let isCurrent = false;
    if (metronome.isPlaying && metronome.currentBeat % ui.stepCount === i) {
      isCurrent = true;
    }
    
    // 检查是否是悬停的步进
    let isHovered = (i === ui.stepSequencer.hoveredStep);
    
    // 检查是否有音高偏移和持续时间
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
    
    // 根据持续时间调整扇形的角度范围
    let fullAngleRange = nextAngle - angle;
    
    // 处理持续时间大于1.0的情况 - 合并后续扇形
    if (active && duration > 1.0) {
      // 计算需要占用的扇形数量（包括当前扇形）
      const sectorsToOccupy = Math.ceil(duration);
      // 计算最后一个部分占用的比例
      const remainingFraction = duration - Math.floor(duration);
      
      // 处理长音符角度计算
      if (Math.abs(duration - 16.0) < 0.001) {
        // 特殊处理最大持续时间16.0的情况
        // 强制使用整个圆形，避免缺口问题
        nextAngle = angle + TWO_PI - 0.01; // 减去一个微小值以避免精度问题
      } else if (sectorsToOccupy >= ui.stepCount) {
        // 当占用步数大于或等于总步数时（即环绕一整圈）
        // 也强制使用整个圆形，避免缺口
        nextAngle = angle + TWO_PI - 0.01;
      } else {
        // 普通情况下计算结束角度
        const maxSectorsToUse = Math.min(sectorsToOccupy - 1, ui.stepCount - 1);
        
        // 扩展到后面的扇形
        nextAngle = TWO_PI * ((i + maxSectorsToUse) / ui.stepCount) - HALF_PI;
        
        // 如果有剩余部分，再添加一部分
        if (remainingFraction > 0 && i + maxSectorsToUse < ui.stepCount) {
          const additionalAngle = fullAngleRange * remainingFraction;
          nextAngle += additionalAngle;
        }
        
        // 处理环绕过零点的情况
        if (nextAngle < angle) {
          nextAngle += TWO_PI;
        }
      }
    }
    // 处理持续时间小于1.0的情况 - 缩小扇形
    else if (active && duration < 1.0) {
      // 计算原始扇形的角度范围
      fullAngleRange = nextAngle - angle;
      
      // 根据持续时间计算新的角度范围
      const newAngleRange = fullAngleRange * duration;
      
      // 修改扇形范围，从前一个扇形边缘开始生长
      // 保持开始角度不变，只调整结束角度
      nextAngle = angle + newAngleRange;
    }
    
    // 设置扇形颜色
    if (active) {
      // 根据音高偏移调整颜色
      let beatColorWithPitch = color(nodeBeatColor);
      let nodeColorWithPitch = color(nodeColor);
      
      if (pitchOffset !== 0) {
        // 音高为正时，颜色向白色偏移（更亮）
        if (pitchOffset > 0) {
          const brightnessFactor = map(pitchOffset, 0, 12, 0, 0.4);
          beatColorWithPitch = lerpColor(nodeBeatColor, color(255), brightnessFactor);
          nodeColorWithPitch = lerpColor(nodeColor, color(255), brightnessFactor);
        } 
        // 音高为负时，颜色向黑色偏移（更暗）
        else if (pitchOffset < 0) {
          const darknessFactor = map(pitchOffset, 0, -12, 0, 0.5);
          beatColorWithPitch = lerpColor(nodeBeatColor, color(0), darknessFactor);
          nodeColorWithPitch = lerpColor(nodeColor, color(0), darknessFactor);
        }
      }
      
      if (isCurrent) {
        // 当前步进位置 - 活跃状态
        fill(nodeColorWithPitch); // 使用节点颜色，保持全亮度
      } else if (isHovered) {
        // 悬停效果 - 混合节点颜色和白色
        let c = lerpColor(nodeColorWithPitch, color(255), 0.2);
        fill(c);
      } else {
        // 正常显示
        fill(beatColorWithPitch); // 使用节点的beatColor
      }
    } else {
      if (isCurrent) {
        // 当前步进位置 - 非活跃状态
        fill(60, 180); // 稍微亮一些的灰色
      } else if (isHovered) {
        fill(60, 130); // 悬停效果
      } else {
        fill(60, 100); // 正常显示
      }
    }
    
    // 使用不同的方法实现等宽间距：
    // 1. 先绘制完整的扇形填充部分（无描边）
    noStroke();
    
    // 根据音高偏移调整扇形半径
    let stepRadius = ui.stepRadius;
    if (active) {
      // 重新设计音高映射方式
      // -12音高对应最靠近圆心的扇形(innerRadius + 10)
      // 0音高对应中间位置
      // +12音高对应紧靠外边框的扇形(stepRadius)
      
      // 计算默认音高0对应的半径值(内外半径的中间位置)
      const defaultRadius = ui.innerRadius + (ui.stepRadius - ui.innerRadius) * 0.6;
      
      // 如果有音高偏移，调整半径
      if (pitchOffset !== 0) {
        // 将音高范围-12到+12映射到扇形半径范围
        stepRadius = map(
          pitchOffset, 
          -12, 12, 
          ui.innerRadius + 10,  // 最小半径(最低音高)
          ui.stepRadius - 2     // 最大半径(最高音高)，留一点边距
        );
      } else {
        // 音高为0时使用默认半径
        stepRadius = defaultRadius;
      }
    }
    
    // 绘制扇形填充部分，半径根据音高偏移调整
    // 使用比实际半径稍小的值来绘制填充，为描边留出空间
    const fillRadius = stepRadius - borderWidth/2;
    arc(ui.centerX, ui.centerY, fillRadius * 2, fillRadius * 2, angle, nextAngle, PIE);
    
    // 2. 绘制扇形的描边
    stroke(30); // 使用与内部中心圆相同的深色，恢复为不透明
    strokeWeight(gapWidth); // 使用固定宽度
    noFill();
    
    // 首先绘制圆弧部分描边
    arc(ui.centerX, ui.centerY, stepRadius * 2 - borderWidth/2, stepRadius * 2 - borderWidth/2, angle, nextAngle, OPEN);
    
    // 然后绘制两条径向线条作为扇形边缘
    // 绘制两条线：当前扇形的两边（长度根据音高偏移调整）
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
  stroke(30); // 与内部中心圆颜色一致的深色，恢复为不透明
  strokeWeight(borderWidth); // 使用定义的边框宽度
  ellipse(ui.centerX, ui.centerY, ui.stepRadius * 2);
  
  // 重新绘制内圆（确保分隔线不会进入内圆）
  fill(30); // 恢复为不透明
  noStroke();
  ellipse(ui.centerX, ui.centerY, ui.innerRadius * 2);
  
  // 绘制播放按钮
  if (metronome.isPlaying) {
    // 如果正在播放，绘制暂停图标
    // 使用当前预设插槽的固定颜色
    fill(nodes.length > 0 ? nodeColor : color(presetSlotColors[ui.currentPattern]));
    noStroke();
    rect(ui.centerX - 15, ui.centerY - 15, 10, 30, 2);
    rect(ui.centerX + 5, ui.centerY - 15, 10, 30, 2);
  } else {
    // 如果暂停中，绘制播放图标
    // 使用当前预设插槽的固定颜色
    fill(nodes.length > 0 ? nodeColor : color(presetSlotColors[ui.currentPattern]));
    noStroke();
    beginShape();
    vertex(ui.centerX - 10, ui.centerY - 15);
    vertex(ui.centerX + 15, ui.centerY);
    vertex(ui.centerX - 10, ui.centerY + 15);
    endShape(CLOSE);
  }
  
  // 如果正在拖动步进点，显示当前音高偏移的提示
  if (dragState.isDragging && dragState.stepIndex !== -1 && nodes.length > 0) {
    // 移除音高和持续时间信息的显示
    // 不需要显示任何拖拽反馈文本信息
  }
  
  pop();
}

// 更新绘制分辨率控制函数，添加加减按钮
function drawResolution() {
  push();
  
  // 获取当前是否可编辑状态
  // const canEdit = isEditable(); // 我们不再使用此变量
  
  // 背景框
  fill(40, 180); // 与环形背景相同的颜色，添加半透明效果
  stroke(30, 180); // 与内部中心圆颜色一致的深色，半透明
  strokeWeight(1);
  rect(ui.centerX - 80, ui.resolution.rect.y, 160, 30, 5);
  
  // 文本显示 - 使用正常亮度文本
  fill(200); // 不再根据播放状态变灰
  textAlign(CENTER, CENTER);
  textSize(16);
  text("Res: " + ui.resolution.value, ui.centerX, ui.resolution.rect.y + 15);
  
  // 按钮样式始终保持正常
  const buttonFill = 40; // 始终使用正常颜色
  const hoverFill = 50; // 始终允许悬停高亮
  
  // 减少按钮
  fill(ui.resolution.minusHovered ? hoverFill : buttonFill, 180); // 添加半透明效果
  stroke(30, 180); // 与内部中心圆颜色一致的深色，半透明
  strokeWeight(1);
  rect(ui.resolution.minusX, ui.resolution.rect.y, 30, 30, 5, 0, 0, 5);
  fill(200); // 始终使用正常亮度的文本
  textAlign(CENTER, CENTER);
  text("-", ui.resolution.minusX + 15, ui.resolution.rect.y + 15);
  
  // 增加按钮
  fill(ui.resolution.plusHovered ? hoverFill : buttonFill, 180); // 添加半透明效果
  stroke(30, 180); // 与内部中心圆颜色一致的深色，半透明
  strokeWeight(1);
  rect(ui.resolution.plusX, ui.resolution.rect.y, 30, 30, 0, 5, 5, 0);
  fill(200); // 始终使用正常亮度的文本
  textAlign(CENTER, CENTER);
  text("+", ui.resolution.plusX + 15, ui.resolution.rect.y + 15);
  
  pop();
}

// 辅助函数：判断当前是否允许编辑
// 当节拍器播放时返回false，暂停时返回true
function isEditable() {
  // 返回true允许在播放过程中编辑
  return true; // 修改为始终允许编辑
}

// 修改mouseClicked函数
function mouseClicked() {
  // 检查用户是否有权限点击交互
  if (window.isUserAllowedToClick && !window.isUserAllowedToClick(mouseX, mouseY)) {
    // 如果是在未选择插槽的情况下尝试点击，自动显示插槽选择对话框
    if (window.colyseusConnected && window.colyseusSlotStates && window.colyseusSlotStates.mySlot === -1) {
      // 仅显示一次插槽选择对话框
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
    // 调用导入/导出对话框
    if (window.patternImportExport && typeof window.patternImportExport.showImportExportDialog === 'function') {
      window.patternImportExport.showImportExportDialog(ui.currentPattern);
    }
    return;
  }
  
  // 检查是否点击了合成器按钮 - 这个按钮应该在步进器界面上，但功能与之前的toggle-synth-button相同
  if (ui.synthButton.hovered) {
    // 切换合成器UI可见性
    metronome.synthUI.visible = !metronome.synthUI.visible;
    
    // 如果显示合成器UI，则隐藏步进器和乐谱
    if (metronome.synthUI.visible) {
      window.rhythmVisible = false;
      
      // 分发合成器UI可见性变化事件
      window.dispatchEvent(new CustomEvent('synth-ui-visibility-change', {
        detail: { visible: true }
      }));
    } else {
      // 如果隐藏合成器UI，则显示步进器和乐谱
      window.rhythmVisible = true;
      
      // 分发合成器UI可见性变化事件
      window.dispatchEvent(new CustomEvent('synth-ui-visibility-change', {
        detail: { visible: false }
      }));
    }
    
    return;
  }
  
  // 原有的mouseClicked处理代码
  // 如果步进器不可见，完全禁止所有鼠标事件处理
  if (!window.rhythmVisible || window.p5CanvasOpacity === 0) {
    return false;
  }
  
  // 添加拖拽保护：检查是否在拖拽释放后的一定时间内
  const currentTime = millis();
  if (dragState.dragProtectionActive) {
    // 在拖拽释放后300毫秒内阻止点击事件
    if (currentTime - dragState.releaseTime < 300) {
      // 到时间后自动清除保护状态
      if (currentTime - dragState.releaseTime >= 270) {
        dragState.dragProtectionActive = false;
        dragState.wasDragging = false;
      }
      return false;
    } else {
      // 超过保护时间，重置保护状态
      dragState.dragProtectionActive = false;
      dragState.wasDragging = false;
    }
  }
  
  // 修改这里：不再阻止拖拽后的点击，而是直接重置拖拽标记
  if (dragState.wasDragging) {
    // 重置拖拽标记
    dragState.wasDragging = false;
    // 不再直接返回，允许点击事件继续处理
  }

  // 检查是否点击了模式选择器按钮
  for (let i = 0; i < ui.patternSelector.buttons.length; i++) {
    let button = ui.patternSelector.buttons[i];
    if (mouseX >= button.x && mouseX <= button.x + button.w &&
        mouseY >= button.y && mouseY <= button.y + button.h) {
      
      // 即使在播放状态下也能切换预设
      // 如果当前有节点数据，先保存到当前预设
      if (nodes.length > 0) {
        window.saveCurrentPreset();
      }
      
      // 加载选择的预设
      loadPreset(i);
      
      // 触发模式变化事件，用于通知合成器UI更新当前插槽
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
      
      // 临时禁用拖拽标志，确保变体添加操作不受影响
      const wasDragging = window.isDraggingInOverview;
      window.isDraggingInOverview = false;
      
      // 获取当前变体索引
      const currentVariantIndex = window.presetManager.patterns[currentSlot].currentVariant;
      
      // 保存当前编辑
      window.presetManager.saveCurrentPreset(currentSlot, null, currentVariantIndex);
      
      // 创建新变体
      const variants = window.presetManager.patterns[currentSlot].variants;
      const newVariantIndex = variants.length;
      window.presetManager.saveCurrentPreset(currentSlot, [], newVariantIndex);
      
      // 加载新创建的空变体
      window.presetManager.loadPreset(currentSlot, newVariantIndex);
      
      // 触发圆环数据变化事件，确保五线谱更新
      triggerCircleDataChange();
      
      // 延迟恢复拖拽标志，确保同步操作完成
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
      
      // 临时禁用拖拽标志，确保变体切换时同步正常工作
      const wasDragging = window.isDraggingInOverview;
      window.isDraggingInOverview = false;
      
      const variants = window.presetManager.patterns[currentSlot].variants;
      
      // 检查是否点击了删除按钮区域
      if (variants.length > 1 && 
          mouseX >= button.x + button.w - 8 && mouseX <= button.x + button.w &&
          mouseY >= button.y && mouseY <= button.y + 8) {
        
        // 删除变体
        const currentVariantIndex = window.presetManager.patterns[currentSlot].currentVariant;
        
        // 从变体数组中移除点击的变体
        variants.splice(i, 1);
        
        // 调整当前变体索引
        if (i === currentVariantIndex) {
          // 如果删除的是当前变体，切换到前一个或第一个
          window.presetManager.patterns[currentSlot].currentVariant = i > 0 ? i - 1 : 0;
        } else if (i < currentVariantIndex) {
          // 如果删除的是前面的变体，索引减一
          window.presetManager.patterns[currentSlot].currentVariant--;
        }
        
        // 加载调整后的当前变体
        window.presetManager.loadPreset(currentSlot, window.presetManager.patterns[currentSlot].currentVariant);
        
        // 触发圆环数据变化事件，确保五线谱更新
        triggerCircleDataChange();
        
        // 新增：确保总览视图更新所有插槽的数据
        if (window.circleOverview && typeof window.circleOverview.updateSingleSlotData === 'function') {
          // 遍历所有插槽，更新所有插槽数据到总览视图
          for (let slotIndex = 0; slotIndex < 8; slotIndex++) {
            window.circleOverview.updateSingleSlotData(slotIndex);
          }
        }
      } else {
        // 切换到点击的变体
        // 获取当前变体索引
        const currentVariantIndex = window.presetManager.patterns[currentSlot].currentVariant;
        
        // 如果点击的不是当前活动的变体，才进行切换
        if (i !== currentVariantIndex) {
          // 保存当前编辑
          window.presetManager.saveCurrentPreset(currentSlot, null, currentVariantIndex);
          
          // 加载选中的变体
          window.presetManager.loadPreset(currentSlot, i);
          
          // 触发圆环数据变化事件，确保五线谱更新
          triggerCircleDataChange();
        }
      }
      
      // 延迟恢复拖拽标志，确保同步操作完成
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
    // 检查是否点击了中心区域（即使步进器不可见也应当允许播放/暂停）
    if (distToCenter <= ui.innerRadius) {
      // 在中心区域，切换节拍器状态
      metronome.beatToggle();
      return;
    }
    
    // 检查是否点击了Resolution控制器 - 暂时注释掉，有BUG
    /*
    if (mouseY >= ui.resolution.rect.y && mouseY <= ui.resolution.rect.y + 30) {
      // 减号按钮
      if (mouseX >= ui.resolution.minusX && mouseX <= ui.resolution.minusX + 30) {
        // 点击了减号，减小分辨率
        updateResolution(max(0, ui.resolution.currentIndex - 1));
        return;
      }
      // 加号按钮
      else if (mouseX >= ui.resolution.plusX && mouseX <= ui.resolution.plusX + 30) {
        // 点击了加号，增大分辨率
        updateResolution(min(ui.resolution.values.length - 1, ui.resolution.currentIndex + 1));
        return;
      }
    }
    */
    
    // 检查是否点击了BPM控制器
    if (mouseY >= ui.bpmControl.y && mouseY <= ui.bpmControl.y + 30) {
      // BPM可以随时调整，包括播放过程中
      
      // 整个区域现在都用于拖动/编辑
      if (mouseX >= ui.centerX - 80 && mouseX <= ui.centerX + 80) {
        // 点击中央区域，如果未处于编辑模式，则进入编辑模式
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
    
    // 确保有节点
    if (nodes.length === 0) {
      // 使用当前预设插槽的固定颜色
      let selectedColor = presetSlotColors[ui.currentPattern];
      
      // 创建新节点
      addRhythmPattern({
        index: 0,
        alpha: new Array(32).fill(0.1),
        color: selectedColor
      });
    }
    
    // 切换步进状态
    if (nodes[0].alpha) {
      // 检查是要打开还是关闭步进
      const isActive = nodes[0].alpha[stepIndex] > 0.5;
      
      if (isActive) {
        // 关闭步进：设置alpha为0.1并重置所有相关属性
        nodes[0].alpha[stepIndex] = 0.1;
        
        // 重置音高偏移为默认值0
        if (nodes[0].pitchOffset) {
          nodes[0].pitchOffset[stepIndex] = 0;
        }
        
        // 重置持续时间为默认值1.0
        if (nodes[0].duration) {
          nodes[0].duration[stepIndex] = 1.0;
        }
        
        // 清除该步进作为源的所有合并标记
        if (nodes[0].mergedTo) {
          // 清除所有指向该步进的合并标记
          for (let i = 0; i < nodes[0].mergedTo.length; i++) {
            if (nodes[0].mergedTo[i] === stepIndex) {
              nodes[0].mergedTo[i] = -1;
            }
          }
        }
      } else {
        // 打开步进：设置alpha为1.0
        nodes[0].alpha[stepIndex] = 1.0;
      }
      
      // 保存当前预设
      window.saveCurrentPreset();
      
      // 在修改步骤后立即触发圆环数据变化事件
      triggerCircleDataChange();
    }
    
    return;
  }
  
  // 检查是否点击了中心圆（播放/暂停）
  if (distToCenter <= ui.innerRadius) {
    // 在中心区域，切换节拍器状态
    metronome.beatToggle();
    return;
  }
  
  // 检查是否点击了步进数量控制器 - 暂时注释掉，有BUG
  /*
  if (mouseY >= ui.stepCountControls.y && mouseY <= ui.stepCountControls.y + 30) {
    // 减号按钮
    if (mouseX >= ui.stepCountControls.minusX && mouseX <= ui.stepCountControls.minusX + 30) {
      // 点击了减号，减少步数
      updateStepCount(max(4, ui.stepCount - 4));
      return;
    }
    // 加号按钮
    else if (mouseX >= ui.stepCountControls.plusX && mouseX <= ui.stepCountControls.plusX + 30) {
      // 点击了加号，增加步数
      updateStepCount(min(32, ui.stepCount + 4));
      return;
    }
  }
  */
  
  // 检查是否点击了Resolution控制器 - 暂时注释掉，有BUG
  /*
  if (mouseY >= ui.resolution.rect.y && mouseY <= ui.resolution.rect.y + 30) {
    // 减号按钮
    if (mouseX >= ui.resolution.minusX && mouseX <= ui.resolution.minusX + 30) {
      // 点击了减号，减小分辨率
      updateResolution(max(0, ui.resolution.currentIndex - 1));
      return;
    }
    // 加号按钮
    else if (mouseX >= ui.resolution.plusX && mouseX <= ui.resolution.plusX + 30) {
      // 点击了加号，增大分辨率
      updateResolution(min(ui.resolution.values.length - 1, ui.resolution.currentIndex + 1));
      return;
    }
  }
  */
  
  // 检查是否点击了八度控制按钮
  if (mouseY >= ui.pitchControl.octaveControl.y && mouseY <= ui.pitchControl.octaveControl.y + 30) {
    // 获取当前插槽索引
    const currentPresetIndex = ui.currentPattern;
    
    // 减号按钮
    if (mouseX >= ui.pitchControl.octaveControl.minusX && mouseX <= ui.pitchControl.octaveControl.minusX + 30) {
      // 点击了减号，降低八度
      changePresetOctave(currentPresetIndex, -1);
      return;
    }
    // 加号按钮
    else if (mouseX >= ui.pitchControl.octaveControl.plusX && mouseX <= ui.pitchControl.octaveControl.plusX + 30) {
      // 点击了加号，提高八度
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
    // 回车键确认输入
    if (keyCode === ENTER || keyCode === RETURN) {
      // 尝试解析用户输入的BPM值
      const newBpm = parseInt(ui.bpmControl.editValue);
      if (!isNaN(newBpm) && newBpm >= 30 && newBpm <= 300) {
        // 有效的BPM值
        updateBPM(newBpm);
      } else {
        // 无效的BPM值，恢复原值
        ui.bpmControl.editValue = ui.bpmControl.value.toString();
      }
      // 退出编辑模式
      ui.bpmControl.isEditing = false;
      return false;
    }
    // ESC键取消编辑
    else if (keyCode === ESCAPE) {
      ui.bpmControl.isEditing = false;
      return false;
    }
    // 退格键删除最后一个字符
    else if (keyCode === BACKSPACE) {
      if (ui.bpmControl.editValue.length > 0) {
        ui.bpmControl.editValue = ui.bpmControl.editValue.slice(0, -1);
      }
      return false;
    }
    // 数字键输入
    else if ((keyCode >= 48 && keyCode <= 57) || (keyCode >= 96 && keyCode <= 105)) {
      // 标准数字键或数字小键盘
      const digit = keyCode >= 96 ? keyCode - 96 : keyCode - 48;
      // 限制输入长度，防止溢出
      if (ui.bpmControl.editValue.length < 3) {
        ui.bpmControl.editValue += digit.toString();
      }
      return false;
    }
    
    // BPM编辑模式下拦截所有按键
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
  
  // Add step with + key
  if (keyCode === 107 || keyCode === 187) { // + key
    if (ui.stepCount < maxSteps) {
      updateStepCount(ui.stepCount + 1);
    }
    return false;
  }
  
  // Remove step with - key
  else if (keyCode === 109 || keyCode === 189) { // - key
    if (ui.stepCount > minSteps) {
      updateStepCount(ui.stepCount - 1);
    }
    return false;
  }
  
  // Increase BPM with arrow up
  else if (keyCode === UP_ARROW) {
    updateBPM(metronome.bpm + 1);
    return false;
  }
  
  // Decrease BPM with arrow down
  else if (keyCode === DOWN_ARROW) {
    updateBPM(metronome.bpm - 1);
    return false;
  }
  
  // Fast increase BPM with shift + arrow up
  else if (keyCode === UP_ARROW && keyIsDown(SHIFT)) {
    updateBPM(metronome.bpm + 10);
    return false;
  }
  
  // Fast decrease BPM with shift + arrow down
  else if (keyCode === DOWN_ARROW && keyIsDown(SHIFT)) {
    updateBPM(metronome.bpm - 10);
    return false;
  }
  
  // Toggle metronome with F2
  else if (keyCode === 113) { // F2
    metronome.beatToggle();
    return false;
  }
  
  // M key (MIDI功能已移除)
  else if (keyCode === 77) { // M key
    // MIDI功能已移除
    return false;
  }
  
  // Create default rhythm pattern with D key
  else if (keyCode === 68) { // D key
    // 检查是否有权限编辑当前预设
    if (!(window.canEditColyseusSlot ? window.canEditColyseusSlot(ui.currentPattern) : 
          (window.presetManager && window.presetManager.canEditSlot ? 
           window.presetManager.canEditSlot(ui.currentPattern) : false))) {
      return false;
    }
    
      // 使用当前预设插槽的固定颜色
      const selectedColor = presetSlotColors[ui.currentPattern];
      
      createDefaultRhythm(selectedColor);
      window.syncSharedFromLocal();
    return false;
  }
  
  // Toggle metronome with T key
  else if (keyCode === 84) { // T key
    metronome.beatToggle();
    return false;
  }
  
  // Show current rhythm pattern with L key
  else if (keyCode === 76) { // L key
    return false;
  }
  
  // Clear rhythm patterns with C key
  else if (keyCode === 67) { // C key
    // 检查是否有权限编辑当前预设
    if (!(window.canEditColyseusSlot ? window.canEditColyseusSlot(ui.currentPattern) : 
          (window.presetManager && window.presetManager.canEditSlot ? 
           window.presetManager.canEditSlot(ui.currentPattern) : false))) {
      return false;
    }
  
    nodes = [];
    window.syncSharedFromLocal();
    return false;
  }
  
  // 显示选择控制插槽对话框
  else if (keyCode === 83) { // S key
    if (isConnected) {
      if (window.showSlotSelectionDialog && typeof window.showSlotSelectionDialog === 'function') {
        window.showSlotSelectionDialog();
      }
    } else {
      // 需要先连接到p5.party
    }
    return false;
  }
  
  // 变体切换快捷键 ([ 和 ] 键)
  if (keyCode === 219) { // [ 键，切换到上一个变体
    const currentSlot = ui.currentPattern;
    if (window.presetManager) {
      window.presetManager.cycleVariant(currentSlot, -1);
      
      // 更新UI中的活动变体按钮
      if (window.presetManager.patterns[currentSlot]) {
        ui.variantSelector.activeButton = window.presetManager.patterns[currentSlot].currentVariant;
      }
      
      // 确保变体选择器可见
      ui.variantSelector.visible = true;
      
      // 如果是协作模式，同步改动
      if (window.colyseusConnected && window.presetManager.canEditSlot(currentSlot)) {
        if (window.syncPresetToServer && typeof window.syncPresetToServer === 'function') {
          window.syncPresetToServer(currentSlot);
        }
      }
    }
    return false;
  } else if (keyCode === 221) { // ] 键，切换到下一个变体
    const currentSlot = ui.currentPattern;
    if (window.presetManager) {
      window.presetManager.cycleVariant(currentSlot, 1);
      
      // 更新UI中的活动变体按钮
      if (window.presetManager.patterns[currentSlot]) {
        ui.variantSelector.activeButton = window.presetManager.patterns[currentSlot].currentVariant;
      }
      
      // 确保变体选择器可见
      ui.variantSelector.visible = true;
      
      // 如果是协作模式，同步改动
      if (window.colyseusConnected && window.presetManager.canEditSlot(currentSlot)) {
        if (window.syncPresetToServer && typeof window.syncPresetToServer === 'function') {
          window.syncPresetToServer(currentSlot);
        }
      }
    }
    return false;
  }
}

// 新的函数：加载指定预设
function loadPreset(presetIndex, variantIndex) {
  // 检查预设索引是否有效
  if (presetIndex >= 0 && presetIndex < window.presetPatterns.length) {
    // 先保存当前预设
    window.saveCurrentPreset();
    
    // 更新当前预设索引
    ui.currentPattern = presetIndex;
    
    // 触发模式变化事件，用于通知合成器UI更新当前插槽
    window.dispatchEvent(new CustomEvent('pattern-change', {
      detail: { patternIndex: presetIndex }
    }));
    
    // 使用预设管理器加载预设（可选指定变体）
    window.presetManager.loadPreset(presetIndex, variantIndex);
    
    // 确保全局预设数组是最新的
    window.presetPatterns = window.presetManager.patterns;
    
    // 触发圆环数据变化事件，确保五线谱更新
    triggerCircleDataChange();
    
    // 新增：确保总览视图更新所有插槽的数据
    if (window.circleOverview && typeof window.circleOverview.updateSingleSlotData === 'function') {
      // 遍历所有插槽，更新所有插槽数据到总览视图
      for (let slotIndex = 0; slotIndex < 8; slotIndex++) {
        window.circleOverview.updateSingleSlotData(slotIndex);
      }
    }
    
    // 显示变体选择器
    ui.variantSelector.visible = true;
    
    // 更新UI中的活动变体按钮
    if (window.presetManager && window.presetManager.patterns[presetIndex]) {
      ui.variantSelector.activeButton = window.presetManager.patterns[presetIndex].currentVariant;
    }
    
    // 强制立即刷新UI，确保黄色边框正确显示
    if (typeof updateUIPositions === 'function') {
      updateUIPositions();
    }
    
    // 强制立即重绘
    if (typeof redraw === 'function') {
      redraw();
    }
    
    return true;
  }
  return false;
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

// 更新連接到OSC函數
function connectToOsc() {
  // 更新按钮状态
  const oscButton = document.getElementById('osc-button');
  if (oscButton) {
    oscButton.disabled = true;
    oscButton.textContent = 'Connecting OSC...';
  }
  
  try {
    // 检查OSC適配器是否已加载
    if (typeof oscAdapter === 'undefined') {
      throw new Error("OSC adapter not available");
    }
    
    // 连接OSC桥接服务
    
    // 使用节拍器对象连接OSC
    const success = metronome.connectOsc(8000, 12000);
    
    // 更新连接状态
    isOscConnected = success;
    
    if (success) {
      // 更新按钮状态
      if (oscButton) {
        oscButton.textContent = 'OSC Connected';
        oscButton.style.backgroundColor = '#9C27B0';
      }
      
      // 添加OSC事件处理
      setupOscEventHandlers();
      
      // OSC连接成功
      
      // 向控制台输出调试信息



    } else {
      throw new Error("Failed to connect to OSC");
    }
  } catch (error) {
    // OSC桥接连接失败
    alert("Failed to connect to OSC bridge. Make sure the bridge.js is running. Error: " + error.message);
    
    // 恢复按钮状态
    if (oscButton) {
      oscButton.disabled = false;
      oscButton.textContent = 'Connect OSC';
    }
  }
}

// 添加OSC事件处理函数
function setupOscEventHandlers() {
  oscAdapter.on('/cc', (value) => {
    // 处理Ableton的CC控制信息
    const controller = value[0];
    const ccValue = value[1];
    
    // 收到CC控制信息
    
    // 根据CC控制器编号处理不同的参数
    switch (controller) {
      case 1: // 控制节拍器BPM（映射到20-200范围）
        const newBpm = 20 + ccValue * 180 / 127;
        updateBPM(Math.round(newBpm));
        break;
      case 2: // 控制步进数量（映射到4-32范围，每4步一增）
        const steps = 4 + Math.floor(ccValue * 8 / 127) * 4;
        updateStepCount(steps);
        break;
      case 3: // 控制分辨率索引（映射到0-3范围）
        const resolutionIndex = Math.floor(ccValue * 4 / 127);
        updateResolution(resolutionIndex);
        break;
    }
  });
  
  // 处理Ableton发送的自定义触发
  oscAdapter.on('/custom/trigger', (value) => {
    const triggerType = value[0];
    
    if (triggerType === 'clear') {
      clearAllPatterns();
    } else if (triggerType === 'random') {
      createRandomPattern();
    }
  });
  
  // 添加一个测试发送，确认OSC连接正常工作
  // 发送测试OSC消息
  oscAdapter.send('/test', 1);
  oscAdapter.send('/test/array', [1, 2, 3]);
  
  // 设置周期性发送测试消息，验证连接持续有效
  setInterval(() => {
    if (isOscConnected) {
      // 发送一个简单的整数值，而不是时间戳（避免数值溢出）
      oscAdapter.send('/heartbeat', 1);
    }
  }, 5000); // 每5秒发送一次
}

// 创建随机节奏模式
function createRandomPattern() {
  if (!isEditable()) {
    // 播放期间不能创建随机模式
    return;
  }
  
  // 使用当前预设对应的固定颜色，而不是随机颜色
  const selectedColor = presetSlotColors[ui.currentPattern];
  
  // 创建随机节奏数组
  const pattern = new Array(32).fill(0.1);
  
  // 随机激活一些节拍位置
  for (let i = 0; i < 32; i++) {
    if (Math.random() > 0.7) { // 30%的概率激活一个节拍
      pattern[i] = 1.0;
    }
  }
  
  // 添加新轨道
  addRhythmPattern({
    index: 0,
    alpha: pattern,
    color: selectedColor
  });
  
  // 同步到Colyseus服务器
  if (window.syncPresetToServer && typeof window.syncPresetToServer === 'function') {
    window.syncPresetToServer(ui.currentPattern);
  }
}

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

// 新增函数：绘制OSC连接状态指示
function drawOscStatus() {
  if (isOscConnected) {
    push();
    noStroke();
    fill(156, 39, 176); // 紫色
    ellipse(width - 15, 15, 10, 10);
    pop();
  }
}

// metronome.beat方法的monkey patch已移除，现在使用AudioSequencer代替

// 在drawResolution函数后添加
function drawBpmControl() {
  push();
  
  // 背景框
  fill(40, 180); // 与环形背景相同的颜色，添加半透明效果
  stroke(30, 180); // 与内部中心圆颜色一致的深色，半透明
  strokeWeight(1);
  rect(ui.centerX - 80, ui.bpmControl.y, 160, 30, 5);
  
  // 根据悬停/拖动状态改变BPM值区域的颜色
  if (ui.bpmControl.isDragging) {
    // 正在拖动时的高亮色
    fill(70, 180); // 添加半透明效果
  } else if (ui.bpmControl.hovered) {
    // 悬停时的中等高亮
    fill(50, 180); // 添加半透明效果
  } else {
    // 正常状态
    fill(40, 180); // 添加半透明效果
  }
  
  // 绘制BPM值区域 - 调整宽度占满整个控制区域
  stroke(30, 180); // 添加半透明效果
  rect(ui.centerX - 80, ui.bpmControl.rect.y, 160, ui.bpmControl.rect.h, 3);
  
  // 文本显示 - BPM始终可以调整，即使在播放状态
  fill(200);
  textAlign(CENTER, CENTER);
  textSize(16);
  
  // 根据是否处于编辑模式显示不同内容
  if (ui.bpmControl.isEditing) {
    // 编辑模式显示输入框和光标
    text(ui.bpmControl.editValue + "|", ui.centerX, ui.bpmControl.y + 15);
    
    // 添加编辑提示
    fill(200, 200, 0); // 黄色提示文字
    textSize(10);
    text("按回车确认", ui.centerX, ui.bpmControl.y - 10);
  } else {
    // 正常模式显示BPM值
    text("BPM: " + ui.bpmControl.value, ui.centerX, ui.bpmControl.y + 15);
    
    // 删除悬停时显示的提示文字
  }
  
  pop();
}

// 替换原有的drawPitchControlButton函数
function drawPitchControlButton() {
  push();
  
  // 获取当前插槽索引
  const currentPresetIndex = ui.currentPattern;
  
  // 获取当前预设的音高设置
  const baseNote = metronome.baseNotes[currentPresetIndex] || 'C4';
  
  // 解析八度
  const match = baseNote.match(/([A-G][#b]?)(\d+)/);
  const octave = match ? match[2] : '4';
  
  // 不再使用isEditable()检查
  // const canEdit = isEditable();
  
  // 背景框
  fill(40, 180); // 与环形背景相同的颜色，添加半透明效果
  stroke(30, 180); // 与内部中心圆颜色一致的深色，半透明
  strokeWeight(1);
  rect(ui.pitchControl.octaveControl.rect.x, ui.pitchControl.octaveControl.y, ui.pitchControl.octaveControl.rect.w, ui.pitchControl.octaveControl.rect.h, 5);
  
  // 文本显示 - 始终使用正常亮度
  fill(200); // 不再根据播放状态变灰
  textAlign(CENTER, CENTER);
  textSize(16);
  text("Octave: C" + octave, ui.centerX, ui.pitchControl.octaveControl.y + 15);
  
  // 按钮样式始终保持正常
  const buttonFill = 40; // 始终使用正常颜色
  const hoverFill = 50; // 始终允许悬停高亮
  
  // 减少按钮
  fill(ui.pitchControl.octaveControl.minusHovered ? hoverFill : buttonFill, 180); // 添加半透明效果
  stroke(30, 180); // 与内部中心圆颜色一致的深色，半透明
  strokeWeight(1);
  rect(ui.pitchControl.octaveControl.minusX, ui.pitchControl.octaveControl.y, 30, 30, 5, 0, 0, 5);
  fill(200); // 始终使用正常亮度的文本
  textAlign(CENTER, CENTER);
  text("-", ui.pitchControl.octaveControl.minusX + 15, ui.pitchControl.octaveControl.y + 15);
  
  // 增加按钮
  fill(ui.pitchControl.octaveControl.plusHovered ? hoverFill : buttonFill, 180); // 添加半透明效果
  stroke(30, 180); // 与内部中心圆颜色一致的深色，半透明
  strokeWeight(1);
  rect(ui.pitchControl.octaveControl.plusX, ui.pitchControl.octaveControl.y, 30, 30, 0, 5, 5, 0);
  fill(200); // 始终使用正常亮度的文本
  textAlign(CENTER, CENTER);
  text("+", ui.pitchControl.octaveControl.plusX + 15, ui.pitchControl.octaveControl.y + 15);
  
  pop();
}

// 处理音高设置面板上的点击事件
function handlePitchControlPanelClick() {
  // 删除此函数
}

// 更改预设的音符
function changePresetNote(presetIndex, direction) {
  // 删除此函数
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

// 使用partySyncColyseus.js中定义的showSlotSelectionDialog函数

// 使用partySyncColyseus.js中定义的setColyseusViewOnlyMode和selectColyseusSlot函数

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

// 使用partySyncColyseus.js中定义的canEditColyseusSlot函数检查权限

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

// Colyseus集成：删除旧的shared变量引用，使用Colyseus连接系统替代
// 注意：此处不再需要设置window.shared，partySyncColyseus.js提供了新的同步机制

// 确保在初始加载后变体选择器立即可见
window.addEventListener('load', function() {
  // 确保变体选择器可见
  if (ui && ui.variantSelector) {
    ui.variantSelector.visible = true;
    
    // 刷新UI以显示变体选择器
    if (typeof updateUIPositions === 'function') {
      updateUIPositions();
    }
    
    // 立即重绘
    if (typeof redraw === 'function') {
      redraw();
    }
  }
  
  // 设置Colyseus连接按钮
  const colyseusConnectButton = document.getElementById('colyseus-connect-button');
  if (colyseusConnectButton && typeof window.showColyseusDialog === 'function') {
    colyseusConnectButton.addEventListener('click', window.showColyseusDialog);
  }
});

// 绘制合成器按钮
function drawSynthButton() {
  push();
  
  // 检查鼠标是否悬停在按钮上
  if (ui.synthButton.hovered) {
    fill(70, 70, 90, 220); // 悬停时的颜色
    stroke(100, 100, 120);
  } else {
    fill(50, 50, 70, 200); // 正常状态的颜色
    stroke(80, 80, 100);
  }
  
  // 绘制按钮背景
  strokeWeight(2);
  rect(ui.synthButton.x, ui.synthButton.y, ui.synthButton.width, ui.synthButton.height, 5);
  
  // 绘制按钮文本
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
  
  // 定义Clear按钮的位置和大小
  const buttonWidth = 160;
  const buttonHeight = 30;
  const buttonX = ui.centerX - buttonWidth/2;
  const buttonY = ui.bpmControl.y - buttonHeight - 10; // 位于BPM控制上方10像素
  
  // 检查鼠标是否悬停在按钮上
  const isHovered = mouseX >= buttonX && mouseX <= buttonX + buttonWidth && 
                   mouseY >= buttonY && mouseY <= buttonY + buttonHeight;
  
  // 根据悬停状态设置不同的填充颜色
  if (isHovered) {
    fill(70, 180); // 悬停时颜色较亮
  } else {
    fill(40, 180); // 正常颜色
  }
  
  // 绘制按钮背景
  stroke(30, 180);
  strokeWeight(1);
  rect(buttonX, buttonY, buttonWidth, buttonHeight, 5);
  
  // 绘制按钮文字
  fill(200);
  textAlign(CENTER, CENTER);
  textSize(16);
  text("Clear Rhythm", ui.centerX, buttonY + buttonHeight/2);
  
  // 存储按钮信息，以便在mouseClicked函数中使用
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
  
  // 检查鼠标是否悬停在按钮上
  if (ui.importExportButton.hovered) {
    fill(70, 70, 90, 220); // 悬停时的颜色
    stroke(100, 100, 120);
  } else {
    fill(50, 50, 70, 200); // 正常状态的颜色
    stroke(80, 80, 100);
  }
  
  // 绘制按钮背景
  strokeWeight(2);
  rect(ui.importExportButton.x, ui.importExportButton.y, ui.importExportButton.width, ui.importExportButton.height, 5);
  
  // 绘制按钮文本
  fill(220);
  textSize(14);
  textAlign(CENTER, CENTER);
  text("Import/Export", 
       ui.importExportButton.x + ui.importExportButton.width / 2, 
       ui.importExportButton.y + ui.importExportButton.height / 2);
  
  pop();
}

// 使用partySyncColyseus.js中定义的showCustomMessage函数显示消息