import express from "express";
import cors from "cors";
import { createProxyMiddleware as proxy } from "http-proxy-middleware";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Default single-targets (optional)
const RPC_TARGET = process.env.RPC_TARGET || ""; // e.g. https://<hub>.up.railway.app/
const SSE_TARGET = process.env.SSE_TARGET || "https://docs.mcp.cloudflare.com/sse";

// Named upstreams (fan-in). Example value:
// UPSTREAMS_JSON={"cf-docs":{"sse":"https://docs.mcp.cloudflare.com/sse"},
//                 "railway":{"sse":"https://mcp-stub-server-production.up.railway.app/sse"},
//                 "hub":{"rpc":"https://<hub>.up.railway.app/"}}
let UPSTREAMS = {};
try { UPSTREAMS = JSON.parse(process.env.UPSTREAMS_JSON || "{}"); } catch { UPSTREAMS = {}; }

// Helpers
const mkRpcProxy = (target) => proxy({
  target, changeOrigin: true, pathRewrite: { "^/rpc": "" },
  onProxyReq: p => {
    p.setHeader("Accept","application/json, text/event-stream");
    p.setHeader("Content-Type","application/json");
  }
});
const mkSseProxy = (target) => proxy({
  target, changeOrigin: true, pathRewrite: { "^/sse": "" },
  headers: { "Accept": "text/event-stream" }
});

// Defaults (optional)
if (RPC_TARGET) app.use("/rpc", mkRpcProxy(RPC_TARGET));
if (SSE_TARGET) app.use("/sse/cf-docs", mkSseProxy(SSE_TARGET)); // keep route name stable

// Named routes: /rpc/:name and /sse/:name
for (const [name, cfg] of Object.entries(UPSTREAMS)) {
  if (cfg.rpc) app.use(`/rpc/${name}`, proxy({
    target: cfg.rpc, changeOrigin: true, pathRewrite: { [`^/rpc/${name}`]: "" },
    onProxyReq: p => {
      p.setHeader("Accept","application/json, text/event-stream");
      p.setHeader("Content-Type","application/json");
    }
  }));
  if (cfg.sse) app.use(`/sse/${name}`, proxy({
    target: cfg.sse, changeOrigin: true, pathRewrite: { [`^/sse/${name}`]: "" },
    headers: { "Accept": "text/event-stream" }
  }));
}

// Health
app.get("/healthz", (_req,res) =>
  res.json({
    ok: true,
    defaults: { RPC_TARGET: !!RPC_TARGET, SSE_TARGET },
    upstreams: Object.keys(UPSTREAMS)
  })
);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Bridge up on :" + PORT));
