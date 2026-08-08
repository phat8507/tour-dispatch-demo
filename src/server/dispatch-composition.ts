import { Pool } from "pg";
import { PostgresDispatchAssignmentGateway } from "@/data/postgres-dispatch-assignment-gateway";
import { readOwnerConfig } from "./owner-auth";
import { PostgresOwnerDispatchReadModel } from "./owner-dispatch-read-model";
import { noProductionTravelTimeProvider } from "@/domain/production-travel-time-provider";
import type { ProductionTravelTimeProvider } from "@/domain/production-travel-time-provider";
import { PostgresOwnerLoginRateLimiter } from "./owner-login-rate-limiter";
import { TomTomTravelTimeProvider } from "./tomtom-travel-time-provider";

export function createDispatchServerDependencies(environment: NodeJS.ProcessEnv = process.env, overrides: Readonly<{ travelProvider?: ProductionTravelTimeProvider }> = {}) {
  if (!environment.DATABASE_URL) throw new Error("DATABASE_URL is required for production dispatch.");
  const pool = new Pool({ connectionString: environment.DATABASE_URL });
  const travelProvider = overrides.travelProvider ?? (environment.TOMTOM_API_KEY ? new TomTomTravelTimeProvider(environment.TOMTOM_API_KEY) : noProductionTravelTimeProvider);
  return { owner: readOwnerConfig(environment), gateway: new PostgresDispatchAssignmentGateway(pool), readModel: new PostgresOwnerDispatchReadModel(pool), loginRateLimiter: new PostgresOwnerLoginRateLimiter(pool), travelProvider };
}
