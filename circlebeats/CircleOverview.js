/**
 * CircleOverview.js - 所有插槽步进圆环总览视图
 * 显示所有8个预设插槽的圆环状态
 */

// 总览视图状态
const overviewState = {
  visible: false,         // 初始不可见
  container: null,        // 渲染容器
  canvas: null,           // 画布元素
  p5Instance: null,       // p5实例
  circleData: [],         // 所有圆环数据
  volumeSliders: [],      // 音量推子状态数组
  activeDragSlider: null  // 当前正在拖动的音量推子
};

// 初始化时直接创建全局访问接口
window.circleOverview = {
  show: showOverview,
  hide: hideOverview,
  toggle: toggleOverview,
  updateCircleData: updateCircleData,
  updateSingleSlotData: updateSingleSlotData, // 添加新方法
  refresh: refreshOverview
};

// 定义UI配置
let overviewUI = {
  canvasWidth: 800,        // 画布宽度
  canvasHeight: 800,       // 画布高度
  circles: [],             // 圆环配置数组
  stepCount: 16,           // 默认步数
  currentBeat: -1,         // 当前拍子
  gridSize: {              // 网格布局
    rows: 2,               // 改为2行
    cols: 4                // 改为4列
  },
  circleScale: 0.25,       // 减小圆环缩放比例以适应水平布局
  baseStepRadius: 200,     // 基础步进半径
  baseInnerRadius: 100,    // 基础内部半径
  padding: 40,             // 减小边距
  sidePadding: 30,         // 两侧边距
  verticalSpacing: 60,     // 增加垂直间隔，从40改为60
  horizontalSpacing: 20,   // 水平间隔
  fixedPositions: true,    // 使用固定位置
  slotColors: [            // 与主程序相同的颜色方案
    '#FF5252', // 预设1 - 红色
    '#FF9800', // 预设2 - 橙色
    '#FFEB3B', // 预设3 - 黄色
    '#4CAF50', // 预设4 - 绿色
    '#2196F3', // 预设5 - 蓝色
    '#673AB7', // 预设6 - 紫色
    '#E91E63', // 预设7 - 粉色
    '#00BCD4'  // 预设8 - 青色
  ],
  variantDots: {           // 变体小圆点配置
    maxVariants: 8,        // 最大变体数量
    size: 4,               // 圆点大小
    spacing: 12,           // 圆点之间的间距
    yOffset: 10,           // 距离圆环底部的距离
    activeSize: 10         // 当前选中的变体圆点大小
  },
  volumeSlider: {          // 音量推子配置
    arcThickness: 10,      // 圆弧厚度
    minVolume: -40,        // 最小音量(dB)
    maxVolume: 0,          // 最大音量(dB)
    defaultVolume: -10,    // 默认音量(dB)
    arcAngleStart: 0,      // 圆弧起始角度
    arcAngleEnd: 2 * Math.PI, // 圆弧结束角度（完整圆弧）
    dragSensitivity: 0.5   // 拖动灵敏度
  }
};

// 初始化总览视图
function initCircleOverview() {
  
  // 创建渲染容器
  createOverviewContainer();
  
  // 初始化圆环配置
  initCirclesConfig();
  
  // 初始化音量推子状态
  initVolumeSliders();
  
  // 设置事件监听
  setupOverviewEventListeners();
  
  // 初始化p5实例
  initP5Instance();
  
  // 设置定时检查布局变化
  setInterval(() => {
    if (overviewState.visible && overviewState.p5Instance && overviewState.container) {
      const containerRect = overviewState.container.getBoundingClientRect();
      const currentWidth = overviewState.p5Instance.width;
      const currentHeight = overviewState.p5Instance.height;
      const newWidth = containerRect.width || 800;
      const newHeight = containerRect.height || 350;
      
      // 如果尺寸发生变化，刷新总览视图
      if (Math.abs(currentWidth - newWidth) > 5 || Math.abs(currentHeight - newHeight) > 5) {
        refreshOverview();
      }
    }
  }, 500); // 每500ms检查一次
  
  return true;
}

// 创建总览视图容器
function createOverviewContainer() {
  // 查找已存在的overview-canvas-container
  const existingContainer = document.getElementById('overview-canvas-container');
  
  if (existingContainer) {
    // 使用已存在的容器
    overviewState.container = existingContainer;
    console.log('✅ 使用现有的总览容器');
  } else {
    // 如果容器不存在，创建一个临时容器（向下兼容）
    console.warn('⚠️ 未找到总览容器，创建临时容器');
    
    let overviewContainer = document.createElement('div');
    overviewContainer.id = 'overview-canvas-container-temp';
  overviewContainer.style.position = 'fixed';
  overviewContainer.style.top = '0';
  overviewContainer.style.left = '0';
  overviewContainer.style.width = '100vw';
  overviewContainer.style.height = '100vh';
    overviewContainer.style.display = 'none';
    overviewContainer.style.zIndex = '20';
  overviewContainer.style.background = 'transparent';
    overviewContainer.style.pointerEvents = 'auto';
  
  document.body.appendChild(overviewContainer);
  overviewState.container = overviewContainer;
  }
  
  // 添加CSS样式
  const styleId = 'circle-overview-styles';
  let styleElement = document.getElementById(styleId);
  if (styleElement) {
    styleElement.remove();
  }
  
  styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.textContent = `
    .overview-canvas-container canvas,
    #overview-canvas-container-temp canvas {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: transparent !important;
    }
  `;
  document.head.appendChild(styleElement);
}

