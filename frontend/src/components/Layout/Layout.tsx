/**
 * Anti-Gravity Multi-Agent System
 * Layout Component with navigation sidebar, header, and theme support
 */

import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, NavLink } from 'react-router-dom';
import { 
  Home, 
  Bot, 
  Brain, 
  Settings, 
  Workflow, 
  Star,
  Menu,
  X,
  Sun,
  Moon,
  Shield
} from 'lucide-react';
import { useAuth } from '../lib/contexts/AuthContext';
import { useTheme } from '../lib/hooks/useTheme';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, description: 'Vue d'ensemble des agents' },
  { name: 'Agents', href: '/agents', icon: Bot, description: 'Gestion des agents IA' },
  { name: 'Memory', href: '/memory', icon: Brain, description: 'Mémoire partagée et individuelle' },
  { name: 'Skills', href: '/skills', icon: Star, description: 'Catalogue des compétences' },
  { name: 'Workflows', href: '/workflows', icon: Workflow, description: 'Orchestration des flux' },
  { name: 'Settings', href: '/settings', icon: Settings, description: 'Configuration' },
  { name: 'Security', href: '/security', icon: Shield, description: 'Sécurité et clés API' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="flex h-screen bg-gray-900" />;
  }

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        bg-gray-800 border-r border-gray-700
      `}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <Link to="/" className="text-xl font-bold text-white">
            🚀 Anti-Gravity
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-4 px-2">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) => `
                flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1
                ${isActive 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }
              `}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="mr-3 h-5 w-5" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-700">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center">
                {user?.email?.[0]?.toUpperCase() || '?'}
              </div>
            </div>
            <div className="ml-3">
              <div className="text-sm font-medium text-white">{user?.email || 'Guest'}</div>
              <button
                onClick={logout}
                className="text-xs text-gray-400 hover:text-white"
              >
                Déconnexion
              </button>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-700 hover:text-white"
          >
            {theme === 'dark' ? <Sun className="mr-3 h-5 w-5" /> : <Moon className="mr-3 h-5 w-5" />}
            <span>{theme === 'dark' ? 'Clair' : 'Sombre'}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Header */}
        <header className="flex items-center justify-between p-4 lg:p-6 bg-gray-800 border-b border-gray-700">
          <button
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <h1 className="text-lg font-semibold text-white">
            {navigation.find(n => n.href === location.pathname.split('?')[0])?.name || 'Dashboard'}
          </h1>
          
          <div className="flex items-center space-x-4">
            {/* Voice button */}
            <button
              className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700"
              title="Mode vocal"
            >
              <Mic className="h-5 w-5" />
            </button>
            
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700"
              title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function Mic(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5v-4.5m-6 9h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm12-12V5a2 2 0 00-2-2H6a2 2 0 00-2 2v.5m6 4.5V5a4 4 0 018 0v.5" />
    </svg>
  );
}