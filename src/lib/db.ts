// Abstração de banco — não abre conexão real enquanto DATABASE_URL não existir
export const createPoolConfig = () => {
  if (!process.env.DATABASE_URL) {
    return null; // bloqueado — não invento
  }
  return {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production',
  };
};
export const isDbConfigured = () => !!process.env.DATABASE_URL;
