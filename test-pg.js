const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://revx:yzcheGaWQbK51Y0IBnNDtpioqEwfS7Fj@localhost:5434/revolution_x'
});

pool.query('SELECT 1 as test')
  .then(r => console.log('Success:', r.rows))
  .catch(e => console.error('Error:', e))
  .finally(() => pool.end());