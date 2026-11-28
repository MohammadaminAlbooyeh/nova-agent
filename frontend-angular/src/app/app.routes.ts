import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home').then((m) => m.HomePage) },
  { path: 'agent', redirectTo: '', pathMatch: 'full' },
  { path: 'tasks', loadComponent: () => import('./pages/tasks').then((m) => m.TasksPage) },
  { path: 'tasks/:id', loadComponent: () => import('./pages/task-detail').then((m) => m.TaskDetailPage) },
  { path: 'tools', loadComponent: () => import('./pages/tools').then((m) => m.ToolsPage) },
  { path: 'monitoring', loadComponent: () => import('./pages/monitoring').then((m) => m.MonitoringPage) },
  { path: 'settings', loadComponent: () => import('./pages/settings').then((m) => m.SettingsPage) },
  { path: 'connections', loadComponent: () => import('./pages/connections').then((m) => m.ConnectionsPage) },
  { path: 'integrations', redirectTo: 'connections', pathMatch: 'full' },
  { path: 'oauth/callback', loadComponent: () => import('./pages/oauth-callback').then((m) => m.OAuthCallbackPage) },
  { path: '**', redirectTo: '' },
];
