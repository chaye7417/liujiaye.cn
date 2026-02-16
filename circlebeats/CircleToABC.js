/**
 * CircleToABC.js - 用于将圆环数据转换为ABC记谱法
 * 连接节奏圆环和ABC音乐记谱系统
 */

// 创建全局对象
window.circleToABC = {
    // 将圆环数据转换为ABC记谱法
    convertToABC: function(circleData) {
        return generateABCNotation(circleData);
    },
    
    // 监听圆环数据变化并自动更新ABC记谱
    startAutoSync: function() {
        setupSyncEvents();

        return true;
    }
};

// 设置同步事件
function setupSyncEvents() {
    // 监听节奏圆环数据变化事件
    window.addEventListener('circle-data-change', function(event) {
        if (event.detail) {
            const abcNotation = generateABCNotation(event.detail);
            
            // 更新ABC记谱
            if (window.abcjs && window.abcjs.setTune) {
                window.abcjs.setTune(abcNotation);
                
                // 强制重新渲染，确保视图更新
                if (window.abcjs.render) {
                    window.abcjs.render();
                }
                

            }
        }
    });
    
    // 添加自定义事件监听器，用于分辨率变化
    window.addEventListener('resolution-change', function(event) {
        if (event.detail && window.ui && window.ui.resolution) {

            
            // 构建临时圆环数据对象
            const circleData = {
                nodes: window.nodes || [],
                currentPreset: window.ui.currentPattern || 0
            };
            
            // 更新ABC记谱
            const abcNotation = generateABCNotation(circleData);
            if (window.abcjs && window.abcjs.setTune) {
                window.abcjs.setTune(abcNotation);
                if (window.abcjs.render) {
                    window.abcjs.render();
                }
            }
        }
    });
    
    // 添加自定义事件监听器，用于步数变化
    window.addEventListener('steps-change', function(event) {
        if (event.detail && window.ui) {

            
            // 构建临时圆环数据对象
            const circleData = {
                nodes: window.nodes || [],
                currentPreset: window.ui.currentPattern || 0
            };
            
            // 更新ABC记谱
            const abcNotation = generateABCNotation(circleData);
            if (window.abcjs && window.abcjs.setTune) {
                window.abcjs.setTune(abcNotation);
                if (window.abcjs.render) {
                    window.abcjs.render();
                }
            }
        }
    });
    
    // 监听节拍更新事件，可以用来高亮当前播放的音符
    window.addEventListener('stepper-sync', function(event) {
        if (event.detail && event.detail.active) {

            // 在未来实现高亮当前节拍的音符
        }
    });
}

