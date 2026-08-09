/**
 * Anti-Gravity Multi-Agent System
 * Settings Page - Configuration and provider management
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Settings as SettingsIcon, Shield, Webhook, Mail, Database, RefreshCw, Save } from 'lucide-react';

interface ProviderConfig {
  provider: string;
  key?: string;
  base_url?: string;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'api-keys' | 'integrations' | 'database' | 'security' | 'general'>('api-keys');
  const [showAddKey, setShowAddKey] = useState(false);
  const [newKey, setNewKey] = useState<ProviderConfig>({ provider: 'anthropic' });
  
  const queryClient = useQueryClient();

  const { data: keys, isLoading: keysLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await fetch('/api/keys');
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      return res.json();
    },
  });

  const addKeyMutation = useMutation({
    mutationFn: async (key: ProviderConfig) => {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(key),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['api-keys']);
      setShowAddKey(false);
      setNewKey({ provider: 'anthropic' });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (provider: string) => {
      return fetch(`/api/keys/${provider}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['api-keys']);
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settingsData: any) => {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['settings']);
    },
  });

  const providers = [
    { id: 'anthropic', name: 'Anthropic', color: 'iris' },
    { id: 'openai', name: 'OpenAI', color: 'green' },
    { id: 'openrouter', name: 'OpenRouter', color: 'purple' },
    { id: 'mistral', name: 'Mistral', color: 'blue' },
    { id: 'deepseek', name: 'DeepSeek', color: 'cyan' },
    { id: 'groq', name: 'Groq', color: 'blue' },
    { id: 'gemini', name: 'Gemini', color: 'green' },
    { id: 'xai', name: 'xAI', color: 'blue' },
    { id: 'custom', name: 'Custom Endpoint', color: 'gray' },
  ];

  const tabs = [
    { id: 'api-keys', name: 'Clés API', icon: Key },
    { id: 'integrations', name: 'Intégrations', icon: SettingsIcon },
    { id: 'database', name: 'Base de Données', icon: Database },
    { id: 'security', name: 'Sécurité', icon: Shield },
    { id: 'general', name: 'Général', icon: SettingsIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Paramètres</h2>
        <p className="text-gray-400 mt-1">
          Configurez vos fournisseurs, intégrations et préférences
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="-mb-1 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'api-keys' && (
        <ApiKeysTab
          keys={keys}
          keysLoading={keysLoading}
          showAddKey={showAddKey}
          setShowAddKey={setShowAddKey}
          newKey={newKey}
          setNewKey={setNewKey}
          providers={providers}
          addKeyMutation={addKeyMutation}
          deleteKeyMutation={deleteKeyMutation}
        />
      )}

      {activeTab === 'general' && (
        <GeneralTab
          settings={settings}
          updateSettingsMutation={updateSettingsMutation}
        />
      )}
    </div>
  );
}

function ApiKeysTab({
  keys,
  keysLoading,
  showAddKey,
  setShowAddKey,
  newKey,
  setNewKey,
  providers,
  addKeyMutation,
  deleteKeyMutation,
}: any) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-white">Clés API</h3>
          <p className="text-gray-400 text-sm mt-1">
            Configurez vos clés pour les fournisseurs de modèles IA
          </p>
        </div>
        <button
          onClick={() => setShowAddKey(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Key className="h-4 w-4" />
          Ajouter une Clé
        </button>
      </div>

      {/* Provider Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((provider) => {
          const keyData = keys?.keys?.find((k: any) => k.provider === provider.id);
          const hasKey = !!keyData;
          
          return (
            <div 
              key={provider.id} 
              className={`p-4 rounded-lg border ${
                hasKey ? 'border-green-500/50 bg-green-900/10' : 'border-gray-600 bg-gray-800'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-white">{provider.name}</h4>
                {hasKey ? (
                  <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-300">
                    Configuré
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full text-xs bg-gray-600/50 text-gray-300">
                    Non configuré
                  </span>
                )}
              </div>
              
              {hasKey ? (
                <div className="text-sm text-gray-300 mb-3">
                  {keyData.masked || '••••••••'}
                </div>
              ) : (
                <div className="text-sm text-gray-500 mb-3">
                  Non configuré
                </div>
              )}
              
              <div className="flex space-x-2">
                {!hasKey ? (
                  <button
                    onClick={() => {
                      setNewKey({ provider: provider.id });
                      setShowAddKey(true);
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-1.5 rounded"
                  >
                    Configurer
                  </button>
                ) : (
                  <button
                    onClick={() => deleteKeyMutation.mutate(provider.id)}
                    className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs py-1.5 rounded"
                  >
                    Supprimer
                  </button>
                )}
                
                <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs py-1.5 rounded">
                  Voir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Key Modal */}
      {showAddKey && (
        <AddKeyModal
          provider={newKey.provider}
          base_url={newKey.base_url}
          key={newKey.key || ''}
          onClose={() => setShowAddKey(false)}
          onSave={(key, base_url) => addKeyMutation.mutate({ provider: newKey.provider, key, base_url })}
          providers={providers}
          isLoading={addKeyMutation.isLoading}
        />
      )}
    </div>
  );
}

function AddKeyModal({ provider, base_url, key, onClose, onSave, providers, isLoading }: any) {
  const [selectedProvider, setSelectedProvider] = useState(provider);
  const [apiKey, setApiKey] = useState(key);
  const [apiBaseUrl, setApiBaseUrl] = useState(base_url);

  const currentProvider = providers.find(p => p.id === selectedProvider);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">
          Configurer {currentProvider?.name || 'Fournisseur'}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Clé API
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Entrez votre clé API"
              className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {selectedProvider === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                URL de l'endpoint
              </label>
              <input
                type="url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700"
          >
            Annuler
          </button>
          <button
            onClick={() => onSave(apiKey, apiBaseUrl)}
            disabled={isLoading || !apiKey.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

function GeneralTab({ settings, updateSettingsMutation }: any) {
  const [formSettings, setFormSettings] = useState({
    maxTokens: settings?.max_tokens || 4096,
    timeout: settings?.timeout || 120,
    theme: settings?.theme || 'dark',
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(formSettings);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-white">Paramètres Généraux</h3>
      
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Max Tokens par Requête
            </label>
            <input
              type="number"
              value={formSettings.maxTokens}
              onChange={(e) => setFormSettings({...formSettings, maxTokens: parseInt(e.target.value) || 4096})}
              className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Nombre maximum de tokens dans la réponse
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Timeout (secondes)
            </label>
            <input
              type="number"
              value={formSettings.timeout}
              onChange={(e) => setFormSettings({...formSettings, timeout: parseInt(e.target.value) || 120})}
              className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Temps d'attente maximum pour une réponse
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Thème
            </label>
            <select
              value={formSettings.theme}
              onChange={(e) => setFormSettings({...formSettings, theme: e.target.value})}
              className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="dark">Sombre</option>
              <option value="light">Clair</option>
              <option value="system">Système</option>
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={updateSettingsMutation.isLoading}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
      >
        {updateSettingsMutation.isLoading ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Sauvegarder
      </button>
    </div>
  );
}