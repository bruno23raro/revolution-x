// Repository — não executa SQL enquanto DB não configurado
export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  email_verified: boolean;
}
export const userRepo = {
  findByEmail: async (email: string): Promise<UserRow | null> => {
    // BLOQUEADO: requer PostgreSQL + migrations
    return null;
  },
  create: async (data: Omit<UserRow, 'id'> & { id: string }): Promise<UserRow> => {
    return null as unknown as UserRow; // não executado
  },
};