// 初始化圆环配置
function initCirclesConfig() {
  overviewUI.circles = [];
  
  const { rows, cols } = overviewUI.gridSize;
  const totalCircles = 8; // 固定为8个插槽
  
  // 获取容器尺寸
  let containerWidth, containerHeight;
  if (overviewState.container) {
    const rect = overviewState.container.getBoundingClientRect();
    containerWidth = rect.width || 800;
    containerHeight = rect.height || 350;
  } else {
    containerWidth = 800;
    containerHeight = 350;
  }
  
  // 缩放后的圆环半径
  const stepRadius = overviewUI.baseStepRadius * overviewUI.circleScale;
  const innerRadius = overviewUI.baseInnerRadius * overviewUI.circleScale;
  
  // 计算网格布局的间距
  const totalWidth = containerWidth - 2 * overviewUI.sidePadding;
  const totalHeight = containerHeight - 2 * overviewUI.padding;
  
  // 计算每个圆环的可用空间
  const cellWidth = totalWidth / cols;
  const cellHeight = totalHeight / rows;
  
  // 生成各个圆环的位置
  for (let i = 0; i < totalCircles; i++) {
    // 计算当前圆环在网格中的行和列
    const row = Math.floor(i / cols);  // 第几行（0或1）
    const col = i % cols;              // 第几列（0-3）
    
    // 计算圆环中心位置
    const centerX = overviewUI.sidePadding + col * cellWidth + cellWidth / 2;
    const centerY = overviewUI.padding + row * cellHeight + cellHeight / 2;
    
    overviewUI.circles.push({
      centerX,
      centerY,
      stepRadius,
      innerRadius,
      slotIndex: i,
      color: overviewUI.slotColors[i]
    });
  }
}

// 初始化音量推子状态
function initVolumeSliders() {
  overviewState.volumeSliders = [];
  
  // 为每个插槽创建音量推子状态
  for (let i = 0; i < 8; i++) {
    // 从metronome获取当前音量值
    let volume = overviewUI.volumeSlider.defaultVolume;
    if (window.metronome && window.metronome.synthParams && window.metronome.synthParams[i]) {
      volume = window.metronome.synthParams[i].volume;
    }
    
    overviewState.volumeSliders.push({
      slotIndex: i,
      volume: volume,
      isDragging: false,
      tempVolume: volume, // 添加临时音量值，用于拖动过程中的显示
      isDirty: false      // 添加标记，表示是否需要同步
    });
  }
  

}

// 设置事件监听
function setupOverviewEventListeners() {
  // 监听节拍器事件
  window.addEventListener('metronome-beat', (event) => {
    if (event.detail) {
      // 更新当前拍子
      overviewUI.currentBeat = event.detail.beat % overviewUI.stepCount;
      // 如果总览视图可见，刷新显示
      if (overviewState.visible && overviewState.p5Instance) {
        overviewState.p5Instance.redraw();
      }
    }
  });
  
  // 监听Colyseus插槽状态变化 - 使用新的推送更新事件
  window.addEventListener('colyseus-slots-updated', (event) => {

    
    // 如果有明确的释放插槽信息，优先处理
    if (event.detail && event.detail.releasedSlots && event.detail.releasedSlots.length > 0) {
      // 立即处理已释放的插槽
      event.detail.releasedSlots.forEach(slotIndex => {

        // 更新单个插槽数据，确保其显示为空
        updateSingleSlotData(slotIndex);
      });
    }
    
    // 立即刷新总览视图以显示最新的用户名
    refreshOverview();
  });
  
  // 监听房间状态更新事件
  window.addEventListener('colyseus-room-state', () => {
    // 刷新总览视图
    refreshOverview();
  });
  
  // 保留仅需的事件监听
  window.addEventListener('colyseus-connected', () => {
    // 在连接成功时刷新，确保UI与服务器同步
    setTimeout(() => {
      refreshOverview();
    }, 100);
  });
  
  // 监听步数变化
  window.addEventListener('step-count-change', (event) => {
    if (event.detail && event.detail.stepCount) {
      overviewUI.stepCount = event.detail.stepCount;
      // 如果总览视图可见，刷新显示
      if (overviewState.visible && overviewState.p5Instance) {
        overviewState.p5Instance.redraw();
      }
    }
  });
  
  // 监听圆环数据变化事件
  window.addEventListener('circle-data-change', (event) => {
    if (event.detail && event.detail.currentPreset !== undefined) {
      // 更新对应插槽的数据
      updateCircleData(event.detail.currentPreset, event.detail);
    }
  });
  
  // 监听音高变化事件
  window.addEventListener('base-note-change', (event) => {
    if (event.detail && event.detail.presetIndex !== undefined) {
      // 当音高变化时刷新全部数据
      updateAllCircleData();
      
      // 如果总览视图可见，刷新显示
      if (overviewState.visible && overviewState.p5Instance) {
        overviewState.p5Instance.redraw();
      }
    }
  });
  
  // 监听变体变更事件
  window.addEventListener('variant-changed', (event) => {
    if (event.detail && event.detail.presetIndex !== undefined) {
      const { presetIndex, variantIndex } = event.detail;
      
      // 当变体变化时更新所有数据
      updateAllCircleData();
      
      // 如果变更的是当前主视图显示的插槽，则需要确保主视图也刷新了数据
      if (window.ui && window.ui.currentPattern === presetIndex && 
          window.presetManager && window.presetManager.patterns[presetIndex]) {
        
        // 确保主视图的变体选择器状态与实际变体一致
        if (window.ui.variantSelector) {
          window.ui.variantSelector.activeButton = variantIndex;
        }
        
        // 确保主视图的数据也已更新
        if (typeof window.loadPreset === 'function') {
          // 延迟一点执行，避免时序问题
          setTimeout(() => {
            // 检查主视图是否已经加载了正确的变体
            if (window.presetManager.patterns[presetIndex].currentVariant !== variantIndex) {
              window.presetManager.patterns[presetIndex].currentVariant = variantIndex;
              window.loadPreset(presetIndex, variantIndex);
            }
            
            // 触发主视图圆环数据更新
            if (typeof window.triggerCircleDataChange === 'function') {
              window.triggerCircleDataChange();
            }
          }, 50);
        }
      }
      
      // 如果总览视图可见，刷新显示
      if (overviewState.visible && overviewState.p5Instance) {
        overviewState.p5Instance.redraw();
      }
    }
  });
  
  // 监听键盘事件 - 使用O键切换总览视图
  document.addEventListener('keydown', (event) => {
    if (event.key === 'o' || event.key === 'O') {
      toggleOverview();
    }
  });
  

}

