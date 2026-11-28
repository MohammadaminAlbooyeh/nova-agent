import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { LocalSettingsService } from './local-settings.service';

export interface AgentRunResult {
  result: string;
  status?: string;
  [key: string]: unknown;
}

export interface UploadResult {
  filename: string;
  characters_extracted: number;
}

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly api = inject(ApiService);
  private readonly localSettings = inject(LocalSettingsService);

  runTask(task: string, workflow?: unknown): Promise<AgentRunResult> {
    const s = this.localSettings.load();
    return this.api.post<AgentRunResult>('/agents/run', {
      task,
      workflow,
      llm_provider: s.llmProvider,
      api_key: s.apiKey || null,
      model: s.model || null,
      policy: {
        max_steps: s.maxSteps,
        forbidden_tools: s.forbiddenTools,
        allowed_domains: s.allowedDomains.length ? s.allowedDomains : null,
      },
    });
  }

  uploadDocument(file: File): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<UploadResult>('/documents/upload', formData);
  }
}
