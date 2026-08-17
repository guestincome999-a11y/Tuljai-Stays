import type { ApiErrorResponse, ApiSuccessResponse } from '@tuljai/types';
import { ApplicationError } from '@tuljai/utils';
import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null> | string | null;
  refreshAccessToken?: () => Promise<string | null>;
}

export interface ApiRequestOptions extends Omit<AxiosRequestConfig, 'baseURL' | 'data' | 'url'> {
  body?: unknown;
}

export class ApiClient {
  private readonly baseUrlIncludesApiPrefix: boolean;
  private readonly client: AxiosInstance;
  private readonly getAccessToken?: ApiClientOptions['getAccessToken'];
  private readonly refreshAccessToken?: ApiClientOptions['refreshAccessToken'];
  private refreshPromise: Promise<string | null> | null = null;

  public constructor(options: ApiClientOptions) {
    this.getAccessToken = options.getAccessToken;
    this.refreshAccessToken = options.refreshAccessToken;
    const normalizedBaseUrl = options.baseUrl.replace(/\/$/, '');
    this.baseUrlIncludesApiPrefix = /\/api$/u.test(normalizedBaseUrl);
    this.client = axios.create({
      baseURL: normalizedBaseUrl,
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

  public async patch<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    return this.request<TResponse>(path, { method: 'PATCH', body });
  }

  public async request<TResponse>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<TResponse> {
    return this.executeRequest<TResponse>(path, options, true);
  }

  private async executeRequest<TResponse>(
    path: string,
    options: ApiRequestOptions,
    allowTokenRefresh: boolean,
  ): Promise<TResponse> {
    try {
      const response = await this.client.request<ApiSuccessResponse<TResponse> | TResponse>({
        ...options,
        url: this.normalizePath(path),
        data: options.body,
      });
      const payload = response.data;

      if (payload && typeof payload === 'object' && 'data' in payload) {
        return payload.data;
      }

      return payload;
    } catch (error) {
      if (
        allowTokenRefresh &&
        this.refreshAccessToken &&
        this.isUnauthorized(error) &&
        !this.isAuthenticationEndpoint(path)
      ) {
        const refreshedToken = await this.refreshAfterUnauthorized();

        if (refreshedToken) {
          return this.executeRequest<TResponse>(path, options, false);
        }
      }

      throw this.normalizeError(error);
    }
  }

  private async refreshAfterUnauthorized(): Promise<string | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken!().finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }

  private isUnauthorized(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 401;
  }

  private isAuthenticationEndpoint(path: string): boolean {
    return /\/(?:auth\/)?(?:logout|refresh-token|request-otp|verify-otp)$/u.test(path);
  }

  private async resolveAccessToken(): Promise<string | null> {
    if (!this.getAccessToken) {
      return null;
    }

    return this.getAccessToken();
  }

  private normalizePath(path: string): string {
    if (/^https?:\/\//u.test(path)) {
      return path;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const pathIncludesApiPrefix = normalizedPath === '/api' || normalizedPath.startsWith('/api/');

    if (this.baseUrlIncludesApiPrefix && pathIncludesApiPrefix) {
      return normalizedPath.replace(/^\/api/u, '') || '/';
    }

    if (!this.baseUrlIncludesApiPrefix && !pathIncludesApiPrefix) {
      return `/api${normalizedPath}`;
    }

    return normalizedPath;
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
