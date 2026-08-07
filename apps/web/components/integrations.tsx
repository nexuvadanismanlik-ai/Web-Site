import Script from 'next/script';
import type { IntegrationsContent } from '@nexuva/types';

/**
 * Measurement and advertising tags, as configured in the panel.
 *
 * Nothing loads unless the master switch is on and the individual identifier is
 * set, so a half-entered configuration never reaches a visitor — and turning
 * everything off is one toggle rather than eight deletions.
 *
 * All of these are third-party scripts on a page whose speed matters, so they
 * load after the page is interactive rather than blocking it. A tag that
 * measures a visit nobody waited around for is measuring the wrong thing.
 *
 * The site's own analytics do not go through here: they are first-party, need
 * no consent banner, and are not optional.
 */
export function Integrations({ config }: { config?: IntegrationsContent }) {
  if (!config?.enabled) return null;

  const {
    ga4MeasurementId,
    gtmContainerId,
    metaPixelId,
    googleAdsId,
    clarityProjectId,
  } = config;

  // Google's tag serves GA4 and Ads from the same script; loading it twice
  // would double every event it reports.
  const gtagId = ga4MeasurementId || googleAdsId;

  return (
    <>
      {gtagId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
${ga4MeasurementId ? `gtag('config','${ga4MeasurementId}');` : ''}
${googleAdsId ? `gtag('config','${googleAdsId}');` : ''}`}
          </Script>
        </>
      )}

      {gtmContainerId && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmContainerId}');`}
        </Script>
      )}

      {metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}

      {clarityProjectId && (
        <Script id="clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,'clarity','script','${clarityProjectId}');`}
        </Script>
      )}
    </>
  );
}

/**
 * Reports a form submission to whichever ad platforms are connected.
 *
 * Called alongside the site's own tracking rather than instead of it: the
 * first-party count is the one that is always right, and these are what the
 * advertising platforms need to attribute a conversion to the click that
 * caused it.
 *
 * Every call is guarded — a visitor with an ad blocker has no fbq and no gtag,
 * and that must not throw inside a form submission that has already succeeded.
 */
export function reportConversion(config?: IntegrationsContent): void {
  if (!config?.enabled || typeof window === 'undefined') return;

  try {
    const w = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      fbq?: (...args: unknown[]) => void;
    };

    if (config.googleAdsId && config.googleAdsConversionLabel && w.gtag) {
      w.gtag('event', 'conversion', {
        send_to: config.googleAdsConversionLabel,
      });
    }
    if (config.ga4MeasurementId && w.gtag) {
      w.gtag('event', 'generate_lead');
    }
    if (config.metaPixelId && w.fbq) {
      w.fbq('track', 'Lead');
    }
  } catch {
    // The enquiry is already sent. A measurement failure is not the visitor's
    // problem and must never surface as one.
  }
}
