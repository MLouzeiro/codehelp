import { env } from './env';

let redis: any = null;

try {
  const IORedis = require('ioredis');
  redis = new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: () => null,
    lazyConnect: true,
  });

  redis.on('error', () => {
    if (redis) {
      redis = null;
    }
  });

  redis.connect().then(() => {
    console.log('Redis connected');
  }).catch(() => {
    console.log('Redis not available — running without cache');
    redis = null;
  });
} catch {
  console.log('Redis not configured — running without cache');
}

export { redis };
