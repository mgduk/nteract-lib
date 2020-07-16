class LocalStorage {
  constructor(storageKey) {
    this.storageKey = storageKey;
    this.data = {};
    const stored = window.localStorage[this.storageKey];
    if (stored != null) {
      try {
        this.data = JSON.parse(stored);
        if (typeof this.data !== 'object') {
          throw Error('Wrong type');
        }
      } catch (err) {
        this.data = {};
        this.persist();
      }
    }
  }

  persist() {
    window.localStorage[this.storageKey] = JSON.stringify(this.data);
  }

  get(key) {
    const data = this.data[key];
    return data != null ? JSON.parse(data) : data;
  }

  set(key, value) {
    this.data[key] = JSON.stringify(value);
    this.persist();
  }

  has(key) {
    return this.data[key] != null;
  }

  clear(key) {
    if (key == null) {
      this.data = {};
      this.persist();
      return;
    }
    this.set(key, undefined);
  }
}

export default LocalStorage;
