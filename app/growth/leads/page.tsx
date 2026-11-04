'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

const FUNNEL_STAGES = [
  { key: 'pending', label: 'Extraído', color: 'bg-gray-100 text-gray-800', icon: '📥' },
  { key: 'first_contact', label: 'Primeiro Contato', color: 'bg-blue-100 text-blue-800', icon: '💬' },
  { key: 'interested', label: 'Interessado', color: 'bg-yellow-100 text-yellow-800', icon: '👀' },
  { key: 'scheduled', label: 'Agendado', color: 'bg-purple-100 text-purple-800', icon: '📅' },
  { key: 'customer', label: 'Cliente', color: 'bg-green-100 text-green-800', icon: '✅' },
];

export default function GrowthLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ funnelStatus: '', notes: '' });

  useEffect(() => {
    loadLeads();
  }, [filter]);

  const loadLeads = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const params = new URLSearchParams({
        limit: '100',
        offset: '0',
      });

      if (filter !== 'all') {
        params.set('funnelStatus', filter);
      }

      const res = await fetch(`/api/growth/leads?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const result = await res.json();
        setLeads(result.leads || []);
      }
    } catch (err) {
      console.error('[GrowthLeads] Error loading leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/growth/leads/${leadId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ funnelStatus: newStatus }),
      });

      if (res.ok) {
        setLeads(prev => prev.map(lead =>
          lead.id === leadId
            ? { ...lead, funnelStatus: newStatus, updatedAt: new Date().toISOString() }
            : lead
        ));
        setEditingId(null);
      }
    } catch (err) {
      console.error('[GrowthLeads] Error updating status:', err);
    }
  };

  const handleSaveNotes = async (leadId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/growth/leads/${leadId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ notes: editData.notes }),
      });

      if (res.ok) {
        setEditingId(null);
        loadLeads();
      }
    } catch (err) {
      console.error('[GrowthLeads] Error saving notes:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">CRM de Growth — Leads</h2>
        <div className="text-sm text-gray-500">
          Total: {leads.length} leads
        </div>
      </div>

      {/* Funnel Summary */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {FUNNEL_STAGES.map(stage => {
          const count = leads.filter(l => l.funnelStatus === stage.key).length;
          return (
            <div
              key={stage.key}
              className={`${stage.color} p-4 rounded-lg text-center cursor-pointer transition-all hover:scale-105 ${filter === stage.key ? 'ring-2 ring-offset-2 ring-gray-500' : ''}`}
              onClick={() => setFilter(filter === stage.key ? 'all' : stage.key)}
            >
              <div className="text-2xl mb-2">{stage.icon}</div>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs font-medium">{stage.label}</div>
            </div>
          );
        })}
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fonte</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Funil</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Respostas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último Contato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {lead.metadata?.name || 'Sem nome'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {lead.metadata?.targetProfile || '—'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-mono">{lead.contact}</div>
                  <div className="text-xs text-gray-500">{lead.source}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.source}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === lead.id ? (
                    <select
                      value={editData.funnelStatus || lead.funnelStatus}
                      onChange={(e) => setEditData({ ...editData, funnelStatus: e.target.value })}
                      className="text-sm border rounded px-2 py-1"
                    >
                      {FUNNEL_STAGES.map(stage => (
                        <option key={stage.key} value={stage.key}>
                          {stage.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(lead.id);
                        setEditData({ funnelStatus: lead.funnelStatus, notes: '' });
                      }}
                      className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      {FUNNEL_STAGES.find(s => s.key === lead.funnelStatus)?.icon}{' '}
                      {FUNNEL_STAGES.find(s => s.key === lead.funnelStatus)?.label}
                    </button>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.responseCount || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.lastContactAt
                    ? new Date(lead.lastContactAt).toLocaleDateString('pt-BR')
                    : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {editingId === lead.id ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleStatusChange(lead.id, editData.funnelStatus)}
                        className="text-green-600 hover:text-green-900"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-red-600 hover:text-red-900"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(lead.id);
                        setEditData({ funnelStatus: lead.funnelStatus, notes: lead.notes || '' });
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Notas
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {leads.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            Nenhum lead encontrado. Inicie uma extração em /social/growth
          </div>
        )}
      </div>

      {/* Edit Notes Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Editar Lead</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Status no Funil</label>
              <select
                value={editData.funnelStatus}
                onChange={(e) => setEditData({ ...editData, funnelStatus: e.target.value })}
                className="w-full p-2 border rounded"
              >
                {FUNNEL_STAGES.map(stage => (
                  <option key={stage.key} value={stage.key}>
                    {stage.icon} {stage.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Notas</label>
              <textarea
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                className="w-full p-2 border rounded h-24"
                placeholder="Adicione notas sobre este lead..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSaveNotes(editingId)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
