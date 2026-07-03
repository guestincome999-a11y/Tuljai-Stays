import type { ApiErrorResponse, ApiSuccessResponse } from '@tuljai/types';
import { ApplicationError } from '@tuljai/utils';
import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null> | string | null;
}

export interface ApiRequestOptions extends Omit<AxiosRequestConfig, 'baseURL' | 'data' | 'url'> {
  body?: unknown;
}

export class ApiClient {
  private readonly client: AxiosInstance;
  private readonly getAccessToken?: ApiClientOptions['getAccessToken'];

  public constructor(options: ApiClientOptions) {
    this.getAccessToken = options.getAccessToken;
    this.client = axios.create({
      baseURL: options.baseUrl.replace(/\/$/, ''),
      headers: {
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    this.client.interceptors.request.use(async (config) => {
      const accessToken = await this.resolveAccessToken();

      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      return config;
    });
  }

  public async get<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
    return this.request<TResponse>(path, { ...options, method: 'GET' });
  }

  public async post<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    return this.request<TResponse>(path, { method: 'POST', body });
  }

  public async request<TResponse>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<TResponse> {
    try {
      const response = await this.client.request<ApiSuccessResponse<TResponse> | TResponse>({
        ...options,
        url: path,
        data: options.body,
      });
      const payload = response.data;

      if (payload && typeof payload === 'object' && 'data' in payload) {
        return payload.data;
      }

      return payload;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private async resolveAccessToken(): Promise<string | null> {
    if (!this.getAccessToken) {
      return null;
    }

    return this.getAccessToken();
  }

  private normalizeError(error: unknown): ApplicationError {
    if (!axios.isAxiosError(error)) {
      return new ApplicationError('Unexpected API client error', 'API_CLIENT_ERROR');
    }

    const axiosError = error as AxiosError<ApiErrorResponse>;
    const responsePayload = axiosError.response?.data;

    return new ApplicationError(
      responsePayload?.message ?? axiosError.message,
      responsePayload?.errorCode ?? 'API_REQUEST_FAILED',
      {
        requestId: responsePayload?.requestId,
        statusCode: axiosError.response?.status,
      },
    );
  }
}
