import { defineConfig } from 'vite'
import { resolve } from 'path'

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
    emptyOutDir: true,
    rollupOptions: {
      // Ensure external dependencies are handled correctly
      external: [],
      output: {
        // Better chunk splitting for production
        manualChunks: {
          vendor: ['socket.io-client', 'on-change']
        }
      }
    },
    // Copy assets that are referenced in HTML/CSS
    assetsInclude: ['**/*.png', '**/*.svg', '**/*.css'],
    // Copy additional static assets
    copyPublicDir: false // We'll handle this manually since we're in the public dir
  },
  // Ensure relative paths work correctly in production
  base: './',
  // Explicitly include assets that might be loaded dynamically
  assetsInclude: ['**/*.png', '**/*.svg', '**/*.jpg', '**/*.jpeg', '**/*.gif']
})
