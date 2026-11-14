'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}


const FUNNEL_STAGES = [
  { key: 'pending', label: 'Extraído', color: 'bg-gray-100', icon: '📥' },
  { key: 'first_contact', label: 'Primeiro Contato', color: 'bg-blue-100', icon: '💬' },
  { key: 'interested', label: 'Interessado', color: 'bg-yellow-100', icon: '👀' },
  { key: 'scheduled', label: 'Agendado', color: 'bg-purple-100', icon: '📅' },
  { key: 'customer', label: 'Cliente', color: 'bg-green-100', icon: '✅' },
];

export default function GrowthAnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  const loadAnalytics = useCallback(async () => {
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch(`/api/growth/analytics?days=${period}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const result = await res.json();
        setAnalytics(result.analytics);
      }
    } catch (err) {
      console.error('[GrowthAnalytics] Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Analytics de Growth</h2>
        <div className="p-12 text-center text-gray-500">
          Nenhum dado disponível para o período selecionado.
        </div>
      </div>
    );
  }

  const funnelData = analytics.funnel;
  const totalLeads = analytics.totalLeads;

  // Calculate percentages for funnel visualization
  const funnelPercentages = FUNNEL_STAGES.map(stage => ({
    ...stage,
    count: funnelData[stage.key] || 0,
    percentage: totalLeads > 0 ? ((funnelData[stage.key] || 0) / totalLeads) * 100 : 0,
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Analytics de Growth</h2>
        <div className="flex space-x-2">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`px-4 py-2 rounded ${period === days ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {days} dias
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Total de Leads</div>
          <div className="text-3xl font-bold">{totalLeads}</div>
          <div className="text-xs text-gray-400 mt-2">Período: {period} dias</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Taxa de Conversão</div>
          <div className="text-3xl font-bold text-green-600">{analytics.conversionRate}%</div>
          <div className="text-xs text-gray-400 mt-2">Lead → Cliente</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Mensagens Enviadas</div>
          <div className="text-3xl font-bold">{analytics.messages.sent}</div>
          <div className="text-xs text-gray-400 mt-2">
            {analytics.messages.received} respostas ({analytics.responseRate}%)
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500 mb-1">Custo por Lead</div>
          <div className="text-3xl font-bold">
            R$ {analytics.costPerLead?.toFixed(2) || '0.00'}
          </div>
          <div className="text-xs text-gray-400 mt-2">Média calculada</div>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h3 className="text-lg font-semibold mb-4">Funil de Conversão</h3>
        <div className="space-y-3">
          {funnelPercentages.map((stage, idx) => (
            <div key={stage.key} className="flex items-center">
              <div className="w-32 text-sm text-gray-600">
                {stage.icon} {stage.label}
              </div>
              <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                <div
                  className={`h-full ${stage.color.replace('bg-', 'bg-').replace('100', '500')} transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: `${Math.max(stage.percentage, stage.count > 0 ? 10 : 0)}%` }}
                >
                  {stage.count > 0 && (
                    <span className="text-white text-sm font-medium">
                      {stage.count}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-16 text-right text-sm text-gray-500 ml-2">
                {stage.percentage.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Source Breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Leads por Fonte</h3>
          <div className="space-y-2">
            {(Object.entries(analytics.sourceBreakdown || {}) as [string, number][]).map(([source, count]) => (
              <div key={source} className="flex justify-between items-center">
                <span className="text-gray-600 capitalize">{source}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Leads por Dia</h3>
          <div className="h-48 flex items-end space-x-1">
            {(Object.entries(analytics.leadsByDay || {}) as [string, number][])
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(-14)
              .map(([day, count]) => {
                const maxCount = Math.max(...Object.values(analytics.leadsByDay || {}).map(v => Number(v) || 0));
                return (
                <div key={day} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${(count / maxCount) * 100}px` }}
                  ></div>
                  <div className="text-xs text-gray-400 mt-1">
                    {day.slice(5)}
                  </div>
                </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Instance Performance (if available) */}
      {analytics.instancePerformance && (
        <div className="bg-white p-6 rounded-lg shadow mt-8">
          <h3 className="text-lg font-semibold mb-4">
            Performance da Instância: {analytics.instancePerformance.instanceName}
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <div className="font-medium">
                {analytics.instancePerformance.status === 'CONNECTED' ? '🟢 Conectado' : '🔴 Desconectado'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Leads</div>
              <div className="font-medium">{analytics.instancePerformance.totalLeads}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Último Heartbeat</div>
              <div className="font-medium">
                {analytics.instancePerformance.lastHeartbeat
                  ? new Date(analytics.instancePerformance.lastHeartbeat).toLocaleString('pt-BR')
                  : 'Nunca'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
