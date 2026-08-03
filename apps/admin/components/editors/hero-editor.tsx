'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { HeroContent, CtaContent, HeroMetric } from '@nexuva/types';
import { saveSection } from '../../app/actions';
import {
  TextField,
  LocalizedField,
  Panel,
  EditorHeader,
  useSaver,
  IconButton,
  AddButton,
} from '../fields';

export function HeroEditor({ hero: h0, cta: c0 }: { hero: HeroContent; cta: CtaContent }) {
  const [hero, setHero] = useState<HeroContent>(h0);
  const [cta, setCta] = useState<CtaContent>(c0);
  const { saving, saved, run } = useSaver();

  const setH = <K extends keyof HeroContent>(k: K, v: HeroContent[K]) =>
    setHero((s) => ({ ...s, [k]: v }));
  const setMetric = (i: number, patch: Partial<HeroMetric>) =>
    setH('metrics', hero.metrics.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  return (
    <div className="mx-auto max-w-4xl">
      <EditorHeader
        title="Hero Bölümü"
        subtitle="Ana sayfa üst bölümü ve çağrı bandı"
        saving={saving}
        saved={saved}
        onSave={() =>
          run(async () => {
            await saveSection('hero', hero);
            await saveSection('cta', cta);
          })
        }
      />

      <div className="space-y-6">
        <Panel title="Başlık">
          <div className="space-y-4">
            <LocalizedField label="Üst Rozet" value={hero.badge} onChange={(v) => setH('badge', v)} />
            <LocalizedField label="Başlık (1. satır)" value={hero.titleLead} onChange={(v) => setH('titleLead', v)} />
            <LocalizedField label="Başlık (vurgulu)" value={hero.titleHighlight} onChange={(v) => setH('titleHighlight', v)} />
            <LocalizedField label="Alt Metin" value={hero.subtitle} onChange={(v) => setH('subtitle', v)} multiline rows={3} />
          </div>
        </Panel>

        <Panel title="Butonlar">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase text-brand-300">Birincil Buton</p>
              <LocalizedField label="Metin" value={hero.primaryCta.label} onChange={(v) => setH('primaryCta', { ...hero.primaryCta, label: v })} />
              <TextField label="Bağlantı" value={hero.primaryCta.href} onChange={(v) => setH('primaryCta', { ...hero.primaryCta, href: v })} />
            </div>
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase text-ink-400">İkincil Buton</p>
              <LocalizedField label="Metin" value={hero.secondaryCta.label} onChange={(v) => setH('secondaryCta', { ...hero.secondaryCta, label: v })} />
              <TextField label="Bağlantı" value={hero.secondaryCta.href} onChange={(v) => setH('secondaryCta', { ...hero.secondaryCta, href: v })} />
            </div>
          </div>
        </Panel>

        <Panel title="Metrikler">
          <div className="space-y-3">
            {hero.metrics.map((m, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="w-28">
                  <label className="field-label">Değer</label>
                  <input value={m.value} onChange={(e) => setMetric(i, { value: e.target.value })} className="field-input" />
                </div>
                <div className="min-w-[12rem] flex-1">
                  <LocalizedField label="Etiket" value={m.label} onChange={(v) => setMetric(i, { label: v })} />
                </div>
                <IconButton variant="danger" onClick={() => setH('metrics', hero.metrics.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <AddButton label="Metrik ekle" onClick={() => setH('metrics', [...hero.metrics, { value: '0', label: { tr: '', en: '' } }])} />
          </div>
        </Panel>

        <Panel title="Çağrı Bandı (CTA)">
          <div className="space-y-4">
            <LocalizedField label="Başlık" value={cta.title} onChange={(v) => setCta({ ...cta, title: v })} />
            <LocalizedField label="Alt Metin" value={cta.subtitle} onChange={(v) => setCta({ ...cta, subtitle: v })} multiline rows={2} />
            <div className="grid gap-4 sm:grid-cols-2">
              <LocalizedField label="Buton Metni" value={cta.button.label} onChange={(v) => setCta({ ...cta, button: { ...cta.button, label: v } })} />
              <TextField label="Buton Bağlantısı" value={cta.button.href} onChange={(v) => setCta({ ...cta, button: { ...cta.button, href: v } })} />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
