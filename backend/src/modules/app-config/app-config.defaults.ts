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
            ctaEn: 'Explore stays',
            ctaMr: 'निवास पहा',
            subtitleEn: '',
            subtitleMr: '',
            titleEn: 'Rest well. Pray in peace.',
            titleMr: 'शांत मुक्काम. निश्चिंत दर्शन.',
          },
          type: 'HERO',
        },
        { enabled: true, id: 'search', props: {}, type: 'SEARCH' },
        { enabled: true, id: 'banners', props: {}, type: 'BANNERS' },
        {
          enabled: true,
          id: 'featured-lodges',
          props: {
            limit: 8,
            subtitleEn: 'Handpicked for comfort and trust',
            subtitleMr: 'आराम आणि विश्वासासाठी निवडलेले',
            titleEn: 'Loved by pilgrims',
            titleMr: 'भाविकांची आवड',
          },
          type: 'LODGE_RAIL',
        },
        { enabled: true, id: 'notice', props: {}, type: 'NOTICE' },
        {
          enabled: true,
          id: 'trust',
          props: {
            points: [
              { titleEn: 'Verified lodges', titleMr: 'पडताळलेले निवास' },
              { titleEn: 'Instant confirmation', titleMr: 'तात्काळ पुष्टी' },
              { titleEn: 'Secure payments', titleMr: 'सुरक्षित पेमेंट' },
            ],
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