// 初始化p5实例
function initP5Instance() {
  // 创建新的p5实例，禁用设备传感器
  const p5Options = {
    disableMobileControls: true, // 禁用移动设备控制
    // 禁用不必要的功能
    disableGestures: true,       // 禁用手势
    disableAcceleration: true,   // 禁用加速度计
    disableDeviceMotion: true,   // 禁用设备运动
    disableDeviceOrientation: true // 禁用设备方向
  };
  
  overviewState.p5Instance = new p5((p) => {
    p.disableDeviceMotion = true; // 在实例内部也禁用设备运动
    p.disableDeviceOrientation = true; // 在实例内部也禁用设备方向
    
    p.setup = function() {
      // 获取容器尺寸
      const containerRect = overviewState.container.getBoundingClientRect();
      const canvasWidth = containerRect.width || 800;
      const canvasHeight = containerRect.height || 350;
      
      // 创建画布
      const canvas = p.createCanvas(canvasWidth, canvasHeight);
      canvas.id('circle-overview-canvas');
      overviewState.canvas = canvas;
      
      // 设置基本属性
      p.frameRate(30);
      p.angleMode(p.RADIANS);
      p.ellipseMode(p.RADIUS);
      p.smooth();
      
      // 重新初始化圆环位置
      initCirclesConfig();
      
      // 只在需要时重绘
      p.noLoop();
      
      // 禁用设备动作和传感器
      if (typeof p.deviceMoved !== 'undefined') {
        p.deviceMoved = function() {}; // 空函数覆盖设备移动事件
      }
      if (typeof p.deviceTurned !== 'undefined') {
        p.deviceTurned = function() {}; // 空函数覆盖设备旋转事件
      }
      if (typeof p.deviceShaken !== 'undefined') {
        p.deviceShaken = function() {}; // 空函数覆盖设备摇动事件
      }
    };
    
    p.draw = function() {
      // 清除背景
      p.clear();
      
      // 绘制所有圆环
      overviewUI.circles.forEach((circle, index) => {
        drawCircle(p, circle, index);
        // 绘制音量推子
        drawVolumeSlider(p, circle, index);
      });
    };
    
    // 监听窗口大小变化
    p.windowResized = function() {
      // 获取容器尺寸
      const containerRect = overviewState.container.getBoundingClientRect();
      const canvasWidth = containerRect.width || 800;
      const canvasHeight = containerRect.height || 350;
      
      // 调整画布大小
      p.resizeCanvas(canvasWidth, canvasHeight);
      
        // 重新计算圆环位置
        initCirclesConfig();
    };
    
    // 添加鼠标点击事件处理
    p.mousePressed = function() {
      // 设置全局拖拽标志，准备可能的拖拽操作
      window.isDraggingInOverview = true;
      
      // 检查是否点击了变体选择器
      handleVariantSelection(p.mouseX, p.mouseY);
      // 检查是否点击了音量推子
      handleVolumeSliderPress(p.mouseX, p.mouseY);
    };
    
    // 添加鼠标拖动事件处理
    p.mouseDragged = function() {
      // 处理音量推子拖动
      handleVolumeSliderDrag(p.mouseX, p.mouseY);
    };
    
    // 添加鼠标释放事件处理
    p.mouseReleased = function() {
      // 处理音量推子释放
      handleVolumeSliderRelease();
      
      // 在所有操作完成后重置拖拽标志
      setTimeout(() => {
        window.isDraggingInOverview = false;
        
        // 仅在确实需要时触发一次同步，例如如果当前控制着某个插槽
        if (window.colyseusSlotStates && window.colyseusSlotStates.mySlot !== -1 && window.syncColyseusData) {
          window.syncColyseusData();
        }
      }, 100); // 短暂延迟以确保所有其他处理都完成
    };
  }, overviewState.container, p5Options);
}

