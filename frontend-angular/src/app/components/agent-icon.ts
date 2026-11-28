import { Component, input } from '@angular/core';

@Component({
  selector: 'app-agent-icon',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 120 120" fill="none" role="img" aria-label="Agent">
      <!-- antennae -->
      <line x1="42" y1="18" x2="36" y2="4" stroke="#c7ccd6" stroke-width="3" stroke-linecap="round" />
      <circle cx="36" cy="4" r="4" fill="#22d3ee" />
      <line x1="78" y1="18" x2="84" y2="4" stroke="#c7ccd6" stroke-width="3" stroke-linecap="round" />
      <circle cx="84" cy="4" r="4" fill="#22d3ee" />
      <!-- head -->
      <rect x="24" y="16" width="72" height="56" rx="24" fill="#eef1f6" stroke="#c7ccd6" stroke-width="2" />
      <!-- ears -->
      <rect x="14" y="36" width="10" height="20" rx="5" fill="#eef1f6" stroke="#c7ccd6" stroke-width="2" />
      <rect x="96" y="36" width="10" height="20" rx="5" fill="#eef1f6" stroke="#c7ccd6" stroke-width="2" />
      <!-- eyes -->
      <circle cx="46" cy="44" r="9" fill="#1b2234" />
      <circle cx="49" cy="41" r="2.4" fill="white" />
      <circle cx="74" cy="44" r="9" fill="#1b2234" />
      <circle cx="77" cy="41" r="2.4" fill="white" />
      <!-- smile -->
      <path d="M48 58c4 4 20 4 24 0" stroke="#1b2234" stroke-width="3" stroke-linecap="round" fill="none" />
      <!-- cheeks -->
      <circle cx="35" cy="54" r="4" fill="#fecdd3" opacity="0.7" />
      <circle cx="85" cy="54" r="4" fill="#fecdd3" opacity="0.7" />
      <!-- body -->
      <rect x="32" y="78" width="56" height="34" rx="14" fill="#eef1f6" stroke="#c7ccd6" stroke-width="2" />
      <rect x="52" y="88" width="16" height="14" rx="4" fill="#22d3ee" opacity="0.25" />
      <circle cx="60" cy="95" r="4" fill="#22d3ee" />
      <!-- arms -->
      <circle cx="26" cy="96" r="7" fill="#eef1f6" stroke="#c7ccd6" stroke-width="2" />
      <circle cx="94" cy="96" r="7" fill="#eef1f6" stroke="#c7ccd6" stroke-width="2" />
    </svg>
  `,
  styles: `:host { display: inline-flex; }`,
})
export class AgentIcon {
  readonly size = input(72);
}
