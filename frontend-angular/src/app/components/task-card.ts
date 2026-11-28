import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Task } from '../core/task.service';

@Component({
  selector: 'app-task-card',
  imports: [RouterLink],
  template: `
    <a [routerLink]="['/tasks', task().id]" style="text-decoration: none">
      <div class="card" style="margin-bottom: 12px">
        <h3>{{ task().title }}</h3>
        <p style="color: var(--color-text-muted); margin-top: 8px">{{ task().description }}</p>
        <div style="margin-top: 12px; display: flex; gap: 8px">
          <span class="badge" [class]="priorityClass()">{{ task().priority }}</span>
          <span class="badge badge-muted">{{ task().status }}</span>
        </div>
      </div>
    </a>
  `,
})
export class TaskCard {
  readonly task = input.required<Task>();

  protected priorityClass(): string {
    const p = this.task().priority;
    return p === 'high' ? 'badge-danger' : p === 'medium' ? 'badge-warning' : 'badge-success';
  }
}
