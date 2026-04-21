(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      rows.push(row);
    }
    return rows;
  }

  function importWeather(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(reader.result);
      if (!rows.length) return;
      const series = rows.map((row) => ({
        day: parseInt(row.day || row.doy || 1, 10),
        hour: parseFloat(row.hour || row.time || 0),
        cloud: parseFloat(row.cloud || row.cloudiness || 0.3),
        cloudFactor: parseFloat(row.cloudfactor || 0.8),
        temp: parseFloat(row.temp || row.temperature || 20),
        wind: parseFloat(row.wind || 3),
        aerosol: parseFloat(row.aod || 0.12),
        dayFactor: parseFloat(row.dayfactor || 0.9),
      }));
      PVSim.state.setWeatherSeries({ hourly: series, daily: {} });
      PVSim.logger.info("Weather CSV loaded", series.length);
    };
    reader.readAsText(file);
  }

  function importLoad(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(reader.result);
      if (!rows.length) return;
      const series = rows.map((row) => ({
        day: parseInt(row.day || row.doy || 1, 10),
        hour: parseFloat(row.hour || row.time || 0),
        load: parseFloat(row.load || row.kw || 0),
      }));
      PVSim.state.setLoadSeries(series);
      PVSim.logger.info("Load CSV loaded", series.length);
    };
    reader.readAsText(file);
  }

  PVSim.io = PVSim.io || {};
  PVSim.io.import = {
    importWeather,
    importLoad,
  };
})();
