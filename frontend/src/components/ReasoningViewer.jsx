import React from 'react';

function ReasoningViewer({ task, steps }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Reasoning Steps</h3>
      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <strong>Task:</strong> {task}
        </div>
        {steps ? steps.map((step, i) => (
          <div key={i} style={{
            padding: '8px 12px',
            marginBottom: 8,
            background: 'var(--color-surface-alt)',
            borderRadius: 6,
            borderLeft: '3px solid var(--color-primary)',
          }}>
            <strong>Step {i + 1}:</strong> {step}
          </div>
        )) : (
          <p style={{ color: 'var(--color-text-muted)' }}>Reasoning in progress...</p>
        )}
      </div>
    </div>
  );
}

export default ReasoningViewer;
