/**
 * Draws the share card once, to a file.
 *
 * The site had no purpose-made share image. What it had was a chain of
 * fallbacks — the SEO field, then the hero picture, then the logo — and every
 * link in it was empty, so a link to this site posted anywhere rendered as a
 * bare URL. For a company that sells digital marketing that is an unfortunate
 * advert, and it is the kind of gap nobody notices until a client posts the
 * link somewhere public.
 *
 * Generated here rather than at request time on purpose. The site is a static
 * export, so there is no server to render an image on; Next's own
 * `opengraph-image` route needs one and fails the export. Running the same
 * renderer offline and committing the PNG gives the identical result with no
 * runtime at all — and the card only changes when the brand does.
 *
 * Deliberately not a screenshot of the page. A share card is read at thumbnail
 * size in a feed, where a shrunk-down homepage is illegible grey mush. This is
 * the wordmark, one line about what the company does, and the brand rule.
 *
 *   node scripts/make-og-image.mjs
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'apps', 'web', 'public', 'og.png');
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'og-fonts');

// The palette, copied from globals.css rather than imported: this script runs
// outside the bundler and a stale copy here shows up immediately as a card
// that does not match the site.
const INK = '#0d0f16';
const GOLD = '#d9b380';
const MUTED = '#9aa0b4';

/** See loadFont: the one browser generation Google still answers in TTF for. */
const TTF_ERA_UA =
  'Mozilla/5.0 (Linux; U; Android 4.3; en-us; SM-T210R Build/JSS15J) ' +
  'AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Safari/534.30';

/**
 * A font file satori can read.
 *
 * Google's CSS endpoint picks a format from the user-agent, so the ancient one
 * below is doing real work rather than being a copied incantation. It has to be
 * this specific vintage: an IE-era string gets EOT, anything modern gets woff2,
 * and satori reads neither. Android 4.3 is the era that gets plain TTF.
 *
 * Cached to disk because this script is run by hand and rate limits are real.
 */
async function loadFont(family, weight) {
  const slug = `${family.replace(/\s+/g, '-').toLowerCase()}-${weight}.ttf`;
  const cached = path.join(CACHE, slug);
  if (existsSync(cached)) return readFile(cached);

  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&subset=latin-ext`,
    { headers: { 'User-Agent': TTF_ERA_UA } },
  ).then((r) => r.text());

  // Not matched on a .ttf suffix: for the families Google keeps as variable
  // fonts the legacy endpoint answers from /l/font?kit=… with no extension at
  // all. Requiring the suffix found Playfair and silently missed Inter, so the
  // format is confirmed from the file's own magic bytes below instead.
  const url = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)?.[1];
  if (!url) throw new Error(`${family} ${weight}: font bağlantısı bulunamadı`);

  const buffer = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
  const magic = buffer.subarray(0, 4);
  const isTrueType =
    magic.equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) ||
    magic.toString('ascii') === 'true' ||
    magic.toString('ascii') === 'OTTO';
  if (!isTrueType) {
    throw new Error(
      `${family} ${weight}: TTF/OTF gelmedi (${magic.toString('hex')}) — satori woff2 okuyamaz`,
    );
  }

  await mkdir(CACHE, { recursive: true });
  await writeFile(cached, buffer);
  return buffer;
}

async function main() {
  // Two obstacles between here and the renderer, both environmental.
  //
  // Resolution: pnpm keeps each workspace's dependencies under its own
  // node_modules and this script lives at the repo root, where `next` is not
  // installed — so the specifier is resolved from the web app instead.
  //
  // Windows: the bundle locates its wasm files in a way that only works on
  // POSIX. See og-windows-loader.mjs.
  const fromWeb = createRequire(path.join(ROOT, 'apps', 'web', 'package.json'));
  register('./og-windows-loader.mjs', import.meta.url);
  const ogEntry = pathToFileURL(fromWeb.resolve('next/dist/compiled/@vercel/og/index.node.js'));
  const { ImageResponse } = await import(ogEntry.href);

  const [heading, body] = await Promise.all([
    loadFont('Playfair Display', 600),
    loadFont('Inter', 400),
  ]);

  const card = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: INK,
        padding: '96px 88px',
        position: 'relative',
      },
      children: [
        // The gold rule along the top edge — the one piece of the site's
        // furniture that survives being shrunk to a thumbnail.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '1200px',
              height: '6px',
              background: GOLD,
            },
          },
        },
        // The monogram, drawn the way the header draws it: a serif initial
        // inside a ring.
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '84px',
              height: '84px',
              borderRadius: '84px',
              border: `2px solid ${GOLD}`,
              color: GOLD,
              fontFamily: 'Playfair Display',
              fontSize: '40px',
            },
            children: 'N',
          },
        },
        {
          type: 'div',
          props: {
            style: {
              marginTop: '44px',
              display: 'flex',
              fontFamily: 'Playfair Display',
              fontSize: '76px',
              color: '#ffffff',
              letterSpacing: '-0.5px',
            },
            children: 'Nexuva Danışmanlık',
          },
        },
        {
          type: 'div',
          props: {
            style: {
              marginTop: '22px',
              display: 'flex',
              fontFamily: 'Inter',
              fontSize: '31px',
              color: MUTED,
              lineHeight: 1.45,
              maxWidth: '900px',
            },
            children:
              'Dijital pazarlama, kurumsal web ve lojistik operasyon yazılımı — tek ekipten.',
          },
        },
        {
          type: 'div',
          props: {
            style: {
              marginTop: '56px',
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              fontFamily: 'Inter',
              fontSize: '24px',
              color: GOLD,
            },
            // Three capabilities, not a web address. The company has no custom
            // domain yet — the canonical URL is still the hosting one — and a
            // card that prints a domain nobody owns is a fabrication that gets
            // seen by exactly the people it would embarrass us in front of.
            children: ['Dijital Pazarlama', 'Kurumsal Web', 'LogiOps'].flatMap(
              (label, index) => [
                ...(index > 0
                  ? [
                      {
                        type: 'div',
                        props: {
                          key: `sep-${index}`,
                          style: {
                            width: '6px',
                            height: '6px',
                            background: GOLD,
                            transform: 'rotate(45deg)',
                          },
                        },
                      },
                    ]
                  : []),
                { type: 'div', props: { key: label, style: { display: 'flex' }, children: label } },
              ],
            ),
          },
        },
      ],
    },
  };

  const response = new ImageResponse(card, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Playfair Display', data: heading, weight: 600, style: 'normal' },
      { name: 'Inter', data: body, weight: 400, style: 'normal' },
    ],
  });

  const png = Buffer.from(await response.arrayBuffer());

  // A satori render that silently produced nothing would still write a file,
  // and a 0-byte og.png reads as "done" in every check that only tests for
  // existence. A real 1200x630 PNG is comfortably over 10 KB.
  if (png.length < 10_000) {
    throw new Error(`Üretilen PNG şüpheli derecede küçük: ${png.length} bayt`);
  }
  if (png.subarray(1, 4).toString('ascii') !== 'PNG') {
    throw new Error('Çıktı PNG değil');
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, png);
  console.log(`\n✅ ${path.relative(ROOT, OUT)} — ${Math.round(png.length / 1024)} KB, 1200×630\n`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
