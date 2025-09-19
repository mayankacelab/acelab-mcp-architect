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
      },
      {
        name: 'acelab_create_project',
        description: 'Create a new project in acelab using admin API',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Project name (required)'
            },
            projectOwnerId: {
              type: 'string',
              format: 'uuid',
              description: 'UUID of the project owner (required)'
            },
            typeId: {
              type: 'string',
              format: 'uuid',
              description: 'Project type UUID (optional)'
            },
            stateId: {
              type: 'string',
              format: 'uuid',
              description: 'State UUID (optional)'
            },
            phaseId: {
              type: 'string',
              format: 'uuid',
              description: 'Phase UUID (optional)'
            },
            budgetId: {
              type: 'string',
              format: 'uuid',
              description: 'Budget UUID (optional)'
            },
            googlePlaceId: {
              type: 'string',
              description: 'Google Place ID (optional)'
            }
          },
          required: ['name', 'projectOwnerId']
        }
      },
      {
        name: 'acelab_get_user_projects',
        description: 'Get all projects for the currently logged in user',
        inputSchema: {
          type: 'object',
          properties: {
            orderBy: {
              type: 'string',
              enum: ['Alphabetical', 'CreatedDate'],
              description: 'Order projects by field (optional)'
            },
            categoryId: {
              type: 'string',
              format: 'uuid',
              description: 'Filter by category UUID (optional)'
            }
          },
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
        
        case 'acelab_create_project':
          return await this.handleCreateProject(args);
        
        case 'acelab_get_user_projects':
          return await this.handleGetUserProjects(args);
        
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

  private async handleCreateProject(args: any): Promise<any> {
    const { name, projectOwnerId, typeId, stateId, phaseId, budgetId, googlePlaceId } = args;
    
    if (!name || typeof name !== 'string') {
      throw new Error('Project name is required and must be a string');
    }
    
    if (!projectOwnerId || typeof projectOwnerId !== 'string') {
      throw new Error('Project owner ID is required and must be a UUID string');
    }

    const projectData: any = {
      name,
      projectOwnerId
    };

    // Add optional fields if provided
    if (typeId) projectData.typeId = typeId;
    if (stateId) projectData.stateId = stateId;
    if (phaseId) projectData.phaseId = phaseId;
    if (budgetId) projectData.budgetId = budgetId;
    if (googlePlaceId) projectData.googlePlaceId = googlePlaceId;

    const response = await this.oauthService.makeRequest({
      endpoint: '/admin/projects',
      method: 'POST',
      data: projectData
    });

    // Broadcast successful project creation via SSE
    this.sseService.broadcast({
      event: 'project_created',
      data: {
        projectId: response.data,
        projectName: name,
        projectOwnerId,
        timestamp: new Date().toISOString()
      }
    });

    return {
      success: true,
      projectId: response.data,
      message: `Project "${name}" created successfully`,
      data: response.data
    };
  }

  private async handleGetUserProjects(args: any): Promise<any> {
    const { orderBy, categoryId } = args;
    
    const params: any = {};
    if (orderBy) params.orderBy = orderBy;
    if (categoryId) params.categoryId = categoryId;

    const response = await this.oauthService.makeRequest({
      endpoint: '/project/my-projects',
      method: 'GET',
      params
    });

    // Broadcast successful projects retrieval via SSE
    this.sseService.broadcast({
      event: 'projects_retrieved',
      data: {
        projectCount: Array.isArray(response.data) ? response.data.length : 0,
        filters: { orderBy, categoryId },
        timestamp: new Date().toISOString()
      }
    });

    return {
      success: true,
      projects: response.data,
      count: Array.isArray(response.data) ? response.data.length : 0,
      message: 'User projects retrieved successfully'
    };
  }
}