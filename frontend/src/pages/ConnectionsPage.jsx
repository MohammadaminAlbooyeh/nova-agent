import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { loadLocalSettings, saveLocalSettings } from '../services/localSettings';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';
const SESSION_STORAGE_KEY = 'mcp_agent_active_session_id';
const GMAIL_CLIENT_ID_KEY = 'mcp_agent_gmail_client_id';
const GMAIL_CLIENT_SECRET_KEY = 'mcp_agent_gmail_client_secret';

function ConnectionsPage() {
  const [settings, setSettings] = useState(loadLocalSettings());
  const [llmSaved, setLlmSaved] = useState(false);

  const [sessionId, setSessionId] = useState(null);
  const [sessionError, setSessionError] = useState(null);

  const [clientId, setClientId] = useState(() => localStorage.getItem(GMAIL_CLIENT_ID_KEY) || '');
  const [clientSecret, setClientSecret] = useState(() => localStorage.getItem(GMAIL_CLIENT_SECRET_KEY) || '');
  const [authStatus, setAuthStatus] = useState(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailError, setGmailError] = useState(null);
  const [gmailMessage, setGmailMessage] = useState(null);

  const [filters, setFilters] = useState(null);
  const [filtersSaved, setFiltersSaved] = useState(false);
  const [filtersError, setFiltersError] = useState(null);

  const updateLlm = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setLlmSaved(false);
  };

  const saveLlm = () => {
    saveLocalSettings(settings);
    setLlmSaved(true);
  };

  useEffect(() => {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      setSessionId(existing);
      return;
    }
    axios
      .post(`${API_BASE}/sessions/create`, { metadata: { created_for: 'connections' } })
      .then((response) => {
        localStorage.setItem(SESSION_STORAGE_KEY, response.data.id);
        setSessionId(response.data.id);
      })
      .catch((err) => setSessionError(`Failed to create session: ${err.message}`));
  }, []);

  const checkGmailStatus = React.useCallback(() => {
    if (!sessionId) return;
    axios
      .get(`${API_BASE}/oauth/status/gmail`, { params: { session_id: sessionId } })
      .then((response) => setAuthStatus(response.data))
      .catch(() => setAuthStatus(null));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    checkGmailStatus();
    const interval = setInterval(checkGmailStatus, 10000);
    return () => clearInterval(interval);
  }, [sessionId, checkGmailStatus]);

  const loadFilters = React.useCallback(() => {
    if (!sessionId) return;
    axios
      .get(`${API_BASE}/oauth/gmail/filters`, { params: { session_id: sessionId } })
      .then((response) => setFilters(response.data))
      .catch((err) => setFiltersError(err.response?.data?.detail || err.message));
  }, [sessionId]);

  useEffect(() => {
    if (sessionId && authStatus?.authenticated) {
      loadFilters();
    }
  }, [sessionId, authStatus?.authenticated, loadFilters]);

  const updateFilterText = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value.split(',').map(s => s.trim()).filter(Boolean) }));
    setFiltersSaved(false);
  };

  const saveFilters = async () => {
    if (!sessionId || !filters) return;
    setFiltersError(null);
    try {
      const response = await axios.post(
        `${API_BASE}/oauth/gmail/filters`,
        {
          ignore_terms: filters.ignore_terms,
          important_terms: filters.important_terms,
          only_important: filters.only_important,
          max_results: filters.max_results,
        },
        { params: { session_id: sessionId } }
      );
      setFilters(response.data);
      setFiltersSaved(true);
    } catch (err) {
      setFiltersError(err.response?.data?.detail || err.message);
    }
  };

  const connectGmail = async () => {
    if (!sessionId) return;
    setGmailLoading(true);
    setGmailError(null);
    setGmailMessage(null);
    try {
      if (clientId) localStorage.setItem(GMAIL_CLIENT_ID_KEY, clientId);
      if (clientSecret) localStorage.setItem(GMAIL_CLIENT_SECRET_KEY, clientSecret);

      const response = await axios.post(
        `${API_BASE}/oauth/authorize/gmail`,
        { client_id: clientId || undefined, client_secret: clientSecret || undefined },
        { params: { session_id: sessionId } }
      );
      window.open(response.data.auth_url, 'GoogleAuthorization', 'width=500,height=650');
      setGmailMessage('A Google sign-in window opened. Complete it there, then this page updates automatically.');

      const pollTimer = setInterval(checkGmailStatus, 2000);
      setTimeout(() => clearInterval(pollTimer), 60000);
    } catch (err) {
      setGmailError(err.response?.data?.detail || err.message);
    } finally {
      setGmailLoading(false);
    }
  };

  const disconnectGmail = async () => {
    if (!sessionId || !window.confirm('Disconnect Gmail?')) return;
    setGmailLoading(true);
    try {
      await axios.post(`${API_BASE}/oauth/disconnect/gmail`, {}, { params: { session_id: sessionId } });
      setAuthStatus(null);
      setGmailMessage('Disconnected.');
    } catch (err) {
      setGmailError(err.response?.data?.detail || err.message);
    } finally {
      setGmailLoading(false);
    }
  };

  const refreshGmailToken = async () => {
    if (!sessionId) return;
    setGmailLoading(true);
    try {
      await axios.post(`${API_BASE}/oauth/refresh/gmail`, {}, { params: { session_id: sessionId } });
      checkGmailStatus();
    } catch (err) {
      setGmailError(err.response?.data?.detail || err.message);
    } finally {
      setGmailLoading(false);
    }
  };

  return (
    <div>
      <h1>Connections</h1>
      <p className="page-subtitle">Everything the agent needs you to connect, in one place.</p>

      <div className="card">
        <h2>LLM Provider &amp; API Key</h2>
        <p className="section-description">
          Stored only in this browser's local storage and sent directly with each agent run.
          Never saved on the server.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label>Provider</label>
            <select value={settings.llmProvider} onChange={e => updateLlm('llmProvider', e.target.value)}>
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="groq">Groq</option>
              <option value="local">Local</option>
            </select>
          </div>
          <div className="form-group">
            <label>Model (optional)</label>
            <input
              type="text"
              placeholder="e.g. claude-opus-4-20250514, gpt-4"
              value={settings.model}
              onChange={e => updateLlm('model', e.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label>API Key</label>
          <input
            type="password"
            placeholder="sk-..."
            value={settings.apiKey}
            onChange={e => updateLlm('apiKey', e.target.value)}
            autoComplete="off"
          />
        </div>
        <button className="btn-primary" onClick={saveLlm}>Save</button>
        {llmSaved && <div className="banner banner-success">Saved.</div>}
      </div>

      <div className="card">
        <h2>Gmail <span className="badge badge-muted">optional</span></h2>
        <p className="section-description">
          Lets the agent read and send email through your Gmail account. Bring your own Google
          OAuth client, or leave the fields blank to use the one the operator may have configured.
        </p>

        {sessionError && <div className="banner banner-error">{sessionError}</div>}

        {authStatus?.authenticated ? (
          <>
            <div className="banner banner-success">
              ✓ Connected{authStatus.user_email ? ` as ${authStatus.user_email}` : ''}
            </div>
            {authStatus.is_expired && (
              <div className="banner banner-warning">Token expired — refresh it below.</div>
            )}
            <div className="form-row">
              {authStatus.is_expired && (
                <button className="btn-secondary" onClick={refreshGmailToken} disabled={gmailLoading}>
                  {gmailLoading ? 'Refreshing...' : 'Refresh Token'}
                </button>
              )}
              <button className="btn-secondary" onClick={disconnectGmail} disabled={gmailLoading}>
                {gmailLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </>
        ) : null}
        {authStatus?.authenticated ? null : (
          <>
            <div className="form-group">
              <label>Google Client ID</label>
              <input
                type="text"
                placeholder="xxxxxxxxxx.apps.googleusercontent.com"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Google Client Secret</label>
              <input
                type="password"
                placeholder="GOCSPX-..."
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
                autoComplete="off"
              />
            </div>
            <p className="hint">
              Redirect URI to register in Google Cloud Console:{' '}
              <code>{window.location.origin}/oauth/callback</code>
            </p>
            {gmailError && <div className="banner banner-error">{gmailError}</div>}
            {gmailMessage && <div className="banner banner-info">{gmailMessage}</div>}
            <button className="btn-primary" onClick={connectGmail} disabled={gmailLoading || !sessionId}>
              {gmailLoading ? 'Connecting...' : 'Connect Gmail'}
            </button>
          </>
        )}
      </div>

      {authStatus?.authenticated && (
        <div className="card">
          <h2>Email Filters</h2>
          <p className="section-description">
            Control which emails the agent is allowed to act on. Terms here match against the
            sender and subject. Anything matching "Ignore" is skipped entirely (so the agent
            doesn't waste time on newsletters/no-reply mail); anything matching "Important" is
            flagged and written to a file you can review.
          </p>

          {filtersError && <div className="banner banner-error">{filtersError}</div>}

          {!filters ? (
            <p className="hint">Loading filters...</p>
          ) : (
            <>
              <div className="form-group">
                <label>Ignore (comma-separated senders/keywords)</label>
                <input
                  type="text"
                  placeholder="noreply, newsletter, promotions"
                  value={(filters.ignore_terms || []).join(', ')}
                  onChange={e => updateFilterText('ignore_terms', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Important (comma-separated senders/keywords)</label>
                <input
                  type="text"
                  placeholder="boss@company.com, invoice, urgent"
                  value={(filters.important_terms || []).join(', ')}
                  onChange={e => updateFilterText('important_terms', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>
                  <input
                    type="checkbox"
                    checked={!!filters.only_important}
                    onChange={e => { setFilters(prev => ({ ...prev, only_important: e.target.checked })); setFiltersSaved(false); }}
                  />
                  {' '}Only show emails matching "Important"
                </label>
              </div>
              <div className="form-group">
                <label>Max emails to scan per read</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={filters.max_results || 10}
                  onChange={e => { setFilters(prev => ({ ...prev, max_results: Number(e.target.value) })); setFiltersSaved(false); }}
                />
              </div>
              <button className="btn-primary" onClick={saveFilters}>Save Filters</button>
              {filtersSaved && <div className="banner banner-success">Saved.</div>}
              <p className="hint">
                Emails flagged as important are written to{' '}
                <code>data/gmail_important_{sessionId}.json</code> each time the agent reads the inbox.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ConnectionsPage;
