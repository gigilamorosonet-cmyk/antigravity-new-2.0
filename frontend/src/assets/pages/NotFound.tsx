/**
 * Anti-Gravity Multi-Agent System
 * NotFound Page
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <Search className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">404</h1>
          <p className="text-gray-400">
            La page que vous recherchez n'existe pas
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          <Home className="h-4 w-4" />
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}