import React from 'react';
import { Link } from 'react-router-dom';

function TaskCard({ task }) {
  return (
    <Link to={`/tasks/${task.id}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>{task.title}</h3>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>{task.description}</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <span className={`badge ${task.priority === 'high' ? 'badge-danger' : task.priority === 'medium' ? 'badge-warning' : 'badge-success'}`}>
            {task.priority}
          </span>
          <span className="badge badge-muted">
            {task.status}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default TaskCard;
