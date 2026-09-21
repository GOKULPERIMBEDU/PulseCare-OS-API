import { env } from '../config/env';

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

export function corsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean | string) => void,
): void {
  if (!origin) {
    callback(null, true);
    return;
  }

  const allowed = env.clientOrigin
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (allowed.includes(origin) || (env.nodeEnv !== 'production' && LOCAL_DEV_ORIGIN.test(origin))) {
    callback(null, origin);
    return;
  }

  callback(null, false);
}
