/**
 * CircleBeats Stability AI Proxy Server
 *
 * 将前端请求转发到 Stability AI API，避免在前端暴露 API Key。
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
const STABILITY_BASE_URL = 'https://api.stability.ai';

if (!STABILITY_API_KEY) {
    console.error('STABILITY_API_KEY is not set. Please check your .env file.');
    process.exit(1);
}

app.use(cors());

// ---------- 健康检查 ----------
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

// ---------- POST /api/stability/sketch ----------
app.post('/api/stability/sketch', async (req, res) => {
    try {
        const body = await getRawBody(req);

        const upstreamRes = await fetch(`${STABILITY_BASE_URL}/v2beta/stable-image/control/sketch`, {
            method: 'POST',
            headers: buildHeaders(req),
            body,
        });

        await pipeResponse(upstreamRes, res);
    } catch (err) {
        handleError(err, res, 'sketch');
    }
});

// ---------- POST /api/stability/image-to-video ----------
app.post('/api/stability/image-to-video', async (req, res) => {
    try {
        const body = await getRawBody(req);

        const upstreamRes = await fetch(`${STABILITY_BASE_URL}/v2beta/image-to-video`, {
            method: 'POST',
            headers: buildHeaders(req),
            body,
        });

        await pipeResponse(upstreamRes, res);
    } catch (err) {
        handleError(err, res, 'image-to-video');
    }
});

// ---------- GET /api/stability/image-to-video/result/:id ----------
app.get('/api/stability/image-to-video/result/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const upstreamRes = await fetch(`${STABILITY_BASE_URL}/v2beta/image-to-video/result/${id}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${STABILITY_API_KEY}`,
                Accept: req.headers.accept || 'video/*',
            },
        });

        await pipeResponse(upstreamRes, res);
    } catch (err) {
        handleError(err, res, 'video-result');
    }
});

// ---------- Helpers ----------

/**
 * 构建发往 Stability AI 的请求头。
 * 保留前端发送的 Content-Type（含 boundary）和 Accept，注入 Authorization。
 */
function buildHeaders(req) {
    const headers = {
        Authorization: `Bearer ${STABILITY_API_KEY}`,
    };
    if (req.headers['content-type']) {
        headers['Content-Type'] = req.headers['content-type'];
    }
    if (req.headers.accept) {
        headers['Accept'] = req.headers.accept;
    }
    return headers;
}

/**
 * 读取原始请求体（不做任何解析），以便完整转发 multipart/form-data。
 */
function getRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

/**
 * 将上游响应的状态码、关键头和 body 透传给客户端。
 */
async function pipeResponse(upstreamRes, res) {
    res.status(upstreamRes.status);

    // 透传关键响应头
    const headersToForward = ['content-type', 'content-length', 'content-disposition'];
    for (const name of headersToForward) {
        const value = upstreamRes.headers.get(name);
        if (value) {
            res.setHeader(name, value);
        }
    }

    // 将上游 body 流式写入客户端响应
    const arrayBuffer = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
}

/**
 * 统一错误处理。
 */
function handleError(err, res, route) {
    console.error(`[proxy] ${route} error:`, err.message || err);
    if (!res.headersSent) {
        res.status(502).json({
            error: { message: `Proxy error on /${route}`, detail: err.message },
        });
    }
}

// ---------- Start ----------
app.listen(PORT, () => {
    console.log(`CircleBeats proxy server running on http://localhost:${PORT}`);
    console.log('Routes:');
    console.log('  POST /api/stability/sketch');
    console.log('  POST /api/stability/image-to-video');
    console.log('  GET  /api/stability/image-to-video/result/:id');
});
