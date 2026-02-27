/**
 * AudioKeyboard.js - 键盘交互处理
 *
 * 处理键盘按键到音符的映射和触发。
 * 这些方法会通过 index.js 混入到 AudioSequencer.prototype 上。
 */

/**
 * 设置键盘事件监听。
 */
export function setupKeyboardEvents() {
  // 键盘按下事件
  document.addEventListener('keydown', (event) => {
    // 获取按键对应的小写字符
    const key = event.key.toLowerCase();

    // 如果这个键已经被按下了，则忽略
    if (this.keysPressed[key]) return;

    // 标记按键为已按下
    this.keysPressed[key] = true;

    // 处理八度调整键 - Z下移，X上移
    if (key === 'z') {
      this.octaveOffset = Math.max(this.octaveOffset - 1, -2); // 限制最小偏移为-2个八度
      return;
    } else if (key === 'x') {
      this.octaveOffset = Math.min(this.octaveOffset + 1, 2); // 限制最大偏移为+2个八度
      return;
    }

    // 检查是否是映射中的音符按键
    if (this.keyboardMap[key]) {
      // 添加到活跃键列表
      this.keyboardPlayState.activeKeys.push(key);

      // 播放最新按下的音符
      this.playNoteByKeyboard(this.keyboardMap[key]);

      // 阻止默认行为，防止页面滚动等
      event.preventDefault();
    }
  });

  // 键盘释放事件
  document.addEventListener('keyup', (event) => {
    // 获取按键对应的小写字符
    const key = event.key.toLowerCase();

    // 如果键未被按下，直接返回
    if (!this.keysPressed[key]) return;

    // 标记按键为已释放
    this.keysPressed[key] = false;

    // 处理Z/X键释放
    if (key === 'z' || key === 'x') {
      return;
    }

    // 如果是映射中的音符按键
    if (this.keyboardMap[key]) {
      // 从活跃键列表中移除
      const index = this.keyboardPlayState.activeKeys.indexOf(key);
      if (index !== -1) {
        this.keyboardPlayState.activeKeys.splice(index, 1);
      }

      // 检查是否还有其他音符键被按下
      if (this.keyboardPlayState.activeKeys.length === 0) {
        // 没有活跃键，停止演奏
        this.releaseNoteByKeyboard(this.keyboardMap[key]);
      } else {
        // 还有其他键被按下，切换到最后一个活跃键的音符
        const lastKey = this.keyboardPlayState.activeKeys[this.keyboardPlayState.activeKeys.length - 1];
        this.playNoteByKeyboard(this.keyboardMap[lastKey]);
      }

      // 阻止默认行为
      event.preventDefault();
    }
  });

  // 窗口失焦时，释放所有按键
  window.addEventListener('blur', () => {
    // 清空活跃键列表
    this.keyboardPlayState.activeKeys = [];

    // 如果有音符在演奏，停止它
    if (this.keyboardPlayState.isPlaying && this.keyboardPlayState.lastPlayedNote) {
      this.releaseNoteByKeyboard(this.keyboardPlayState.lastPlayedNote);
      this.keyboardPlayState.isPlaying = false;
      this.keyboardPlayState.lastPlayedNote = null;
    }

    // 清空所有按键状态
    for (const key in this.keysPressed) {
      this.keysPressed[key] = false;
    }

    // 重置八度偏移
    this.octaveOffset = 0;
  });
}

/**
 * 使用键盘触发音符。
 */
export function playNoteByKeyboard(noteName) {
  // 确保音频系统已初始化
  if (!this.audioInitialized || typeof Tone === 'undefined') {
    console.warn("音频系统未初始化，无法播放键盘音符");
    return;
  }

  try {
    // 获取当前选中的合成器插槽
    const currentSlot = this.synthUI.currentSlot;

    // 确保合成器对象存在（懒加载：首次使用时创建）
    const synth = this.getOrCreateSynth(currentSlot);
    if (synth) {
      // 应用八度偏移调整音符
      let adjustedNote;
      if (this.octaveOffset !== 0) {
        // 使用Tone.js的Frequency API进行音符转换
        adjustedNote = Tone.Frequency(noteName).transpose(this.octaveOffset * 12).toNote();
      } else {
        adjustedNote = noteName;
      }

      // 更新最后演奏的音符
      this.keyboardPlayState.lastPlayedNote = adjustedNote;

      // 尝试启动音频上下文（如果尚未启动）
      if (Tone.context.state !== 'running') {
        Tone.start().then(() => {

          // 上下文启动后立即播放音符
          synth.triggerAttack(adjustedNote, Tone.now());
          this.keyboardPlayState.isPlaying = true;
        }).catch(e => {
          console.warn("键盘触发启动音频上下文失败:", e);
        });
      } else {
        // 音频上下文已经运行，直接播放音符
        // 如果已经有音符演奏中，不需要重新触发attack，只需要设置频率
        if (this.keyboardPlayState.isPlaying) {
          // 使用setNote方法而不是triggerAttack，避免包络重新触发
          if (typeof synth.setNote === 'function') {
            synth.setNote(adjustedNote, Tone.now());
          } else {
            // 如果没有setNote方法，则先释放再重新触发
            synth.triggerRelease("+0.01");
            synth.triggerAttack(adjustedNote, "+0.02");
          }
        } else {
          // 第一次触发音符
          synth.triggerAttack(adjustedNote, Tone.now());
          this.keyboardPlayState.isPlaying = true;
        }

        // 如果有可视化效果，可以添加闪烁
        if (typeof window.flashSphere === 'function') {
          window.flashSphere(currentSlot);
        }

        // 点亮小球
        if (typeof window.activateSphere === 'function') {
          window.activateSphere(currentSlot, true);
        }


      }
    } else {
      console.warn("找不到合成器对象，无法演奏键盘音符");
    }
  } catch (e) {
    console.warn("键盘触发音符失败:", e);
  }
}

/**
 * 释放键盘触发的音符。
 */
export function releaseNoteByKeyboard(noteName) {
  // 确保音频系统已初始化
  if (!this.audioInitialized || typeof Tone === 'undefined') {
    return;
  }

  try {
    // 获取当前选中的合成器插槽
    const currentSlot = this.synthUI.currentSlot;

    // 确保合成器对象存在（释放时不需要懒创建）
    const synth = this.presetSounds[currentSlot];
    if (synth) {
      // 应用与播放时相同的八度偏移
      let adjustedNote;
      if (this.octaveOffset !== 0) {
        // 使用Tone.js的Frequency API进行音符转换
        adjustedNote = Tone.Frequency(noteName).transpose(this.octaveOffset * 12).toNote();
      } else {
        adjustedNote = noteName;
      }

      // 重置演奏状态
      this.keyboardPlayState.isPlaying = false;
      this.keyboardPlayState.lastPlayedNote = null;

      // 释放音符
      synth.triggerRelease(Tone.now());


      // 熄灭小球 - 调用Three.js场景中的函数将球体设为非激活状态
      if (typeof window.activateSphere === 'function') {
        window.activateSphere(currentSlot, false);

      }
    }
  } catch (e) {
    console.warn("键盘释放音符失败:", e);
  }
}
