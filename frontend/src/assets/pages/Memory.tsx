/**
 * Anti-Gravity Multi-Agent System
 * Memory Page - Manage individual and shared memory
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Save, Search, Share2, User, Globe } from 'lucide-react';

interface MemoryItem {
  id: number;
  agent_id: number;
  scope: 'global' | 'private';
  content: string;
  created_at: string;
  agents_allowed?: string[];
}

export default function Memory() {
  const [memoryType, setMemoryType] = useState<'individual' | 'shared'>('individual');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<MemoryItem | null>(null);

  const queryClient = useQueryClient();

  const { data: individualMemory, isLoading: individualLoading } = useQuery({
    queryKey: ['memory', 'individual', searchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/memory/individual/1`);
      return res.json();
    },
    enabled: memoryType === 'individual',
    refetchInterval: 30000,
  });

  const { data: sharedMemory, isLoading: sharedLoading } = useQuery({
    queryKey: ['memory', 'shared', searchTerm],
    queryFn: async () => {
      const res = await fetch('/api/memory/shared');
      return res.json();
    },
    enabled: memoryType === 'shared',
    refetchInterval: 30000,
  });

  const addMutation = useMutation({
    mutationFn: async ({ key, value, scope, agentsAllowed }: any) => {
      const endpoint = scope === 'global' ? '/api/memory/shared' : '/api/memory/individual/1';
      const res = await fetch(`${endpoint}/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scope === 'global' ? { value, agentsAllowed } : { value }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['memory']);
      setShowAddModal(false);
      setEditItem(null);
    },
  });

  const memoryItems = memoryType === 'individual' 
    ? (individualMemory || []) 
    : (sharedMemory?.shared || []);

  const filteredItems = searchTerm
    ? memoryItems.filter((item: any) => 
        item.key?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.value?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.content?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : memoryItems;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Mémoire</h2>
          <p className="text-gray-400 mt-1">
            Gérez la mémoire individuelle et partagée de vos agents
          </p>
        </div>
        
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Save className="h-5 w-5" />
          Ajouter
        </button>
      </div>

      {/* Memory Type Toggle */}
      <div className="flex space-x-4">
        <button
          onClick={() => setMemoryType('individual')}
          className={`flex-1 px-4 py-3 rounded-lg flex items-center justify-center gap-2 ${
            memoryType === 'individual' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <User className="h-5 w-5" />
          <span>Mémoire Individuelle</span>
        </button>
        
        <button
          onClick={() => setMemoryType('shared')}
          className={`flex-1 px-4 py-3 rounded-lg flex items-center justify-center gap-2 ${
            memoryType === 'shared' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Globe className="h-5 w-5" />
          <span>Mémoire Partagée</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher dans la mémoire..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-800 text-gray-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Memory Items */}
      {memoryType === 'individual' && individualLoading ? (
        <div className="text-center py-8">
          <Database className="h-12 w-12 text-gray-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-400">Chargement de la mémoire...</p>
        </div>
      ) : memoryType === 'shared' && sharedLoading ? (
        <div className="text-center py-8">
          <Database className="h-12 w-12 text-gray-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-400">Chargement de la mémoire partagée...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Database className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-gray-400 mb-2">Aucune mémoire</h3>
              <p className="text-gray-500 mb-4">
                {memoryType === 'individual' 
                  ? 'Ajoutez des informations à la mémoire de cet agent'
                  : 'Partagez des informations entre les agents'}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
              >
                Ajouter de la mémoire
              </button>
            </div>
          ) : (
            filteredItems.map((item: any) => (
              <MemoryCard 
                key={item.key} 
                item={item} 
                memoryType={memoryType}
                onEdit={() => setEditItem(item)}
              />
            ))
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editItem) && (
        <MemoryModal
          item={editItem}
          onClose={() => {
            setShowAddModal(false);
            setEditItem(null);
          }}
          onSave={(data) => addMutation.mutate(data)}
          memoryType={memoryType}
          isEditing={!!editItem}
          isLoading={addMutation.isLoading}
        />
      )}
    </div>
  );
}

function MemoryCard({ item, memoryType, onEdit }: { 
  item: any; 
  memoryType: 'individual' | 'shared';
  onEdit: () => void;
}) {
  const truncateText = (text: string, max = 100) => {
    return text.length > max ? text.slice(0, max) + '...' : text;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-white text-sm break-all">
          {item.key || `Item #${item.id}`}
        </h4>
        {memoryType === 'shared' && item.agents_allowed && (
          <Share2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
        )}
      </div>
      
      <p className="text-sm text-gray-300 mb-3 break-all">
        {truncateText(item.value || item.content || '', 150)}
      </p>
      
      <div className="text-xs text-gray-500 flex justify-between items-center">
        <span>
          {memoryType === 'shared' ? 'Partagé' : 'Individuel'} • 
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Inconnu'}
        </span>
        <button
          onClick={onEdit}
          className="text-gray-400 hover:text-white"
        >
          Modifier
        </button>
      </div>
    </div>
  );
}

function MemoryModal({ item, onClose, onSave, memoryType, isEditing, isLoading }: any) {
  const [key, setKey] = useState(item?.key || '');
  const [value, setValue] = useState(item?.value || item?.content || '');
  const [agentsAllowed, setAgentsAllowed] = useState<string[]>(item?.agents_allowed || []);

  const handleSubmit = () => {
    if (!key.trim() || !value.trim()) return;
    
    onSave({
      key,
      value,
      scope: memoryType,
      agentsAllowed: memoryType === 'shared' ? agentsAllowed : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">
          {isEditing ? 'Modifier' : 'Nouvelle Entrée'} Mémoire
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Clé</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="ma_cle"
              className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Valeur</label>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={4}
              className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {memoryType === 'shared' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Agents Autorisés (séparés par des virgules)
              </label>
              <input
                type="text"
                value={agentsAllowed.join(', ')}
                onChange={(e) => setAgentsAllowed(
                  e.target.value.split(',').map(a => a.trim()).filter(a => a)
                )}
                placeholder="agent1, agent2"
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
            onClick={handleSubmit}
            disabled={isLoading || !key.trim() || !value.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? 'Sauvegarder' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}