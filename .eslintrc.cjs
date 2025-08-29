module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script',
  },
  settings: {
    node: {
      version: '>=16',
    },
  },
  plugins: ['n', 'promise', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:n/recommended',
    'plugin:promise/recommended',
    'plugin:prettier/recommended',
  ],
  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:promise/recommended',
        'plugin:prettier/recommended',
      ],
      rules: {
        'no-console': 'off',
        'no-process-exit': 'off',
        'n/no-process-exit': 'off',
        'n/shebang': 'off',
        'n/no-missing-import': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'off',
    'no-process-exit': 'off',
    'n/no-process-exit': 'off',
  },
};
