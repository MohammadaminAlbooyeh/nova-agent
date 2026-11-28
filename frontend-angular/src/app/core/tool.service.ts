import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface Tool {
  name: string;
  description: string;
}

export interface Execution {
  id: string | number;
  tool_name: string;
  status: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ToolService {
  private readonly api = inject(ApiService);

  list(): Promise<Tool[]> {
    return this.api.get<Tool[]>('/tools');
  }

  executions(): Promise<Execution[]> {
    return this.api.get<Execution[]>('/executions');
  }
}
