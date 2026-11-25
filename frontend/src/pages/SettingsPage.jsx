import React, { useState } from 'react';
import { api } from '../services/api';
import { loadLocalSettings, saveLocalSettings } from '../services/localSettings';

const TOOL_CATEGORIES = [
  {
    label: 'Web',
    tools: ['web_search', 'web_scraper', 'url_fetcher'],
  },
  {
    label: 'Database',
    tools: ['sql_executor', 'db_reader', 'db_writer'],
  },
  {
    label: 'Files',
    tools: ['file_reader', 'file_writer', 'file_manager'],
  },
  {
    label: 'Email',
    tools: ['gmail_reader', 'gmail_sender', 'email_parser'],
  },
  {
    label: 'API',
    tools: ['http_client', 'rest_caller', 'webhook_handler'],
  },
  {
    label: 'Code',
    tools: ['code_executor', 'code_analyzer', 'test_runner'],
  },
  {
    label: 'Utility',
    tools: ['calculator', 'datetime_tool', 'text_processor', 'data_formatter'],
  },
];

const RISKY_TOOLS = new Set(['code_executor', 'file_manager', 'sql_executor', 'db_writer']);

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

  const isToolEnabled = (tool) => !(settings.forbiddenTools || []).includes(tool);

  const toggleTool = (tool) => {
    const current = settings.forbiddenTools || [];
    const next = current.includes(tool)
      ? current.filter(t => t !== tool)
      : [...current, tool];
    update('forbiddenTools', next);
  };

  const enabledCount = TOOL_CATEGORIES.reduce(
    (sum, cat) => sum + cat.tools.filter(isToolEnabled).length,
    0
  );
  const totalCount = TOOL_CATEGORIES.reduce((sum, cat) => sum + cat.tools.length, 0);

  return (
    <div>
      <h1>Settings</h1>
      <p className="page-subtitle">Agent constraints and knowledge base.</p>
      <p className="hint">
        Looking for your LLM API key or Gmail connection? Those moved to <strong>Connections</strong>.
      </p>

      <div className="card">
        <h2>Agent Constraints</h2>
        <p className="section-description">
          Limit how many steps the agent can take and which tools it's allowed to use.
        </p>
        <div className="form-group">
          <label>Max Steps</label>
          <input
            type="number"
            min="1"
            value={settings.maxSteps}
            onChange={e => update('maxSteps', parseInt(e.target.value, 10) || 1)}
          />
        </div>
        <div className="form-group">
          <label>Allowed Domains <span className="hint" style={{ display: 'inline', fontWeight: 400 }}>(comma-separated, empty = no restriction)</span></label>
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

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Enabled Tools</span>
            <span className="badge">{enabledCount} / {totalCount} enabled</span>
          </label>
          <p className="hint" style={{ marginBottom: 12 }}>
            Turn a tool off to prevent the agent from using it at all. Tools marked <span className="badge badge-muted">risky</span> are
            disabled by default — see the README's "Known Security Limitations" before enabling them.
          </p>
          {TOOL_CATEGORIES.map(category => (
            <div key={category.label}>
              <h3>{category.label}</h3>
              <div className="tool-grid">
                {category.tools.map(tool => (
                  <label key={tool} className="tool-toggle">
                    <span className="switch">
                      <input
                        type="checkbox"
                        checked={isToolEnabled(tool)}
                        onChange={() => toggleTool(tool)}
                      />
                      <span className="slider" />
                    </span>
                    <code>{tool}</code>
                    {RISKY_TOOLS.has(tool) && <span className="badge badge-muted">risky</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Appearance</h2>
        <div className="form-group">
          <label>Theme</label>
          <select value={settings.theme} onChange={e => update('theme', e.target.value)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      <div className="card">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {message && (
          <div className={`banner ${message.includes('Failed') ? 'banner-error' : 'banner-success'}`}>
            {message}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Knowledge Documents</h2>
        <p className="section-description">
          Upload a .txt, .md, .pdf, or .docx file. Its text is extracted and stored in the agent's
          long-term memory as context.
        </p>
        <div className="form-group">
          <input
            type="file"
            accept=".txt,.md,.pdf,.docx"
            onChange={e => setUploadFile(e.target.files[0] || null)}
          />
        </div>
        <button className="btn-secondary" onClick={handleUpload} disabled={!uploadFile}>
          Upload
        </button>
        {uploadStatus && (
          <div className={`banner ${uploadStatus.startsWith('Failed') ? 'banner-error' : 'banner-success'}`}>
            {uploadStatus}
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsPage;
