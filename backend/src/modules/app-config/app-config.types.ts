export const LAYOUT_SECTION_TYPES = [
  'BANNERS',
  'HERO',
  'INFO_STRIP',
  'LODGE_RAIL',
  'NOTICE',
  'SEARCH',
  'TRUST_POINTS',
] as const;

export type LayoutSectionType = (typeof LAYOUT_SECTION_TYPES)[number];

export interface LayoutSection {
  enabled: boolean;
  id: string;
  props: Record<string, unknown>;
  type: LayoutSectionType;
}

export interface ScreenLayout {
  sections: LayoutSection[];
}

export interface PilgrimAppTheme {
  accent: string;
  background: string;
  ink: string;
  primary: string;
  surface: string;
}

export interface PilgrimAppLayout {
  screens: { home: ScreenLayout };
  theme: PilgrimAppTheme;
  version: 1;
}

export interface PilgrimAppConfig {
  flags: Record<string, boolean>;
  layout: PilgrimAppLayout;
  settings: Record<string, unknown>;
}
