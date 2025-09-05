import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // NUCLEAR OPTION: Force file updates and disable caching
    force: true,
    hmr: {
      overlay: true,
    },
    // Aggressive cache busting
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    // Force file serving
    fs: {
      strict: false,
      allow: ['..']
    }
  },
  // Disable caching in development
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Force clear cache on restart
  clearScreen: false,
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
