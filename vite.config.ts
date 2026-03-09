import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const usePolling =
    process.env.VITE_USE_POLLING === 'true' ||
    process.env.CHOKIDAR_USEPOLLING === 'true'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@/components': path.resolve(__dirname, './src/components'),
            '@/lib': path.resolve(__dirname, './src/lib'),
            '@/assets': path.resolve(__dirname, './src/assets'),
        },
    },
    server: {
        port: 3000,
        open: true,
        watch: {
            usePolling,
            interval: 300,
            ignored: ['**/.git/**', '**/dist/**', '**/node_modules/**'],
        },
    },
})
