import React from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/agent', label: 'Agent' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/tools', label: 'Tools' },
  { to: '/monitoring', label: 'Monitoring' },
  { to: '/settings', label: 'Settings' },
];

function Sidebar() {
  return (
    <nav style={{
      width: 200,
      background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)',
      padding: '20px 0',
      minHeight: 'calc(100vh - 56px)',
    }}>
      {links.map(link => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          style={({ isActive }) => ({
            display: 'block',
            padding: '9px 24px',
            marginBottom: 2,
            fontSize: 13.5,
            color: isActive ? 'var(--color-primary-dark)' : 'var(--color-text)',
            background: isActive ? 'var(--color-primary-bg)' : 'transparent',
            textDecoration: 'none',
            fontWeight: isActive ? 600 : 500,
            borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
            transition: 'background-color 0.15s ease, color 0.15s ease',
          })}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default Sidebar;