// 绘制单个圆环
function drawCircle(p, circle, index) {
  const { centerX, centerY, stepRadius, innerRadius, slotIndex, color } = circle;
  
  p.push();
  
  // 获取当前插槽的数据
  const circleData = overviewState.circleData[slotIndex] || null;
  const nodeColor = color;
  
  // 绘制中心圆
  p.fill(30);
  p.stroke(30);
  p.strokeWeight(2);
  p.ellipse(centerX, centerY, innerRadius);
  
  // 绘制环形背景
  const borderWidth = 4 * overviewUI.circleScale;
  p.fill(40);
  p.noStroke();
  p.ellipse(centerX, centerY, stepRadius - borderWidth/2);
  
  // 挖空中心区域形成环
  p.fill(30);
  p.noStroke();
  p.ellipse(centerX, centerY, innerRadius);
  
  // 添加音量交互提示（当鼠标悬停在内圆时）
  const mousePos = { x: p.mouseX, y: p.mouseY };
  const distToCenter = Math.sqrt(Math.pow(mousePos.x - centerX, 2) + Math.pow(mousePos.y - centerY, 2));
  const isHoveringInnerCircle = distToCenter <= innerRadius;
  
  if (isHoveringInnerCircle) {
    p.fill(255, 50); // 降低高亮透明度，更加微妙
    p.noStroke();
    p.ellipse(centerX, centerY, innerRadius * 0.9);
    
    // 移除文字提示，保持界面简洁
  }
  
  // 设置间距宽度
  const gapWidth = 3 * overviewUI.circleScale;
  
  // 计算默认半径位置 - 移到这里定义，确保所有地方使用相同值
  const defaultRadius = innerRadius + (stepRadius - innerRadius) * 0.6;
  
  // 如果有圆环数据，绘制步进器
  if (circleData && circleData.nodes && circleData.nodes.length > 0) {
    const node = circleData.nodes[0];
    const activeSteps = node.alpha || [];
    const pitchOffsets = node.pitchOffset || [];
    const durations = node.duration || [];
    const mergedTo = node.mergedTo || [];
    
    // 绘制每个步骤
    for (let i = 0; i < overviewUI.stepCount; i++) {
      // 检查该步进是否被合并到其他步进中
      if (mergedTo && mergedTo[i] !== undefined && mergedTo[i] !== -1) {
        continue; // 跳过被合并的步进
      }
      
      // 计算角度
      const anglePerStep = p.TWO_PI / overviewUI.stepCount;
      const angle = -p.HALF_PI + i * anglePerStep;
      let nextAngle = angle + anglePerStep;
      
      // 获取步骤状态
      const active = activeSteps[i] > 0.5;
      const pitchOffset = pitchOffsets[i] || 0;
      const duration = durations[i] || 1.0;
      
      // 设置填充颜色
      if (active) {
        const alpha = i === overviewUI.currentBeat ? 255 : 180;
        p.fill(p.color(nodeColor + alpha.toString(16)));
      } else {
        p.fill(40); // 非激活状态使用灰色
      }
      
      // 调整扇形半径 - 根据音高偏移
      let activeStepRadius = circle.stepRadius;
      
      if (active) {
        if (pitchOffset !== 0) {
          // 将音高范围-12到+12映射到扇形半径范围
          activeStepRadius = p.map(
            pitchOffset, 
            -12, 12, 
            innerRadius + 10 * overviewUI.circleScale,
            circle.stepRadius - 2 * overviewUI.circleScale
          );
        } else {
          // 音高偏移为0时使用默认半径
          activeStepRadius = defaultRadius;
        }
      }
      
      // 处理持续时间
      if (active && duration > 1.0) {
        // 计算需要占用的扇形数量
        const sectorsToOccupy = Math.ceil(duration);
        
        // 特殊处理最大持续时间
        if (Math.abs(duration - 16.0) < 0.001 || sectorsToOccupy >= overviewUI.stepCount) {
          // 占用整个圆形
          nextAngle = angle + p.TWO_PI - 0.01;
        } else {
          // 普通情况下计算结束角度
          const maxSectorsToUse = Math.min(sectorsToOccupy - 1, overviewUI.stepCount - 1);
          nextAngle = p.TWO_PI * ((i + maxSectorsToUse) / overviewUI.stepCount) - p.HALF_PI;
          
          // 处理剩余部分
          const remainingFraction = duration - Math.floor(duration);
          if (remainingFraction > 0 && i + maxSectorsToUse < overviewUI.stepCount) {
            const additionalAngle = anglePerStep * remainingFraction;
            nextAngle += additionalAngle;
          }
          
          // 处理环绕过零点的情况
          if (nextAngle < angle) {
            nextAngle += p.TWO_PI;
          }
        }
      } else if (active && duration < 1.0) {
        // 缩小扇形
        const fullAngleRange = nextAngle - angle;
        const newAngleRange = fullAngleRange * duration;
        nextAngle = angle + newAngleRange;
      }
      
      // 绘制扇形填充部分
      const fillRadius = activeStepRadius - borderWidth/2;
      p.arc(centerX, centerY, fillRadius, fillRadius, angle, nextAngle, p.PIE);
      
      // 绘制扇形的描边
      p.stroke(30);
      p.strokeWeight(gapWidth);
      p.noFill();
      
      // 绘制圆弧描边
      p.arc(centerX, centerY, activeStepRadius - borderWidth/2, activeStepRadius - borderWidth/2, angle, nextAngle, p.OPEN);
      
      // 绘制径向线条
      p.line(
        centerX, 
        centerY, 
        centerX + p.cos(angle) * (activeStepRadius - borderWidth/2),
        centerY + p.sin(angle) * (activeStepRadius - borderWidth/2)
      );
      
      p.line(
        centerX, 
        centerY, 
        centerX + p.cos(nextAngle) * (activeStepRadius - borderWidth/2),
        centerY + p.sin(nextAngle) * (activeStepRadius - borderWidth/2)
      );
    }
    
      // 绘制播放状态指示（在有数据时才绘制）
  if (circleData && circleData.nodes && circleData.nodes.length > 0 && window.metronome) {
    if (window.metronome.isPlaying) {
      // 暂停图标
      p.fill(p.color(nodeColor));
      p.noStroke();
      const iconScale = overviewUI.circleScale;
      p.rect(centerX - 15 * iconScale, centerY - 15 * iconScale, 10 * iconScale, 30 * iconScale, 2 * iconScale);
      p.rect(centerX + 5 * iconScale, centerY - 15 * iconScale, 10 * iconScale, 30 * iconScale, 2 * iconScale);
    } else {
      // 播放图标
      p.fill(p.color(nodeColor));
      p.noStroke();
      const iconScale = overviewUI.circleScale;
      p.beginShape();
      p.vertex(centerX - 10 * iconScale, centerY - 15 * iconScale);
      p.vertex(centerX + 15 * iconScale, centerY);
      p.vertex(centerX - 10 * iconScale, centerY + 15 * iconScale);
      p.endShape(p.CLOSE);
    }
  }
  } else {
    // 如果没有数据，绘制空圆环
    
    // 删除"无数据"提示文本
  }
  
  // 绘制外部边框
  p.noFill();
  p.stroke(30);
  p.strokeWeight(borderWidth);
  p.ellipse(centerX, centerY, stepRadius);
  
  // 重新绘制内圆
  p.fill(30);
  p.noStroke();
  p.ellipse(centerX, centerY, innerRadius);
  
  // 在中心圆内显示控制插槽的用户名
  if (window.colyseusSlotStates && window.colyseusSlotStates.data && window.colyseusSlotStates.data.slotNames) {
    const slotUsername = window.colyseusSlotStates.data.slotNames[slotIndex];
    
    // 只要有用户名就显示，不做额外验证
    if (slotUsername) {
      // 先绘制一个黑色背景提高可读性
      p.fill(0, 120);
      p.noStroke();
      p.ellipse(centerX, centerY, innerRadius * 0.8);
      
      // 绘制用户名
      p.fill(255);
      p.noStroke();
      p.textAlign(p.CENTER, p.CENTER);
      
      // 处理用户名显示
      let displayName = slotUsername;
      
      // 根据用户名长度调整字体大小，最多8个字符
      if (displayName.length > 8) {
        displayName = displayName.substring(0, 7) + '…';
      }
      
      // 根据名称长度决定字体大小
      let textSize;
      if (displayName.length <= 4) {
        textSize = innerRadius * 0.35;
      } else if (displayName.length <= 6) {
        textSize = innerRadius * 0.3;
      } else {
        textSize = innerRadius * 0.25;
      }
      
      p.textSize(textSize);
      p.text(displayName, centerX, centerY);
    }
  }
  
  // 绘制变体选择圆点
  drawVariantDots(p, circle, slotIndex);
  
  p.pop();
}

