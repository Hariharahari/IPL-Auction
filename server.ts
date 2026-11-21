import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { setupSocketHandler } from './src/server/socketHandler';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '7860', 10);
const hostname = '0.0.0.0';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
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

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`> IPL Auction Server live at http://0.0.0.0:${port}`);
  });
});
