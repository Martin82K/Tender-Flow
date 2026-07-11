export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

export const withTimeout = async <T>(
  promise: PromiseLike<T>,
  ms: number,
  message?: string,
): Promise<T> => {
  let timeoutId: number | null = null;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(message || `Timeout after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  }
};

export const withRetry = async <T>(
  operation: () => Promise<T>,
  options?: { retries?: number; baseDelayMs?: number },
): Promise<T> => {
  const retries = options?.retries ?? 1;
  const baseDelayMs = options?.baseDelayMs ?? 300;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }

  throw lastError;
};
