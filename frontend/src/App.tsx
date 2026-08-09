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
import Settings from './assets/pages/Settings';
import Login from './assets/pages/Login';
import NotFound from './assets/pages/NotFound';

// Components
import Layout from './components/Layout/Layout';

const queryClient = new QueryClient();

function App() {
  const [isInitialized, setIsInitialized] = React.useState(false);

  useEffect(() => {
    // WebSocket connection simulation
    console.log('Initializing Anti-Gravity Frontend...');
    
    // Initialize voice if available
    if ('speechSynthesis' in window && 'webkitSpeechRecognition' in window) {
      setIsInitialized(true);
    } else {
      setIsInitialized(true);
    }

    // Check for stored auth
    const token = localStorage.getItem('authToken');
    if (token) {
      console.log('Token stored:', token.substring(0, 10) + '...');
    }
  }, []);

  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Initializing...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WsProvider>
          <Router>
            <div className="min-h-screen bg-gray-900 text-gray-100">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Layout />}>
                  <Route index element={<Navigate to="/dashboard" />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="agents" element={<Agents />} />
                  <Route path="memory" element={<Memory />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </Router>
        </WsProvider>
      </AuthProvider>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}

export default App;