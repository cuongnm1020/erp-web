import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  framework: '@storybook/nextjs-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y', 'msw-storybook-addon'],
  staticDirs: ['../public'],
  typescript: { check: false, reactDocgen: 'react-docgen' },
};

export default config;
