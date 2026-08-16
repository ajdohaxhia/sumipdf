import { afterEach, vi } from 'vitest';

class TestDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
}

if (typeof globalThis.Worker === 'undefined') {
  globalThis.Worker = class {
    postMessage(): void {}
    terminate(): void {}
    addEventListener(): void {}
    removeEventListener(): void {}
  } as unknown as typeof Worker;
}

if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = TestDOMMatrix as unknown as typeof DOMMatrix;
}

afterEach(() => {
  if (typeof document !== 'undefined' && document.body) {
    document.body.innerHTML = '';
  }
  if (typeof document !== 'undefined' && document.head) {
    document.head.innerHTML = '';
  }
});

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

if (typeof globalThis.window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

if (
  typeof globalThis.localStorage === 'undefined' ||
  !globalThis.localStorage
) {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

if (
  typeof globalThis.sessionStorage === 'undefined' ||
  !globalThis.sessionStorage
) {
  const store = new Map<string, string>();
  globalThis.sessionStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}