// 生成ABC记谱法
function generateABCNotation(circleData) {
    // 如果没有数据，返回默认音阶
    if (!circleData || !circleData.nodes || circleData.nodes.length === 0) {
        return getDefaultScale();
    }
    
    // 处理节点数据
    const mainTrack = circleData.nodes[0]; // 使用第一个轨道的数据
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
    
    // 获取步进器的steps数量
    let stepCount = 16; // 默认值
    if (circleData.stepCount) {
        stepCount = circleData.stepCount;
    } else if (window.ui && window.ui.stepCount) {
        stepCount = window.ui.stepCount;
    }
    
    // 标记是否有任何活跃音符
    let hasActiveNotes = false;
    
    // 如果有alpha或alphas数组，处理节奏步骤
    if (mainTrack && (mainTrack.alpha || mainTrack.alphas)) {
        const steps = mainTrack.alpha || mainTrack.alphas;
        
        // 只处理与步进器steps数量相匹配的音符数
        const notesToProcess = Math.min(steps.length, stepCount);
        
        // 遍历步骤，找出活跃的音符
        for (let i = 0; i < notesToProcess; i++) {
            if (steps[i] > 0.2) { // 如果步骤激活
                hasActiveNotes = true;
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
                    
                    // 计算八度变化 - 修复了负数音高多下降一个八度的问题
                    let octaveChange = Math.floor((basePitchIndex + pitchOffset) / 12);
                    
                    // 获取新的音符
                    const rawNote = scale[newPitchIndex];
                    
                    // 将 C#, Eb 等格式转换为ABC记谱法中的 ^C, _E 等格式
                    if (rawNote.length > 1) {
                        const baseNoteName = rawNote.charAt(0);
                        const accidental = rawNote.charAt(1);
                        
                        if (accidental === '#') {
                            // 升号在ABC中用^表示
                            adjustedNote = '^' + baseNoteName;
                        } else if (accidental === 'b') {
                            // 降号在ABC中用_表示
                            adjustedNote = '_' + baseNoteName;
                        } else {
                            adjustedNote = baseNoteName;
                        }
                    } else {
                        adjustedNote = rawNote;
                    }
                    
                    // 计算新的八度
                    let newOctave = baseOctave + octaveChange;
                    
                    // ABC记谱法中表示八度的方式：
                    // - C 表示小字组（C4）
                    // - c 表示小字一组（C5）
                    // - C, 表示大字组（C3）
                    // - C,, 表示大字二组（C2）
                    // - c' 表示小字二组（C6）
                    
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
                
                // 检查是否需要添加跳音记号（持续时间小于50%）
                if (mainTrack.duration && mainTrack.duration[i] !== undefined && mainTrack.duration[i] < 0.5) {
                    // 在ABC记谱法中，添加句点(.)作为跳音记号
                    adjustedNote = "." + adjustedNote;
                }
                
                // 将调整后的音符添加到ABC记谱中
                abcNotes.push(adjustedNote);
            } else {
                // 休止符（非活跃步骤）
                abcNotes.push('z');
            }
        }
    }
    
    // 处理音符持续时间大于100%的情况 - 需要合并音符
    if (mainTrack && mainTrack.duration) {
        // 添加对mergedTo属性的检查
        const hasMergeData = mainTrack.mergedTo && Array.isArray(mainTrack.mergedTo);
        // 创建一个新的音符数组来存储处理后的结果
        let processedNotes = [];
        
        // 遍历所有音符
        for (let i = 0; i < abcNotes.length; i++) {
            // 如果有合并数据，且当前步骤被合并到其他步骤，则跳过
            if (hasMergeData && mainTrack.mergedTo[i] !== -1) {
                processedNotes.push('x'); // 临时占位符，稍后会被移除
                continue;
            }
            
            // 如果当前步骤有活跃音符
            if (abcNotes[i] !== 'z' && mainTrack.alpha && mainTrack.alpha[i] > 0.2) {
                // 检查持续时间是否大于1.0
                const duration = mainTrack.duration[i];
                
                if (duration > 1.0) {
                    // 获取当前音符
                    let note = abcNotes[i];
                    
                    // 计算音符的持续时间倍数
                    const wholeParts = Math.ceil(duration);
                    const fraction = duration - Math.floor(duration);
                    
                    // 在ABC记谱法中表示延长的音符
                    // 注意：确保跳音记号(.)保持在音符前面
                    if (wholeParts > 1) {
                        // 检查是否有跳音记号
                        if (note.startsWith('.')) {
                            // 跳音记号在音符的开头
                            note = '.' + note.substring(1) + wholeParts;
                        } else {
                            // 没有跳音记号
                            note = note + wholeParts;
                        }
                    }
                    
                    // 添加处理后的音符
                    processedNotes.push(note);
                } else {
                    // 持续时间正常，直接添加
                    processedNotes.push(abcNotes[i]);
                }
            } else {
                // 休止符或非活跃音符，直接添加
                processedNotes.push(abcNotes[i]);
            }
        }
        
        // 移除占位符x（被合并的步进）
        processedNotes = processedNotes.filter(note => note !== 'x');
        
        // 使用处理后的音符数组替换原始数组
        abcNotes = processedNotes;
    }
    
    // 如果没有活跃音符，生成一个比较有代表性的音符图案
    if (!hasActiveNotes) {
        // 生成一个根据当前步数和时值设计的基础音阶
        // 例如一个简单的C大调音阶模式
        abcNotes = generateDefaultMelody(stepCount, baseOctave);
    }
    
    // 生成ABC格式
    return formatToABC(abcNotes, circleData);
}

// 添加新函数：生成默认旋律模式
function generateDefaultMelody(steps, octave = 4) {
    // 创建一个全休止符的数组，确保步进器为空时五线谱也是空的
    const result = [];
    
    // 填充休止符
    for (let i = 0; i < steps; i++) {
        result.push('z');
    }
    
    return result;
}

