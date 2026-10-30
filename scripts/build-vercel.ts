/**
 * Produces .vercel/output (Vercel Build Output API v3):
 *   static/            the Vite SPA
 *   functions/api.func the Fastify API bundled into one ESM file
 *   config.json        routing: /api/* → function, files, then SPA fallback
 */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const OUT = '.vercel/output';
await rm(OUT, { recursive: true, force: true });
await mkdir(`${OUT}/functions/api.func`, { recursive: true });

await cp('dist', `${OUT}/static`, { recursive: true });

await build({
  entryPoints: ['src/server/vercel.ts'],
  outfile: `${OUT}/functions/api.func/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: 'linked',
  external: ['pg-native'],
  // Some bundled CommonJS dependencies call require(); give the ESM bundle one.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning',
});

await writeFile(
  `${OUT}/functions/api.func/.vc-config.json`,
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false }, null, 2),
);

await writeFile(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api/(.*)$', dest: '/api?__path=$1' },
        { handle: 'filesystem' },
        { src: '^/assets/(.*)$', status: 404 },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log(`wrote ${OUT}`);
