/**
 * 并发限制器和错误重试机制
 */

const CONFIG = {
  maxConcurrentDownloads: 3,
  maxRetries: 3,
  retryDelayBase: 1000,
  retryDelayMax: 10000,
}

class ConcurrencyLimiter {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.currentConcurrent = 0;
    this.queue = [];
  }

  async execute(fn) {
    if (this.currentConcurrent >= this.maxConcurrent) {
      return new Promise((resolve, reject) => {
        this.queue.push({ fn, resolve, reject });
      });
    }

    this.currentConcurrent++;
    try {
      const result = await fn();
      this.currentConcurrent--;
      this.processNext();
      return result;
    } catch (error) {
      this.currentConcurrent--;
      this.processNext();
      throw error;
    }
  }

  processNext() {
    if (this.queue.length > 0 && this.currentConcurrent < this.maxConcurrent) {
      const { fn, resolve, reject } = this.queue.shift();
      this.currentConcurrent++;
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.currentConcurrent--;
          this.processNext();
        });
    }
  }

  getStatus() {
    return {
      current: this.currentConcurrent,
      queued: this.queue.length,
      max: this.maxConcurrent
    };
  }
}

const downloadLimiter = new ConcurrencyLimiter(CONFIG.maxConcurrentDownloads);

async function executeWithRetry(fn, context = {}) {
  const { maxRetries = CONFIG.maxRetries, retryDelayBase = CONFIG.retryDelayBase } = context;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries) {
        throw new Error(`Max retries (${maxRetries}) exceeded. Last error: ${error.message}`);
      }
      const delay = Math.min(retryDelayBase * (2 ** attempt), CONFIG.retryDelayMax);
      console.log(`[retry] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function downloadWithLimit(fn) {
  return downloadLimiter.execute(fn);
}

function getLimiterStatus() {
  return downloadLimiter.getStatus();
}

module.exports = {
  ConcurrencyLimiter,
  executeWithRetry,
  downloadWithLimit,
  getLimiterStatus,
  CONFIG
};
