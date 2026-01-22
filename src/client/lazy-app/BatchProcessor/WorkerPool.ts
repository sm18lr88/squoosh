/**
 * WorkerPool manages a pool of WorkerBridge instances for parallel batch processing.
 */

import WorkerBridge from '../worker-bridge';

/** Maximum number of concurrent workers */
const MAX_WORKERS = 8;

/** Get the optimal number of workers based on hardware concurrency */
function getOptimalWorkerCount(): number {
  const concurrency = navigator.hardwareConcurrency || 4;
  return Math.min(concurrency, MAX_WORKERS);
}

export interface PooledWorker {
  bridge: WorkerBridge;
  busy: boolean;
  id: number;
}

export default class WorkerPool {
  private workers: PooledWorker[] = [];
  private pendingTasks: Array<{
    resolve: (worker: PooledWorker) => void;
    reject: (err: Error) => void;
  }> = [];
  private readonly maxWorkers: number;

  constructor(maxWorkers?: number) {
    this.maxWorkers = maxWorkers ?? getOptimalWorkerCount();
  }

  /**
   * Get the number of workers in the pool
   */
  get size(): number {
    return this.maxWorkers;
  }

  /**
   * Get the number of currently available (non-busy) workers
   */
  get availableCount(): number {
    return this.workers.filter((w) => !w.busy).length;
  }

  /**
   * Get the number of currently busy workers
   */
  get busyCount(): number {
    return this.workers.filter((w) => w.busy).length;
  }

  /**
   * Acquire a worker from the pool.
   * If no workers are available, creates a new one up to the max limit.
   * If at max capacity, waits for a worker to become available.
   */
  async acquire(): Promise<PooledWorker> {
    // First, try to find an available worker
    const availableWorker = this.workers.find((w) => !w.busy);
    if (availableWorker) {
      availableWorker.busy = true;
      return availableWorker;
    }

    // If we haven't reached the max, create a new worker
    if (this.workers.length < this.maxWorkers) {
      const worker: PooledWorker = {
        bridge: new WorkerBridge(),
        busy: true,
        id: this.workers.length,
      };
      this.workers.push(worker);
      return worker;
    }

    // Otherwise, wait for a worker to become available
    return new Promise((resolve, reject) => {
      this.pendingTasks.push({ resolve, reject });
    });
  }

  /**
   * Release a worker back to the pool.
   * If there are pending tasks waiting for a worker, assign this worker to the next task.
   */
  release(worker: PooledWorker): void {
    worker.busy = false;

    // If there are pending tasks, assign this worker to the next one
    const nextTask = this.pendingTasks.shift();
    if (nextTask) {
      worker.busy = true;
      nextTask.resolve(worker);
    }
  }

  /**
   * Execute a task using a worker from the pool.
   * Automatically acquires and releases the worker.
   */
  async execute<T>(
    task: (bridge: WorkerBridge, workerId: number) => Promise<T>,
  ): Promise<T> {
    const worker = await this.acquire();
    try {
      return await task(worker.bridge, worker.id);
    } finally {
      this.release(worker);
    }
  }

  /**
   * Terminate all workers and clear the pool.
   */
  dispose(): void {
    // Reject any pending tasks
    for (const task of this.pendingTasks) {
      task.reject(new Error('Worker pool disposed'));
    }
    this.pendingTasks = [];
    this.workers = [];
  }
}
