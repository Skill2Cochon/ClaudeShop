// @ts-check
import base from './eslint-base.js';

/** ESLint config for Next.js apps. Extends base + React/JSX rules. */
export default [
  ...base,
  {
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
];
