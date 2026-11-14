'use client';

/* eslint-disable */
import { useState, useEffect, useCallback } from 'react';
import { formatE164, EvolutionService } from '@/services/evolution/EvolutionService';

// Supabase client via browser (padrão do app Next.js SSR)
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return (global as any).supabase || require('@supabase/ssr').createBrowserClient(supabaseUrl, supabaseAnonKey);
}


export default function SocialGrowthPage() {
  // Autenticação - padrão do app Revolution X
  const user = {
    id: 'anonymous',
    organizationId: '9d7114cd-013e-4e03-b91d-848518bf6514', // Organização de produção
  };

  const organizationId = user.organizationId;

  // State
  const [targetProfile, setTargetProfile] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'todos' | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');

  // Load existing leads from growth_leads table
  useEffect(() => {
    loadLeads();
  }, [organizationId]);

  const loadLeads = async () => {
    try {
      const { data, error } = await getSupabase()
        .from('growth_leads')
        .select('*')
        .eq('organizationId', organizationId)
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setLeadsList(data || []);
    } catch (err) {
      console.error('[SocialGrowth] Error loading leads:', err);
    }
  };

  const handleTargetProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetProfile(e.target.value);
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCity(e.target.value);
  };

  const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGender(e.target.value as 'M' | 'F' | 'todos');
  };

  const extractLeads = useCallback(async () => {
    if (!targetProfile && !city) {
      alert('Informe pelo menos um perfil alvo ou cidade');
      return;
    }

    setIsExtracting(true);
    setExtractionProgress(0);

    try {
      // Enviar requisição para o n8n via webhook
      const evolution = new EvolutionService();

      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/social/growth/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          targetProfile: targetProfile || undefined,
          city: city || undefined,
          gender: gender === 'todos' ? undefined : gender,
          provider: 'instaloader' as const,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Extraction webhook failed: ${res.status} - ${errText}`);
      }

      const result = await res.json();
      const newLeads = result.newLeads || [];

      // Inserir leads no banco
      if (newLeads.length > 0) {
        const { error: insertError } = await getSupabase()
          .from('growth_leads')
          .insert(newLeads.map((lead: any) => ({
            id: crypto.randomUUID(),
            organizationId,
            source: 'instagram',
            contact: formatE164(lead.contact || ''),
            metadata: {
              name: lead.name || '',
              instagramUsername: lead.username || '',
              targetProfile: targetProfile || city || gender || '',
              ...lead.metadata,
            },
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })));

        if (insertError) throw insertError;
      }

      // Atualizar lista local
      setLeadsList(prev => {
        // Evitar duplicatas pelo contact + organizationId
        const exists = new Set(prev.map((l: any) => l.contact));
        return [...prev, ...newLeads.filter((l: any) => !exists.has(l.contact))];
      });

      setExtractionProgress(100);
      alert(`Extraídos ${newLeads.length} leads!`);

    } catch (err) {
      console.error('[SocialGrowth] Error extracting leads:', err);
      alert(`Erro na extração: ${(err as Error).message}`);
    } finally {
      setIsExtracting(false);
    }
  }, [targetProfile, city, gender, organizationId]);

  const sendWhatsAppMessages = useCallback(async () => {
    if (selectedLeads.length === 0) {
      alert('Selecione pelo menos um lead');
      return;
    }

    if (!messageText.trim()) {
      alert('Digite uma mensagem');
      return;
    }

    if (!targetProfile && !city) {
      alert('Nenhuma instância Evolution conectada');
      return;
    }

    setSending(true);

    try {
      const evolution = new EvolutionService();

      // Processar em lotes
      const batchSize = 50;
      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < selectedLeads.length; i += batchSize) {
        const batch = selectedLeads.slice(i, i + batchSize);

        const promises = batch.map(async (contact) => {
          try {
            const formattedPhone = formatE164(contact);

            const payload = {
              instanceName: targetProfile || 'default',
              to: formattedPhone,
              text: messageText,
              kind: 'text' as const,
            };

            const result = await evolution.sendMessage(payload);

            if (result.success) {
              // Atualizar status do lead
              await getSupabase()
                .from('growth_leads')
                .update({ status: 'sent' })
                .eq('organizationId', organizationId)
                .eq('contact', formattedPhone);

              sentCount++;
            } else {
              failedCount++;
            }
          } catch (e) {
            failedCount++;
          }
        });

        await Promise.all(promises);

        // Pausa entre lotes
        if (i + batchSize < selectedLeads.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      alert(`Enviado: ${sentCount} | Falhas: ${failedCount}`);

    } catch (err) {
      console.error('[SocialGrowth] Error sending WhatsApp messages:', err);
      alert(`Erro no envio: ${(err as Error).message}`);
    } finally {
      setSending(false);
      setSelectedLeads([]);
      setMessageText('');
    }
  }, [selectedLeads, messageText, targetProfile, organizationId]);

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">Social Growth</h2>

      {/* Section: Extraction Configuration */}
      <div className="mb-6 p-4 rounded bg-gray-50 border border-gray-200">
        <h3 className="text-xl font-semibold mb-4">Configurar Extração</h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Perfil Alvo do Instagram</label>
            <input
              type="text"
              placeholder="Ex: @influencer, @lojavirtual"
              value={targetProfile}
              onChange={handleTargetProfileChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Cidade/Localização</label>
            <input
              type="text"
              placeholder="Ex: São Paulo, Rio de Janeiro"
              value={city}
              onChange={handleCityChange}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Gênero</label>
          <select
            value={gender ?? 'todos'}
            onChange={(e) => setGender(e.target.value as 'M' | 'F' | 'todos')}
            className="w-full p-2 border rounded"
          >
            <option value="">Todos</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </div>

        <button
          onClick={extractLeads}
          className="btn btn-primary w-full"
          disabled={isExtracting || !targetProfile}
        >
          {isExtracting ? 'Extraindo...' : 'Iniciar Extração'}
        </button>

        {isExtracting && (
          <div className="mt-3 p-3 rounded bg-blue-50 text-blue-200">
            <p className="text-xs">Enviando para o n8n... progress: {extractionProgress}%</p>
          </div>
        )}
      </div>

      {/* Section: Leads Table */}
      <div className="mb-6 p-4 rounded bg-gray-50 border border-gray-200">
        <h3 className="text-xl font-semibold mb-4">📊 Leads Extraídos ({leadsList.length})</h3>

        {leadsList.length === 0 && (
          <p className="text-sm text-gray-500 mb-4">Nenhum lead extraído ainda. Clique em "Iniciar Extração" acima.</p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="p-3 text-left text-xs font-medium text-gray-500">Nome</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500">WhatsApp</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="p-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leadsList.map((lead: any, index: number) => (
                <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="p-3">{lead.metadata?.name || 'Sem nome'}</td>
                  <td className="p-3">
                    <div className="text-sm font-mono break-all">{lead.contact || '—'}</div>
                    <span className="text-xs text-gray-400">{lead.source || 'instagram'}</span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`p-1 rounded text-xs ${lead.status === 'sent' ? 'bg-green-100 text-green-800' : lead.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}
                    >
                      {lead.status || 'pending'}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setSelectedLeads(prev => [...prev, lead.contact])}
                      className="btn btn-secondary text-xs"
                      title="Selecionar para disparo"
                    >
                      ✓
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary stats */}
        <div className="mt-4 flex justify-between text-sm">
          <span>Pending: {leadsList.filter((l: any) => l.status !== 'sent').length}</span>
          <span>Enviados: {leadsList.filter((l: any) => l.status === 'sent').length}</span>
        </div>
      </div>

      {/* Section: Mass Send WhatsApp */}
      <div className="mb-6 p-4 rounded bg-gray-50 border border-gray-200">
        <h3 className="text-xl font-semibold mb-4">📤 Disparo em Massa via WhatsApp</h3>

        <p className="text-sm text-gray-500 mb-3">
          Envie uma mensagem para os leads selecionados usando a instância Evolution API conectada.
        </p>

        <textarea
          placeholder="Digite sua mensagem de disparo..."
          rows={3}
          onChange={(e) => setMessageText(e.target.value)}
          className="w-full p-2 border rounded mb-3 h-24"
          disabled={sending}
        ></textarea>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Instância</label>
          <select
            onChange={(e) => setTargetProfile(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          >
            <option value="">Selecione uma instância conectada</option>
            {leadsList.length > 0 && (
              <option value={leadsList[0]?.metadata?.targetProfile || 'default'}>
                {leadsList[0]?.metadata?.targetProfile || 'default'}
              </option>
            )}
          </select>
        </div>

        <button
          onClick={sendWhatsAppMessages}
          className="btn btn-primary w-full"
          disabled={sending || selectedLeads.length === 0 || !messageText.trim()}
        >
          {sending ? 'Enviando...' : `Enviar para ${selectedLeads.length} leads`}
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
