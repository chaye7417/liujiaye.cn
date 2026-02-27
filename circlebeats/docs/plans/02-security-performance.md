# 安全加固 + 性能优化

**优先级**：第 1 批（P0 紧急）
**关联文档**：[总览](./00-overview.md)

---

## P0-1：API Key 后端化

**问题**：`AIImageGenerator.js:8` 中 Stability AI 的 API Key (`sk-yDcJ...`) 硬编码在前端，任何人可通过浏览器开发者工具获取。

**方案**：
- 在服务器上创建一个代理端点（如 `https://liujiaye.cn/api/stability`）
- 前端请求该端点，服务器端转发到 Stability AI API
- 可选方案：Cloudflare Worker / Nginx 反向代理 + 环境变量

**改动文件**：
- `AIImageGenerator.js` — 将 API 请求 URL 改为自己的后端端点
- `cat-ai-image-generator.js` — 同上
- 服务器端新增代理路由

**预计工作量**：1-2 小时

---

## P0-2：Three.js 帧率控制（30FPS 上限）

**问题**：`three-scene.js:1645` 的 `animate()` 以最高帧率运行（60-120FPS），每帧都执行 Bloom + Bokeh 后处理。3D 背景作为装饰不需要高帧率。

**方案**：时间间隔跳帧

```javascript
// three-scene.js 修改
const targetFPS = 30;
const frameInterval = 1000 / targetFPS;
let lastFrameTime = 0;

function animate(currentTime) {
    if (!isRendering) return;
    requestAnimationFrame(animate);

    const delta = currentTime - lastFrameTime;
    if (delta < frameInterval) return;
    lastFrameTime = currentTime - (delta % frameInterval);

    const time = clock.getElapsedTime();

    // ... 原有渲染逻辑不变 ...
    composer.render();
}
```

**改动文件**：`three-scene.js`（约 10 行改动）

**效果**：GPU 负载降低约 50%，电池续航显著改善

---

## P0-3：环境反射更新降频

**问题**：`three-scene.js:1650` 的 `updateSceneEnvironment()` 调用 `pmremGenerator.fromScene(scene)` — 这会渲染整个场景生成环境贴图，非常昂贵。当前触发条件 `Math.floor(time * 2) % 10 === 0` 会在连续多帧触发（因为条件在 0.5 秒窗口内持续为 true）。

**方案**：改用独立时间戳控制，每 5 秒最多更新一次

```javascript
let lastEnvUpdateTime = 0;
const ENV_UPDATE_INTERVAL = 5; // 秒

// 在 animate() 中替换原来的环境更新逻辑
if (time - lastEnvUpdateTime > ENV_UPDATE_INTERVAL) {
    updateSceneEnvironment();
    lastEnvUpdateTime = time;
}
```

**改动文件**：`three-scene.js`（约 5 行改动）

**效果**：每 5 秒只执行 1 次环境贴图生成（原来可能每秒 30+ 次）

---

## P1-4：floor.jpg 压缩（5.7MB → ~500KB）

**问题**：地板贴图 `floor.jpg` 5.7MB，是整个项目最大的单个文件。

**方案**：
- 转换为 WebP 格式（有损压缩，质量 80%）
- 或使用 ImageOptim / squoosh 压缩 JPEG
- 目标大小：< 500KB

```bash
# 使用 cwebp 压缩
cwebp -q 80 floor.jpg -o floor.webp

# 或使用 sips (macOS 内置)
sips -s format jpeg -s formatOptions 60 floor.jpg --out floor_compressed.jpg
```

**改动文件**：
- `three-scene.js:1748` — 更新 `floorTextureLoader.load()` 的文件路径
- 替换 `floor.jpg` 为压缩后的文件

**效果**：首次加载减少 5MB+
