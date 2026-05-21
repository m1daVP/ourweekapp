import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import vueTsEslintConfig from '@vue/eslint-config-typescript';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';

export default tseslint.config(
  {
    ignores: ['android/**', 'dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...vueTsEslintConfig(),
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  skipFormatting
);
