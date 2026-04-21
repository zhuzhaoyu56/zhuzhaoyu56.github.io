(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  function renderTable(el, headers, rows) {
    if (!el) return;
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    headers.forEach((header) => {
      const th = document.createElement("th");
      th.textContent = header;
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const trRow = document.createElement("tr");
      row.forEach((cell) => {
        const td = document.createElement("td");
        td.innerHTML = cell;
        trRow.appendChild(td);
      });
      tbody.appendChild(trRow);
    });
    table.appendChild(tbody);

    el.innerHTML = "";
    el.appendChild(table);
  }

  function updateLosses(results) {
    const el = document.getElementById("table-losses");
    const total = utils.sum(Object.values(results.losses));
    const rows = Object.entries(results.losses).map(([key, value]) => {
      const share = total > 0 ? value / total : 0;
      return [
        key.charAt(0).toUpperCase() + key.slice(1),
        `${utils.round(value, 1)} kWh`,
        utils.formatPercent(share, 1),
      ];
    });
    renderTable(el, ["Loss", "Energy", "Share"], rows);
  }

  function updateBalance(results) {
    const el = document.getElementById("table-balance");
    const rows = [
      ["Annual PV Energy", `${utils.round(results.annual.energy, 1)} kWh`],
      ["Annual Load", `${utils.round(results.annual.load, 1)} kWh`],
      ["Peak Load", `${utils.round(results.annual.peakLoad, 1)} kW`],
      ["Peak Grid Import", `${utils.round(results.annual.peakGridImport, 1)} kW`],
      ["Grid Import", `${utils.round(results.annual.gridImport, 1)} kWh`],
      ["Grid Export", `${utils.round(results.annual.gridExport, 1)} kWh`],
      ["Self Consumption", utils.formatPercent(results.annual.selfConsumption, 1)],
      ["Capacity Factor", utils.formatPercent(results.annual.capacityFactor, 1)],
    ];
    renderTable(el, ["Metric", "Value"], rows);
  }

  function updateEconomics(economics) {
    const el = document.getElementById("table-economics");
    const rows = [
      ["CAPEX", utils.formatCurrency(economics.capex, 0)],
      ["CAPEX PV", utils.formatCurrency(economics.capexPv, 0)],
      ["CAPEX Battery", utils.formatCurrency(economics.capexBattery, 0)],
      ["Annual OPEX", utils.formatCurrency(economics.opex, 0)],
      ["Annual Savings", utils.formatCurrency(economics.annualSavings, 0)],
      ["Annual Net", utils.formatCurrency(economics.annualNet, 0)],
      ["NPV", utils.formatCurrency(economics.npv, 0)],
      ["Payback", economics.payback ? `${economics.payback} yrs` : "--"],
      ["LCOE", `${utils.round(economics.lcoe, 3)} $/kWh`],
    ];
    renderTable(el, ["Metric", "Value"], rows);
  }

  function updateCompare(scenarios) {
    const el = document.getElementById("table-compare");
    if (!scenarios || scenarios.length === 0) {
      renderTable(el, ["Scenario", "Energy", "CF", "Payback"], []);
      return;
    }
    const rows = scenarios.map((scenario) => {
      const energy = scenario.results ? `${utils.round(scenario.results.annual.energy, 1)} kWh` : "--";
      const cf = scenario.results ? utils.formatPercent(scenario.results.annual.capacityFactor, 1) : "--";
      const payback = scenario.results && scenario.results.economics ? `${scenario.results.economics.payback} yrs` : "--";
      return [scenario.name, energy, cf, payback];
    });
    renderTable(el, ["Scenario", "Energy", "CF", "Payback"], rows);
  }

  PVSim.ui = PVSim.ui || {};
  PVSim.ui.tables = {
    updateLosses,
    updateBalance,
    updateEconomics,
    updateCompare,
  };
})();
