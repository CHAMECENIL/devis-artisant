import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  host: string;
  port: number;
  password: string | undefined;
  url: string;
}

function parseRedisUrl(redisUrl: string): { host: string; port: number; password?: string } {
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
    };
  } catch {
    // Fallback to defaults if URL is malformed
    return { host: 'localhost', port: 6379, password: undefined };
  }
}

export default registerAs('redis', (): RedisConfig => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const parsed = parseRedisUrl(redisUrl);

  return {
    host: parsed.host,
    port: parsed.port,
    password: parsed.password,
    url: redisUrl,
  };
});
