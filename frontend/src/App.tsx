/**
 * Anti-Gravity Multi-Agent System - Frontend App
 * Main Application Component with routing and state management
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { WsProvider } from './lib/contexts/WsContext';
import { AuthProvider } from './lib/contexts/AuthContext';

// Pages
import Dashboard from './assets/pages/Dashboard';
import Agents from './assets/pages/Agents';
import Memory from './assets/pages/Memory';
import Skills from './assets/pages/Skills';
import Workflows from './assets/pages/Workflows';
import Settings from './assets/pages/Settings';
import Login from './assets/pages/Login';
import NotFound from './assets/pages/NotFound';

// Components
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import LoadingSpinner from './components/UI/LoadingSpinner';
import VoiceInitializer from './components/Voice/VoiceInitializer';

// Styles
import './styles/index.css';

const queryClient = new QueryClient();

function App() {
  const [isInitialized, setIsInitialized] = React.useState(false);

  useEffect(() => {
    // Initialize WebSocket connection
    const initWebSocket = () => {
      const ws = new WebSocket(`${import.meta.env.VITE_WS_URL || 'ws://localhost:8000'}/ws`);
      ws.onopen = () => console.log('WebSocket connected');
      ws.onerror = (err) => console.error('WebSocket error:', err);
      return ws;
    };

    // Initialize voice if available
    if ('speechSynthesis' in window && 'webkitSpeechRecognition' in window) {
      setIsInitialized(true);
    } else {
      setIsInitialized(true); // Continue anyway
    }

    // Check for stored auth
    const token = localStorage.getItem('authToken');
    if (token) {
      // Verify token and restore session
      document.body.classList.add('dark');
    }
  }, []);

  if (!isInitialized) {
    return <LoadingSpinner />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WsProvider>
          <Router>
            <div className="min-h-screen bg-gray-900 text-gray-100">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route index element={<Navigate to="/dashboard" />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="agents" element={<Agents />} />
                  <Route path="memory" element={<Memory />} />
                  <Route path="skills" element={<Skills />} />
                  <Route path="workflows" element={<Workflows />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </Router>
        </WsProvider>
      </AuthProvider>
      <Toaster position="bottom-right" />
      <VoiceInitializer />
    </QueryClientProvider>
  );
}

export default App;