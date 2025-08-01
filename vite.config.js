import {defineConfig} from 'vite'
import {svelte} from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        tailwindcss(),
        svelte()
    ],
    server: {
        proxy: {
            '/api': {
                target: 'https://spektrix.musicacademy.org/musicacademywest',
                changeOrigin: true,
                secure: true,
                cookieDomainRewrite: '',
                cookiePathRewrite: '/',
                configure: (proxy, options) => {
                    proxy.on('proxyReq', (proxyReq, req, res) => {
                        // Forward cookies from the client
                        if (req.headers.cookie) {
                            proxyReq.setHeader('Cookie', req.headers.cookie);
                        }
                    });

                    proxy.on('proxyRes', (proxyRes, req, res) => {
                        // Forward Set-Cookie headers back to the client
                        if (proxyRes.headers['set-cookie']) {
                            res.setHeader('Set-Cookie', proxyRes.headers['set-cookie']);
                        }
                    });
                },
                rewrite: (path) => path.replace(/^\/api/, '/api')
            }
        }
    }
})
