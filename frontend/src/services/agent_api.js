import { api } from './api';
import { loadLocalSettings } from './localSettings';

export const agentApi = {
  runTask: (task, workflow) => {
    const settings = loadLocalSettings();
    return api.post('/agents/run', {
      task,
      workflow,
      llm_provider: settings.llmProvider,
      api_key: settings.apiKey || null,
      model: settings.model || null,
      policy: {
        max_steps: settings.maxSteps,
        forbidden_tools: settings.forbiddenTools,
        allowed_domains: settings.allowedDomains.length ? settings.allowedDomains : null,
      },
    });
  },

  getTools: () =>
    api.get('/tools'),
};
