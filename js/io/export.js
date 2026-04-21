(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportCSV(results) {
    const header = ["day", "hour", "pv_kw", "load_kw", "grid_kw", "soc", "irradiance", "temp"].join(",");
    const rows = results.time.map((t, idx) => {
      return [
        t.day,
        utils.round(t.hour, 2),
        utils.round(results.power[idx], 3),
        utils.round(results.load[idx], 3),
        utils.round(results.grid[idx], 3),
        utils.round(results.soc[idx], 3),
        utils.round(results.irradiance[idx], 2),
        utils.round(results.temperature[idx], 2),
      ].join(",");
    });
    const content = [header, ...rows].join("\n");
    download("pv-sim-output.csv", content, "text/csv");
  }

  function exportJSON(config, results) {
    const content = JSON.stringify({ config, results }, null, 2);
    download("pv-sim-output.json", content, "application/json");
  }

  function exportCharts() {
    const chartIds = [
      "chart-power",
      "chart-daily",
      "chart-losses",
      "chart-peaks",
      "chart-weather",
      "chart-cloud",
      "chart-storage",
      "chart-grid",
      "chart-finance",
    ];
    chartIds.forEach((id) => {
      const chart = PVSim.ui.charts && PVSim.ui.charts._instances ? PVSim.ui.charts._instances[id] : null;
      const instance = chart || (window.echarts && echarts.getInstanceByDom(document.getElementById(id)));
      if (!instance) return;
      const dataUrl = instance.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#0b1020" });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  PVSim.io = PVSim.io || {};
  PVSim.io.export = {
    exportCSV,
    exportJSON,
    exportCharts,
  };
})();
