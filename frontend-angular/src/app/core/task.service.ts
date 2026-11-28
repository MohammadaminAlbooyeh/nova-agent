import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface Task {
  id: string | number;
  title: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly api = inject(ApiService);

  list(): Promise<Task[]> {
    return this.api.get<Task[]>('/tasks');
  }

  get(id: string): Promise<Task> {
    return this.api.get<Task>(`/tasks/${id}`);
  }
}
