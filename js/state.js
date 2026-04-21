(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  const defaults = {
    location: {
      lat: 31.2,
      lon: 121.5,
      elevation: 12,
      tz: 8,
      albedo: 0.2,
    },
    system: {
      sizeKw: 120,
      dcAcRatio: 1.15,
      moduleEfficiency: 0.2,
      tempCoeff: -0.36,
      tilt: 25,
      azimuth: 180,
    },
    losses: {
      soiling: 2.5,
      wiring: 2.0,
      mismatch: 1.5,
      shading: 1.0,
      degradation: 0.4,
    },
    weather: {
      mode: "synthetic",
      cloudiness: 0.32,
      humidity: 0.55,
      aod: 0.12,
      avgTemp: 22,
      wind: 3.2,
    },
    load: {
      profile: "commercial",
      baseKw: 80,
      peakFactor: 2.2,
      demandResponse: "moderate",
    },
    storage: {
      enabled: true,
      capacityKwh: 200,
      chargeKw: 80,
      dischargeKw: 80,
      efficiency: 0.9,
      minSoc: 0.1,
      reserveSoc: 0.2,
    },
    grid: {
      exportLimit: 200,
      buyRate: 0.16,
      sellRate: 0.08,
      netMetering: true,
      demandCharge: 9,
    },
    economics: {
      capexPerW: 0.85,
      opexPerKw: 18,
      batteryPerKwh: 260,
      discountRate: 0.07,
      projectLife: 25,
    },
    simulation: {
      resolutionMinutes: 15,
      year: 2026,
      day: 185,
    },
  };

  const state = {
    current: utils.deepClone(defaults),
    defaults: utils.deepClone(defaults),
    scenarios: [],
    activeScenarioId: null,
    results: null,
    weatherSeries: null,
    loadSeries: null,
  };

  function set(path, value, silent = false) {
    utils.setPath(state.current, path, value);
    if (!silent) {
      PVSim.bus.emit("state:change", { path, value });
    }
  }

  function get(path) {
    return utils.getPath(state.current, path);
  }

  function reset() {
    state.current = utils.deepClone(state.defaults);
    state.weatherSeries = null;
    state.loadSeries = null;
    PVSim.bus.emit("state:reset", utils.deepClone(state.current));
  }

  function loadScenario(scenario) {
    state.current = utils.merge(utils.deepClone(state.defaults), scenario.config);
    state.activeScenarioId = scenario.id;
    PVSim.bus.emit("state:scenario", scenario);
    PVSim.bus.emit("state:reset", utils.deepClone(state.current));
  }

  function updateResults(results) {
    state.results = results;
    PVSim.bus.emit("results:update", results);
  }

  function updateWeatherSeries(series) {
    state.weatherSeries = series;
    PVSim.bus.emit("weather:update", series);
  }

  function updateLoadSeries(series) {
    state.loadSeries = series;
    PVSim.bus.emit("load:update", series);
  }

  PVSim.state = {
    get,
    set,
    reset,
    loadScenario,
    updateResults,
    updateWeatherSeries,
    updateLoadSeries,
    getSnapshot() {
      return utils.deepClone(state.current);
    },
    getDefaults() {
      return utils.deepClone(state.defaults);
    },
    getScenarios() {
      return state.scenarios;
    },
    setScenarios(list) {
      state.scenarios = list;
      PVSim.bus.emit("scenarios:update", list);
    },
    getActiveScenarioId() {
      return state.activeScenarioId;
    },
    getResults() {
      return state.results;
    },
    setWeatherSeries(series) {
      updateWeatherSeries(series);
    },
    setLoadSeries(series) {
      updateLoadSeries(series);
    },
    getWeatherSeries() {
      return state.weatherSeries;
    },
    getLoadSeries() {
      return state.loadSeries;
    },
  };
})();
