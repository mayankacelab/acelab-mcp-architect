import { OAuthService } from '../services/oauth';
import { SSEService } from '../services/sse';
import { AcelabToolDefinition, ApiRequest } from '../types';
import { logger, formatError } from '../utils/logger';

export class MCPHandler {
  private tools: AcelabToolDefinition[] = [];

  constructor(
    private oauthService: OAuthService,
    private sseService: SSEService
  ) {
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools = [
      {
        name: 'acelab_api_call',
        description: 'Make an authenticated API call to acelab endpoints',
        inputSchema: {
          type: 'object',
          properties: {
            endpoint: {
              type: 'string',
              description: 'API endpoint path (e.g., "/users", "/data")'
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
              default: 'GET',
              description: 'HTTP method for the request'
            },
            data: {
              type: 'object',
              description: 'Request body data (for POST, PUT, PATCH requests)'
            },
            params: {
              type: 'object',
              description: 'Query parameters as key-value pairs'
            },
            headers: {
              type: 'object',
              description: 'Additional headers to include in the request'
            }
          },
          required: ['endpoint']
        }
      },
      {
        name: 'acelab_stream_events',
        description: 'Start streaming real-time events from acelab API',
        inputSchema: {
          type: 'object',
          properties: {
            endpoint: {
              type: 'string',
              description: 'API endpoint to stream from'
            },
            interval: {
              type: 'number',
              default: 5000,
              description: 'Polling interval in milliseconds'
            },
            filters: {
              type: 'object',
              description: 'Filters to apply to the streaming data'
            }
          },
          required: ['endpoint']
        }
      },
      {
        name: 'acelab_update_token',
        description: 'Update the OAuth token for API authentication',
        inputSchema: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'New OAuth bearer token'
            }
          },
          required: ['token']
        }
      },
      {
        name: 'acelab_test_connection',
        description: 'Test the connection to acelab API',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ];
  }

  getTools(): AcelabToolDefinition[] {
    return this.tools;
  }

  async executeTool(name: string, args: any): Promise<any> {
    logger.info(`Executing tool: ${name}`, { args });

    try {
      switch (name) {
        case 'acelab_api_call':
          return await this.handleApiCall(args);
        
        case 'acelab_stream_events':
          return await this.handleStreamEvents(args);
        
        case 'acelab_update_token':
          return await this.handleUpdateToken(args);
        
        case 'acelab_test_connection':
          return await this.handleTestConnection();
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Tool execution failed: ${name}`, error);
      
      // Broadcast error event via SSE
      this.sseService.broadcast({
        event: 'tool_error',
        data: {
          tool: name,
          error: formatError(error),
          timestamp: new Date().toISOString()
        }
      });
      
      throw error;
    }
  }

  private async handleApiCall(args: any): Promise<any> {
    const request: ApiRequest = {
      endpoint: args.endpoint,
      method: args.method || 'GET',
      data: args.data,
      params: args.params,
      headers: args.headers
    };

    const response = await this.oauthService.makeRequest(request);

    // Broadcast successful API call via SSE
    this.sseService.broadcast({
      event: 'api_call_success',
      data: {
        request: { ...request, timestamp: new Date().toISOString() },
        response: {
          status: response.status,
          statusText: response.statusText,
          dataSize: JSON.stringify(response.data).length
        }
      }
    });

    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers
    };
  }

  private async handleStreamEvents(args: any): Promise<any> {
    const { endpoint, interval = 5000, filters } = args;

    // Start streaming by setting up a polling mechanism
    const streamId = `stream_${Date.now()}`;
    
    logger.info(`Starting event stream: ${streamId}`, { endpoint, interval });

    const poll = async (): Promise<void> => {
      try {
        const response = await this.oauthService.makeRequest({
          endpoint,
          method: 'GET',
          params: filters
        });

        this.sseService.broadcast({
          event: 'stream_data',
          data: {
            streamId,
            endpoint,
            data: response.data,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        this.sseService.broadcast({
          event: 'stream_error',
          data: {
            streamId,
            endpoint,
            error: formatError(error),
            timestamp: new Date().toISOString()
          }
        });
      }
    };

    // Start polling
    const intervalId = setInterval(poll, interval);

    // Initial poll
    await poll();

    // Store interval ID for potential cleanup (in a real implementation, 
    // you'd want to manage these intervals more carefully)
    logger.debug(`Stream interval created: ${intervalId}`);
    
    return {
      success: true,
      streamId,
      message: `Started streaming from ${endpoint} with ${interval}ms interval`,
      activeConnections: this.sseService.getActiveConnections()
    };
  }

  private async handleUpdateToken(args: any): Promise<any> {
    const { token } = args;
    
    if (!token || typeof token !== 'string') {
      throw new Error('Valid token is required');
    }

    this.oauthService.updateToken(token);

    // Test the new token
    const connectionTest = await this.oauthService.testConnection();

    this.sseService.broadcast({
      event: 'token_updated',
      data: {
        success: connectionTest,
        timestamp: new Date().toISOString()
      }
    });

    return {
      success: true,
      message: 'OAuth token updated successfully',
      connectionTest
    };
  }

  private async handleTestConnection(): Promise<any> {
    const isConnected = await this.oauthService.testConnection();

    this.sseService.broadcast({
      event: 'connection_test',
      data: {
        connected: isConnected,
        timestamp: new Date().toISOString()
      }
    });

    return {
      success: true,
      connected: isConnected,
      message: isConnected ? 'Connection successful' : 'Connection failed'
    };
  }
}