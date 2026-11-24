import React, { useEffect, useState } from 'react';
import { Wrench, Clock } from 'lucide-react';
import { api } from '../services/api';
import { loadLocalSettings } from '../services/localSettings';
import AgentIcon from './AgentIcon';

const ALL_TOOLS = [
  'web_search', 'web_scraper', 'url_fetcher',
  'sql_executor', 'db_reader', 'db_writer',
  'file_reader', 'file_writer', 'file_manager',
  'gmail_reader', 'gmail_sender', 'email_parser',
  'http_client', 'rest_caller', 'webhook_handler',
  'code_executor', 'code_analyzer', 'test_runner',
  'calculator', 'datetime_tool', 'text_processor', 'data_formatter',
];

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function AgentCompanionPanel({ status }) {
  const [executions, setExecutions] = useState([]);
  const [forbiddenTools, setForbiddenTools] = useState([]);

  useEffect(() => {
    api.get('/executions').then(data => setExecutions(data || [])).catch(() => {});
    setForbiddenTools(loadLocalSettings().forbiddenTools || []);
  }, []);

  const enabledTools = ALL_TOOLS.filter(t => !forbiddenTools.includes(t));
  const recent = [...executions]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);

  const statusConfig = {
    thinking: { label: 'Thinking…', dotClass: 'dot-warning' },
    error: { label: 'Something went wrong', dotClass: 'dot-danger' },
    ready: { label: 'Ready to help', dotClass: 'dot-success' },
  };
  const { label, dotClass } = statusConfig[status] || statusConfig.ready;

  return (
    <div className="companion-panel">
      <div className="companion-hero">
        <h2>Your local agent</h2>
        <div className="companion-hero__icon">
          <AgentIcon size={88} />
        </div>
        <span className="status-pill">
          <span className={`dot ${dotClass}`} />
          {label}
        </span>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Enabled tools</h3>
        <ul className="companion-list">
          {enabledTools.slice(0, 5).map(tool => (
            <li key={tool} className="companion-list-item">
              <span className="companion-list-item__icon"><Wrench size={14} /></span>
              <div className="companion-list-item__main">
                <div className="companion-list-item__title">{tool}</div>
              </div>
              <span className="companion-list-item__status" style={{ color: 'var(--color-success)' }}>
                <span className="dot dot-success" /> Enabled
              </span>
            </li>
          ))}
        </ul>
        <p className="hint" style={{ marginTop: 10 }}>
          {enabledTools.length} of {ALL_TOOLS.length} tools enabled.{' '}
          <a href="/settings">Manage in Settings</a>
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent activity</h3>
        {recent.length === 0 ? (
          <p className="hint">No recent activity yet. Run a task to see it here.</p>
        ) : (
          <ul className="companion-list">
            {recent.map(exec => (
              <li key={exec.id} className="companion-list-item">
                <span className="companion-list-item__icon"><Clock size={14} /></span>
                <div className="companion-list-item__main">
                  <div className="companion-list-item__title">{exec.tool_name}</div>
                  <div className="companion-list-item__sub">{exec.status}</div>
                </div>
                <span className="companion-list-item__sub">{timeAgo(exec.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AgentCompanionPanel;
