import React, { useEffect, useState } from 'react';
import axios from 'axios';
import OAuthManager from '../components/OAuthManager';
import SessionManager from '../components/SessionManager';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const SESSION_STORAGE_KEY = 'mcp_agent_active_session_id';

function IntegrationsPage() {
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      setSessionId(existing);
      return;
    }

    axios
      .post(`${API_BASE}/sessions/create`, { metadata: { created_for: 'integrations' } })
      .then((response) => {
        localStorage.setItem(SESSION_STORAGE_KEY, response.data.id);
        setSessionId(response.data.id);
      })
      .catch((err) => setError(`Failed to create session: ${err.message}`));
  }, []);

  return (
    <div>
      <h1>Integrations</h1>
      {error && (
        <div style={{
          padding: '12px',
          background: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '4px',
          color: '#c62828',
          marginBottom: '16px',
        }}>
          {error}
        </div>
      )}
      <OAuthManager sessionId={sessionId} />
      <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid #ddd' }} />
      <SessionManager />
    </div>
  );
}

export default IntegrationsPage;
