import express from 'express';
import cors from 'cors';
import { createProxyMiddleware as proxy } from 'http-proxy-middleware';

const RPC_TARGET = process.env.RPC_TARGET; // e.g., https://<tunnel>.trycloudflare.com/mcp/
const SSE_TARGET = process.env.SSE_TARGET; // e.g., https://<tunnel>.trycloudflare.com/sse

if (!RPC_TARGET) throw new Error('RPC_TARGET env required');
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true, rpc: RPC_TARGET, sse: SSE_TARGET || null }));

app.use('/rpc', proxy({
  target: RPC_TARGET,
  changeOrigin: true,
  pathRewrite: { '^/rpc': '' },
  onProxyReq: (pReq) => {
    pReq.setHeader('Accept', 'application/json, text/event-stream');
    pReq.setHeader('Content-Type', 'application/json');
  },
}));

if (SSE_TARGET) {
  app.use('/sse', proxy({
    target: SSE_TARGET,
    changeOrigin: true,
    pathRewrite: { '^/sse': '' },
    headers: { 'Accept': 'text/event-stream' },
  }));
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Bridge up on :' + PORT));
