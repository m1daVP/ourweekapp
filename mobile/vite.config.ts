import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import {
  assertValidProductionConfig,
  assertValidRequiredApiConfig,
} from './src/shared/config/productionConfigValidation';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isReleaseBuild = command === 'build' && mode === 'release';

  if (isReleaseBuild) {
    assertValidProductionConfig(env);
  } else {
    assertValidRequiredApiConfig(env);
  }

  const plugins = [
    vue(),
    ...(isReleaseBuild
      ? [
          sentryVitePlugin({
            authToken: process.env.SENTRY_AUTH_TOKEN,
            org: 'ourweek',
            project: 'ourweek',
            telemetry: false,
            sourcemaps: {
              filesToDeleteAfterUpload: ['./dist/**/*.js.map'],
            },
          }),
        ]
      : []),
  ];

  return {
    build: {
      // Release builds use 'hidden' maps: generated for Sentry upload
      // (then deleted before packaging) but never referenced from the JS.
      sourcemap: isReleaseBuild ? 'hidden' : true,
    },
    define: {
      __APP_VERSION__: JSON.stringify(
        process.env.npm_package_version ?? '0.0.0'
      ),
    },
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3007,
    },
  };
});
