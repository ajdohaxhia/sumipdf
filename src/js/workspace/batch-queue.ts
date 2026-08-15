export type BatchStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled';

export interface BatchItem<T = unknown> {
  id: string;
  label: string;
  status: BatchStatus;
  error?: string;
  result?: T;
}

export interface BatchQueueOptions<I, O> {
  concurrency?: number;
  signal?: AbortSignal;
  process: (item: I, index: number, signal: AbortSignal) => Promise<O>;
  label: (item: I, index: number) => string;
  onUpdate?: (items: BatchItem<O>[]) => void;
}

export async function runBatchQueue<I, O>(
  inputs: I[],
  options: BatchQueueOptions<I, O>
): Promise<BatchItem<O>[]> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 4));
  const items: BatchItem<O>[] = inputs.map((item, index) => ({
    id: `batch-${index}`,
    label: options.label(item, index),
    status: 'pending',
  }));
  options.onUpdate?.([...items]);

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, async () => {
    while (cursor < inputs.length) {
      const index = cursor++;
      if (options.signal?.aborted) {
        items[index].status = 'cancelled';
        options.onUpdate?.([...items]);
        continue;
      }
      items[index].status = 'running';
      options.onUpdate?.([...items]);
      try {
        const result = await options.process(inputs[index], index, options.signal ?? new AbortController().signal);
        items[index].status = 'success';
        items[index].result = result;
      } catch (error) {
        if (options.signal?.aborted) {
          items[index].status = 'cancelled';
        } else {
          items[index].status = 'error';
          items[index].error =
            error instanceof Error ? error.message : String(error);
        }
      }
      options.onUpdate?.([...items]);
    }
  });

  await Promise.all(workers);
  return items;
}
