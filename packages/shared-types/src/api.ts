export interface AuthRegisterInput {
  email: string;
  motDePasse: string;
  nom: string;
  consentementMarketing: boolean;
}

export interface AuthLoginInput {
  email: string;
  motDePasse: string;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export type Theme = 'clair' | 'sombre' | 'systeme';
