(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;
  const data = PVSim.data;

  function isWeekend(dayOfYear, year) {
    const date = utils.dateFromDay(year, dayOfYear);
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  function profileFor(profileName) {
    return data.loadProfiles[profileName] || data.loadProfiles.residential;
  }

  function applyDemandResponse(load, mode) {
    if (mode === "none") return load;
    const factor = mode === "aggressive" ? 0.12 : 0.06;
    return load.map((value, idx) => {
      const shift = idx >= 14 && idx <= 18 ? 1 - factor : 1 + factor * 0.4;
      return value * shift;
    });
  }

  function dailyProfile(config, dayOfYear, year, resolutionMinutes) {
    const profile = profileFor(config.profile);
    const month = utils.dateFromDay(year, dayOfYear).getMonth();
    const scale = profile.monthlyScale[month] || 1;
    const base = config.baseKw * scale;
    const peak = config.baseKw * config.peakFactor * scale;
    const shape = isWeekend(dayOfYear, year) ? profile.weekend : profile.weekday;

    const steps = 24 * 60 / resolutionMinutes;
    const hourly = [];
    for (let i = 0; i < steps; i += 1) {
      const hour = i * resolutionMinutes / 60;
      const idx = Math.min(shape.length - 1, Math.floor(hour));
      const nextIdx = Math.min(shape.length - 1, idx + 1);
      const t = hour - idx;
      const value = utils.lerp(shape[idx], shape[nextIdx], t);
      const load = base + value * (peak - base);
      hourly.push(load);
    }

    return applyDemandResponse(hourly, config.demandResponse);
  }

  function generateLoadSeries(config, year, resolutionMinutes) {
    const series = [];
    for (let d = 1; d <= 365; d += 1) {
      const daily = dailyProfile(config, d, year, resolutionMinutes);
      daily.forEach((value, i) => {
        series.push({
          day: d,
          hour: i * resolutionMinutes / 60,
          load: value,
        });
      });
    }
    return series;
  }

  PVSim.models = PVSim.models || {};
  PVSim.models.load = {
    dailyProfile,
    generateLoadSeries,
  };
})();
