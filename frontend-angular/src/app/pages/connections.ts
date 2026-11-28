import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../core/api.service';
import { GMAIL_CLIENT_ID_KEY, GMAIL_CLIENT_SECRET_KEY, SESSION_STORAGE_KEY } from '../core/config';
import { LocalSettings, LocalSettingsService } from '../core/local-settings.service';

interface AuthStatus {
  authenticated: boolean;
  user_email?: string;
  is_expired?: boolean;
}

interface GmailFilters {
  ignore_terms: string[];
  important_terms: string[];
  only_important: boolean;
  max_results: number;
  reply_enabled: boolean;
  reply_mode: 'draft' | 'send';
  reply_only_important: boolean;
  reply_only_unread: boolean;
  reply_skip_ignored: boolean;
  reply_skip_automated: boolean;
  reply_skip_already_replied: boolean;
  reply_allowed_senders: string[];
  reply_max_per_run: number;
  reply_tone: 'friendly' | 'formal' | 'brief';
  reply_instructions: string;
}

const DEFAULT_FILTERS: GmailFilters = {
  ignore_terms: [],
  important_terms: [],
  only_important: false,
  max_results: 10,
  reply_enabled: false,
  reply_mode: 'draft',
  reply_only_important: false,
  reply_only_unread: true,
  reply_skip_ignored: true,
  reply_skip_automated: true,
  reply_skip_already_replied: true,
  reply_allowed_senders: [],
  reply_max_per_run: 5,
  reply_tone: 'friendly',
  reply_instructions: '',
};

type ReplyToggle =
  | 'reply_only_unread'
  | 'reply_only_important'
  | 'reply_skip_ignored'
  | 'reply_skip_automated'
  | 'reply_skip_already_replied';

