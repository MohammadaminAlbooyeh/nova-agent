import { Injectable } from '@angular/core';

const STORAGE_KEY = 'mcp_agent_local_settings';

export interface LocalSettings {
  llmProvider: string;
  apiKey: string;
  model: string;
  maxSteps: number;
  forbiddenTools: string[];
  allowedDomains: string[];
  theme: string;
}

const DEFAULTS: LocalSettings = {
  llmProvider: 'openai',
  apiKey: '',
  model: '',
  maxSteps: 20,
  forbiddenTools: ['code_executor', 'sql_executor', 'db_writer', 'file_manager'],
  allowedDomains: [],
  theme: 'light',
};

@Injectable({ providedIn: 'root' })
export class LocalSettingsService {
  load(): LocalSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS, forbiddenTools: [...DEFAULTS.forbiddenTools] };
    }
  }

  save(settings: LocalSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
}
