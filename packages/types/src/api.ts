export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  errorCode: string;
  requestId?: string;
}

export interface ApiSuccessResponse<TData> {
  data: TData;
  requestId?: string;
}

export interface PaginationQuery {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
