export interface ToolCategory {
  label: string;
  tools: string[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  { label: 'Web', tools: ['web_search', 'web_scraper', 'url_fetcher'] },
  { label: 'Database', tools: ['sql_executor', 'db_reader', 'db_writer'] },
  { label: 'Files', tools: ['file_reader', 'file_writer', 'file_manager'] },
  { label: 'Email', tools: ['gmail_reader', 'gmail_sender', 'gmail_reply_candidates', 'gmail_reply', 'email_parser'] },
  { label: 'API', tools: ['http_client', 'rest_caller', 'webhook_handler'] },
  { label: 'Code', tools: ['code_executor', 'code_analyzer', 'test_runner'] },
  { label: 'Utility', tools: ['calculator', 'datetime_tool', 'text_processor', 'data_formatter'] },
];

export const RISKY_TOOLS = new Set(['code_executor', 'file_manager', 'sql_executor', 'db_writer']);

export const ALL_TOOLS = TOOL_CATEGORIES.flatMap((c) => c.tools);

export const TOOL_CATEGORY: Record<string, string> = Object.fromEntries(
  TOOL_CATEGORIES.flatMap((c) => c.tools.map((tool) => [tool, c.label])),
);