// 绘制变体选择圆点
function drawVariantDots(p, circle, slotIndex) {
  // 获取预设数据
  if (!window.presetManager || !window.presetManager.patterns || !window.presetManager.patterns[slotIndex]) {
    return;
  }
  
  const pattern = window.presetManager.patterns[slotIndex];
  const variantCount = pattern.variants ? pattern.variants.length : 0;
  const currentVariant = pattern.currentVariant || 0;
  
  if (variantCount <= 0) return;
  
  const { centerX, centerY, stepRadius, color } = circle;
  const { size, spacing, yOffset } = overviewUI.variantDots;
  
  // 计算起始X位置，使圆点居中
  const totalWidth = (variantCount - 1) * spacing;
  let startX = centerX - totalWidth / 2;
  
  // 底部垂直偏移 - 放在圆环下方
  const dotY = centerY + stepRadius + yOffset;
  
  // 绘制变体圆点
  for (let i = 0; i < variantCount; i++) {
    const dotX = startX + i * spacing;
    const isActive = i === currentVariant;
    
    // 保存变体位置信息以便点击检测
    if (!circle.variantDots) {
      circle.variantDots = [];
    }
    
    circle.variantDots[i] = {
      x: dotX,
      y: dotY,
      size: size
    };
    
    // 绘制圆点
    if (isActive) {
      // 当前选中的变体 - 使用插槽颜色但不放大
      p.noStroke(); // 移除白色描边
      p.fill(p.color(color));
      p.ellipse(dotX, dotY, size);
    } else {
      // 未选中的变体
      p.noStroke();
      p.fill(180);
      p.ellipse(dotX, dotY, size);
    }
  }
}

// 处理变体选择点击
function handleVariantSelection(mouseX, mouseY) {
  if (!overviewState.visible || !window.presetManager) return;
  
  // 检查每个圆环的变体圆点
  for (let i = 0; i < overviewUI.circles.length; i++) {
    const circle = overviewUI.circles[i];
    const slotIndex = circle.slotIndex;
    
    // 跳过没有变体点的圆环
    if (!circle.variantDots) continue;
    
    // 检查点击是否命中任何变体圆点
    for (let variantIndex = 0; variantIndex < circle.variantDots.length; variantIndex++) {
      const dot = circle.variantDots[variantIndex];
      const hitSize = dot.size * 2; // 增大点击区域，让小圆点更容易点击
      
      // 简单的圆形碰撞检测
      const distance = Math.sqrt(Math.pow(mouseX - dot.x, 2) + Math.pow(mouseY - dot.y, 2));
      
      if (distance <= hitSize) {
        // 点击命中变体圆点

        
        // 改变当前变体
        if (window.presetManager.patterns[slotIndex]) {
          // 设置拖拽标志为false，允许这个操作进行同步
          window.isDraggingInOverview = false;
          
          // 保存之前的变体
          const currentVariantIndex = window.presetManager.patterns[slotIndex].currentVariant;
          if (window.presetManager.canEditSlot(slotIndex)) {
            window.presetManager.saveCurrentPreset(slotIndex, null, currentVariantIndex);
          }
          
          // 设置新的当前变体
          window.presetManager.patterns[slotIndex].currentVariant = variantIndex;
          
          // 如果点击的是当前在主视图上显示的插槽，则需要实际加载这个变体
          if (slotIndex === window.ui.currentPattern) {
            window.presetManager.loadPreset(slotIndex, variantIndex);
            
            // 更新主界面的变体选择器按钮状态
            if (window.ui && window.ui.variantSelector) {
              window.ui.variantSelector.activeButton = variantIndex;
            }
          }
          
          // 触发变体变更事件
          const event = new CustomEvent('variant-changed', {
            detail: {
              presetIndex: slotIndex,
              variantIndex: variantIndex
            }
          });
          window.dispatchEvent(event);
          
          // 更新圆环数据
          updateAllCircleData();
          
          // 重绘总览视图
          if (overviewState.p5Instance) {
            overviewState.p5Instance.redraw();
          }
          
          // 如果是当前插槽，还需要触发主视图的圆环数据更新
          if (slotIndex === window.ui.currentPattern && typeof window.triggerCircleDataChange === 'function') {
            window.triggerCircleDataChange();
          }
          
          return; // 找到了点击的圆点，退出函数
        }
      }
    }
  }
}

