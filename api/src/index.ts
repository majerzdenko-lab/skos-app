import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { setupSocket } from './socket';

const app = createApp();
const server = http.createServer(app);
setupSocket(server);

const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => {
  console.log(`SKoS API listening on http://localhost:${PORT}`);
});
