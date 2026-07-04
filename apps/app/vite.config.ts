import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const isPortable = mode === 'portable';

  return {
    base: './', // относительные пути — статический хостинг и file://
    root: __dirname,
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
    resolve: {
      alias: {
        '@poker/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      },
    },
    build: {
      outDir: isPortable ? 'dist-portable' : 'dist',
      emptyOutDir: true,
      target: 'es2020',
      ...(isPortable
        ? {
            modulePreload: false,
            cssCodeSplit: false,
            rollupOptions: {
              output: {
                format: 'iife',
                name: 'PokerTrainer',
                inlineDynamicImports: true,
                entryFileNames: 'assets/app.js',
              },
            },
          }
        : {}),
    },
    plugins: isPortable
      ? [
          {
            name: 'portable-html',
            transformIndexHtml(html) {
              return html
                .replace(/type="module"\s*/g, '')
                .replace(/\s*crossorigin/g, '')
                .replace(
                  /<script src="\.\/assets\/app\.js"><\/script>\s*/,
                  '',
                )
                .replace('</body>', '    <script src="./assets/app.js"></script>\n  </body>');
            },
          },
        ]
      : [],
  };
});
