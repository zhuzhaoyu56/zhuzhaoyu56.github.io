(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  function initStorage(config) {
    const capacity = Math.max(0, config.capacityKwh);
    return {
      capacity,
      soc: utils.clamp(config.minSoc || 0.1, 0, 1),
      throughput: 0,
    };
  }

  function step(storage, netPower, config, dtHours) {
    if (!config.enabled || storage.capacity <= 0) {
      return {
        soc: storage.soc,
        charge: 0,
        discharge: 0,
        grid: netPower,
        throughput: storage.throughput,
      };
    }

    const maxCharge = config.chargeKw;
    const maxDischarge = config.dischargeKw;
    const minSoc = config.minSoc;
    const maxSoc = 1.0;
    const eff = config.efficiency;

    let soc = storage.soc;
    let charge = 0;
    let discharge = 0;
    let grid = 0;

    if (netPower > 0) {
      const availableCharge = Math.min(netPower, maxCharge);
      const space = Math.max(0, maxSoc - soc) * storage.capacity;
      const energyIn = Math.min(space, availableCharge * dtHours);
      charge = energyIn / dtHours;
      soc += (energyIn * eff) / storage.capacity;
      grid = netPower - charge;
    } else if (netPower < 0) {
      const demand = Math.min(-netPower, maxDischarge);
      const availableEnergy = Math.max(0, soc - minSoc) * storage.capacity;
      const energyOut = Math.min(availableEnergy, demand * dtHours);
      discharge = energyOut / dtHours;
      soc -= energyOut / storage.capacity;
      grid = -(demand - discharge);
    }

    storage.soc = utils.clamp(soc, minSoc, maxSoc);
    storage.throughput += (charge + discharge) * dtHours;

    return {
      soc: storage.soc,
      charge,
      discharge,
      grid,
      throughput: storage.throughput,
    };
  }

  PVSim.models = PVSim.models || {};
  PVSim.models.storage = {
    initStorage,
    step,
  };
})();
