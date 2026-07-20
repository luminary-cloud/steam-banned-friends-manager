import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  outDir: '.output',
  manifest: ({ browser }) => ({
    name: 'Steam Banned Friends Manager',
    description: 'Show banned friends on Steam and manage them easily.',
    version: '2.0.1',
    icons: {
      16: 'icon/16.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    host_permissions: [
      '*://steamcommunity.com/*',
      'https://api.steampowered.com/*',
    ],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'cloud@luminary.pub',
              strict_min_version: '115.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
