import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../core/api.service';
import { AgentService } from '../core/agent.service';
import { LocalSettings, LocalSettingsService } from '../core/local-settings.service';
import { RISKY_TOOLS, TOOL_CATEGORIES } from '../core/tool-catalog';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule],
  template: `
    <h1>Settings</h1>
    <p class="page-subtitle">Agent constraints and knowledge base.</p>
    <p class="hint">
      Looking for your LLM API key or Gmail connection? Those moved to <strong>Connections</strong>.
    </p>

    <div class="card">
      <h2>Agent Constraints</h2>
      <p class="section-description">
        Limit how many steps the agent can take and which tools it's allowed to use.
      </p>
      <div class="form-group">
        <label>Max Steps</label>
        <input
          type="number"
          min="1"
          [ngModel]="settings().maxSteps"
          (ngModelChange)="update('maxSteps', toInt($event))"
        />
      </div>
      <div class="form-group">
        <label>
          Allowed Domains
          <span class="hint" style="display: inline; font-weight: 400">(comma-separated, empty = no restriction)</span>
        </label>
        <input
          type="text"
          placeholder="example.com, docs.python.org"
          [ngModel]="settings().allowedDomains.join(', ')"
          (ngModelChange)="update('allowedDomains', splitList($event))"
        />
      </div>

      <div class="form-group">
        <label style="display: flex; align-items: center; justify-content: space-between">
          <span>Enabled Tools</span>
          <span class="badge">{{ enabledCount() }} / {{ totalCount }} enabled</span>
        </label>
        <p class="hint" style="margin-bottom: 12px">
          Turn a tool off to prevent the agent from using it at all. Tools marked
          <span class="badge badge-muted">risky</span> are disabled by default — see the README's
          "Known Security Limitations" before enabling them.
        </p>
        @for (category of categories; track category.label) {
          <div>
            <h3>{{ category.label }}</h3>
            <div class="tool-grid">
              @for (tool of category.tools; track tool) {
                <label class="tool-toggle">
                  <span class="switch">
                    <input type="checkbox" [checked]="isEnabled(tool)" (change)="toggleTool(tool)" />
                    <span class="slider"></span>
                  </span>
                  <code>{{ tool }}</code>
                  @if (risky.has(tool)) {
                    <span class="badge badge-muted">risky</span>
                  }
                </label>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <div class="card">
      <h2>Appearance</h2>
      <div class="form-group">
        <label>Theme</label>
        <select [ngModel]="settings().theme" (ngModelChange)="update('theme', $event)">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
    </div>

    <div class="card">
      <button class="btn-primary" (click)="save()" [disabled]="saving()">
        {{ saving() ? 'Saving...' : 'Save Settings' }}
      </button>
      @if (message()) {
        <div class="banner" [class]="message().includes('Failed') ? 'banner-error' : 'banner-success'">
          {{ message() }}
        </div>
      }
    </div>

    <div class="card">
      <h2>Knowledge Documents</h2>
      <p class="section-description">
        Upload a .txt, .md, .pdf, or .docx file. Its text is extracted and stored in the agent's
        long-term memory as context.
      </p>
      <div class="form-group">
        <input type="file" accept=".txt,.md,.pdf,.docx" (change)="onFile($event)" />
      </div>
      <button class="btn-secondary" (click)="upload()" [disabled]="!uploadFile()">Upload</button>
      @if (uploadStatus()) {
        <div class="banner" [class]="uploadStatus().startsWith('Failed') ? 'banner-error' : 'banner-success'">
          {{ uploadStatus() }}
        </div>
      }
    </div>
  `,
})
export class SettingsPage {
  private readonly api = inject(ApiService);
  private readonly agent = inject(AgentService);
  private readonly store = inject(LocalSettingsService);

  protected readonly categories = TOOL_CATEGORIES;
  protected readonly risky = RISKY_TOOLS;
  protected readonly totalCount = TOOL_CATEGORIES.reduce((n, c) => n + c.tools.length, 0);

  protected readonly settings = signal<LocalSettings>(this.store.load());
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly uploadFile = signal<File | null>(null);
  protected readonly uploadStatus = signal('');

  protected readonly enabledCount = computed(
    () => TOOL_CATEGORIES.reduce((n, c) => n + c.tools.filter((t) => this.isEnabled(t)).length, 0),
  );

  protected update<K extends keyof LocalSettings>(field: K, value: LocalSettings[K]) {
    this.settings.update((s) => ({ ...s, [field]: value }));
  }

  protected toInt = (v: unknown) => parseInt(String(v), 10) || 1;
  protected splitList = (v: string) => v.split(',').map((d) => d.trim()).filter(Boolean);

  protected isEnabled(tool: string) {
    return !(this.settings().forbiddenTools || []).includes(tool);
  }

  protected toggleTool(tool: string) {
    const current = this.settings().forbiddenTools || [];
    this.update('forbiddenTools', current.includes(tool) ? current.filter((t) => t !== tool) : [...current, tool]);
  }

  protected async save() {
    this.saving.set(true);
    this.message.set('');
    const s = this.settings();
    try {
      // The API key never leaves this browser: it is stored only in localStorage
      // and sent per-request with each agent run, not persisted on the backend.
      this.store.save(s);
      await this.api.post('/settings', {
        llmProvider: s.llmProvider,
        maxSteps: s.maxSteps,
        theme: s.theme,
        forbiddenTools: s.forbiddenTools,
        allowedDomains: s.allowedDomains,
      });
      this.message.set('Settings saved successfully');
    } catch (err) {
      this.message.set(`Failed to save: ${errorMessage(err)}`);
    } finally {
      this.saving.set(false);
    }
  }

  protected onFile(e: Event) {
    this.uploadFile.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected async upload() {
    const file = this.uploadFile();
    if (!file) return;
    this.uploadStatus.set('Uploading...');
    try {
      const data = await this.agent.uploadDocument(file);
      this.uploadStatus.set(`Stored "${data.filename}" (${data.characters_extracted} characters) in agent memory`);
    } catch (err) {
      this.uploadStatus.set(`Failed: ${errorMessage(err)}`);
    }
  }
}
