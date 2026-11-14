'use client';

/* eslint-disable */
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { formatE164, EvolutionService, SendMessagePayload } from '@/services/evolution/EvolutionService';

// Supabase client via browser (padrão do app Next.js SSR)
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}


export default function WhatsAppGrowthPage() {
  // Autenticação - padrão do app Revolution X
  const user = {
    id: 'anonymous', // Em produção, viria do getAuthenticatedUser(req)
    organizationId: '9d7114cd-013e-4e03-b91d-848518bf6514', // Organização de produção (será substituído pelo usuário logado)
  };

  const organizationId = user.organizationId;

  // State
  const [instances, setInstances] = useState<any[]>([]);
  const [currentInstance, setCurrentInstance] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageRecipients, setMessageRecipients] = useState<string[]>([]);
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [leadFilters, setLeadFilters] = useState<{ city?: string; gender?: 'M' | 'F' | null; profile?: string; limit?: number }>({});
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);

  // Load instances on mount
  useEffect(() => {
    if (organizationId) loadInstances();
  }, [organizationId]);

  const loadInstances = async () => {
    try {
      const { data, error } = await getSupabase()
        .from('whatsapp_instances')
        .select('*')
        .eq('organizationId', organizationId);

      if (error) throw error;
      setInstances(data || []);
    } catch (err) {
      console.error('[WhatsAppGrowth] Error loading instances:', err);
    }
  };

  const connectInstance = useCallback(async (name: string) => {
    setConnecting(true);
    setQrCode(null);
    setCurrentInstance(name);

    try {
      // Gerar QR code via Evolution API
      const evolution = new EvolutionService();
      const { qrCode: code } = await evolution.generateQRCode(name);
      setQrCode(code);

      // Atualizar status no banco via RLS
      const { error: dbError } = await getSupabase()
        .from('whatsapp_instances')
        .upsert({
          id: crypto.randomUUID(),
          organizationId,
          instanceName: name,
          status: 'CONNECTED',
          qrCode: code,
          updatedAt: new Date().toISOString(),
        }, {
          onConflict: 'organizationId,instanceName',
        });

      if (dbError) throw dbError;
    } catch (err) {
      console.error('[WhatsAppGrowth] Error connecting instance:', err);
      setCurrentInstance(null);
      setQrCode(null);
    } finally {
      setConnecting(false);
    }
  }, [organizationId]);

  const disconnectInstance = useCallback(async () => {
    setDisconnecting(true);

    try {
      if (currentInstance) {
        // Atualizar status no banco
        await getSupabase()
          .from('whatsapp_instances')
          .update({ status: 'DISCONNECTED', qrCode: null, updatedAt: new Date().toISOString() })
          .eq('organizationId', organizationId)
          .eq('instanceName', currentInstance);

        // Remover da lista local
        setInstances(prev => prev.filter(inst => inst.instanceName !== currentInstance));
        setCurrentInstance(null);
        setQrCode(null);
      }
    } catch (err) {
      console.error('[WhatsAppGrowth] Error disconnecting instance:', err);
    } finally {
      setDisconnecting(false);
    }
  }, [currentInstance, organizationId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const values = e.target.value.split('\n')
      .filter((v: string) => v.trim())
      .map((v: string) => v.trim());
    setMessageRecipients(values);
  };

  const formatPhone = useCallback((phone: string): string => {
    return formatE164(phone);
  }, []);

  const extractInstagramLeads = useCallback(async () => {
    if (!currentInstance) {
      alert('Conecte uma instância primeiro');
      return;
    }

    setIsExtracting(true);
    setExtractionProgress(0);

    try {
      // O front-end consulta o Evolution API para fetchAllMembers do grupo
      // Esta é uma chamada direta ao endpoint do Evolution API
      const evolution = new EvolutionService();

      const res = await fetch(`${evolution.baseUrl}/group/fetch-all-members/${currentInstance}`, {
        method: 'POST',
        headers: {
          ...evolution.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...leadFilters, limit: 500 }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Extraction failed: ${errText}`);
      }

      const result = await res.json();
      const members = result.members || [];

      // Transformar membros em leads (contacts with phone numbers)
      const newLeads: any[] = members.map((member: any) => {
        const phone = member.waId || member.phoneNumber || '';
        return {
          id: crypto.randomUUID(),
          organizationId,
          source: 'instagram',
          contact: formatPhone(phone),
          metadata: {
            name: member.name,
            instagramProfile: member.instagramUsername,
            groupId: currentInstance,
            ...leadFilters,
          },
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      // Inserir no banco
      if (newLeads.length > 0) {
        const { error: insertError } = await getSupabase()
          .from('growth_leads')
          .insert(newLeads);

        if (insertError) throw insertError;
      }

      // Atualizar lista local
      setLeadsList(prev => [...prev, ...newLeads]);
      setExtractionProgress(100);

      // Feedback visual
      alert(`Extraídos ${newLeads.length} leads do grupo!`);

    } catch (err) {
      console.error('[WhatsAppGrowth] Error extracting leads:', err);
      alert(`Erro na extração: ${(err as Error).message}`);
    } finally {
      setIsExtracting(false);
    }
  }, [currentInstance, leadFilters, organizationId]);

  const sendMassMessage = useCallback(async () => {
    if (!currentInstance) {
      alert('Conecte uma instância primeiro');
      return;
    }

    if (messageRecipients.length === 0) {
      alert('Adicione números de telefone');
      return;
    }

    setSending(true);

    try {
      // Processar em lotes para evitar rate limiting
      const batchSize = 50;
      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < messageRecipients.length; i += batchSize) {
        const batch = messageRecipients.slice(i, i + batchSize);

        const promises = batch.map(async (to) => {
          try {
            // Formatar número se necessário
            const formattedPhone = formatPhone(to);

            const evolution = new EvolutionService();
            const payload: SendMessagePayload = {
              instanceName: currentInstance,
              to: formattedPhone,
              text: messageText,
              kind: 'text',
            };

            const result = await evolution.sendMessage(payload);

            // Salvar no growth_leads se enviar com sucesso
            if (result.success) {
              await getSupabase().from('growth_leads').insert({
                id: crypto.randomUUID(),
                organizationId,
                source: 'evolution_direct',
                contact: formattedPhone,
                metadata: {
                  groupId: currentInstance,
                  sentAt: new Date().toISOString(),
                },
                status: 'sent',
                createdAt: new Date(),
                updatedAt: new Date(),
              });
              sentCount++;
            } else {
              failedCount++;
            }
          } catch (e) {
            failedCount++;
          }
        });

        await Promise.all(promises);

        // Pequena pausa entre lotes para evitar rate limiting
        if (i + batchSize < messageRecipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      alert(`Enviado: ${sentCount} | Falhas: ${failedCount}`);

    } catch (err) {
      console.error('[WhatsAppGrowth] Error sending mass message:', err);
      alert(`Erro no envio: ${(err as Error).message}`);
    } finally {
      setSending(false);
      setMessageRecipients([]);
      setMessageText('');
    }
  }, [currentInstance, messageText, messageRecipients, organizationId]);

  const addLeadsFromExtraction = useCallback((newLeads: any[]) => {
    setLeadsList(prev => {
      // Evitar duplicatas pelo contact + organizationId
      const exists = new Set(prev.map((l: any) => l.contact));
      return [...prev, ...newLeads.filter((l: any) => !exists.has(l.contact))];
    });
  }, []);

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">WhatsApp Growth</h2>

      {/* Section: Instance Management */}
      <div className="mb-6 p-4 rounded bg-gray-50 border border-gray-200">
        <h3 className="text-xl font-semibold mb-4">Gerenciar Instância</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Instância</label>
          <select onChange={(e) => connectInstance(e.target.value)} className="w-full p-2 border rounded" disabled={connecting}>
            <option value="">Selecione uma instância</option>
            {instances.map((inst: any) => (
              <option
                key={inst.instanceName}
                value={inst.instanceName}
                disabled={inst.status === 'CONNECTED'}
              >
                {inst.instanceName} - {inst.status}
              </option>
            ))}
          </select>
        </div>

        {connecting && (
          <div className="p-3 rounded bg-blue-100 text-blue-800 mb-3">
            <p>Gerando QR Code...</p>
          </div>
        )}

        {currentInstance && qrCode && (
          <div className="p-4 rounded bg-blue-500 text-white mb-4">
            <p>Escaneie o QR Code com o WhatsApp:</p>
            <img
              src={`data:image/png;base64,${qrCode}`}
              alt="QR Code"
              width={200}
              className="mt-2 mb-2"
            />
            <p className="text-sm opacity-80">Após escanear, instância ficará CONECTED</p>
            <button
              onClick={disconnectInstance}
              className="mt-2 btn btn-secondary"
              disabled={disconnecting}
            >
              {disconnecting ? 'Desconectando...' : 'Desconectar'}
            </button>
          </div>
        )}

        {currentInstance && !qrCode && (
          <p className="text-sm text-green-600">Instância conectada ativamente</p>
        )}

        {!currentInstance && !connecting && (
          <p className="text-sm text-gray-500">Nenhuma instância conectada. Selecione acima ou crie uma nova.</p>
        )}
      </div>

      {/* Section: Group Extraction */}
      <div className="mb-6 p-4 rounded bg-gray-50 border border-gray-200">
        <h3 className="text-xl font-semibold mb-4">Extrair Membros do Grupo</h3>

        <p className="text-sm text-gray-500 mb-3">
          Extraia números de WhatsApp de um grupo usando a Evolution API.
        </p>

        {/* Filtros de extração */}
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Cidade</label>
          <input
            type="text"
            placeholder="Ex: São Paulo"
            value={leadFilters.city || ''}
            onChange={(e) => setLeadFilters({ ...leadFilters, city: e.target.value })}
            className="w-full p-2 border rounded"
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Gênero</label>
          <select
            value={leadFilters.gender || ''}
            onChange={(e) => setLeadFilters({ ...leadFilters, gender: e.target.value as 'M' | 'F' })}
            className="w-full p-2 border rounded"
          >
            <option value="">Todos</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Perfil Alvo (nickname)</label>
          <input
            type="text"
            placeholder="Ex: influencer, loja, etc."
            value={leadFilters.profile || ''}
            onChange={(e) => setLeadFilters({ ...leadFilters, profile: e.target.value })}
            className="w-full p-2 border rounded"
          />
        </div>

        <button
          onClick={extractInstagramLeads}
          className="btn btn-primary mb-3"
          disabled={isExtracting || !currentInstance}
        >
          {isExtracting ? 'Extraindo...' : `Extrair Membros (${leadFilters.city || ''}${leadFilters.profile ? ` | ${leadFilters.profile}` : ''})`}
        </button>

        {isExtracting && (
          <div className="progress progress-sm mb-3">
            <div className="progress-bar" role="progressbar"
              style={{ width: `${extractionProgress}%` }}
              aria-valuenow={extractionProgress}
              aria-valuemin={0}
              aria-valuemax={100}>
              {extractionProgress}%
            </div>
          </div>
        )}

        {/* Preview of extracted leads */}
        {leadsList.length > 0 && (
          <div className="mt-4 p-3 rounded bg-green-50 border border-green-200">
            <p className="text-sm font-medium">📊 {leadsList.length} leads extraídos:</p>
            <ul className="text-xs text-green-700 mt-1">
              {leadsList.slice(0, 5).map((lead: any, i: number) => (
                <li key={i}>{lead.contact}: {lead.metadata.name || 'Sem nome'}</li>
              ))}
            </ul>
            {leadsList.length > 5 && (
              <span className="text-xs">+{leadsList.length - 5} mais</span>
            )}
          </div>
        )}
      </div>

      {/* Section: Mass Send */}
      <div className="mb-6 p-4 rounded bg-gray-50 border border-gray-200">
        <h3 className="text-xl font-semibold mb-4">Disparo em Massa</h3>

        <p className="text-sm text-gray-500 mb-3">
          Envie uma mensagem para múltiplos números de uma só vez (sem necessidade de templates).
        </p>

        <textarea
          placeholder="5511987654321\n5511987654322\n5511987654323"
          rows={3}
          onChange={handleTextChange}
          className="w-full p-2 border rounded mb-3 h-32"
          disabled={sending}
        ></textarea>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Mensagem</label>
          <textarea
            placeholder="Digite sua mensagem aqui..."
            rows={2}
            onChange={(e) => setMessageText(e.target.value)}
            className="w-full p-2 border rounded h-20"
            disabled={sending}
          ></textarea>
        </div>

        <button
          onClick={sendMassMessage}
          className="btn btn-primary w-full"
          disabled={sending || !currentInstance || messageRecipients.length === 0}
        >
          {sending ? 'Enviando...' : `Enviar para ${messageRecipients.length} números`}
        </button>

        {sending && (
          <div className="mt-3 p-3 rounded bg-gray-200">
            <p className="text-xs">Enviando em lotes de 50 para evitar rate limiting...</p>
          </div>
        )}
      </div>
    </div>
  );
}
