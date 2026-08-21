import { McpPreset } from '../../types/mcp';

export const MCP_PRESETS: McpPreset[] = [
  {
    id: 'sqlite',
    name: 'SQLite Database',
    description: 'Execute SQL queries, inspect tables, and analyze schemas on local SQLite DB files.',
    category: 'database',
    icon: 'Database',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', './workspace.db'],
    requiresConfig: true,
    configFields: [
      {
        key: 'dbPath',
        label: 'Database File Path',
        type: 'path',
        placeholder: './database.sqlite',
        description: 'Relative or absolute path to your SQLite database file.'
      }
    ]
  },
  {
    id: 'memory',
    name: 'Knowledge Graph Memory',
    description: 'Persistent entity-relation graph memory across all agent conversations.',
    category: 'memory',
    icon: 'Brain',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory']
  },
  {
    id: 'filesystem',
    name: 'Extended Filesystem',
    description: 'Secure directory listing, reading, and writing across specified workspace paths.',
    category: 'filesystem',
    icon: 'Folder',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', './']
  },
  {
    id: 'github',
    name: 'GitHub Integration',
    description: 'Inspect repositories, create PRs, list issues, and trigger actions.',
    category: 'developer',
    icon: 'Github',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    requiresConfig: true,
    configFields: [
      {
        key: 'GITHUB_PERSONAL_ACCESS_TOKEN',
        label: 'GitHub Personal Access Token',
        type: 'password',
        placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
        description: 'GitHub Personal Access Token with repo scope.'
      }
    ]
  },
  {
    id: 'postgres',
    name: 'PostgreSQL Database',
    description: 'Read and write schemas and tables in PostgreSQL databases.',
    category: 'database',
    icon: 'Server',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
    requiresConfig: true,
    configFields: [
      {
        key: 'connectionString',
        label: 'Connection URL',
        type: 'string',
        placeholder: 'postgresql://user:pass@localhost:5432/dbname',
        description: 'Full PostgreSQL connection string.'
      }
    ]
  },
  {
    id: 'brave-search',
    name: 'Brave Web Search',
    description: 'Real-time web search and content summaries via Brave Search API.',
    category: 'web',
    icon: 'Globe',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    requiresConfig: true,
    configFields: [
      {
        key: 'BRAVE_API_KEY',
        label: 'Brave Search API Key',
        type: 'password',
        placeholder: 'BSA_xxxxxxxxxxxxxxxxxxxx',
        description: 'API key from https://brave.com/search/api/'
      }
    ]
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer Web Automation',
    description: 'Browser automation, screenshot rendering, and web scraping.',
    category: 'web',
    icon: 'Globe',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer']
  }
];
