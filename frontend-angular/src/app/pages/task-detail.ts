import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { Task, TaskService } from '../core/task.service';

@Component({
  selector: 'app-task-detail-page',
  imports: [DatePipe],
  template: `
    <h1>Task Detail</h1>
    <div class="card" style="margin-top: 16px">
      @if (loading()) {
        <p>Loading...</p>
      } @else if (task(); as t) {
        <p><strong>ID:</strong> {{ t.id }}</p>
        <p><strong>Title:</strong> {{ t.title }}</p>
        <p><strong>Description:</strong> {{ t.description }}</p>
        <p><strong>Priority:</strong> {{ t.priority }}</p>
        <p><strong>Status:</strong> {{ t.status }}</p>
        <p><strong>Created:</strong> {{ t.created_at | date: 'medium' }}</p>
      } @else {
        <p>Task not found</p>
      }
    </div>
  `,
})
export class TaskDetailPage {
  private readonly taskService = inject(TaskService);

  /** Bound from the :id route param via withComponentInputBinding(). */
  readonly id = input.required<string>();
  protected readonly task = signal<Task | null>(null);
  protected readonly loading = signal(true);

  constructor() {
    effect(() => {
      const id = this.id();
      this.loading.set(true);
      this.taskService
        .get(id)
        .then((t) => this.task.set(t))
        .catch(() => this.task.set(null))
        .finally(() => this.loading.set(false));
    });
  }
}
