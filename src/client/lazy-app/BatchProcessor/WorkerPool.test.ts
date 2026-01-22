/**
 * Tests for WorkerPool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WorkerPool, { PooledWorker } from './WorkerPool';

// Mock WorkerBridge class since it depends on web workers
// The class must be defined inside the factory to avoid hoisting issues
vi.mock('../worker-bridge', () => {
  return {
    default: class MockWorkerBridge {
      _worker: undefined = undefined;
      _workerApi: undefined = undefined;
      _queue: Promise<unknown> = Promise.resolve();
    },
  };
});

// Store original navigator.hardwareConcurrency
const originalHardwareConcurrency = globalThis.navigator?.hardwareConcurrency;

describe('WorkerPool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset navigator.hardwareConcurrency mock
    Object.defineProperty(globalThis, 'navigator', {
      value: { hardwareConcurrency: 4 },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original value if it existed
    if (originalHardwareConcurrency !== undefined) {
      Object.defineProperty(globalThis, 'navigator', {
        value: { hardwareConcurrency: originalHardwareConcurrency },
        writable: true,
        configurable: true,
      });
    }
  });

  describe('constructor', () => {
    it('should create pool with specified maxWorkers', () => {
      const pool = new WorkerPool(2);
      expect(pool.size).toBe(2);
    });

    it('should create pool with default worker count based on hardware concurrency', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { hardwareConcurrency: 6 },
        writable: true,
        configurable: true,
      });
      const pool = new WorkerPool();
      expect(pool.size).toBe(6);
    });

    it('should cap workers at MAX_WORKERS (8) even with high hardware concurrency', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { hardwareConcurrency: 16 },
        writable: true,
        configurable: true,
      });
      const pool = new WorkerPool();
      expect(pool.size).toBe(8);
    });

    it('should default to 4 workers when hardware concurrency is undefined', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { hardwareConcurrency: undefined },
        writable: true,
        configurable: true,
      });
      const pool = new WorkerPool();
      expect(pool.size).toBe(4);
    });

    it('should default to 4 workers when hardware concurrency is 0', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { hardwareConcurrency: 0 },
        writable: true,
        configurable: true,
      });
      const pool = new WorkerPool();
      expect(pool.size).toBe(4);
    });
  });

  describe('size', () => {
    it('should return maxWorkers value', () => {
      const pool = new WorkerPool(3);
      expect(pool.size).toBe(3);
    });
  });

  describe('availableCount', () => {
    it('should return 0 when no workers have been created', () => {
      const pool = new WorkerPool(4);
      expect(pool.availableCount).toBe(0);
    });

    it('should return count of non-busy workers', async () => {
      const pool = new WorkerPool(4);

      // Acquire two workers
      const worker1 = await pool.acquire();
      await pool.acquire();

      // Both are busy
      expect(pool.availableCount).toBe(0);

      // Release one
      pool.release(worker1);
      expect(pool.availableCount).toBe(1);
    });
  });

  describe('busyCount', () => {
    it('should return 0 when no workers have been created', () => {
      const pool = new WorkerPool(4);
      expect(pool.busyCount).toBe(0);
    });

    it('should return count of busy workers', async () => {
      const pool = new WorkerPool(4);

      await pool.acquire();
      expect(pool.busyCount).toBe(1);

      await pool.acquire();
      expect(pool.busyCount).toBe(2);
    });

    it('should decrease when workers are released', async () => {
      const pool = new WorkerPool(4);

      const worker1 = await pool.acquire();
      const worker2 = await pool.acquire();
      expect(pool.busyCount).toBe(2);

      pool.release(worker1);
      expect(pool.busyCount).toBe(1);

      pool.release(worker2);
      expect(pool.busyCount).toBe(0);
    });
  });

  describe('acquire', () => {
    it('should create a new worker on first acquire', async () => {
      const pool = new WorkerPool(4);

      const worker = await pool.acquire();

      expect(worker).toBeDefined();
      expect(worker.id).toBe(0);
      expect(worker.busy).toBe(true);
      expect(worker.bridge).toBeDefined();
    });

    it('should create new workers up to maxWorkers', async () => {
      const pool = new WorkerPool(3);

      const worker1 = await pool.acquire();
      const worker2 = await pool.acquire();
      const worker3 = await pool.acquire();

      expect(worker1.id).toBe(0);
      expect(worker2.id).toBe(1);
      expect(worker3.id).toBe(2);
    });

    it('should reuse available workers', async () => {
      const pool = new WorkerPool(2);

      const worker1 = await pool.acquire();
      pool.release(worker1);

      const worker2 = await pool.acquire();
      expect(worker2.id).toBe(worker1.id);
      expect(worker2).toBe(worker1);
    });

    it('should queue requests when all workers are busy', async () => {
      const pool = new WorkerPool(2);

      // Acquire all workers
      const worker1 = await pool.acquire();
      await pool.acquire();

      // This should be queued
      let queuedResolved = false;
      const queuedPromise = pool.acquire().then((w) => {
        queuedResolved = true;
        return w;
      });

      // Should not resolve immediately
      await Promise.resolve(); // Let microtasks run
      expect(queuedResolved).toBe(false);

      // Release a worker
      pool.release(worker1);

      // Now the queued request should resolve
      const worker3 = await queuedPromise;
      expect(queuedResolved).toBe(true);
      expect(worker3.id).toBe(worker1.id);
    });

    it('should process queued requests in FIFO order', async () => {
      const pool = new WorkerPool(1);

      // Acquire the only worker
      const worker1 = await pool.acquire();

      // Queue multiple requests
      const order: number[] = [];
      const promise1 = pool.acquire().then((w) => {
        order.push(1);
        return w;
      });
      const promise2 = pool.acquire().then((w) => {
        order.push(2);
        return w;
      });
      const promise3 = pool.acquire().then((w) => {
        order.push(3);
        return w;
      });

      // Release and re-acquire to process queue
      pool.release(worker1);
      const w1 = await promise1;

      pool.release(w1);
      const w2 = await promise2;

      pool.release(w2);
      await promise3;

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('release', () => {
    it('should mark worker as not busy', async () => {
      const pool = new WorkerPool(2);

      const worker = await pool.acquire();
      expect(worker.busy).toBe(true);

      pool.release(worker);
      expect(worker.busy).toBe(false);
    });

    it('should assign worker to pending task if queue is not empty', async () => {
      const pool = new WorkerPool(1);

      const worker1 = await pool.acquire();
      const pendingPromise = pool.acquire();

      // Release should assign to pending task
      pool.release(worker1);

      const worker2 = await pendingPromise;
      expect(worker2).toBe(worker1);
      expect(worker2.busy).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute task and return result', async () => {
      const pool = new WorkerPool(2);

      const result = await pool.execute(async (bridge, workerId) => {
        return `processed by worker ${workerId}`;
      });

      expect(result).toBe('processed by worker 0');
    });

    it('should automatically release worker after task completes', async () => {
      const pool = new WorkerPool(2);

      await pool.execute(async () => 'done');

      expect(pool.busyCount).toBe(0);
      expect(pool.availableCount).toBe(1);
    });

    it('should release worker even if task throws', async () => {
      const pool = new WorkerPool(2);

      await expect(
        pool.execute(async () => {
          throw new Error('Task failed');
        }),
      ).rejects.toThrow('Task failed');

      expect(pool.busyCount).toBe(0);
      expect(pool.availableCount).toBe(1);
    });

    it('should provide bridge and workerId to task', async () => {
      const pool = new WorkerPool(2);

      let receivedBridge: unknown;
      let receivedWorkerId: number | undefined;

      await pool.execute(async (bridge, workerId) => {
        receivedBridge = bridge;
        receivedWorkerId = workerId;
      });

      expect(receivedBridge).toBeDefined();
      expect(receivedWorkerId).toBe(0);
    });

    it('should execute multiple tasks in parallel', async () => {
      const pool = new WorkerPool(4);

      const results = await Promise.all([
        pool.execute(async (_, id) => `task1:${id}`),
        pool.execute(async (_, id) => `task2:${id}`),
        pool.execute(async (_, id) => `task3:${id}`),
      ]);

      // All tasks should run on different workers
      const ids = results.map((r) => r.split(':')[1]);
      expect(new Set(ids).size).toBe(3);
    });

    it('should queue tasks when pool is at capacity', async () => {
      const pool = new WorkerPool(2);

      const executionOrder: number[] = [];
      const task = (id: number, delay: number) =>
        pool.execute(
          () =>
            new Promise<void>((resolve) => {
              setTimeout(() => {
                executionOrder.push(id);
                resolve();
              }, delay);
            }),
        );

      // Start 4 tasks with pool of 2
      await Promise.all([
        task(1, 10),
        task(2, 10),
        task(3, 10),
        task(4, 10),
      ]);

      // All tasks should complete
      expect(executionOrder).toHaveLength(4);
    });
  });

  describe('dispose', () => {
    it('should reject pending tasks with error', async () => {
      const pool = new WorkerPool(1);

      // Acquire the only worker
      await pool.acquire();

      // Queue a task
      const pendingPromise = pool.acquire();

      // Dispose the pool
      pool.dispose();

      // Pending task should be rejected
      await expect(pendingPromise).rejects.toThrow('Worker pool disposed');
    });

    it('should reject multiple pending tasks', async () => {
      const pool = new WorkerPool(1);

      await pool.acquire();

      const pending1 = pool.acquire();
      const pending2 = pool.acquire();
      const pending3 = pool.acquire();

      pool.dispose();

      await expect(pending1).rejects.toThrow('Worker pool disposed');
      await expect(pending2).rejects.toThrow('Worker pool disposed');
      await expect(pending3).rejects.toThrow('Worker pool disposed');
    });

    it('should clear workers array', async () => {
      const pool = new WorkerPool(2);

      await pool.acquire();
      await pool.acquire();

      expect(pool.busyCount).toBe(2);

      pool.dispose();

      expect(pool.busyCount).toBe(0);
      expect(pool.availableCount).toBe(0);
    });

    it('should allow creating new workers after dispose', async () => {
      const pool = new WorkerPool(2);

      await pool.acquire();
      pool.dispose();

      // Should be able to acquire new workers
      const worker = await pool.acquire();
      expect(worker).toBeDefined();
      expect(worker.id).toBe(0); // New worker with id 0
    });
  });

  describe('worker reuse', () => {
    it('should reuse workers instead of creating new ones', async () => {
      const pool = new WorkerPool(4);

      // Acquire and release multiple times
      const worker1 = await pool.acquire();
      pool.release(worker1);

      const worker2 = await pool.acquire();
      pool.release(worker2);

      const worker3 = await pool.acquire();
      pool.release(worker3);

      // All should be the same worker
      expect(worker1).toBe(worker2);
      expect(worker2).toBe(worker3);
    });

    it('should prefer reusing idle workers over creating new ones', async () => {
      const pool = new WorkerPool(4);

      // Acquire and release a worker
      const worker1 = await pool.acquire();
      const bridge1 = worker1.bridge;
      pool.release(worker1);

      // Acquire again - should reuse the same worker with the same bridge
      const worker2 = await pool.acquire();

      // Same worker and bridge instance should be reused
      expect(worker2).toBe(worker1);
      expect(worker2.bridge).toBe(bridge1);
    });
  });

  describe('concurrent operations', () => {
    it('should handle rapid acquire/release cycles', async () => {
      const pool = new WorkerPool(2);

      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          pool.execute(async () => {
            // Simulate some async work
            await new Promise((r) => setTimeout(r, 1));
            return i;
          }),
        );
      }

      const results = await Promise.all(operations);
      expect(results).toHaveLength(10);
      expect(results.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should maintain correct busy/available counts during concurrent operations', async () => {
      const pool = new WorkerPool(3);

      // Start tracking
      const snapshots: Array<{ busy: number; available: number }> = [];

      // Execute concurrent tasks
      const tasks = [1, 2, 3, 4, 5].map((_, i) =>
        pool.execute(async () => {
          snapshots.push({
            busy: pool.busyCount,
            available: pool.availableCount,
          });
          await new Promise((r) => setTimeout(r, 5 * i));
          return i;
        }),
      );

      await Promise.all(tasks);

      // After all tasks complete
      expect(pool.busyCount).toBe(0);
      // Should have 3 workers created (pool size is 3)
      expect(pool.availableCount).toBeLessThanOrEqual(3);
    });
  });

  describe('edge cases', () => {
    it('should handle pool size of 1', async () => {
      const pool = new WorkerPool(1);

      const results: number[] = [];
      await Promise.all([
        pool.execute(async () => {
          results.push(1);
        }),
        pool.execute(async () => {
          results.push(2);
        }),
        pool.execute(async () => {
          results.push(3);
        }),
      ]);

      expect(results).toHaveLength(3);
    });

    it('should handle immediate task completion', async () => {
      const pool = new WorkerPool(2);

      const result = await pool.execute(async () => 42);
      expect(result).toBe(42);
    });

    it('should handle undefined return from task', async () => {
      const pool = new WorkerPool(2);

      const result = await pool.execute(async () => undefined);
      expect(result).toBeUndefined();
    });

    it('should handle null return from task', async () => {
      const pool = new WorkerPool(2);

      const result = await pool.execute(async () => null);
      expect(result).toBeNull();
    });
  });
});
