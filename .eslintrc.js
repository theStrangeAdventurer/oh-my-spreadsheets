module.exports = {
    root: true,
  
    env: {
      es2021: true,
      node: true,
    },
  
    extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  
    ignorePatterns: [
      '__tests__',
      'dist',
      'node_modules',
      '.eslintrc.js',
      'commitlint.config.js',
      'jest.config.js',
    ],
  
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      tsconfigRootDir: __dirname,
      project: './tsconfig.json',
    },
  
    plugins: [
      '@typescript-eslint',
      'unused-imports',
      'simple-import-sort',
      'prettier',
    ],
  
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      "@typescript-eslint/no-floating-promises": "off",
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
  
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/ban-types': 'off',
  
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
  
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
  
      'no-return-await': 'off',
      '@typescript-eslint/return-await': ['error', 'always'],
  
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { disallowTypeAnnotations: false },
      ],
  
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  };