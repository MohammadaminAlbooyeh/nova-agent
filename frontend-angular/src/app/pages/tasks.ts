import { Component, OnInit, inject, signal } from '@angular/core';
import { TaskCard } from '../components/task-card';
import { Task, TaskService } from '../core/task.service';

@Component({
  selector: 'app-tasks-page',
  imports: [TaskCard],
  template: `
    <h1>Tasks</h1>
    <div style="margin-top: 16px">
      @for (task of tasks(); track task.id) {
        <app-task-card [task]="task" />
      }
      @if (!loading() && tasks().length === 0) {
        <p class="card">No tasks yet</p>
      }
    </div>
  `,
})
export class TasksPage implements OnInit {
  private readonly taskService = inject(TaskService);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly loading = signal(true);

  async ngOnInit() {
    try {
      this.tasks.set(await this.taskService.list());
    } catch {
      /* leave empty */
    } finally {
      this.loading.set(false);
    }
  }
}
