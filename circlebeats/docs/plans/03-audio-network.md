# 音频优化 + 网络优化

**优先级**：第 2 批（P1 重要）
**关联文档**：[总览](./00-overview.md)

---

## P1-5：网络同步加防抖（100ms）

**问题**：`partySyncColyseus.js` 中，拖拽 ADSR 参数、滤波器频率等操作会在每次 mousemove 时触发 WebSocket 发送，产生大量网络消息。

**方案**：对频繁变化的参数使用防抖/节流

```javascript
// 通用节流函数
function throttle(fn, delay) {
    let lastCall = 0;
    let timer = null;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            fn.apply(this, args);
        } else if (!timer) {
            timer = setTimeout(() => {
                lastCall = Date.now();
                timer = null;
                fn.apply(this, args);
            }, delay - (now - lastCall));
        }
    };
}

// 使用：包装同步函数
const throttledSyncSynthParams = throttle(syncSynthParamsToServer, 100);
const throttledSyncBpm = throttle(syncBpmToServer, 200);
```

**改动文件**：`partySyncColyseus.js` + `synthParamsSync.js`

**效果**：WebSocket 消息量减少 80-90%，网络负载显著降低

**前置条件**：需要先完成 [05-colyseus-server.md](./05-colyseus-server.md) 中的服务端实现，否则无法测试。

---

## P1-6：PolySynth 懒加载

**问题**：`audio-sequencer.js` 启动时创建 8 个 `Tone.PolySynth` 实例，但用户通常只使用 1-2 个插槽。每个 PolySynth 在 Web Audio 图中持续占用资源。

**方案**：按需创建 PolySynth

```javascript
// 原来：启动时全部创建
// this.presetSounds = Array(8).fill(null).map(() => new Tone.PolySynth(...));

// 改为：懒加载
this.presetSounds = Array(8).fill(null);

getOrCreateSynth(slotIndex) {
    if (!this.presetSounds[slotIndex]) {
        this.presetSounds[slotIndex] = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 8 });
        // 应用该 slot 的参数
        this.applySynthParams(slotIndex);
    }
    return this.presetSounds[slotIndex];
}
```

**改动文件**：`audio-sequencer.js`（多处引用 `presetSounds[i]` 的地方需要改为 `getOrCreateSynth(i)`）

**效果**：启动时 Web Audio 图节点减少 75%（只创建当前使用的）
