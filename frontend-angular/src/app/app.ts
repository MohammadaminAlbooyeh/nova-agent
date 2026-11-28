import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Sidebar } from './components/sidebar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar],
  template: `
    <div class="app">
      <div class="app-body">
        <app-sidebar />
        <main class="main-content" [class.narrow]="!isToday()" [class.wide]="isWide()">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class App {
  private readonly router = inject(Router);
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );
  protected readonly isToday = () => this.path() === '/' || this.path() === '';
  protected readonly isWide = () => this.path() === '/connections';
}
