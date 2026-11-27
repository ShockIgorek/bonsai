export function installMemoryStorage(seed = {}) {
  const store = new Map();

  for (const [key, value] of Object.entries(seed)) {
    store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    clear: () => store.clear(),
    key: index => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    }
  };

  return {
    storage: globalThis.localStorage,
    dump: () => Object.fromEntries(store),
    clear: () => store.clear()
  };
}

export function installWindow() {
  const events = [];

  if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    };
  }

  globalThis.window = {
    dispatchEvent: event => {
      events.push(event);
      return true;
    }
  };

  return events;
}

export function setNow(value) {
  const original = Date.now;
  let now = value;

  Date.now = () => now;

  return {
    advance(ms) {
      now += ms;
    },
    get now() {
      return now;
    },
    restore() {
      Date.now = original;
    }
  };
}
