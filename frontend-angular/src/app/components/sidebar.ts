import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideActivity,
  LucideCheckSquare,
  LucideHome,
  LucideIconInput,
  LucidePlug,
  LucideSettings,
  LucideSparkles,
  LucideWrench,
  LucideDynamicIcon,
} from '@lucide/angular';

interface NavLink {
  to: string;
  label: string;
  icon: LucideIconInput;
  exact?: boolean;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, LucideDynamicIcon, LucideSparkles],
  template: `
    <nav class="nav-rail">
      <div class="nav-rail__brand">
        <div class="nav-rail__logo"><svg lucideSparkles [size]="17"></svg></div>
        <span class="nav-rail__title">Nova</span>
      </div>

      <div class="nav-rail__links">
        @for (link of links; track link.to) {
          <a
            class="nav-rail__link"
            [routerLink]="link.to"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: !!link.exact }"
          >
            <svg [lucideIcon]="link.icon" [size]="17" [strokeWidth]="2"></svg>
            {{ link.label }}
          </a>
        }
      </div>

      <a routerLink="/settings" class="nav-rail__user">
        <div class="nav-rail__avatar">
          LU
          <span class="dot dot-success"></span>
        </div>
        <div>
          <div class="nav-rail__user-name">Local User</div>
          <div class="nav-rail__user-sub">Running locally</div>
        </div>
      </a>
    </nav>
  `,
})
export class Sidebar {
  protected readonly links: NavLink[] = [
    { to: '/', label: 'Today', icon: LucideHome, exact: true },
    { to: '/tasks', label: 'Tasks', icon: LucideCheckSquare },
    { to: '/tools', label: 'Tools', icon: LucideWrench },
    { to: '/connections', label: 'Connections', icon: LucidePlug },
    { to: '/monitoring', label: 'Activity', icon: LucideActivity },
    { to: '/settings', label: 'Settings', icon: LucideSettings },
  ];
}
