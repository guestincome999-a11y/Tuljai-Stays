import { BadRequestException } from '@nestjs/common';

import { LAYOUT_SECTION_TYPES } from './app-config.types';
import type { LayoutSection, LayoutSectionType, PilgrimAppLayout } from './app-config.types';

const MAX_SECTIONS = 30;
const MAX_PROPS_BYTES = 8 * 1024;
const SECTION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;
const THEME_KEYS = ['accent', 'background', 'ink', 'primary', 'surface'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertSecureUrls(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSecureUrls(item, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (/url$/iu.test(key) && entry !== null && entry !== '') {
      if (typeof entry !== 'string' || !/^https:\/\//iu.test(entry)) {
        throw new BadRequestException(`${path}.${key} must be a secure HTTPS URL`);
      }
    }
    assertSecureUrls(entry, `${path}.${key}`);
  }
}

function validateSection(raw: unknown, seenIds: Set<string>): LayoutSection {
  if (!isPlainObject(raw)) {
    throw new BadRequestException('Every layout section must be an object');
  }
  const { enabled, id, props, type } = raw;

  if (typeof id !== 'string' || !SECTION_ID_PATTERN.test(id) || id.length > 40) {
    throw new BadRequestException('Every section needs a lowercase-hyphen ID up to 40 characters');
  }
  if (seenIds.has(id)) {
    throw new BadRequestException(`Duplicate section ID "${id}"`);
  }
  seenIds.add(id);

  if (!LAYOUT_SECTION_TYPES.includes(type as LayoutSectionType)) {
    throw new BadRequestException(`Section "${id}" has an unsupported type`);
  }
  if (typeof enabled !== 'boolean') {
    throw new BadRequestException(`Section "${id}" needs an enabled true/false value`);
  }
  if (!isPlainObject(props)) {
    throw new BadRequestException(`Section "${id}" needs a props object`);
  }
  if (Buffer.byteLength(JSON.stringify(props), 'utf8') > MAX_PROPS_BYTES) {
    throw new BadRequestException(`Section "${id}" props are too large`);
  }
  assertSecureUrls(props, id);

  return { enabled, id, props, type: type as LayoutSectionType };
}

export function validatePilgrimLayout(raw: unknown): PilgrimAppLayout {
  if (!isPlainObject(raw) || raw['version'] !== 1) {
    throw new BadRequestException('Layout must be an object with version 1');
  }

  const theme = raw['theme'];
  if (!isPlainObject(theme)) {
    throw new BadRequestException('Layout needs a theme object');
  }
  for (const key of THEME_KEYS) {
    const color = theme[key];
    if (typeof color !== 'string' || !HEX_COLOR_PATTERN.test(color)) {
      throw new BadRequestException(`Theme color "${key}" must be a #RRGGBB value`);
    }
  }

  const screens = raw['screens'];
  if (!isPlainObject(screens) || !isPlainObject(screens['home'])) {
    throw new BadRequestException('Layout needs a home screen');
  }
  const sections = screens['home']['sections'];
  if (!Array.isArray(sections) || sections.length === 0 || sections.length > MAX_SECTIONS) {
    throw new BadRequestException(`Home needs between 1 and ${MAX_SECTIONS} sections`);
  }

  const seenIds = new Set<string>();
  const validated = sections.map((section) => validateSection(section, seenIds));

  return {
    screens: { home: { sections: validated } },
    theme: {
      accent: theme['accent'] as string,
      background: theme['background'] as string,
      ink: theme['ink'] as string,
      primary: theme['primary'] as string,
      surface: theme['surface'] as string,
    },
    version: 1,
  };
}
