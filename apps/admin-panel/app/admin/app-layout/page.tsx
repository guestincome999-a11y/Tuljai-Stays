'use client';

import { useCallback, useEffect, useState } from 'react';

import { getPilgrimAppLayout, savePilgrimAppLayout } from '../../../src/api/admin-app-layout-api';
import type { AppLayoutSection, PilgrimAppLayout } from '../../../src/api/admin-app-layout-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

const THEME_LABELS: Array<{ key: keyof PilgrimAppLayout['theme']; label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Cards' },
  { key: 'ink', label: 'Text' },
];

const SECTION_LABELS: Record<string, string> = {
  BANNERS: 'Promotional banners',
  HERO: 'Hero',
  INFO_STRIP: 'Info strip',
  LODGE_RAIL: 'Featured lodges',
  NOTICE: 'Notice',
  SEARCH: 'Search bar',
  TRUST_POINTS: 'Trust points',
};

function humanize(key: string): string {
  const spaced = key.replace(/(?<lower>[a-z])(?<upper>[A-Z])/gu, '$<lower> $<upper>');
  const label = spaced.replace(/Mr$/u, ' (Marathi)').replace(/En$/u, ' (English)');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface FieldProps {
  label: string;
  onChange: (next: unknown) => void;
  value: unknown;
}

function PropField({ label, onChange, value }: FieldProps) {
  if (typeof value === 'string') {
    return (
      <label className="form-field">
        <span>{label}</span>
        <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }
  if (typeof value === 'number') {
    return (
      <label className="form-field">
        <span>{label}</span>
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </label>
    );
  }
  if (typeof value === 'boolean') {
    return (
      <label className="form-field">
        <span>{label}</span>
        <input
          checked={value}
          type="checkbox"
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
    );
  }
  if (Array.isArray(value)) {
    const items: unknown[] = value;
    return (
      <div className="form-field">
        <span>{label}</span>
        {items.map((item, index) =>
          isRecord(item) ? (
            <div className="settings-grid" key={index}>
              {Object.entries(item).map(([childKey, childValue]) => (
                <PropField
                  key={childKey}
                  label={humanize(childKey)}
                  value={childValue}
                  onChange={(next) =>
                    onChange(
                      items.map((entry, entryIndex) =>
                        entryIndex === index && isRecord(entry)
                          ? { ...entry, [childKey]: next }
                          : entry,
                      ),
                    )
                  }
                />
              ))}
            </div>
          ) : null,
        )}
      </div>
    );
  }
  return null;
}

export default function AppLayoutPage() {
  const [layout, setLayout] = useState<PilgrimAppLayout | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setLayout(await getPilgrimAppLayout());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the app layout.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateSection(index: number, patch: Partial<AppLayoutSection>) {
    setLayout((current) =>
      current
        ? {
            ...current,
            screens: {
              home: {
                sections: current.screens.home.sections.map((section, position) =>
                  position === index ? { ...section, ...patch } : section,
                ),
              },
            },
          }
        : current,
    );
  }

  function moveSection(index: number, direction: -1 | 1) {
    setLayout((current) => {
      if (!current) return current;
      const sections = [...current.screens.home.sections];
      const target = index + direction;
      if (target < 0 || target >= sections.length) return current;
      [sections[index], sections[target]] = [sections[target]!, sections[index]!];
      return { ...current, screens: { home: { sections } } };
    });
  }

  async function save() {
    if (!layout) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      setLayout(await savePilgrimAppLayout(layout));
      setMessage('Saved. The new pilgrim app picks this up within about 30 seconds.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save the app layout.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission="settings.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Remote App Layout</p>
            <h2>New pilgrim app — Home screen</h2>
            <p className="muted-copy">
              Reorder sections, change text in English and Marathi, and set theme colours. No app
              release needed.
            </p>
          </div>
          <button
            className="button button-primary"
            disabled={saving || !layout}
            type="button"
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </section>

        {error ? <section className="error-banner">{error}</section> : null}
        {message ? <section className="success-banner">{message}</section> : null}

        {layout ? (
          <>
            <section className="panel">
              <p className="eyebrow">Theme colours</p>
              <div className="quick-actions">
                {THEME_LABELS.map((item) => (
                  <label className="form-field" key={item.key}>
                    <span>{item.label}</span>
                    <input
                      type="color"
                      value={layout.theme[item.key]}
                      onChange={(event) =>
                        setLayout({
                          ...layout,
                          theme: { ...layout.theme, [item.key]: event.target.value },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </section>

            {layout.screens.home.sections.map((section, index) => (
              <section className="panel" key={section.id}>
                <div className="quick-actions">
                  <p className="eyebrow">{SECTION_LABELS[section.type] ?? section.type}</p>
                  <label className="form-field">
                    <span>Visible</span>
                    <input
                      checked={section.enabled}
                      type="checkbox"
                      onChange={(event) => updateSection(index, { enabled: event.target.checked })}
                    />
                  </label>
                  <button
                    className="button"
                    disabled={index === 0}
                    type="button"
                    onClick={() => moveSection(index, -1)}
                  >
                    Move up
                  </button>
                  <button
                    className="button"
                    disabled={index === layout.screens.home.sections.length - 1}
                    type="button"
                    onClick={() => moveSection(index, 1)}
                  >
                    Move down
                  </button>
                </div>
                <div className="settings-grid">
                  {Object.entries(section.props).map(([key, value]) => (
                    <PropField
                      key={key}
                      label={humanize(key)}
                      value={value}
                      onChange={(next) =>
                        updateSection(index, { props: { ...section.props, [key]: next } })
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        ) : null}
      </div>
    </PermissionGate>
  );
}
