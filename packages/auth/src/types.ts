export interface AuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  jwtSecret?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
}

export interface TenantContext {
  tenantId: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  user: AuthUser & {
    role: string;
    permissions: string[];
  };
  subscription?: {
    plan: string;
    status: string;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  is_super_admin: boolean;
  tenant_id?: string;
  product_id?: string;
  permissions: string[];
  iat: number;
  exp: number;
}
