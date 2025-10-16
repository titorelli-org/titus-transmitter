import type { Logger } from "pino";

type CacheEntry<T> = {
  data: T;
  promise?: Promise<T>;
  refreshing?: boolean;
};

export interface SWRCache<T, A extends unknown[]> {
  new (fetcher: (...args: A) => Promise<T>): SWRCache<T, A>;
  get(...args: A): Promise<T>;
  set(data: T, ...args: A): void;
  delete(...args: A): void;
  clear(): void;
}

export interface WrappedFunction<T, A extends unknown[]> {
  (...args: A): Promise<T>;
  set(data: T, ...args: A): void;
  delete(...args: A): void;
  clear(): void;
}

export class SWRCache<T, A extends unknown[]> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly fetcher: (...args: A) => Promise<T>;
  private readonly logger?: Logger;

  constructor(fetcher: (...args: A) => Promise<T>, logger?: Logger) {
    this.fetcher = fetcher;
    this.logger = logger;
  }

  public static wrapFn<T, A extends unknown[]>(
    fetcher: (...args: A) => Promise<T>,
    logger?: Logger,
  ): WrappedFunction<T, A> {
    const cache = new SWRCache<T, A>(fetcher, logger);

    const wrappedFn = (...args: A): Promise<T> => {
      return cache.get(...args);
    };

    // Attach cache methods to the wrapped function
    wrappedFn.set = (data: T, ...args: A) => cache.set(data, ...args);
    wrappedFn.delete = (...args: A) => cache.delete(...args);
    wrappedFn.clear = () => cache.clear();

    return wrappedFn;
  }

  public async get(...args: A): Promise<T> {
    const key = this.createKey(args);
    const cached = this.cache.get(key);

    // If we have cached data, return it immediately and refresh in background
    if (cached && cached.data !== null) {
      // Trigger background refresh
      this.refreshInBackground(args);
      return cached.data;
    }

    // No cache, perform request and cache result
    return this.fetchAndCache(args);
  }

  public set(data: T, ...args: A): void {
    const key = this.createKey(args);
    this.cache.set(key, { data });
  }

  public delete(...args: A): void {
    const key = this.createKey(args);
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  private async fetchAndCache(args: A): Promise<T> {
    const key = this.createKey(args);

    // Check if there's already a pending request
    const cached = this.cache.get(key);
    if (cached?.promise) {
      return cached.promise;
    }

    // Create new request
    const promise = this.fetcher(...args);
    this.cache.set(key, { data: null as T, promise });

    try {
      const data = await promise;
      this.cache.set(key, { data });
      return data;
    } catch (error) {
      this.cache.delete(key);
      throw error;
    }
  }

  private async refreshInBackground(args: A): Promise<void> {
    const key = this.createKey(args);

    // Don't refresh if there's already a pending request or refresh
    const cached = this.cache.get(key);
    if (cached?.promise || cached?.refreshing) {
      return;
    }

    // Mark as refreshing to prevent multiple background refreshes
    this.cache.set(key, {
      data: cached?.data || (null as T),
      refreshing: true,
    });

    try {
      const data = await this.fetcher(...args);
      this.cache.set(key, { data });
    } catch (error) {
      // Silently fail background refresh, restore original data
      this.cache.set(key, { data: cached?.data || (null as T) });
      this.logger?.warn({ args, error }, "Background cache refresh failed");
    }
  }

  private createKey(args: A): string {
    return JSON.stringify(args);
  }
}