// 格式化为ABC记谱法
function formatToABC(notes, circleData) {
    // 设置默认值
    let meter = "4/4";
    let key = "C";
    
    // 设置音符时值，根据步进器的RES设置
    let noteLength = "1/4"; // 默认为四分音符
    
    // 优先从circleData中获取分辨率
    if (circleData.resolution) {
        noteLength = circleData.resolution;

    } 
    // 然后尝试从metronome获取
    else if (window.metronome && window.metronome.resolution) {
        // 根据步进器的resolution设置音符时值
        noteLength = window.metronome.resolution;

    } 
    // 最后尝试从UI获取
    else if (window.ui && window.ui.resolution && window.ui.resolution.value) {
        // 如果无法直接从metronome获取，则尝试从UI获取
        noteLength = window.ui.resolution.value;

    }
    
    // 检查音符的音高范围，选择合适的谱号
    let clef = determineAppropriateClef(notes);
    
    // 生成ABC头部，添加谱号设置
    let abcHeader = `X:1
M:${meter}
L:${noteLength}
K:${key} clef=${clef}
`;
    
    // 获取步进器的steps数量
    let stepCount = 16; // 默认值
    if (circleData.stepCount) {
        stepCount = circleData.stepCount;
    } else if (window.ui && window.ui.stepCount) {
        stepCount = window.ui.stepCount;
    }
    
    // 检查是否有音符
    if (notes.length === 0 || notes.every(note => note === 'z')) {
        // 没有音符，返回空白乐谱
        return abcHeader + "|]";
    }
    
    // 确保音符数量不超过步进器设置的步数
    const validNotes = notes.slice(0, stepCount);
    
    // 处理音符时值和符杠连接
    let abcBody = '';
    
    // 调整符杠分组大小的逻辑，基于时值和步数
    let beamGroupSize = 4; // 默认每4个音符为一组
    
    // 根据时值和步数调整符杠分组
    if (noteLength === "1/16" || noteLength === "1/32") {
        if (stepCount % 4 === 0) {
            beamGroupSize = 4;
        } else if (stepCount % 3 === 0) {
            beamGroupSize = 3;
        } else if (stepCount % 2 === 0) {
            beamGroupSize = 2;
        }
        
        // 分组处理
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
    } else if (noteLength === "1/8") {
        // 对于八分音符，每两个音符分组
        beamGroupSize = 2;
        
        // 分组处理
        for (let i = 0; i < validNotes.length; i += beamGroupSize) {
            let group = validNotes.slice(i, Math.min(i + beamGroupSize, validNotes.length));
            if (group.some(note => note === 'z')) {
                abcBody += group.join(" ");
            } else {
                abcBody += group.join("");
            }
            
            if (i + beamGroupSize < validNotes.length) {
                abcBody += " ";
            }
        }
    } else {
        // 对于较大的时值（四分音符及以上），每个音符单独
        abcBody = validNotes.join(" ");
    }
    
    // 添加结束小节线
    abcBody += " |]";
    
    // 生成完整的ABC格式
    const fullAbc = abcHeader + abcBody;

    
    return fullAbc;
}

// 添加新函数：根据音符数组确定最合适的谱号
function determineAppropriateClef(notes) {
    // 跳过休止符
    const actualNotes = notes.filter(note => note !== 'z' && note !== 'x');
    
    // 如果没有实际音符，默认使用高音谱号
    if (actualNotes.length === 0) {
        return "treble";
    }
    
    // 计算音符的平均音高，为此需要将ABC记谱法转换为数值
    let lowestNote = Infinity;
    let highestNote = -Infinity;
    let sum = 0;
    let count = 0;
    
    for (let note of actualNotes) {
        // 忽略可能的跳音记号（以.开头）
        if (note.startsWith('.')) {
            note = note.substring(1);
        }
        
        // 忽略可能的持续时间标记（数字后缀）
        note = note.replace(/\d+$/, '');
        
        // 获取音符的音高值
        const pitchValue = getAbcNotePitchValue(note);
        
        if (pitchValue !== null) {
            if (pitchValue < lowestNote) lowestNote = pitchValue;
            if (pitchValue > highestNote) highestNote = pitchValue;
            sum += pitchValue;
            count++;
        }
    }
    
    // 如果没有有效的音高值，默认使用高音谱号
    if (count === 0) {
        return "treble";
    }
    
    // 计算平均音高
    const averagePitch = sum / count;
    
    // 根据音高范围和平均值决定使用哪种谱号
    // 高音谱号中央C是第一加线，值为0
    // 低音谱号中央C是第一加线，值为0
    
    // 如果最低音符低于高音谱号下加3线(E3)，考虑使用低音谱号
    if (lowestNote < -4) {
        // 但如果最高音符高于低音谱号上加3线(A4)，则需要权衡
        if (highestNote > 10) {
            // 根据平均音高决定
            return averagePitch < 3 ? "bass" : "treble";
        }
        return "bass"; // 最高音符不太高，使用低音谱号
    }
    
    // 如果最高音符高于高音谱号上加3线(A5)，使用高音谱号
    if (highestNote > 14) {
        return "treble";
    }
    
    // 默认使用高音谱号
    return "treble";
}

