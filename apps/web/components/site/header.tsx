'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, ArrowUpRight } from 'lucide-react';


export interface HeaderNavItem {
  label: string;
  href: string;
}

interface HeaderProps {
  logoText: string;
  /** Uploaded logo. Empty until one is added in the panel. */
  logoUrl?: string;
  nav: HeaderNavItem[];
  ctaLabel: string;
  /** Where the header button goes. Panel-managed like its label. */
  ctaHref: string;
}

/**
 * Which nav entry is a product rather than a page.
 *
 * Matched on the address rather than a flag on the record, so nothing about
 * the content model changes: the label, the order and whether the item exists
 * at all stay panel-managed, and only the styling rule lives here. Point the
 * entry somewhere else and it becomes an ordinary link, which is the correct
 * behaviour — the emphasis belongs to the product, not to the position.
 */
const PRODUCT_ROUTES = new Set(['/logiops']);

function isProduct(href: string): boolean {
  return PRODUCT_ROUTES.has(href.replace(/\/+$/, '') || '/');
}

export function Header({ logoText, logoUrl, nav, ctaLabel, ctaHref }: HeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const isActive = (href: string) => {
    const target = href;
    if (href === '/') return pathname === target || pathname === '/';
    return pathname === target || pathname?.startsWith(target + '/');
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled ? 'py-3' : 'py-5'
        }`}
      >
        <div className="container-x">
          <div
            className={`flex items-center justify-between rounded-full px-4 transition-all duration-500 ${
              scrolled
                ? 'glass-strong h-14 shadow-card-lg'
                : 'h-16 border border-transparent bg-transparent'
            }`}
          >
            {/* Logo */}
            <Link href={'/'} className="group flex items-center gap-2.5 pl-2">
              {logoUrl ? (
                // uploaded asset on a CDN, next/image is off for static export
                <img src={logoUrl} alt={logoText} className="h-8 w-auto max-w-[10rem] object-contain" />
              ) : (
                <>
                  {/* Stands in until the real mark is uploaded in the panel.
                      Drawn as a ringed serif initial because that is what the
                      actual logo is — a gradient-filled rounded square was
                      standing in for a classical monogram and looked like a
                      different company. */}
                  <span
                    className="relative flex h-9 w-9 items-center justify-center rounded-full font-heading text-sm"
                    style={{
                      border: '1px solid var(--gold)',
                      color: 'var(--gold)',
                      boxShadow: 'inset 0 0 0 3px rgb(var(--c-page))',
                    }}
                    aria-hidden
                  >
                    <span
                      className="absolute inset-[3px] rounded-full"
                      style={{ border: '1px solid color-mix(in srgb, var(--gold) 55%, transparent)' }}
                    />
                    <span className="relative">{logoText.charAt(0)}</span>
                  </span>
                  <span className="font-heading text-lg tracking-wide text-fg">{logoText}</span>
                </>
              )}
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 lg:flex">
              {nav.map((item, i) =>
                isProduct(item.href) ? (
                  /* LogiOps is a product, not a service page, and the nav has
                     to say so before somebody clicks. A gold dot and a border
                     is enough — a coloured pill among plain links would read
                     as the active tab, which is a different meaning. */
                  <Link
                    key={item.href}
                    href={item.href}
                    data-edit={`nav.${i}.label`}
                    className={`group ml-1 flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? 'border-[color:var(--gold)] text-fg'
                        : 'border-overlay/15 text-muted hover:border-[color:var(--gold)] hover:text-fg'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: 'var(--gold)' }}
                    />
                    {item.label}
                  </Link>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-edit={`nav.${i}.label`}
                    className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      isActive(item.href) ? 'text-fg' : 'text-muted hover:text-fg'
                    }`}
                  >
                    {isActive(item.href) && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 -z-10 rounded-full bg-overlay/10"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    {item.label}
                  </Link>
                ),
              )}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* data-cta belongs on the anchor, not on a span inside it: the
                  tracker resolves a click to its nearest a/button, so an
                  attribute on a child is never the element it inspects. */}
              <Link href={ctaHref} data-cta="header" className="hidden md:inline-flex">
                <span className="btn-primary !px-5 !py-2.5 text-sm">
                  {ctaLabel}
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </Link>
              <button
                onClick={() => setOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-overlay/10 bg-overlay/5 text-fg lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] lg:hidden"
          >
            <div className="absolute inset-0 bg-page/95" />
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex h-full flex-col p-6"
            >
              <div className="flex items-center justify-between">
                <span className="font-heading text-lg font-bold text-fg">{logoText}</span>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-overlay/10 bg-overlay/5 text-fg"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-10 flex flex-col gap-1">
                {nav.map((item, i) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i + 0.1 }}
                  >
                    <Link
                      href={item.href}
                      data-edit={`nav.${i}.label`}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-4 font-heading text-2xl transition-colors ${
                        isActive(item.href) ? 'text-fg' : 'text-muted hover:text-fg'
                      }`}
                    >
                      {isProduct(item.href) && (
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: 'var(--gold)' }}
                        />
                      )}
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-3">
                <Link href={ctaHref} data-cta="header-mobile" className="btn-primary w-full justify-center">
                  {ctaLabel}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
