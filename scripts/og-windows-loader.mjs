/**
 * A one-file source patch for @vercel/og, applied at load time.
 *
 * The bundle Next ships locates its three sidecar assets like this:
 *
 *     fileURLToPath(join(import.meta.url, "../yoga.wasm"))
 *
 * `path.join` on a `file:///C:/…` URL is a POSIX-only trick. On Windows it
 * rewrites the separators to backslashes and collapses `file:///` to `file:\`,
 * which is not a URL, so `fileURLToPath` throws `Invalid URL` before the module
 * has finished evaluating. `next build` never hits it because it resolves these
 * differently; a script that imports the bundle directly does, every time.
 *
 * Rewritten to `new URL("./name", import.meta.url)`, which is the platform's
 * own answer to "the file next to this one" and is correct on both.
 *
 * A load hook rather than an edit: node_modules is generated, and a fix that
 * lives there is undone by the next install without anybody noticing.
 *
 * Registered by scripts/make-og-image.mjs. Nothing else uses it, and it does
 * not affect the app build.
 */

const TARGET = '@vercel/og/index.node.js';
const BROKEN = /fileURLToPath\(join\(import\.meta\.url,\s*"\.\.\/([^"]+)"\)\)/g;

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!url.replace(/\\/g, '/').includes(TARGET) || !result.source) return result;

  const before = result.source.toString();
  // `join(url, "../x")` normalises to the sibling of the file, not its parent's
  // sibling — so the replacement is "./x", not "../x". Getting this backwards
  // fails loudly (the file is simply not there), which is the good kind.
  const after = before.replace(BROKEN, 'fileURLToPath(new URL("./$1", import.meta.url))');

  if (after === before) {
    throw new Error(
      'og yükleyicisi: yamalanacak satır bulunamadı — @vercel/og sürümü değişmiş olabilir',
    );
  }
  return { ...result, source: after };
}
