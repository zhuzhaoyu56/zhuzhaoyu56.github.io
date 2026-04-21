(function () {
  const PVSim = {
    version: "1.0.0",
    bus: null,
    logEnabled: true,
  };

  PVSim.bus = {
    _listeners: {},
    on(event, handler) {
      if (!this._listeners[event]) {
        this._listeners[event] = [];
      }
      this._listeners[event].push(handler);
      return () => this.off(event, handler);
    },
    off(event, handler) {
      if (!this._listeners[event]) return;
      this._listeners[event] = this._listeners[event].filter((h) => h !== handler);
    },
    emit(event, payload) {
      if (!this._listeners[event]) return;
      this._listeners[event].forEach((handler) => {
        try {
          handler(payload);
        } catch (err) {
          if (PVSim.logEnabled) {
            console.error("PVSim bus error", event, err);
          }
        }
      });
    },
  };

  PVSim.logger = {
    info(...args) {
      if (!PVSim.logEnabled) return;
      console.log("[PVSim]", ...args);
    },
    warn(...args) {
      if (!PVSim.logEnabled) return;
      console.warn("[PVSim]", ...args);
    },
    error(...args) {
      if (!PVSim.logEnabled) return;
      console.error("[PVSim]", ...args);
    },
  };

  PVSim.cache = {
    _store: new Map(),
    get(key) {
      return this._store.get(key);
    },
    set(key, value) {
      this._store.set(key, value);
    },
    clear(prefix) {
      if (!prefix) {
        this._store.clear();
        return;
      }
      for (const key of this._store.keys()) {
        if (key.startsWith(prefix)) {
          this._store.delete(key);
        }
      }
    },
  };

  PVSim.uid = (() => {
    let counter = 0;
    return (prefix = "id") => {
      counter += 1;
      return `${prefix}-${counter}`;
    };
  })();

  PVSim.ready = (fn) => {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(fn, 0);
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  };

  window.PVSim = PVSim;
})();
