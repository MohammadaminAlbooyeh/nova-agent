import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sparkles, Home, CheckSquare, Wrench, Activity, Plug, Settings as SettingsIcon } from 'lucide-react';

const links = [
  { to: '/', label: 'Today', icon: Home, end: true },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/tools', label: 'Tools', icon: Wrench },
  { to: '/connections', label: 'Connections', icon: Plug },
  { to: '/monitoring', label: 'Activity', icon: Activity },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function Sidebar() {
  return (
    <nav className="nav-rail">
      <div className="nav-rail__brand">
        <div className="nav-rail__logo">
          <Sparkles size={17} />
        </div>
        <span className="nav-rail__title">Nova</span>
      </div>

      <div className="nav-rail__links">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-rail__link${isActive ? ' active' : ''}`}
          >
            <Icon size={17} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </div>

      <NavLink to="/settings" className="nav-rail__user" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="nav-rail__avatar">
          LU
          <span className="dot dot-success" />
        </div>
        <div>
          <div className="nav-rail__user-name">Local User</div>
          <div className="nav-rail__user-sub">Running locally</div>
        </div>
      </NavLink>
    </nav>
  );
}

export default Sidebar;
