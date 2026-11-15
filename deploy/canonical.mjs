import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function addCanonical(root, origin) {
  let count = 0;
  async function walk(dir) {
    for (const entry of await readdir(dir, {withFileTypes:true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { await walk(file); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const relative = path.relative(root,file).split(path.sep).join('/');
      if (relative === '404.html' || relative.startsWith('_not-found')) continue;
      let html = await readFile(file,'utf8');
      if (!html.includes('</head>') || /<link\b[^>]*\brel=["']canonical["']/i.test(html)) continue;
      const route = relative === 'index.html' ? '/' : '/' + relative.replace(/\.html$/,'').replace(/\/index$/,'');
      const url = new URL(route, origin).href.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
      html = html.replace('</head>',`<link rel="canonical" href="${url}"/></head>`);
      await writeFile(file,html); count++;
    }
  }
  await walk(root); return count;
}
