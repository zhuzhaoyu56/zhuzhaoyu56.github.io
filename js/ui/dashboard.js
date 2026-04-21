(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  function updateSummary(results, economics) {
    const energyEl = document.querySelector("[data-value='summary-energy']");
    const prEl = document.querySelector("[data-value='summary-pr']");
    const cfEl = document.querySelector("[data-value='summary-cf']");
    const peakEl = document.querySelector("[data-value='summary-peak']");
    const savingsEl = document.querySelector("[data-value='summary-savings']");
    const paybackEl = document.querySelector("[data-value='summary-payback']");
    const throughputEl = document.querySelector("[data-value='summary-throughput']");
    const socEl = document.querySelector("[data-value='summary-soc']");

    if (energyEl) energyEl.textContent = `${utils.round(results.annual.energy, 1)} kWh`;
    if (prEl) prEl.textContent = `PR ${utils.round(results.annual.performanceRatio, 2)}`;
    if (cfEl) cfEl.textContent = utils.formatPercent(results.annual.capacityFactor, 1);
    if (peakEl) peakEl.textContent = `Peak ${utils.round(results.annual.peak, 1)} kW`;
    if (savingsEl && economics) savingsEl.textContent = utils.formatCurrency(economics.annualSavings, 0);
    if (paybackEl && economics) paybackEl.textContent = economics.payback ? `Payback ${economics.payback} yrs` : "Payback --";
    if (throughputEl) throughputEl.textContent = `${utils.round(results.annual.batteryThroughput, 1)} kWh`;
    if (socEl) socEl.textContent = `SOC ${(results.soc[results.soc.length - 1] * 100).toFixed(0)}%`;
  }

  function updateScenarioList(scenarios) {
    const list = document.getElementById("scenario-list");
    if (!list) return;
    list.innerHTML = "";
    scenarios.forEach((scenario) => {
      const card = document.createElement("div");
      card.className = "scenario-item";
      card.innerHTML = `
        <h4>${scenario.name}</h4>
        <p>${new Date(scenario.createdAt).toLocaleString()}</p>
        <div class="scenario-actions">
          <button class="btn" data-scenario="load" data-id="${scenario.id}">Load</button>
          <button class="btn" data-scenario="rename" data-id="${scenario.id}">Rename</button>
          <button class="btn" data-scenario="remove" data-id="${scenario.id}">Remove</button>
        </div>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll("button[data-scenario]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-scenario");
        const id = btn.getAttribute("data-id");
        PVSim.bus.emit(`scenario:${action}`, id);
      });
    });
  }

  PVSim.ui = PVSim.ui || {};
  PVSim.ui.dashboard = {
    updateSummary,
    updateScenarioList,
  };
})();
