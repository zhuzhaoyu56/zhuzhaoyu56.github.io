(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;
  const solar = PVSim.models.solar;

  function airMass(altitudeDeg) {
    const altRad = utils.degToRad(Math.max(0.5, altitudeDeg));
    return 1 / Math.sin(altRad + 0.50572 * Math.pow(altRad + 6.07995, -1.6364));
  }

  function clearSkyGhi(altitudeDeg) {
    if (altitudeDeg <= 0) return 0;
    const am = airMass(altitudeDeg);
    return 1098 * Math.exp(-0.059 / Math.sin(utils.degToRad(altitudeDeg))) * Math.sin(utils.degToRad(altitudeDeg));
  }

  function splitDiffuse(ghi, altitudeDeg) {
    if (ghi <= 0) return { dni: 0, dhi: 0 };
    const kt = ghi / (1367 * Math.sin(utils.degToRad(altitudeDeg)));
    let dhi = ghi * (0.95 - 0.4 * kt);
    dhi = utils.clamp(dhi, 0, ghi);
    const dni = (ghi - dhi) / Math.max(0.05, Math.sin(utils.degToRad(altitudeDeg)));
    return { dni, dhi };
  }

  function transmittance(cloudFactor, aerosol, humidity) {
    const cloud = utils.clamp(cloudFactor, 0.1, 1);
    const aerosolLoss = utils.clamp(1 - aerosol * 0.4, 0.5, 1);
    const humidityLoss = utils.clamp(1 - (humidity - 0.3) * 0.3, 0.6, 1);
    return cloud * aerosolLoss * humidityLoss;
  }

  function poaIrradiance(ghi, dni, dhi, altitudeDeg, tilt, azimuth, sunAzimuth, albedo) {
    const tiltRad = utils.degToRad(tilt);
    const sunAltRad = utils.degToRad(altitudeDeg);
    const cosInc = Math.max(0, Math.cos(tiltRad) * Math.sin(sunAltRad) + Math.sin(tiltRad) * Math.cos(sunAltRad) * Math.cos(utils.degToRad(sunAzimuth - azimuth)));
    const beam = dni * cosInc;
    const diffuse = dhi * (1 + Math.cos(tiltRad)) / 2;
    const ground = ghi * albedo * (1 - Math.cos(tiltRad)) / 2;
    return Math.max(0, beam + diffuse + ground);
  }

  function irradianceAt({
    dayOfYear,
    hour,
    lat,
    lon,
    tz,
    tilt,
    azimuth,
    albedo,
    cloudFactor,
    aerosol,
    humidity,
    dayFactor,
  }) {
    const decl = solar.declination(dayOfYear);
    const solarTime = solar.solarTime(hour, lon, tz, dayOfYear);
    const ha = solar.hourAngle(solarTime);
    const alt = solar.sunAltitude(lat, decl, ha);
    if (alt <= 0) {
      return { ghi: 0, dni: 0, dhi: 0, poa: 0, altitude: alt, sunAzimuth: 0 };
    }
    const sunAz = solar.sunAzimuth(lat, decl, ha, alt);
    let ghi = clearSkyGhi(alt) * dayFactor;
    const trans = transmittance(cloudFactor, aerosol, humidity);
    ghi *= trans;
    const split = splitDiffuse(ghi, alt);
    const poa = poaIrradiance(ghi, split.dni, split.dhi, alt, tilt, azimuth, sunAz, albedo);
    return {
      ghi,
      dni: split.dni,
      dhi: split.dhi,
      poa,
      altitude: alt,
      sunAzimuth: sunAz,
    };
  }

  PVSim.models = PVSim.models || {};
  PVSim.models.irradiance = {
    airMass,
    clearSkyGhi,
    splitDiffuse,
    transmittance,
    poaIrradiance,
    irradianceAt,
  };
})();
