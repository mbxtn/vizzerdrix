# Vizzerdrix - Multiplayer Card Game

A web-based multiplayer card game built with Node.js, Socket.IO, and Vite.

## Prerequisites

- Node.js v22.19.0 or later (managed with nvm)
- npm v10.9.3 or later

## Setup

1. **Navigate to the project directory:**
   ```bash
   cd multiplayer/
   ```

2. **Install dependencies:**
   ```bash
   nvm use 22.19.0
   npm install
   ```

## Development

### Running in Development Mode

For development, you need to run both the Express server and Vite dev server:

```bash
# Terminal 1: Start Express server (port 3001)
nvm use 22.19.0 && npm start

# Terminal 2: Start Vite dev server (port 3000)
nvm use 22.19.0 && npm run dev
```

- **Game URL**: http://localhost:3000

### Available Development Commands

```bash
# Build Tailwind CSS
npm run build-css

# Watch Tailwind CSS for changes
npm run watch-css

# Start Express server only
npm start

# Start Vite dev server only
npm run dev
```

## Production

### Building for Production

```bash
# Build everything (CSS + JS + copy assets)
nvm use 22.19.0 && npm run build:full
```

### Running in Production

```bash
# Start production server (port 3001)
nvm use 22.19.0 && npm run start:prod
```

- **Game URL**: http://localhost:3001

### One-Command Deployment

```bash
# Build and start production server
nvm use 22.19.0 && npm run deploy
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build frontend only |
| `npm run build-css` | Build Tailwind CSS |
| `npm run build:full` | Build CSS + frontend + copy assets |
| `npm run copy-assets` | Copy static assets to dist/ |
| `npm start` | Start Express server (development) |
| `npm run start:prod` | Start Express server (production) |
| `npm run deploy` | Build and start production |
| `npm run preview` | Preview production build |

## Project Structure

```
multiplayer/
├── public/              # Source files for frontend
│   ├── client.js       # Main client-side JavaScript
│   ├── index.html      # Main HTML file
│   ├── icons/          # SVG icons
│   ├── lib/            # JavaScript libraries
│   └── *.css           # Stylesheets
├── dist/               # Built production files
├── src/
│   └── input.css       # Tailwind CSS source
├── server.js           # Express + Socket.IO server
├── package.json        # Dependencies and scripts
└── vite.config.js      # Vite configuration
```

## Deployment

This project is ready for deployment to any Node.js hosting platform:

1. **Build the project:**
   ```bash
   npm run build:full
   ```

2. **Set environment variable:**
   ```bash
   export NODE_ENV=production
   ```

3. **Start the server:**
   ```bash
   node server.js
   ```

The server will automatically serve the built static files from the `dist/` directory in production mode.

## Troubleshooting

### Node.js Version Issues
Always use Node.js v22.19.0:
```bash
nvm use 22.19.0
```

### Development Server Issues
Make sure both servers are running:
- Express server on port 3001
- Vite dev server on port 3000
