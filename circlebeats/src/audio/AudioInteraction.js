/**
 * AudioInteraction.js - 鼠标交互处理
 *
 * 处理合成器面板的鼠标点击、拖拽、释放事件。
 * 这些方法会通过 index.js 混入到 AudioSequencer.prototype 上。
 */

export function setupSynthUIEvents() {
  // 添加切换按钮事件监听
  const toggleButton = document.getElementById('toggle-synth-button');
  if (toggleButton) {
    toggleButton.addEventListener('click', () => {
      this.synthUI.visible = !this.synthUI.visible;
      // 更新按钮文本
      toggleButton.textContent = this.synthUI.visible ? 'Hide Synth' : 'Show Synth';

      // 如果显示合成器UI，则隐藏步进器和乐谱
      if (this.synthUI.visible) {
        window.rhythmVisible = false;
        document.getElementById('toggle-rhythm-button').textContent = 'Show Rhythm';

        // 在显示合成器UI时，同步当前步进器选择的插槽
        if (window.ui && window.ui.currentPattern !== undefined) {
          this.synthUI.currentSlot = window.ui.currentPattern;
        }

        // 分发合成器UI可见性变化事件
        window.dispatchEvent(new CustomEvent('synth-ui-visibility-change', {
          detail: { visible: true }
        }));
      } else {
        // 如果隐藏合成器UI，则显示步进器和乐谱
        window.rhythmVisible = true;
        document.getElementById('toggle-rhythm-button').textContent = 'Hide Rhythm';

        // 分发合成器UI可见性变化事件
        window.dispatchEvent(new CustomEvent('synth-ui-visibility-change', {
          detail: { visible: false }
        }));

        // 分发节奏器可见性变化事件（因为我们刚刚设置了rhythmVisible为true）
        window.dispatchEvent(new CustomEvent('rhythm-visibility-change', {
          detail: { visible: true }
        }));
      }

      // 重绘界面
      if (typeof window.redraw === 'function') {
        window.redraw();
      }
    });
  }

  // 监听步进器插槽选择变化
  window.addEventListener('pattern-change', (event) => {
    if (event.detail && event.detail.patternIndex !== undefined) {
      // 更新合成器UI的当前插槽
      this.synthUI.currentSlot = event.detail.patternIndex;

      // 重绘界面
      if (typeof window.redraw === 'function') {
        window.redraw();
      }
    }
  });
}

