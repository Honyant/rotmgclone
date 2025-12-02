import { GameServer } from './network/GameServer.js';
import { GameDatabase } from './persistence/Database.js';
import * as fs from 'fs';

// Ensure data directory exists
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}

const PORT = parseInt(process.env.PORT || '8080');
const DB_PATH = process.env.DB_PATH || './data/game.db';

async function main() {
  console.log('Initializing database...');
  const database = new GameDatabase(DB_PATH);
  await database.init();

  console.log('Starting game server...');
  const server = new GameServer(PORT, database);
  server.start();

  console.log(`RotMG Clone Server running on port ${PORT}`);

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down...');
    server.stop();
    database.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
