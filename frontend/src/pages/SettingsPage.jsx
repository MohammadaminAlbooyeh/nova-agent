import React, { useState } from 'react';
import { api } from '../services/api';
import { loadLocalSettings, saveLocalSettings } from '../services/localSettings';

function SettingsPage() {
  const [settings, setSettings] = useState(loadLocalSettings());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');

  const update = (field, value) => setSettings({ ...settings, [field]: value });

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      // The API key never leaves this browser: it is stored only in
      // localStorage and sent per-request with each agent run, not
      // persisted on the backend.
      saveLocalSettings(settings);

      await api.post('/settings', {
        llmProvider: settings.llmProvider,
        maxSteps: settings.maxSteps,
        theme: settings.theme,
        forbiddenTools: settings.forbiddenTools,
        allowedDomains: settings.allowedDomains,
      });
      setMessage('Settings saved successfully');
    } catch (err) {
      setMessage(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploadStatus('Uploading...');
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed (${response.status})`);
      }
      const data = await response.json();
      setUploadStatus(`Stored "${data.filename}" (${data.characters_extracted} characters) in agent memory`);
    } catch (err) {
      setUploadStatus(`Failed: ${err.message}`);
    }
  };

  const toggleForbiddenTool = (tool) => {
    const current = settings.forbiddenTools || [];
    const next = current.includes(tool)
      ? current.filter(t => t !== tool)
      : [...current, tool];
    update('forbiddenTools', next);
  };

  const KNOWN_TOOLS = [
    'code_executor', 'file_manager', 'db_reader', 'db_writer', 'sql_executor',
    'web_scraper', 'web_search', 'http_client', 'gmail_sender', 'gmail_reader',
  ];

  return (
    <div>
      <h1>Settings</h1>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>LLM Provider &amp; API Key</h2>
        <p style={{ fontSize: 13, color: '#666' }}>
          Your API key is stored only in this browser's local storage and sent
          directly with each agent run. It is never saved on the server.
        </p>
        <div style={{ marginBottom: 16 }}>
          <label>Provider</label>
          <select value={settings.llmProvider} onChange={e => update('llmProvider', e.target.value)}>
            <option value="openai">OpenAI</option>
            <option value="claude">Claude</option>
            <option value="groq">Groq</option>
            <option value="local">Local</option>
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>API Key</label>
          <input
            type="password"
            placeholder="sk-..."
            value={settings.apiKey}
            onChange={e => update('apiKey', e.target.value)}
            autoComplete="off"
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Model (optional)</label>
          <input
            type="text"
            placeholder="e.g. claude-opus-4-20250514, gpt-4"
            value={settings.model}
            onChange={e => update('model', e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Agent Constraints</h2>
        <div style={{ marginBottom: 16 }}>
          <label>Max Steps</label>
          <input
            type="number"
            value={settings.maxSteps}
            onChange={e => update('maxSteps', parseInt(e.target.value, 10) || 1)}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Forbidden Tools</label>
          <div>
            {KNOWN_TOOLS.map(tool => (
              <label key={tool} style={{ display: 'block', fontWeight: 'normal' }}>
                <input
                  type="checkbox"
                  checked={(settings.forbiddenTools || []).includes(tool)}
                  onChange={() => toggleForbiddenTool(tool)}
                />
                {' '}{tool}
              </label>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Allowed Domains (comma-separated, empty = no restriction)</label>
          <input
            type="text"
            placeholder="example.com, docs.python.org"
            value={(settings.allowedDomains || []).join(', ')}
            onChange={e => update(
              'allowedDomains',
              e.target.value.split(',').map(d => d.trim()).filter(Boolean)
            )}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Appearance</h2>
        <div style={{ marginBottom: 16 }}>
          <label>Theme</label>
          <select value={settings.theme} onChange={e => update('theme', e.target.value)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <button
          style={{ background: '#1a73e8', color: 'white', cursor: 'pointer' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {message && <p style={{ marginTop: 8, color: message.includes('Failed') ? 'red' : 'green' }}>{message}</p>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Knowledge Documents</h2>
        <p style={{ fontSize: 13, color: '#666' }}>
          Upload a .txt, .md, .pdf, or .docx file. Its text is extracted and
          stored in the agent's long-term memory as context.
        </p>
        <div style={{ marginBottom: 16 }}>
          <input
            type="file"
            accept=".txt,.md,.pdf,.docx"
            onChange={e => setUploadFile(e.target.files[0] || null)}
          />
        </div>
        <button
          style={{ background: '#1a73e8', color: 'white', cursor: 'pointer' }}
          onClick={handleUpload}
          disabled={!uploadFile}
        >
          Upload
        </button>
        {uploadStatus && <p style={{ marginTop: 8 }}>{uploadStatus}</p>}
      </div>
    </div>
  );
}

export default SettingsPage;
