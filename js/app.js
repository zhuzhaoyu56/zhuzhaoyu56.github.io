(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  function runSimulation() {
    const config = PVSim.state.getSnapshot();
    const results = PVSim.sim.engine.simulate(config);
    const economics = PVSim.sim.economics.economicsSummary(config, results);
    results.economics = economics;

    PVSim.state.updateResults(results);

    PVSim.ui.charts.updateAll(results, config, economics);
    PVSim.ui.tables.updateLosses(results);
    PVSim.ui.tables.updateBalance(results);
    PVSim.ui.tables.updateEconomics(economics);
    PVSim.ui.dashboard.updateSummary(results, economics);
  }

  function addScenario() {
    const config = PVSim.state.getSnapshot();
    const results = PVSim.state.getResults();
    if (!results) return;
    const scenario = PVSim.sim.scenario.addScenario(config, results);
    PVSim.ui.dashboard.updateScenarioList(PVSim.state.getScenarios());
    PVSim.ui.tables.updateCompare(PVSim.state.getScenarios());
    return scenario;
  }

  function resetAll() {
    PVSim.state.reset();
    runSimulation();
  }

  function bindEvents() {
    PVSim.bus.on("action:run", runSimulation);
    PVSim.bus.on("action:add-scenario", addScenario);
    PVSim.bus.on("action:reset", resetAll);

    PVSim.bus.on("action:export-csv", () => {
      const results = PVSim.state.getResults();
      if (results) PVSim.io.export.exportCSV(results);
    });

    PVSim.bus.on("action:export-json", () => {
      const results = PVSim.state.getResults();
      if (results) PVSim.io.export.exportJSON(PVSim.state.getSnapshot(), results);
    });

    PVSim.bus.on("action:export-png", () => {
      PVSim.io.export.exportCharts();
    });

    PVSim.bus.on("ui:tab", () => {
      setTimeout(() => {
        PVSim.ui.charts.resizeAll();
      }, 50);
    });

    PVSim.bus.on("state:change", ({ path }) => {
      if (path === "simulation.day") {
        const results = PVSim.state.getResults();
        if (results) {
          PVSim.ui.charts.updateAll(results, PVSim.state.getSnapshot(), results.economics);
          PVSim.ui.dashboard.updateSummary(results, results.economics);
        }
      }
    });

    PVSim.bus.on("action:import-weather", (file) => {
      PVSim.io.import.importWeather(file);
    });

    PVSim.bus.on("action:import-load", (file) => {
      PVSim.io.import.importLoad(file);
    });

    PVSim.bus.on("scenario:load", (id) => {
      const scenario = PVSim.sim.scenario.findScenario(id);
      if (scenario) {
        PVSim.state.loadScenario(scenario);
        PVSim.ui.dashboard.updateScenarioList(PVSim.state.getScenarios());
        runSimulation();
      }
    });

    PVSim.bus.on("scenario:rename", (id) => {
      const scenario = PVSim.sim.scenario.findScenario(id);
      if (!scenario) return;
      const name = prompt("Scenario name", scenario.name);
      if (name) {
        PVSim.sim.scenario.renameScenario(id, name);
        PVSim.ui.dashboard.updateScenarioList(PVSim.state.getScenarios());
        PVSim.ui.tables.updateCompare(PVSim.state.getScenarios());
      }
    });

    PVSim.bus.on("scenario:remove", (id) => {
      PVSim.sim.scenario.removeScenario(id);
      PVSim.ui.dashboard.updateScenarioList(PVSim.state.getScenarios());
      PVSim.ui.tables.updateCompare(PVSim.state.getScenarios());
    });
  }

  PVSim.ready(() => {
    PVSim.ui.controls.init();
    PVSim.ui.charts.init();
    bindEvents();
    PVSim.ui.dashboard.updateScenarioList(PVSim.state.getScenarios());
    PVSim.ui.tables.updateCompare(PVSim.state.getScenarios());
    runSimulation();
  });
})();
