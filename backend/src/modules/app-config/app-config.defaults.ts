import type { PilgrimAppLayout } from './app-config.types';

export const PILGRIM_LAYOUT_SETTING_KEY = 'pilgrim_app_layout';

export const DEFAULT_PILGRIM_LAYOUT: PilgrimAppLayout = {
  screens: {
    home: {
      sections: [
        {
          enabled: true,
          id: 'hero',
          props: {
            subtitle: 'Verified stays, steps from the temple',
            title: 'Rest well. Darshan awaits.',
          },
          type: 'HERO',
        },
        { enabled: true, id: 'search', props: {}, type: 'SEARCH' },
        { enabled: true, id: 'banners', props: {}, type: 'BANNERS' },
        {
          enabled: true,
          id: 'featured-lodges',
          props: { limit: 8, title: 'Stays near the temple' },
          type: 'LODGE_RAIL',
        },
        { enabled: true, id: 'notice', props: {}, type: 'NOTICE' },
        {
          enabled: true,
          id: 'trust',
          props: {
            points: ['Verified lodges', 'Instant confirmation', 'Secure payments'],
          },
          type: 'TRUST_POINTS',
        },
      ],
    },
  },
  theme: {
    accent: '#C95516',
    background: '#FFF8F0',
    ink: '#2B1B12',
    primary: '#8A1F11',
    surface: '#FFFFFF',
  },
  version: 1,
};
