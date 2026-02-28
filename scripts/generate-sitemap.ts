/**
 * Script para gerar sitemap.xml automaticamente
 * 
 * Execução: pnpm tsx scripts/generate-sitemap.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const SITE_URL = 'https://shadiahasan.club';

// Rotas públicas do site
const publicRoutes = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/about', priority: '0.8', changefreq: 'monthly' },
  { path: '/contact', priority: '0.7', changefreq: 'monthly' },
  { path: '/courses', priority: '0.9', changefreq: 'weekly' },
  { path: '/faq', priority: '0.6', changefreq: 'monthly' },
  { path: '/login', priority: '0.5', changefreq: 'monthly' },
  { path: '/signup', priority: '0.7', changefreq: 'monthly' },
];

function generateSitemap(): string {
  const lastmod = new Date().toISOString().split('T')[0];
  
  const urls = publicRoutes.map(route => `
  <url>
    <loc>${SITE_URL}${route.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

// Gerar e salvar sitemap
const sitemap = generateSitemap();
const outputPath = join(process.cwd(), 'client', 'public', 'sitemap.xml');

writeFileSync(outputPath, sitemap, 'utf-8');

console.log('✅ Sitemap gerado com sucesso em:', outputPath);
console.log(`📄 ${publicRoutes.length} URLs incluídas no sitemap`);
