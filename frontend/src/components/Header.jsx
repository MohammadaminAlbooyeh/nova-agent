import React from 'react';
import { Link } from 'react-router-dom';

function Header() {
  return (
    <header style={{
      background: 'var(--color-primary)',
      color: 'white',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      zIndex: 1,
    }}>
      <Link to="/" style={{ color: 'white', textDecoration: 'none', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
        MCP Agent System
      </Link>
      <span style={{ fontSize: 12, opacity: 0.85 }}>v0.1.0</span>
    </header>
  );
}

export default Header;
