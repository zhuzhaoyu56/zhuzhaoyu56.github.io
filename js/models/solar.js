(function () {
  const PVSim = window.PVSim;
  const utils = PVSim.utils;

  const solar = {
    declination(dayOfYear) {
      return 23.45 * Math.sin(utils.degToRad((360 * (284 + dayOfYear)) / 365));
    },
    equationOfTime(dayOfYear) {
      const b = utils.degToRad((360 / 365) * (dayOfYear - 81));
      return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    },
    solarTime(localTime, lon, tz, dayOfYear) {
      const eot = solar.equationOfTime(dayOfYear);
      const correction = 4 * (lon - tz * 15) + eot;
      return localTime + correction / 60;
    },
    hourAngle(solarTime) {
      return 15 * (solarTime - 12);
    },
    sunAltitude(lat, decl, hourAngle) {
      const latRad = utils.degToRad(lat);
      const declRad = utils.degToRad(decl);
      const ha = utils.degToRad(hourAngle);
      const sinAlt = Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(ha);
      return utils.radToDeg(Math.asin(utils.clamp(sinAlt, -1, 1)));
    },
    sunAzimuth(lat, decl, hourAngle, altitude) {
      const latRad = utils.degToRad(lat);
      const declRad = utils.degToRad(decl);
      const altRad = utils.degToRad(altitude);
      const ha = utils.degToRad(hourAngle);
      const cosAz = (Math.sin(declRad) - Math.sin(altRad) * Math.sin(latRad)) / (Math.cos(altRad) * Math.cos(latRad));
      let az = utils.radToDeg(Math.acos(utils.clamp(cosAz, -1, 1)));
      if (Math.sin(ha) > 0) {
        az = 360 - az;
      }
      return az;
    },
    sunriseSunset(lat, decl) {
      const latRad = utils.degToRad(lat);
      const declRad = utils.degToRad(decl);
      const cosH = -Math.tan(latRad) * Math.tan(declRad);
      if (cosH <= -1) {
        return { sunrise: 0, sunset: 24, dayLength: 24 };
      }
      if (cosH >= 1) {
        return { sunrise: 12, sunset: 12, dayLength: 0 };
      }
      const H = utils.radToDeg(Math.acos(cosH));
      const sunrise = 12 - H / 15;
      const sunset = 12 + H / 15;
      return { sunrise, sunset, dayLength: sunset - sunrise };
    },
    incidenceAngle(lat, decl, hourAngle, tilt, azimuth) {
      const latRad = utils.degToRad(lat);
      const declRad = utils.degToRad(decl);
      const ha = utils.degToRad(hourAngle);
      const tiltRad = utils.degToRad(tilt);
      const azRad = utils.degToRad(azimuth);
      const sinDecl = Math.sin(declRad);
      const cosDecl = Math.cos(declRad);
      const sinLat = Math.sin(latRad);
      const cosLat = Math.cos(latRad);
      const sinTilt = Math.sin(tiltRad);
      const cosTilt = Math.cos(tiltRad);
      const cosHa = Math.cos(ha);
      const sinHa = Math.sin(ha);
      const cosAz = Math.cos(azRad);
      const sinAz = Math.sin(azRad);

      const cosInc =
        sinDecl * sinLat * cosTilt -
        sinDecl * cosLat * sinTilt * cosAz +
        cosDecl * cosLat * cosTilt * cosHa +
        cosDecl * sinLat * sinTilt * cosAz * cosHa +
        cosDecl * sinTilt * sinAz * sinHa;

      return utils.radToDeg(Math.acos(utils.clamp(cosInc, -1, 1)));
    },
    extraterrestrialIrradiance(dayOfYear) {
      const eccentricity = 1 + 0.033 * Math.cos(utils.degToRad((360 * dayOfYear) / 365));
      return 1367 * eccentricity;
    },
  };

  PVSim.models = PVSim.models || {};
  PVSim.models.solar = solar;
})();
