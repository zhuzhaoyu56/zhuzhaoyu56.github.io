(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  function createScenario(config, results) {
    return {
      id: PVSim.uid("scenario"),
      name: `Scenario ${new Date().toLocaleTimeString()}`,
      createdAt: Date.now(),
      config: utils.deepClone(config),
      results,
    };
  }

  function addScenario(config, results) {
    const list = PVSim.state.getScenarios();
    const scenario = createScenario(config, results);
    list.push(scenario);
    PVSim.state.setScenarios(list);
    return scenario;
  }

  function removeScenario(id) {
    const list = PVSim.state.getScenarios().filter((s) => s.id !== id);
    PVSim.state.setScenarios(list);
  }

  function findScenario(id) {
    return PVSim.state.getScenarios().find((s) => s.id === id);
  }

  function renameScenario(id, name) {
    const scenario = findScenario(id);
    if (scenario) {
      scenario.name = name;
      PVSim.state.setScenarios([...PVSim.state.getScenarios()]);
    }
  }

  PVSim.sim = PVSim.sim || {};
  PVSim.sim.scenario = {
    createScenario,
    addScenario,
    removeScenario,
    findScenario,
    renameScenario,
  };
})();
