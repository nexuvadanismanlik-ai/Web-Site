# Site photographs — sources and licence

All photographs used by the website are from Unsplash and are listed in
`apps/web/lib/imagery.ts`. Each download was registered through the Unsplash
API on 21.11.2026, and the images are served from Unsplash's CDN
(`images.unsplash.com`), as the Unsplash API guidelines ask.

**Licence:** [Unsplash License](https://unsplash.com/license). It allows free
commercial and non-commercial use without permission. It does not allow selling
unaltered copies or using the photos to build a competing image service.
Attribution is not required, but the site credits each photographer under the
photo bands. None of these are Unsplash+ photos.

| Where | Photo | Photographer | Unsplash page |
|---|---|---|---|
| Home hero | Istanbul and the Bosphorus bridge at night | Joshua Kettle | https://unsplash.com/photos/cmWcpcscSGA |
| Home, photo band 1 | Team working in a modern office | Beatriz Cattel | https://unsplash.com/photos/LycaA7rWsHc |
| Home, photo band 2 | Reporting dashboard on a laptop | Stephen Dawson | https://unsplash.com/photos/qwtCeJ5cLYs |
| LogiOps hero | Container port and cranes from above | Cosmin Andrei Buzamat | https://unsplash.com/photos/CF283DEKses |
| LogiOps, air | Wide-body aircraft on the apron | Toni Pomar | https://unsplash.com/photos/XtqboezYdBQ |
| LogiOps, sea | Container ship at port, aerial | Daniel Miksha | https://unsplash.com/photos/4ZornyPnGlA |
| LogiOps, road | Two trucks on a highway | Bhargav Panchal | https://unsplash.com/photos/P0bVatS8Jdw |

A photo uploaded in the panel for the home hero background replaces the
Istanbul photo automatically.

## Loading

- Hero photos load eagerly with `fetchpriority="high"` and a `srcset` from
  640 to 2400 px wide; every other photo has `loading="lazy"`.
- Unsplash serves WebP or AVIF to browsers that accept them (`auto=format`).
- Every photo sits in a box whose size is set by CSS (absolute fill or a fixed
  aspect ratio), so loading a photo cannot shift the layout.
- `<link rel="preconnect" href="https://images.unsplash.com">` is in the
  document head.
