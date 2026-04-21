(function () {
  const PVSim = window.PVSim;

  const utils = {
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },
    lerp(a, b, t) {
      return a + (b - a) * t;
    },
    map(value, inMin, inMax, outMin, outMax) {
      if (inMax === inMin) return outMin;
      const t = (value - inMin) / (inMax - inMin);
      return outMin + (outMax - outMin) * t;
    },
    round(value, decimals = 2) {
      const factor = Math.pow(10, decimals);
      return Math.round(value * factor) / factor;
    },
    sum(arr) {
      return arr.reduce((acc, val) => acc + val, 0);
    },
    mean(arr) {
      if (!arr.length) return 0;
      return utils.sum(arr) / arr.length;
    },
    median(arr) {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    },
    stddev(arr) {
      if (!arr.length) return 0;
      const m = utils.mean(arr);
      const variance = utils.mean(arr.map((v) => (v - m) * (v - m)));
      return Math.sqrt(variance);
    },
    movingAverage(arr, windowSize) {
      const result = [];
      for (let i = 0; i < arr.length; i += 1) {
        const start = Math.max(0, i - windowSize + 1);
        const slice = arr.slice(start, i + 1);
        result.push(utils.mean(slice));
      }
      return result;
    },
    normalize(arr) {
      const max = Math.max(...arr);
      const min = Math.min(...arr);
      return arr.map((v) => (max - min === 0 ? 0 : (v - min) / (max - min)));
    },
    formatNumber(value, decimals = 1) {
      return utils.round(value, decimals).toLocaleString();
    },
    formatCurrency(value, decimals = 0) {
      return `$${utils.round(value, decimals).toLocaleString()}`;
    },
    formatPercent(value, decimals = 1) {
      return `${utils.round(value * 100, decimals)}%`;
    },
    degToRad(deg) {
      return (deg * Math.PI) / 180;
    },
    radToDeg(rad) {
      return (rad * 180) / Math.PI;
    },
    dayOfYear(date) {
      const start = new Date(date.getFullYear(), 0, 0);
      const diff = date - start;
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    },
    dateFromDay(year, day) {
      const date = new Date(year, 0);
      date.setDate(day);
      return date;
    },
    toIsoDate(date) {
      return date.toISOString().slice(0, 10);
    },
    pad(num, size = 2) {
      let s = String(num);
      while (s.length < size) s = `0${s}`;
      return s;
    },
    hourLabel(hour) {
      const h = Math.floor(hour);
      const m = Math.round((hour - h) * 60);
      return `${utils.pad(h)}:${utils.pad(m)}`;
    },
    generateSeries(start, end, step) {
      const result = [];
      for (let v = start; v <= end; v += step) {
        result.push(v);
      }
      return result;
    },
    gaussian(x, mu, sigma) {
      const z = (x - mu) / sigma;
      return Math.exp(-0.5 * z * z);
    },
    triangleWave(x, period) {
      const p = period;
      const t = x % p;
      return t < p / 2 ? t / (p / 2) : 1 - (t - p / 2) / (p / 2);
    },
    seededRandom(seed) {
      let a = seed || 1;
      return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    interpolateSeries(xs, ys, x) {
      if (!xs.length || xs.length !== ys.length) return 0;
      if (x <= xs[0]) return ys[0];
      if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
      for (let i = 0; i < xs.length - 1; i += 1) {
        if (x >= xs[i] && x <= xs[i + 1]) {
          const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
          return utils.lerp(ys[i], ys[i + 1], t);
        }
      }
      return ys[ys.length - 1];
    },
    deepClone(obj) {
      return JSON.parse(JSON.stringify(obj));
    },
    getPath(obj, path) {
      return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
    },
    setPath(obj, path, value) {
      const keys = path.split(".");
      let target = obj;
      for (let i = 0; i < keys.length - 1; i += 1) {
        if (target[keys[i]] === undefined) {
          target[keys[i]] = {};
        }
        target = target[keys[i]];
      }
      target[keys[keys.length - 1]] = value;
    },
    merge(target, source) {
      const result = Array.isArray(target) ? [...target] : { ...target };
      Object.keys(source || {}).forEach((key) => {
        if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
          result[key] = utils.merge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      });
      return result;
    },
    flatten(obj, prefix = "") {
      const result = {};
      Object.keys(obj).forEach((key) => {
        const value = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === "object" && !Array.isArray(value)) {
          Object.assign(result, utils.flatten(value, path));
        } else {
          result[path] = value;
        }
      });
      return result;
    },
    range(n, mapFn) {
      const arr = [];
      for (let i = 0; i < n; i += 1) {
        arr.push(mapFn ? mapFn(i) : i);
      }
      return arr;
    },
  };

  PVSim.utils = utils;
})();