export function handleSynthMousePressed(mx, my) {
  if (!this.synthUI.visible) return false;

  // 设置全局拖拽标志，防止在点击和拖拽过程中触发同步
  window.isDraggingInOverview = true;
  const currentSlot = this.synthUI.currentSlot;
  const params = this.synthParams[currentSlot];

  // 获取波形选择器位置信息，以便定位包络编辑器
  const buttonWidth = 30;
  const spacing = 5;
  const totalWidth = 8 * buttonWidth + 7 * spacing;
  const waveformStartX = ui.centerX - totalWidth / 2;
  const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
  const waveformHeight = 25; // 波形选择器高度改为25

  // 更新间距与drawSynthParameters保持一致
  const waveToEnvGap = 45; // 增加从30到45的间距

  // 包络线区域
  const envX = waveformStartX;
  const envY = waveformStartY + waveformHeight + waveToEnvGap;
  const envW = totalWidth;
  const envH = 90; // 保持不变

  // 最大时间
  const maxTimeWidth = 7; // 秒

  // 确定当前正在编辑的是哪种包络
  const isFilterEnv = this.synthUI.envelopePage === 1;

  // 获取当前参数，根据当前显示的页面选择
  let A, D, S, R;

  // 两种页面使用相同的坐标计算系统，只是使用不同的参数
  if (isFilterEnv) {
    A = params.filterAttack || 0.05;
    D = params.filterDecay || 0.3;
    S = params.filterSustain || 0.5;
    R = params.filterRelease || 0.5;
  } else {
    A = params.attack;
    D = params.decay;
    S = params.sustain;
    R = params.release;
  }

  // 固定的时间点
  const tA = A;
  const tD = tA + D;
  const tS = tD + 1; // S段固定1秒
  const tR = tS + R;

  // Y轴计算
  const y0 = envY + envH;
  const yMax = envY + 10; // 最高点（增加10px边距，避免节点超出框体）

  // 节点坐标 - 与drawSynthParameters中的计算完全一致
  const ptA = {
    x: envX + (tA / maxTimeWidth) * envW,
    y: yMax
  };
  const ptD = {
    x: envX + (tD / maxTimeWidth) * envW,
    y: yMax + (y0 - yMax) * (1 - S)
  };
  const ptS = {
    x: envX + (tS / maxTimeWidth) * envW,
    y: ptD.y
  };
  const ptR = {
    x: envX + (tR / maxTimeWidth) * envW,
    y: y0
  };

  // 检查是否点击节点 - 增加节点的点击区域半径，使其更容易点击
  const nodes = [
    ['A', ptA, 15], // 增加点击半径从12到15
    ['D', ptD, 15], // 增加点击半径从12到15
    ['S', ptS, 15], // 增加点击半径从12到15
    ['R', ptR, 15]  // 增加点击半径从12到15
  ];

  for (let [name, pt, hitRadius] of nodes) {
    if (dist(mx, my, pt.x, pt.y) <= hitRadius) {
      this.synthUI.adsrDrag.dragging = true;
      this.synthUI.adsrDrag.node = name;
      return true;
    }
  }

  // 检查是否点击底部的ADSR参数标签
  const labelY = envY + envH + 15; // 从20减小到15，与绘制部分一致
  const labelHeight2 = 35; // 从30增加到35，与绘制时一致

  // 参数标签坐标
  const labelX1 = envX + envW * 0.125; // Attack 标签位置
  const labelX2 = envX + envW * 0.375; // Decay 标签位置
  const labelX3 = envX + envW * 0.625; // Sustain 标签位置
  const labelX4 = envX + envW * 0.875; // Release 标签位置

  // 标签点击区域宽度
  const labelWidth = envW * 0.22; // 增加宽度比例，使其与新的标签宽度匹配

  // 检查是否点击各个参数标签
  if (my >= labelY - 10 && my <= labelY + labelHeight2) {
    // Attack 标签
    if (mx >= labelX1 - labelWidth/2 && mx <= labelX1 + labelWidth/2) {
      this.synthUI.adsrDrag.dragging = true;
      this.synthUI.adsrDrag.node = 'A_label';
      this.synthUI.adsrDrag.startY = my;

      // 根据当前页面保存不同的起始值
      if (isFilterEnv) {
        this.synthUI.adsrDrag.startValue = params.filterAttack;
      } else {
        this.synthUI.adsrDrag.startValue = params.attack;
      }
      return true;
    }

    // Decay 标签
    if (mx >= labelX2 - labelWidth/2 && mx <= labelX2 + labelWidth/2) {
      this.synthUI.adsrDrag.dragging = true;
      this.synthUI.adsrDrag.node = 'D_label';
      this.synthUI.adsrDrag.startY = my;

      // 根据当前页面保存不同的起始值
      if (isFilterEnv) {
        this.synthUI.adsrDrag.startValue = params.filterDecay;
      } else {
        this.synthUI.adsrDrag.startValue = params.decay;
      }
      return true;
    }

    // Sustain 标签
    if (mx >= labelX3 - labelWidth/2 && mx <= labelX3 + labelWidth/2) {
      this.synthUI.adsrDrag.dragging = true;
      this.synthUI.adsrDrag.node = 'S_label';
      this.synthUI.adsrDrag.startY = my;

      // 根据当前页面保存不同的起始值
      if (isFilterEnv) {
        this.synthUI.adsrDrag.startValue = params.filterSustain;
      } else {
        this.synthUI.adsrDrag.startValue = params.sustain;
      }
      return true;
    }

    // Release 标签
    if (mx >= labelX4 - labelWidth/2 && mx <= labelX4 + labelWidth/2) {
      this.synthUI.adsrDrag.dragging = true;
      this.synthUI.adsrDrag.node = 'R_label';
      this.synthUI.adsrDrag.startY = my;

      // 根据当前页面保存不同的起始值
      if (isFilterEnv) {
        this.synthUI.adsrDrag.startValue = params.filterRelease;
      } else {
        this.synthUI.adsrDrag.startValue = params.release;
      }
      return true;
    }
  }

  // 检查是否点击了包络线段
  // 这将使得用户不仅可以点击节点，还可以直接点击线段进行拖动
  if (mx >= envX && mx <= envX + envW && my >= envY && my <= envY + envH) {
    // A段 - 直线
    if (this.ptLine(mx, my, envX, y0, ptA.x, ptA.y, 10)) {
      this.synthUI.adsrDrag.dragging = true;
      this.synthUI.adsrDrag.node = 'A';
      return true;
    }
    // A-D段
    else if (this.ptLine(mx, my, ptA.x, ptA.y, ptD.x, ptD.y, 10)) {
      this.synthUI.adsrDrag.dragging = true;
      this.synthUI.adsrDrag.node = 'D';
      return true;
    }
    // D-S段
    else if (this.ptLine(mx, my, ptD.x, ptD.y, ptS.x, ptS.y, 10)) {
      this.synthUI.adsrDrag.dragging = true;
      this.synthUI.adsrDrag.node = 'S';
      return true;
    }
    // S-R段
    else if (this.ptLine(mx, my, ptS.x, ptS.y, ptR.x, ptR.y, 10)) {
      this.synthUI.adsrDrag.dragging = true;
      this.synthUI.adsrDrag.node = 'R';
      return true;
    }
  }

  // 新增：检查是否点击滤波器控件
  const handled = this.handleFilterControlsPressed(mx, my);
  if (handled) {
    return true;
  }

  // 新增：处理delay反馈滑块拖动
  if (this.synthUI.delay.hovering === 'feedback') {
    // 获取当前选中的插槽
    const currentSlot = this.synthUI.currentSlot;

    // 保存拖动起点
    this.synthUI.delay.dragStart = {
      x: mx,
      y: my,
      value: this.synthUI.delay.feedback[currentSlot]
    };

    return true;
  }

  // 新增：处理reverb控制点击和拖动
  if (this.synthUI.reverb.hovering) {
    const currentSlot = this.synthUI.currentSlot;

    if (this.synthUI.reverb.hovering === 'toggle') {
      // 切换开关状态
      this.synthUI.reverb.enabled[currentSlot] = !this.synthUI.reverb.enabled[currentSlot];

      // 更新reverb效果
      if (this.reverbEffects && this.reverbEffects[currentSlot] && this.audioInitialized) {
        this.reverbEffects[currentSlot].wet.value = this.synthUI.reverb.enabled[currentSlot] ?
          this.synthParams[currentSlot].reverbWet : 0;
      }

      // 同步混响开关状态到SynthPresetManager
      if (window.synthPresetManager) {
        window.synthPresetManager.setReverbEnabled(currentSlot, this.synthUI.reverb.enabled[currentSlot]);

      }

      return true;
    } else if (this.synthUI.reverb.hovering === 'decay') {
      // 保存拖动起点
      this.synthUI.reverb.dragStart = {
        x: mx,
        y: my,
        value: this.synthUI.reverb.decay[currentSlot]
      };

      return true;
    } else if (this.synthUI.reverb.hovering === 'wet') {
      // 保存拖动起点
      this.synthUI.reverb.dragStart = {
        x: mx,
        y: my,
        value: this.synthUI.reverb.wet[currentSlot]
      };

      return true;
    }
  }

  return false;
}

