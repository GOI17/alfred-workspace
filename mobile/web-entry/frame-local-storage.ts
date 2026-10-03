// Opaque browser frames have no persistent storage; UI preferences last for this generation only.
try {
  void window.localStorage.length
} catch {
  const values = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return values.size
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(String(key)) ?? null,
    setItem: (key, value) => {
      values.set(String(key), String(value))
    },
    removeItem: (key) => {
      values.delete(String(key))
    },
    clear: () => values.clear()
  }
  Object.defineProperty(window, 'localStorage', { value: storage })
}

export {}
