(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;
  const solar = PVSim.models.solar;
  const weatherModel = PVSim.models.weather;
  const irradianceModel = PVSim.models.irradiance;
  const pv = PVSim.models.pv;
  const storageModel = PVSim.models.storage;
  const loadModel = PVSim.models.load;

  function resolveWeather(config) {
    if (config.weather.mode === "import" && PVSim.state.getWeatherSeries()) {
      return PVSim.state.getWeatherSeries();
    }
    return weatherModel.generateHourlySeries({
      seed: config.simulation.year,
      cloudiness: config.weather.cloudiness,
      humidity: config.weather.humidity,
      aod: config.weather.aod,
      avgTemp: config.weather.avgTemp,
      wind: config.weather.wind,
    }, config.simulation.resolutionMinutes);
  }

  function resolveLoad(config) {
    if (config.load.profile === "custom" && PVSim.state.getLoadSeries()) {
      return PVSim.state.getLoadSeries();
    }
    return loadModel.generateLoadSeries(config.load, config.simulation.year, config.simulation.resolutionMinutes);
  }

  function simulate(config) {
    const resolution = config.simulation.resolutionMinutes;
    const stepsPerDay = 24 * 60 / resolution;
    const weather = resolveWeather(config);
    const loadSeries = resolveLoad(config);

    const storage = storageModel.initStorage(config.storage);

    const results = {
      time: [],
      power: [],
      dcPower: [],
      load: [],
      grid: [],
      soc: [],
      charge: [],
      discharge: [],
      irradiance: [],
      temperature: [],
      ghi: [],
      dailyEnergy: Array(365).fill(0),
      dailyPeak: Array(365).fill(0),
      monthlyEnergy: Array(12).fill(0),
      losses: {
        soiling: 0,
        wiring: 0,
        mismatch: 0,
        shading: 0,
        clipping: 0,
        curtailment: 0,
        thermal: 0,
      },
      annual: {
        energy: 0,
        peak: 0,
        gridImport: 0,
        gridExport: 0,
        load: 0,
        peakLoad: 0,
        peakGridImport: 0,
        selfConsumption: 0,
        gridSavings: 0,
        capacityFactor: 0,
        performanceRatio: 0,
        batteryThroughput: 0,
      },
    };

    const inverterAc = config.system.sizeKw / config.system.dcAcRatio;

    for (let idx = 0; idx < weather.hourly.length; idx += 1) {
      const weatherPoint = weather.hourly[idx];
      const day = weatherPoint.day;
      const hour = weatherPoint.hour;
      const loadPoint = loadSeries[idx];

      const irradiance = irradianceModel.irradianceAt({
        dayOfYear: day,
        hour,
        lat: config.location.lat,
        lon: config.location.lon,
        tz: config.location.tz,
        tilt: config.system.tilt,
        azimuth: config.system.azimuth,
        albedo: config.location.albedo,
        cloudFactor: weatherPoint.cloudFactor,
        aerosol: weatherPoint.aerosol,
        humidity: config.weather.humidity,
        dayFactor: weatherPoint.dayFactor,
      });

      const cellTemp = pv.cellTemperature(weatherPoint.temp, irradiance.poa, weatherPoint.wind);
      const rawDc = pv.dcPower({
        sizeKw: config.system.sizeKw,
        irradiance: irradiance.poa,
        moduleEfficiency: config.system.moduleEfficiency,
        tempCoeff: config.system.tempCoeff,
        cellTemp,
      });

      const lossedDc = pv.applyLosses(rawDc, config.losses);
      const acPower = pv.acPower(lossedDc, inverterAc, 0.985, 0.975);
      const clippedLoss = Math.max(0, lossedDc - inverterAc);

      const netPower = acPower - loadPoint.load;
      const storageStep = storageModel.step(storage, netPower, config.storage, resolution / 60);

      let gridPower = storageStep.grid;
      let curtailed = 0;
      if (gridPower > config.grid.exportLimit) {
        curtailed = gridPower - config.grid.exportLimit;
        gridPower = config.grid.exportLimit;
      }

      results.time.push({ day, hour });
      results.power.push(acPower);
      results.dcPower.push(lossedDc);
      results.load.push(loadPoint.load);
      results.grid.push(gridPower);
      results.soc.push(storageStep.soc);
      results.charge.push(storageStep.charge);
      results.discharge.push(storageStep.discharge);
      results.irradiance.push(irradiance.poa);
      results.temperature.push(cellTemp);
      results.ghi.push(irradiance.ghi);

      results.dailyEnergy[day - 1] += acPower * (resolution / 60);
      results.dailyPeak[day - 1] = Math.max(results.dailyPeak[day - 1], acPower);
      results.annual.energy += acPower * (resolution / 60);
      results.annual.load += loadPoint.load * (resolution / 60);
      results.annual.peak = Math.max(results.annual.peak, acPower);
      results.annual.peakLoad = Math.max(results.annual.peakLoad, loadPoint.load);
      results.annual.gridImport += Math.max(0, -gridPower) * (resolution / 60);
      results.annual.gridExport += Math.max(0, gridPower) * (resolution / 60);
      results.annual.peakGridImport = Math.max(results.annual.peakGridImport, Math.max(0, -gridPower));

      const month = utils.dateFromDay(config.simulation.year, day).getMonth();
      results.monthlyEnergy[month] += acPower * (resolution / 60);

      results.losses.soiling += rawDc * (config.losses.soiling / 100) * (resolution / 60);
      results.losses.wiring += rawDc * (config.losses.wiring / 100) * (resolution / 60);
      results.losses.mismatch += rawDc * (config.losses.mismatch / 100) * (resolution / 60);
      results.losses.shading += rawDc * (config.losses.shading / 100) * (resolution / 60);
      results.losses.clipping += clippedLoss * (resolution / 60);
      results.losses.curtailment += curtailed * (resolution / 60);
      results.losses.thermal += Math.max(0, rawDc - lossedDc) * (resolution / 60);
    }

    results.annual.capacityFactor = results.annual.energy / (config.system.sizeKw * 8760);
    results.annual.performanceRatio = results.annual.energy / Math.max(1, utils.sum(results.irradiance) * (resolution / 60) / 1000);
    results.annual.selfConsumption = 1 - results.annual.gridExport / Math.max(1, results.annual.energy);
    const demandAnnual = config.grid.demandCharge * 12;
    const sellRate = config.grid.netMetering ? config.grid.buyRate : config.grid.sellRate;
    const baselineCost = results.annual.load * config.grid.buyRate + results.annual.peakLoad * demandAnnual;
    const withPvCost = results.annual.gridImport * config.grid.buyRate - results.annual.gridExport * sellRate + results.annual.peakGridImport * demandAnnual;
    results.annual.gridSavings = baselineCost - withPvCost;
    results.annual.batteryThroughput = storage.throughput;

    return results;
  }

  PVSim.sim = PVSim.sim || {};
  PVSim.sim.engine = {
    simulate,
  };
})();
