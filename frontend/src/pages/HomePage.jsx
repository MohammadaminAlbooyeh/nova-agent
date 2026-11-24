import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import AgentIcon from '../components/AgentIcon';

function HomePage() {
  const [metrics, setMetrics] = useState(null);
  const [tools, setTools] = useState([]);

  useEffect(() => {
    api.get('/monitoring/metrics').then(setMetrics).catch(() => {});
    api.get('/tools').then(setTools).catch(() => {});
  }, []);

  return (
    <div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
        <AgentIcon size={72} />
        <div>
          <h1 style={{ marginBottom: 2 }}>MCP Agent System</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Your local AI agent is online and ready to run tasks.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div className="card"><h3>Tasks</h3><p>{metrics ? `${metrics.tasks_completed + metrics.tasks_failed} Total` : '0 Total'}</p></div>
        <div className="card"><h3>Tools</h3><p>{tools.length} Available</p></div>
        <div className="card"><h3>Executions</h3><p>{metrics ? `${metrics.tools_called} Total` : '0 Total'}</p></div>
        <div className="card"><h3>System</h3><p>Healthy</p></div>
      </div>
    </div>
  );
}

export default HomePage;