export function handleFilterControlsPressed(mx, my) {
  // 设置全局拖拽标志，防止在拖拽过程中触发同步
  window.isDraggingInOverview = true;

  const currentSlot = this.synthUI.currentSlot;
  const params = this.synthParams[currentSlot];

  // 计算滤波器UI的位置
  const buttonWidth = 30;
  const spacing = 5;
  const totalWidth = 8 * buttonWidth + 7 * spacing;
  const waveformStartX = ui.centerX - totalWidth / 2;
  const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
  const waveformHeight = 25;
  const waveToEnvGap = 45;

  // 包络线区域
  const envX = waveformStartX;
  const envY = waveformStartY + waveformHeight + waveToEnvGap;
  const envW = totalWidth;
  const envH = 90;

  // 滤波器UI放置在ADSR参数标签下方
  const filterY = envY + envH + 60;
  const filterX = envX;
  const filterW = envW;
  const filterH = 120;

  // 检查是否在滤波器UI区域内
  if (mx < filterX - 10 || mx > filterX + filterW + 10 ||
      my < filterY - 10 || my > filterY + filterH + 10) {
    return false; // 不在滤波器UI区域内
  }

  // 控制区域占总宽度的25%
  const controlsWidth = filterW * 0.25;

  // 检查左侧面板 - 基本控制
  if (mx >= filterX && mx <= filterX + controlsWidth) {
    const width = controlsWidth;
    const height = filterH - 20;
    const y = filterY + 10;
    const x = filterX;

    // 平均分配四个区域的高度，与drawFilterBasicControls中保持一致
    const margin = 5; // 控件之间的边距
    const usableHeight = height - margin * 3; // 减去所有边距后的可用高度
    const sectionHeight = usableHeight / 4; // 每个控件的高度

    // 初始位置 - 均匀分布
    const freqY = y + sectionHeight * 0.5 + margin * 0;
    const resY = y + sectionHeight * 1.5 + margin * 1;
    const typeY = y + sectionHeight * 2.5 + margin * 2;
    const envY = y + sectionHeight * 3.5 + margin * 3;

    // 控件尺寸
    const controlWidth = width * 0.8;
    const controlX = x + width/2;
    const labelWidth = 70;

    // 高亮时标签更大，非高亮时更小
    const freqHeight = 32; // 点击区域统一使用较大尺寸以便于点击
    const resHeight = 32;
    const typeHeight = 32;
    const envHeight = 32;

    // 检查FREQ标签区域
    if (mx >= controlX - labelWidth/2 && mx <= controlX + labelWidth/2 &&
        my >= freqY - freqHeight/2 && my <= freqY + freqHeight/2) {
      this.synthUI.filter.dragging.active = true;
      this.synthUI.filter.dragging.control = "freq";
      this.synthUI.filter.dragging.startX = mx;
      this.synthUI.filter.dragging.startY = my;
      this.synthUI.filter.dragging.startValue = params.filterFreq;
      return true;
    }

    // 检查RES标签区域
    if (mx >= controlX - labelWidth/2 && mx <= controlX + labelWidth/2 &&
        my >= resY - resHeight/2 && my <= resY + resHeight/2) {
      this.synthUI.filter.dragging.active = true;
      this.synthUI.filter.dragging.control = "res";
      this.synthUI.filter.dragging.startX = mx;
      this.synthUI.filter.dragging.startY = my;
      this.synthUI.filter.dragging.startValue = params.filterQ;
      return true;
    }

    // 检查TYPE标签区域
    if (mx >= controlX - labelWidth/2 && mx <= controlX + labelWidth/2 &&
        my >= typeY - typeHeight/2 && my <= typeY + typeHeight/2) {
      // 切换滤波器类型
      const currentType = params.filterType;
      const filterTypes = this.synthUI.filter.types;

      // 查找当前类型的索引
      const currentIndex = filterTypes.indexOf(currentType);

      // 计算下一个类型的索引
      const nextIndex = (currentIndex + 1) % filterTypes.length;

      // 获取新的滤波器类型
      const newFilterType = filterTypes[nextIndex];

      // 设置类型过渡动画
      this.synthUI.transition.filterActive = true;
      this.synthUI.transition.filterStartTime = Date.now();

      // 保存当前的滤波器参数作为起始值
      this.synthUI.transition.filterStartParams = {
        filterFreq: params.filterFreq,
        filterQ: params.filterQ,
        filterType: currentType
      };

      // 保存目标滤波器参数
      this.synthUI.transition.filterEndParams = {
        filterFreq: params.filterFreq,
        filterQ: params.filterQ,
        filterType: newFilterType
      };

      // 创建当前参数的副本用于动画
      this.synthUI.transition.filterCurrentParams = { ...this.synthUI.transition.filterStartParams };

      // 设置新的滤波器类型
      params.filterType = newFilterType;

      // 更新当前插槽的类型选择
      this.synthUI.filter.selectedType[currentSlot] = params.filterType;

      // 如果有合成器，立即更新滤波器类型（懒加载）
      {
        const synth = this.getOrCreateSynth(currentSlot);
        if (synth) {
          synth.filter.type = params.filterType;
        }
      }


      return true;
    }

    // 检查ENV标签区域
    if (mx >= controlX - labelWidth/2 && mx <= controlX + labelWidth/2 &&
        my >= envY - envHeight/2 && my <= envY + envHeight/2) {
      // 循环切换滤波器包络深度值: 0 -> 1 -> 2 -> 4 -> 6 -> 0
      const currentAmount = params.filterEnvAmount;
      const envAmounts = [0, 1, 2, 4, 6];

      // 找到当前值在数组中的索引
      let currentIndex = envAmounts.indexOf(currentAmount);
      if (currentIndex === -1) {
        // 如果当前值不在列表中，找最接近的
        for (let i = 0; i < envAmounts.length; i++) {
          if (envAmounts[i] > currentAmount) {
            currentIndex = i - 1;
            break;
          }
        }
        if (currentIndex === -1) currentIndex = envAmounts.length - 1;
      }

      // 计算下一个值的索引
      const nextIndex = (currentIndex + 1) % envAmounts.length;

      // 设置新的包络深度值
      params.filterEnvAmount = envAmounts[nextIndex];

      // 如果有合成器，立即更新滤波器包络深度（懒加载）
      {
        const synth = this.getOrCreateSynth(currentSlot);
        if (synth) {
          synth.filterEnvelope.octaves = params.filterEnvAmount;
        }
      }


      return true;
    }
  }

  // 检查右侧曲线区域的点击
  const curveWidth = filterW * 0.75;
  const curveX = filterX + controlsWidth + 5;
  const curveY = filterY + 10;
  const curveHeight = filterH - 20;

  if (mx >= curveX && mx <= curveX + curveWidth - 10 &&
      my >= curveY && my <= curveY + curveHeight) {
    // 激活拖拽模式
    this.synthUI.filter.dragging.active = true;
    this.synthUI.filter.dragging.control = "curve";
    this.synthUI.filter.dragging.startX = mx;
    this.synthUI.filter.dragging.startY = my;
    // 保存初始频率值
    this.synthUI.filter.dragging.startValue = params.filterFreq;
    // 保存初始共振值，用于垂直拖动调整
    this.synthUI.filter.dragging.startQValue = params.filterQ;
    return true;
  }

  return false;
}

