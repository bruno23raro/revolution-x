// PM2 Ecosystem — Revolution X (Hostinger)
//
// Este arquivo configura o processo Node.js que serve o build standalone
// do Next.js na Hostinger via PM2. Copie para o servidor (ex: htpcms)
// e rode:  pm2 start ecosystem.config.js --env production
//
// IMPORTANTE: com `output: 'standalone'`, o servidor usa:
//   .next/standalone/server.js
// Ele NÃO precisa de node_modules nem de build prévio — tudo está empacotado.

module.exports = {
  apps: [
    {
      name: 'revolution-x',
      script: './.next/standalone/server.js',
      instances: 'max', // cluster mode: usa todos os cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        // As variáveis SECRETAS (DATABASE_URL, SUPABASE_*, OPENBSP_*, META_*,
        // RESEND_*, JWT_SECRET) são injetadas via .env OU painel hPanel.
        // NUNCA coloque segredos neste arquivo.
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // Previne crash-loops: se cair 5x em 10s, para de reiniciar
      max_restarts: 5,
      min_uptime: '10s',
      // Logs
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};