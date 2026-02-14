/**
 * Redis Configuration
 * Provides Redis client for Bull queues and caching
 * Used by the export system for job queue management
 */

const Redis = require('redis');

let redisWarningShown = false;

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for Bull
  enableReadyCheck: false,    // Required for Bull
  retryStrategy(times) {
    if (times > 5) {
      if (!redisWarningShown) {
        console.warn('⚠️  Redis unavailable after 5 attempts — export queue will not function');
        console.warn('   Start Redis: docker run -d -p 6379:6379 redis:alpine');
        redisWarningShown = true;
      }
      // Return null to stop retrying (prevents log spam)
      return null;
    }
    const delay = Math.min(times * 500, 3000);
    console.log(`🔄 Redis reconnecting... attempt ${times} (delay: ${delay}ms)`);
    return delay;
  },
};

// Remove password if empty string
if (!redisConfig.password) {
  delete redisConfig.password;
}

let redisClient = null;

/**
 * Get or create the Redis client singleton
 */
function getRedisClient() {
  if (!redisClient) {
    let redisErrorLogged = false;
    let redisReconnectCount = 0;

    redisClient = Redis.createClient({
      url: `redis://${redisConfig.host}:${redisConfig.port}`,
      password: redisConfig.password,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy(retries) {
          redisReconnectCount = retries;
          if (retries > 5) {
            if (!redisErrorLogged) {
              console.warn('⚠️  Redis client: giving up after 5 reconnect attempts');
              redisErrorLogged = true;
            }
            // Return Error to stop reconnecting (not false, which can cause unhandled rejection)
            return new Error('Redis unavailable — stopped reconnecting');
          }
          const delay = Math.min(retries * 500, 3000);
          return delay;
        },
      },
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis client connected');
      redisErrorLogged = false;
      redisReconnectCount = 0;
    });

    redisClient.on('error', (err) => {
      // Only log the first ECONNREFUSED, suppress subsequent
      if (err.message.includes('ECONNREFUSED')) {
        if (!redisErrorLogged) {
          console.error('❌ Redis client error:', err.message);
        }
      } else if (!err.message.includes('stopped reconnecting')) {
        console.error('❌ Redis client error:', err.message);
      }
    });

    redisClient.on('reconnecting', () => {
      if (redisReconnectCount <= 5) {
        console.log('🔄 Redis client reconnecting...');
      }
    });
  }

  return redisClient;
}

/**
 * Close the Redis connection gracefully
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
      redisClient = null;
    } catch (err) {
      console.error('❌ Error closing Redis:', err.message);
      redisClient = null;
    }
  }
}

/**
 * Test Redis connectivity
 */
async function testRedisConnection() {
  try {
    const client = getRedisClient();
    
    // Add a one-time error handler to prevent unhandled rejection
    const errorPromise = new Promise((_, reject) => {
      const onError = (err) => {
        client.removeListener('error', onError);
        reject(err);
      };
      client.once('error', onError);
      // Clean up listener after 5 seconds if no error
      setTimeout(() => {
        client.removeListener('error', onError);
      }, 5000);
    });
    
    if (!client.isOpen) {
      // Race between connect and error
      await Promise.race([
        client.connect(),
        errorPromise,
      ]);
    }
    await client.ping();
    console.log('✅ Redis connection test passed');
    return true;
  } catch (err) {
    console.warn('⚠️  Redis not available:', err.message);
    return false;
  }
}

module.exports = {
  redisConfig,
  getRedisClient,
  closeRedis,
  testRedisConnection,
};
