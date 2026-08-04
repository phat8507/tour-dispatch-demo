import { Pool } from "pg";
import { PostgresDispatchAssignmentGateway } from "@/data/postgres-dispatch-assignment-gateway";
import { readOwnerConfig } from "./owner-auth";
import { PostgresOwnerDispatchReadModel } from "./owner-dispatch-read-model";

export function createDispatchServerDependencies(environment: NodeJS.ProcessEnv = process.env) {
  if (!environment.DATABASE_URL) throw new Error("DATABASE_URL is required for production dispatch.");
  const pool = new Pool({ connectionString: environment.DATABASE_URL });
  return { owner: readOwnerConfig(environment), gateway: new PostgresDispatchAssignmentGateway(pool), readModel: new PostgresOwnerDispatchReadModel(pool) };
}