// 添加新函数：获取ABC音符记号对应的音高值
function getAbcNotePitchValue(note) {
    // 如果是休止符，返回null
    if (note === 'z') {
        return null;
    }
    
    // 基准是中央C (C4)，在高音谱号中是第一下加线，值为0
    
    // 分析音符字符
    let pitch = 0;
    let currentChar = 0;
    
    // 检查是否有升降记号
    if (note[currentChar] === '^') {
        pitch += 1;
        currentChar++;
    } else if (note[currentChar] === '_') {
        pitch -= 1;
        currentChar++;
    } else if (note[currentChar] === '=') {
        currentChar++;
    }
    
    // 获取音符基本名称
    const noteName = note[currentChar].toUpperCase();
    currentChar++;
    
    // 将音符名称转换为相对中央C的半音数
    // C D E F G A B
    // 0 2 4 5 7 9 11
    const baseValues = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11};
    
    if (baseValues[noteName] === undefined) {
        return null; // 无效的音符名
    }
    
    pitch += baseValues[noteName];
    
    // 处理八度
    // 大写字母代表小字组（C4-B4），值从0开始
    // 小写字母代表小字一组（C5-B5），值从12开始
    // 大写加逗号代表大字组（C3-B3），值从-12开始
    // 小写加单引号代表小字二组（C6-B6），值从24开始
    
    if (note[currentChar - 1] >= 'a' && note[currentChar - 1] <= 'g') {
        // 小写字母，高一个八度
        pitch += 12;
    }
    
    // 计算八度变化
    let octaveChange = 0;
    
    // 计算逗号的数量（低八度）
    while (currentChar < note.length && note[currentChar] === ',') {
        octaveChange--;
        currentChar++;
    }
    
    // 计算单引号的数量（高八度）
    while (currentChar < note.length && note[currentChar] === "'") {
        octaveChange++;
        currentChar++;
    }
    
    // 应用八度变化
    pitch += octaveChange * 12;
    
    return pitch;
}

// 修改getDefaultScale函数，支持根据情况设置谱号
function getDefaultScale() {
    // 设置默认时值为四分音符
    let noteLength = "1/4";
    
    // 尝试获取步进器的时值设置
    if (window.metronome && window.metronome.resolution) {
        noteLength = window.metronome.resolution;
    } else if (window.ui && window.ui.resolution && window.ui.resolution.value) {
        noteLength = window.ui.resolution.value;
    }
    
    // 获取当前步数设置
    let stepCount = 16;
    if (window.ui && window.ui.stepCount) {
        stepCount = window.ui.stepCount;
    }
    
    // 创建一组休止符
    let restNotation = "";
    
    // 根据不同的时值设置不同数量的休止符
    if (noteLength === "1/4") {
        // 四分音符的情况下，一个4/4小节需要4个休止符
        restNotation = "z z z z";
    } else if (noteLength === "1/8") {
        // 八分音符的情况下，一个4/4小节需要8个休止符
        restNotation = "z z z z z z z z";
    } else if (noteLength === "1/16") {
        // 十六分音符的情况下，一个4/4小节需要16个休止符
        // 为了可读性，每4个分一组
        restNotation = "z z z z z z z z z z z z z z z z";
    } else if (noteLength === "1/32") {
        // 三十二分音符的情况下，一个4/4小节需要32个休止符
        // 为了可读性，每8个分一组
        restNotation = "z z z z z z z z z z z z z z z z z z z z z z z z z z z z z z z z";
    }
    
    // 当没有音符时，根据默认的八度设置谱号
    // 获取八度设置
    let defaultOctave = 4; // 默认C4
    
    // 尝试从基础音高获取八度
    if (window.metronome && window.metronome.baseNotes) {
        const baseNote = window.metronome.baseNotes[0] || 'C4';
        const match = baseNote.match(/([A-G][#b]?)(\d+)/);
        defaultOctave = match ? parseInt(match[2]) : 4;
    }
    
    // 根据默认八度选择谱号
    let clef = defaultOctave < 4 ? "bass" : "treble";
    
    // 返回空白乐谱，只包含休止符
    return `X:1
M:4/4
L:${noteLength}
K:C clef=${clef}
${restNotation} |]`;
}

// 高亮当前演奏的音符
function highlightCurrentNote(beatData) {
    // 这个功能需要扩展ABCJS库的功能，
    // 但我们可以通过CSS添加闪烁效果
    
    // 在未来的版本中实现

}

// 页面加载完成后，自动开始监听
document.addEventListener('DOMContentLoaded', function() {
    // 确保ABCJS库已加载
    if (typeof window.abcjs !== 'undefined') {
        window.circleToABC.startAutoSync();
    } else {
        // 等待ABCJS库加载完成
        const checkInterval = setInterval(function() {
            if (typeof window.abcjs !== 'undefined') {
                clearInterval(checkInterval);
                window.circleToABC.startAutoSync();
            }
        }, 500);
        
        // 如果10秒后仍未加载，发出警告
        setTimeout(function() {
            if (typeof window.abcjs === 'undefined') {
                clearInterval(checkInterval);
                console.error("CircleToABC: ABCJS库未加载，无法启动自动同步");
            }
        }, 10000);
    }
}); 