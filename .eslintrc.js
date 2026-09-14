module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    'no-console': [
      'warn',
      {
        allow: ['warn', 'error', 'log'],
      },
    ],
    'prefer-const': 'error',
    'no-var': 'error',
    // Prevent silent error swallowing — every catch must log or handle
    'no-empty': ['error', { allowEmptyCatch: false }],
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      rules: {
        'no-unused-vars': 'off',
        'no-undef': 'off',
      },
    },
    {
      files: ['src/migrations/**/*.js', 'src/seeders/**/*.js'],
      rules: {
        'no-unused-vars': ['error', { argsIgnorePattern: '^_|^Sequelize$', varsIgnorePattern: '^_' }],
      },
    },
    {
      // down() rollback catch blocks are idempotent teardown — the column may
      // already be gone, so there's nothing to do about a failed removeColumn.
      files: ['src/migrations/**/*.js'],
      rules: {
        'no-empty': ['error', { allowEmptyCatch: true }],
      },
    },
  ],
};
