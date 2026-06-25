import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import {
  assertValidProductionConfig,
  assertValidRequiredApiConfig,
} from './src/shared/config/productionConfigValidation';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isReleaseBuild = command === 'build' && mode === 'release';

  if (isReleaseBuild) {
    assertValidProductionConfig(env);
  } else {
    assertValidRequiredApiConfig(env);
  }

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
    },
  };
});
