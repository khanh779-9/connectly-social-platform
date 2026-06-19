export interface AuthResponse {
  userId: string;
  accessToken: string;
  refreshToken: string;
  displayName: string;
  rememberMe?: boolean;
}
export interface RegisterRequest { email: string; password: string; displayName: string; rememberMe?: boolean; }
export interface LoginRequest { email: string; password: string; rememberMe?: boolean; }
