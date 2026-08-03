'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, ArrowUpRight, Globe } from 'lucide-react';
import type { Locale } from '../../lib/i18n';

export interface HeaderNavItem {
  label: string;
  href: string;
}

interface HeaderProps {
  locale: Locale;
  logoText: string;
  nav: HeaderNavItem[];
  ctaLabel: string;
}

function localized(href: string, locale: Locale) {
  return href === '/' ? `/${locale}` : `/${locale}${href}`;
}

export function Header({ locale, logoText, nav, ctaLabel }: HeaderProps) {
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

  const otherLocale: Locale = locale === 'tr' ? 'en' : 'tr';
  const switchHref = (() => {
    const segments = (pathname ?? '/').split('/').filter(Boolean);
    segments[0] = otherLocale;
    return '/' + segments.join('/');
  })();

  const isActive = (href: string) => {
    const target = localized(href, locale);
    if (href === '/') return pathname === target || pathname === `/${locale}`;
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
            <Link href={localized('/', locale)} className="group flex items-center gap-2.5 pl-2">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-xl brand-gradient-bg text-sm font-bold text-white shadow-glow-brand">
                {logoText.charAt(0)}
                <span className="absolute inset-0 rounded-xl brand-gradient-bg opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-70" />
              </span>
              <span className="font-heading text-lg font-bold text-fg">{logoText}</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 lg:flex">
              {nav.map((item, i) => (
                <Link
                  key={item.href}
                  href={localized(item.href, locale)}
                  data-edit={`nav.${i}.label`}
                  className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-fg'
                      : 'text-muted hover:text-fg'
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
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <Link
                href={switchHref}
                className="hidden items-center gap-1.5 rounded-full border border-overlay/10 bg-overlay/5 px-3 py-2 text-xs font-semibold uppercase text-muted transition-colors hover:border-overlay/25 hover:text-fg sm:flex"
                aria-label="Switch language"
              >
                <Globe className="h-3.5 w-3.5" />
                {otherLocale}
              </Link>
              <Link href={localized('/contact', locale)} className="hidden md:inline-flex">
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
                      href={localized(item.href, locale)}
                      data-edit={`nav.${i}.label`}
                      className={`block rounded-2xl px-4 py-4 font-heading text-2xl font-semibold transition-colors ${
                        isActive(item.href) ? 'gradient-text' : 'text-fg hover:text-muted'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-3">
                <Link href={switchHref} className="btn-ghost w-full justify-center">
                  <Globe className="h-4 w-4" />
                  {otherLocale === 'tr' ? 'Türkçe' : 'English'}
                </Link>
                <Link href={localized('/contact', locale)} className="btn-primary w-full justify-center">
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
