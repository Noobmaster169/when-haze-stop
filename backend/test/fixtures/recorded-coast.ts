/**
 * Three NOAA-20 detections off Tanjung Piai, Johor, at 06:27 UTC on 3 October
 * 2026, as NASA FIRMS served them in the South East Asia 7-day file on 11
 * October 2026. Every one is at the 4 micron channel's ceiling (367 K) in a
 * daytime pass: sun glint on the water, near enough to the coast to pass the
 * open-sea screen and in a block too small for the glint screen.
 */
export const COAST_GLINT = {
  satellite: "noaa20",
  csv: [
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight",
    "1.20046,103.49654,367,0.44,0.38,2026-10-03,0627,N20,high,2.0NRT,294.42,17.81,D",
    "1.20278,103.48812,367,0.44,0.39,2026-10-03,0627,N20,high,2.0NRT,294.59,5.96,D",
    "1.20217,103.48418,367,0.44,0.39,2026-10-03,0627,N20,high,2.0NRT,294.55,5.96,D",
  ].join("\n"),
};
