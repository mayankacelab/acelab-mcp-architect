import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { OAuthConfig, ApiRequest, ApiResponse } from '../types';
import { logger, AcelabApiError, AuthenticationError } from '../utils/logger';

export class OAuthService {
  private axiosInstance: AxiosInstance;

  constructor(private config: OAuthConfig) {
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('Making API request', { 
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: { ...config.headers, Authorization: '[REDACTED]' }
        });
        return config;
      },
      (error) => {
        logger.error('Request interceptor error', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('API response received', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        if (error.response) {
          const { status, statusText, data } = error.response;
          logger.error('API error response', { status, statusText, data });
          
          if (status === 401) {
            throw new AuthenticationError('Invalid or expired OAuth token');
          }
          
          throw new AcelabApiError(
            `API request failed: ${statusText}`,
            status,
            data
          );
        } else if (error.request) {
          logger.error('Network error', error.message);
          throw new AcelabApiError('Network error: Unable to reach the API server');
        } else {
          logger.error('Request setup error', error.message);
          throw new AcelabApiError(`Request error: ${error.message}`);
        }
      }
    );
  }

  async makeRequest<T = any>(request: ApiRequest): Promise<ApiResponse<T>> {
    try {
      const axiosConfig: AxiosRequestConfig = {
        method: request.method,
        url: request.endpoint,
        data: request.data,
        params: request.params,
        headers: {
          ...request.headers
        }
      };

      const response: AxiosResponse<T> = await this.axiosInstance.request(axiosConfig);

      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as Record<string, string>
      };
    } catch (error) {
      logger.error('Request failed', { endpoint: request.endpoint, method: request.method, error });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Try to make a simple GET request to test the connection and auth
      await this.makeRequest({
        endpoint: '/',
        method: 'GET'
      });
      return true;
    } catch (error) {
      logger.warn('Connection test failed', error);
      return false;
    }
  }

  updateToken(newToken: string): void {
    this.config.token = newToken;
    this.axiosInstance.defaults.headers['Authorization'] = `Bearer ${newToken}`;
    logger.info('OAuth token updated');
  }
}