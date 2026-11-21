import fs from 'node:fs';
const f = 'playwright.config.ts';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('webServer')) { console.log('webServer ja presente'); process.exit(0); }
const m = s.match(/defineConfig\(\s*\{/);
if (!m) { console.log('defineConfig nao encontrado'); process.exit(1); }
s = s.replace(m[0], m[0] + `
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 240000,
    stdout: 'ignore',
    stderr: 'pipe',
  },`);
fs.writeFileSync(f, s);
console.log('webServer injetado');
