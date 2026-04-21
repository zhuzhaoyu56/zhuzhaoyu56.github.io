(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  const charts = {};
  const fallbackMessage = "Charts unavailable. ECharts failed to load.";

  function markFallback(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = fallbackMessage;
    el.style.display = "grid";
    el.style.placeItems = "center";
    el.style.color = "#9aa6bf";
    el.style.fontSize = "13px";
    el.style.padding = "12px";
  }

  function createChart(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    if (!window.echarts) {
      markFallback(id);
      return null;
    }
    const chart = echarts.init(el);
    charts[id] = chart;
    return chart;
  }

  function initCharts() {
    if (!window.echarts) {
      [
        "chart-power",
        "chart-daily",
        "chart-losses",
        "chart-peaks",
        "chart-weather",
        "chart-cloud",
        "chart-storage",
        "chart-grid",
        "chart-finance",
      ].forEach(markFallback);
      return;
    }
    createChart("chart-power");
    createChart("chart-daily");
    createChart("chart-losses");
    createChart("chart-peaks");
    createChart("chart-weather");
    createChart("chart-cloud");
    createChart("chart-storage");
    createChart("chart-grid");
    createChart("chart-finance");

    window.addEventListener("resize", () => {
      Object.values(charts).forEach((chart) => chart.resize());
    });
  }

  function daySlice(results, config) {
    const stepsPerDay = Math.floor(results.time.length / 365) || 1;
    const dayIndex = Math.min(365, Math.max(1, config.simulation.day || 1));
    const start = (dayIndex - 1) * stepsPerDay;
    const end = start + stepsPerDay;
    const slice = results.time.slice(start, end);
    const labels = slice.map((t) => utils.hourLabel(t.hour));
    return { start, end, labels };
  }

  function updatePower(results, config) {
    const slice = daySlice(results, config);
    const labels = slice.labels;
    if (!charts["chart-power"]) return;
    charts["chart-power"].setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      legend: { textStyle: { color: "#cbd4e8" } },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: { type: "category", data: labels, axisLabel: { color: "#9aa6bf" } },
      yAxis: { type: "value", name: "kW", axisLabel: { color: "#9aa6bf" } },
      series: [
        {
          name: "PV Power",
          type: "line",
          smooth: true,
          data: results.power.slice(slice.start, slice.end),
          lineStyle: { color: "#ffcb5e", width: 2 },
          areaStyle: { color: "rgba(255,203,94,0.2)" },
        },
        {
          name: "Load",
          type: "line",
          smooth: true,
          data: results.load.slice(slice.start, slice.end),
          lineStyle: { color: "#3bd4c5", width: 2 },
        },
        {
          name: "Grid",
          type: "line",
          smooth: true,
          data: results.grid.slice(slice.start, slice.end),
          lineStyle: { color: "#8db4ff", width: 2 },
        },
      ],
    });
  }

  function updateDaily(results) {
    const days = results.dailyEnergy.map((_, i) => i + 1);
    if (!charts["chart-daily"]) return;
    charts["chart-daily"].setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: { type: "category", data: days, axisLabel: { color: "#9aa6bf" } },
      yAxis: { type: "value", name: "kWh", axisLabel: { color: "#9aa6bf" } },
      series: [
        {
          name: "Daily Energy",
          type: "bar",
          data: results.dailyEnergy.map((v) => utils.round(v, 1)),
          itemStyle: { color: "#ffcb5e" },
        },
      ],
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", height: 16, bottom: 10, borderColor: "transparent", backgroundColor: "rgba(255,255,255,0.05)" },
      ],
    });
  }

  function updateLosses(results) {
    const lossEntries = [
      { name: "Soiling", value: results.losses.soiling },
      { name: "Wiring", value: results.losses.wiring },
      { name: "Mismatch", value: results.losses.mismatch },
      { name: "Shading", value: results.losses.shading },
      { name: "Clipping", value: results.losses.clipping },
      { name: "Curtailment", value: results.losses.curtailment },
      { name: "Thermal", value: results.losses.thermal },
    ];

    if (!charts["chart-losses"]) return;
    charts["chart-losses"].setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "item" },
      legend: { top: "bottom", textStyle: { color: "#cbd4e8" } },
      series: [
        {
          name: "Losses",
          type: "pie",
          radius: ["40%", "70%"],
          data: lossEntries,
          label: { color: "#e8eefc" },
          color: ["#ffcb5e", "#3bd4c5", "#8db4ff", "#ff6f61", "#a186ff", "#ffd1dc", "#7bff7a"],
        },
      ],
    });
  }

  function updatePeaks(results) {
    const days = results.dailyPeak.map((_, i) => i + 1);
    if (!charts["chart-peaks"]) return;
    charts["chart-peaks"].setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: { type: "category", data: days, axisLabel: { color: "#9aa6bf" } },
      yAxis: { type: "value", name: "kW", axisLabel: { color: "#9aa6bf" } },
      series: [
        {
          name: "Daily Peak",
          type: "line",
          smooth: true,
          data: results.dailyPeak.map((v) => utils.round(v, 2)),
          lineStyle: { color: "#8db4ff", width: 2 },
          areaStyle: { color: "rgba(141,180,255,0.2)" },
        },
      ],
    });
  }

  function updateWeather(results, config) {
    const slice = daySlice(results, config);
    const labels = slice.labels;
    if (!charts["chart-weather"]) return;
    charts["chart-weather"].setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      legend: { textStyle: { color: "#cbd4e8" } },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: { type: "category", data: labels, axisLabel: { color: "#9aa6bf" } },
      yAxis: [
        { type: "value", name: "W/m2", axisLabel: { color: "#9aa6bf" } },
        { type: "value", name: "C", axisLabel: { color: "#9aa6bf" } },
      ],
      series: [
        {
          name: "POA Irradiance",
          type: "line",
          smooth: true,
          data: results.irradiance.slice(slice.start, slice.end),
          lineStyle: { color: "#ffcb5e", width: 2 },
        },
        {
          name: "Module Temp",
          type: "line",
          smooth: true,
          yAxisIndex: 1,
          data: results.temperature.slice(slice.start, slice.end),
          lineStyle: { color: "#7bff7a", width: 2 },
        },
      ],
    });
  }

  function updateCloud(results) {
    const days = results.dailyEnergy.map((_, i) => i + 1);
    const stepsPerDay = Math.floor(results.ghi.length / 365) || 1;
    const dailyGhi = results.dailyEnergy.map((_, i) => {
      const start = i * stepsPerDay;
      const slice = results.ghi.slice(start, start + stepsPerDay);
      const sum = slice.reduce((a, b) => a + b, 0);
      return utils.round(sum * (24 / stepsPerDay) / 1000, 2);
    });
    if (!charts["chart-cloud"]) return;
    charts["chart-cloud"].setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: { type: "category", data: days, axisLabel: { color: "#9aa6bf" } },
      yAxis: { type: "value", name: "GHI", axisLabel: { color: "#9aa6bf" } },
      series: [
        {
          name: "Daily GHI",
          type: "line",
          smooth: true,
          data: dailyGhi,
          lineStyle: { color: "#3bd4c5", width: 2 },
        },
      ],
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", height: 16, bottom: 10, borderColor: "transparent", backgroundColor: "rgba(255,255,255,0.05)" },
      ],
    });
  }

  function updateStorage(results, config) {
    const slice = daySlice(results, config);
    const labels = slice.labels;
    if (!charts["chart-storage"]) return;
    charts["chart-storage"].setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: { type: "category", data: labels, axisLabel: { color: "#9aa6bf" } },
      yAxis: { type: "value", name: "SOC", axisLabel: { color: "#9aa6bf" } },
      series: [
        {
          name: "SOC",
          type: "line",
          smooth: true,
          data: results.soc.slice(slice.start, slice.end).map((v) => utils.round(v * 100, 1)),
          lineStyle: { color: "#7bff7a", width: 2 },
          areaStyle: { color: "rgba(123,255,122,0.2)" },
        },
      ],
    });
  }

  function updateGrid(results, config) {
    const slice = daySlice(results, config);
    const labels = slice.labels;
    if (!charts["chart-grid"]) return;
    charts["chart-grid"].setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      legend: { textStyle: { color: "#cbd4e8" } },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: { type: "category", data: labels, axisLabel: { color: "#9aa6bf" } },
      yAxis: { type: "value", name: "kW", axisLabel: { color: "#9aa6bf" } },
      series: [
        {
          name: "Charge",
          type: "line",
          smooth: true,
          data: results.charge.slice(slice.start, slice.end),
          lineStyle: { color: "#3bd4c5", width: 2 },
        },
        {
          name: "Discharge",
          type: "line",
          smooth: true,
          data: results.discharge.slice(slice.start, slice.end),
          lineStyle: { color: "#ff6f61", width: 2 },
        },
      ],
    });
  }

  function updateFinance(economics) {
    const years = economics.cashflows.map((_, i) => `Y${i + 1}`);
    if (!charts["chart-finance"]) return;
    charts["chart-finance"].setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: { type: "category", data: years, axisLabel: { color: "#9aa6bf" } },
      yAxis: { type: "value", name: "$", axisLabel: { color: "#9aa6bf" } },
      series: [
        {
          name: "Cashflow",
          type: "bar",
          data: economics.cashflows.map((v) => utils.round(v, 0)),
          itemStyle: {
            color: (params) => (params.value >= 0 ? "#7bff7a" : "#ff6f61"),
          },
        },
      ],
    });
  }

  function updateAll(results, config, economics) {
    updatePower(results, config);
    updateDaily(results);
    updateLosses(results);
    updatePeaks(results);
    updateWeather(results, config);
    updateCloud(results);
    updateStorage(results, config);
    updateGrid(results, config);
    if (economics) {
      updateFinance(economics);
    }
  }

  function resizeAll() {
    Object.values(charts).forEach((chart) => {
      if (chart && chart.resize) {
        chart.resize();
      }
    });
  }

  PVSim.ui = PVSim.ui || {};
  PVSim.ui.charts = {
    init: initCharts,
    updateAll,
    updateFinance,
    resizeAll,
    _instances: charts,
  };
})();
