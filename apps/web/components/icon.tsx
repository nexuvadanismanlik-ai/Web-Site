import type { ComponentType } from 'react';
import {
  Compass,
  Code2,
  Cloud,
  TrendingUp,
  ShieldCheck,
  Palette,
  Target,
  Users,
  Zap,
  ArrowRight,
  ArrowUpRight,
  Menu,
  X,
  Check,
  Star,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  Quote,
  ChevronRight,
  Globe,
  Send,
  CheckCircle2,
  Rocket,
  Layers,
  BarChart3,
} from 'lucide-react';

// Loose on purpose: lucide's ForwardRefExoticComponent props clash with a
// stricter signature under exactOptionalPropertyTypes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
type IconComponent = ComponentType<any>;

// Brand/social marks — kept as local SVGs because lucide-react is deprecating
// its brand icons (and Next's barrel optimizer trips over them).
function LinkedinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.9 1.153h3.68l-8.04 9.19L24 22.846h-7.41l-5.8-7.58-6.63 7.58H.47l8.6-9.83L0 1.153h7.6l5.24 6.93 6.06-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41z" />
    </svg>
  );
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.755-1.333-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.5 11.5 0 0 1 3-.405c1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function InstagramMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const iconMap: Record<string, IconComponent> = {
  compass: Compass,
  code: Code2,
  cloud: Cloud,
  'trending-up': TrendingUp,
  shield: ShieldCheck,
  palette: Palette,
  target: Target,
  users: Users,
  zap: Zap,
  rocket: Rocket,
  layers: Layers,
  'bar-chart': BarChart3,
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  menu: Menu,
  x: X,
  check: Check,
  star: Star,
  mail: Mail,
  phone: Phone,
  'map-pin': MapPin,
  sparkles: Sparkles,
  quote: Quote,
  'chevron-right': ChevronRight,
  globe: Globe,
  send: Send,
  'check-circle': CheckCircle2,
  // social marks
  linkedin: LinkedinMark,
  twitter: XMark,
  github: GithubMark,
  instagram: InstagramMark,
};

export function Icon({
  name,
  className,
  strokeWidth = 2,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) {
  const Cmp = iconMap[name] ?? Sparkles;
  return <Cmp className={className} strokeWidth={strokeWidth} />;
}
