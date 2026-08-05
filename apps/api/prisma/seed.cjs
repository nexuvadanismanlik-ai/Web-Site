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

  await bootstrapFirstVersion(tenantId);

  console.log('');
  console.log('Seed complete.');
}

/**
 * Gives a fresh database its first published content version.
 *
 * The public site is served from a published version and nothing else — there
 * is deliberately no fallback to the draft, because a fallback would put
 * unpublished work in front of visitors whenever the version table was empty,
 * and would look like the site working normally. So an environment with content
 * but no version has a site that refuses to build, which is correct but useless
 * for a database that was just seeded.
 *
 * Idempotent: does nothing once anything is published.
 *
 * The snapshot is assembled here rather than reusing the API's assembly, which
 * is the one duplication in this file. It is deliberate — the seed runs under
 * plain node with no access to the compiled Nest application — and it is why
 * this only ever creates version 1. Every later version comes from the real
 * publish path.
 */
async function bootstrapFirstVersion(tenantId) {
  const existing = await prisma.contentVersion.count({ where: { tenantId } });
  if (existing > 0) {
    console.log(`version       : ${existing} already recorded, left alone`);
    return;
  }

  const activeOrdered = { where: { tenantId, isActive: true }, orderBy: { position: 'asc' } };
  const activeLive = {
    where: { tenantId, isActive: true, deletedAt: null },
    orderBy: { position: 'asc' },
  };

  const [sections, nav, logos, services, stats, references, testimonials, process] =
    await Promise.all([
      prisma.websiteSection.findMany({ where: { tenantId } }),
      prisma.websiteNavItem.findMany(activeOrdered),
      prisma.websiteLogo.findMany(activeOrdered),
      prisma.websiteService.findMany(activeLive),
      prisma.websiteStat.findMany(activeOrdered),
      prisma.websiteReference.findMany(activeLive),
      prisma.websiteTestimonial.findMany(activeLive),
      prisma.websiteProcessStep.findMany(activeOrdered),
    ]);

  const byKey = Object.fromEntries(sections.map((row) => [row.key, row.data]));

  const snapshot = {
    ...byKey,
    nav: nav.map((i) => ({ label: i.label, href: i.href })),
    logos: logos.map((i) => i.name),
    services: services.map((i) => ({
      id: i.id,
      icon: i.icon,
      title: i.title,
      description: i.description,
      features: i.features,
    })),
    stats: stats.map((i) => ({
      id: i.id,
      value: i.value,
      prefix: i.prefix ?? undefined,
      suffix: i.suffix,
      label: i.label,
    })),
    references: references.map((i) => ({ id: i.id, name: i.name, category: i.category })),
    testimonials: testimonials.map((i) => ({
      id: i.id,
      quote: i.quote,
      author: i.author,
      role: i.role,
      company: i.company,
      rating: i.rating,
    })),
    process: process.map((i) => ({ id: i.id, title: i.title, description: i.description })),
  };

  await prisma.contentVersion.create({
    data: {
      tenantId,
      number: 1,
      snapshot,
      isPublished: true,
      publishedAt: new Date(),
      note: 'İlk sürüm — veritabanı hazırlanırken oluşturuldu',
    },
  });

  console.log('version       : 1 created and published');
}

main()
  .catch((err) => {
    console.error('SEED FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
