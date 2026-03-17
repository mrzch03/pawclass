/** JWT payload for browser auth (Logto) */
export interface LogtoJwtPayload {
  /** Subject — the user ID */
  sub: string;
  /** Issuer — Logto OIDC issuer URL */
  iss: string;
  /** Audience */
  aud: string | string[];
  /** Expiration time (unix timestamp) */
  exp: number;
  /** Issued at (unix timestamp) */
  iat: number;
}

/** JWT payload for CLI/Agent delegation tokens */
export interface DelegationJwtPayload {
  /** Subject — the user ID */
  sub: string;
  /** Token type — must be "delegation" */
  type: "delegation";
  /** Application identifier (e.g. "cli", "agent-xxx") */
  app: string;
  /** Expiration time (unix timestamp) */
  exp: number;
  /** Issued at (unix timestamp) */
  iat: number;
}

/** Union type for all supported JWT payloads */
export type JwtPayload = LogtoJwtPayload | DelegationJwtPayload;

/** Hono context variables set by auth middleware */
export interface AuthVariables {
  userId: string;
}
