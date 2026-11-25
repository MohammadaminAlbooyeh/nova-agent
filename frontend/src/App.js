import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import TasksPage from './pages/TasksPage';
import TaskDetailPage from './pages/TaskDetailPage';
import ToolsPage from './pages/ToolsPage';
import MonitoringPage from './pages/MonitoringPage';
import SettingsPage from './pages/SettingsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import './App.css';

function MainContent() {
  const location = useLocation();
  const isToday = location.pathname === '/';

  return (
    <main className={`main-content${isToday ? '' : ' narrow'}`}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/agent" element={<Navigate to="/" replace />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/monitoring" element={<MonitoringPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      </Routes>
    </main>
  );
}

function App() {
  return (
    <Router>
      <div className="app">
        <div className="app-body">
          <Sidebar />
          <MainContent />
        </div>
      </div>
    </Router>
  );
}

export default App;
