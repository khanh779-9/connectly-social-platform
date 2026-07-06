import type { Preview } from "@storybook/react-vite";
import React from 'react';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      test: "todo",
    },

    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f8f9fa' },
        { name: 'dark', value: '#0f1115' },
        { name: 'white', value: '#ffffff' },
        { name: 'brand', value: '#f0fdfa' },
      ],
    },

    layout: 'centered',
  },

  decorators: [
    (Story, context) => {
      const theme = context.globals.theme ?? 'light';
      return (
        <div className={`min-w-0 ${theme === 'dark' ? 'dark' : ''}`}>
          <Story />
        </div>
      );
    },
  ],

  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;