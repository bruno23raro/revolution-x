const pg = require('pg');

// Requer DATABASE_URL via variável de ambiente (segurança)
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('❌ ERRO: DATABASE_URL environment variable is required');
    console.error('   Configure via:')
    console.error('   - .env file: DATABASE_URL="postgresql://..."');
    console.error('   - Or use your .env.local with Supabase credentials');
    process.exit(1);
}

const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 10000
});

(async () => {
    try {
        console.log('🔌 Tentando conectar ao Supabase...');
        const client = await pool.connect();
        console.log('✅ Conectado com sucesso!');

        const res = await client.query('SELECT 1 as test');
        console.log('Query de teste:', res.rows);

        client.release();
        await pool.end();
        console.log('✅ Conexão encerrada');
    } catch (err) {
        console.error('❌ Erro:', err.message);
        process.exit(1);
    }
})();