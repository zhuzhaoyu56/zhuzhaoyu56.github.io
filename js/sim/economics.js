(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  function npv(cashflows, rate) {
    return cashflows.reduce((acc, val, i) => acc + val / Math.pow(1 + rate, i + 1), 0);
  }

  function payback(cashflows) {
    let cumulative = 0;
    for (let i = 0; i < cashflows.length; i += 1) {
      cumulative += cashflows[i];
      if (cumulative >= 0) {
        return i + 1;
      }
    }
    return null;
  }

  function lcoe(capex, opexAnnual, energyAnnual, rate, life) {
    if (energyAnnual <= 0) return 0;
    const discountedEnergy = Array.from({ length: life }, (_, i) => energyAnnual / Math.pow(1 + rate, i + 1));
    const discountedCost = Array.from({ length: life }, (_, i) => opexAnnual / Math.pow(1 + rate, i + 1));
    return (capex + utils.sum(discountedCost)) / utils.sum(discountedEnergy);
  }

  function economicsSummary(config, results) {
    const capexPv = config.system.sizeKw * 1000 * config.economics.capexPerW;
    const capexBattery = config.storage.enabled ? config.storage.capacityKwh * config.economics.batteryPerKwh : 0;
    const capex = capexPv + capexBattery;
    const opex = config.system.sizeKw * config.economics.opexPerKw;
    const annualSavings = results.annual.gridSavings;
    const annualNet = annualSavings - opex;

    const cashflows = Array.from({ length: config.economics.projectLife }, (_, i) => {
      const degrade = 1 - config.losses.degradation / 100 * i;
      return annualNet * Math.max(0.7, degrade);
    });

    const npvValue = npv(cashflows, config.economics.discountRate) - capex;
    const paybackYears = payback(cashflows.map((v) => v)) || null;
    const lcoeValue = lcoe(capex, opex, results.annual.energy, config.economics.discountRate, config.economics.projectLife);

    return {
      capex,
      capexPv,
      capexBattery,
      opex,
      annualSavings,
      annualNet,
      npv: npvValue,
      payback: paybackYears,
      lcoe: lcoeValue,
      cashflows: cashflows.map((v) => v - (v === cashflows[0] ? capex : 0)),
    };
  }

  PVSim.sim = PVSim.sim || {};
  PVSim.sim.economics = {
    npv,
    payback,
    lcoe,
    economicsSummary,
  };
})();