@Component({
  selector: 'app-connections-page',
  imports: [FormsModule],
  template: `
    <h1>Connections</h1>
    <p class="page-subtitle">Everything the agent needs you to connect, in one place.</p>

    <div class="cards-grid">
    <div class="card">
      <h2>LLM Provider &amp; API Key</h2>
      <p class="section-description">
        Stored only in this browser's local storage and sent directly with each agent run. Never saved on the server.
      </p>
      <div class="form-row">
        <div class="form-group">
          <label>Provider</label>
          <select [ngModel]="settings().llmProvider" (ngModelChange)="updateLlm('llmProvider', $event)">
            <option value="openai">OpenAI</option>
            <option value="claude">Claude</option>
            <option value="groq">Groq</option>
            <option value="local">Local</option>
          </select>
        </div>
        <div class="form-group">
          <label>Model (optional)</label>
          <input
            type="text"
            placeholder="e.g. claude-opus-4-20250514, gpt-4"
            [ngModel]="settings().model"
            (ngModelChange)="updateLlm('model', $event)"
          />
        </div>
      </div>
      <div class="form-group">
        <label>API Key</label>
        <input
          type="password"
          placeholder="sk-..."
          autocomplete="off"
          [ngModel]="settings().apiKey"
          (ngModelChange)="updateLlm('apiKey', $event)"
        />
      </div>
      <button class="btn-primary" (click)="saveLlm()">Save</button>
      @if (llmSaved()) {
        <div class="banner banner-success">Saved.</div>
      }
    </div>

    <div class="card">
      <h2>Gmail <span class="badge badge-muted">optional</span></h2>
      <p class="section-description">
        Lets the agent read and send email through your Gmail account. Bring your own Google OAuth client, or
        leave the fields blank to use the one the operator may have configured.
      </p>

      @if (sessionError()) {
        <div class="banner banner-error">{{ sessionError() }}</div>
      }

      @if (authStatus()?.authenticated) {
        <div class="banner banner-success">
          ✓ Connected{{ authStatus()?.user_email ? ' as ' + authStatus()?.user_email : '' }}
        </div>
        @if (authStatus()?.is_expired) {
          <div class="banner banner-warning">Token expired — refresh it below.</div>
        }
        <div class="form-row">
          @if (authStatus()?.is_expired) {
            <button class="btn-secondary" (click)="refreshGmailToken()" [disabled]="gmailLoading()">
              {{ gmailLoading() ? 'Refreshing...' : 'Refresh Token' }}
            </button>
          }
          <button class="btn-secondary" (click)="disconnectGmail()" [disabled]="gmailLoading()">
            {{ gmailLoading() ? 'Disconnecting...' : 'Disconnect' }}
          </button>
        </div>
      } @else {
        <div class="form-group">
          <label>Google Client ID</label>
          <input
            type="text"
            placeholder="xxxxxxxxxx.apps.googleusercontent.com"
            [ngModel]="clientId()"
            (ngModelChange)="clientId.set($event)"
          />
        </div>
        <div class="form-group">
          <label>Google Client Secret</label>
          <input
            type="password"
            placeholder="GOCSPX-..."
            autocomplete="off"
            [ngModel]="clientSecret()"
            (ngModelChange)="clientSecret.set($event)"
          />
        </div>
        <p class="hint">
          Redirect URI to register in Google Cloud Console: <code>{{ origin }}/oauth/callback</code>
        </p>
        @if (gmailError()) {
          <div class="banner banner-error">{{ gmailError() }}</div>
        }
        @if (gmailMessage()) {
          <div class="banner banner-info">{{ gmailMessage() }}</div>
        }
        <button class="btn-primary" (click)="connectGmail()" [disabled]="gmailLoading() || !sessionId()">
          {{ gmailLoading() ? 'Connecting...' : 'Connect Gmail' }}
        </button>
      }
    </div>

    <div class="card">
        <h2>Email Filters</h2>
        <p class="section-description">
          Control which emails the agent is allowed to act on. Terms here match against the sender and subject.
          Anything matching "Ignore" is skipped entirely (so the agent doesn't waste time on newsletters/no-reply
          mail); anything matching "Important" is flagged and written to a file you can review.
        </p>

        @if (filtersError()) {
          <div class="banner banner-error">{{ filtersError() }}</div>
        }

        @if (!ready()) {
          <div class="banner banner-info">Connect Gmail above to edit these settings.</div>
        }
        @let f = view();
        <fieldset [disabled]="!ready()" style="border: none; min-width: 0; margin: 0; padding: 0; opacity: 1">
          <div class="form-group">
            <label>Ignore (comma-separated senders/keywords)</label>
            <input
              type="text"
              placeholder="noreply, newsletter, promotions"
              [ngModel]="(f.ignore_terms || []).join(', ')"
              (ngModelChange)="updateFilters({ ignore_terms: splitList($event) })"
            />
          </div>
          <div class="form-group">
            <label>Important (comma-separated senders/keywords)</label>
            <input
              type="text"
              placeholder="boss@company.com, invoice, urgent"
              [ngModel]="(f.important_terms || []).join(', ')"
              (ngModelChange)="updateFilters({ important_terms: splitList($event) })"
            />
          </div>
          <div class="form-row">
            <label>
              <input
                type="checkbox"
                style="width: auto"
                [checked]="!!f.only_important"
                (change)="updateFilters({ only_important: $any($event.target).checked })"
              />
              Only show emails matching "Important"
            </label>
          </div>
          <div class="form-group">
            <label>Max emails to scan per read</label>
            <input
              type="number"
              min="1"
              max="100"
              [ngModel]="f.max_results || 10"
              (ngModelChange)="updateFilters({ max_results: +$event })"
            />
          </div>
          <button class="btn-primary" (click)="saveFilters()">Save Filters</button>
          @if (filtersSaved()) {
            <div class="banner banner-success">Saved.</div>
          }
          <p class="hint">
            Emails flagged as important are written to <code>data/gmail_important_{{ sessionId() }}.json</code> each
            time the agent reads the inbox.
          </p>
        </fieldset>
      </div>
    <div class="card">
        <h2>Auto-reply</h2>
        <p class="section-description">
          Choose which emails the agent may answer. Tell it "reply to my emails" in chat and it will read the
          emails that pass these rules, write a reply to each one, and keep it in the original conversation.
          Replies are saved as Gmail drafts unless you switch to sending.
        </p>

        @if (!ready()) {
          <div class="banner banner-info">Connect Gmail above to edit these settings.</div>
        }
        @let r = view();
        <fieldset [disabled]="!ready()" style="border: none; min-width: 0; margin: 0; padding: 0; opacity: 1">
        <label class="tool-toggle" style="margin-bottom: 14px">
          <span class="switch">
            <input type="checkbox" [checked]="r.reply_enabled" (change)="updateFilters({ reply_enabled: $any($event.target).checked })" />
            <span class="slider"></span>
          </span>
          <strong>Let the agent reply to my emails</strong>
        </label>

        <div [style.opacity]="r.reply_enabled ? 1 : 0.5" [style.pointer-events]="r.reply_enabled ? 'auto' : 'none'">
          <div class="form-group">
            <label>What should happen to each reply?</label>
            <select [ngModel]="r.reply_mode" (ngModelChange)="updateFilters({ reply_mode: $event })">
              <option value="draft">Save as a draft in Gmail (recommended, I review before sending)</option>
              <option value="send">Send immediately</option>
            </select>
            @if (r.reply_mode === 'send') {
              <div class="banner banner-warning">
                The agent will send replies without asking you first. Replies can't be unsent.
              </div>
            }
          </div>

          <div class="form-group">
            <label>Only reply to emails that are…</label>
            @for (opt of replyToggles; track opt.key) {
              <label class="tool-toggle">
                <span class="switch">
                  <input type="checkbox" [checked]="r[opt.key]" (change)="updateFilters(toggle(opt.key, $any($event.target).checked))" />
                  <span class="slider"></span>
                </span>
                <span>{{ opt.label }}</span>
              </label>
            }
          </div>

          <div class="form-group">
            <label>
              Only these senders
              <span class="hint" style="display: inline; font-weight: 400">(comma-separated, empty = anyone)</span>
            </label>
            <input
              type="text"
              placeholder="boss@company.com, client.com"
              [ngModel]="(r.reply_allowed_senders || []).join(', ')"
              (ngModelChange)="updateFilters({ reply_allowed_senders: splitList($event) })"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Max replies per run</label>
              <input
                type="number"
                min="1"
                max="25"
                [ngModel]="r.reply_max_per_run"
                (ngModelChange)="updateFilters({ reply_max_per_run: clamp($event, 1, 25) })"
              />
            </div>
            <div class="form-group">
              <label>Tone</label>
              <select [ngModel]="r.reply_tone" (ngModelChange)="updateFilters({ reply_tone: $event })">
                <option value="friendly">Friendly</option>
                <option value="formal">Formal</option>
                <option value="brief">Brief</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Extra instructions for replies <span class="hint" style="display: inline; font-weight: 400">(optional)</span></label>
            <textarea
              rows="3"
              maxlength="500"
              placeholder="e.g. Sign off as Amin. If someone asks for a meeting, suggest next Tuesday afternoon."
              [ngModel]="r.reply_instructions"
              (ngModelChange)="updateFilters({ reply_instructions: $event })"
            ></textarea>
          </div>
        </div>

        <button class="btn-primary" (click)="saveFilters()">Save Auto-reply</button>
        @if (filtersSaved()) {
          <div class="banner banner-success">Saved.</div>
        }
        @if (filtersError()) {
          <div class="banner banner-error">{{ filtersError() }}</div>
        }
        <p class="hint">
          The agent never replies to mail matching your Ignore list or to mailing lists unless you untick those
          options. Each email is answered at most once.
        </p>
        </fieldset>
      </div>
    </div>
  `,
})
export class ConnectionsPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly store = inject(LocalSettingsService);

  protected readonly origin = window.location.origin;

  protected readonly settings = signal<LocalSettings>(this.store.load());
  protected readonly llmSaved = signal(false);

  protected readonly sessionId = signal<string | null>(null);
  protected readonly sessionError = signal<string | null>(null);

  protected readonly clientId = signal(localStorage.getItem(GMAIL_CLIENT_ID_KEY) || '');
  protected readonly clientSecret = signal(localStorage.getItem(GMAIL_CLIENT_SECRET_KEY) || '');
  protected readonly authStatus = signal<AuthStatus | null>(null);
  protected readonly gmailLoading = signal(false);
  protected readonly gmailError = signal<string | null>(null);
  protected readonly gmailMessage = signal<string | null>(null);

  protected readonly filters = signal<GmailFilters | null>(null);
  protected readonly filtersSaved = signal(false);
  /** Filters are editable only once Gmail is connected and the saved values have loaded. */
  protected readonly ready = computed(() => !!this.authStatus()?.authenticated && !!this.filters());
  /** What the cards display: saved values when available, otherwise a read-only preview of the defaults. */
  protected readonly view = computed(() => this.filters() ?? DEFAULT_FILTERS);
  protected readonly filtersError = signal<string | null>(null);

  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private connectPollTimer: ReturnType<typeof setInterval> | null = null;
  private connectPollStop: ReturnType<typeof setTimeout> | null = null;

  protected splitList = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);
  protected clamp = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || lo));
  protected toggle = (key: ReplyToggle, value: boolean) => ({ [key]: value }) as Partial<GmailFilters>;

  protected readonly replyToggles: { key: ReplyToggle; label: string }[] = [
    { key: 'reply_only_unread', label: 'Unread' },
    { key: 'reply_only_important', label: 'Marked important (matches your Important list)' },
    { key: 'reply_skip_ignored', label: 'Not on my Ignore list (newsletters, no-reply, …)' },
    { key: 'reply_skip_automated', label: 'Not automated (mailing lists, bulk mail, auto-responders)' },
    { key: 'reply_skip_already_replied', label: 'Not already answered by me' },
  ];

  async ngOnInit() {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      this.sessionId.set(existing);
    } else {
      try {
        const res = await this.api.post<{ id: string }>('/sessions/create', {
          metadata: { created_for: 'connections' },
        });
        localStorage.setItem(SESSION_STORAGE_KEY, res.id);
        this.sessionId.set(res.id);
      } catch (err) {
        this.sessionError.set(`Failed to create session: ${errorMessage(err)}`);
        return;
      }
    }
    this.checkGmailStatus();
    this.statusTimer = setInterval(() => this.checkGmailStatus(), 10000);
  }

  ngOnDestroy() {
    if (this.statusTimer) clearInterval(this.statusTimer);
    this.stopConnectPolling();
  }

  // ---- LLM settings ----
  protected updateLlm<K extends keyof LocalSettings>(field: K, value: LocalSettings[K]) {
    this.settings.update((s) => ({ ...s, [field]: value }));
    this.llmSaved.set(false);
  }

  protected saveLlm() {
    this.store.save(this.settings());
    this.llmSaved.set(true);
  }

  // ---- Gmail ----
  private async checkGmailStatus() {
    const id = this.sessionId();
    if (!id) return;
    const wasAuthenticated = !!this.authStatus()?.authenticated;
    try {
      const status = await this.api.get<AuthStatus>('/oauth/status/gmail', { session_id: id });
      this.authStatus.set(status);
      if (status.authenticated && !wasAuthenticated) this.loadFilters();
    } catch {
      this.authStatus.set(null);
    }
  }

  private stopConnectPolling() {
    if (this.connectPollTimer) clearInterval(this.connectPollTimer);
    if (this.connectPollStop) clearTimeout(this.connectPollStop);
    this.connectPollTimer = this.connectPollStop = null;
  }

  protected async connectGmail() {
    const id = this.sessionId();
    if (!id) return;
    this.gmailLoading.set(true);
    this.gmailError.set(null);
    this.gmailMessage.set(null);
    try {
      if (this.clientId()) localStorage.setItem(GMAIL_CLIENT_ID_KEY, this.clientId());
      if (this.clientSecret()) localStorage.setItem(GMAIL_CLIENT_SECRET_KEY, this.clientSecret());

      const res = await this.api.post<{ auth_url: string }>(
        '/oauth/authorize/gmail',
        { client_id: this.clientId() || undefined, client_secret: this.clientSecret() || undefined },
        { session_id: id },
      );
      window.open(res.auth_url, 'GoogleAuthorization', 'width=500,height=650');
      this.gmailMessage.set('A Google sign-in window opened. Complete it there, then this page updates automatically.');

      this.stopConnectPolling();
      this.connectPollTimer = setInterval(() => this.checkGmailStatus(), 2000);
      this.connectPollStop = setTimeout(() => this.stopConnectPolling(), 60000);
    } catch (err) {
      this.gmailError.set(errorMessage(err));
    } finally {
      this.gmailLoading.set(false);
    }
  }

  protected async disconnectGmail() {
    const id = this.sessionId();
    if (!id || !window.confirm('Disconnect Gmail?')) return;
    this.gmailLoading.set(true);
    try {
      await this.api.post('/oauth/disconnect/gmail', {}, { session_id: id });
      this.authStatus.set(null);
      this.filters.set(null);
      this.gmailMessage.set('Disconnected.');
    } catch (err) {
      this.gmailError.set(errorMessage(err));
    } finally {
      this.gmailLoading.set(false);
    }
  }

  protected async refreshGmailToken() {
    const id = this.sessionId();
    if (!id) return;
    this.gmailLoading.set(true);
    try {
      await this.api.post('/oauth/refresh/gmail', {}, { session_id: id });
      this.checkGmailStatus();
    } catch (err) {
      this.gmailError.set(errorMessage(err));
    } finally {
      this.gmailLoading.set(false);
    }
  }

  // ---- Email filters ----
  private async loadFilters() {
    const id = this.sessionId();
    if (!id) return;
    try {
      this.filters.set(await this.api.get<GmailFilters>('/oauth/gmail/filters', { session_id: id }));
    } catch (err) {
      this.filtersError.set(errorMessage(err));
    }
  }

  protected updateFilters(patch: Partial<GmailFilters>) {
    this.filters.update((f) => (f ? { ...f, ...patch } : f));
    this.filtersSaved.set(false);
  }

  protected async saveFilters() {
    const id = this.sessionId();
    const f = this.filters();
    if (!id || !f) return;
    this.filtersError.set(null);
    try {
      const saved = await this.api.post<GmailFilters>(
        '/oauth/gmail/filters',
        f,
        { session_id: id },
      );
      this.filters.set(saved);
      this.filtersSaved.set(true);
    } catch (err) {
      this.filtersError.set(errorMessage(err));
    }
  }
}
