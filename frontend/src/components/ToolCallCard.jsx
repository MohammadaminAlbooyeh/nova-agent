import React from 'react';

function ToolCallCard({ call }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4>{call.tool_name}</h4>
        <span className={`badge ${call.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
          {call.status}
        </span>
      </div>
      <pre style={{ fontSize: 12, marginTop: 8, background: 'var(--color-surface-alt)', color: 'var(--color-text)', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
        {JSON.stringify(call.params, null, 2)}
      </pre>
      {call.result && (
        <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
          {call.result.substring(0, 200)}
        </p>
      )}
    </div>
  );
}

export default ToolCallCard;
