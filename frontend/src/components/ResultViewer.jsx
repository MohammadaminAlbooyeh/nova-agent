import React from 'react';

function ResultViewer({ result }) {
  if (!result) return null;

  if (result.error) {
    return (
      <div className="card" style={{ marginTop: 16, borderLeft: '3px solid var(--color-danger)' }}>
        <h3 style={{ color: 'var(--color-danger)', textTransform: 'none' }}>Error</h3>
        <p>{result.error}</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 16, borderLeft: '3px solid var(--color-success)' }}>
      <h3>Result</h3>
      <div style={{ marginTop: 12 }}>
        <p><strong>Status:</strong> {result.status}</p>
        <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{result.result}</div>
      </div>
    </div>
  );
}

export default ResultViewer;
