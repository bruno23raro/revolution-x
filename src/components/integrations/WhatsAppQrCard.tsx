'use client';

// WhatsApp QR Code pairing (unofficial/Baileys)
import { useState } from 'react';
import IntegrationCard, { type IntegrationStatus } from './IntegrationCard';

export default function WhatsAppQrCard({
  status,
  onConnected,
}: {
  status?: IntegrationStatus;
  onConnected?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateQR = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/oauth/callback/whatsapp-qr?action=generate');
      if (!r.ok) {
        const d = await r.json().catch(() => ({ error: 'unknown' }));
        throw new Error(d.detail ?? d.error ?? 'Falha ao gerar QR');
      }
      const d = await r.json() as { session?: { qrCodeUrl: string; expiresAt: string } };
      setQrData(d.session ? { url: d.session.qrCodeUrl, expiresAt: d.session.expiresAt } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar QR');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQrData(null);
    setError(null);
  };

  return (
    <IntegrationCard
      channel="whatsapp"
      title="WhatsApp QR Code"
      subtitle="Não oficial · Pareamento via QR"
      icon={
        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5.636 19.364l9.254-9.254a2 2 0 012.828 0l4.243 4.243M12 4l8.364 8.364" />
        </svg>
      }
      status={status ?? { connected: false, error }}
      actions={
        <button
          onClick={generateQR}
          disabled={loading}
          className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {loading ? (
            <><span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Gerando…</>
          ) : (
            'Gerar QR'
          )}
        </button>
      }
    >
      <div className="space-y-2">
        {qrData && (
          <div className="bg-white rounded-lg p-3 text-center">
            <img
              src={qrData.url}
              alt="QR Code WhatsApp"
              className="w-48 h-48 mx-auto"
              crossOrigin="anonymous"
            />
            <p className="text-xs text-gray-500 mt-2">
              Válido até: {new Date(qrData.expiresAt).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
        <div className="text-amber-400 text-xs bg-amber-400/10 p-2 rounded">
          Aviso: método não oficial. Viola os ToS da Meta — use em conta de sacrifício.
        </div>
      </div>
    </IntegrationCard>
  );
}
