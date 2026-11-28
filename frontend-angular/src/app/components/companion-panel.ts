import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideCalculator,
  LucideChevronRight,
  LucideClock,
  LucideCode2,
  LucideDatabase,
  LucideDynamicIcon,
  LucideFileText,
  LucideGlobe,
  LucideIconInput,
  LucideMail,
  LucidePlug,
} from '@lucide/angular';
import { LocalSettingsService } from '../core/local-settings.service';
import { ALL_TOOLS, TOOL_CATEGORY } from '../core/tool-catalog';
import { Execution, ToolService } from '../core/tool.service';

const CATEGORY_META: Record<string, { icon: LucideIconInput; tint: string }> = {
  Web: { icon: LucideGlobe, tint: 'tint-cyan' },
  Database: { icon: LucideDatabase, tint: 'tint-violet' },
  Files: { icon: LucideFileText, tint: 'tint-amber' },
  Email: { icon: LucideMail, tint: 'tint-cyan' },
  API: { icon: LucidePlug, tint: 'tint-violet' },
  Code: { icon: LucideCode2, tint: 'tint-amber' },
  Utility: { icon: LucideCalculator, tint: 'tint-cyan' },
};

const STATUS_CONFIG = {
  thinking: { label: 'Thinking…', dotClass: 'dot-warning' },
  error: { label: 'Something went wrong', dotClass: 'dot-danger' },
  ready: { label: 'Ready to help', dotClass: 'dot-success' },
};

export type AgentStatus = keyof typeof STATUS_CONFIG;

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

@Component({
  selector: 'app-companion-panel',
  imports: [RouterLink, LucideDynamicIcon, LucideChevronRight, LucideClock],
  template: `
    <div class="companion-panel">
      <div class="companion-hero">
        <div class="companion-hero__bg" style="background-image: url(/assets/agent-illustration.png)"></div>
        <div class="companion-hero__text">
          <h2>Your local agent</h2>
          <span class="status-pill">
            <span class="dot" [class]="statusView().dotClass"></span>
            {{ statusView().label }}
          </span>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">Enabled tools</h3>
        <ul class="companion-list">
          @for (tool of enabledTools().slice(0, 5); track tool) {
            <li class="companion-list-item">
              <span class="companion-list-item__icon" [class]="meta(tool).tint">
                <svg [lucideIcon]="meta(tool).icon" [size]="15"></svg>
              </span>
              <div class="companion-list-item__main">
                <div class="companion-list-item__title">{{ tool }}</div>
                <div class="companion-list-item__sub">{{ category(tool) }}</div>
              </div>
              <span class="companion-list-item__status" style="color: var(--color-success)">
                <span class="dot dot-success"></span> Enabled
              </span>
              <svg lucideChevronRight [size]="14" class="companion-list-item__chevron"></svg>
            </li>
          }
        </ul>
        <p class="hint" style="margin-top: 10px">
          {{ enabledTools().length }} of {{ totalTools }} tools enabled.
          <a routerLink="/settings">Manage in Settings</a>
        </p>
      </div>

      <div class="card">
        <h3 style="margin-top: 0">Recent activity</h3>
        @if (recent().length === 0) {
          <p class="hint">No recent activity yet. Run a task to see it here.</p>
        } @else {
          <ul class="companion-list">
            @for (exec of recent(); track exec.id) {
              <li class="companion-list-item">
                <span class="companion-list-item__icon"><svg lucideClock [size]="14"></svg></span>
                <div class="companion-list-item__main">
                  <div class="companion-list-item__title">{{ exec.tool_name }}</div>
                  <div class="companion-list-item__sub">{{ exec.status }}</div>
                </div>
                <span class="companion-list-item__sub">{{ ago(exec.timestamp) }}</span>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class CompanionPanel implements OnInit {
  private readonly tools = inject(ToolService);
  private readonly localSettings = inject(LocalSettingsService);

  readonly status = input<AgentStatus>('ready');

  protected readonly totalTools = ALL_TOOLS.length;
  private readonly executions = signal<Execution[]>([]);
  private readonly forbidden = signal<string[]>([]);

  protected readonly statusView = computed(() => STATUS_CONFIG[this.status()] ?? STATUS_CONFIG.ready);
  protected readonly enabledTools = computed(() => ALL_TOOLS.filter((t) => !this.forbidden().includes(t)));
  protected readonly recent = computed(() =>
    [...this.executions()]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5),
  );

  ngOnInit(): void {
    this.forbidden.set(this.localSettings.load().forbiddenTools || []);
    this.tools
      .executions()
      .then((data) => this.executions.set(data || []))
      .catch(() => {});
  }

  protected category = (tool: string) => TOOL_CATEGORY[tool];
  protected meta = (tool: string) => CATEGORY_META[TOOL_CATEGORY[tool]] ?? CATEGORY_META['Utility'];
  protected ago = timeAgo;
}
