/**
 * The content policy against the wording the live panel actually holds
 * (read from the public content endpoint on 21.11.2026).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SiteContent } from '@nexuva/types';
import { applyContentPolicy, UNVERIFIED_CLAIMS } from '../lib/content-policy';

const live = {
  brand: {
    siteName: 'Nexuva',
    phone: '+90 212 555 0100',
    address: { tr: 'Levent, 34330 Beşiktaş / İstanbul', en: 'Levent, 34330 Besiktas / Istanbul, Türkiye' },
  },
  contact: {
    phone: '+90 212 555 0100',
    address: { tr: 'Levent, 34330 Beşiktaş / İstanbul', en: 'Levent, 34330 Besiktas / Istanbul, Türkiye' },
  },
  footer: {
    about: { tr: 'Nexuva, markaların dijitalde büyümesi için strateji, yazılım ve tasarımı bir araya getiren dijital dönüşüm ajansıdır.' },
  },
  hero: { metrics: [] },
  stats: [],
  about: {
    highlights: [
      { icon: 'target', title: { tr: 'Sonuç Odaklı' }, text: { tr: 'Ölçülebilir iş hedeflerine kilitleniyoruz.' } },
      { icon: 'users', title: { tr: 'Deneyimli Ekip' }, text: { tr: 'Ortalama 8+ yıl sektör tecrübesi.', en: '8+ years of average industry experience.' } },
    ],
    paragraphs: [
      { tr: 'Girişimlerden kurumsal holdinglere kadar farklı ölçeklerdeki markaların dijital yolculuğuna eşlik ediyoruz.' },
      { tr: 'Strateji, tasarım, mühendislik ve büyüme disiplinlerini tek ekipte birleştiriyoruz.' },
    ],
  },
  referencesMeta: {
    title: { tr: "Türkiye'nin öncü markaları bize güveniyor", en: 'Leading brands trust us' },
    subtitle: { tr: "Farklı sektörlerden 120'den fazla markayla dijital başarı hikâyeleri yazdık.", en: 'We have written digital success stories with 120+ brands across industries.' },
  },
} as unknown as SiteContent;

test('no unverified claim or old contact detail survives the policy', () => {
  const out = JSON.stringify(applyContentPolicy(live));
  for (const re of UNVERIFIED_CLAIMS) assert.ok(!re.test(out), `still matches ${re}`);
  assert.ok(!out.includes('dijital dönüşüm ajansı'), 'old footer description');
});

test('the confirmed details and definition are put in their place', () => {
  const out = applyContentPolicy(live);
  assert.equal(out.contact.phone, '0535 529 5700');
  assert.equal(out.brand.phone, '0535 529 5700');
  assert.equal(out.contact.address.tr, 'Beylikdüzü, İstanbul');
  assert.match(out.footer.about.tr ?? '', /teknoloji ve danışmanlık şirketidir/);
  assert.equal(out.about.highlights[0]?.title.tr, '2022’den beri');
  assert.equal(out.about.highlights.length, 2);
  assert.match(out.about.paragraphs[0]?.tr ?? '', /teknoloji ve danışmanlık şirketidir/);
  assert.equal(out.referencesMeta.title.tr, 'Birlikte çalıştığımız markalar');
  assert.equal(out.referencesMeta.subtitle.tr, '');
});
