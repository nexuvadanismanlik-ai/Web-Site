/**
 * Proves the lenient-validation marker actually changes what the global pipe
 * does.
 *
 * This test exists because the first attempt at the fix — a route-level
 * `@UsePipes` with relaxed options — typechecked, linted, deployed, and did
 * absolutely nothing: Nest runs global pipes *as well as* route-level ones, so
 * the strict global pipe rejected the request before the lenient one ever saw
 * it. It looked correct in the diff and was still broken in production.
 *
 * Run against the build:
 *   pnpm --filter @nexuva/api build
 *   node apps/api/test/validation-pipe.test.mjs
 */
import 'reflect-metadata';
import { AppValidationPipe } from '../dist/apps/api/src/common/pipes/app-validation.pipe.js';
import { CollectViewDto } from '../dist/apps/api/src/modules/analytics/analytics.controller.js';
import { CreateContactMessageDto } from '../dist/apps/api/src/modules/website/contact/dto/create-contact-message.dto.js';

// The exact options main.ts registers.
const pipe = new AppValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

let passed = 0;
let failed = 0;

function check(ok, label, detail = '') {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${ok ? '' : ` — ${detail}`}`);
  if (ok) passed++;
  else failed++;
}

console.log('\nDoğrulama pipe\'ı\n');

// 1. A page view carrying a field the API has not learned about yet must still
//    be recorded. This is the failure that stopped measurement dead.
try {
  const out = await pipe.transform(
    { path: '/', landingPath: '/', utmCampaign: 'yaz-kampanyasi', birSonrakiAlan: 'x' },
    { type: 'body', metatype: CollectViewDto },
  );
  check(out.path === '/', 'Ziyaret: bilinmeyen alan isteği düşürmüyor');
  check(out.birSonrakiAlan === undefined, 'Ziyaret: bilinmeyen alan kaydedilmiyor');
  check(out.utmCampaign === 'yaz-kampanyasi', 'Ziyaret: bilinen alanlar korunuyor');
} catch (err) {
  check(false, 'Ziyaret: bilinmeyen alan isteği düşürmüyor', err.message);
  check(false, 'Ziyaret: bilinmeyen alan kaydedilmiyor');
  check(false, 'Ziyaret: bilinen alanlar korunuyor');
}

// 2. Tolerating unknown fields is not the same as tolerating bad ones.
try {
  await pipe.transform({ path: 'x'.repeat(500) }, { type: 'body', metatype: CollectViewDto });
  check(false, 'Ziyaret: tanımlı alanlar hâlâ doğrulanıyor', 'geçersiz değer kabul edildi');
} catch {
  check(true, 'Ziyaret: tanımlı alanlar hâlâ doğrulanıyor');
}

// 3. A real enquiry must not be lost because the static site is a version ahead.
try {
  const out = await pipe.transform(
    {
      name: 'Ayşe Yılmaz',
      email: 'ayse@ornek.com',
      message: 'Merhaba, teklif almak istiyorum.',
      birSonrakiAlan: 1,
    },
    { type: 'body', metatype: CreateContactMessageDto },
  );
  check(out.email === 'ayse@ornek.com', 'Form: bilinmeyen alan talebi kaybettirmiyor');
} catch (err) {
  check(false, 'Form: bilinmeyen alan talebi kaybettirmiyor', err.message);
}

// 4. And the form still refuses what it should.
try {
  await pipe.transform(
    { name: 'A', email: 'gecersiz', message: 'x' },
    { type: 'body', metatype: CreateContactMessageDto },
  );
  check(false, 'Form: geçersiz e-posta hâlâ reddediliyor', 'kabul edildi');
} catch {
  check(true, 'Form: geçersiz e-posta hâlâ reddediliyor');
}

// 5. Every other payload in the application stays strict. This is the half that
//    makes the exception safe: it is opt-in, not a global loosening.
class SiradanDto {}
try {
  await pipe.transform({ tanimsizAlan: 1 }, { type: 'body', metatype: SiradanDto });
  check(false, 'Diğer uçlar hâlâ katı', 'bilinmeyen alan kabul edildi');
} catch {
  check(true, 'Diğer uçlar hâlâ katı');
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed} geçti, ${failed} kaldı`);
console.log(failed === 0 ? '✅ Pipe doğru davranıyor.\n' : '❌ Pipe beklendiği gibi davranmıyor.\n');
process.exit(failed === 0 ? 0 : 1);