export function handleSynthMouseDragged(mx, my) {
  // 设置全局拖拽标志，防止在拖拽过程中触发同步
  window.isDraggingInOverview = true;
  window.isSynthDragging = true; // 添加合成器专用的拖拽标记

  // 检查是否正在拖动reverb滑块，这个条件应该放在最前面优先检查
  if (this.synthUI.reverb.dragStart) {
    // 获取当前选中的插槽
    const currentSlot = this.synthUI.currentSlot;

    // 计算水平拖动距离
    const deltaX = mx - this.synthUI.reverb.dragStart.x;

    if (this.synthUI.reverb.hovering === 'decay') {
      // decay滑块参数
      const decayWidth = 60; // 滑块宽度

      // 计算新的衰减时间值（0.1-10秒范围内）
      const dragScale = 9.9 / decayWidth; // 将拖动距离映射到0.1-10秒范围
      let newValue = this.synthUI.reverb.dragStart.value + deltaX * dragScale;
      newValue = Math.max(0.1, Math.min(10, newValue)); // 限制在0.1-10秒范围内

      // 更新reverb衰减时间值
      this.synthUI.reverb.decay[currentSlot] = newValue;
      // 更新合成器参数
      this.synthParams[currentSlot].reverbDecay = newValue;

      // 更新混响效果
      if (this.reverbEffects && this.reverbEffects[currentSlot] && this.audioInitialized) {
        this.reverbEffects[currentSlot].decay = newValue;
        // 重新生成混响冲激响应
        this.reverbEffects[currentSlot].generate();

        // 输出调试信息

      }

      return true;
    } else if (this.synthUI.reverb.hovering === 'wet') {
      // wet滑块参数
      const wetWidth = 60; // 滑块宽度

      // 计算新的湿度值（0-1范围内）
      const dragScale = 1 / wetWidth; // 将拖动距离映射到0-1范围
      let newValue = this.synthUI.reverb.dragStart.value + deltaX * dragScale;
      newValue = Math.max(0, Math.min(1, newValue)); // 限制在0-1范围内

      // 更新reverb湿度值
      this.synthUI.reverb.wet[currentSlot] = newValue;
      // 更新合成器参数
      this.synthParams[currentSlot].reverbWet = newValue;

      // 更新混响效果
      if (this.reverbEffects && this.reverbEffects[currentSlot] && this.audioInitialized) {
        this.reverbEffects[currentSlot].wet.value = newValue;

        // 输出调试信息

      }

      return true;
    }
  }

  // 检查是否正在拖动delay反馈滑块，这个条件应该放在最前面优先检查
  if (this.synthUI.delay.dragStart) {
    // 获取当前选中的插槽
    const currentSlot = this.synthUI.currentSlot;

    // 计算水平拖动距离
    const deltaX = mx - this.synthUI.delay.dragStart.x;

    // 反馈滑块参数
    const fbWidth = 80; // 反馈滑块宽度，与绘制时保持一致

    // 计算新的反馈值（0-1范围内）
    const dragScale = 1 / fbWidth; // 将拖动距离映射到0-1范围
    let newValue = this.synthUI.delay.dragStart.value + deltaX * dragScale;
    newValue = Math.max(0, Math.min(0.9, newValue)); // 限制在0-0.9范围内

    // 更新delay反馈值
    this.synthUI.delay.feedback[currentSlot] = newValue;

    // 更新delay效果
    if (this.delayEffects && this.delayEffects[currentSlot]) {
      this.delayEffects[currentSlot].feedback.value = newValue;

        // 输出调试信息

      }

      return true;
  }

  // 检查其他拖动操作的条件
  if (!this.synthUI.visible) return false;

  if (this.synthUI.filter.dragging.active) {
    return this.handleFilterControlsDragged(mx, my);
  }

  if (!this.synthUI.adsrDrag.dragging) return false;

  // 以下是ADSR拖拽处理
  const currentSlot = this.synthUI.currentSlot;
  const params = this.synthParams[currentSlot];

  // 获取波形选择器位置信息，以便定位包络编辑器
  const buttonWidth = 30;
  const spacing = 5;
  const totalWidth = 8 * buttonWidth + 7 * spacing;
  const waveformStartX = ui.centerX - totalWidth / 2;
  const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
  const waveformHeight = 25; // 波形选择器高度改为25

  // 更新间距与drawSynthParameters保持一致
  const waveToEnvGap = 45; // 增加从30到45的间距

  // 包络线区域
  const envX = waveformStartX;
  const envY = waveformStartY + waveformHeight + waveToEnvGap;
  const envW = totalWidth;
  const envH = 90; // 保持不变

  // 最大时间
  const maxTimeWidth = 7; // 秒

  // Y轴计算
  const y0 = envY + envH;
  const yMax = envY + 10; // 最高点（增加10px边距，避免节点超出框体）

  // 确定当前正在编辑的是哪种包络
  const isFilterEnv = this.synthUI.envelopePage === 1;

  // 拖拽逻辑 - 包络线上的节点
  if (this.synthUI.adsrDrag.node === 'A') {
    // 只能水平拖动A
    let t = ((mx - envX) / envW) * maxTimeWidth;
    t = constrain(t, 0.001, 2.0);

    // 根据当前页面更新不同的参数
    if (isFilterEnv) {
      params.filterAttack = t;
    } else {
      params.attack = t;
    }

  } else if (this.synthUI.adsrDrag.node === 'D') {
    // D节点可以水平和垂直拖动
    // 水平方向控制Decay时间
    let tA;
    if (isFilterEnv) {
      tA = params.filterAttack;
    } else {
      tA = params.attack;
    }

    let t = ((mx - envX) / envW) * maxTimeWidth - tA;
    t = constrain(t, 0.01, 2.0);

    // 垂直方向控制Sustain电平
    // 限制鼠标Y位置不能小于yMax（确保不超出编辑器顶部）
    let effectiveY = Math.max(my, yMax);
    let s = 1 - (effectiveY - yMax) / (y0 - yMax);
    s = constrain(s, 0.001, 1.0);

    // 根据当前页面更新不同的参数
    if (isFilterEnv) {
      params.filterDecay = t;
      params.filterSustain = s;
    } else {
      params.decay = t;
      params.sustain = s;
    }

  } else if (this.synthUI.adsrDrag.node === 'S') {
    // S只能垂直拖动
    // 限制鼠标Y位置不能小于yMax（确保不超出编辑器顶部）
    let effectiveY = Math.max(my, yMax);
    let s = 1 - (effectiveY - yMax) / (y0 - yMax);
    s = constrain(s, 0.001, 1.0);

    // 根据当前页面更新不同的参数
    if (isFilterEnv) {
      params.filterSustain = s;
    } else {
      params.sustain = s;
    }

  } else if (this.synthUI.adsrDrag.node === 'R') {
    // R只能水平拖动
    let tA, tD, tS;
    if (isFilterEnv) {
      tA = params.filterAttack;
      tD = tA + params.filterDecay;
    } else {
      tA = params.attack;
      tD = tA + params.decay;
    }
    tS = tD + 1; // S段固定1秒

    let t = ((mx - envX) / envW) * maxTimeWidth - tS;
    t = constrain(t, 0.01, 2.0);

    // 根据当前页面更新不同的参数
    if (isFilterEnv) {
      params.filterRelease = t;
    } else {
      params.release = t;
    }
  }
  // 拖拽逻辑 - 底部参数标签
  else if (this.synthUI.adsrDrag.node === 'A_label') {
    // 上下拖动调整Attack (现在向上增大，向下减小)
    const deltaY = this.synthUI.adsrDrag.startY - my;
    // 将拖动距离映射为参数变化，向上拖动增大值，向下拖动减小值
    // 每像素变化约0.01秒，但缩放系数可以调整
    const scale = 0.01;
    const newValue = this.synthUI.adsrDrag.startValue + deltaY * scale; // 改变符号，使向上拖动增大

    // 根据当前页面更新不同的参数
    if (isFilterEnv) {
      params.filterAttack = constrain(newValue, 0.001, 2.0);
    } else {
      params.attack = constrain(newValue, 0.001, 2.0);
    }
  }
  else if (this.synthUI.adsrDrag.node === 'D_label') {
    // 上下拖动调整Decay
    const deltaY = this.synthUI.adsrDrag.startY - my;
    const scale = 0.01;
    const newValue = this.synthUI.adsrDrag.startValue + deltaY * scale; // 改变符号，使向上拖动增大

    // 根据当前页面更新不同的参数
    if (isFilterEnv) {
      params.filterDecay = constrain(newValue, 0.01, 2.0);
    } else {
      params.decay = constrain(newValue, 0.01, 2.0);
    }
  }
  else if (this.synthUI.adsrDrag.node === 'S_label') {
    // 上下拖动调整Sustain (0-1范围值)
    const deltaY = this.synthUI.adsrDrag.startY - my;
    // 每像素变化0.005，向上增大
    const scale = 0.005;
    const newValue = this.synthUI.adsrDrag.startValue + deltaY * scale; // 改变符号，使向上拖动增大

    // 根据当前页面更新不同的参数
    if (isFilterEnv) {
      params.filterSustain = constrain(newValue, 0.001, 1.0);
    } else {
      params.sustain = constrain(newValue, 0.001, 1.0);
    }
  }
  else if (this.synthUI.adsrDrag.node === 'R_label') {
    // 上下拖动调整Release
    const deltaY = this.synthUI.adsrDrag.startY - my;
    const scale = 0.01;
    const newValue = this.synthUI.adsrDrag.startValue + deltaY * scale; // 改变符号，使向上拖动增大

    // 根据当前页面更新不同的参数
    if (isFilterEnv) {
      params.filterRelease = constrain(newValue, 0.01, 2.0);
    } else {
      params.release = constrain(newValue, 0.01, 2.0);
    }
  }

  // 更新SynthPresetManager中的参数
  if (window.synthPresetManager) {
    if (isFilterEnv) {
      // 更新滤波器包络参数
      window.synthPresetManager.presetFilterParams[currentSlot].envAmount = params.filterEnvAmount;

      // 滤波器包络参数需要单独存储
      const filterEnvParams = {
        filterAttack: params.filterAttack,
        filterDecay: params.filterDecay,
        filterSustain: params.filterSustain,
        filterRelease: params.filterRelease
      };

      // 将滤波器包络参数添加到包络参数中
      Object.assign(window.synthPresetManager.presetEnvelopeParams[currentSlot], filterEnvParams);
    } else {
      // 更新放大器包络
      window.synthPresetManager.setEnvelopeParams(currentSlot, {
        attack: params.attack,
        decay: params.decay,
        sustain: params.sustain,
        release: params.release
      });
    }
  }

  // 实时同步到合成器（懒加载）
  {
    const synth = this.getOrCreateSynth(currentSlot);
    if (synth) {
      // 创建要更新的参数对象
      const updateParams = {};

      // 根据当前页面添加不同的参数
      if (isFilterEnv) {
        // 更新滤波器包络
        updateParams.filterEnvelope = {
          attack: params.filterAttack,
          decay: params.filterDecay,
          sustain: params.filterSustain,
          release: params.filterRelease,
          baseFrequency: params.filterFreq,
          octaves: params.filterEnvAmount  // 添加包络深度参数更新
        };
      } else {
        // 更新放大器包络
        updateParams.envelope = {
          attack: params.attack,
          decay: params.decay,
          sustain: params.sustain,
          release: params.release
        };
      }

      // 设置合成器参数
      synth.set(updateParams);
    }
  }

  return true;
}