// 绘制单个音量推子 - 修改为使用临时音量值显示
function drawVolumeSlider(p, circle, index) {
  const { centerX, centerY, innerRadius, slotIndex, color } = circle;
  const { arcThickness, minVolume, maxVolume, arcAngleStart, arcAngleEnd } = overviewUI.volumeSlider;
  
  // 获取当前音量值 - 如果正在拖动，使用临时值
  const sliderState = overviewState.volumeSliders[slotIndex];
  const volume = sliderState.isDragging ? sliderState.tempVolume : sliderState.volume;
  
  // 计算音量弧的半径（略小于内圆半径）
  const arcRadius = innerRadius * 0.7;
  
  // 计算音量弧的结束角度（映射音量值到角度范围）
  const volumeRatio = (volume - minVolume) / (maxVolume - minVolume);
  const arcEndAngle = arcAngleStart + volumeRatio * (arcAngleEnd - arcAngleStart);
  
  p.push();
  
  // 绘制背景弧（灰色）- 完整圆形
  p.noFill();
  p.stroke(80);
  p.strokeWeight(arcThickness);
  p.strokeCap(p.ROUND);
  p.arc(centerX, centerY, arcRadius, arcRadius, arcAngleStart, arcAngleEnd);
  
  // 绘制音量弧（使用插槽颜色）
  if (volumeRatio > 0) {
    p.stroke(p.color(color));
    p.strokeWeight(arcThickness);
    p.arc(centerX, centerY, arcRadius, arcRadius, arcAngleStart, arcEndAngle);
  }
  
  // 保存音量弧区域信息以便点击检测
  circle.volumeSlider = {
    centerX,
    centerY,
    radius: arcRadius,
    thickness: arcThickness,
    startAngle: arcAngleStart,
    endAngle: arcAngleEnd,
    currentAngle: arcEndAngle
  };
  
  p.pop();
}

// 处理音量推子点击 - 更新isDragging状态
function handleVolumeSliderPress(mouseX, mouseY) {
  if (!overviewState.visible) return;
  
  // 检查每个圆环的音量推子
  for (let i = 0; i < overviewUI.circles.length; i++) {
    const circle = overviewUI.circles[i];
    const slotIndex = circle.slotIndex;
    
    // 跳过没有音量推子的圆环
    if (!circle.volumeSlider) continue;
    
    const slider = circle.volumeSlider;
    const { centerX, centerY, radius, thickness } = slider;
    
    // 计算鼠标到圆心的距离
    const distToCenter = Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2));
    
    // 扩大交互区域：检查鼠标是否在整个内圆区域内
    const isInCircle = distToCenter <= radius * 1.5;
    
    if (isInCircle) {
      // 开始拖动这个音量推子
      overviewState.activeDragSlider = {
        slotIndex: slotIndex,
        startY: mouseY,
        startVolume: overviewState.volumeSliders[slotIndex].volume
      };
      
      // 设置临时音量为当前音量
      overviewState.volumeSliders[slotIndex].tempVolume = overviewState.volumeSliders[slotIndex].volume;
      // 标记为正在拖动
      overviewState.volumeSliders[slotIndex].isDragging = true;
      // 重置脏标记
      overviewState.volumeSliders[slotIndex].isDirty = false;
      
      // 设置全局拖拽标志，阻止任何同步操作
      window.isDraggingInOverview = true;
      

      return true;
    }
  }
  
  return false;
}

// 处理音量推子拖动
function handleVolumeSliderDrag(mouseX, mouseY) {
  if (!overviewState.visible || !overviewState.activeDragSlider) return false;
  
  // 确保全局拖拽标志被设置
  window.isDraggingInOverview = true;
  
  // 更新音量值 - 仅更新临时值，不发送到服务器
  updateTempVolumeFromDragY(mouseY);
  
  // 重绘总览视图
  if (overviewState.p5Instance) {
    overviewState.p5Instance.redraw();
  }
  
  return true;
}

// 处理音量推子释放
function handleVolumeSliderRelease() {
  if (!overviewState.visible || !overviewState.activeDragSlider) return false;
  
  const slotIndex = overviewState.activeDragSlider.slotIndex;
  
  // 在应用任何更改之前，先清除全局拖拽标志
  window.isDraggingInOverview = false;
  
  // 如果值发生了变化，应用更改并同步
  if (overviewState.volumeSliders[slotIndex].isDirty) {
    // 应用临时音量值到实际音量
    const newVolume = overviewState.volumeSliders[slotIndex].tempVolume;
    overviewState.volumeSliders[slotIndex].volume = newVolume;
    
    // 更新实际合成器参数 - 这会触发同步
    if (window.metronome && window.metronome.synthParams && window.metronome.presetSounds) {
      // 更新参数对象
      window.metronome.synthParams[slotIndex].volume = newVolume;
      
      // 更新实际合成器
      if (window.metronome.presetSounds[slotIndex]) {
        window.metronome.presetSounds[slotIndex].volume.value = newVolume;

      }
    }
    
    // 重置脏标记
    overviewState.volumeSliders[slotIndex].isDirty = false;
    
    // 手动触发一次合成器参数变化事件，确保同步
    if (slotIndex === colyseusSlotStates.mySlot && window.syncColyseusData) {
      setTimeout(() => {
        window.syncColyseusData();
      }, 50); // 略微延迟同步，确保UI更新完成
    }
  }
  
  // 重置拖动状态
  overviewState.activeDragSlider = null;
  overviewState.volumeSliders[slotIndex].isDragging = false;
  
  return true;
}

// 根据鼠标Y位置更新临时音量值
function updateTempVolumeFromDragY(mouseY) {
  const { slotIndex, startY, startVolume } = overviewState.activeDragSlider;
  const { minVolume, maxVolume, dragSensitivity } = overviewUI.volumeSlider;
  
  // 计算Y方向移动距离
  const deltaY = startY - mouseY; // 向上拖动为正
  
  // 增加灵敏度，使音量变化更明显
  const volumeRange = maxVolume - minVolume;
  const volumeDelta = deltaY * dragSensitivity * 1.5 * (volumeRange / 100);
  
  // 计算新音量值
  let newVolume = startVolume + volumeDelta;
  
  // 限制在有效范围内
  newVolume = Math.max(minVolume, Math.min(maxVolume, newVolume));
  
  // 更新临时音量状态
  overviewState.volumeSliders[slotIndex].tempVolume = newVolume;
  overviewState.volumeSliders[slotIndex].isDirty = true;
  
  // 仅在本地更新UI显示，不更新实际合成器音量，不触发同步
}

