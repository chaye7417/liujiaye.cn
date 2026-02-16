/**
 * 整合脚本 - 用于协调Three.js和p5.js之间的交互
 * 已适配重构后的audio-sequencer模块化结构
 */

// 渲染状态控制
const renderState = {
    threeEnabled: true,   // Three.js渲染始终启用
    p5Opacity: 0.3,       // p5.js画布透明度固定为0.3
    beatEvents: [],       // 节拍事件队列
    lastBeat: -1,         // 上一个节拍
    rhythmVisible: true,  // 节奏步进器是否可见
    abcVisible: true     // ABC记谱法组件默认可见
};

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', initIntegration);

/**
 * 初始化整合环境
 */
function initIntegration() {

    
    // 设置Three.js的容器尺寸
    const threeContainer = document.getElementById('three-container');
    if (threeContainer) {
        threeContainer.style.width = '100%';
        threeContainer.style.height = '100%';
    }
    
    // 注册事件监听器
    setupEventListeners();
    
    // 添加全局变量供p5.js和Three.js使用
    window.p5CanvasOpacity = renderState.p5Opacity;
    window.rhythmVisible = renderState.rhythmVisible;
    window.abcVisible = renderState.abcVisible;
    
    // 确保Three.js背景始终可见
    const event = new CustomEvent('toggleThreeVisibility', { 
        detail: { visible: true }
    });
    window.dispatchEvent(event);
    
    // 确保controls始终可以正常工作
    // 5秒后检查控制面板，确保能被正确设置z-index
    // (需要等待Three.js完全加载，因为controls是由Three.js创建的)
    setTimeout(() => {
        const lilGuiElements = document.querySelectorAll('.lil-gui');
        if (lilGuiElements.length > 0) {
            lilGuiElements.forEach(guiElement => {
                guiElement.style.zIndex = '1000';
                guiElement.style.pointerEvents = 'auto';
            });

        }
    }, 5000);
    
    // 确保初始化时按钮显示正确文本
    const toggleButton = document.getElementById('toggle-rhythm-button');
    if (toggleButton) {
        toggleButton.textContent = renderState.rhythmVisible ? 
            (window.languageManager ? window.languageManager.getText('controls', 'hideRhythm') : 'Hide Rhythm') :
            (window.languageManager ? window.languageManager.getText('controls', 'showRhythm') : 'Show Rhythm');
    }
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 节奏步进器切换按钮
    const toggleRhythmButton = document.getElementById('toggle-rhythm-button');
    if (toggleRhythmButton) {
        toggleRhythmButton.addEventListener('click', () => {
            // 反转步进器可见状态
            toggleRhythmVisibility(!renderState.rhythmVisible);
        });
    }
    
    // 添加键盘快捷键
    document.addEventListener('keydown', (event) => {
        // 按下'R'键切换节奏步进器显示
        if (event.key === 'r' || event.key === 'R') {
            toggleRhythmVisibility(!renderState.rhythmVisible);
        }
        
        // 注意: 'M'键的处理已移到ABCNotation.js中
    });
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        // 调整Three.js容器大小
        resizeThreeContainer();
    });
    
    // 监听ABC可见性变化，只更新状态
    window.addEventListener('abc-visibility-change', (event) => {
        if (event.detail) {
            renderState.abcVisible = event.detail.visible;
        }
    });
}

/**
 * 调整Three.js容器大小
 */
function resizeThreeContainer() {
    const threeContainer = document.getElementById('three-container');
    if (threeContainer) {
        threeContainer.style.width = '100%';
        threeContainer.style.height = '100%';
    }
}

/**
 * 切换节奏步进器可见性
 * @param {boolean} visible - 是否可见
 */
