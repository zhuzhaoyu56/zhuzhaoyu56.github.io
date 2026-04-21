(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;
  const data = PVSim.data;

  function monthlyValue(arr, dayOfYear) {
    let day = dayOfYear;
    for (let i = 0; i < data.monthDays.length; i += 1) {
      if (day <= data.monthDays[i]) {
        return arr[i];
      }
      day -= data.monthDays[i];
    }
    return arr[arr.length - 1];
  }

  function seasonalNoise(rng, scale = 0.05) {
    return (rng() - 0.5) * 2 * scale;
  }

  function temperatureSeries(config) {
    const rng = utils.seededRandom(config.seed || 1);
    const temps = [];
    for (let d = 1; d <= 365; d += 1) {
      const base = monthlyValue(data.monthlyNormals.temp, d);
      const seasonal = base + seasonalNoise(rng, 1.2) + config.avgTemp - 18;
      temps.push(utils.round(seasonal, 2));
    }
    return temps;
  }

  function cloudSeries(config) {
    const rng = utils.seededRandom(config.seed || 2);
    const clouds = [];
    for (let d = 1; d <= 365; d += 1) {
      const base = monthlyValue(data.monthlyNormals.cloud, d);
      const val = utils.clamp(base + (config.cloudiness - 0.3) + seasonalNoise(rng, 0.08), 0.05, 0.95);
      clouds.push(utils.round(val, 3));
    }
    return clouds;
  }

  function windSeries(config) {
    const rng = utils.seededRandom(config.seed || 3);
    const wind = [];
    for (let d = 1; d <= 365; d += 1) {
      const base = monthlyValue(data.monthlyNormals.wind, d);
      const val = utils.clamp(base + seasonalNoise(rng, 0.6) + (config.wind - 3.2), 0.2, 12);
      wind.push(utils.round(val, 2));
    }
    return wind;
  }

  function aerosolSeries(config) {
    const rng = utils.seededRandom(config.seed || 4);
    const aerosol = [];
    for (let d = 1; d <= 365; d += 1) {
      const base = monthlyValue(data.monthlyNormals.aerosol, d);
      const val = utils.clamp(base + (config.aod - 0.12) + seasonalNoise(rng, 0.02), 0.02, 0.4);
      aerosol.push(utils.round(val, 3));
    }
    return aerosol;
  }

  function dayFactorSeries(seed = 1) {
    const rng = utils.seededRandom(seed);
    return data.typicalDayFactors.map((v) => utils.round(v + seasonalNoise(rng, 0.05), 3));
  }

  function hourlyCloudFactor(dayCloud, hour, rng) {
    const pulses = [
      { center: 6.5, width: 1.2, depth: 0.15 },
      { center: 11.0, width: 2.3, depth: 0.25 },
      { center: 15.5, width: 1.6, depth: 0.18 },
    ];
    let shade = 0;
    pulses.forEach((p) => {
      shade += p.depth * Math.exp(-Math.pow((hour - p.center) / p.width, 2));
    });
    const jitter = (rng() - 0.5) * 0.06;
    return utils.clamp(1 - dayCloud - shade + jitter, 0.1, 1);
  }

  function temperatureAt(dayTemp, hour, wind, cloud) {
    const diurnal = 5 * Math.sin((hour - 6) / 24 * 2 * Math.PI);
    const windCooling = -0.4 * wind;
    const cloudOffset = -3 * cloud;
    return dayTemp + diurnal + windCooling + cloudOffset;
  }

  function generateHourlySeries(config, resolutionMinutes) {
    const rng = utils.seededRandom(config.seed || 5);
    const tempDaily = temperatureSeries(config);
    const cloudDaily = cloudSeries(config);
    const windDaily = windSeries(config);
    const aerosolDaily = aerosolSeries(config);
    const dayFactors = dayFactorSeries(config.seed || 6);

    const hours = 24 * 60 / resolutionMinutes;
    const hourly = [];

    for (let d = 1; d <= 365; d += 1) {
      const dayCloud = cloudDaily[d - 1];
      const dayTemp = tempDaily[d - 1];
      const dayWind = windDaily[d - 1];
      const dayAerosol = aerosolDaily[d - 1];
      const dayFactor = dayFactors[d - 1];

      for (let i = 0; i < hours; i += 1) {
        const hour = i * resolutionMinutes / 60;
        hourly.push({
          day: d,
          hour,
          cloud: dayCloud,
          cloudFactor: hourlyCloudFactor(dayCloud, hour, rng),
          temp: temperatureAt(dayTemp, hour, dayWind, dayCloud),
          wind: dayWind,
          aerosol: dayAerosol,
          dayFactor,
        });
      }
    }

    return {
      daily: {
        temp: tempDaily,
        cloud: cloudDaily,
        wind: windDaily,
        aerosol: aerosolDaily,
        factor: dayFactors,
      },
      hourly,
    };
  }

  PVSim.models = PVSim.models || {};
  PVSim.models.weather = {
    monthlyValue,
    temperatureSeries,
    cloudSeries,
    windSeries,
    aerosolSeries,
    generateHourlySeries,
  };
})();
