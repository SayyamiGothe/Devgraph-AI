import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // The axios instance calls `/api/*` (see src/lib/axios.ts) and this proxy
      // rewrites it onto the FastAPI root, so `/api/auth/login` reaches
      // `POST /auth/login`. Going through the proxy also keeps the browser on
      // one origin, so the backend's CORS allow-list never comes into play.
      // Override the target with VITE_API_PROXY_TARGET when the API is elsewhere.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
}) 