export function handleFilterControlsDragged(mx, my) {
  // 设置全局拖拽标志，防止在拖拽过程中触发同步
  window.isDraggingInOverview = true;

  const currentSlot = this.synthUI.currentSlot;
  const params = this.synthParams[currentSlot];

  // 获取当前拖动控件类型
  const control = this.synthUI.filter.dragging.control;

  if (control === "freq") {
    // 频率标签拖动处理
    // 使用垂直拖动来调整频率值
    const deltaY = this.synthUI.filter.dragging.startY - my;

    // 将垂直距离映射到对数刻度的频率变化
    // 频率范围: 20Hz - 20kHz
    const startFreq = this.synthUI.filter.dragging.startValue;

    // 使用对数映射使调整更自然
    // 上移增加，下移减少
    // 每100像素增加/减少1个八度
    const octaveChange = deltaY / 100;
    const newFreq = startFreq * Math.pow(2, octaveChange);

    // 限制在有效范围内
    params.filterFreq = constrain(newFreq, this.synthUI.filter.freqRangeMin, this.synthUI.filter.freqRangeMax);

  } else if (control === "res") {
    // 共振标签拖动处理
    // 使用垂直拖动来调整共振值
    const deltaY = this.synthUI.filter.dragging.startY - my;

    // 将垂直距离映射到共振范围
    // 共振范围: 0.1 - 20
    const startQ = this.synthUI.filter.dragging.startValue;

    // 使用非线性映射使调整更自然
    // 较小值区域需要细微调整，较大值区域可以大幅度调整
    // 缩放比例: 小值区域较小，大值区域较大
    // 注意：scale值为正，使向上拖动增大Q值
    let scale = 0.02;
    if (startQ > 5) scale = 0.1;
    else if (startQ > 1) scale = 0.05;

    // 确保向上拖动增大Q值，向下拖动减小Q值
    // deltaY为正表示向上拖动，为负表示向下拖动
    const newQ = startQ + deltaY * scale;

    // 限制共振在合理范围内
    params.filterQ = constrain(newQ, 0.1, 20);
  } else if (control === "curve") {
    // 曲线区域拖拽处理 - 计算UI位置与handleFilterControlsPressed中保持一致
    const buttonWidth = 30;
    const spacing = 5;
    const totalWidth = 8 * buttonWidth + 7 * spacing;
    const waveformStartX = ui.centerX - totalWidth / 2;
    const waveformStartY = ui.centerY - ui.panelHeight/2 + 100;
    const waveformHeight = 25;
    const waveToEnvGap = 45;

    // 包络线区域
    const envX = waveformStartX;
    const envY = waveformStartY + waveformHeight + waveToEnvGap;
    const envW = totalWidth;
    const envH = 90;

    // 滤波器UI放置在ADSR参数标签下方
    const filterY = envY + envH + 60;
    const filterX = envX;
    const filterW = envW;
    const filterH = 120;

    // 控制区域占总宽度的25%
    const controlsWidth = filterW * 0.25;

    // 曲线区域
    const curveWidth = filterW * 0.75;
    const curveX = filterX + controlsWidth + 5;
    const curveY = filterY + 10; // 曲线区域Y起点
    const curveHeight = filterH - 20; // 曲线区域高度

    // 水平拖动调整频率
    // 限制mx在曲线区域内
    const effectiveX = constrain(mx, curveX, curveX + curveWidth - 10);
    const normX = (effectiveX - curveX) / (curveWidth - 10);

    // 使用对数映射转换为频率
    const newFreq = Math.pow(10,
      Math.log10(this.synthUI.filter.freqRangeMin) +
      normX * (Math.log10(this.synthUI.filter.freqRangeMax) - Math.log10(this.synthUI.filter.freqRangeMin))
    );

    // 更新频率参数
    params.filterFreq = constrain(newFreq, this.synthUI.filter.freqRangeMin, this.synthUI.filter.freqRangeMax);

    // 修改：垂直拖动调整共振（RES）值
    // 上下拖动小球而非曲线

    // 限制my在曲线区域内
    const effectiveY = constrain(my, curveY, curveY + curveHeight);

    // 计算相对于曲线中点的位置
    // 在中心位置时保持初始Q值，向上拖动增加Q值，向下拖动减小Q值
    // 使小球能从中心位置上下移动
    const centerY = curveY + curveHeight/2;
    const distanceFromCenter = centerY - effectiveY; // 正值表示在中心上方，负值表示在中心下方

    // 获取初始共振值
    const startQ = this.synthUI.filter.dragging.startQValue || 1.0;

    // 垂直位置映射为Q值的指数变化
    // 使用非线性映射，要比原来的更加敏感，让小球能跟随鼠标移动
    const scaleFactor = 0.05; // 增加敏感度
    let newQ;

    if (distanceFromCenter > 0) {
      // 向上拖动，增加Q值（指数增长）
      newQ = startQ * Math.exp(distanceFromCenter * scaleFactor);
    } else {
      // 向下拖动，减小Q值（指数衰减）
      newQ = startQ * Math.exp(distanceFromCenter * scaleFactor);
    }

    // 限制共振在合理范围内
    params.filterQ = constrain(newQ, 0.1, 20);
  }

  // 实时更新合成器参数（懒加载）
  {
    const synth = this.getOrCreateSynth(currentSlot);
    if (synth) {
      // 创建更新对象
      const updateParams = {
        filter: {
          frequency: params.filterFreq,
          Q: params.filterQ
        }
      };

      // 同时更新滤波器包络的基础频率，确保频率控制正常工作
      if (synth.filterEnvelope) {
        updateParams.filterEnvelope = {
          baseFrequency: params.filterFreq
        };
      }

      // 立即应用更新
      synth.set(updateParams);
    }
  }

  return true;
}

