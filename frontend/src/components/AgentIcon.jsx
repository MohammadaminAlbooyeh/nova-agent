import React from 'react';

function AgentIcon({ size = 72 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Agent"
    >
      <rect x="6" y="2" width="4" height="10" rx="2" fill="#1a73e8" />
      <circle cx="8" cy="2" r="3" fill="#1a73e8" />
      <rect x="10" y="14" width="44" height="36" rx="12" fill="#e8f0fe" stroke="#1a73e8" strokeWidth="2" />
      <circle cx="24" cy="32" r="5" fill="#1a73e8" />
      <circle cx="40" cy="32" r="5" fill="#1a73e8" />
      <path d="M24 42c2.5 2.5 13.5 2.5 16 0" stroke="#1557b0" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="2" y="26" width="6" height="14" rx="3" fill="#1a73e8" />
      <rect x="56" y="26" width="6" height="14" rx="3" fill="#1a73e8" />
    </svg>
  );
}

export default AgentIcon;
