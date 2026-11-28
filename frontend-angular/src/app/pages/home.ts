import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import {
  LucideBookmark,
  LucideBookmarkCheck,
  LucideChevronLeft,
  LucideMoreHorizontal,
  LucidePaperclip,
  LucideSend,
  LucideSparkles,
} from '@lucide/angular';
import { AgentIcon } from '../components/agent-icon';
import { AgentStatus, CompanionPanel } from '../components/companion-panel';
import { errorMessage } from '../core/api.service';
import { AgentService } from '../core/agent.service';

interface Message {
  role: 'user' | 'agent';
  text: string;
  ok?: boolean;
}

@Component({
  selector: 'app-home-page',
  imports: [
    AgentIcon,
    CompanionPanel,
    LucideBookmark,
    LucideBookmarkCheck,
    LucideChevronLeft,
    LucideMoreHorizontal,
    LucidePaperclip,
    LucideSend,
    LucideSparkles,
  ],
  template: `
    <div class="today-layout">
      <div class="chat-column">
        <div class="chat-topbar">
          <div style="display: flex; align-items: center; gap: 10px">
            @if (messages().length > 0) {
              <button class="btn-icon" title="Back to a new chat" (click)="newChat()">
                <svg lucideChevronLeft [size]="16"></svg>
              </button>
            }
            <h1 style="margin-bottom: 0">{{ title() }}</h1>
          </div>
          <div class="chat-topbar__actions" style="position: relative">
            <button class="btn-icon" title="Bookmark this conversation" (click)="bookmarked.set(!bookmarked())">
              @if (bookmarked()) {
                <svg lucideBookmarkCheck [size]="16"></svg>
              } @else {
                <svg lucideBookmark [size]="16"></svg>
              }
            </button>
            <button class="btn-icon" title="More" (click)="menuOpen.set(!menuOpen())">
              <svg lucideMoreHorizontal [size]="16"></svg>
            </button>
            @if (menuOpen()) {
              <div class="card" style="position: absolute; right: 0; top: 42px; z-index: 2; padding: 6px; min-width: 140px">
                <button
                  class="btn-secondary"
                  style="width: 100%; border: none; text-align: left"
                  (click)="newChat()"
                >
                  New chat
                </button>
              </div>
            }
          </div>
        </div>

        @if (messages().length === 0) {
          <div class="chat-empty">
            <app-agent-icon [size]="56" />
            <p style="font-weight: 600; color: var(--color-text)">What should I work on?</p>
            <p>Ask me to search the web, read or write a file, query a database, and more.</p>
          </div>
        } @else {
          <div class="chat-log">
            @for (m of messages(); track $index) {
              <div class="chat-message" [class]="'chat-message--' + m.role">
                <div class="chat-message__avatar">
                  @if (m.role === 'agent') {
                    <app-agent-icon [size]="20" />
                  } @else {
                    LU
                  }
                </div>
                <div class="chat-message__body">
                  <div class="chat-message__name">{{ m.role === 'agent' ? 'Agent' : 'You' }}</div>
                  <div class="chat-message__bubble">{{ m.text }}</div>
                </div>
              </div>
            }
            @if (loading()) {
              <div class="chat-message chat-message--agent">
                <div class="chat-message__avatar"><app-agent-icon [size]="20" /></div>
                <div class="chat-message__body">
                  <div class="chat-message__name">Agent</div>
                  <div class="chat-message__bubble" style="color: var(--color-text-muted)">Thinking…</div>
                </div>
              </div>
            }
            <div #logEnd></div>
          </div>
        }

        <div class="chat-input-bar">
          <svg lucideSparkles [size]="16" color="var(--color-text-muted)" style="margin-left: 4px; flex-shrink: 0"></svg>
          <input
            [value]="input()"
            (input)="input.set($any($event.target).value)"
            (keydown)="onKeyDown($event)"
            placeholder="Ask your agent to do something..."
            [disabled]="loading()"
          />
          <input
            #fileInput
            type="file"
            style="display: none"
            accept=".txt,.md,.pdf,.docx"
            (change)="onFile($event)"
          />
          <button class="btn-icon" title="Attach a document" (click)="fileInput.click()" [disabled]="loading()">
            <svg lucidePaperclip [size]="16"></svg>
          </button>
          <button class="send" (click)="send()" [disabled]="loading() || !input().trim()">
            <svg lucideSend [size]="16"></svg>
          </button>
        </div>
      </div>

      <app-companion-panel [status]="agentStatus()" />
    </div>
  `,
})
export class HomePage {
  private readonly agent = inject(AgentService);
  private readonly logEnd = viewChild<ElementRef<HTMLElement>>('logEnd');

  protected readonly messages = signal<Message[]>([]);
  protected readonly input = signal('');
  protected readonly loading = signal(false);
  protected readonly bookmarked = signal(false);
  protected readonly menuOpen = signal(false);

  protected readonly title = computed(() => {
    const first = this.messages()[0];
    if (!first) return 'Today';
    return first.text.length > 48 ? `${first.text.slice(0, 48)}…` : first.text;
  });

  protected readonly agentStatus = computed<AgentStatus>(() =>
    this.loading() ? 'thinking' : this.messages().some((m) => m.ok === false) ? 'error' : 'ready',
  );

  constructor() {
    effect(() => {
      this.messages();
      this.loading();
      // wait for the DOM to render the new message before scrolling
      queueMicrotask(() => this.logEnd()?.nativeElement.scrollIntoView({ behavior: 'smooth' }));
    });
  }

  private push(m: Message) {
    this.messages.update((prev) => [...prev, m]);
  }

  protected newChat() {
    this.messages.set([]);
    this.menuOpen.set(false);
  }

  protected onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  protected async send() {
    const task = this.input().trim();
    if (!task || this.loading()) return;
    this.input.set('');
    this.push({ role: 'user', text: task });
    this.loading.set(true);
    try {
      const data = await this.agent.runTask(task);
      this.push({ role: 'agent', text: data.result, ok: true });
    } catch (err) {
      this.push({ role: 'agent', text: `Error: ${errorMessage(err)}`, ok: false });
    } finally {
      this.loading.set(false);
    }
  }

  protected async onFile(e: Event) {
    const el = e.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    this.push({ role: 'user', text: `Uploaded document: ${file.name}` });
    try {
      const data = await this.agent.uploadDocument(file);
      this.push({
        role: 'agent',
        text: `Got it — I stored "${data.filename}" (${data.characters_extracted} characters) in my memory. I can use it as context from now on.`,
        ok: true,
      });
    } catch (err) {
      this.push({ role: 'agent', text: `Couldn't store that file: ${errorMessage(err)}`, ok: false });
    }
  }
}
