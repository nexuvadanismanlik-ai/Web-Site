import type { MetadataRoute } from 'next';
import { getSiteContent } from '../lib/content';
import { t } from '../lib/i18n';

export const dynamic = 'force-static';

/**
 * The web app manifest, so the site can be added to a phone's home screen with
 * the right name, icon and colours instead of a screenshot and a URL.
 *
 * Everything here comes from the panel: name and description from the brand,
 * icons and theme colour from the SEO screen.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const content = await getSiteContent();
  const seo = content.seo;

  const icons: MetadataRoute.Manifest['icons'] = [];
  if (seo?.appleTouchIcon?.trim()) {
    icons.push({ src: seo.appleTouchIcon.trim(), sizes: '180x180', type: 'image/png' });
  }
  if (seo?.favicon?.trim()) {
    icons.push({ src: seo.favicon.trim(), sizes: '32x32', type: 'image/png' });
  }

  return {
    name: content.brand.siteName,
    short_name: content.brand.siteName,
    description: seo?.description?.trim() || t(content.hero.subtitle),
    start_url: '/',
    display: 'standalone',
    background_color: content.brand.theme === 'dark' ? '#0b0b0f' : '#ffffff',
    theme_color: seo?.themeColor?.trim() || content.brand.primaryColor,
    ...(icons.length > 0 ? { icons } : {}),
  };
}