// 显示总览视图
function showOverview() {
  if (!overviewState.container) {
    initCircleOverview();
  }
  
  // 更新步数设置，确保与主UI同步
  if (window.ui && window.ui.stepCount) {
    overviewUI.stepCount = window.ui.stepCount;
  }
  
  // 重新初始化圆环配置，确保位置正确
  initCirclesConfig();
  
  // 直接更新所有圆环数据
  updateAllCircleData();
  
  // 显示面板
  const mainInterface = document.querySelector('.main-interface');
  const overviewPanel = document.getElementById('overview-panel');
  
  if (mainInterface && overviewPanel) {
    mainInterface.classList.remove('hide-overview');
    overviewPanel.classList.remove('hidden');
  }
  
  overviewState.visible = true;
  
  // 延迟触发重绘，确保布局完成
  setTimeout(() => {
  if (overviewState.p5Instance) {
      // 重新计算canvas尺寸
      const containerRect = overviewState.container.getBoundingClientRect();
      const canvasWidth = containerRect.width || 800;
      const canvasHeight = containerRect.height || 350;
      
      overviewState.p5Instance.resizeCanvas(canvasWidth, canvasHeight);
      initCirclesConfig();
    overviewState.p5Instance.redraw();
  }
  }, 300);

  return true;
}

// 隐藏总览视图
function hideOverview() {
  // 隐藏面板
  const mainInterface = document.querySelector('.main-interface');
  const overviewPanel = document.getElementById('overview-panel');
  
  if (mainInterface && overviewPanel) {
    mainInterface.classList.add('hide-overview');
    overviewPanel.classList.add('hidden');
  }
  
  overviewState.visible = false;

  return false;
}

// 切换总览视图可见性
function toggleOverview() {
  // 确保拥有最新数据
  if (window.colyseusConnected && window.colyseusRoom) {
    try {
      // 主动请求最新插槽状态
      window.colyseusRoom.send("requestSlotState");
    } catch (e) {
      console.warn("请求插槽状态失败:", e);
    }
  }
  
  if (overviewState.visible) {
    return hideOverview();
  } else {
    return showOverview();
  }
}

// 更新所有圆环数据
function updateAllCircleData() {
  // 从预设管理器中获取所有插槽的数据
  if (window.presetManager && window.presetManager.patterns) {
    overviewState.circleData = [];
    
    // 确保volumeSliders数组已初始化
    if (!overviewState.volumeSliders) {
      // 如果volumeSliders不存在，先初始化它
      overviewState.volumeSliders = [];
      for (let i = 0; i < 8; i++) {
        overviewState.volumeSliders.push({ slotIndex: i, volume: -10, isDragging: false });
      }
    }
    
    // 如果在联网模式下，获取插槽用户名数据
    if (window.colyseusSlotStates && window.colyseusSlotStates.data) {
      // 确保slotNames数组已初始化
      if (!window.colyseusSlotStates.data.slotNames) {
        window.colyseusSlotStates.data.slotNames = [];
      }
      
      // 检查Colyseus房间对象
      if (window.colyseusConnected && window.colyseusRoom && window.colyseusRoom.state) {
        try {
          // 尝试从房间状态中获取最新的插槽数据
          const slots = window.colyseusRoom.state.slots;
          if (slots && Array.isArray(slots)) {
            for (let i = 0; i < slots.length && i < 8; i++) {
              const slot = slots[i];
              if (slot && slot.username) {
                window.colyseusSlotStates.data.slotNames[i] = slot.username;
              }
            }
          }
        } catch (e) {
          console.warn("从房间状态获取插槽数据失败:", e);
        }
      }
      

    }
    
    // 遍历所有预设插槽
    for (let i = 0; i < 8; i++) {
      const pattern = window.presetManager.patterns[i];
      
      // 获取当前变体索引
      const variantIndex = pattern.currentVariant || 0;
      
      // 获取当前变体数据
      let nodes = [];
      if (pattern.variants && pattern.variants[variantIndex]) {
        nodes = JSON.parse(JSON.stringify(pattern.variants[variantIndex]));
        
        // 确保节点有正确的音高偏移数据
        if (nodes.length > 0) {
          const node = nodes[0];
          if (!node.pitchOffset) {
            node.pitchOffset = new Array(overviewUI.stepCount).fill(0);
          }
        }
      }
      
      // 确保当前插槽的音量推子状态存在
      if (!overviewState.volumeSliders[i]) {
        overviewState.volumeSliders[i] = { slotIndex: i, volume: -10, isDragging: false };
      }
      
      // 安全地获取音量值
      if (window.metronome && window.metronome.synthParams && window.metronome.synthParams[i]) {
        overviewState.volumeSliders[i].volume = window.metronome.synthParams[i].volume;
      }
      
      // 存储数据
      overviewState.circleData[i] = {
        nodes: nodes,
        currentPreset: i,
        stepCount: overviewUI.stepCount,
        variantIndex: variantIndex, // 添加当前变体索引
        variantCount: pattern.variants ? pattern.variants.length : 0, // 添加变体总数
        baseNote: window.metronome && window.metronome.baseNotes ? 
                 window.metronome.baseNotes[i] || 'C4' : 'C4'
      };
    }
    

  }
}

