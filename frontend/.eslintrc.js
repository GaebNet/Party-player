module.exports = {
  extends: ['next/core-web-vitals'],
  overrides: [
    {
      files: ['**/*.css'],
      rules: {
        // Disable all linting for CSS files since they contain Tailwind directives
        'no-unused-vars': 'off',
        'no-undef': 'off'
      }
    }
  ]
};