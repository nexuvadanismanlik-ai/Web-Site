/**
 * Seeds the website tenant, its CMS content and an initial admin user.
 *
 * Content is read from content/site.json, which after this stage is only a
 * seed fixture and a fallback copy — the running site reads from the database.
 *
 * Idempotent: sections and the tenant/user are upserted; ordered collections
 * are replaced wholesale, since the file is the authority for their contents
 * and their ids are generated.
 *
 * Plain CommonJS on purpose — it needs no TypeScript runner, so it works the
 * same locally and on Render.
 *
 * Usage: pnpm --filter @nexuva/api db:seed
 */
const fs = require('fs');
const path = require('path');
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONTENT_PATH = path.join(__dirname, '..', '..', '..', 'content', 'site.json');

const TENANT_SLUG = process.env.WEBSITE_TENANT_SLUG || 'nexuva';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@nexuva.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nexuva123';
const ADMIN_FIRST = process.env.ADMIN_FIRST_NAME || 'Nexuva';
const ADMIN_LAST = process.env.ADMIN_LAST_NAME || 'Admin';

const SECTION_KEYS = [
  'brand',
  'hero',
  'about',
  'cta',
  'contact',
  'footer',
  'servicesMeta',
  'referencesMeta',
  'testimonialsMeta',
  'processMeta',
];

async function main() {
  const raw = fs.readFileSync(CONTENT_PATH, 'utf-8');
  const content = JSON.parse(raw);

  // ─── Tenant ───────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    create: {
      slug: TENANT_SLUG,
      type: 'HOLDING',
      name: content.brand?.siteName || 'Nexuva',
      description: content.brand?.tagline?.tr || null,
      isActive: true,
    },
    update: {
      name: content.brand?.siteName || 'Nexuva',
      description: content.brand?.tagline?.tr || null,
      isActive: true,
    },
  });
  const tenantId = tenant.id;
  console.log(`tenant        : ${tenant.slug} (${tenantId})`);

  // ─── Admin user ───────────────────────────────────────────────────────────
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: ADMIN_FIRST,
      lastName: ADMIN_LAST,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    // Re-seeding resets the password to the configured one so a forgotten
    // local password is recoverable; it never downgrades the role.
    update: { passwordHash, role: 'SUPER_ADMIN', isActive: true },
  });
  console.log(`admin user    : ${admin.email} (${admin.role})`);

  // ─── Sections (singleton JSON blocks) ─────────────────────────────────────
  let sectionCount = 0;
  for (const key of SECTION_KEYS) {
    const data = content[key];
    if (!data) {
      console.warn(`  ! section "${key}" missing from site.json — skipped`);
      continue;
    }
    await prisma.websiteSection.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, data },
      update: { data },
    });
    sectionCount++;
  }
  console.log(`sections      : ${sectionCount}`);

  // ─── Ordered collections ──────────────────────────────────────────────────
  // Replaced rather than merged: site.json is the authority for their contents
  // and the database ids are generated, so there is no stable key to match on.
  const collections = [
    {
      label: 'nav items',
      model: prisma.websiteNavItem,
      rows: (content.nav || []).map((item, i) => ({
        tenantId,
        label: item.label,
        href: item.href,
        position: i,
      })),
    },
    {
      label: 'logos',
      model: prisma.websiteLogo,
      rows: (content.logos || []).map((name, i) => ({
        tenantId,
        name,
        position: i,
      })),
    },
    {
      label: 'services',
      model: prisma.websiteService,
      rows: (content.services || []).map((s, i) => ({
        tenantId,
        icon: s.icon,
        title: s.title,
        description: s.description,
        features: s.features,
        position: i,
      })),
    },
    {
      label: 'stats',
      model: prisma.websiteStat,
      rows: (content.stats || []).map((s, i) => ({
        tenantId,
        value: s.value,
        prefix: s.prefix || null,
        suffix: s.suffix || '',
        label: s.label,
        position: i,
      })),
    },
    {
      label: 'references',
      model: prisma.websiteReference,
      rows: (content.references || []).map((r, i) => ({
        tenantId,
        name: r.name,
        category: r.category,
        position: i,
      })),
    },
    {
      label: 'testimonials',
      model: prisma.websiteTestimonial,
      rows: (content.testimonials || []).map((t, i) => ({
        tenantId,
        quote: t.quote,
        author: t.author,
        role: t.role,
        company: t.company,
        rating: t.rating ?? 5,
        position: i,
      })),
    },
    {
      label: 'process steps',
      model: prisma.websiteProcessStep,
      rows: (content.process || []).map((p, i) => ({
        tenantId,
        title: p.title,
        description: p.description,
        position: i,
      })),
    },
  ];

  for (const c of collections) {
    await c.model.deleteMany({ where: { tenantId } });
    if (c.rows.length) await c.model.createMany({ data: c.rows });
    console.log(`${c.label.padEnd(14)}: ${c.rows.length}`);
  }

  console.log('');
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error('SEED FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
