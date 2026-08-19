'use client';

import type {
  FeatureFlag,
  PromotionalBanner,
  PromotionalBannerCategory,
  SystemSetting,
} from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listAdminFeatureFlags,
  listAdminSettings,
  updateAdminFeatureFlag,
  updateAdminSetting,
  uploadPromotionalBannerImage,
} from '../../../src/api/admin-platform-control-api';
import { PermissionGate } from '../../../src/components/PermissionGate';
import {
  festivalSettingKeys,
  formatControlLabel,
  stringifySettingValue,
} from '../../../src/platform-control/platform-control-config';

interface BannerFormState {
  category: PromotionalBannerCategory;
  expiresAt: string;
  imageUrl: string;
  linkUrl: string;
  lodgeSlug: string;
  startsAt: string;
  subtitle: string;
  title: string;
}

const initialBannerForm: BannerFormState = {
  category: 'FESTIVAL',
  expiresAt: '',
  imageUrl: '',
  linkUrl: '',
  lodgeSlug: '',
  startsAt: '',
  subtitle: '',
  title: '',
};

export default function AdminFestivalControlPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [banners, setBanners] = useState<PromotionalBanner[]>([]);
  const [bannerForm, setBannerForm] = useState<BannerFormState>(initialBannerForm);
  const [isUploadingBannerImage, setIsUploadingBannerImage] = useState(false);
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [settingsResponse, flagsResponse] = await Promise.all([
        listAdminSettings(),
        listAdminFeatureFlags(),
      ]);
      setSettings(settingsResponse);
      setFlags(flagsResponse);
      setBanners(readPromotionalBanners(settingsResponse));
      setDrafts(
        Object.fromEntries(
          settingsResponse
            .filter((setting) => festivalSettingKeys.includes(setting.key))
            .map((setting) => [setting.key, stringifySettingValue(setting.value)]),
        ),
      );
    } catch {
      setErrorMessage('Festival controls could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const settingsByKey = useMemo(
    () => new Map(settings.map((setting) => [setting.key, setting])),
    [settings],
  );
  const festivalMode = flags.find((flag) => flag.key === 'festival_mode');

  async function setFestivalMode(enabled: boolean) {
    if (!reason.trim()) {
      setErrorMessage('Festival mode changes require a reason.');
      return;
    }

    if (!window.confirm(enabled ? 'Enable Festival Mode?' : 'Disable Festival Mode?')) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateAdminFeatureFlag('festival_mode', {
        description: festivalMode?.description ?? 'Festival mode pricing and alerts',
        enabled,
        rolloutPercentage: festivalMode?.rolloutPercentage,
      });
      await load();
      setSuccessMessage(enabled ? 'Festival Mode enabled.' : 'Festival Mode disabled.');
    } catch {
      setErrorMessage('Festival Mode update failed.');
    }
  }

  async function saveFestivalSettings() {
    if (!reason.trim()) {
      setErrorMessage('Festival setting changes require a reason.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await Promise.all(
        festivalSettingKeys.map((key) => {
          const setting = settingsByKey.get(key);
          return updateAdminSetting(key, {
            description: setting?.description ?? formatControlLabel(key),
            isPublic: setting?.isPublic ?? true,
            value: drafts[key] ?? '',
          });
        }),
      );
      await load();
      setSuccessMessage('Festival settings saved.');
    } catch {
      setErrorMessage('Festival settings update failed.');
    }
  }

  function addBanner() {
    const title = bannerForm.title.trim();
    const imageUrl = bannerForm.imageUrl.trim();
    const linkUrl = bannerForm.linkUrl.trim();
    const lodgeSlug = bannerForm.lodgeSlug.trim().toLowerCase();

    if (!title || !imageUrl) {
      setErrorMessage('Banner title and an uploaded image are required.');
      return;
    }
    if (linkUrl && !/^https:\/\//iu.test(linkUrl)) {
      setErrorMessage('Optional banner links must use HTTPS.');
      return;
    }
    if (bannerForm.category === 'LODGE_PROMOTION' && !lodgeSlug) {
      setErrorMessage('Lodge promotions require the unique lodge URL slug.');
      return;
    }
    if (lodgeSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(lodgeSlug)) {
      setErrorMessage('Lodge slugs can contain lowercase letters, numbers, and single hyphens.');
      return;
    }

    const startsAt = toIsoDateTime(bannerForm.startsAt);
    const expiresAt = toIsoDateTime(bannerForm.expiresAt);
    if (startsAt && expiresAt && startsAt >= expiresAt) {
      setErrorMessage('Banner end date must be after its start date.');
      return;
    }

    setBanners((current) => [
      ...current,
      {
        category: bannerForm.category,
        expiresAt,
        id: globalThis.crypto?.randomUUID?.() ?? `banner-${Date.now()}`,
        imageUrl,
        isActive: true,
        linkUrl: bannerForm.category === 'LODGE_PROMOTION' ? null : linkUrl || null,
        lodgeSlug: bannerForm.category === 'LODGE_PROMOTION' ? lodgeSlug : null,
        sortOrder: current.length,
        startsAt,
        subtitle: bannerForm.subtitle.trim() || null,
        title,
      },
    ]);
    setBannerForm(initialBannerForm);
    setErrorMessage(null);
  }

  async function uploadBannerImage(file: File | undefined) {
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setErrorMessage('Upload a JPEG, PNG, or WebP image that is 5 MB or smaller.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUploadingBannerImage(true);
    try {
      const imageUrl = await uploadPromotionalBannerImage(file);
      setBannerForm((current) => ({ ...current, imageUrl }));
      setSuccessMessage('Banner image uploaded. Add the banner when its details are ready.');
    } catch {
      setErrorMessage('Image upload failed. Confirm storage is configured and try again.');
    } finally {
      setIsUploadingBannerImage(false);
    }
  }

  async function savePromotionalBanners() {
    if (!reason.trim()) {
      setErrorMessage('Promotional banner changes require a reason.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateAdminSetting('promotional_banners', {
        description: 'Sliding promotional banners shown in the pilgrim app',
        isPublic: true,
        value: banners.map((banner, index) => ({ ...banner, sortOrder: index })),
      });
      await load();
      setSuccessMessage('Promotional banners published to the pilgrim app.');
    } catch {
      setErrorMessage('Banner publishing failed. Check image URLs, links, dates, and lodge slugs.');
    }
  }

  return (
    <PermissionGate permission="settings.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Festival Control Center</p>
            <h2>Navratri and pilgrimage event controls</h2>
            <p className="muted-copy">
              Control festival mode, app banners, advisories, support instructions, and event date
              foundations without hardcoded dates.
            </p>
          </div>
          <div className="hero-actions">
            <span className={festivalMode?.enabled ? 'status-card' : 'live-pill'}>
              {festivalMode?.enabled ? 'Festival Mode Active' : 'Festival Mode Off'}
            </span>
          </div>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}
        {successMessage ? <section className="success-banner">{successMessage}</section> : null}

        <section className="panel warning-panel">
          <p className="eyebrow">Audit Safety</p>
          <label className="form-field">
            <span>Reason</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className="quick-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => void setFestivalMode(true)}
            >
              Enable Festival Mode
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void setFestivalMode(false)}
            >
              Disable Festival Mode
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Festival & Promotions</p>
              <h3>Sliding pilgrim-app banners</h3>
              <p className="muted-copy">
                Festival and announcement banners stay informational unless an HTTPS link is
                supplied. Lodge promotions always route through the lodge's unique URL slug.
              </p>
            </div>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void savePromotionalBanners()}
            >
              Publish Banners
            </button>
          </div>

          <div className="settings-grid">
            <label className="form-field">
              <span>Banner category</span>
              <select
                value={bannerForm.category}
                onChange={(event) =>
                  setBannerForm((current) => ({
                    ...current,
                    category: event.target.value as PromotionalBannerCategory,
                    linkUrl: '',
                    lodgeSlug: '',
                  }))
                }
              >
                <option value="FESTIVAL">Festival</option>
                <option value="ANNOUNCEMENT">Announcement</option>
                <option value="LODGE_PROMOTION">Lodge Promotion</option>
              </select>
            </label>
            <label className="form-field">
              <span>Banner title</span>
              <input
                maxLength={120}
                value={bannerForm.title}
                onChange={(event) =>
                  setBannerForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label className="form-field">
              <span>Short description</span>
              <input
                maxLength={240}
                value={bannerForm.subtitle}
                onChange={(event) =>
                  setBannerForm((current) => ({ ...current, subtitle: event.target.value }))
                }
              />
            </label>
            <label className="form-field">
              <span>Banner image</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={isUploadingBannerImage}
                type="file"
                onChange={(event) => void uploadBannerImage(event.target.files?.[0])}
              />
              <small>JPEG, PNG, or WebP up to 5 MB.</small>
              {isUploadingBannerImage ? <small>Uploading image...</small> : null}
              {bannerForm.imageUrl ? (
                <img
                  alt="Uploaded banner preview"
                  className="banner-preview-image"
                  src={bannerForm.imageUrl}
                />
              ) : null}
            </label>
            {bannerForm.category === 'LODGE_PROMOTION' ? (
              <label className="form-field">
                <span>Unique lodge URL slug</span>
                <input
                  placeholder="example-lodge-tuljapur"
                  value={bannerForm.lodgeSlug}
                  onChange={(event) =>
                    setBannerForm((current) => ({ ...current, lodgeSlug: event.target.value }))
                  }
                />
                <small>Must match one verified, live lodge. The banner becomes clickable.</small>
              </label>
            ) : (
              <label className="form-field">
                <span>Optional promotion link</span>
                <input
                  placeholder="Leave blank for a non-clickable banner"
                  type="url"
                  value={bannerForm.linkUrl}
                  onChange={(event) =>
                    setBannerForm((current) => ({ ...current, linkUrl: event.target.value }))
                  }
                />
              </label>
            )}
            <label className="form-field">
              <span>Starts at (optional)</span>
              <input
                type="datetime-local"
                value={bannerForm.startsAt}
                onChange={(event) =>
                  setBannerForm((current) => ({ ...current, startsAt: event.target.value }))
                }
              />
            </label>
            <label className="form-field">
              <span>Expires at (optional)</span>
              <input
                type="datetime-local"
                value={bannerForm.expiresAt}
                onChange={(event) =>
                  setBannerForm((current) => ({ ...current, expiresAt: event.target.value }))
                }
              />
            </label>
          </div>
          <div className="quick-actions">
            <button className="button button-secondary" type="button" onClick={addBanner}>
              Add Banner to Draft
            </button>
          </div>

          <div className="settings-grid">
            {banners.map((banner, index) => (
              <article className="settings-card" key={banner.id}>
                <img
                  alt=""
                  src={banner.imageUrl}
                  style={{
                    aspectRatio: '16 / 6',
                    borderRadius: 12,
                    objectFit: 'cover',
                    width: '100%',
                  }}
                />
                <div className="section-header">
                  <div>
                    <strong>{banner.title}</strong>
                    <p className="muted-copy">{formatControlLabel(banner.category)}</p>
                  </div>
                  <span className="status-card">Slide {index + 1}</span>
                </div>
                <p>{banner.subtitle ?? 'No description'}</p>
                <p className="muted-copy">
                  {banner.category === 'LODGE_PROMOTION'
                    ? `Routes to /lodges/${banner.lodgeSlug}`
                    : banner.linkUrl
                      ? `Opens ${banner.linkUrl}`
                      : 'Informational · not clickable'}
                </p>
                <div className="quick-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() =>
                      setBanners((current) =>
                        current.map((item) =>
                          item.id === banner.id ? { ...item, isActive: !item.isActive } : item,
                        ),
                      )
                    }
                  >
                    {banner.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() =>
                      setBanners((current) => current.filter((item) => item.id !== banner.id))
                    }
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="settings-grid">
          {festivalSettingKeys.map((key) => (
            <article className="settings-card" key={key}>
              <strong>{formatControlLabel(key)}</strong>
              <p className="muted-copy">
                {settingsByKey.get(key)?.description ?? 'Festival setting'}
              </p>
              <input
                type={key.endsWith('_date') ? 'date' : key.endsWith('_color') ? 'color' : 'text'}
                value={drafts[key] ?? ''}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [key]: event.target.value }))
                }
              />
              <span className="status-card">
                {settingsByKey.get(key)?.isPublic ? 'Public' : 'Private'}
              </span>
            </article>
          ))}
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Booking Pressure Foundation</p>
              <h3>Event operations readiness</h3>
            </div>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void saveFestivalSettings()}
            >
              Save Festival Settings
            </button>
          </div>
          <div className="roadmap-grid">
            {[
              'Pilgrim app festival banner',
              'Owner app festival emphasis',
              'Admin operations widgets',
              'Announcement priority',
              'Booking monitoring',
              'Notification priority foundation',
            ].map((item) => (
              <article className="roadmap-card" key={item}>
                <h4>{item}</h4>
                <p>
                  Uses public settings and the `festival_mode` flag when app-side adoption is
                  enabled.
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}

function readPromotionalBanners(settings: SystemSetting[]): PromotionalBanner[] {
  const value = settings.find(
    (setting) => setting.key === 'promotional_banners',
  )?.value;

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is PromotionalBanner => {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    const candidate = item as Record<string, unknown>;

    return (
      typeof candidate.id === 'string' &&
      typeof candidate.imageUrl === 'string'
    );
  });
}

function toIsoDateTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
