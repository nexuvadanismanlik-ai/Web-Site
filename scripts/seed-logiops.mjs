/**
 * Fills in the LogiOps page and puts it in the main navigation.
 *
 * The copy is positioning, not specification. Every sentence describes an
 * approach to operations work — making it visible, measurable, manageable —
 * and none of it claims a feature, an integration or a figure. That line
 * matters more here than anywhere else on the site: a product page is where a
 * business is most tempted to describe software it has not written, and a
 * customer who buys a promised feature and does not find it has been misled by
 * the page, whatever anybody intended.
 *
 * Everything written here is editable in the panel afterwards. This only
 * ensures the page is not empty on the day the link appears in the header.
 *
 * Written as a UTF-8 file and run by node: Turkish text passed through a
 * Windows shell is what destroyed the hero copy earlier.
 *
 *   node scripts/seed-logiops.mjs --write
 */

const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';
const WRITE = process.argv.includes('--write');

let auth = {};

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
      ...auth,
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body: body?.data ?? body };
}

/** Turkish and English side by side; the site renders the Turkish. */
const L = (tr, en) => ({ tr, en });

const LOGIOPS = {
  badge: L('Nexuva Ürünü', 'A Nexuva product'),
  titleLead: L('Operasyonunuzu', 'Make your operations'),
  titleHighlight: L('görünür kılın', 'visible'),
  subtitle: L(
    'LogiOps, dağınık araçlarda yürüyen operasyonu tek bir akışta toplayan bir ' +
      'yaklaşımdır. Amacı yeni bir araç eklemek değil; işin nerede olduğunu, ' +
      'neyin beklediğini ve neyin ölçüldüğünü tek bir yerden görünür kılmaktır.',
    'LogiOps brings operations that run across scattered tools into a single ' +
      'flow — so where the work is, what is waiting and what is measured can be ' +
      'seen in one place.',
  ),
  primaryCta: { label: L('LogiOps’u Konuşalım', 'Talk to us about LogiOps'), href: '/contact' },
  secondaryCta: { label: L('Hizmetlerimiz', 'Our services'), href: '/services' },

  problemsTitle: L(
    'Operasyon büyüdükçe ne olur?',
    'What happens as operations grow',
  ),
  problems: [
    {
      title: L('İş birden fazla araca dağılır', 'Work scatters across tools'),
      body: L(
        'Talepler e-postada, takip tabloda, onay mesajlaşmada durur. Hiçbiri ' +
          'yanlış değildir; bir arada olmadıkları için bütünü kimse göremez.',
        'Requests live in email, tracking in a spreadsheet, approvals in chat.',
      ),
    },
    {
      title: L('Süreçler elle yürür', 'Processes run by hand'),
      body: L(
        'Aynı adımlar her seferinde yeniden hatırlanır. Hatırlayan kişi izinliyse ' +
          'süreç de izinli olur.',
        'The same steps are remembered afresh each time.',
      ),
    },
    {
      title: L('Görünürlük kaybolur', 'Visibility disappears'),
      body: L(
        '“Bu iş nerede kaldı?” sorusunun cevabı, birine sormaktan geçer. Bu, ' +
          'cevabın hızına da doğruluğuna da bağımlılık yaratır.',
        'Answering "where did this get to" means asking somebody.',
      ),
    },
    {
      title: L('Raporlama sonradan üretilir', 'Reporting is assembled afterwards'),
      body: L(
        'Ay sonunda veriler toplanır, elle birleştirilir ve rapor çıkar. Bu ' +
          'rapor geçmişi anlatır; kararı ise bugün vermek gerekir.',
        'Figures are gathered at month end. That describes the past.',
      ),
    },
  ],

  approachTitle: L('LogiOps yaklaşımı', 'The LogiOps approach'),
  approach: [
    {
      title: L('Önce mevcut akışı çıkarırız', 'We map what already happens'),
      body: L(
        'Yeni bir düzen dayatmadan önce işin bugün nasıl yürüdüğünü adım adım ' +
          'yazarız. Değiştirilecek olan da, korunacak olan da buradan çıkar.',
        'Before proposing anything we write down how the work runs today.',
      ),
    },
    {
      title: L('Tekrar edeni sisteme veririz', 'The repeatable part moves to software'),
      body: L(
        'Her seferinde aynı şekilde yapılan adımlar otomatikleşir. Karar ' +
          'gerektiren adımlar insanda kalır — otomasyonun işi karar vermek değildir.',
        'Steps done the same way every time are automated; decisions stay with people.',
      ),
    },
    {
      title: L('Tek bir görünüm kurarız', 'One place to look'),
      body: L(
        'İşin hangi aşamada olduğu, kimde beklediği ve ne zamandır beklediği ' +
          'tek ekrandan okunur.',
        'Which stage the work is at, with whom, and for how long.',
      ),
    },
    {
      title: L('Ölçümü baştan kurarız', 'Measurement is designed in'),
      body: L(
        'Neyin ölçüleceğine sonradan değil, akış kurulurken karar verilir. ' +
          'Sonradan eklenen ölçüm, ölçmek istediğiniz şeyi çoğu zaman kaçırır.',
        'What gets measured is decided while the flow is designed, not after.',
      ),
    },
    {
      title: L('Mevcut araçlarla konuşturur', 'It talks to what you already use'),
      body: L(
        'Kullandığınız araçları bırakmanız gerekmez. Amaç onların ürettiği ' +
          'bilgiyi tek akışta buluşturmaktır.',
        'You do not have to abandon the tools you use.',
      ),
    },
    {
      title: L('Kullanan ekiple birlikte kurulur', 'Built with the people who use it'),
      body: L(
        'İşi yürüten ekip kurulumun içindedir. Kullanılmayan bir sistem, ' +
          'kurulmamış bir sistemdir.',
        'A system nobody uses is a system that was not built.',
      ),
    },
  ],

  flowTitle: L('Nasıl ilerliyoruz', 'How we work'),
  flow: [
    {
      title: L('Keşif', 'Discovery'),
      body: L(
        'Mevcut operasyonu birlikte çıkarırız: hangi iş nerede başlıyor, nerede ' +
          'bekliyor, nerede bitiyor.',
        'We map the current operation together.',
      ),
    },
    {
      title: L('Tasarım', 'Design'),
      body: L(
        'Akışı, sorumlulukları ve ölçülecek noktaları tanımlarız. Bu adımda ' +
          'hiçbir şey kodlanmaz — neyin doğru olduğunu önce yazıyla anlaşırız.',
        'We define the flow, the responsibilities and the measurement points.',
      ),
    },
    {
      title: L('Kurulum', 'Setup'),
      body: L(
        'Akış devreye alınır, mevcut sistemlerle bağlantılar kurulur, veri ' +
          'aktarımı yapılır.',
        'The flow goes live and connects to the systems already in use.',
      ),
    },
    {
      title: L('Devreye alma', 'Handover'),
      body: L(
        'Ekip kendi işini kendi yürütecek şekilde sistemi devralır. Eğitim ve ' +
          'ilk dönem desteği bu adımın parçasıdır.',
        'The team takes it over, with training and early support.',
      ),
    },
    {
      title: L('İzleme ve iyileştirme', 'Monitoring and improvement'),
      body: L(
        'Ölçüm başladıktan sonra akış üzerinde düzeltmeler yapılır. İlk kurulum ' +
          'bir başlangıçtır, son hâli değil.',
        'Once measurement starts, the flow is adjusted. The first setup is a start.',
      ),
    },
  ],

  closingTitle: L(
    'Operasyonunuzu konuşmakla başlayalım',
    'Let’s start by talking about your operation',
  ),
  closingBody: L(
    'LogiOps’un size uygun olup olmadığını, mevcut akışınızı görmeden söylemek ' +
      'doğru olmaz. İlk görüşme tam olarak bunun içindir: ne yaptığınızı ' +
      'anlarız, nerede zorlandığınızı konuşuruz ve yapılabilecekleri açıkça ' +
      'söyleriz.',
    'Whether LogiOps fits you is not something to claim without seeing how you work.',
  ),
};

