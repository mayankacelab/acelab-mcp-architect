import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { OAuthService } from './services/oauth';
import { SSEService } from './services/sse';
import { MCPHandler } from './handlers/mcp';
import { OAuthConfigSchema, ServerConfig } from './types';
import { logger, formatError } from './utils/logger';

// Load environment variables
dotenv.config();

export class AcelabMCPServer {
  private app: express.Application;
  private oauthService: OAuthService;
  private sseService: SSEService;
  private mcpHandler: MCPHandler;
  private config: ServerConfig;

  constructor() {
    this.app = express();
    this.config = this.loadConfig();
    this.sseService = new SSEService();
    this.oauthService = new OAuthService(this.config.oauth);
    this.mcpHandler = new MCPHandler(this.oauthService, this.sseService);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private loadConfig(): ServerConfig {
    const token = process.env.OAUTH_TOKEN;
    if (!token) {
      throw new Error('OAUTH_TOKEN environment variable is required');
    }

    const oauthConfig = OAuthConfigSchema.parse({
      token,
      baseUrl: process.env.API_BASE_URL || 'https://acelab-api-dev-pod-5-vnhmkx7udq-uk.a.run.app/api'
    });

    return {
      port: parseInt(process.env.PORT || '3000'),
      oauth: oauthConfig,
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
      logLevel: (process.env.LOG_LEVEL as any) || 'info'
    };
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable CSP for SSE
      crossOriginEmbedderPolicy: false
    }));

    // CORS
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        query: req.query
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        activeConnections: this.sseService.getActiveConnections()
      });
    });

    // MCP tools listing
    this.app.get('/tools', (req: Request, res: Response) => {
      try {
        const tools = this.mcpHandler.getTools();
        res.json({
          success: true,
          tools,
          count: tools.length
        });
      } catch (error) {
        logger.error('Failed to get tools', error);
        res.status(500).json({
          success: false,
          error: formatError(error)
        });
      }
    });

    // Tool execution
    this.app.post('/tools/:toolName/execute', async (req: Request, res: Response) => {
      const { toolName } = req.params;
      const args = req.body;

      try {
        const result = await this.mcpHandler.executeTool(toolName, args);
        res.json({
          success: true,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Tool execution failed: ${toolName}`, error);
        res.status(500).json({
          success: false,
          error: formatError(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    // SSE endpoint
    this.app.get('/events', (req: Request, res: Response) => {
      try {
        const connectionId = this.sseService.connect(res);
        logger.info(`SSE connection established: ${connectionId}`);
      } catch (error) {
        logger.error('Failed to establish SSE connection', error);
        res.status(500).json({
          success: false,
          error: formatError(error)
        });
      }
    });

    // API proxy endpoint (for direct API calls)
    this.app.all('/api/*', async (req: Request, res: Response) => {
      const endpoint = req.path.replace('/api', '');
      
      try {
        const result = await this.mcpHandler.executeTool('acelab_api_call', {
          endpoint,
          method: req.method,
          data: req.body,
          params: req.query,
          headers: req.headers
        });

        res.status(result.status || 200).json(result);
      } catch (error) {
        logger.error(`API proxy failed for ${endpoint}`, error);
        res.status(500).json({
          success: false,
          error: formatError(error)
        });
      }
    });

    // Configuration endpoint
    this.app.get('/config', (req: Request, res: Response) => {
      res.json({
        baseUrl: this.config.oauth.baseUrl,
        port: this.config.port,
        corsOrigins: this.config.corsOrigins,
        logLevel: this.config.logLevel,
        hasToken: !!this.config.oauth.token
      });
    });

    // Update token endpoint
    this.app.post('/auth/token', async (req: Request, res: Response) => {
      const { token } = req.body;

      try {
        const result = await this.mcpHandler.executeTool('acelab_update_token', { token });
        res.json({
          success: true,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Token update failed', error);
        res.status(400).json({
          success: false,
          error: formatError(error)
        });
      }
    });

    // Error handling middleware
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      logger.error('Unhandled error', error);
      res.status(500).json({
        success: false,
        error: formatError(error)
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          message: 'Endpoint not found',
          code: 'NOT_FOUND'
        }
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const server = this.app.listen(this.config.port, () => {
          logger.info(`Acelab MCP Server started on port ${this.config.port}`, {
            baseUrl: this.config.oauth.baseUrl,
            corsOrigins: this.config.corsOrigins
          });
          resolve();
        });

        server.on('error', (error) => {
          logger.error('Server failed to start', error);
          reject(error);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
          logger.info('SIGTERM received, shutting down gracefully');
          server.close(() => {
            logger.info('Server closed');
            process.exit(0);
          });
        });

      } catch (error) {
        logger.error('Failed to start server', error);
        reject(error);
      }
    });
  }
}

// Main entry point
if (require.main === module) {
  const server = new AcelabMCPServer();
  
  server.start().catch((error) => {
    logger.error('Failed to start server', error);
    process.exit(1);
  });
}