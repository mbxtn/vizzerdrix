# Vizzerdrix Development Guide

## Development Mode (Hot Reloading)

For development with hot reloading on separate ports:

### Option 1: Manual (Two Terminals)
```bash
# Terminal 1: Start the game server
npx nx serve:dev server

# Terminal 2: Start the web client  
npx nx serve:dev react-client
```

### Option 2: Windows Batch Script
```bash
# Starts both servers in separate windows
./start-dev.bat
```

**Development URLs:**
- Web Client: http://localhost:4200 (with hot reloading) ← **Use this for the game**
- Game Server: http://localhost:3000 (WebSocket + API only) ← **API/WebSocket only**

> **Note**: In development mode, visit http://localhost:4200 for the game interface. The server at port 3000 only provides API and WebSocket services.

## Production Mode (Single Port)

For production deployment on single port:

```bash
# Build the web client
npx nx build react-client

# Start the production server (serves both static files and WebSocket)
npx nx serve server
```

**Production URL:**
- Everything: http://localhost:3000

## Key Differences

| Mode | Web Client | Game Server | Hot Reload | Ports | Use Case |
|------|------------|-------------|------------|-------|----------|
| Development | Angular Dev Server | Node.js API-only | ✅ Yes | 4200 + 3000 | Development |
| Production | Static Files | Node.js Full Stack | ❌ No | 3000 only | Deployment |

## Architecture

### Development Flow
```
Browser (4200) → Angular Dev Server (4200) 
                ↓ (WebSocket)
                Game Server (3000)
```

### Production Flow  
```
Browser (3000) → Node.js Server (3000)
                ├── Static Files (Angular)
                └── WebSocket (Socket.IO)
```