import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { setupSocketHandler } from './src/server/socketHandler';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '7860', 10);
const hostname = '0.0.0.0';

let isNextReady = false;
let nextPrepareError: Error | null = null;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpServer = createServer((req, res) => {
  // Fast health checks: always respond 200 immediately so Render router / health checks succeed
  if (req.url === '/health' || req.url === '/healthz' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', nextReady: isNextReady, uptime: process.uptime() }));
    return;
  }

  if (nextPrepareError) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Application initialization error: ${nextPrepareError.message}`);
    return;
  }

  if (!isNextReady) {
    // During cold start on Render free tier, serve an auto-refreshing warmup page instead of 502
    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '3' });
    res.end(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="3">
    <title>IPL Auction Arena Warming Up...</title>
    <style>
      body { background:#030712; color:#f8fafc; font-family:system-ui,-apple-system,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:20px; box-sizing:border-box; }
      .card { max-width:480px; width:100%; background:#0f172a; border:1px solid #1e293b; border-radius:16px; padding:32px; text-align:center; box-shadow:0 20px 25px -5px rgba(0,0,0,0.5); }
      .spinner { width:40px; height:40px; border:3px solid #1e293b; border-top-color:#f59e0b; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto 20px; }
      @keyframes spin { to { transform:rotate(360deg); } }
      h2 { color:#f59e0b; margin:0 0 10px; font-size:20px; font-weight:800; letter-spacing:0.5px; }
      p { color:#94a3b8; font-size:13px; line-height:1.6; margin:0; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="spinner"></div>
      <h2>IPL AUCTION ARENA WARMING UP</h2>
      <p>Initializing broadcast stadium and real-time socket cluster. This page will connect automatically in a few seconds...</p>
    </div>
  </body>
</html>`);
    return;
  }

  const parsedUrl = parse(req.url || '/', true);
  handle(req, res, parsedUrl);
});

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  path: '/socket.io',
});

setupSocketHandler(io);

process.on('unhandledRejection', (reason, promise) => {
  console.error('> Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('> Uncaught Exception thrown:', err);
});

// Listen immediately on 0.0.0.0 so Render detects an open port without 502 timeout
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`> IPL Auction Server listening on http://0.0.0.0:${port}`);
});

app.prepare()
  .then(() => {
    isNextReady = true;
    console.log(`> Next.js engine ready and handling requests on port ${port}`);
  })
  .catch((err) => {
    console.error('Fatal error preparing Next.js:', err);
    nextPrepareError = err;
  });

