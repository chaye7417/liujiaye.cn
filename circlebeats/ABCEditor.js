/**
 * ABCEditor.js - 用于渲染ABC记谱法的五线谱和提供编辑功能
 * 基于abcjs库实现
 */

// 五线谱渲染状态
const abcState = {
    visible: true,         // 五线谱默认可见
    currentTune: null,      // 当前乐曲
    container: null,        // 渲染容器
    renderOptions: {        // 渲染选项
        responsive: "resize",
        add_classes: true,
        paddingbottom: 20,  // 适当的内边距
        paddingleft: 20,    // 适当的内边距
        paddingright: 20,   // 适当的内边距
        paddingtop: 20,     // 适当的内边距
        staffwidth: 600,    // 合适的五线谱宽度
        scale: 0.7,         // 从1.1改为0.7，缩小五线谱
        hideTitle: true,    // 隐藏标题
        hideSubtitle: true, // 隐藏副标题
        hideTempo: true,    // 隐藏速度标记
        hideTimeSignature: true, // 隐藏拍号
        hideKeySignature: true,  // 隐藏调号
        hideMeter: true,    // 保留小节线
        hideEndings: true,   // 隐藏反复记号
        hideLyrics: true,    // 隐藏歌词
        showMeasureNumbers: false, // 不显示小节编号
        foregroundColor: "#FFFFFF", // 前景色为纯白色
        staffLineColor: "rgba(255,255,255,0.6)", // 五线谱线为白色
        fontFamily: "Bravura" // 使用Bravura音乐字体
    }
};

// 初始化时直接创建全局访问接口
window.abcjs = {
    state: abcState,
    setTune: setTune,
    render: renderABC,
    reset: resetABC,
    forceShow: forceShowABC,
    forceHide: forceHideABC,
    updateFromCircle: updateFromCircle,
    highlightNote: highlightNote,
    addNotesHoverHandlers: addNotesHoverHandlers
};

// 初始化ABC记谱法
function initABCNotation() {
    // 创建渲染容器
    createABCContainer();

    // 加载Bravura字体
    loadBravuraFont();

    // 初始化默认乐曲 - 只设置但不渲染
    setDefaultTune(false);
    
    // 添加音符悬停样式
    addNoteHoverStyles();

    // 设置事件监听
    setupABCEventListeners();
    
    // 检查合成器界面的可见性，同步五线谱可见性
    let shouldBeVisible = true;
    
    // 检查合成器界面状态
    if (window.renderState && window.renderState.rhythmVisible !== undefined) {
        shouldBeVisible = window.renderState.rhythmVisible;
    } else if (window.rhythmVisible !== undefined) {
        shouldBeVisible = window.rhythmVisible;
    }
    
    // 检查合成器UI是否可见 - 适配新的模块化结构
    const synthVisible = window.metronome && 
                        window.metronome.synthUI && 
                        window.metronome.synthUI.visible;
    
    // 只有当节奏器可见且合成器UI不可见时，才显示乐谱
    shouldBeVisible = shouldBeVisible && !synthVisible;
    
    // 根据检查结果设置可见性
    abcState.visible = shouldBeVisible;
    if (abcState.container) {
        if (shouldBeVisible) {
        abcState.container.style.opacity = '1';
        abcState.container.style.visibility = 'visible';
        abcState.container.style.display = 'flex';
        } else {
            abcState.container.style.opacity = '0';
            abcState.container.style.visibility = 'hidden';
            abcState.container.style.display = 'none';
        }
    }
    
    return true;
}

// 加载Bravura字体
function loadBravuraFont() {
    const styleId = 'bravura-font-style';
    let styleElement = document.getElementById(styleId);
    
    if (styleElement) {
        styleElement.remove(); // 移除已存在的样式以避免冲突
    }
    
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = `
        @font-face {
            font-family: 'Bravura';
            src: url('https://cdn.jsdelivr.net/npm/smufl-fonts@1.0.0/bravura/Bravura.woff2') format('woff2'),
                 url('https://cdn.jsdelivr.net/npm/smufl-fonts@1.0.0/bravura/Bravura.woff') format('woff');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }
    `;
    document.head.appendChild(styleElement);
}