async function main() {
  console.log(`\nLogiOps içeriği — ${API}\n`);

  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.body?.accessToken ?? login.body?.token;
  if (!token) {
    console.log(`❌ giriş yapılamadı (HTTP ${login.status})`);
    process.exit(1);
  }
  auth = { Authorization: `Bearer ${token}` };

  const existing = await api('/website/sections/logiops?tenant=nexuva');
  const already = Boolean(existing.body?.data?.titleLead);
  console.log(`Mevcut LogiOps içeriği: ${already ? 'var' : 'yok'}`);

  const nav = await api('/website/collections/nav-items?tenant=nexuva');
  const items = Array.isArray(nav.body) ? nav.body : [];
  const hasLogiOps = items.some((item) => item.href === '/logiops');
  console.log(`Menüde LogiOps: ${hasLogiOps ? 'var' : 'yok'}`);

  if (!WRITE) {
    console.log('\nYazmak için --write ekle.\n');
    return;
  }

  // Content first. Adding the link before the page has words would put an
  // empty page in the main navigation.
  if (already) {
    console.log('\n⏭  İçerik zaten girilmiş, üzerine yazılmıyor.');
  } else {
    const saved = await api('/website/sections/logiops?tenant=nexuva', {
      method: 'PUT',
      body: JSON.stringify(LOGIOPS),
    });
    console.log(`\n${saved.status === 200 ? '✅' : '❌'} içerik yazıldı (HTTP ${saved.status})`);
  }

  if (!hasLogiOps) {
    // Placed after Hizmetler, where a product belongs in a reading order that
    // goes what-we-do → what-we-made.
    const next = [...items];
    const afterServices = next.findIndex((item) => item.href === '/services');
    const entry = {
      label: { tr: 'LogiOps', en: 'LogiOps' },
      href: '/logiops',
    };
    next.splice(afterServices >= 0 ? afterServices + 1 : next.length, 0, entry);

    const savedNav = await api('/website/collections/nav-items?tenant=nexuva', {
      method: 'PUT',
      body: JSON.stringify(
        next.map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          label: item.label,
          href: item.href,
        })),
      ),
    });
    console.log(`${savedNav.status === 200 ? '✅' : '❌'} menü güncellendi (HTTP ${savedNav.status})`);
  }

  // Read back and check the Turkish survived, which is the failure mode this
  // whole file is shaped around.
  const back = await api('/website/sections/logiops?tenant=nexuva');
  const lead = back.body?.data?.titleLead?.tr ?? '';
  const damaged = JSON.stringify(back.body?.data ?? {}).includes('�');
  console.log(`\n  Başlık: "${lead} ${back.body?.data?.titleHighlight?.tr ?? ''}"`);
  console.log(`  ${damaged ? '❌ bozuk karakter var' : '✅ Türkçe karakterler sağlam'}`);

  const navBack = await api('/website/collections/nav-items?tenant=nexuva');
  const labels = (Array.isArray(navBack.body) ? navBack.body : []).map(
    (item) => `${item.label?.tr ?? item.label} → ${item.href}`,
  );
  console.log(`\n  Menü:\n${labels.map((l) => `    ${l}`).join('\n')}`);

  if (damaged) process.exit(1);

  const published = await api('/website/publish?tenant=nexuva', { method: 'POST' });
  console.log(`\nYayın: HTTP ${published.status} — ${published.body?.detail ?? ''}\n`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
