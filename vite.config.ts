import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), {
        // On Vercel the page is served by api/page.js (adds text for Google), so the built
        // page must not be called index.html — otherwise "/" would skip the function.
        name: 'rename-index-html',
        apply: 'build',
        closeBundle() {
          const from = path.resolve(__dirname, 'dist/index.html');
          if (fs.existsSync(from)) fs.renameSync(from, path.resolve(__dirname, 'dist/app.html'));
        },
      }],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY ?? ''),
        'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY ?? ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
