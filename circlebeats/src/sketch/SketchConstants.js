/**
 * SketchConstants.js
 * 常量定义、颜色数组、UI状态对象、拖拽状态
 * 从 Sketch.js 拆分而来
 */

// 支持与three.js的整合
if (typeof window.p5CanvasOpacity === 'undefined') {
  window.p5CanvasOpacity = 1.0;
}
if (typeof window.rhythmVisible === 'undefined') {
  window.rhythmVisible = true;
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
