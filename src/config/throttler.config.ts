import { config as dotenvConfig } from 'dotenv';

// Load .env explicitly so these constants are correct regardless of import order.
dotenvConfig();

// General API: 10 requests per minute.
// Override via THROTTLE_LIMIT / THROTTLE_TTL environment variables.
export const THROTTLE_DEFAULT_LIMIT = parseInt(process.env.THROTTLE_LIMIT ?? '10', 10);
export const THROTTLE_DEFAULT_TTL = parseInt(process.env.THROTTLE_TTL ?? '60000', 10);

// Auth endpoints (login / register): 5 requests per 15 minutes.
// Stricter window to limit brute-force and account-enumeration attempts.
// Override via THROTTLE_AUTH_LIMIT / THROTTLE_AUTH_TTL (e.g. set to 10000 in tests).
//
// NOTE: This throttler uses in-memory storage (per-instance). For multi-instance
// deployments (Kubernetes, ECS, etc.) replace ThrottlerGuard with a Redis-backed
// guard (e.g. @nest-lab/throttler-storage-redis) so limits are enforced globally.
export const THROTTLE_AUTH_LIMIT = parseInt(
  process.env.THROTTLE_AUTH_LIMIT ?? '5',
  10,
);
export const THROTTLE_AUTH_TTL = parseInt(
  process.env.THROTTLE_AUTH_TTL ?? '900000',
  10,
);