// 创建ABC渲染容器
function createABCContainer() {
    // 检查是否已存在容器
    let abcContainer = document.getElementById('abc-container');
    
    // 如果已存在，先移除它
    if (abcContainer) {
        abcContainer.remove();
    }
    
    // 创建ABC容器，嵌套在p5容器内部
    abcContainer = document.createElement('div');
    abcContainer.id = 'abc-container';
    abcContainer.className = 'renderer-container abc-notation-container';
    
    // 最小化直接样式设置，让CSS控制 - 只保留必要的样式属性
    abcContainer.style.pointerEvents = 'none'; // 默认不接收鼠标事件
    abcContainer.style.background = 'transparent'; // 透明背景
    
    // 获取p5容器并添加ABC容器作为子元素
    const p5Container = document.getElementById('p5-container');
    if (p5Container) {
        p5Container.appendChild(abcContainer);
    } else {
        document.body.appendChild(abcContainer);
    }
    
    // 创建内部绘制容器
    const abcDrawDiv = document.createElement('div');
    abcDrawDiv.id = 'abc-notation';
    
    // 最小化直接样式设置，让CSS控制
    abcDrawDiv.style.background = 'transparent';
    
    // 添加到容器中
    abcContainer.appendChild(abcDrawDiv);
    
    // 添加CSS样式以自定义渲染的乐谱
    const styleId = 'abc-custom-styles';
    let styleElement = document.getElementById(styleId);
    if (styleElement) {
        styleElement.remove(); // 移除已存在的样式以避免冲突
    }
    
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = `
        /* 简化的ABC渲染样式 */
        #abc-notation svg {
            background: transparent !important;
        }
        #abc-notation .abcjs-staff {
            fill: transparent !important;
        }
        #abc-notation .abcjs-staff-line {
            stroke: rgba(255,255,255,0.6) !important;
        }
        #abc-notation .abcjs-note {
            fill: rgba(255,255,255,0.9) !important;
        }
        #abc-notation .abcjs-stem {
            stroke: rgba(255,255,255,0.9) !important;
        }
        #abc-notation .abcjs-beam {
            fill: rgba(255,255,255,0.9) !important;
        }
        #abc-notation .abcjs-clef {
            fill: rgba(255,255,255,0.9) !important;
        }
        #abc-notation .abcjs-time-signature {
            display: none !important; /* 完全隐藏拍号 */
        }
        #abc-notation .abcjs-key-signature {
            display: none !important; /* 完全隐藏调号 */
        }
        #abc-notation .abcjs-bar {
            stroke: rgba(255,255,255,0.6) !important;
        }
        #abc-notation .abcjs-title, 
        #abc-notation .abcjs-subtitle,
        #abc-notation .abcjs-composer,
        #abc-notation .abcjs-author {
            display: none !important;
        }
    `;
    document.head.appendChild(styleElement);
    
    // 保存容器引用
    abcState.container = abcContainer;
}

// 设置默认乐曲
function setDefaultTune(shouldRender = true) {
    // 获取当前步进器的时值设置
    let noteLength = "1/4"; // 默认为四分音符
    
    // 尝试从metronome或UI获取当前分辨率
    if (window.metronome && window.metronome.resolution) {
        noteLength = window.metronome.resolution;
    } else if (window.ui && window.ui.resolution && window.ui.resolution.value) {
        noteLength = window.ui.resolution.value;
    }
    
    // 创建一组休止符
    let restNotation = "";
    
    // 根据不同的时值设置不同数量的休止符
    if (noteLength === "1/4") {
        restNotation = "z z z z";
    } else if (noteLength === "1/8") {
        restNotation = "z z z z z z z z";
    } else if (noteLength === "1/16") {
        restNotation = "z z z z z z z z z z z z z z z z";
    } else if (noteLength === "1/32") {
        restNotation = "z z z z z z z z z z z z z z z z z z z z z z z z z z z z z z z z";
    }
    
    // 设置一个空白的乐谱，只包含休止符
    const defaultTune = `X:1
M:4/4
L:${noteLength}
K:C
${restNotation} |]`;
    
    abcState.currentTune = defaultTune;
    
    // 只有当shouldRender为true时才渲染
    if (shouldRender && abcState.visible) {
        renderABC();
    }
}

// 设置乐曲
function setTune(abcNotation) {
    // 处理ABC谱，删除标题行
    let processedNotation = abcNotation;
    if (processedNotation.includes('T:')) {
        // 删除标题行
        processedNotation = processedNotation.replace(/T:.*\n/g, '');
    }
    
    abcState.currentTune = processedNotation;
    // 如果可见，立即重新渲染
    if (abcState.visible) {
        renderABC();
    }
}

// 渲染ABC乐谱
function renderABC() {
    // 确保有内容可渲染
    if (!abcState.currentTune) return;
    
    const drawDiv = document.getElementById('abc-notation');
    if (!drawDiv) {
        return;
    }
    
    // 清空现有内容
    drawDiv.innerHTML = '';
    
    try {
        // 修改渲染选项，确保谱号可见
        const renderOptions = {
            ...abcState.renderOptions,
            add_classes: true,
            responsive: "resize",
            hideKeySignature: true,
            hideTimeSignature: true,
            hideTempo: true,
            hideTitle: true,
            hideLyrics: true,
            showClef: true  // 确保显示谱号
        };
        
        // 使用ABCJS库渲染乐谱
        ABCJS.renderAbc(
            drawDiv,
            abcState.currentTune,
            renderOptions
        );
        
        // 应用自定义样式
        applyCustomStyles();
        
        if (abcState.visible) {
            abcState.container.style.visibility = 'visible';
            abcState.container.style.opacity = '1';
        }
        
        // 添加一个小延迟，确保元素已完全渲染再次应用样式
        setTimeout(() => {
            // 再次应用自定义样式，确保所有元素都已正确添加索引
            applyCustomStyles();
            
            // 添加事件处理器，使鼠标悬停在音符上时触发高亮
            addNotesHoverHandlers();
        }, 100);
    } catch (error) {
        // 错误处理
    }
}

