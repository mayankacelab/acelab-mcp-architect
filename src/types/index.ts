import { z } from 'zod';

// OAuth configuration schema
export const OAuthConfigSchema = z.object({
  token: z.string().min(1, 'OAuth token is required'),
  baseUrl: z.string().url('Invalid base URL').default('https://acelab-api-dev-pod-5-vnhmkx7udq-uk.a.run.app/api'),
});

export type OAuthConfig = z.infer<typeof OAuthConfigSchema>;

// API request/response types
export interface ApiRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  params?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// SSE event types
export interface SSEEvent {
  id?: string;
  event?: string;
  data: any;
  retry?: number;
}

// MCP tool definitions
export interface AcelabToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Server configuration
export interface ServerConfig {
  port: number;
  oauth: OAuthConfig;
  corsOrigins: string[];
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

// Error types
export interface AcelabError {
  code: string;
  message: string;
  details?: any;
}