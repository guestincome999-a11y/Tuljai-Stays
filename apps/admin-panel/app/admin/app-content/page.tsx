'use client';

import { useCallback, useEffect, useState } from 'react';

import { listAdminSettings, updateAdminSetting } from '../../../src/api/admin-platform-control-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

const SETTING_KEY = 'pilgrim_home_content';

interface HomeContentForm {
  featuredCount: string;
  featuredSubtitleEn: string;
  featuredSubtitleMr: string;
  featuredTitleEn: string;
  featuredTitleMr: string;
  heroColors: [string, string, string];
  heroCtaEn: string;
  heroCtaMr: string;
  heroSubtitleEn: string;
  heroSubtitleMr: string;
  heroTitleEn: string;
  heroTitleMr: string;
  showCategories: boolean;
  showFeatured: boolean;
  showTrust: boolean;
}

const defaults: HomeContentForm = {
  featuredCount: '4',
  featuredSubtitleEn: 'Handpicked for comfort and trust',
  featuredSubtitleMr: 'आराम आणि विश्वासासाठी निवडलेले',
  featuredTitleEn: 'Loved by pilgrims',
  featuredTitleMr: 'भाविकांची आवड',
  heroColors: ['#FFA24A', '#F0561D', '#C23A1B'],
  heroCtaEn: 'Explore stays',
  heroCtaMr: 'निवास पहा',
  heroSubtitleEn: '',
  heroSubtitleMr: '',
  heroTitleEn: 'Rest well. Pray in peace.',
  heroTitleMr: 'शांत मुक्काम. निश्चिंत दर्शन.',
  showCategories: true,
  showFeatured: true,
  showTrust: true,
};

const textFields: Array<{ hint?: string; key: keyof HomeContentForm; label: string }> = [
  { key: 'heroTitleEn', label: 'Hero title (English)' },
  { key: 'heroTitleMr', label: 'Hero title (Marathi)' },
  {
    hint: 'Leave empty to show the live "from ₹ price" line.',
    key: 'heroSubtitleEn',
    label: 'Hero subtitle (English)',
  },
  { key: 'heroSubtitleMr', label: 'Hero subtitle (Marathi)' },
  { key: 'heroCtaEn', label: 'Hero button (English)' },
  { key: 'heroCtaMr', label: 'Hero button (Marathi)' },
  { key: 'featuredTitleEn', label: 'Lodges section title (English)' },
  { key: 'featuredTitleMr', label: 'Lodges section title (Marathi)' },
  { key: 'featuredSubtitleEn', label: 'Lodges section subtitle (English)' },
  { key: 'featuredSubtitleMr', label: 'Lodges section subtitle (Marathi)' },
];

const toggles: Array<{ key: 'showCategories' | 'showFeatured' | 'showTrust'; label: string }> = [
  { key: 'showCategories', label: 'Show "Browse by need" tiles' },
  { key: 'showFeatured', label: 'Show featured lodges' },
  { key: 'showTrust', label: 'Show trust strip' },
];

export default function AppContentPage() {
  const [form, setForm] = useState<HomeContentForm>(defaults);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const settings = await listAdminSettings();
      const value = settings.find((item) => item.key === SETTING_KEY)?.value;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const saved = value as Partial<Record<keyof HomeContentForm, unknown>>;
        setForm((current) => {
          const next = { ...current };
          for (const field of textFields) {
            const candidate = saved[field.key];
            if (typeof candidate === 'string') (next[field.key] as string) = candidate;
          }
          for (const toggle of toggles) {
            const candidate = saved[toggle.key];
            if (typeof candidate === 'boolean') next[toggle.key] = candidate;
          }
          if (typeof saved.featuredCount === 'number')
            next.featuredCount = String(saved.featuredCount);
          const colors = saved.heroColors;
          if (Array.isArray(colors) && colors.length === 3) {
            next.heroColors = colors.map(String) as HomeContentForm['heroColors'];
          }
          return next;
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load app content.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const count = Number(form.featuredCount);
    if (!Number.isInteger(count) || count < 2 || count > 8) {
      setError('Featured lodges must be a whole number from 2 to 8.');
      return;
    }
    if (!form.heroColors.every((color) => /^#[0-9a-f]{6}$/iu.test(color))) {
      setError('Hero colours must be valid hex colours.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateAdminSetting(SETTING_KEY, {
        description: 'Pilgrim app Home screen content and layout',
        isPublic: true,
        value: { ...form, featuredCount: count },
      });
      setMessage('Saved. The pilgrim app picks this up within about 20 seconds.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save app content.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission="settings.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Remote App Content</p>
            <h2>Pilgrim app — Home screen</h2>
            <p className="muted-copy">
              Change the Home screen text, colours and sections without releasing a new app.
            </p>
          </div>
          <button
            className="button button-primary"
            disabled={saving}
            type="button"
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </section>

        {error ? <section className="error-banner">{error}</section> : null}
        {message ? <section className="success-banner">{message}</section> : null}

        <section className="panel">
          <p className="eyebrow">Text</p>
          <div className="settings-grid">
            {textFields.map((field) => (
              <label className="form-field" key={field.key}>
                <span>{field.label}</span>
                <input
                  type="text"
                  value={form[field.key] as string}
                  onChange={(event) => setForm((c) => ({ ...c, [field.key]: event.target.value }))}
                />
                {field.hint ? <small className="muted-copy">{field.hint}</small> : null}
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Hero gradient colours</p>
          <div className="quick-actions">
            {form.heroColors.map((color, index) => (
              <label className="form-field" key={index}>
                <span>Colour {index + 1}</span>
                <input
                  type="color"
                  value={color}
                  onChange={(event) =>
                    setForm((c) => {
                      const heroColors = [...c.heroColors] as HomeContentForm['heroColors'];
                      heroColors[index] = event.target.value;
                      return { ...c, heroColors };
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Sections</p>
          <div className="settings-grid">
            {toggles.map((toggle) => (
              <label className="form-field" key={toggle.key}>
                <span>{toggle.label}</span>
                <input
                  checked={form[toggle.key]}
                  type="checkbox"
                  onChange={(event) =>
                    setForm((c) => ({ ...c, [toggle.key]: event.target.checked }))
                  }
                />
              </label>
            ))}
            <label className="form-field">
              <span>Number of featured lodges (2–8)</span>
              <input
                max={8}
                min={2}
                type="number"
                value={form.featuredCount}
                onChange={(event) => setForm((c) => ({ ...c, featuredCount: event.target.value }))}
              />
            </label>
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}