export function handleSynthMouseReleased() {
  const currentSlot = this.synthUI.currentSlot;
  const params = this.synthParams[currentSlot];

  // 在鼠标释放前，标记此时还在拖拽过程中，防止过早同步
  window.isDraggingInOverview = true;

  // 获取当前拖拽状态，如果不是在拖拽状态，直接返回
  const wasDragging = window.isSynthDragging === true;

  try {
    // 重置ADSR拖拽状态
    if (this.synthUI.adsrDrag.dragging) {
      // 在释放鼠标时更新SynthPresetManager
      if (window.synthPresetManager) {
        // 检查是哪个页面的ADSR参数
        if (this.synthUI.envelopePage === 0) {
          // 放大器包络
          window.synthPresetManager.setEnvelopeParams(currentSlot, {
            attack: params.attack,
            decay: params.decay,
            sustain: params.sustain,
            release: params.release
          });
        } else {
          // 滤波器包络 - 将参数添加到包络参数中
          const filterEnvParams = {
            filterAttack: params.filterAttack,
            filterDecay: params.filterDecay,
            filterSustain: params.filterSustain,
            filterRelease: params.filterRelease
          };
          Object.assign(window.synthPresetManager.presetEnvelopeParams[currentSlot], filterEnvParams);

          // 为滤波器包络参数添加触发事件
          if (window.synthPresetManager.dispatchSynthParamsChanged) {
            window.synthPresetManager.dispatchSynthParamsChanged(currentSlot, {
              filter: window.synthPresetManager.presetFilterParams[currentSlot],
              envelope: window.synthPresetManager.presetEnvelopeParams[currentSlot]
            });
          }
        }
      }

      this.synthUI.adsrDrag.dragging = false;
      this.synthUI.adsrDrag.node = null;
    }

    // 重置滤波器拖拽状态
    if (this.synthUI.filter.dragging.active) {
      // 在释放鼠标时更新SynthPresetManager
      if (window.synthPresetManager) {
        window.synthPresetManager.setFilterParams(currentSlot, {
          type: params.filterType,
          frequency: params.filterFreq,
          Q: params.filterQ,
          envAmount: params.filterEnvAmount
        });
      }

      this.synthUI.filter.dragging.active = false;
      this.synthUI.filter.dragging.control = null;
    }

    // 重置delay反馈滑块拖动状态
    if (this.synthUI.delay.dragStart) {
      // 获取当前选中的插槽和最终设置的值
      const finalValue = this.synthUI.delay.feedback[currentSlot];

      // 更新SynthPresetManager中的delay参数
      if (window.synthPresetManager) {
        window.synthPresetManager.setDelayParams(currentSlot, {
          time: params.delayTime,
          feedback: finalValue,
          mix: params.delayWet
        });
      }

      // 记录日志确认最终值
      if (this.delayEffects && this.delayEffects[currentSlot]) {

      }

      // 清除拖动状态
      this.synthUI.delay.dragStart = null;
    }

    // 重置reverb拖动状态
    if (this.synthUI.reverb.dragStart) {
      // 获取最终设置的值
      const finalDecayValue = this.synthUI.reverb.decay[currentSlot];
      const finalWetValue = this.synthUI.reverb.wet[currentSlot];

      // 更新SynthPresetManager中的reverb参数
      if (window.synthPresetManager) {
        window.synthPresetManager.setReverbParams(currentSlot, {
          decay: finalDecayValue,
          preDelay: 0.01, // 固定值
          mix: finalWetValue
        });
      }

      // 记录日志确认最终值
      if (this.reverbEffects && this.reverbEffects[currentSlot]) {


      }

      // 清除拖动状态
      this.synthUI.reverb.dragStart = null;
    }

    // 重置portamento拖动状态
    if (this.synthUI.portamento.dragStart) {
      // 获取最终设置的值
      const finalTimeValue = this.synthUI.portamento.time[currentSlot];

      // 更新SynthPresetManager中的portamento参数
      if (window.synthPresetManager) {
        window.synthPresetManager.setPortamentoTime(currentSlot, finalTimeValue);
      }

      // 记录日志确认最终值


      // 清除拖动状态
      this.synthUI.portamento.dragStart = null;
    }

    // 只有在实际进行了拖拽操作后，才触发参数同步
    if (wasDragging && window.synthPresetManager && window.synthPresetManager.dispatchSynthParamsChanged) {
      // 延迟一帧再触发同步
      setTimeout(() => {
        // 确保是在当前插槽控制范围内才触发同步
        if (window.presetManager && window.presetManager.canEditSlot &&
            window.presetManager.canEditSlot(currentSlot)) {
          // 全局综合触发一次参数变化事件，包含所有参数
          // 同时确保isSynthDragging已经重置为false
          window.isSynthDragging = false;

          // 执行同步操作
          window.synthPresetManager.dispatchSynthParamsChanged(currentSlot);
          console.log(`合成器参数已同步到服务器，插槽: ${currentSlot + 1}`);

          // 如果还有更直接的同步函数，也调用它
          if (window.syncAllSynthParamsToServer && typeof window.syncAllSynthParamsToServer === 'function') {
            window.syncAllSynthParamsToServer();
          }

          // 触发全量合成器参数变化事件
          window.dispatchEvent(new CustomEvent('synth-all-params-changed', {
            detail: { slotIndex: currentSlot }
          }));
        }
      }, 10);
    }
  } finally {
    // 重置合成器拖拽状态
    window.isSynthDragging = false;

    // 无论如何，确保在操作完成后重置拖拽标志
    setTimeout(() => {
      window.isDraggingInOverview = false;

    }, 50); // 给一点缓冲时间确保参数同步完成
  }
}
