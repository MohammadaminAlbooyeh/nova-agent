import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Completing authorization...');

  useEffect(() => {
    const code = searchParams.get('code');
    const sessionId = searchParams.get('state');
    const oauthError = searchParams.get('error');
    const provider = 'gmail';

    if (oauthError) {
      setStatus('error');
      setMessage(`Authorization was denied or failed: ${oauthError}`);
      return;
    }

    if (!code || !sessionId) {
      setStatus('error');
      setMessage('Missing authorization code or session. Please try connecting again.');
      return;
    }

    axios
      .post(`${API_BASE}/oauth/callback/${provider}`, { code, session_id: sessionId, provider })
      .then((response) => {
        setStatus('success');
        setMessage(response.data.message || 'Successfully authenticated.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(`Failed to complete authorization: ${err.response?.data?.detail || err.message}`);
      });
  }, [searchParams]);

  return (
    <div style={{ padding: '40px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
      <h2>
        {status === 'processing' && 'Connecting...'}
        {status === 'success' && '✓ Connected'}
        {status === 'error' && '✗ Connection Failed'}
      </h2>
      <p>{message}</p>
      <button
        onClick={() => navigate('/integrations')}
        style={{
          marginTop: '16px',
          padding: '10px 24px',
          background: '#2196f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Back to Integrations
      </button>
    </div>
  );
}

export default OAuthCallbackPage;
