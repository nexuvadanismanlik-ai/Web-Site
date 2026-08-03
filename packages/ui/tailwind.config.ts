import type { Config } from 'tailwindcss';

const nexuvaPreset: Partial<Config> = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic theme tokens — driven by CSS variables set per [data-theme]
        page: 'rgb(var(--c-page) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        overlay: 'rgb(var(--c-overlay) / <alpha-value>)',
        fg: 'rgb(var(--c-fg) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        // Primary brand — refined indigo
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Secondary accent — violet/fuchsia for premium gradients
        accent: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        // Glow highlight — cyan
        glow: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        // Deep neutral surfaces (near-black with a hint of indigo)
        ink: {
          50: '#f6f7fb',
          100: '#eceef6',
          200: '#d5d9ea',
          300: '#b0b7d3',
          400: '#848eb6',
          500: '#646d9c',
          600: '#4f5681',
          700: '#414669',
          800: '#393d59',
          900: '#12131f',
          925: '#0d0e17',
          950: '#08090f',
        },
        surface: {
          DEFAULT: '#08090f',
          50: '#fafafa',
          100: '#f4f4f5',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'Space Grotesk', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        brand: '0 0 0 3px rgba(99, 102, 241, 0.3)',
        'brand-lg': '0 20px 60px -12px rgba(99, 102, 241, 0.35)',
        'glow-brand': '0 0 40px -4px rgba(99, 102, 241, 0.45)',
        'glow-accent': '0 0 48px -6px rgba(168, 85, 247, 0.5)',
        card: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -12px rgba(15,17,31,0.18)',
        'card-lg': '0 24px 70px -24px rgba(15,17,31,0.35)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'grid-slate':
          'linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)',
        'brand-gradient': 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #06b6d4 100%)',
        'brand-gradient-soft':
          'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.12) 100%)',
        'radial-glow':
          'radial-gradient(60% 60% at 50% 0%, rgba(99,102,241,0.25) 0%, rgba(8,9,15,0) 70%)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out both',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16,1,0.3,1) both',
        marquee: 'marquee var(--marquee-duration, 40s) linear infinite',
        'marquee-reverse': 'marquee-reverse var(--marquee-duration, 40s) linear infinite',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        aurora: 'aurora 18s ease-in-out infinite alternate',
        'spin-slow': 'spin 18s linear infinite',
        'glow-pulse': 'glowPulse 4s ease-in-out infinite',
        'gradient-x': 'gradientX 6s ease infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'marquee-reverse': {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        aurora: {
          '0%': { transform: 'translate(0,0) scale(1)', opacity: '0.6' },
          '50%': { transform: 'translate(6%, -4%) scale(1.15)', opacity: '0.9' },
          '100%': { transform: 'translate(-4%, 4%) scale(1.05)', opacity: '0.7' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
};

export default nexuvaPreset;