// 应用自定义样式，确保乐谱显示在圆环上
function applyCustomStyles() {
    const svgElement = document.querySelector('#abc-notation svg');
    if (svgElement) {
        // 调整SVG大小和位置，只设置必要属性，其余使用CSS控制
        // 不再设置top属性，让CSS控制
        svgElement.style.position = 'absolute';
        svgElement.style.left = '50%';
        svgElement.style.transform = 'translate(-50%, -50%)';
        svgElement.style.width = '75%'; // 控制宽度略小于圆环
        svgElement.style.height = 'auto'; // 高度自适应
        svgElement.style.background = 'transparent';
        svgElement.style.maxWidth = '600px';
        svgElement.style.zIndex = '15'; // 确保在圆环上方
        
        // 调整SVG的viewBox以优化显示效果
        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
            const parts = viewBox.split(' ');
            if (parts.length === 4) {
                // 略微调整viewBox以提高定位精度
                const newViewBox = `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
                svgElement.setAttribute('viewBox', newViewBox);
            }
        }
        
        // 调整staffgroup的位置
        const staffGroup = svgElement.querySelector('.abcjs-staff-group');
        if (staffGroup) {
            staffGroup.style.transform = 'translateY(0)';
        }
        
        // 确保谱号可见并且样式正确
        const clefs = svgElement.querySelectorAll('.abcjs-clef');
        clefs.forEach(clef => {
            clef.style.fill = 'rgba(255,255,255,0.9)';
            clef.style.display = 'block'; // 确保谱号显示
        });
        
        // 只设置基本颜色和可见性
        // 强制隐藏拍号和调号
        const timeSignatures = svgElement.querySelectorAll('.abcjs-time-signature');
        timeSignatures.forEach(el => {
            el.style.display = 'none';
        });
        
        const keySignatures = svgElement.querySelectorAll('.abcjs-key-signature');
        keySignatures.forEach(el => {
            el.style.display = 'none';
        });
        
        // 隐藏所有标题相关元素
        const titleElements = svgElement.querySelectorAll('text.abcjs-title, text.abcjs-subtitle, text.abcjs-composer, text.abcjs-author');
        titleElements.forEach(el => {
            el.style.display = 'none';
        });

        // 获取步进器的steps数量
        let stepCount = 16; // 默认值
        if (window.ui && window.ui.stepCount) {
            stepCount = window.ui.stepCount;
        }
        
        // 为所有音符和休止符元素添加索引属性
        // 不再按照DOM顺序，而是按照实际的音符位置添加索引
        
        // 清除所有元素上的data-note-index属性和note-index-*类
        svgElement.querySelectorAll('[data-note-index]').forEach(el => {
            el.removeAttribute('data-note-index');
            // 移除所有note-index-*类
            [...el.classList].forEach(cls => {
                if (cls.startsWith('note-index-')) {
                    el.classList.remove(cls);
                }
            });
        });
        
        // 首先获取所有的音符和休止符，确定步骤位置
        let allElements = [];
        
        // 添加音符元素
        const notes = svgElement.querySelectorAll('.abcjs-note');
        notes.forEach(note => {
            allElements.push({type: 'note', element: note});
        });
        
        // 添加休止符元素
        const rests = svgElement.querySelectorAll('.abcjs-rest');
        rests.forEach(rest => {
            allElements.push({type: 'rest', element: rest});
        });
        
        // 如果元素总数不足步数，进行适当的调整
        if (allElements.length < stepCount) {
            // 警告处理
        } else if (allElements.length > stepCount) {
            // 只使用符合步数的元素
            allElements = allElements.slice(0, stepCount);
        }
        
        // 获取音符和休止符的横向位置，按照从左到右的顺序排序
        allElements.forEach(item => {
            const bbox = item.element.getBBox();
            item.x = bbox.x + bbox.width / 2; // 使用元素中心点的x坐标
        });
        
        // 按照横向位置排序
        allElements.sort((a, b) => a.x - b.x);
        
        // 为排序后的元素添加索引
        allElements.forEach((item, index) => {
            const element = item.element;
            element.setAttribute('data-note-index', index);
            element.classList.add('note-index-' + index);
        });
        
        // 先获取所有的符干和连接线
        const stems = Array.from(svgElement.querySelectorAll('.abcjs-stem'));
        const beams = Array.from(svgElement.querySelectorAll('.abcjs-beam'));
        
        // 清除可能存在的旧索引
        [...stems, ...beams].forEach(el => {
            el.removeAttribute('data-note-index');
            el.classList.remove('note-hover');
        });
        
        // 为音符关联符干和连接线
        allElements.forEach((item, index) => {
            // 只处理音符类型，休止符没有符干和连接线
            if (item.type === 'note') {
                const element = item.element;
                const bbox = element.getBBox();
                const centerX = bbox.x + bbox.width / 2;
                
                // 查找与这个音符关联的符干 - 使用更严格的关联逻辑
                // 只将距离最近的符干与音符关联
                let closestStem = null;
                let minStemDistance = Infinity;
                
                stems.forEach(stem => {
                    // 如果符干已经被关联，跳过
                    if (stem.hasAttribute('data-note-index')) return;
                    
                    const stemBBox = stem.getBBox();
                    const stemCenterX = stemBBox.x;
                    const distance = Math.abs(stemCenterX - centerX);
                    
                    // 使用更严格的距离判断 (5像素)
                    if (distance < 5 && distance < minStemDistance) {
                        minStemDistance = distance;
                        closestStem = stem;
                    }
                });
                
                // 关联最近的符干
                if (closestStem) {
                    closestStem.setAttribute('data-note-index', index);
                    closestStem.classList.add('note-index-' + index);
                }
                
                // 查找与这个音符关联的连接线 - 更精确的关联
                beams.forEach(beam => {
                    // 如果连接线已经被关联到这个音符，不进行重复关联
                    if (beam.getAttribute('data-note-index') === index.toString()) return;
                    
                    const beamBBox = beam.getBBox();
                    
                    // 只有当连接线的x范围确实包含音符的x位置，且未被关联时才关联
                    if (beamBBox.x <= centerX && beamBBox.x + beamBBox.width >= centerX && 
                        !beam.hasAttribute('data-note-index')) {
                        beam.setAttribute('data-note-index', index);
                        beam.classList.add('note-index-' + index);
                    }
                });
            }
        });
        
        // 统计添加了索引的元素数量
        const indexedElements = svgElement.querySelectorAll('[data-note-index]').length;
    }
}

// 添加音符和休止符的鼠标悬停事件处理
function addNotesHoverHandlers() {
    const svgElement = document.querySelector('#abc-notation svg');
    if (!svgElement) return;
    
    // 查找所有带有索引的音符和休止符
    const musicElements = svgElement.querySelectorAll('[data-note-index]');
    
    musicElements.forEach(element => {
        const index = parseInt(element.getAttribute('data-note-index'));
        
        // 移除之前可能添加的事件监听器
        element.onmouseover = null;
        element.onmouseout = null;
        
        // 添加鼠标悬停事件
        element.onmouseover = function() {
            // 仅当五线谱可见且未激活步进器悬停时，才在音符悬停时高亮
            if (abcState.visible && window.ui && window.ui.stepSequencer && window.ui.stepSequencer.hoveredStep === -1) {
                highlightNote(index);
                
                // 如果步进器存在且可见，同步高亮步进器上的相应位置
                if (window.ui && window.ui.stepSequencer) {
                    window.ui.stepSequencer.hoveredStep = index;
                }
            }
        };
        
        // 添加鼠标离开事件
        element.onmouseout = function() {
            // 仅当这是音符主动触发的悬停时才清除高亮
            if (abcState.visible && window.ui && window.ui.stepSequencer && window.ui.stepSequencer.hoveredStep === index) {
                highlightNote(-1); // 清除高亮
                if (window.ui && window.ui.stepSequencer) {
                    window.ui.stepSequencer.hoveredStep = -1;
                }
            }
        };
    });
}

// 强制显示ABC乐谱
function forceShowABC() {
    // 检查容器是否存在
    if (!abcState.container) {
        createABCContainer();
    }
    
    // 直接设置为可见
    abcState.visible = true;
    
    // 更新容器样式 - 仅设置可见性相关的样式
    if (abcState.container) {
        abcState.container.style.opacity = '1';
        abcState.container.style.visibility = 'visible';
        abcState.container.style.pointerEvents = 'none'; // 确保不接收鼠标事件
    }
    
    // 如果没有当前乐谱或者为空，设置默认乐谱
    if (!abcState.currentTune || abcState.currentTune.trim() === '') {
        setDefaultTune(true);
    } else {
        // 渲染现有乐谱
        renderABC();
    }
    
    return true;
}

// 强制隐藏ABC乐谱
function forceHideABC() {
    // 直接设置为不可见
    abcState.visible = false;
    
    if (abcState.container) {
        // 隐藏五线谱 - 仅设置可见性相关的样式
        abcState.container.style.opacity = '0';
        abcState.container.style.visibility = 'hidden';
        abcState.container.style.pointerEvents = 'none';
    }
    
    return false;
}

// 切换ABC五线谱可见性
function toggleABCVisibility(visible) {
    // 如果提供了明确的值，就使用它；否则，切换当前状态
    const targetVisibility = visible === undefined ? !abcState.visible : Boolean(visible);
    
    // 如果目标状态与当前状态相同，不做任何更改
    if (targetVisibility === abcState.visible) {
        return abcState.visible;
    }
    
    // 根据目标状态调用对应的函数
    let result;
    if (targetVisibility) {
        result = forceShowABC();
    } else {
        result = forceHideABC();
    }
    
    // 分发可见性变化事件
    dispatchVisibilityChangeEvent(targetVisibility);
    
    return result;
}

// 分发可见性变化事件
function dispatchVisibilityChangeEvent(visible) {
    const event = new CustomEvent('abc-visibility-change', {
        detail: { visible: visible }
    });
    window.dispatchEvent(event);
    
    // 更新按钮状态（如果存在）
    updateToggleButton();
}

// 更新切换按钮状态
function updateToggleButton() {
    // 按钮已与Rhythm步进器共用，不再需要单独更新
}

// 设置事件监听
function setupABCEventListeners() {
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        // 如果可见，重新渲染以适应新大小
        if (abcState.visible) {
            renderABC();
        }
    });
    
    // 监听节奏器可见性变化，同步ABC五线谱可见性
    window.addEventListener('rhythm-visibility-change', (event) => {
        if (event.detail && event.detail.visible !== undefined) {
            // 额外检查合成器界面是否可见，如果合成器可见则不显示乐谱
            const synthVisible = window.metronome && window.metronome.synthUI && window.metronome.synthUI.visible;
            
            // 只有当节奏器可见且合成器不可见时，才显示乐谱
            if (event.detail.visible && !synthVisible) {
                toggleABCVisibility(true);
            } else {
                toggleABCVisibility(false);
            }
        }
    });
    
    // 监听合成器UI可见性变化
    window.addEventListener('synth-ui-visibility-change', (event) => {
        if (event.detail && event.detail.visible !== undefined) {
            // 如果合成器UI变为可见，隐藏乐谱
            if (event.detail.visible) {
                toggleABCVisibility(false);
            } else {
                // 如果合成器UI变为隐藏，且节奏器可见，显示乐谱
                if (window.rhythmVisible) {
                    toggleABCVisibility(true);
                }
            }
        }
    });
    
    // 添加对M键的支持，用于切换五线谱显示
    document.addEventListener('keydown', (event) => {
        if (event.key === 'm' || event.key === 'M') {
            // 检查合成器UI是否可见
            const synthVisible = window.metronome && window.metronome.synthUI && window.metronome.synthUI.visible;
            
            // 如果合成器UI可见，M键不应该切换乐谱显示
            if (synthVisible) {
                return;
            }
            
            // 切换ABC五线谱的可见性
            const newVisibility = !abcState.visible;
            toggleABCVisibility(newVisibility);
            
            // 如果显示了ABC五线谱，也显示节奏步进器
            if (newVisibility && window.toggleRhythmVisibility) {
                window.toggleRhythmVisibility(true);
            } else if (!newVisibility && window.toggleRhythmVisibility) {
                // 如果隐藏了五线谱，也隐藏节奏步进器
                window.toggleRhythmVisibility(false);
            }
        }
    });
}

// 重置ABC组件
function resetABC() {
    // 获取当前步进器的时值设置和步数
    let noteLength = "1/4"; // 默认为四分音符
    let stepCount = 16; // 默认步数
    
    // 获取当前分辨率
    if (window.metronome && window.metronome.resolution) {
        noteLength = window.metronome.resolution;
    } else if (window.ui && window.ui.resolution && window.ui.resolution.value) {
        noteLength = window.ui.resolution.value;
    }
    
    // 获取当前步数
    if (window.ui && window.ui.stepCount) {
        stepCount = window.ui.stepCount;
    }
    
    // 生成默认的空白乐谱
    const defaultTune = `X:1
M:4/4
L:${noteLength}
K:C
|]`;
    
    // 设置新的乐谱
    abcState.currentTune = defaultTune;
    
    // 如果当前可见，重新渲染
    if (abcState.visible) {
        renderABC();
    }
    
    // 如果CircleToABC可用，主动请求一次转换更新
    if (window.circleToABC && typeof window.circleToABC.convertToABC === 'function') {
        // 构建最小化的圆环数据对象
        const minCircleData = {
            nodes: [],
            currentPreset: window.ui ? window.ui.currentPattern : 0
        };
        
        // 调用转换函数获取更新后的ABC
        const updatedAbc = window.circleToABC.convertToABC(minCircleData);
        
        // 设置更新后的ABC并重新渲染
        setTune(updatedAbc);
        renderABC();
    }
}

// 从圆圈数据更新ABC记谱
function updateFromCircle(circleData) {
    // 如果CircleToABC.js可用，使用它的转换函数
    if (window.circleToABC && typeof window.circleToABC.convertToABC === 'function') {
        const abcNotation = window.circleToABC.convertToABC(circleData);
        setTune(abcNotation);
        return abcNotation;
    }
    
    // 如果CircleToABC.js不可用，使用原有的转换逻辑
    // 处理不同类型的数据输入
    if (!circleData) return;
    
    let abcNotes = [];
    
    // 获取当前预设插槽索引
    let currentPreset = 0;
    if (circleData.currentPreset !== undefined) {
        currentPreset = circleData.currentPreset;
    } else if (window.ui && window.ui.currentPattern !== undefined) {
        currentPreset = window.ui.currentPattern;
    }
    
    // 获取插槽的基础音高设置
    let baseNote = 'C4'; // 默认中央C
    if (window.metronome && window.metronome.baseNotes && window.metronome.baseNotes[currentPreset]) {
        baseNote = window.metronome.baseNotes[currentPreset];
    }
    
    // 解析音符和八度
    const match = baseNote.match(/([A-G][#b]?)(\d+)/);
    const basePitch = match ? match[1] : 'C';
    const baseOctave = match ? parseInt(match[2]) : 4;
    
    // 设置默认调号为C
    let keySignature = "C";
    // 提取调号（如C、D等）
    if (basePitch && basePitch.charAt(0)) {
        keySignature = basePitch.charAt(0); // 只取第一个字符作为调号
    }
    
    // 默认4/4拍
    let timeSignature = "4/4";
    
    // 获取当前的时值设置
    let noteLength = "1/4"; // 默认为四分音符
    if (window.metronome && window.metronome.resolution) {
        noteLength = window.metronome.resolution;
    } else if (window.ui && window.ui.resolution && window.ui.resolution.value) {
        noteLength = window.ui.resolution.value;
    }
    
    // 处理节点数组
    if (circleData.nodes && Array.isArray(circleData.nodes)) {
        // 使用第一条音轨的数据
        const mainTrack = circleData.nodes[0];
        
        if (mainTrack && mainTrack.alpha) {
            // 获取步进器的steps数量
            let stepCount = 16; // 默认值
            if (window.ui && window.ui.stepCount) {
                stepCount = window.ui.stepCount;
            }
            
            // 只处理与步进器steps数量相匹配的音符数
            const notesToProcess = Math.min(mainTrack.alpha.length, stepCount);
            
            // 遍历步骤，找出活跃的音符
            for (let i = 0; i < notesToProcess; i++) {
                if (mainTrack.alpha[i] > 0.2) { // 如果步骤激活
                    // 使用插槽的基础音高作为初始音高
                    let adjustedNote = basePitch;
                    
                    // 检查是否有音高偏移
                    if (mainTrack.pitchOffset && mainTrack.pitchOffset[i] !== undefined) {
                        const pitchOffset = mainTrack.pitchOffset[i];
                        
                        // 乐理中的音阶
                        const scale = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
                        
                        // 找到基础音高在音阶中的位置
                        let basePitchIndex = scale.indexOf(basePitch);
                        if (basePitchIndex === -1) {
                            // 如果找不到精确匹配，尝试找到基本匹配（例如，"C"与"C#"）
                            basePitchIndex = scale.findIndex(note => note.charAt(0) === basePitch.charAt(0));
                            if (basePitchIndex === -1) basePitchIndex = 0; // 默认为C
                        }
                        
                        // 计算新的音高位置
                        let newPitchIndex = (basePitchIndex + pitchOffset) % 12;
                        if (newPitchIndex < 0) newPitchIndex += 12;
                        
                        // 计算八度变化
                        let octaveChange = Math.floor((basePitchIndex + pitchOffset) / 12);
                        if (pitchOffset < 0 && (basePitchIndex + pitchOffset) % 12 !== 0) {
                            octaveChange -= 1;
                        }
                        
                        // 获取新的音符
                        adjustedNote = scale[newPitchIndex];
                        
                        // 将 C#, Eb 等格式转换为ABC记谱法中的 ^C, _E 等格式
                        if (adjustedNote.length > 1) {
                            const baseNoteName = adjustedNote.charAt(0);
                            const accidental = adjustedNote.charAt(1);
                            
                            if (accidental === '#') {
                                // 升号在ABC中用^表示
                                adjustedNote = '^' + baseNoteName;
                            } else if (accidental === 'b') {
                                // 降号在ABC中用_表示
                                adjustedNote = '_' + baseNoteName;
                            } else {
                                adjustedNote = baseNoteName;
                            }
                        }
                        
                        // 计算新的八度
                        let newOctave = baseOctave + octaveChange;
                        
                        // ABC记谱法中表示八度的方式
                        if (newOctave === 4) {
                            // 小字组（C4）- 大写字母
                            adjustedNote = adjustedNote.toUpperCase();
                        } else if (newOctave === 5) {
                            // 小字一组（C5）- 小写字母
                            adjustedNote = adjustedNote.toLowerCase();
                        } else if (newOctave < 4) {
                            // 低八度使用逗号
                            adjustedNote = adjustedNote.toUpperCase() + ','.repeat(4 - newOctave);
                        } else if (newOctave > 5) {
                            // 高八度使用单引号
                            adjustedNote = adjustedNote.toLowerCase() + "'".repeat(newOctave - 5);
                        }
                    }
                    
                    // 将调整后的音符添加到ABC记谱中
                    abcNotes.push(adjustedNote);
                } else {
                    // 休止符（非活跃步骤）
                    abcNotes.push('z');
                }
            }
        }
    }
    
    // 如果没有有效的音符，使用默认
    if (abcNotes.length === 0) {
        // 创建一个空白的乐谱
        abcNotes = ['z'];
    }
    
    // 生成ABC记谱法，传入当前的时值设置
    const abcNotation = notesToABC(abcNotes, "", timeSignature, keySignature);
    
    // 更新ABC记谱
    setTune(abcNotation);
    
    return abcNotation;
}

// 将音符转换为ABC记谱法
function notesToABC(notes, title = "自动生成的乐谱", meter = "4/4", key = "C") {
    // 获取当前步进器的时值设置
    let noteLength = "1/4"; // 默认为四分音符
    
    // 尝试从metronome或UI获取当前分辨率
    if (window.metronome && window.metronome.resolution) {
        noteLength = window.metronome.resolution;
    } else if (window.ui && window.ui.resolution && window.ui.resolution.value) {
        noteLength = window.ui.resolution.value;
    }
    
    // 不包含标题，直接从拍号开始
    let abcHeader = `X:1
M:${meter}
L:${noteLength}
K:${key}
`;

    // 获取步进器的steps数量
    let stepCount = 16; // 默认值
    if (window.ui && window.ui.stepCount) {
        stepCount = window.ui.stepCount;
    }

    // 检查是否有音符
    if (notes.length === 0) {
        // 没有音符，返回空白乐谱
        return abcHeader + "|]";
    }
    
    // 确保音符数量不超过步进器设置的步数
    const validNotes = notes.slice(0, stepCount);
    
    // 处理音符时值和符杠连接
    let abcBody = '';
    
    // 对于16分音符和32分音符，我们需要设置合适的分组
    if (noteLength === "1/16" || noteLength === "1/32") {
        // 确定最佳的符杠分组大小
        let beamGroupSize = 4; // 默认每4个音符为一组
        
        // 根据步进器步数调整符杠分组
        if (stepCount % 4 === 0) {
            // 如果步数是4的倍数，保持默认分组
            beamGroupSize = 4;
        } else if (stepCount % 3 === 0) {
            // 如果步数是3的倍数，使用3个音符一组
            beamGroupSize = 3;
        } else if (stepCount % 2 === 0) {
            // 如果步数是2的倍数，使用2个音符一组
            beamGroupSize = 2;
        }
        
        // 分组处理，使用适当的空格来控制符杠连接
        for (let i = 0; i < validNotes.length; i += beamGroupSize) {
            // 获取当前分组的音符
            let group = validNotes.slice(i, Math.min(i + beamGroupSize, validNotes.length));
            
            // 如果分组中有休止符，需要特殊处理
            if (group.some(note => note === 'z')) {
                // 如果有休止符，单独处理每个音符，不进行连接
                abcBody += group.join(" ");
            } else {
                // 如果全是音符，去掉音符之间的空格以连接符杠
                abcBody += group.join("");
            }
            
            // 在分组之间添加空格
            if (i + beamGroupSize < validNotes.length) {
                abcBody += " ";
            }
        }
    } else {
        // 对于较大的时值（四分音符、八分音符），保持适当的间距
        abcBody = validNotes.join(" ");
    }
    
    // 添加结束小节线
    abcBody += " |]";
    
    return abcHeader + abcBody;
}

// 从MIDI数据生成ABC记谱法
function midiToABC(midiData) {
    // 简化版的MIDI到ABC转换
    // 实际应用中需要更复杂的逻辑
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    let abcNotes = [];
    
    // 遍历MIDI音符
    midiData.notes.forEach(note => {
        // 获取音符名称
        const octave = Math.floor(note.midi / 12) - 4; // MIDI音符60是中央C (C4)
        const noteName = noteNames[note.midi % 12];
        
        // 转换为ABC记谱法
        let abcNote = noteName;
        
        // 处理八度
        if (octave < 0) {
            // 低音区用逗号表示
            abcNote += ','.repeat(Math.abs(octave));
        } else if (octave > 0) {
            // 高音区用小写字母表示
            abcNote = abcNote.toLowerCase();
            if (octave > 1) {
                abcNote += "'".repeat(octave - 1);
            }
        }
        
        // 处理音符长度
        const duration = note.duration;
        if (duration === 0.25) {
            // 默认为1/4音符，不需要标记
        } else if (duration === 0.5) {
            abcNote += "2"; // 1/2音符
        } else if (duration === 1) {
            abcNote += "4"; // 全音符
        } else if (duration === 0.125) {
            abcNote += "/2"; // 1/8音符
        } else {
            // 其他长度
            abcNote += `${Math.round(duration * 4)}`;
        }
        
        abcNotes.push(abcNote);
    });
    
    // 生成不含标题的ABC记谱法
    return notesToABC(abcNotes, "", "4/4", "C");
}

// 根据步进位置高亮显示对应的五线谱音符
function highlightNote(stepIndex) {
    // 如果ABC五线谱不可见，则不执行高亮
    if (!abcState.visible) return;
    
    // 获取当前显示的音符总数
    const svgElement = document.querySelector('#abc-notation svg');
    if (!svgElement) {
        return;
    }
    
    // 清除所有元素的高亮效果
    svgElement.querySelectorAll('.note-hover').forEach(el => {
        el.classList.remove('note-hover');
    });
    
    // 恢复所有音符和休止符的原始颜色
    svgElement.querySelectorAll('.abcjs-note path, .abcjs-rest path').forEach(path => {
        path.style.fill = 'rgba(255,255,255,0.9)';
    });
    
    // 恢复所有符干的原始颜色
    svgElement.querySelectorAll('.abcjs-stem').forEach(stem => {
        stem.style.stroke = 'rgba(255,255,255,0.9)';
    });
    
    // 恢复所有连接线的原始颜色
    svgElement.querySelectorAll('.abcjs-beam').forEach(beam => {
        beam.style.fill = 'rgba(255,255,255,0.9)';
    });
    
    // 如果stepIndex为负值，则只清除高亮而不添加新高亮
    if (stepIndex < 0) {
        return;
    }
    
    // 获取步进器的steps数量，确保索引在有效范围内
    let stepCount = 16; // 默认值
    if (window.ui && window.ui.stepCount) {
        stepCount = window.ui.stepCount;
    }
    
    if (stepIndex >= stepCount) {
        return;
    }
    
    // 查找所有具有特定索引的元素
    const notesAndRests = svgElement.querySelectorAll(`.abcjs-note[data-note-index="${stepIndex}"], .abcjs-rest[data-note-index="${stepIndex}"]`);
    const stems = svgElement.querySelectorAll(`.abcjs-stem[data-note-index="${stepIndex}"]`);
    const beams = svgElement.querySelectorAll(`.abcjs-beam[data-note-index="${stepIndex}"]`);
    
    // 统计找到的元素
    const totalFoundElements = notesAndRests.length + stems.length + beams.length;
    
    // 如果没有找到任何元素，输出警告
    if (totalFoundElements === 0) {
        return;
    }
    
    // 高亮音符或休止符
    notesAndRests.forEach(element => {
        // 添加高亮类
        element.classList.add('note-hover');
        
        // 设置填充颜色
        const paths = element.querySelectorAll('path');
        paths.forEach(path => {
            path.style.fill = 'rgba(255, 119, 0, 0.9)';  // #FF7700 带透明度
        });
    });
    
    // 高亮符干
    stems.forEach(stem => {
        stem.classList.add('note-hover');
        stem.style.stroke = 'rgba(255, 119, 0, 0.9)';
    });
    
    // 高亮连接线
    beams.forEach(beam => {
        beam.classList.add('note-hover');
        beam.style.fill = 'rgba(255, 119, 0, 0.9)';
    });
}

// 添加CSS风格以支持音符悬停效果
function addNoteHoverStyles() {
    const styleId = 'abc-hover-styles';
    let styleElement = document.getElementById(styleId);
    if (styleElement) {
        styleElement.remove(); // 移除已存在的样式以避免冲突
    }
    
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = `
        /* 提高五线谱的整体可见性 */
        #abc-notation svg {
            filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.3));
        }
        
        /* 加强五线谱线条的可见性 */
        #abc-notation .abcjs-staff-line {
            stroke: rgba(255,255,255,0.8) !important;
            stroke-width: 1.2px !important;
        }
        
        /* 增强音符的可见性 */
        #abc-notation .abcjs-note path {
            fill: rgba(255,255,255,1) !important;
            filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.4));
        }
        
        /* 增强符干的可见性 */
        #abc-notation .abcjs-stem {
            stroke: rgba(255,255,255,1) !important;
            stroke-width: 1.5px !important;
        }
        
        /* 增强连接线的可见性 */
        #abc-notation .abcjs-beam {
            fill: rgba(255,255,255,1) !important;
        }
        
        /* 谱号的可见性 */
        #abc-notation .abcjs-clef {
            fill: rgba(255,255,255,0.9) !important;
        }
        
        /* 音符悬停效果 */
        #abc-notation .note-hover path {
            fill: rgba(255, 119, 0, 1) !important; /* 更亮的橙色 */
            filter: drop-shadow(0 0 3px rgba(255, 119, 0, 0.6)) !important;
            transition: all 0.02s linear !important;
        }
        
        /* 符干高亮样式 */
        #abc-notation .abcjs-stem.note-hover {
            stroke: rgba(255, 119, 0, 1) !important; /* 更亮的橙色 */
            filter: drop-shadow(0 0 2px rgba(255, 119, 0, 0.5)) !important;
            stroke-width: 1.8px !important;
            transition: all 0.02s linear !important;
        }
        
        /* 连接线高亮样式 */
        #abc-notation .abcjs-beam.note-hover {
            fill: rgba(255, 119, 0, 1) !important; /* 更亮的橙色 */
            filter: drop-shadow(0 0 2px rgba(255, 119, 0, 0.5)) !important;
            transition: all 0.02s linear !important;
        }
        
        /* 正常状态的过渡效果 */
        #abc-notation .abcjs-note path,
        #abc-notation .abcjs-rest path {
            transition: all 0.1s linear !important;
        }
        
        #abc-notation .abcjs-stem {
            transition: all 0.1s linear !important;
        }
        
        #abc-notation .abcjs-beam {
            transition: all 0.1s linear !important;
        }
    `;
    document.head.appendChild(styleElement);
}

// 检查页面加载完成后进行初始化
document.addEventListener('DOMContentLoaded', () => {
    // 确保abcjs库已加载后再初始化
    if (typeof window.ABCJS !== 'undefined') {
        initABCNotation();
    } else {
        // 设置一个检查，等待库加载
        const checkInterval = setInterval(() => {
            if (typeof window.ABCJS !== 'undefined') {
                clearInterval(checkInterval);
                initABCNotation();
            }
        }, 500);
        
        // 10秒后如果仍未加载，发出警告
        setTimeout(() => {
            if (typeof window.ABCJS === 'undefined') {
                clearInterval(checkInterval);
            }
        }, 10000);
    }
}); 