function toggleRhythmVisibility(visible) {
    // 设置状态
    renderState.rhythmVisible = visible;
    window.rhythmVisible = visible;
    
    // 获取p5.js画布容器
    const p5Container = document.getElementById('p5-container');
    if (p5Container) {
        if (visible) {
            // 1. 首先移除hidden类，它设置了多个隐藏相关的CSS属性
            p5Container.classList.remove('hidden');
            
            // 2. 确保所有在CSS类中设置的样式属性都被明确覆盖
            p5Container.style.opacity = '1';  // 确保可见
            p5Container.style.pointerEvents = 'auto';  // 允许鼠标交互
            p5Container.style.zIndex = '10';  // 正确的层级
            p5Container.style.visibility = 'visible';  // 确保可见性
            
            // 3. 恢复p5.js画布的透明度
            window.p5CanvasOpacity = 0.3;
            

            
            // 4. 保持固定尺寸和位置
            p5Container.style.width = '800px';
            p5Container.style.height = '800px';
            p5Container.style.position = 'absolute';
            p5Container.style.left = '50%';
            p5Container.style.top = '50%';
            p5Container.style.transform = 'translate(-50%, -50%)';
            
            // 5. 强制刷新p5容器
            setTimeout(() => {
                // 触发布局重新计算，强制浏览器重绘
                const displayValue = p5Container.style.display;
                p5Container.style.display = 'none';
                void p5Container.offsetHeight;  // 触发布局重新计算
                p5Container.style.display = displayValue || 'block';
            }, 10);
            
            // 同时显示ABC五线谱 - 不再需要显式调用forceShow，因为ABC容器现在是p5容器的子元素
            if (window.abcjs && typeof window.abcjs.forceShow === 'function') {
                window.abcjs.forceShow();
                renderState.abcVisible = true;

            }
        } else {
            // 隐藏步进器
            window.p5CanvasOpacity = 0;  // 设置全局透明度为0
            
            // 添加hidden类，它包含了所有需要的隐藏样式
            p5Container.classList.add('hidden');
            
            // 额外设置样式属性确保完全隐藏
            p5Container.style.pointerEvents = 'none';
            p5Container.style.zIndex = '-1';
            p5Container.style.opacity = '0';
            p5Container.style.visibility = 'hidden';
            
            // 保持固定尺寸样式
            p5Container.style.width = '800px';
            p5Container.style.height = '800px';
            p5Container.style.position = 'absolute';
            p5Container.style.left = '50%';
            p5Container.style.top = '50%';
            p5Container.style.transform = 'translate(-50%, -50%)';
            
            // 同时隐藏ABC五线谱 - 不再需要显式调用forceHide，因为ABC容器现在是p5容器的子元素
            if (window.abcjs && typeof window.abcjs.forceHide === 'function') {
                window.abcjs.forceHide();
                renderState.abcVisible = false;

            }
        }
    }
    
    // 更新按钮状态
    const toggleButton = document.getElementById('toggle-rhythm-button');
    if (toggleButton) {
        toggleButton.textContent = visible ? 
            (window.languageManager ? window.languageManager.getText('controls', 'hideRhythm') : 'Hide Rhythm') :
            (window.languageManager ? window.languageManager.getText('controls', 'showRhythm') : 'Show Rhythm');
        toggleButton.style.backgroundColor = visible ? '#4CAF50' : '#9E9E9E';
    }
    
    // 分发visibility-change事件，供其他模块（如ABCEditor.js）监听
    const event = new CustomEvent('rhythm-visibility-change', {
        detail: { visible: visible }
    });
    window.dispatchEvent(event);
    
    // 在隐藏/显示状态切换时，清除p5.js的触摸和鼠标状态
    if (window.p5) {
        setTimeout(() => {
            // 触发一个全局点击事件，帮助重置p5的鼠标状态
            document.dispatchEvent(new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true
            }));
            
            // 如果显示，强制触发p5的重绘
            if (visible && window.redrawSketch) {
                window.redrawSketch();
            }
        }, 50);
    }
    
    // 确保Three.js控制面板可以正常工作
    const lilGuiElements = document.querySelectorAll('.lil-gui');
    if (lilGuiElements.length > 0) {
        lilGuiElements.forEach(guiElement => {
            // 确保控制面板总是在最顶层
            guiElement.style.zIndex = '1000';
            guiElement.style.pointerEvents = 'auto';
        });
    }
}

// 将渲染状态暴露给全局，方便调试和访问
window.renderState = renderState;

// 将toggleRhythmVisibility函数暴露为全局函数
window.toggleRhythmVisibility = toggleRhythmVisibility;

// 全局的步进器恢复函数，用于在出现问题时手动恢复
window.resetRhythmVisibility = function() {
    // 确保全局状态正确
    renderState.rhythmVisible = true;
    window.rhythmVisible = true;
    
    // 获取p5.js画布容器
    const p5Container = document.getElementById('p5-container');
    if (p5Container) {
        // 重置所有相关样式
        p5Container.classList.remove('hidden');
        p5Container.style.display = 'block';
        p5Container.style.opacity = '1';
        p5Container.style.pointerEvents = 'auto';
        p5Container.style.zIndex = '10';
        p5Container.style.visibility = 'visible';
        
        // 保持固定尺寸样式
        p5Container.style.width = '800px';
        p5Container.style.height = '800px';
        p5Container.style.position = 'absolute';
        p5Container.style.left = '50%';
        p5Container.style.top = '50%';
        p5Container.style.transform = 'translate(-50%, -50%)';
        
        // 重置透明度
        window.p5CanvasOpacity = 0.3;
        

    }
    
    // 更新按钮状态
    const toggleButton = document.getElementById('toggle-rhythm-button');
    if (toggleButton) {
        toggleButton.textContent = 
            (window.languageManager ? window.languageManager.getText('controls', 'hideRhythm') : 'Hide Rhythm');
        toggleButton.style.backgroundColor = '#4CAF50';
    }
    
    // 触发重绘
    if (window.redrawSketch) {
        window.redrawSketch();
    }
};

// 添加双击步进器按钮的应急恢复机制
document.addEventListener('DOMContentLoaded', function() {
    // 步进器切换按钮
    const toggleRhythmButton = document.getElementById('toggle-rhythm-button');
    if (toggleRhythmButton) {
        // 添加双击事件监听
        toggleRhythmButton.addEventListener('dblclick', function(event) {
            // 阻止双击事件被解释为两次单击
            event.preventDefault();
            
            // 触发应急恢复函数
            window.resetRhythmVisibility();
            

        });
    }
}); 