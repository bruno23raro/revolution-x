'use client';

// Conexão MANUAL (sem API) — email/senha (login simulado) ou cookie/token colado.
// Suporta múltiplas contas por usuário; WhatsApp manual limitado a 5 canais.
import { useState } from 'react';

type Channel = 'instagram' | 'facebook' | 'whatsapp';

const CHANNELS: Array<{ id: Channel; label: string }> = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'whatsapp', label: 'WhatsApp' },
];

const RISK_NOTE: Record<Channel, string> = {
  instagram:
    'Método não-oficial: viola os ToS do Instagram e pode bloquear a conta. Use conta de sacrifício, sob sua responsabilidade.',
  facebook:
    'Método não-oficial: viola os ToS do Facebook e pode bloquear a conta. Use conta de sacrifício, sob sua responsabilidade.',
  whatsapp:
    'Cookie de sessão do WhatsApp Web — método não-oficial com risco de banimento do número. Máx. 5 canais.',
};

export default function ManualAccountsCard({
  whatsappUsed,
  whatsappMax,
  onConnected,
}: {
  whatsappUsed: number;
  whatsappMax: number;
  onConnected: (msg: string) => void;
}) {
  const [channel, setChannel] = useState<Channel>('instagram');
  const [method, setMethod] = useState<'password' | 'credential'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [credential, setCredential] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWhatsApp = channel === 'whatsapp';
  const effectiveMethod = isWhatsApp ? 'credential' : method;
  const limitReached = isWhatsApp && whatsappUsed >= whatsappMax;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = { channel, label };
      if (effectiveMethod === 'password') {
        body.identifier = identifier;
        body.password = password;
      } else {
        body.credential = credential;
        body.kind = isWhatsApp ? 'cookie' : 'token';
      }
      const r = await fetch('/api/integrations/manual/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        onConnected(
          d.status === 'CONNECTED'
            ? 'Conta manual conectada e verificada'
            : 'Conta manual salva — clique em Verificar quando possível',
        );
        setIdentifier('');
        setPassword('');
        setCredential('');
        setLabel('');
      } else if (r.status === 428 || d.error === 'needs_2fa') {
        setError('A plataforma pediu verificação em 2 etapas (2FA). Conecte via API Oficial ou cole o cookie manualmente.');
      } else {
        setError(d.detail ?? d.error ?? 'Falha ao conectar');
      }
    } catch {
      setError('Falha de rede');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h3 className="font-semibold text-white text-sm">Conectar conta sem API</h3>
      <p className="text-[11px] text-gray-400 mt-0.5">
        Email/senha (login simulado) ou cookie/token colado. Múltiplas contas por usuário.
      </p>

      <div className="mt-3 flex gap-1">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setChannel(c.id)}
            className={`px-2.5 py-1 text-xs rounded-lg border ${
              channel === c.id
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'border-white/10 text-gray-400 hover:bg-white/5'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {!isWhatsApp && (
        <div className="mt-2 flex gap-1">
          <button
            type="button"
            onClick={() => setMethod('password')}
            className={`px-2.5 py-1 text-[11px] rounded-lg border ${
              method === 'password' ? 'bg-white/10 border-white/25 text-white' : 'border-white/10 text-gray-400'
            }`}
          >
            Email/Senha
          </button>
          <button
            type="button"
            onClick={() => setMethod('credential')}
            className={`px-2.5 py-1 text-[11px] rounded-lg border ${
              method === 'credential' ? 'bg-white/10 border-white/25 text-white' : 'border-white/10 text-gray-400'
            }`}
          >
            Token/Cookie
          </button>
        </div>
      )}

      {effectiveMethod === 'password' ? (
        <div className="mt-3 space-y-2">
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="E-mail ou usuário"
            className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#0D0915] border border-white/10 text-white placeholder-gray-500"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Senha (usada só agora, nunca salva)"
            className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#0D0915] border border-white/10 text-white placeholder-gray-500"
          />
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            rows={3}
            placeholder={
              isWhatsApp
                ? 'Cole aqui o cookie/token de sessão do WhatsApp'
                : 'Cole aqui o access token (Graph API) ou o storageState/cookie da sessão'
            }
            className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#0D0915] border border-white/10 text-white placeholder-gray-500 font-mono resize-y"
          />
        </div>
      )}

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Apelido da conta (ex.: Loja SP)"
        className="mt-2 w-full px-3 py-1.5 text-xs rounded-lg bg-[#0D0915] border border-white/10 text-white placeholder-gray-500"
      />

      {isWhatsApp && (
        <p className="mt-2 text-[11px] text-gray-400">
          Canais WhatsApp manuais: {whatsappUsed}/{whatsappMax}
        </p>
      )}

      <button
        onClick={() => void submit()}
        disabled={busy || limitReached}
        className="mt-3 w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40"
      >
        {busy ? 'Conectando…' : limitReached ? 'Limite de 5 canais atingido' : 'Conectar conta manual'}
      </button>

      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
      <p className="mt-2 text-[10px] text-amber-500/80">{RISK_NOTE[channel]}</p>
    </div>
  );
}
