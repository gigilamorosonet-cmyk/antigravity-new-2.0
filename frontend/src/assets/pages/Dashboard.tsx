/**
 * Anti-Gravity Multi-Agent System
 * Dashboard Page - Main overview with stats and quick actions
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Agent, Activity } from '../../lib/types';
import { 
  Activity as ActivityIcon, 
  Bot, 
  Brain, 
  TrendingUp, 
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { fetcher } from '../../lib/api';
import { useAuth } from '../../lib/contexts/AuthContext';

async function fetchStats() {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

async function fetchAgents() {
  const res = await fetch('/api/agents');
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export default function Dashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', timeRange],
    queryFn: fetchStats,
    refetchInterval: 30000,
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    refetchInterval: 60000,
  });

  const agents: Agent[] = agentsData?.agents || [];

  // Calculate stats
  const totalAgents = agents.length;
  const activeAgents = agents.filter((a: Agent) => a.status === 'active').length;
  const totalCost = stats?.total?.cost || 0;
  const totalTokens = stats?.total?.tokens || 0;
  const totalRequests = stats?.total?.n || 0;

  // Cost estimation
  const estimatedCost = (totalTokens / 1000) * 0.002;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-gray-400 mt-1">
            Bonjour{user ? `, ${user.email}` : ''} ! Voici l'état de vos agents IA
          </p>
        </div>
        
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="bg-gray-700 text-gray-200 rounded-lg px-3 py-1"
        >
          <option value="24h">24h</option>
          <option value="7d">7 jours</option>
          <option value="30d">30 jours</option>
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* TotalAgents */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Agents Actifs</p>
              <p className="text-2xl font-bold">{activeAgents}/{totalAgents}</p>
            </div>
            <Bot className="h-8 w-8 opacity-20" />
          </div>
          <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${(activeAgents / Math.max(totalAgents, 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Total Requests */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Requêtes</p>
              <p className="text-2xl font-bold">{totalRequests.toLocaleString()}</p>
            </div>
            <ActivityIcon className="h-8 w-8 opacity-20" />
          </div>
          <div className="mt-4">
            <p className="text-xs opacity-90">
              {`Estimé: ${estimatedCost.toFixed(4)} $`}
            </p>
          </div>
        </div>

        {/* Tokens Used */}
        <div className="bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Tokens</p>
              <p className="text-2xl font-bold">{totalTokens.toLocaleString()}</p>
            </div>
            <Brain className="h-8 w-8 opacity-20" />
          </div>
          <div className="mt-4">
            <TrendingUp className="h-4 w-4 inline mr-1" />
            <span className="text-xs opacity-90">
              {totalTokens > 0 ? `${((totalTokens / 1000000) * 0.002).toFixed(4)}$` : '0$'}
            </span>
          </div>
        </div>

        {/* Cost */}
        <div className="bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Coût Total</p>
              <p className="text-2xl font-bold">${totalCost.toFixed(4)}</p>
            </div>
            <DollarSign className="h-8 w-8 opacity-20" />
          </div>
          <div className="mt-4">
            <CheckCircle className="h-4 w-4 inline mr-1 text-green-300" />
            <span className="text-xs opacity-90">
              {`Coût réel: ${totalCost > 0 ? 'Calculé' : 'Pas encore utilisé'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Vos Agents</h3>
        </div>
        
        <div className="p-4">
          {agents.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h4 className="text-gray-400 mb-2">Aucun agent configuré</h4>
              <p className="text-gray-500 text-sm mb-4">
                Créez votre premier agent IA pour commencer
              </p>
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
                Créer un Agent
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent: Agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Activité Récente</h3>
        </div>
        
        <div className="p-4">
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const statusColors = {
    active: 'bg-green-500',
    idle: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  const statusLabels = {
    active: 'Actif',
    idle: 'Inactif',
    error: 'Erreur',
  };

  return (
    <div className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-white">{agent.name}</h4>
        <span className={`px-2 py-1 rounded-full text-xs ${statusColors[agent.status as keyof typeof statusColors] || 'bg-gray-500'}`}>
          {statusLabels[agent.status as keyof typeof statusLabels] || agent.status}
        </span>
      </div>
      
      <div className="text-gray-400 text-sm mb-3">
        {agent.provider} / {agent.model}
      </div>
      
      <div className="flex space-x-2">
        <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-1 rounded">
          Chat
        </button>
        <button className="flex-1 bg-gray-600 hover:bg-gray-500 text-gray-200 text-xs py-1 rounded">
          Historique
        </button>
      </div>
    </div>
  );
}

async function fetchRecentActivity() {
  const res = await fetch('/api/activity?limit=10');
  if (!res.ok) throw new Error('Failed to fetch activity');
  return res.json();
}

function RecentActivity() {
  const { data: activity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: fetchRecentActivity,
    refetchInterval: 30000,
  });

  if (!activity) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  if (activity.activity?.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400">
        <ActivityIcon className="h-8 w-8 mx-auto mb-2" />
        <p>Aucune activité récente</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activity.activity.slice(0, 5).map((item: any, index: number) => (
        <div key={index} className="flex items-start space-x-3 p-3 bg-gray-700/50 rounded-lg">
          <div className="mt-1">
            {item.cost > 0 ? (
              <DollarSign className="h-4 w-4 text-green-400" />
            ) : (
              <Clock className="h-4 w-4 text-blue-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">{item.title || item.kind}</p>
            {item.content && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                {item.content}
              </p>
            )}
            <div className="text-xs text-gray-500 mt-1">
              {item.created_at ? new Date(item.created_at).toLocaleTimeString() : 'À l\'instant'}
              {item.cost && ` • $${item.cost.toFixed(4)}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DollarSign(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3h8.25A3 3 0 0118 6.75v8.25a3 3 0 01-3 3H6.75a3 3 0 01-3-3V6.75A3 3 0 016.75 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v3.75m0 4.5v-7.5" />
    </svg>
  );
}