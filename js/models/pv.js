(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  function cellTemperature(ambient, irradiance, wind) {
    const noct = 45;
    const delta = (noct - 20) * (irradiance / 800);
    const windCooling = 0.6 * wind;
    return ambient + delta - windCooling;
  }

  function dcPower({
    sizeKw,
    irradiance,
    moduleEfficiency,
    tempCoeff,
    cellTemp,
  }) {
    if (irradiance <= 0) return 0;
    const tempDerate = 1 + (tempCoeff / 100) * (cellTemp - 25);
    return sizeKw * (irradiance / 1000) * moduleEfficiency / 0.2 * tempDerate;
  }

  function applyLosses(dcPowerValue, losses) {
    const lossFactor = 1 - (losses.soiling + losses.wiring + losses.mismatch + losses.shading) / 100;
    return Math.max(0, dcPowerValue * lossFactor);
  }

  function inverterEfficiency(loadRatio, effMax, euro) {
    const k0 = 0.005;
    const k1 = 0.02;
    const k2 = 0.04;
    const eff = effMax - k0 / Math.max(loadRatio, 0.01) - k1 - k2 * (1 - loadRatio);
    return utils.clamp(eff * (euro / effMax), 0.85, effMax);
  }

  function acPower(dcPowerValue, inverterAcKw, effMax = 0.985, euro = 0.975) {
    if (dcPowerValue <= 0) return 0;
    const loadRatio = dcPowerValue / inverterAcKw;
    const eff = inverterEfficiency(Math.min(1, loadRatio), effMax, euro);
    const clipped = Math.min(dcPowerValue, inverterAcKw);
    return clipped * eff;
  }

  PVSim.models = PVSim.models || {};
  PVSim.models.pv = {
    cellTemperature,
    dcPower,
    applyLosses,
    inverterEfficiency,
    acPower,
  };
})();
