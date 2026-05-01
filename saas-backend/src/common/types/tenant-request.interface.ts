export interface JwtPayload {
  sub: string;        // userId
  tenantId: string;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AdminJwtPayload {
  sub: string;        // adminId
  scope: 'platform-admin';
  email: string;
}

export interface TenantRequest extends Request {
  user: JwtPayload;
  tenant: any;  // Tenant entity
}
