'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Search, Users, DollarSign, Activity, CheckCircle, Clock, } from 'lucide-react';

interface DashboardChartProps {
  contacts?: number | undefined;
  deals?: number | undefined;
  leads?: number | undefined;
  date?: string | undefined;
}

export function DashboardChart({ contacts = 0, deals = 0, leads = 0, date }: DashboardChartProps) {
  const chartData = [
    { name: 'Contatos', uv: contacts, pv: contacts * 2 },
    { name: 'Leads', uv: leads, pv: leads * 2 },
    { name: 'Negociações', uv: deals, pv: deals * 2 },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <XAxis dataKey="name" strokeDasharray="5 5" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="uv" fill="#8884d8" name="Únicos" />
        <Bar dataKey="pv" fill="#82ca9d" name="Visualizações" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function KPIStats() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className="p-4 bg-[#0D0915] border border-white/10 rounded-lg">
        <Search className="w-6 h-6 text-purple-400" />
        <div className="mt-2 text-sm text-gray-400">Contatos</div>
      </div>
      <div className="p-4 bg-[#0D0915] border border-white/10 rounded-lg">
        <Users className="w-6 h-6 text-purple-400" />
        <div className="mt-2 text-sm text-gray-400">Leads</div>
      </div>
      <div className="p-4 bg-[#0D0915] border border-white/10 rounded-lg">
        <DollarSign className="w-6 h-6 text-purple-400" />
        <div className="mt-2 text-sm text-gray-400">Receita</div>
      </div>
      <div className="p-4 bg-[#0D0915] border border-white/10 rounded-lg">
        <Activity className="w-6 h-6 text-purple-400" />
        <div className="mt-2 text-sm text-gray-400">Atividades</div>
      </div>
    </div>
  );
}