// 更新特定插槽的圆环数据
function updateCircleData(slotIndex, data) {
  if (slotIndex >= 0 && slotIndex < 8) {
    // 确保数据包含节点信息
    if (data && data.nodes && data.nodes.length > 0) {
      // 确保节点有正确的音高偏移数据
      const node = data.nodes[0];
      if (!node.pitchOffset) {
        node.pitchOffset = new Array(overviewUI.stepCount).fill(0);
      }
    }
    
    overviewState.circleData[slotIndex] = data;
    
    // 如果总览视图可见，刷新显示
    if (overviewState.visible && overviewState.p5Instance) {
      overviewState.p5Instance.redraw();
    }
    

  }
}

// 刷新总览视图
function refreshOverview() {
  // 即使不可见也要更新数据，这样当显示时能立即看到正确的数据
  
  // 更新所有圆环数据
  updateAllCircleData();
  
  // 如果可见，检查并更新canvas尺寸
  if (overviewState.visible && overviewState.p5Instance && overviewState.container) {
    // 检查容器尺寸是否变化
    const containerRect = overviewState.container.getBoundingClientRect();
    const currentWidth = overviewState.p5Instance.width;
    const currentHeight = overviewState.p5Instance.height;
    const newWidth = containerRect.width || 800;
    const newHeight = containerRect.height || 350;
    
    // 如果尺寸发生变化，重新调整canvas
    if (Math.abs(currentWidth - newWidth) > 5 || Math.abs(currentHeight - newHeight) > 5) {
      console.log(`📊 总览视图尺寸更新: ${currentWidth}x${currentHeight} -> ${newWidth}x${newHeight}`);
      overviewState.p5Instance.resizeCanvas(newWidth, newHeight);
      initCirclesConfig();
    }
    
    // 触发重绘
    overviewState.p5Instance.redraw();
  }
}

// 更新特定插槽的圆环数据（从预设管理器直接获取数据）
function updateSingleSlotData(slotIndex) {
  if (slotIndex >= 0 && slotIndex < 8 && window.presetManager && window.presetManager.patterns) {
    const pattern = window.presetManager.patterns[slotIndex];
    
    // 获取当前变体索引
    const variantIndex = pattern.currentVariant || 0;
    
    // 获取当前变体数据
    let nodes = [];
    if (pattern.variants && pattern.variants[variantIndex]) {
      nodes = JSON.parse(JSON.stringify(pattern.variants[variantIndex]));
      
      // 确保节点有正确的音高偏移数据
      if (nodes.length > 0) {
        const node = nodes[0];
        if (!node.pitchOffset) {
          node.pitchOffset = new Array(overviewUI.stepCount).fill(0);
        }
      }
    }
    
    // 获取当前音量 - 添加额外的安全检查
    // 首先确保volumeSliders数组已初始化且当前索引项存在
    if (!overviewState.volumeSliders) {
      // 如果volumeSliders不存在，先初始化它
      overviewState.volumeSliders = [];
      for (let i = 0; i < 8; i++) {
        overviewState.volumeSliders.push({ 
          slotIndex: i, 
          volume: -10, 
          isDragging: false,
          tempVolume: -10,
          isDirty: false
        });
      }
    }
    
    // 确保当前插槽的音量推子状态存在
    if (!overviewState.volumeSliders[slotIndex]) {
      overviewState.volumeSliders[slotIndex] = { 
        slotIndex, 
        volume: -10, 
        isDragging: false,
        tempVolume: -10,
        isDirty: false
      };
    }
    
    // 安全地获取音量值 - 仅在未拖动时更新
    if (!overviewState.volumeSliders[slotIndex].isDragging && 
        window.metronome && window.metronome.synthParams && 
        window.metronome.synthParams[slotIndex]) {
      const newVolume = window.metronome.synthParams[slotIndex].volume;
      overviewState.volumeSliders[slotIndex].volume = newVolume;
      overviewState.volumeSliders[slotIndex].tempVolume = newVolume;
    }
    
    // 存储数据
    overviewState.circleData[slotIndex] = {
      nodes: nodes,
      currentPreset: slotIndex,
      stepCount: overviewUI.stepCount,
      variantIndex: variantIndex,
      variantCount: pattern.variants ? pattern.variants.length : 0,
      baseNote: window.metronome && window.metronome.baseNotes ? 
               window.metronome.baseNotes[slotIndex] || 'C4' : 'C4'
    };
    
    // 如果总览视图可见，刷新显示
    if (overviewState.visible && overviewState.p5Instance) {
      overviewState.p5Instance.redraw();
    }
  }
}

// 检查页面加载完成后进行初始化
document.addEventListener('DOMContentLoaded', () => {
  
  // 确保p5.js库已加载后再初始化
  if (typeof p5 !== 'undefined') {
    // 延迟初始化，确保其他组件已加载
    setTimeout(() => {
      initCircleOverview();
    }, 1000);
  } else {
    console.warn("等待p5.js库加载...");
    // 设置一个检查，等待库加载
    const checkInterval = setInterval(() => {
      if (typeof p5 !== 'undefined') {
        clearInterval(checkInterval);
        
        // 延迟初始化，确保其他组件已加载
        setTimeout(() => {
          initCircleOverview();
        }, 1000);
      }
    }, 500);
    
    // 10秒后如果仍未加载，发出警告
    setTimeout(() => {
      if (typeof p5 === 'undefined') {
        clearInterval(checkInterval);
        console.error("p5.js库加载失败，总览视图功能将不可用");
      }
    }, 10000);
  }
  
  // 添加额外的全局事件监听，确保在房间状态变化时刷新数据
  window.addEventListener('load', () => {
    // 延迟添加监听器，确保所有组件都已完全加载
    setTimeout(() => {
      if (window.colyseusRoom) {
        try {
          window.colyseusRoom.onStateChange(() => {
            if (overviewState.visible) {
              refreshOverview();
            }
          });
        } catch (e) {
          console.warn("添加房间状态监听器失败:", e);
        }
      }
    }, 3000);
  });
});