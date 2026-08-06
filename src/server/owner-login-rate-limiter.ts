import type { Pool } from "pg";
import { isIP } from "node:net";

export interface OwnerLoginRateLimiter {
  isLocked(ip: string): Promise<boolean>;
  recordFailure(ip: string): Promise<boolean>;
  reset(ip: string): Promise<void>;
}

export class PostgresOwnerLoginRateLimiter implements OwnerLoginRateLimiter {
  constructor(private readonly pool: Pool) {}

  async isLocked(ip: string): Promise<boolean> {
    return (await this.pool.query<{ owner_login_is_locked: boolean }>("select public.owner_login_is_locked($1::inet) as owner_login_is_locked", [ip])).rows[0].owner_login_is_locked;
  }

  async recordFailure(ip: string): Promise<boolean> {
    return (await this.pool.query<{ record_owner_login_failure: boolean }>("select public.record_owner_login_failure($1::inet) as record_owner_login_failure", [ip])).rows[0].record_owner_login_failure;
  }

  async reset(ip: string): Promise<void> {
    await this.pool.query("select public.reset_owner_login_failures($1::inet)", [ip]);
  }
}

export function ownerLoginIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("x-real-ip")?.trim();
  if (!candidate) return "0.0.0.0";
  if (isIP(candidate) !== 0) return candidate;
  return "0.0.0.0";
}
