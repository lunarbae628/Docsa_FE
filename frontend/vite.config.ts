import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
import tailwindcss from '@tailwindcss/vite'
import path from "path"

const backendApiTarget = process.env.VITE_BACKEND_API || "http://localhost:8080"
const backendApiOrigin = new URL(backendApiTarget).origin

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: backendApiOrigin,
        changeOrigin: true,
        secure: backendApiOrigin.startsWith("https://"),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔄 Proxy request:', req.method, req.url, '-> ', proxyReq.path);
            
            // 문제가 될 수 있는 브라우저 헤더들 제거
            proxyReq.removeHeader('sec-fetch-site');
            proxyReq.removeHeader('sec-fetch-mode');
            proxyReq.removeHeader('sec-fetch-dest');
            proxyReq.removeHeader('sec-ch-ua');
            proxyReq.removeHeader('sec-ch-ua-mobile');
            proxyReq.removeHeader('sec-ch-ua-platform');
            
            // Origin 헤더를 서버 주소로 변경
            proxyReq.setHeader('origin', backendApiOrigin);
            proxyReq.removeHeader('referer');
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('📥 Proxy response:', proxyRes.statusCode, req.url);
            console.log('📥 Proxy response:', proxyRes);

            // Set-Cookie 헤더 수정
            const setCookieHeaders = proxyRes.headers['set-cookie'];
            if (setCookieHeaders) {
              proxyRes.headers['set-cookie'] = setCookieHeaders.map(cookie => {
                // Domain을 localhost로 변경하고 중복 제거
                return cookie
                  .replace(/Domain=\.?(docsa\.kro\.kr|docsa\.o-r\.kr)/gi, 'Domain=localhost')
                  .replace(/;\s*Domain=localhost;\s*Domain=localhost/gi, '; Domain=localhost') // 중복 제거
                  .replace(/;\s*Secure/gi, '') // 개발 환경에서는 Secure 제거
                  .replace(/;\s*SameSite=None/gi, '; SameSite=Lax'); // SameSite 변경
              });

              console.log('🍪 Modified cookies:', proxyRes.headers['set-cookie']);
            }
          });
          proxy.on('error', (err, req, res) => {
            console.log('❌ Proxy error:', err.message);
          });
        },
      },
    },
  },
})
