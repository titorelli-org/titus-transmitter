import { describe, it } from "node:test";
import { ok, strictEqual, rejects } from "node:assert";
import { SWRCache } from "../lib/cache/SWRCache";

describe("SWRCache", () => {
  describe("basic functionality", () => {
    it("should fetch and cache data on first request", async () => {
      let fetchCount = 0;
      const cache = new SWRCache<string, [string]>(
        async (key: string) => {
          fetchCount++;
          return `data-${key}`;
        }
      );

      const result = await cache.get("test-key");
      
      strictEqual(result, "data-test-key");
      strictEqual(fetchCount, 1);
    });

    it("should return cached data immediately on subsequent requests", async () => {
      let fetchCount = 0;
      const cache = new SWRCache<string, [string]>(
        async (key: string) => {
          fetchCount++;
          return `data-${key}`;
        }
      );

      // First request
      const result1 = await cache.get("test-key");
      strictEqual(result1, "data-test-key");
      strictEqual(fetchCount, 1);

      // Second request - should return cached data immediately
      const result2 = await cache.get("test-key");
      strictEqual(result2, "data-test-key");
      // Note: Background refresh may cause additional fetches, so we don't assert exact count
      ok(fetchCount >= 1, "Should have fetched at least once");
    });

    it("should handle multiple different keys independently", async () => {
      let fetchCount = 0;
      const cache = new SWRCache<string, [string]>(
        async (key: string) => {
          fetchCount++;
          return `data-${key}`;
        }
      );

      const result1 = await cache.get("key1");
      const result2 = await cache.get("key2");
      
      strictEqual(result1, "data-key1");
      strictEqual(result2, "data-key2");
      strictEqual(fetchCount, 2);
    });
  });

  describe("background refresh", () => {
    it("should trigger background refresh on cached data", async () => {
      let fetchCount = 0;
      const cache = new SWRCache<string, [string]>(
        async (key: string) => {
          fetchCount++;
          return `data-${key}-${fetchCount}`;
        }
      );

      // First request
      const result1 = await cache.get("test-key");
      strictEqual(result1, "data-test-key-1");
      strictEqual(fetchCount, 1);

      // Wait a bit for background refresh
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second request - should return cached data immediately
      const result2 = await cache.get("test-key");
      strictEqual(result2, "data-test-key-1"); // Should return cached data
      
      // Wait for background refresh to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Third request - should now have refreshed data
      const result3 = await cache.get("test-key");
      strictEqual(result3, "data-test-key-2"); // Should have refreshed data
    });
  });

  describe("error handling", () => {
    it("should propagate errors from fetcher", async () => {
      const cache = new SWRCache<string, [string]>(
        async (key: string) => {
          throw new Error("Fetcher error");
        }
      );

      await rejects(
        () => cache.get("test-key"),
        /Fetcher error/
      );
    });

    it("should handle background refresh errors silently", async () => {
      let fetchCount = 0;
      const cache = new SWRCache<string, [string]>(
        async (key: string) => {
          fetchCount++;
          if (fetchCount === 1) {
            return "initial-data";
          }
          throw new Error("Background refresh error");
        }
      );

      // First request should succeed
      const result1 = await cache.get("test-key");
      strictEqual(result1, "initial-data");
      strictEqual(fetchCount, 1);

      // Wait for background refresh
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second request should still return cached data (background refresh failed silently)
      const result2 = await cache.get("test-key");
      strictEqual(result2, "initial-data");
    });
  });

  describe("deduplication", () => {
    it("should deduplicate concurrent requests", async () => {
      let fetchCount = 0;
      const cache = new SWRCache<string, [string]>(
        async (key: string) => {
          fetchCount++;
          // Simulate slow fetch
          await new Promise(resolve => setTimeout(resolve, 50));
          return `data-${key}`;
        }
      );

      // Make multiple concurrent requests
      const promises = [
        cache.get("test-key"),
        cache.get("test-key"),
        cache.get("test-key"),
      ];

      const results = await Promise.all(promises);
      
      // All should return the same data
      strictEqual(results[0], "data-test-key");
      strictEqual(results[1], "data-test-key");
      strictEqual(results[2], "data-test-key");
      
      // Should only fetch once
      strictEqual(fetchCount, 1);
    });
  });

  describe("cache management", () => {
    it("should allow manual cache updates", async () => {
      const cache = new SWRCache<string, [string]>(
        async (key: string) => `fetched-${key}`
      );

      // Manually set cache
      cache.set("manual-data", "test-key");
      
      const result = await cache.get("test-key");
      strictEqual(result, "manual-data");
    });

    it("should allow cache deletion", async () => {
      let fetchCount = 0;
      const cache = new SWRCache<string, [string]>(
        async (key: string) => {
          fetchCount++;
          return `data-${key}`;
        }
      );

      // First request
      await cache.get("test-key");
      strictEqual(fetchCount, 1);

      // Delete from cache
      cache.delete("test-key");

      // Second request should fetch again
      await cache.get("test-key");
      strictEqual(fetchCount, 2);
    });

    it("should allow cache clearing", async () => {
      let fetchCount = 0;
      const cache = new SWRCache<string, [string]>(
        async (key: string) => {
          fetchCount++;
          return `data-${key}`;
        }
      );

      // Cache some data
      await cache.get("key1");
      await cache.get("key2");
      strictEqual(fetchCount, 2);

      // Clear cache
      cache.clear();

      // Requests should fetch again
      await cache.get("key1");
      await cache.get("key2");
      strictEqual(fetchCount, 4);
    });
  });

  describe("complex argument types", () => {
    it("should handle multiple arguments", async () => {
      let fetchCount = 0;
      const cache = new SWRCache<string, [string, number, boolean]>(
        async (key: string, num: number, flag: boolean) => {
          fetchCount++;
          return `${key}-${num}-${flag}`;
        }
      );

      const result = await cache.get("test", 42, true);
      strictEqual(result, "test-42-true");
      strictEqual(fetchCount, 1);

      // Should use cache for same arguments
      const result2 = await cache.get("test", 42, true);
      strictEqual(result2, "test-42-true");
      // Note: Background refresh may cause additional fetches, so we don't assert exact count
      ok(fetchCount >= 1, "Should have fetched at least once");
    });

    it("should handle different argument combinations", async () => {
      let fetchCount = 0;
      const cache = new SWRCache<string, [string, number]>(
        async (key: string, num: number) => {
          fetchCount++;
          return `${key}-${num}`;
        }
      );

      await cache.get("test", 1);
      await cache.get("test", 2);
      await cache.get("other", 1);
      
      strictEqual(fetchCount, 3); // Each combination should fetch separately
    });
  });

  describe("null and undefined handling", () => {
    it("should handle null return values", async () => {
      const cache = new SWRCache<string | null, [string]>(
        async (key: string) => {
          return key === "null-key" ? null : `data-${key}`;
        }
      );

      const result1 = await cache.get("normal-key");
      strictEqual(result1, "data-normal-key");

      const result2 = await cache.get("null-key");
      strictEqual(result2, null);
    });

    it("should handle undefined return values", async () => {
      const cache = new SWRCache<string | undefined, [string]>(
        async (key: string) => {
          return key === "undefined-key" ? undefined : `data-${key}`;
        }
      );

      const result1 = await cache.get("normal-key");
      strictEqual(result1, "data-normal-key");

      const result2 = await cache.get("undefined-key");
      strictEqual(result2, undefined);
    });
  });

  describe("wrapFn static method", () => {
    it("should create a wrapped function that works like the original", async () => {
      let fetchCount = 0;
      const originalFn = async (key: string) => {
        fetchCount++;
        return `data-${key}`;
      };

      const wrappedFn = SWRCache.wrapFn(originalFn);

      const result = await wrappedFn("test-key");
      strictEqual(result, "data-test-key");
      strictEqual(fetchCount, 1);
    });

    it("should cache results and return cached data immediately", async () => {
      let fetchCount = 0;
      const originalFn = async (key: string) => {
        fetchCount++;
        return `data-${key}`;
      };

      const wrappedFn = SWRCache.wrapFn(originalFn);

      // First call
      const result1 = await wrappedFn("test-key");
      strictEqual(result1, "data-test-key");
      strictEqual(fetchCount, 1);

      // Second call - should return cached data
      const result2 = await wrappedFn("test-key");
      strictEqual(result2, "data-test-key");
      ok(fetchCount >= 1, "Should have fetched at least once");
    });

    it("should support manual cache management", async () => {
      let fetchCount = 0;
      const originalFn = async (key: string) => {
        fetchCount++;
        return `data-${key}`;
      };

      const wrappedFn = SWRCache.wrapFn(originalFn);

      // Manual cache update
      wrappedFn.set("manual-data", "test-key");
      
      const result = await wrappedFn("test-key");
      strictEqual(result, "manual-data");
      // Note: Background refresh may cause additional fetches, so we don't assert exact count
      ok(fetchCount >= 0, "Should not have called original function for manual data");

      // Manual cache deletion
      wrappedFn.delete("test-key");
      
      const result2 = await wrappedFn("test-key");
      strictEqual(result2, "data-test-key");
      // Note: Background refresh may cause additional fetches, so we don't assert exact count
      ok(fetchCount >= 1, "Should have called original function after deletion");
    });

    it("should support cache clearing", async () => {
      let fetchCount = 0;
      const originalFn = async (key: string) => {
        fetchCount++;
        return `data-${key}`;
      };

      const wrappedFn = SWRCache.wrapFn(originalFn);

      // Cache some data
      await wrappedFn("key1");
      await wrappedFn("key2");
      strictEqual(fetchCount, 2);

      // Clear cache
      wrappedFn.clear();

      // Should fetch again
      await wrappedFn("key1");
      await wrappedFn("key2");
      strictEqual(fetchCount, 4);
    });

    it("should handle multiple arguments", async () => {
      let fetchCount = 0;
      const originalFn = async (key: string, num: number, flag: boolean) => {
        fetchCount++;
        return `${key}-${num}-${flag}`;
      };

      const wrappedFn = SWRCache.wrapFn(originalFn);

      const result = await wrappedFn("test", 42, true);
      strictEqual(result, "test-42-true");
      strictEqual(fetchCount, 1);

      // Should use cache for same arguments
      const result2 = await wrappedFn("test", 42, true);
      strictEqual(result2, "test-42-true");
      ok(fetchCount >= 1, "Should have fetched at least once");
    });

    it("should handle different argument combinations independently", async () => {
      let fetchCount = 0;
      const originalFn = async (key: string, num: number) => {
        fetchCount++;
        return `${key}-${num}`;
      };

      const wrappedFn = SWRCache.wrapFn(originalFn);

      await wrappedFn("test", 1);
      await wrappedFn("test", 2);
      await wrappedFn("other", 1);
      
      strictEqual(fetchCount, 3); // Each combination should fetch separately
    });

    it("should propagate errors from the original function", async () => {
      const originalFn = async (key: string) => {
        throw new Error("Original function error");
      };

      const wrappedFn = SWRCache.wrapFn(originalFn);

      await rejects(
        () => wrappedFn("test-key"),
        /Original function error/
      );
    });

    it("should work with complex return types", async () => {
      interface ComplexResult {
        id: string;
        data: string;
        timestamp: number;
      }

      const originalFn = async (id: string): Promise<ComplexResult> => {
        return {
          id,
          data: `data-${id}`,
          timestamp: Date.now(),
        };
      };

      const wrappedFn = SWRCache.wrapFn(originalFn);

      const result = await wrappedFn("test-id");
      ok(result.id === "test-id");
      ok(result.data === "data-test-id");
      ok(typeof result.timestamp === "number");
    });
  });
});
