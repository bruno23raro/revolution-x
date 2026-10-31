"use client";

/**
 * Página UI do scraper de perfil do Instagram
 *
 * Aviso de risco persistente:
 * - Scraping público usa publicScraper.ts com guarda SSRF para evitar SSRF
 * - Mínimo 12s entre requisições (limite de 5/min)
 * - Perfis privados retornam erro claro
 * - Dados são públicos; não colete dados privados
 */

import { useState, useEffect, useRef } from 'react';

interface ScrapeProfileFormResult {
  ok: boolean;
  data?: {
    username: string;
    fullName: string;
    followersCount: number;
    followingCount: number;
    postsCount: number;
    isPrivate: boolean;
    bio: string;
    externalUrl: string | null;
    scrapedAt: string;
  };
  error?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

interface ScrapeHistoryEntry {
  id: string;
  username: string;
  data: InstagramProfileData;
  scrapedAt: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface InstagramProfileData {
  username: string;
  fullName: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isPrivate: boolean;
  bio: string;
  externalUrl: string | null;
  scrapedAt: string;
}

export default function InstagramProfileScraperPage() {
  const [username, setUsername] = useState('');
  const [result, setResult] = useState<ScrapeProfileFormResult>({ ok: false });
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<ScrapeHistoryEntry[]>([]);

  const lastScrapeRef = useRef<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username?.trim()) return;

    // Rate limit: minimum 12 seconds between requests (5 per minute)
    const now = Date.now();
    if (now - lastScrapeRef.current < 12_000) {
      const remaining = Math.ceil((12_000 - (now - lastScrapeRef.current)) / 1000);
      setResult({
        ok: false,
        error: `Rate limit: espere ${remaining} segundos antes da próxima requisição`,
        riskLevel: 'high',
      });
      return;
    }

    setIsLoading(true);
    setResult({ ok: false });

    try {
      const response = await fetch('/api/scrapers/instagram/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await response.json();
      lastScrapeRef.current = Date.now();

      if (data.ok) {
        setHistory(prev => [{
          id: Date.now().toString(),
          username: data.data?.username || username,
          data: data.data!,
          scrapedAt: data.data?.scrapedAt || new Date().toISOString(),
          riskLevel: data.riskLevel || 'medium',
        }, ...prev.slice(0, 9)]); // Keep max 10 entries
        setResult({
          ok: true,
          data: data.data,
          riskLevel: data.riskLevel,
        });
      } else {
        setResult({
          ok: false,
          error: data.error || 'Erro desconhecido',
          riskLevel: data.riskLevel || 'medium',
        });
      }
    } catch (err) {
      console.error('Scrape error:', err);
      setResult({
        ok: false,
        error: 'Erro de conexão',
        riskLevel: 'high',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Clear results after 5 seconds on success
  useEffect(() => {
    if (result.ok && result.data) {
      const timer = setTimeout(() => setResult({ ok: false }), 5000);
      return () => clearTimeout(timer);
    }
  }, [result.ok, result.data]);

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Scraper de Perfil Instagram</h1>

      {/* Risk warning */}
      <div style={{
        background: '#fff3cd',
        border: '1px solid #ffeeba',
        borderRadius: '0.5rem',
        padding: '1rem',
        marginBottom: '1.5rem',
        color: '#856404',
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem' }}>
          <strong>Aviso de Risco:</strong> Este scraper extrai apenas dados públicos de perfis Instagram.
          O scraping é limitado a 5 requisições por minuto (12s entre cada). Perfis privados não são acessíveis.
          Use apenas para dados publicamente disponíveis e respeite os termos de serviço do Instagram.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="username do perfil"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '0.375rem',
            }}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              background: '#0095f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Extraindo...' : 'Extrair Dados'}
          </button>
        </div>
      </form>

      {result.ok && result.data && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3>Resultado da Extração</h3>
          <dl style={{ display: 'grid', gap: '0.5rem 1rem', gridTemplateColumns: 'auto 1fr' }}>
            <dt style={{ color: '#64748b', fontSize: '0.875rem' }}>Username</dt>
            <dd style={{ fontFamily: 'monospace', margin: 0}}>{result.data.username}</dd>

            <dt style={{ color: '#64748b', fontSize: '0.875rem' }}>Nome Completo</dt>
            <dd style={{ margin: 0 }}>{result.data.fullName || 'Não disponível'}</dd>

            <dt style={{ color: '#64748b', fontSize: '0.875rem' }}>Seguidores</dt>
            <dd style={{ margin: 0 }}>{result.data.followersCount.toLocaleString()}</dd>

            <dt style={{ color: '#64748b', fontSize: '0.875rem' }} >Segue</dt>
            <dd style={{ margin: 0 }}>{result.data.followingCount.toLocaleString()}</dd>

            <dt style={{ color: '#64748b', fontSize: '0.875rem' }}>Posts</dt>
            <dd style={{ margin: 0 }}>{result.data.postsCount.toLocaleString()}</dd>

            <dt style={{ color: '#64748b', fontSize: '0.875rem' }}>Privado</dt>
            <dd style={{ margin: 0 }}>{result.data.isPrivate ? 'Sim' : 'Não'}</dd>

            <dt style={{ color: '#64748b', fontSize: '0.875rem' }}>Bio</dt>
            <dd style={{ margin: 0, fontStyle: 'italic' }}>{result.data.bio || 'Sem bio'}</dd>

            <dt style={{ color: '#64748b', fontSize: '0.875rem' }}>URL Externo</dt>
            <dd style={{ margin: 0 }}>{result.data.externalUrl || 'Nenhum'}</dd>

            <dt style={{ color: '#64748b', fontSize: '0.875rem' }}>Extraído em</dt>
            <dd style={{ margin: 0 }}>{new Date(result.data.scrapedAt).toLocaleString('pt-BR')}</dd>
          </dl>
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#10b981' }}>
            Risk Level: <strong>{result.riskLevel || 'medium'}</strong>
          </p>
        </div>
      )}

      {!result.ok && !isLoading && result.error && (
        <div style={{ border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.5rem', color: '#dc2626' }}>
          <p style={{ margin: 0 }}>{result.error}</p>
        </div>
      )}

      {/* Histórico de extrações */}
      {history.length > 0 && (
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
          <h3>Histórico de Extrações ({history.length})</h3>
          <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
            {history.slice(0, 5).map((entry) => (
              <li key={entry.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f1f1f1', marginBottom: '0.5rem' }}>
                <strong>{entry.username}</strong> - {entry.riskLevel}: {entry.data.isPrivate ? 'Privado' : 'Público'} - {entry.data.followersCount.toLocaleString()} followers
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}