/**
 * Modelo para resultados paginados de Firestore
 */
export interface PaginationResult<T> {
  items: T[];
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage?: boolean;
  totalCount?: number;
  cursor?: {
    next?: any;
    previous?: any;
  };
}

/**
 * Opciones de paginación
 */
export interface PaginationOptions {
  pageSize?: number;
  direction?: 'asc' | 'desc';
}
