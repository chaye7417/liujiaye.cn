/**
 * PresetPatterns.js - 用于管理节奏圆环的预设模式
 * 包含预设数据存储、加载、保存和权限控制功能
 */

// 预设插槽的固定颜色，对应3D小球的不同颜色
const presetSlotColors = [
  '#FF5252', // 预设1 - 红色
  '#FF9800', // 预设2 - 橙色
  '#FFEB3B', // 预设3 - 黄色
  '#4CAF50', // 预设4 - 绿色
  '#2196F3', // 预设5 - 蓝色
  '#673AB7', // 预设6 - 紫色
  '#E91E63', // 预设7 - 粉色
  '#00BCD4'  // 预设8 - 青色
];

// 定义8组预设节奏模式，每组可以存储不同的节点
// 修改数据结构，使每个插槽存储多个变体（乐段）
let presetPatterns = [
  { variants: [[]], currentVariant: 0 }, // 预设1
  { variants: [[]], currentVariant: 0 }, // 预设2
  { variants: [[]], currentVariant: 0 }, // 预设3
  { variants: [[]], currentVariant: 0 }, // 预设4
  { variants: [[]], currentVariant: 0 }, // 预设5
  { variants: [[]], currentVariant: 0 }, // 预设6
  { variants: [[]], currentVariant: 0 }, // 预设7
  { variants: [[]], currentVariant: 0 }  // 预设8
];

// 设置每个插槽支持的最大变体数量
const MAX_VARIANTS_PER_SLOT = 8;

// 用于存储当前活动的节点数据
let activeNodes = [];

// 插槽控制权限管理系统的变量
let controlledSlotIndex = -1; // -1表示观看模式，0-7表示控制的插槽索引
let isViewOnlyMode = true;    // 默认为观看模式
let slotOwners = {};          // 存储各个插槽的所有者ID
let myUserId = null;          // 当前用户的唯一ID

