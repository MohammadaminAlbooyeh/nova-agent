const STORAGE_KEY = 'mcp_agent_local_settings';

const DEFAULTS = {
  llmProvider: 'openai',
  apiKey: '',
  model: '',
  maxSteps: 20,
  forbiddenTools: ['code_executor', 'sql_executor', 'db_writer', 'file_manager'],
  allowedDomains: [],
  theme: 'light',
};

export function loadLocalSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

export function saveLocalSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
