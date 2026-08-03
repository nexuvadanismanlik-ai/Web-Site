'use client';

import { useState } from 'react';
import { Trash2, Plus, Sun, Moon } from 'lucide-react';
import type { BrandConfig, SocialLink } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import {
  TextField,
  LocalizedField,
  ColorField,
  Panel,
  EditorHeader,
  useSaver,
  IconButton,
  AddButton,
} from '../fields';

const SOCIAL_ICONS = ['linkedin', 'twitter', 'instagram', 'github', 'globe'];

export function BrandEditor({ initial }: { initial: BrandConfig }) {
  const [brand, setBrand] = useState<BrandConfig>(initial);
  const { saving, saved, run } = useSaver();

  const set = <K extends keyof BrandConfig>(key: K, value: BrandConfig[K]) =>
    setBrand((b) => ({ ...b, [key]: value }));

  const setSocial = (i: number, patch: Partial<SocialLink>) =>
    set(
      'social',
      brand.social.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Marka & Tema"
        subtitle="Logo, renkler ve iletişim bilgileri"
        saving={saving}
        saved={saved}
        onSave={() => run(() => saveSection('brand', brand))}
      />

      <div className="space-y-6">
        <Panel title="Genel">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Site Adı" value={brand.siteName} onChange={(v) => set('siteName', v)} />
            <TextField label="Logo Metni" value={brand.logoText} onChange={(v) => set('logoText', v)} />
          </div>
          <div className="mt-4">
            <LocalizedField label="Slogan" value={brand.tagline} onChange={(v) => set('tagline', v)} />
          </div>
        </Panel>

        <Panel title="Görünüm">
          <p className="mb-4 text-sm text-ink-400">
            Sitenin genel renk şeması. Aydınlık = beyaz arka plan, Koyu = siyah arka plan.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { value: 'light', label: 'Aydınlık', desc: 'Beyaz arka plan, koyu metin', icon: Sun },
                { value: 'dark', label: 'Koyu', desc: 'Siyah arka plan, açık metin', icon: Moon },
              ] as const
            ).map((opt) => {
              const OptIcon = opt.icon;
              const active = (brand.theme ?? 'light') === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('theme', opt.value)}
                  className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                    active
                      ? 'border-brand-400/60 bg-brand-500/10'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                      opt.value === 'light'
                        ? 'bg-white text-amber-500'
                        : 'bg-ink-950 text-brand-300'
                    }`}
                  >
                    <OptIcon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-white">
                      {opt.label}
                      {active && (
                        <span className="rounded-full brand-gradient-bg px-2 py-0.5 text-[0.6rem] font-bold uppercase text-white">
                          Aktif
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-ink-500">{opt.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="Tema Renkleri">
          <p className="mb-4 text-sm text-ink-400">
            Bu renkler tüm sitedeki gradyanları ve vurguları anında değiştirir.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField label="Ana Renk" value={brand.primaryColor} onChange={(v) => set('primaryColor', v)} />
            <ColorField label="Vurgu Rengi" value={brand.accentColor} onChange={(v) => set('accentColor', v)} />
          </div>
          <div
            className="mt-5 h-16 rounded-2xl"
            style={{ backgroundImage: `linear-gradient(120deg, ${brand.primaryColor}, ${brand.accentColor})` }}
          />
        </Panel>

        <Panel title="İletişim">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="E-posta" value={brand.email} onChange={(v) => set('email', v)} />
            <TextField label="Telefon" value={brand.phone} onChange={(v) => set('phone', v)} />
          </div>
          <div className="mt-4">
            <LocalizedField label="Adres" value={brand.address} onChange={(v) => set('address', v)} />
          </div>
        </Panel>

        <Panel title="Sosyal Medya">
          <div className="space-y-3">
            {brand.social.map((s, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="w-32">
                  <label className="field-label">İkon</label>
                  <select
                    value={s.icon}
                    onChange={(e) => setSocial(i, { icon: e.target.value })}
                    className="field-input"
                  >
                    {SOCIAL_ICONS.map((ic) => (
                      <option key={ic} value={ic} className="bg-ink-900">
                        {ic}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <label className="field-label">Etiket</label>
                  <input value={s.label} onChange={(e) => setSocial(i, { label: e.target.value })} className="field-input" />
                </div>
                <div className="min-w-[12rem] flex-1">
                  <label className="field-label">Bağlantı</label>
                  <input value={s.href} onChange={(e) => setSocial(i, { href: e.target.value })} className="field-input" />
                </div>
                <IconButton variant="danger" onClick={() => set('social', brand.social.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <AddButton
              label="Sosyal bağlantı ekle"
              onClick={() => set('social', [...brand.social, { icon: 'globe', label: '', href: '' }])}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
