const fs = require('fs');

// Ler o .env.production existente
let content = fs.readFileSync('.env.production', 'utf8');

// Atualizar as variáveis críticas com valores de produção
content = content.replace(
  /SUPABASE_URL=.*/g,
  'SUPABASE_URL=https://urdmpzjycwywsjzhpntc.supabase.co'
);
content = content.replace(
  /SUPABASE_ANON_KEY=.*/g,
  'SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZG1wemp5Y3d5d3NqemhwbnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwOTU4MTAsImV4cCI6MjEwNTY3MTgxMH0.RtMwiIINISaokw6PyGePHyeUHGGHBLS6IF2yMPo5oQY'
);
content = content.replace(
  /SUPABASE_SERVICE_ROLE_KEY=.*/g,
  'SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZG1wemp5Y3d5d3NqemhwbnRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsIlp0Y2EiOjE3OTAwOTU4MTAsImV4cCI6MjEwNTY3MTgxMH0.Tn0Mo1eJwp0KyR68aF32mZySCyqRfqaRC0_KoPlORX8'
);
content = content.replace(
  /OPENBSP_WEBHOOK_SECRET=.*/g,
  'OPENBSP_WEBHOOK_SECRET=SBb2K3VulnLQguavAa-vT4fW-NWg4G8hq99HmNYlYfo'
);
content = content.replace(
  /NEXT_PUBLIC_SUPABASE_URL=.*/g,
  'NEXT_PUBLIC_SUPABASE_URL=https://urdmpzjycwywsjzhpntc.supabase.co'
);
content = content.replace(
  /NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/g,
  'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZG1wemp5Y3d5d3NqemhwbnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwOTU4MTAsImV4cCI6MjEwNTY3MTgxMH0.RtMwiIINISaokw6PyGePHyeUHGGHBLS6IF2yMPo5oQY'
);

// Remover o ; console.log(...) que está causando erro - usar regex correta
const regex = /; console\.log\('Writing file...'\;\r?\n/;
content = content.replace(regex, '');

fs.writeFileSync('.env.production', content, 'utf8');
console.log('Arquivo .env.production atualizado com sucesso:', content.length, 'bytes');
console.log('Variáveis críticas configuradas.');