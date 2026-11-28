import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, errorMessage } from '../core/api.service';

@Component({
  selector: 'app-oauth-callback-page',
  template: `
    <div style="padding: 40px; max-width: 500px; margin: 0 auto; text-align: center">
      <h2>
        @switch (status()) {
          @case ('processing') { Connecting... }
          @case ('success') { ✓ Connected }
          @case ('error') { ✗ Connection Failed }
        }
      </h2>
      <p>{{ message() }}</p>
      <button class="btn-primary" style="margin-top: 16px" (click)="back()">Back to Connections</button>
    </div>
  `,
})
export class OAuthCallbackPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  protected readonly status = signal<'processing' | 'success' | 'error'>('processing');
  protected readonly message = signal('Completing authorization...');

  async ngOnInit() {
    const q = this.route.snapshot.queryParamMap;
    const code = q.get('code');
    const sessionId = q.get('state');
    const oauthError = q.get('error');
    const provider = 'gmail';

    if (oauthError) {
      this.fail(`Authorization was denied or failed: ${oauthError}`);
      return;
    }
    if (!code || !sessionId) {
      this.fail('Missing authorization code or session. Please try connecting again.');
      return;
    }

    try {
      const res = await this.api.post<{ message?: string }>(`/oauth/callback/${provider}`, {
        code,
        session_id: sessionId,
        provider,
      });
      this.status.set('success');
      this.message.set(res.message || 'Successfully authenticated.');
    } catch (err) {
      this.fail(`Failed to complete authorization: ${errorMessage(err)}`);
    }
  }

  protected back() {
    this.router.navigate(['/connections']);
  }

  private fail(msg: string) {
    this.status.set('error');
    this.message.set(msg);
  }
}
