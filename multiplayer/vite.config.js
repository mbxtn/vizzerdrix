import { defineConfig } from 'vite'

export default defineConfig({
  root: 'public', // Set the root to the public directory
  server: {
    port: 3000,
    proxy: {
      // Proxy Socket.IO requests to your Express server
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../dist', // Output built files to dist in the parent directory
    emptyOutDir: true
  }
})
