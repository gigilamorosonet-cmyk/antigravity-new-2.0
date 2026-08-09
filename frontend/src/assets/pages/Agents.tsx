/**
 * Anti-Gravity Multi-Agent System
 * Agents Page - Agent management and creation
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Agent } from '../../lib/types';
import { Plus, Edit, Trash2, ChevronDown, Save, RefreshCw } from 'lucide-react';

const providers = [
  { id: 'anthropic', name: 'Anthropic', models: ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3'] },
  { id: 'openrouter', name: 'OpenRouter', models: ['nousresearch/hermes-4-70b', 'meta-llama/llama-3.3-70b', 'google/gemini-2.5-pro'] },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'o3'] },
  { id: 'mistral', name: 'Mistral', models: ['mistral-large-latest', 'mistral-small-latest'] },
  { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'custom', name: 'Custom', models: [] },
];

export default function Agents() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('openrouter');
  const [formData, setFormData] = useState({
    name: '',
    type: 'agent',
    provider: 'openrouter',
    model: 'nousresearch/hermes-4-70b',
    system_prompt: 'Tu es un assistant IA utile et direct.',
    color: '#6366f1',
  });

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await fetch('/api/agents');
      return res.json();
    },
    refetchInterval: 60000,
  });

  const createMutation = useMutation({
    mutationFn: async (agent: any) => {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowCreateModal(false);
      setFormData({
        name: '',
        type: 'agent',
        provider: 'openrouter',
        model: 'nousresearch/hermes-4-70b',
        system_prompt: 'Tu es un assistant IA utile et direct.',
        color: '#6366f1',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return fetch(`/api/agents/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const handleCreate = () => {
    if (formData.name.trim()) {
      createMutation.mutate(formData);
    }
  };

  const agents: Agent[] = data?.agents || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Agents</h2>
          <p className="text-gray-400 mt-1">
            Gérez vos agents IA et leurs configurations
          </p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Créer un Agent
        </button>
      </div>

      {/* Agents Grid */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-300">
          Erreur de chargement des agents
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: Agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDelete={() => deleteMutation.mutate(agent.id)}
            />
          ))}
          
          {agents.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Plus className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-gray-400 mb-2">Aucun agent configuré</h3>
              <p className="text-gray-500 mb-4">
                Créez votre premier agent IA pour commencer
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
              >
                Créer un Agent
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateAgentModal
          formData={formData}
          setFormData={setFormData}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreate}
          selectedProvider={selectedProvider}
          setProvider={setSelectedProvider}
          providers={providers}
          isLoading={createMutation.isLoading}
        />
      )}
    </div>
  );
}

function AgentCard({ agent, onDelete }: { agent: Agent; onDelete: () => void }) {
  const [showMenu, setShowMenu] = useState(false);

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
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-medium text-white mb-1">{agent.name}</h3>
          <p className="text-sm text-gray-400 mb-2">{agent.provider} / {agent.model}</p>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded-full text-xs ${statusColors[agent.status as keyof typeof statusColors] || 'bg-gray-500'}`}>
              {statusLabels[agent.status as keyof typeof statusLabels] || agent.status}
            </span>
            <span className="text-xs text-gray-500">
              Créé: {agent.created_at ? new Date(agent.created_at).toLocaleDateString() : 'Inconnu'}
            </span>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-10">
              <button className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700">
                <Edit className="h-4 w-4 mr-2 inline" />
                Modifier
              </button>
              <button 
                onClick={onDelete}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700"
              >
                <Trash2 className="h-4 w-4 mr-2 inline" />
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateAgentModal({ 
  formData, 
  setFormData, 
  onClose, 
  onSave,
  selectedProvider,
  setProvider,
  providers,
  isLoading 
}: any) {
  const currentProvider = providers.find(p => p.id === selectedProvider);
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">Créer un Nouvel Agent</h3>
        
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nom</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Mon Agent IA"
              className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Fournisseur</label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                const newProvider = e.target.value;
                setProvider(newProvider);
                setFormData({
                  ...formData,
                  provider: newProvider,
                  model: providers.find(p => p.id === newProvider)?.models[0] || ''
                });
              }}
              className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Modèle</label>
            <select
              value={formData.model}
              onChange={(e) => setFormData({...formData, model: e.target.value})}
              className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {currentProvider?.models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Prompt Système</label>
            <textarea
              value={formData.system_prompt}
              onChange={(e) => setFormData({...formData, system_prompt: e.target.value})}
              rows={3}
              className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Couleur</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({...formData, color: e.target.value})}
                className="w-10 h-10 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({...formData, color: e.target.value})}
                className="flex-1 bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-center"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700"
          >
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={isLoading || !formData.name.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}