'use client';

import { useState } from 'react';
import { AlertTriangle, Globe, Share2 } from 'lucide-react';
import type { SeoContent, SiteContent } from '@nexuva/types';
import { ImageField, SelectField, type PickableImage } from '@nexuva/ui';
import { saveSection } from '../../app/actions';
import { TextField, TextAreaField, Panel, EditorHeader, useSaver } from '../fields';

/** Where the character counters turn amber. Google truncates near these. */
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

const CARD_TYPES = [
  { value: 'summary_large_image', label: 'Büyük görsel (önerilen)' },
  { value: 'summary', label: 'Küçük görsel' },
];

/**
 * What the site tells search engines and social networks.
 *
 * Every field is optional and every field falls back to something derived from
 * the brand and hero content, so this screen starts out describing what the
 * site already says rather than blanking it. The previews show the fallback in
 * use, because a field left empty is a decision too and its result should be
 * visible before publishing.
 */
export function SeoEditor({
  initial,
  content,
  images,
  siteUrl,
}: {
  /** Whatever is stored today. Empty until this screen is saved once, so the
   *  defaults below are what the site is really using. */
  initial: Partial<SeoContent>;
  /** Brand and hero, for the fallbacks the site actually applies. */
  content: SiteContent;
  images: PickableImage[];
  siteUrl: string;
}) {
  const [seo, setSeo] = useState<SeoContent>({
    title: '',
    description: '',
    keywords: [],
    canonical: '',
    noIndex: false,
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
    twitterCard: 'summary_large_image',
    twitterSite: '',
    favicon: '',
    appleTouchIcon: '',
    themeColor: '',
    ...initial,
  });
  const { saving, saved, error, run } = useSaver();

  const set = <K extends keyof SeoContent>(key: K, value: SeoContent[K]) =>
    setSeo((current: SeoContent) => ({ ...current, [key]: value }));

  // The same fallbacks the website applies, so the preview is not a guess.
  const brandName = content.brand?.siteName ?? 'Nexuva';
  const effectiveTitle = seo.title || `${brandName} — ${content.brand?.tagline?.tr ?? ''}`.trim();
  const effectiveDescription = seo.description || content.hero?.subtitle?.tr || '';
  const effectiveOgTitle = seo.ogTitle || effectiveTitle;
  const effectiveOgDescription = seo.ogDescription || effectiveDescription;
  const effectiveCanonical = seo.canonical || siteUrl;

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="SEO"
        subtitle="Arama sonuçlarında ve paylaşımlarda nasıl görüneceği"
        saving={saving}
        saved={saved}
        error={error}
        onSave={() => run(() => saveSection('seo', seo))}
      />

      <div className="space-y-6">
        {/* ── Google preview ─────────────────────────────────────────────── */}
        <Panel title="Google'da böyle görünür">
          <div className="rounded-xl border border-overlay/10 bg-white p-4 dark:bg-[#202124]">
            <div className="truncate text-xs text-[#4d5156] dark:text-[#bdc1c6]">
              {effectiveCanonical.replace(/^https?:\/\//, '')}
            </div>
            <div className="mt-1 truncate text-lg text-[#1a0dab] dark:text-[#8ab4f8]">
              {effectiveTitle || '(başlık yok)'}
            </div>
            <div className="mt-0.5 line-clamp-2 text-sm text-[#4d5156] dark:text-[#bdc1c6]">
              {effectiveDescription || '(açıklama yok)'}
            </div>
          </div>
          {seo.noIndex && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Arama motorlarına <strong>dizine ekleme</strong> talimatı veriliyor. Site Google&apos;da
                çıkmayacak.
              </span>
            </p>
          )}
        </Panel>

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <Panel title="Arama">
          <div className="space-y-4">
            <Counted
              label="Sayfa Başlığı"
              value={seo.title}
              onChange={(v) => set('title', v)}
              limit={TITLE_LIMIT}
              placeholder={effectiveTitle}
              hint="Boş bırakılırsa marka adı ve sloganından üretilir."
            />
            <Counted
              label="Meta Açıklama"
              value={seo.description}
              onChange={(v) => set('description', v)}
              limit={DESCRIPTION_LIMIT}
              multiline
              placeholder={effectiveDescription}
              hint="Boş bırakılırsa hero alt metni kullanılır."
            />
            <TextField
              label="Anahtar Kelimeler"
              value={seo.keywords.join(', ')}
              onChange={(v) =>
                set(
                  'keywords',
                  v
                    .split(',')
                    .map((word) => word.trim())
                    .filter(Boolean),
                )
              }
              placeholder="dijital pazarlama, seo, google ads"
            />
            <TextField
              label="Canonical Adres"
              value={seo.canonical}
              onChange={(v) => set('canonical', v)}
              placeholder={siteUrl}
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-overlay/10 bg-overlay/[0.02] p-3">
              <input
                type="checkbox"
                checked={seo.noIndex}
                onChange={(e) => set('noIndex', e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm">
                <span className="block font-medium text-fg">Arama motorlarından gizle</span>
                <span className="block text-xs text-muted">
                  noindex, nofollow. Yalnızca site yayına hazır değilken açık kalmalı.
                </span>
              </span>
            </label>
          </div>
        </Panel>

        {/* ── Sharing ────────────────────────────────────────────────────── */}
        <Panel title="Paylaşım (OpenGraph & Twitter)">
          <div className="mb-5 overflow-hidden rounded-xl border border-overlay/15">
            <div className="flex h-40 items-center justify-center bg-overlay/5">
              {seo.ogImage ? (
                // A user upload on a CDN; next/image is disabled in the panel.
                <img src={seo.ogImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-xs text-faint">
                  <Share2 className="h-5 w-5" />
                  Görsel seçilmedi — paylaşımda boş kutu çıkar
                </span>
              )}
            </div>
            <div className="border-t border-overlay/10 bg-overlay/[0.03] p-3">
              <div className="text-[11px] uppercase text-faint">
                {effectiveCanonical.replace(/^https?:\/\//, '').split('/')[0]}
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold text-fg">
                {effectiveOgTitle || '(başlık yok)'}
              </div>
              <div className="mt-0.5 line-clamp-2 text-xs text-muted">
                {effectiveOgDescription || '(açıklama yok)'}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <ImageField
              label="Paylaşım Görseli (OG Image)"
              value={seo.ogImage}
              onChange={(url) => set('ogImage', url)}
              images={images}
              hint="1200×630 piksel önerilir. Link paylaşıldığında çıkan görsel."
            />
            <TextField
              label="Paylaşım Başlığı"
              value={seo.ogTitle}
              onChange={(v) => set('ogTitle', v)}
              placeholder={effectiveTitle}
            />
            <TextAreaField
              label="Paylaşım Açıklaması"
              value={seo.ogDescription}
              onChange={(v) => set('ogDescription', v)}
              rows={2}
              placeholder={effectiveDescription}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Twitter Kart Tipi"
                value={seo.twitterCard || 'summary_large_image'}
                onChange={(v) => set('twitterCard', v)}
                options={CARD_TYPES}
              />
              <TextField
                label="Twitter Hesabı"
                value={seo.twitterSite}
                onChange={(v) => set('twitterSite', v)}
                placeholder="@nexuva"
              />
            </div>
          </div>
        </Panel>

        {/* ── Icons ──────────────────────────────────────────────────────── */}
        <Panel title="Simgeler">
          <div className="space-y-4">
            <ImageField
              label="Favicon"
              value={seo.favicon}
              onChange={(url) => set('favicon', url)}
              images={images}
              hint="Tarayıcı sekmesindeki simge. 32×32 veya 48×48 PNG."
            />
            <ImageField
              label="Apple Touch Icon"
              value={seo.appleTouchIcon}
              onChange={(url) => set('appleTouchIcon', url)}
              images={images}
              hint="iPhone ana ekranına eklendiğinde çıkan simge. 180×180 PNG."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Tema Rengi</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={seo.themeColor || content.brand?.primaryColor || '#000000'}
                    onChange={(e) => set('themeColor', e.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-lg border border-overlay/10 bg-transparent"
                  />
                  <input
                    value={seo.themeColor}
                    onChange={(e) => set('themeColor', e.target.value)}
                    placeholder={content.brand?.primaryColor ?? ''}
                    className="field-input font-mono"
                  />
                </div>
                <p className="mt-1 text-xs text-faint">
                  Mobil tarayıcının üst çubuğunu boyar. Boşsa marka rengi kullanılır.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <p className="flex items-start gap-2 text-xs text-faint">
          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Bu alanlar site yeniden derlendiğinde geçerli olur — kaydettikten sonra{' '}
            <span className="text-muted">Yayınla</span>&apos;ya basmayı unutma. Sitemap ve robots.txt
            otomatik üretilir.
          </span>
        </p>
      </div>
    </div>
  );
}

/**
 * A text field that shows how much of it search engines will keep.
 *
 * The limit is a warning rather than a maximum: Google truncates, it does not
 * reject, and a title that reads well at 65 characters is better than one cut
 * to fit at 60.
 */
function Counted({
  label,
  value,
  onChange,
  limit,
  multiline = false,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  limit: number;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const shown = value || placeholder || '';
  const over = shown.length > limit;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="field-label">{label}</label>
        <span className={`text-xs ${over ? 'text-amber-500' : 'text-faint'}`}>
          {shown.length}/{limit}
          {over ? ' — kesilebilir' : ''}
        </span>
      </div>
      {multiline ? (
        <textarea
          value={value}
          rows={3}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="field-input resize-none"
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="field-input"
        />
      )}
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}
