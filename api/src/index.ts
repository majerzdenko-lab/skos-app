import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { setupSocket } from './socket';

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
  console.error('Set them in .env or your deployment environment before starting.');
  process.exit(1);
}

const app = createApp();
const server = http.createServer(app);
setupSocket(server);

const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => {
  console.log(`SKoS API listening on http://localhost:${PORT}`);
});
