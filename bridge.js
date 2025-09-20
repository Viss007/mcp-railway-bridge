import express from "express";
import cors from "cors";
import { createProxyMiddleware as proxy } from "http-proxy-middleware";

const app = express();
app.use(cors());
app.use(express.json());

const RPC_TARGET = process.env.RPC_TARGET || "";
const SSE_TARGET = process.env.SSE_TARGET || "https://docs.mcp.cloudflare.com/sse";

if (RPC_TARGET) app.use("/rpc", proxy({
  target: RPC_TARGET, changeOrigin: true, pathRewrite: { "^/rpc": "" },
  onProxyReq: p => { p.setHeader("Accept","application/json, text/event-stream"); p.setHeader("Content-Type","application/json"); }
}));

app.use("/sse/cf-docs", proxy({
  target: SSE_TARGET, changeOrigin: true, pathRewrite: { "^/sse/cf-docs": "" },
  headers: { "Accept": "text/event-stream" }
}));

app.get("/healthz", (_req,res) => res.json({ ok: true, rpc: !!RPC_TARGET, sse: SSE_TARGET }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Bridge up on :" + PORT));
