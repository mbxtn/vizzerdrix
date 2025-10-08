import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventHandler } from './gameserver.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Enable CORS for development (can be removed in production)
app.use(cors());

// Serve Angular build files
const webClientPath = path.join(__dirname, '../web-client/dist/web-client/browser');
app.use(express.static(webClientPath));

// Socket.io setup - no CORS needed since serving from same origin
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for now, can be restricted in production
    methods: ["GET", "POST"]
  }
});

// Initialize the game event handler
const eventHandler = new EventHandler(io);

// Catch-all handler for Angular routing (must be last)
app.use((req, res) => {
  // Only serve index.html for GET requests to non-API routes
  if (req.method === 'GET') {
    res.sendFile(path.join(webClientPath, 'index.html'));
  } else {
    res.status(404).send('Not found');
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});