// 创建预设模式对象
window.presetManager = {
  patterns: presetPatterns,
  slotColors: presetSlotColors,
  controlledSlotIndex: controlledSlotIndex,
  isViewOnlyMode: isViewOnlyMode,
  slotOwners: slotOwners,
  myUserId: myUserId,
  activeNodes: activeNodes,  // 添加activeNodes属性
  maxVariantsPerSlot: MAX_VARIANTS_PER_SLOT, // 添加最大变体数量
  
  // 初始化预设管理器
  init: function(userId) {
    this.myUserId = userId;
    window.presetPatterns = this.patterns; // 兼容原有代码
    
    // 将预设颜色添加到全局对象，便于其他模块访问
    window.presetSlotColors = this.slotColors;
    
    // 设置activeNodes的全局引用
    window.nodes = this.activeNodes;
    
    return this;
  },
  
  // 获取当前活动节点
  getActiveNodes: function() {
    return this.activeNodes;
  },
  
  // 设置当前活动节点
  setActiveNodes: function(nodes) {
    this.activeNodes = nodes;
    // 同时更新全局引用
    window.nodes = this.activeNodes;
    return this.activeNodes;
  },
  
  // 添加节奏模式
  addRhythmPattern: function(pattern) {
    // 检查是否提供了索引
    const nodeIndex = pattern.index !== undefined ? pattern.index : this.activeNodes.length;
    
    // 如果没有提供alpha数组或不是数组，创建一个新的
    if (!pattern.alpha || !Array.isArray(pattern.alpha)) {
      pattern.alpha = new Array(32).fill(0.1);
    }
    
    // 确保节点至少有32个步骤的alpha值
    if (pattern.alpha.length < 32) {
      // 扩展数组
      const currentLength = pattern.alpha.length;
      for (let i = currentLength; i < 32; i++) {
        pattern.alpha.push(0.1);
      }
    }
    
    // 如果没有提供音高偏移数组，创建一个新的全零数组
    if (!pattern.pitchOffset || !Array.isArray(pattern.pitchOffset)) {
      pattern.pitchOffset = new Array(32).fill(0);
    }
    
    // 确保音高偏移数组至少有32个步骤
    if (pattern.pitchOffset.length < 32) {
      const currentLength = pattern.pitchOffset.length;
      for (let i = currentLength; i < 32; i++) {
        pattern.pitchOffset.push(0);
      }
    }
    
    // 如果没有提供持续时间数组，创建一个新的默认值为1.0的数组
    if (!pattern.duration || !Array.isArray(pattern.duration)) {
      pattern.duration = new Array(32).fill(1.0);
    }
    
    // 确保持续时间数组至少有32个步骤
    if (pattern.duration.length < 32) {
      const currentLength = pattern.duration.length;
      for (let i = currentLength; i < 32; i++) {
        pattern.duration.push(1.0);
      }
    }
    
    // 如果没有提供mergedTo数组，创建一个新的全-1数组（-1表示未被合并）
    if (!pattern.mergedTo || !Array.isArray(pattern.mergedTo)) {
      pattern.mergedTo = new Array(32).fill(-1);
    }
    
    // 确保mergedTo数组至少有32个步骤
    if (pattern.mergedTo.length < 32) {
      const currentLength = pattern.mergedTo.length;
      for (let i = currentLength; i < 32; i++) {
        pattern.mergedTo.push(-1);
      }
    }
    
    // 设置节点颜色
    const nodeColor = pattern.color || this.getSlotColor(window.ui ? window.ui.currentPattern : 0);
    
    // 创建beatColor
    let c;
    if (typeof color === 'function') {
      c = color(nodeColor);
    } else {
      // 提供一个模拟color函数的替代方案
      const hexToRgb = (hex) => {
        hex = hex.replace(/^#/, '');
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return {r, g, b};
      };
      
      const rgb = hexToRgb(nodeColor);
      c = { levels: [rgb.r, rgb.g, rgb.b, 255] };
    }
    
    let beatColor = [c.levels[0], c.levels[1], c.levels[2], 0];
    let maxPipe = Math.max(...beatColor.slice(0, 3));
    let lamda = 255 / maxPipe;
    
    for (let i = 0; i < 3; ++i) {
      if (c.levels[i] === maxPipe) {
        beatColor[i] = 255;
      } else {
        beatColor[i] = Math.floor(beatColor[i] * lamda);
      }
    }
    beatColor[3] = 255;
    
    // 创建节点对象
    const node = {
      name: `Track ${nodeIndex + 1}`,
      alpha: pattern.alpha,
      rhythms: pattern.alpha,
      rhythmsF: pattern.alpha,
      color: nodeColor,
      beatColor: beatColor,
      page: 0,
      pitchOffset: pattern.pitchOffset, // 音高偏移数组
      duration: pattern.duration,       // 持续时间数组
      mergedTo: pattern.mergedTo        // 合并标记数组
    };
    
    // 将节点添加到节点数组
    if (nodeIndex >= this.activeNodes.length) {
      this.activeNodes.push(node);
    } else {
      this.activeNodes[nodeIndex] = node;
    }
    
    // 更新全局引用
    window.nodes = this.activeNodes;
    
    return node;
  },
  
  // 更新节点颜色
  updateNodeColor: function(node, slotIndex) {
    if (!node) return;
    
    // 使用预设插槽的固定颜色
    node.color = this.slotColors[slotIndex];
    
    // 创建beatColor
    let c;
    if (typeof color === 'function') {
      c = color(node.color);
    } else {
      // 提供一个默认值以防color函数不可用
      c = { levels: [255, 0, 0, 255] };
    }
    
    let beatColor = [c.levels[0], c.levels[1], c.levels[2], 0];
    let maxPipe = Math.max(beatColor[0], beatColor[1], beatColor[2]);
    let lamda = 255 / maxPipe;
    
    for (let i = 0; i < 3; ++i) {
      if (c.levels[i] === maxPipe) {
        beatColor[i] = 255;
      } else {
        beatColor[i] = Math.floor(beatColor[i] * lamda);
      }
    }
    beatColor[3] = 255;
    
    node.beatColor = beatColor;
    
    return node;
  },
  
  // 清空所有模式
  clearAllPatterns: function() {
    this.activeNodes = [];
    window.nodes = this.activeNodes;
    
    // 添加一个使用当前预设颜色的空节点
    const currentPattern = window.ui ? window.ui.currentPattern : 0;
    this.addRhythmPattern({
      index: 0,
      alpha: new Array(32).fill(0.1),
      color: this.slotColors[currentPattern]
    });
    
    return this.activeNodes;
  },
  
  // 获取插槽颜色
  getSlotColor: function(slotIndex) {
    if (slotIndex >= 0 && slotIndex < this.slotColors.length) {
      return this.slotColors[slotIndex];
    }
    return this.slotColors[0]; // 默认返回第一个颜色
  },
  
  // 获取当前变体索引
  getCurrentVariantIndex: function(slotIndex) {
    if (slotIndex >= 0 && slotIndex < this.patterns.length) {
      return this.patterns[slotIndex].currentVariant;
    }
    return 0;
  },
  
  // 设置当前变体索引
  setCurrentVariantIndex: function(slotIndex, variantIndex) {
    if (slotIndex >= 0 && slotIndex < this.patterns.length) {
      const maxVariantIndex = this.patterns[slotIndex].variants.length - 1;
      
      // 确保变体索引在有效范围内
      variantIndex = Math.max(0, Math.min(variantIndex, maxVariantIndex));
      
      // 设置当前变体索引
      this.patterns[slotIndex].currentVariant = variantIndex;
      
      return variantIndex;
    }
    return -1;
  },
  
  // 修改: 加载预设到当前编辑区，增加变体参数
  loadPreset: function(presetIndex, variantIndex = null) {
    // 预设索引范围检查
    if (presetIndex < 0 || presetIndex >= this.patterns.length) {
      console.error(`预设索引${presetIndex}超出范围(0-${this.patterns.length-1})`);
      return this.activeNodes;
    }
    
    // 临时禁用拖拽标志，确保预设加载时不会被阻止同步
    const wasDragging = window.isDraggingInOverview;
    window.isDraggingInOverview = false;
    

    
    // 设置变体索引，如果未提供，使用当前变体
    if (variantIndex === null) {
      // 使用当前设置的变体
      variantIndex = this.patterns[presetIndex].currentVariant || 0;
    } else {
      // 保存新的变体选择
      this.patterns[presetIndex].currentVariant = variantIndex;
    }
    
    // 确保变体索引在有效范围内
    const maxIndex = (this.patterns[presetIndex].variants && this.patterns[presetIndex].variants.length) ? 
                    this.patterns[presetIndex].variants.length - 1 : 0;
    variantIndex = Math.max(0, Math.min(variantIndex, maxIndex));
    
    // 如果没有变体数组，创建一个空的
    if (!this.patterns[presetIndex].variants) {
      this.patterns[presetIndex].variants = [[]];
      variantIndex = 0;
    }
    
    // 如果选定的变体不存在，创建一个空的
    if (!this.patterns[presetIndex].variants[variantIndex]) {
      this.patterns[presetIndex].variants[variantIndex] = [];
    }
    
    // 如果当前预设的变体有数据，则加载
    if (this.patterns[presetIndex].variants[variantIndex] && this.patterns[presetIndex].variants[variantIndex].length > 0) {
      // 深拷贝预设数据到当前节点
      const loadedNodes = JSON.parse(JSON.stringify(this.patterns[presetIndex].variants[variantIndex]));
      
      // 确保节点使用固定颜色
      if (loadedNodes.length > 0) {
        this.updateNodeColor(loadedNodes[0], presetIndex);
      }
      
      // 更新activeNodes
      this.activeNodes = loadedNodes;
      window.nodes = this.activeNodes;
      
      // 更新总览视图中当前插槽的数据
      if (window.circleOverview && typeof window.circleOverview.updateCircleData === 'function') {
        const circleData = {
          nodes: this.activeNodes,
          currentPreset: presetIndex,
          stepCount: window.ui ? window.ui.stepCount : 16
        };
        window.circleOverview.updateCircleData(presetIndex, circleData);
      }
      
      // 延迟恢复原始拖拽状态，确保同步完成
      setTimeout(() => {
        window.isDraggingInOverview = wasDragging;
      }, 100);
      
      return this.activeNodes;
    } else {
      // 如果变体为空，则创建一个节点使用预设固定颜色
      this.activeNodes = [];
      window.nodes = this.activeNodes;
      
      const emptyNode = {
        alpha: new Array(32).fill(0.1),
        rhythms: new Array(32).fill(0.1),
        rhythmsF: new Array(32).fill(0.1),
        color: this.slotColors[presetIndex],
        name: `Track 1`,
        page: 0,
        pitchOffset: new Array(32).fill(0),
        duration: new Array(32).fill(1.0),
        mergedTo: new Array(32).fill(-1)
      };
      
      // 创建beatColor
      this.updateNodeColor(emptyNode, presetIndex);
      
      // 更新activeNodes
      this.activeNodes = [emptyNode];
      window.nodes = this.activeNodes;
      
      // 更新总览视图中当前插槽的数据
      if (window.circleOverview && typeof window.circleOverview.updateCircleData === 'function') {
        const circleData = {
          nodes: this.activeNodes,
          currentPreset: presetIndex,
          stepCount: window.ui ? window.ui.stepCount : 16
        };
        window.circleOverview.updateCircleData(presetIndex, circleData);
      }
      
      // 延迟恢复原始拖拽状态，确保同步完成
      setTimeout(() => {
        window.isDraggingInOverview = wasDragging;
      }, 100);
      
      return this.activeNodes;
    }
  },
  
  // 修改: 保存当前编辑到预设，增加变体参数
  saveCurrentPreset: function(presetIndex, nodes, variantIndex) {
    // 检查当前预设索引是否有效
    if (presetIndex >= 0 && presetIndex < this.patterns.length) {
      // 检查是否有权限保存此预设
      if (!this.canEditSlot(presetIndex)) {
        return false;
      }
      
      // 如果未指定变体索引，使用当前变体
      if (variantIndex === undefined) {
        variantIndex = this.patterns[presetIndex].currentVariant;
      } else {
        // 确保变体索引在有效范围内，或为新变体
        variantIndex = Math.max(0, Math.min(variantIndex, this.patterns[presetIndex].variants.length));
        
        // 如果是新的变体索引，并且不超过最大变体数量
        if (variantIndex === this.patterns[presetIndex].variants.length && variantIndex < this.maxVariantsPerSlot) {
          // 创建新的变体位置
          this.patterns[presetIndex].variants.push([]);
        } else if (variantIndex >= this.patterns[presetIndex].variants.length) {
          // 如果索引超出了范围且不能创建新变体，使用最后一个可用变体
          variantIndex = this.patterns[presetIndex].variants.length - 1;
        }
        
        // 更新当前变体索引
        this.patterns[presetIndex].currentVariant = variantIndex;
      }
      
      // 优先使用传入的nodes，如果没有则使用activeNodes
      const nodesToSave = nodes || this.activeNodes;
      
      // 深拷贝当前节点数据到对应的预设变体
      this.patterns[presetIndex].variants[variantIndex] = JSON.parse(JSON.stringify(nodesToSave));
      
      // 更新全局变量，确保其他模块可以访问
      window.presetPatterns = this.patterns;
      
      // 已保存当前模式到预设
      return true;
    }
    return false;
  },
  
  // 检查是否可以编辑特定插槽
  canEditSlot: function(slotIndex) {
    // 如果未连接到p5party，允许编辑任何插槽
    if (!window.shared) return true;
    
    // 如果已连接但处于离线模式，也允许编辑
    if (this.isViewOnlyMode === false && this.controlledSlotIndex === -1) return true;
    
    // 在线模式下检查用户是否有权限编辑此插槽
    const canEdit = this.controlledSlotIndex === slotIndex && !this.isViewOnlyMode;

    // 更新全局变量以保持一致性
    window.isViewOnlyMode = this.isViewOnlyMode;
    window.controlledSlotIndex = this.controlledSlotIndex;
    
    // 确保slotOwners全局可访问
    if (this.slotOwners) {
      window.slotOwners = {...this.slotOwners};
    }
    
    // 确保myUserId全局可访问
    if (this.myUserId) {
      window.myUserId = this.myUserId;
    }
    
    return canEdit;
  },
  
  // 设置观看模式
  setViewOnlyMode: function() {
    this.isViewOnlyMode = true;
    this.controlledSlotIndex = -1;
    
    // 如果已连接，更新共享状态
    if (window.shared && window.shared.slotOwners) {
      // 如果之前控制了某个插槽，释放它
      for (let slot in this.slotOwners) {
        if (this.slotOwners[slot] === this.myUserId) {
          delete window.shared.slotOwners[slot];
        }
      }
      // 同步本地slotOwners对象
      this.slotOwners = {...window.shared.slotOwners};
    }
    
    // 更新连接按钮文本
    const connectButton = document.getElementById('connect-button');
    if (connectButton) {
      connectButton.textContent = 'View Only';
      connectButton.style.backgroundColor = '#9C27B0';
    }
    
    // 更新全局变量以保持一致性
    window.isViewOnlyMode = this.isViewOnlyMode;
    window.controlledSlotIndex = this.controlledSlotIndex;
    
    return this.isViewOnlyMode;
  },
  
  // 选择控制特定插槽
  selectSlotToControl: function(slotIndex) {
    if (slotIndex < 0 || slotIndex > 7) return false;
    
    // 检查该插槽是否已被占用
    if (this.slotOwners[slotIndex] && this.slotOwners[slotIndex] !== this.myUserId) {
      alert(`Slot ${slotIndex + 1} is already occupied by another user!`);
      return false;
    }
    
    this.isViewOnlyMode = false;
    this.controlledSlotIndex = slotIndex;
    
    // 如果已连接，更新共享状态
    if (window.shared && window.shared.slotOwners) {
      // 首先释放之前可能控制的其他插槽
      for (let slot in this.slotOwners) {
        if (this.slotOwners[slot] === this.myUserId) {
          delete window.shared.slotOwners[slot];
        }
      }
      
      // 声明对此插槽的控制权
      window.shared.slotOwners[slotIndex] = this.myUserId;
      
      // 同步本地slotOwners对象
      this.slotOwners = {...window.shared.slotOwners};
      
      // 增加版本计数器以触发同步
      window.shared.versionCounter = (window.shared.versionCounter || 0) + 1;
    }
    
    // 更新连接按钮文本
    const connectButton = document.getElementById('connect-button');
    if (connectButton) {
      connectButton.textContent = `Control Slot ${slotIndex + 1}`;
      connectButton.style.backgroundColor = this.slotColors[slotIndex];
      
      // 确保文本颜色在深色背景上清晰可见
      const rgb = this.hexToRgb(this.slotColors[slotIndex]);
      if (rgb) {
        // 计算亮度，使用相对亮度公式
        const brightness = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        connectButton.style.color = brightness > 0.5 ? '#000' : '#fff';
      }
    }
    
    // 更新全局变量以保持一致性
    window.isViewOnlyMode = this.isViewOnlyMode;
    window.controlledSlotIndex = this.controlledSlotIndex;
    window.slotOwners = {...this.slotOwners};
    window.myUserId = this.myUserId;
    
    // 强制进行界面重绘
    if (typeof redraw === 'function') {
      redraw();
    }
    
    return true;
  },
  
  // 创建直接在一级菜单显示变体管理的按钮
  createVariantUI: function(slotIndex, container) {
    // 检查插槽索引是否有效
    if (slotIndex < 0 || slotIndex >= this.patterns.length) {
      return false;
    }
    
    // 获取当前插槽的变体数据
    const slotData = this.patterns[slotIndex];
    const currentVariantIndex = slotData.currentVariant;
    const variants = slotData.variants;
    
    // 创建新的变体按钮容器
    const variantContainer = document.createElement('div');
    variantContainer.className = 'variant-buttons-container';
    variantContainer.style.display = 'flex';
    variantContainer.style.flexWrap = 'wrap';
    variantContainer.style.justifyContent = 'center';
    variantContainer.style.gap = '3px';
    variantContainer.style.marginTop = '5px';
    
    // 添加变体按钮
    for (let i = 0; i < variants.length; i++) {
      const isActive = i === currentVariantIndex;
      
      // 创建变体按钮
      const variantButton = document.createElement('div');
      variantButton.className = `variant-button ${isActive ? 'active' : ''}`;
      variantButton.setAttribute('data-variant', i);
      variantButton.style.width = '20px';
      variantButton.style.height = '20px';
      variantButton.style.backgroundColor = isActive ? this.slotColors[slotIndex] : '#444';
      variantButton.style.color = 'white';
      variantButton.style.display = 'flex';
      variantButton.style.alignItems = 'center';
      variantButton.style.justifyContent = 'center';
      variantButton.style.borderRadius = '3px';
      variantButton.style.fontSize = '10px';
      variantButton.style.cursor = 'pointer';
      variantButton.style.position = 'relative';
      variantButton.textContent = (i + 1).toString();
      
      // 添加删除按钮 (只在悬停时显示，且只有在变体数量>1时才启用)
      if (variants.length > 1) {
        // 创建删除按钮
        const deleteButton = document.createElement('div');
        deleteButton.className = 'variant-delete-button';
        deleteButton.style.position = 'absolute';
        deleteButton.style.top = '-5px';
        deleteButton.style.right = '-5px';
        deleteButton.style.width = '12px';
        deleteButton.style.height = '12px';
        deleteButton.style.backgroundColor = '#f44336';
        deleteButton.style.color = 'white';
        deleteButton.style.borderRadius = '50%';
        deleteButton.style.display = 'none';
        deleteButton.style.alignItems = 'center';
        deleteButton.style.justifyContent = 'center';
        deleteButton.style.fontSize = '8px';
        deleteButton.style.cursor = 'pointer';
        deleteButton.textContent = '×';
        
        // 添加悬停事件以显示删除按钮
        variantButton.addEventListener('mouseenter', function() {
          deleteButton.style.display = 'flex';
        });
        
        variantButton.addEventListener('mouseleave', function() {
          deleteButton.style.display = 'none';
        });
        
        // 添加删除按钮点击事件
        const self = this;
        deleteButton.addEventListener('click', function(e) {
          e.stopPropagation(); // 阻止事件冒泡，不触发父元素的点击事件
          
          // 确保有权限编辑此插槽
          if (!self.canEditSlot(slotIndex)) {
            return;
          }
          
          // 删除变体
          variants.splice(i, 1);
          
          // 如果删除的是当前活动变体，调整当前变体索引
          if (i === currentVariantIndex) {
            // 如果删除的是最后一个变体，则指向新的最后一个
            self.patterns[slotIndex].currentVariant = i > 0 ? i - 1 : 0;
          } else if (i < currentVariantIndex) {
            // 如果删除的是前面的变体，当前变体索引需减一
            self.patterns[slotIndex].currentVariant--;
          }
          
          // 加载调整后的当前变体
          self.loadPreset(slotIndex, self.patterns[slotIndex].currentVariant);
          
          // 触发圆环数据变化事件，确保五线谱更新
          if (typeof window.triggerCircleDataChange === 'function') {
            window.triggerCircleDataChange();
          }
          
          // 如果是协作模式，同步改动
          if (window.shared) {
            self.syncToShared();
          }
          
          // 重新构建变体UI
          container.innerHTML = '';
          self.createVariantUI(slotIndex, container);
        });
        
        variantButton.appendChild(deleteButton);
      }
      
      // 添加变体按钮点击事件
      const self = this;
      variantButton.addEventListener('click', function() {
        const variantIndex = parseInt(this.getAttribute('data-variant'));
        
        // 保存当前编辑
        if (self.canEditSlot(slotIndex)) {
          self.saveCurrentPreset(slotIndex, null, currentVariantIndex);
        }
        
        // 加载选中的变体
        self.loadPreset(slotIndex, variantIndex);
        
        // 触发圆环数据变化事件，确保五线谱更新
        if (typeof window.triggerCircleDataChange === 'function') {
          window.triggerCircleDataChange();
        }
        
        // 更新UI，将此按钮标记为活动状态
        const variantButtons = variantContainer.querySelectorAll('.variant-button');
        variantButtons.forEach(btn => {
          btn.classList.remove('active');
          btn.style.backgroundColor = '#444';
        });
        this.classList.add('active');
        this.style.backgroundColor = self.slotColors[slotIndex];
        
        // 如果是协作模式，同步改动
        if (window.shared && self.canEditSlot(slotIndex)) {
          self.syncToShared();
        }
      });
      
      // 添加按钮到容器
      variantContainer.appendChild(variantButton);
    }
    
    // 添加"+"新变体按钮（如果未达到最大数量）
    if (variants.length < this.maxVariantsPerSlot) {
      const addButton = document.createElement('div');
      addButton.className = 'variant-add-button';
      addButton.style.width = '20px';
      addButton.style.height = '20px';
      addButton.style.backgroundColor = '#4CAF50';
      addButton.style.color = 'white';
      addButton.style.display = 'flex';
      addButton.style.alignItems = 'center';
      addButton.style.justifyContent = 'center';
      addButton.style.borderRadius = '3px';
      addButton.style.fontSize = '14px';
      addButton.style.cursor = 'pointer';
      addButton.textContent = '+';
      
      // 添加点击事件
      const self = this;
      addButton.addEventListener('click', function() {
        // 检查是否有权限编辑此插槽
        if (!self.canEditSlot(slotIndex)) {
          return;
        }
        
        // 保存当前编辑
        self.saveCurrentPreset(slotIndex, null, currentVariantIndex);
        
        // 创建新变体
        const newVariantIndex = variants.length;
        self.saveCurrentPreset(slotIndex, [], newVariantIndex);
        
        // 加载新创建的空变体
        self.loadPreset(slotIndex, newVariantIndex);
        
        // 触发圆环数据变化事件，确保五线谱更新
        if (typeof window.triggerCircleDataChange === 'function') {
          window.triggerCircleDataChange();
        }
        
        // 如果是协作模式，同步改动
        if (window.shared) {
          self.syncToShared();
        }
        
        // 重新构建变体UI
        container.innerHTML = '';
        self.createVariantUI(slotIndex, container);
      });
      
      // 添加按钮到容器
      variantContainer.appendChild(addButton);
    }
    
    // 将变体容器添加到主容器
    container.appendChild(variantContainer);
    
    return true;
  },
  
  // 添加复制变体的方法
  duplicateVariant: function(slotIndex, sourceVariantIndex) {
    if (slotIndex < 0 || slotIndex >= this.patterns.length) {
      return false;
    }
    
    const variants = this.patterns[slotIndex].variants;
    
    // 如果未指定源变体，使用当前变体
    if (sourceVariantIndex === undefined) {
      sourceVariantIndex = this.patterns[slotIndex].currentVariant;
    }
    
    // 检查源变体是否有效
    if (sourceVariantIndex < 0 || sourceVariantIndex >= variants.length) {
      return false;
    }
    
    // 检查是否已达到最大变体数量
    if (variants.length >= this.maxVariantsPerSlot) {
      return false;
    }
    
    // 创建源变体的深拷贝
    const variantCopy = JSON.parse(JSON.stringify(variants[sourceVariantIndex]));
    
    // 将副本添加为新变体
    variants.push(variantCopy);
    
    // 设置当前变体为新创建的变体
    this.patterns[slotIndex].currentVariant = variants.length - 1;
    
    // 加载新变体
    this.loadPreset(slotIndex, variants.length - 1);
    
    return true;
  },
  
  // 添加变体切换方法（循环切换）
  cycleVariant: function(slotIndex, direction) {
    if (slotIndex < 0 || slotIndex >= this.patterns.length) {
      return false;
    }
    
    const variants = this.patterns[slotIndex].variants;
    
    // 如果只有一个变体，无需切换
    if (variants.length <= 1) {
      return false;
    }
    
    // 临时禁用拖拽标志，确保变体切换时不会被阻止同步
    const wasDragging = window.isDraggingInOverview;
    window.isDraggingInOverview = false;
    
    // 计算下一个变体索引
    let nextVariantIndex = this.patterns[slotIndex].currentVariant + direction;
    
    // 循环处理边界情况
    if (nextVariantIndex < 0) {
      nextVariantIndex = variants.length - 1;
    } else if (nextVariantIndex >= variants.length) {
      nextVariantIndex = 0;
    }
    
    // 保存当前编辑
    if (this.canEditSlot(slotIndex)) {
      this.saveCurrentPreset(slotIndex, null, this.patterns[slotIndex].currentVariant);
    }
    
    // 加载下一个变体
    this.loadPreset(slotIndex, nextVariantIndex);
    
    // 触发圆环数据变化事件，确保五线谱更新
    if (typeof window.triggerCircleDataChange === 'function') {
      window.triggerCircleDataChange();
    }
    
    // 延迟恢复原始拖拽状态，确保同步完成
    setTimeout(() => {
      window.isDraggingInOverview = wasDragging;
    }, 100);
    
    // 返回新的变体索引
    return nextVariantIndex;
  },
  
  // 同步共享状态
  syncFromShared: function() {
    if (!window.shared) return;
    
    // 同步插槽所有者信息
    if (window.shared.slotOwners) {
      this.slotOwners = {...window.shared.slotOwners};
      // 同步到全局变量
      window.slotOwners = {...this.slotOwners};
    }
    
    // 同步预设数据
    if (window.shared.presets && Array.isArray(window.shared.presets)) {
      // 深拷贝确保数据完整
      const sharedPresets = JSON.parse(JSON.stringify(window.shared.presets)); 
      
      // 遍历所有预设
      for (let i = 0; i < sharedPresets.length; i++) {
        // 如果当前用户不控制此插槽，才从共享对象更新预设数据
        if (i !== this.controlledSlotIndex || this.isViewOnlyMode) {
          this.patterns[i] = sharedPresets[i];
        }
      }
      
      // 更新全局变量
      window.presetPatterns = this.patterns;
    }
    
    // 确保全局一致性
    window.isViewOnlyMode = this.isViewOnlyMode;
    window.controlledSlotIndex = this.controlledSlotIndex;
    window.myUserId = this.myUserId;
    
    // 同步activeNodes
    const currentPreset = window.ui ? window.ui.currentPattern : 0;
    if (currentPreset !== this.controlledSlotIndex || this.isViewOnlyMode) {
      // 从预设加载当前显示的节点
      this.loadPreset(currentPreset);
    }
    
    // 如果总览视图可用，刷新所有插槽数据
    if (window.circleOverview && typeof window.circleOverview.refresh === 'function') {
      window.circleOverview.refresh();
    }
  },
  
  // 将本地数据同步到共享对象
  syncToShared: function() {
    if (!window.shared) return;
    
    // 检查是否有权限发送更改
    if (this.controlledSlotIndex === -1 && this.isViewOnlyMode) {
      return;
    }
    
    // 确保共享对象有预设数组
    if (!window.shared.presets || !Array.isArray(window.shared.presets)) {
      window.shared.presets = Array(8).fill().map(() => ({ variants: [[]], currentVariant: 0 }));
    }
    
    // 只同步用户控制的那个插槽
    if (this.controlledSlotIndex !== -1 && !this.isViewOnlyMode) {
      // 先保存当前节点到对应的预设
      this.saveCurrentPreset(this.controlledSlotIndex);
      
      // 然后同步到共享对象
      window.shared.presets[this.controlledSlotIndex] = JSON.parse(JSON.stringify(this.patterns[this.controlledSlotIndex]));
      
      // 更新shared版本计数器，触发其他客户端同步
      window.shared.versionCounter = (window.shared.versionCounter || 0) + 1;
    }
    
    // 确保插槽控制信息完整
    if (!window.shared.slotOwners) {
      window.shared.slotOwners = {};
    }
    
    // 确保当前用户控制的插槽被正确标记
    if (this.controlledSlotIndex !== -1 && !this.isViewOnlyMode) {
      window.shared.slotOwners[this.controlledSlotIndex] = this.myUserId;
    }
  },
  
  // 辅助函数：将HEX颜色转换为RGB
  hexToRgb: function(hex) {
    // 移除井号(如果有)
    hex = hex.replace(/^#/, '');
    
    // 解析RGB值
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    
    return {r, g, b};
  },
  
  // 添加显示插槽选择对话框的方法
  showSlotSelectionDialog: function() {
    // 检查是否已连接到p5.party
    if (!window.shared) {
      console.warn("未连接到p5.party，无法显示插槽选择对话框");
      return;
    }
    
    // 创建对话框容器
    let dialog = document.getElementById('slot-selection-dialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'slot-selection-dialog';
      dialog.style.position = 'fixed';
      dialog.style.top = '50%';
      dialog.style.left = '50%';
      dialog.style.transform = 'translate(-50%, -50%)';
      dialog.style.backgroundColor = 'rgba(34, 34, 34, 0.95)';
      dialog.style.padding = '20px';
      dialog.style.borderRadius = '10px';
      dialog.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.7)';
      dialog.style.zIndex = '1200';
      dialog.style.color = 'white';
      dialog.style.fontFamily = 'Arial, sans-serif';
      dialog.style.textAlign = 'center';
      dialog.style.minWidth = '300px';
      dialog.style.maxWidth = '90%';
      dialog.style.maxHeight = '90vh';
      dialog.style.overflow = 'auto';
      
      document.body.appendChild(dialog);
    }
    
    // 清空对话框内容
    dialog.innerHTML = '';
    
    // 添加标题
    const title = document.createElement('h3');
    title.textContent = 'Select a Slot to Control';
    title.style.marginBottom = '15px';
    dialog.appendChild(title);
    
    // 更新插槽所有者信息
    if (window.shared.slotOwners) {
      this.slotOwners = {...window.shared.slotOwners};
    }
    
    // 添加插槽按钮容器
    const slotsContainer = document.createElement('div');
    slotsContainer.style.display = 'flex';
    slotsContainer.style.flexWrap = 'wrap';
    slotsContainer.style.justifyContent = 'center';
    slotsContainer.style.gap = '10px';
    slotsContainer.style.marginBottom = '15px';
    
    // 创建每个插槽的按钮
    for (let i = 0; i < 8; i++) {
      const isOccupied = this.slotOwners[i] && this.slotOwners[i] !== this.myUserId;
      const isControlledByMe = this.slotOwners[i] === this.myUserId;
      
      const button = document.createElement('button');
      button.className = 'slot-button';
      button.textContent = `Slot ${i + 1}`;
      button.style.padding = '10px 15px';
      button.style.backgroundColor = isOccupied ? '#777' : this.slotColors[i];
      button.style.color = '#fff';
      button.style.border = 'none';
      button.style.borderRadius = '5px';
      button.style.cursor = isOccupied ? 'not-allowed' : 'pointer';
      button.style.opacity = isOccupied ? '0.7' : '1';
      button.style.position = 'relative';
      
      // 显示插槽状态图标或文本
      if (isOccupied) {
        const occupiedIcon = document.createElement('span');
        occupiedIcon.textContent = '🔒';
        occupiedIcon.style.position = 'absolute';
        occupiedIcon.style.top = '5px';
        occupiedIcon.style.right = '5px';
        occupiedIcon.style.fontSize = '12px';
        button.appendChild(occupiedIcon);
        
        // 停用被其他用户占用的插槽
        button.disabled = true;
      } else if (isControlledByMe) {
        const myIcon = document.createElement('span');
        myIcon.textContent = '✓';
        myIcon.style.position = 'absolute';
        myIcon.style.top = '5px';
        myIcon.style.right = '5px';
        myIcon.style.fontSize = '12px';
        button.appendChild(myIcon);
      }
      
      // 只有未被占用的插槽才能点击
      if (!isOccupied) {
        button.addEventListener('click', () => {
          this.selectSlotToControl(i);
          dialog.remove();
          
          // 如果有syncSynthParamsOnSlotControl方法，调用它来同步合成器参数
          if (window.syncSynthParamsOnSlotControl) {
            window.syncSynthParamsOnSlotControl(i);
          }
          
          // 强制进行界面重绘
          if (typeof redraw === 'function') {
            redraw();
          }
        });
      }
      
      slotsContainer.appendChild(button);
    }
    
    dialog.appendChild(slotsContainer);
    
    // 添加"观看模式"按钮
    const viewOnlyButton = document.createElement('button');
    viewOnlyButton.textContent = 'View Only Mode';
    viewOnlyButton.style.padding = '10px 15px';
    viewOnlyButton.style.backgroundColor = '#9C27B0';
    viewOnlyButton.style.color = '#fff';
    viewOnlyButton.style.border = 'none';
    viewOnlyButton.style.borderRadius = '5px';
    viewOnlyButton.style.cursor = 'pointer';
    viewOnlyButton.style.marginTop = '10px';
    viewOnlyButton.addEventListener('click', () => {
      this.setViewOnlyMode();
      dialog.remove();
      
      // 强制进行界面重绘
      if (typeof redraw === 'function') {
        redraw();
      }
    });
    
    dialog.appendChild(viewOnlyButton);
    
    // 添加关闭按钮
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.padding = '10px 15px';
    closeButton.style.backgroundColor = '#555';
    closeButton.style.color = '#fff';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '5px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.marginTop = '10px';
    closeButton.style.marginLeft = '10px';
    closeButton.addEventListener('click', () => {
      dialog.remove();
      
      // 强制进行界面重绘
      if (typeof redraw === 'function') {
        redraw();
      }
    });
    
    dialog.appendChild(closeButton);
    
    // 点击对话框外部关闭对话框
    const handleClickOutside = (event) => {
      if (dialog && !dialog.contains(event.target)) {
        dialog.remove();
        document.removeEventListener('mousedown', handleClickOutside);
        
        // 强制进行界面重绘
        if (typeof redraw === 'function') {
          redraw();
        }
      }
    };
    
    // 添加点击事件监听器
    document.addEventListener('mousedown', handleClickOutside);
  }
};

// 更新到新的数据结构，处理旧版数据格式的兼容
(function migrateToNewDataFormat() {
  // 检查是否需要迁移数据结构
  const needsMigration = !presetPatterns[0].hasOwnProperty('variants');
  
  if (needsMigration) {
    // 创建临时数组保存旧数据
    const oldData = JSON.parse(JSON.stringify(presetPatterns));
    
    // 重置presetPatterns为新格式
    presetPatterns = Array(8).fill().map(() => ({ variants: [[]], currentVariant: 0 }));
    
    // 将旧数据迁移到新格式
    for (let i = 0; i < oldData.length; i++) {
      if (oldData[i] && oldData[i].length > 0) {
        presetPatterns[i].variants[0] = oldData[i];
      }
    }
    
    // 更新window.presetPatterns引用
    window.presetPatterns = presetPatterns;
    
    // 更新presetManager的patterns引用
    if (window.presetManager) {
      window.presetManager.patterns = presetPatterns;
    }
  }
})();

// 向window添加变量，确保向下兼容
window.presetPatterns = presetPatterns;
window.presetSlotColors = presetSlotColors;
window.nodes = activeNodes;  // 添加全局nodes引用
window.controlledSlotIndex = controlledSlotIndex;
window.isViewOnlyMode = isViewOnlyMode;
window.slotOwners = slotOwners;

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.presetManager;
} 