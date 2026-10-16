import { apiClient } from './client';

export interface AppLayoutSection {
  enabled: boolean;
  id: string;
  props: Record<string, unknown>;
  type: string;
}

export interface AppLayoutTheme {
  accent: string;
  background: string;
  ink: string;
  primary: string;
  surface: string;
}

export interface PilgrimAppLayout {
  screens: { home: { sections: AppLayoutSection[] } };
  theme: AppLayoutTheme;
  version: 1;
}

export async function getPilgrimAppLayout(): Promise<PilgrimAppLayout> {
  return apiClient.get<PilgrimAppLayout>('/admin/app-config/pilgrim-layout');
}

export async function savePilgrimAppLayout(layout: PilgrimAppLayout): Promise<PilgrimAppLayout> {
  return apiClient.request<PilgrimAppLayout>('/admin/app-config/pilgrim-layout', {
    body: { layout },
    method: 'PUT',
  });
}
