(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const FIXED_DT = 1 / 30;
  const MAX_FRAMES = 18_000;
  const STORAGE_KEY = "orbital-flight-settings-v3";
  const SAFE_TILT_DEG = 10;
  const SAFE_VERTICAL_SPEED = 2.5;
  const SAFE_HORIZONTAL_SPEED = 1.5;
  const ATTITUDE_RATE_DEG_PER_SEC = 14;
  const ATTITUDE_LIMIT_RAD = Math.PI / 7;
  const LATERAL_ACCELERATION = 0.9;
  const LATERAL_FINE_SCALE = 0.35;
  const ATTITUDE_STABILIZATION = 0.995;
  const HORIZONTAL_DRIFT_DAMPING_PER_SEC = 0.35;

  const PHASES = {
    braking: ["BRAKING", "Build thrust and reduce high descent velocity."],
    approach: ["APPROACH", "Null lateral drift and establish visual landing pad lock."],
    final: ["FINAL DESCENT", "Use fine throttle. Landing probes are nearing the lunar surface."],
    touchdown: ["TOUCHDOWN", "Surface contact confirmed. Main engine shutdown."],
    paused: ["PAUSED", "Flight controls held. Press P or resume to continue."]
  };

  const DIFFICULTIES = {
    easy: { altitude: 560, gravity: 1.45, terrain: 0.45, terrainRoughness: 0.45, fuelFraction: 1, initialVy: -11, initialVerticalSpeed: -11, label: "Easy" },
    normal: { altitude: 400, gravity: 1.62, terrain: 1, terrainRoughness: 1, fuelFraction: 1, initialVy: -15, initialVerticalSpeed: -15, label: "Normal" },
    hard: { altitude: 290, gravity: 1.82, terrain: 1.8, terrainRoughness: 1.8, fuelFraction: 0.8, initialVy: -17, initialVerticalSpeed: -17, label: "Hard" }
  };

  const DEFAULT_KEYS = {
    thrust: "KeyW", cutThrottle: "KeyS", lateralLeft: "KeyA", lateralRight: "KeyD",
    pitchUp: "ArrowUp", pitchDown: "ArrowDown", rollLeft: "KeyQ", rollRight: "KeyE",
    throttleDown: "KeyZ", throttleUp: "KeyX", fine: "ShiftLeft",
    restart: "KeyR", pause: "KeyP", camera: "KeyC"
  };

  const KEY_LABELS = {
    thrust: "Thrust", cutThrottle: "Cut throttle", lateralLeft: "Lateral left",
    lateralRight: "Lateral right", pitchUp: "Pitch up", pitchDown: "Pitch down",
    rollLeft: "Roll left", rollRight: "Roll right", throttleDown: "Decrease throttle",
    throttleUp: "Increase throttle", fine: "Fine control", restart: "Restart",
    pause: "Pause / resume", camera: "Change camera"
  };

  const VEHICLE = { dryMass: 5200, fuelCapacity: 1800, exhaustVelocity: 3000, initialAcceleration: 4.2 };

  // ==========================================
  // CANDIDATE LANDING SITES DATASET
  // ==========================================
  const SITES_DATA = {
    shackleton: {
      name: "Shackleton Crater Rim",
      category: "Artemis III Candidate",
      lat: -89.90, lon: 0.00, elev: 4.2, mask: 1.2,
      sunlightPct: 88, maxNightHrs: 54, earthLosPct: 91, maxBlackoutHrs: 62,
      psrDistKm: 1.4, slopeDeg: 12, feasibility: "HIGH",
      desc: "Connecting Ridge / Shackleton Rim provides exceptional solar availability exceeding 86% of the lunar year, direct line of sight to Earth for communications, and immediate proximity to cold traps containing water ice.",
      advisory: "Optimal for long-duration base camp. Vertical solar panels capture grazing sun continuously. Earth remains consistently visible above the rim except during peak southern libration dips."
    },
    connecting_ridge: {
      name: "Connecting Ridge",
      category: "Artemis III Candidate",
      lat: -89.44, lon: 222.50, elev: 3.8, mask: 1.5,
      sunlightPct: 84, maxNightHrs: 68, earthLosPct: 87, maxBlackoutHrs: 76,
      psrDistKm: 2.1, slopeDeg: 9, feasibility: "HIGH",
      desc: "Prominent ridge structure connecting de Gerlache and Shackleton. Highly favorable terrain slope for lander stability and rover traverse.",
      advisory: "Favorable trafficability for mobile rovers (VIPER / LTV). Stable thermal profile along the crestline with accessible descent routes into adjacent permanently shadowed depressions."
    },
    malapert_mountain: {
      name: "Malapert Mountain (Peak)",
      category: "Artemis III Candidate",
      lat: -86.04, lon: 2.70, elev: 5.0, mask: 0.8,
      sunlightPct: 92, maxNightHrs: 42, earthLosPct: 95, maxBlackoutHrs: 38,
      psrDistKm: 5.8, slopeDeg: 14, feasibility: "HIGH",
      desc: "Massive towering massif (Malapert Peak) rising 5,000 meters above surrounding plains. Provides the highest continuous Earth direct line-of-sight in the south pole region.",
      advisory: "Premier telecommunications and relay site. Unobstructed view of Earth allows near-constant 24/7 direct telemetry and high-bandwidth lunar internet relay."
    },
    de_gerlache_rim2: {
      name: "de Gerlache Rim 2",
      category: "Artemis III Candidate",
      lat: -88.71, lon: -68.70, elev: 3.4, mask: 1.8,
      sunlightPct: 81, maxNightHrs: 78, earthLosPct: 83, maxBlackoutHrs: 92,
      psrDistKm: 1.8, slopeDeg: 8, feasibility: "MODERATE",
      desc: "Broad, gently sloping plateau on the northern rim of de Gerlache crater. Exceptional landing safety hazard margin with low boulder density.",
      advisory: "Lower landing risk due to gentle slopes (<8°). Requires moderate battery reserves during brief periodic shadow crossings caused by adjacent mountain ridges."
    },
    peak_shackleton: {
      name: "Peak Near Shackleton",
      category: "Artemis III Candidate",
      lat: -89.70, lon: 126.00, elev: 4.1, mask: 1.1,
      sunlightPct: 89, maxNightHrs: 48, earthLosPct: 88, maxBlackoutHrs: 70,
      psrDistKm: 2.6, slopeDeg: 11, feasibility: "HIGH",
      desc: "An isolated elevated peak located between Shackleton and Slater craters, boasting extreme solar illumination duration throughout lunar summer.",
      advisory: "Prime candidate for primary solar array power generation farm. Direct line-of-sight to Earth is maintained across most of the anomalistic libration cycle."
    },
    haworth_rim: {
      name: "Haworth Crater Rim",
      category: "Artemis III Candidate",
      lat: -87.40, lon: -5.10, elev: 2.9, mask: 2.2,
      sunlightPct: 76, maxNightHrs: 96, earthLosPct: 79, maxBlackoutHrs: 110,
      psrDistKm: 0.8, slopeDeg: 15, feasibility: "CAUTION",
      desc: "Rim crest overlooking one of the coldest Permanently Shadowed Regions on the Moon (35 Kelvin), harboring high concentrations of volatile hydrogen compounds.",
      advisory: "High science yield for volatile sampling, but terrain shadows and Earth libration dips require substantial battery reserves and intermittent orbital relay."
    },
    nobile_rim1: {
      name: "Nobile Rim 1 (VIPER Site)",
      category: "Artemis / VIPER Site",
      lat: -85.20, lon: 37.80, elev: 3.2, mask: 1.6,
      sunlightPct: 79, maxNightHrs: 88, earthLosPct: 85, maxBlackoutHrs: 82,
      psrDistKm: 3.2, slopeDeg: 7, feasibility: "HIGH",
      desc: "Designated exploration landing area for NASA's Volatiles Investigating Polar Exploration Rover (VIPER). Broad mountain plateau with accessible micro-cold traps.",
      advisory: "Gentle slopes (<7°) optimized for wheeled roving vehicles. Favorable multi-week operational windows with predictable solar illumination corridors."
    },
    faustini_rim: {
      name: "Faustini Rim A",
      category: "Artemis III Candidate",
      lat: -87.10, lon: 77.00, elev: 3.6, mask: 1.9,
      sunlightPct: 80, maxNightHrs: 82, earthLosPct: 82, maxBlackoutHrs: 94,
      psrDistKm: 1.9, slopeDeg: 10, feasibility: "MODERATE",
      desc: "Mountain ridge bordering Faustini crater. Features stable cryogenic temperature gradients suitable for thermal heat rejection systems.",
      advisory: "Moderate feasibility. Balanced solar access with periods of low-elevation Earth visibility. Ground relays recommended on eastern ridgeline."
    },
    amundsen_rim: {
      name: "Amundsen Rim",
      category: "Artemis III Candidate",
      lat: -84.50, lon: 85.60, elev: 3.1, mask: 2.4,
      sunlightPct: 74, maxNightHrs: 112, earthLosPct: 80, maxBlackoutHrs: 104,
      psrDistKm: 4.5, slopeDeg: 12, feasibility: "MODERATE",
      desc: "Rim of the deep impact basin Amundsen. High geological priority exposing deep lunar lower-crustal materials excavated during impact.",
      advisory: "Geological treasure trove. Longer lunar shadow periods require fuel cells or Stirling radioisotope power systems (RPS) to survive night phases."
    },
    im1_odysseus: {
      name: "IM-1 Odysseus (Malapert A)",
      category: "CLPS Commercial Mission",
      lat: -80.13, lon: 1.44, elev: 2.1, mask: 2.6,
      sunlightPct: 68, maxNightHrs: 180, earthLosPct: 86, maxBlackoutHrs: 72,
      psrDistKm: 18.0, slopeDeg: 11, feasibility: "MODERATE",
      desc: "Intuitive Machines Nova-C lander 'Odysseus' landed Feb 22, 2024 at Malapert A crater. First commercial lunar payload delivery to the south pole region.",
      advisory: "Historical CLPS benchmark. At 80°S, solar day/night cycles approach standard diurnal periods (~14 Earth days day / 14 Earth days night). Direct DTE communication active."
    },
    im2_athena: {
      name: "IM-2 Athena (Shackleton Ridge)",
      category: "CLPS Commercial Mission",
      lat: -89.30, lon: 140.00, elev: 3.9, mask: 1.3,
      sunlightPct: 86, maxNightHrs: 58, earthLosPct: 89, maxBlackoutHrs: 64,
      psrDistKm: 1.6, slopeDeg: 8, feasibility: "HIGH",
      desc: "Upcoming CLPS flight carrying NASA's Polar Resources Ice Mining Experiment-1 (PRIME-1) drill to extract sub-surface lunar regolith ice.",
      advisory: "Targeted directly at water-ice bearing ridge. High sunlight percentage maximizes drill duty cycle. Direct communication with Deep Space Network Goldstone and Madrid."
    },
    astrobotic_viper: {
      name: "Astrobotic Griffin (Mons Mouton)",
      category: "CLPS Commercial Mission",
      lat: -84.90, lon: -31.60, elev: 4.6, mask: 1.4,
      sunlightPct: 82, maxNightHrs: 74, earthLosPct: 88, maxBlackoutHrs: 70,
      psrDistKm: 3.5, slopeDeg: 6, feasibility: "HIGH",
      desc: "Mons Mouton mesa provides a wide, flat summit with panoramic views of the lunar south pole and reliable communication geometry.",
      advisory: "Flat terrain significantly mitigates touchdown tip-over risks. Proximity to shallow PSRs enables direct rover sorties."
    },
    blue_ghost1: {
      name: "Firefly Blue Ghost 1 (Mare Crisium)",
      category: "CLPS Commercial Mission",
      lat: 18.56, lon: 61.81, elev: -3.2, mask: 0.5,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 100, maxBlackoutHrs: 0,
      psrDistKm: 850.0, slopeDeg: 2, feasibility: "EQUATORIAL",
      desc: "Mare Crisium low-latitude landing site. Demonstrates geophysical regolith investigations and lunar X-ray solar wind imaging.",
      advisory: "Equatorial mare site: Full 14-day continuous sunlight followed by 14-day freeze night. Earth is permanently high in the sky (elevation ~48°), zero comms blackout."
    },
    hakuto_r: {
      name: "ispace HAKUTO-R (Atlas Crater)",
      category: "CLPS Commercial Mission",
      lat: 47.50, lon: 44.40, elev: -1.8, mask: 1.0,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 100, maxBlackoutHrs: 0,
      psrDistKm: 600.0, slopeDeg: 4, feasibility: "MID-LATITUDE",
      desc: "Commercial lunar exploration landing site in northern hemisphere impact crater Atlas.",
      advisory: "Mid-latitude site: Earth remains continuously above horizon at 38° elevation. Requires lander survival heaters for standard two-week lunar night."
    },
    apollo11: {
      name: "Apollo 11 (Mare Tranquillitatis)",
      category: "Historic Apollo Heritage",
      lat: 0.674, lon: 23.473, elev: -1.2, mask: 0.2,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 100, maxBlackoutHrs: 0,
      psrDistKm: 1200.0, slopeDeg: 1, feasibility: "EQUATORIAL HERITAGE",
      desc: "Tranquility Base (Statio Tranquillitatis). Touched down July 20, 1969. Flat lunar basaltic mare with zero terrain shadow obstruction.",
      advisory: "Classic equatorial site. High overhead sun (>70° elevation at noon). Earth hangs fixed near local zenith (~58° elevation), giving 100% continuous direct-to-Earth communication."
    },
    apollo12: {
      name: "Apollo 12 (Oceanus Procellarum)",
      category: "Historic Apollo Heritage",
      lat: -3.012, lon: -23.422, elev: -1.4, mask: 0.3,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 100, maxBlackoutHrs: 0,
      psrDistKm: 1100.0, slopeDeg: 2, feasibility: "EQUATORIAL HERITAGE",
      desc: "Ocean of Storms. Pinpoint landing within 160 meters of the Surveyor 3 robotic spacecraft.",
      advisory: "Equatorial benchmark. Earth remains permanently visible at 62° elevation."
    },
    apollo14: {
      name: "Apollo 14 (Fra Mauro)",
      category: "Historic Apollo Heritage",
      lat: -3.645, lon: -17.471, elev: -0.8, mask: 0.4,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 100, maxBlackoutHrs: 0,
      psrDistKm: 1150.0, slopeDeg: 3, feasibility: "EQUATORIAL HERITAGE",
      desc: "Fra Mauro formation breccia hills excavated by the Imbrium impact basin.",
      advisory: "Hilly highlands terrain with high overhead solar irradiance."
    },
    apollo15: {
      name: "Apollo 15 (Hadley Rille)",
      category: "Historic Apollo Heritage",
      lat: 26.132, lon: 3.634, elev: -1.9, mask: 3.2,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 100, maxBlackoutHrs: 0,
      psrDistKm: 980.0, slopeDeg: 8, feasibility: "MOUNTAIN VALLEY",
      desc: "Dramatic landing near Mount Hadley (4,500 m) and the winding sinus Hadley rille. First Lunar Roving Vehicle mission.",
      advisory: "Deep valley site: Mount Hadley blocks low morning sun rays, but Earth remains permanently elevated at 54°."
    },
    apollo16: {
      name: "Apollo 16 (Descartes Highlands)",
      category: "Historic Apollo Heritage",
      lat: -8.973, lon: 15.500, elev: +1.4, mask: 0.6,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 100, maxBlackoutHrs: 0,
      psrDistKm: 1050.0, slopeDeg: 4, feasibility: "EQUATORIAL HIGHLANDS",
      desc: "High-altitude lunar plateau exploring Cayley formation and Descartes material.",
      advisory: "High elevation nearside landing site. Earth always visible overhead."
    },
    apollo17: {
      name: "Apollo 17 (Taurus-Littrow)",
      category: "Historic Apollo Heritage",
      lat: 20.191, lon: 30.772, elev: -2.1, mask: 4.5,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 100, maxBlackoutHrs: 0,
      psrDistKm: 920.0, slopeDeg: 12, feasibility: "VALLEY CANYON",
      desc: "Deep narrow mountain valley flanked by the North and South Massifs. Final Apollo lunar surface mission.",
      advisory: "Massifs cast pronounced morning shadows. Constant line of sight to Earth (elevation ~56°)."
    },
    chandrayaan3: {
      name: "Chandrayaan-3 (Shiv Shakti Point)",
      category: "International Mission (ISRO)",
      lat: -69.373, lon: 32.319, elev: -1.1, mask: 2.1,
      sunlightPct: 54, maxNightHrs: 310, earthLosPct: 98, maxBlackoutHrs: 12,
      psrDistKm: 120.0, slopeDeg: 4, feasibility: "HIGH LATITUDE",
      desc: "Historic high-latitude southern landing by ISRO's Vikram lander and Pragyan rover on Aug 23, 2023.",
      advisory: "High-latitude site (~70°S). Sun rises to moderate peak elevation (~20°). Earth remains visible near horizon (18° elevation), giving excellent telemetry contact."
    },
    change3: {
      name: "Chang'e 3 (Mare Imbrium)",
      category: "International Mission (CNSA)",
      lat: 44.12, lon: -19.51, elev: -2.6, mask: 1.0,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 100, maxBlackoutHrs: 0,
      psrDistKm: 900.0, slopeDeg: 3, feasibility: "NEARSIDE",
      desc: "China's Chang'e 3 lander touched down in northern Mare Imbrium on Dec 14, 2013, deploying the Yutu rover.",
      advisory: "Low-latitude nearside site with Earth in direct view and the usual lunar day-night cycle."
    },
    change4: {
      name: "Chang'e 4 (Von Kármán Far Side)",
      category: "International Mission (CNSA)",
      lat: -45.45, lon: 177.59, elev: -5.9, mask: 1.8,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 0, maxBlackoutHrs: 9999,
      psrDistKm: 450.0, slopeDeg: 5, feasibility: "FAR SIDE (RELAY ONLY)",
      desc: "First successful soft landing on the lunar far side (Von Kármán crater in South Pole-Aitken basin). Touched down Jan 3, 2019.",
      advisory: "FAR SIDE SITE: Earth is NEVER visible from the landing site (Earth elevation is -45° below horizon). Direct-to-Earth communication is IMPOSSIBLE. Requires a dedicated halo-orbit relay satellite (Queqiao relay at Earth-Moon L2 point)!"
    },
    change5: {
      name: "Chang'e 5 (Oceanus Procellarum)",
      category: "International Mission (CNSA)",
      lat: 43.06, lon: -51.92, elev: -2.0, mask: 1.0,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 100, maxBlackoutHrs: 0,
      psrDistKm: 900.0, slopeDeg: 3, feasibility: "NEARSIDE",
      desc: "China's Chang'e 5 sample-return lander touched down in northern Oceanus Procellarum on Dec 1, 2020.",
      advisory: "Low-latitude nearside site with Earth in direct view and the usual lunar day-night cycle."
    },
    change6: {
      name: "Chang'e 6 (South Pole-Aitken Sample)",
      category: "International Mission (CNSA)",
      lat: -41.63, lon: -153.99, elev: -5.2, mask: 2.0,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 0, maxBlackoutHrs: 9999,
      psrDistKm: 520.0, slopeDeg: 6, feasibility: "FAR SIDE (RELAY ONLY)",
      desc: "Historic far-side lunar sample return mission inside the South Pole-Aitken basin (Apollo crater rim). Touched down June 2024.",
      advisory: "Far side mission: 100% dependent on Queqiao-2 relay satellite. Sun provides standard 14-day daylight window."
    },
    slim: {
      name: "SLIM (Shioli Crater)",
      category: "International Mission (JAXA)",
      lat: -13.315, lon: 25.251, elev: -2.3, mask: 3.5,
      sunlightPct: 50, maxNightHrs: 354, earthLosPct: 100, maxBlackoutHrs: 0,
      psrDistKm: 1100.0, slopeDeg: 15, feasibility: "CRATER SLOPE",
      desc: "JAXA's 'Smart Lander for Investigating Moon' achieved high-precision pinpoint landing within 55 meters on the slope of Shioli crater (Jan 2024).",
      advisory: "Steep crater wall slope (~15°). Solar cells were initially shadowed due to overturned vehicle orientation, but resumed power generation when sun moved western sky."
    },
    custom: {
      name: "Custom Coordinates Site",
      category: "User-Defined Coordinates",
      lat: -89.90, lon: 0.00, elev: 4.2, mask: 1.2,
      sunlightPct: 88, maxNightHrs: 54, earthLosPct: 91, maxBlackoutHrs: 62,
      psrDistKm: 2.0, slopeDeg: 10, feasibility: "EVALUATING",
      desc: "Custom user-selected landing site coordinates. Ephemeris and horizon angles computed dynamically.",
      advisory: "Dynamic calculation active. Adjust coordinates or epoch date to assess power and direct communication feasibility."
    }
  };

  const MISSION_DATA = [
    { id: 11, date: "July 20, 1969", site: "Sea of Tranquility", crew: "Neil A. Armstrong · Michael Collins · Edwin E. Aldrin, Jr.", lander: "Eagle", surfaceHours: 2.53, samplesKg: 21.55, source: "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo11info.html" },
    { id: 12, date: "November 19, 1969", site: "Ocean of Storms", crew: "Charles Conrad, Jr. · Richard F. Gordon, Jr. · Alan L. Bean", lander: "Intrepid", surfaceHours: 7.75, samplesKg: 34.35, source: "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo12info.html" },
    { id: 14, date: "February 5, 1971", site: "Fra Mauro", crew: "Alan B. Shepard, Jr. · Stuart A. Roosa · Edgar D. Mitchell", lander: "Antares", surfaceHours: 9.38, samplesKg: 42.28, source: "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo14info.html" },
    { id: 15, date: "July 30, 1971", site: "Hadley Rille / Apennines", crew: "David R. Scott · Alfred M. Worden · James B. Irwin", lander: "Falcon", surfaceHours: 19.13, samplesKg: 77.31, source: "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo15info.html" },
    { id: 16, date: "April 20, 1972 (EDT; April 21 UT)", site: "Descartes", crew: "John W. Young · Thomas K. Mattingly II · Charles M. Duke, Jr.", lander: "Orion", surfaceHours: 20.23, samplesKg: 95.71, source: "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo16info.html" },
    { id: 17, date: "December 11, 1972", site: "Taurus–Littrow", crew: "Eugene A. Cernan · Ronald E. Evans · Harrison H. Schmitt", lander: "Challenger", surfaceHours: 22.07, samplesKg: 110.52, source: "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo17info.html" }
  ];

  const MISSION_DATE_SITES = {
    "1969-07-20": "apollo11",
    "1969-11-19": "apollo12",
    "1971-02-05": "apollo14",
    "1971-07-30": "apollo15",
    "1972-04-20": "apollo16",
    "1972-04-21": "apollo16",
    "1972-12-11": "apollo17",
    "2019-01-03": "change4",
    "2023-08-23": "chandrayaan3",
    "2024-02-22": "im1_odysseus"
  };

  const GALLERY = [
    { id: "as08-14-2383", title: "Earthrise", alt: "Earth rising above the lunar horizon, photographed by the Apollo 8 crew.", src: "https://images-assets.nasa.gov/image/as08-14-2383/as08-14-2383~large.jpg", caption: "Earth over the lunar horizon, photographed from Apollo 8.", nasa: "https://images-assets.nasa.gov/image/as08-14-2383/collection.json" },
    { id: "6900992", title: "Eagle on descent", alt: "Apollo 11 Lunar Module Eagle descending toward the Moon.", src: "https://images-assets.nasa.gov/image/6900992/6900992~large.jpg", caption: "Apollo 11 Lunar Module Eagle during its descent. NASA image record.", nasa: "https://images-assets.nasa.gov/image/6900992/collection.json" },
    { id: "S69-39563", title: "At the Eagle ladder", alt: "Apollo 11 astronauts Armstrong and Aldrin by the Eagle ladder in a television still.", src: "https://images-assets.nasa.gov/image/S69-39563/S69-39563~large.jpg", caption: "Armstrong and Aldrin by the Eagle ladder, image from the lunar surface television camera.", nasa: "https://images-assets.nasa.gov/image/S69-39563/collection.json" },
    { id: "as11-40-5875", title: "Aldrin at the flag", alt: "Buzz Aldrin beside the deployed United States flag during Apollo 11 EVA.", src: "https://images-assets.nasa.gov/image/as11-40-5875/as11-40-5875~large.jpg", caption: "Aldrin beside the flag; photographed by Armstrong with a 70mm Hasselblad lunar surface camera.", nasa: "https://images-assets.nasa.gov/image/as11-40-5875/collection.json" },
    { id: "as11-40-5902", title: "Lunar module and footprints", alt: "Buzz Aldrin walking near a leg of the Apollo 11 Lunar Module, with bootprints in the foreground.", src: "https://images-assets.nasa.gov/image/as11-40-5902/as11-40-5902~medium.jpg", full: "https://images-assets.nasa.gov/image/as11-40-5902/as11-40-5902~large.jpg", caption: "Aldrin near a Lunar Module leg during the Apollo 11 EVA.", nasa: "https://images-assets.nasa.gov/image/as11-40-5902/collection.json" },
    { id: "as11-40-5880", title: "A lunar footprint", alt: "Close-up of an astronaut's boot and bootprint in lunar soil.", src: "https://images-assets.nasa.gov/image/as11-40-5880/as11-40-5880~large.jpg", caption: "Apollo 11 lunar surface photograph of a bootprint.", nasa: "https://images-assets.nasa.gov/image/as11-40-5880/collection.json" },
    { id: "as12-47-6988", title: "Apollo 12 at Oceanus Procellarum", alt: "Apollo 12 commander Charles Conrad at the Lunar Module during an EVA.", src: "https://images-assets.nasa.gov/image/as12-47-6988/as12-47-6988~medium.jpg", full: "https://images-assets.nasa.gov/image/as12-47-6988/as12-47-6988~large.jpg", caption: "Charles Conrad at the Lunar Module during Apollo 12's first EVA.", nasa: "https://images-assets.nasa.gov/image/as12-47-6988/collection.json" },
    { id: "PIA12909", title: "LRO: Apollo 11 site", alt: "Lunar Reconnaissance Orbiter image of the Apollo 11 landing site.", src: "https://images-assets.nasa.gov/image/PIA12909/PIA12909~orig.jpg", caption: "LRO's second look at the Apollo 11 landing site.", nasa: "https://images-assets.nasa.gov/image/PIA12909/collection.json" }
  ];

  // ==========================================
  // WEB AUDIO SYNTHESIZER
  // ==========================================
  const SoundFX = {
    ctx: null,
    enabled: true,
    engineNode: null,
    engineGain: null,

    init() {
      if (this.ctx) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
      } catch (e) {
        console.warn("Web Audio not supported", e);
      }
    },

    resume() {
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    },

    toggle() {
      this.enabled = !this.enabled;
      if (!this.enabled && this.engineGain) {
        this.engineGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
      }
      return this.enabled;
    },

    click() {
      if (!this.enabled || !this.ctx) return;
      this.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    },

    rcsBurst() {
      if (!this.enabled || !this.ctx) return;
      this.resume();
      const bufferSize = this.ctx.sampleRate * 0.06;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2400;
      filter.Q.value = 1.2;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    },

    contactChime() {
      if (!this.enabled || !this.ctx) return;
      this.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.setValueAtTime(1320, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    },

    updateEngine(throttle) {
      if (!this.enabled || !this.ctx) return;
      if (!this.engineNode) {
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5;
        }
        this.engineNode = this.ctx.createBufferSource();
        this.engineNode.buffer = buffer;
        this.engineNode.loop = true;
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = "lowpass";
        this.engineFilter.frequency.value = 180;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineNode.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineNode.start();
      }
      const t = Math.max(0, Math.min(100, throttle)) / 100;
      const targetGain = t > 0.01 ? 0.03 + t * 0.22 : 0;
      const targetFreq = 120 + t * 340;
      this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
      this.engineFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
    }
  };

  // ==========================================
  // LUNAR EPHEMERIS ENGINE (MATHEMATICAL MODEL)
  // ==========================================
  const Ephemeris = {
    // Julian Day from UTC Date
    toJD(date) {
      const time = date.getTime();
      return time / 86400000 + 2440587.5;
    },

    // Calculates Sub-Solar and Sub-Earth coordinates & local observer azimuth/elevation
    compute(latDeg, lonDeg, date) {
      const jd = this.toJD(date);
      const T = (jd - 2451545.0) / 36525.0; // Julian centuries since J2000
      const d = jd - 2451545.0; // Days since J2000

      // Sun mean longitude and anomaly
      const L_sun = (280.460 + 36000.771 * T) % 360;
      const M_sun = ((357.5291 + 35999.0503 * T) % 360) * Math.PI / 180;
      const lambda_sun = (L_sun + 1.9148 * Math.sin(M_sun) + 0.0200 * Math.sin(2 * M_sun)) % 360;

      // Moon mean longitude and nodes
      const L_moon = (218.316 + 481267.881 * T) % 360;
      const M_moon = ((134.963 + 477198.868 * T) % 360) * Math.PI / 180;
      const Omega = ((125.045 - 1934.136 * T) % 360) * Math.PI / 180;
      const D_moon = ((L_moon - L_sun) % 360) * Math.PI / 180; // elongation

      // Sub-Solar point on Moon (Selenographic)
      // Axial tilt to ecliptic is ~1.5424°
      const dec_sun = -1.5424 * Math.sin((L_moon * Math.PI / 180) - Omega);
      const alpha_sun = (180.0 - (L_moon - L_sun) + 360) % 360;

      // Earth Optical & Physical Libration (Sub-Earth point wobble)
      // Longitude libration ~ +/- 7.9° amplitude (27.55 day anomalistic month)
      const l_lib = -6.29 * Math.sin(M_moon) + 1.27 * Math.sin(2 * D_moon - M_moon) + 0.66 * Math.sin(2 * D_moon);
      // Latitude libration ~ +/- 6.7° amplitude (27.21 day draconic month)
      const b_lib = -5.13 * Math.sin((L_moon * Math.PI / 180) - Omega) - 0.17 * Math.sin((L_moon * Math.PI / 180) - Omega + M_moon);

      const latRad = latDeg * Math.PI / 180;
      const lonRad = lonDeg * Math.PI / 180;

      // Local Sun Elevation and Azimuth
      const H_sun = (lonDeg - alpha_sun) * Math.PI / 180;
      const decSunRad = dec_sun * Math.PI / 180;
      const sinElSun = Math.sin(latRad) * Math.sin(decSunRad) + Math.cos(latRad) * Math.cos(decSunRad) * Math.cos(H_sun);
      const elSunDeg = Math.asin(Math.max(-1, Math.min(1, sinElSun))) * 180 / Math.PI;

      const ySun = -Math.cos(decSunRad) * Math.sin(H_sun);
      const xSun = Math.cos(latRad) * Math.sin(decSunRad) - Math.sin(latRad) * Math.cos(decSunRad) * Math.cos(H_sun);
      let azSunDeg = (Math.atan2(ySun, xSun) * 180 / Math.PI + 360) % 360;

      // Local Earth Elevation and Azimuth
      const decEarthRad = b_lib * Math.PI / 180;
      const H_earth = (lonDeg - (-l_lib)) * Math.PI / 180;
      const sinElEarth = Math.sin(latRad) * Math.sin(decEarthRad) + Math.cos(latRad) * Math.cos(decEarthRad) * Math.cos(H_earth);
      const elEarthDeg = Math.asin(Math.max(-1, Math.min(1, sinElEarth))) * 180 / Math.PI;

      const yEarth = -Math.cos(decEarthRad) * Math.sin(H_earth);
      const xEarth = Math.cos(latRad) * Math.sin(decEarthRad) - Math.sin(latRad) * Math.cos(decEarthRad) * Math.cos(H_earth);
      let azEarthDeg = (Math.atan2(yEarth, xEarth) * 180 / Math.PI + 360) % 360;

      return {
        sun: { el: elSunDeg, az: azSunDeg, dec: dec_sun, ra: alpha_sun },
        earth: { el: elEarthDeg, az: azEarthDeg, libLat: b_lib, libLon: l_lib },
        date
      };
    },

    // Search future hours for next sunrise/sunset or earthrise/earthset
    findNextTransition(lat, lon, startDate, mask, isSun) {
      const current = this.compute(lat, lon, startDate);
      const currentVal = isSun ? current.sun.el : current.earth.el;
      const targetState = currentVal > mask; // currently up or down
      let testDate = new Date(startDate.getTime());
      const maxHours = 720; // 30 days
      for (let h = 1; h <= maxHours; h++) {
        testDate = new Date(startDate.getTime() + h * 3600 * 1000);
        const res = this.compute(lat, lon, testDate);
        const val = isSun ? res.sun.el : res.earth.el;
        if ((val > mask) !== targetState) {
          return { hours: h, sets: targetState };
        }
      }
      return { hours: maxHours, sets: targetState, continuous: true };
    }
  };

  // ==========================================
  // DESCENT FLIGHT SIMULATOR (THREE.JS R128)
  // ==========================================
  const simCanvas = $("c");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060a);
  const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 9000);
  const renderer = new THREE.WebGLRenderer({ canvas: simCanvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  let state;
  let difficulty = "normal";
  let mode = "ready";
  let phase = "braking";
  let frameAccumulator = 0;
  let previousFrameTime = performance.now();
  let latestTrace = [];
  let replaySnapshots = [];
  let lastReport = null;
  let replayIndex = 0;
  let actualThrottle = 0;
  let settings = { keyMap: { ...DEFAULT_KEYS }, camera: "chase" };
  let captureAction = null;
  let orbit = { yaw: 0.7, pitch: 0.28, distance: 46, dragging: false, lastX: 0, lastY: 0 };
  const keys = new Set();
  const controls = { throttle: 0, lateral: 0, pitch: 0, roll: 0, boost: false, fine: false };
  let throttleRampRemainder = 0;
  let hoverTarget = null;
  let world;

  // Simulator site lighting environment
  let simLightingMode = "south-pole";
  let sunLight, hemiLight;

  function createWorld() {
    // Starfield
    const starCount = 1800;
    const stars = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 4200 + Math.random() * 2500;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      stars[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      stars[i * 3 + 1] = r * Math.cos(phi);
      stars[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false })));

    // Earth in the sky
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(95, 48, 32),
      new THREE.MeshStandardMaterial({
        color: 0x2a6ab8,
        roughness: 0.75,
        metalness: 0.1,
        emissive: 0x06152a
      })
    );
    earth.position.set(320, 180, -1950);
    scene.add(earth);

    // Directional Lunar Sun & Ambient Lighting
    sunLight = new THREE.DirectionalLight(0xfff7e8, 2.2);
    sunLight.position.set(1000, 26, 400); // Grazing south pole default
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 2500;
    const d = 160;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    hemiLight = new THREE.HemisphereLight(0x182436, 0x06080d, 0.45);
    scene.add(hemiLight);

    // Lunar Ground Terrain
    const groundGeometry = new THREE.PlaneGeometry(1600, 1600, 120, 120);
    groundGeometry.rotateX(-Math.PI / 2);
    const groundPositions = groundGeometry.attributes.position;
    for (let i = 0; i < groundPositions.count; i++) {
      groundPositions.setY(i, terrainHeight(groundPositions.getX(i), groundPositions.getZ(i), 1));
    }
    groundGeometry.computeVertexNormals();
    const groundMesh = new THREE.Mesh(
      groundGeometry,
      new THREE.MeshStandardMaterial({ color: 0x6e7178, roughness: 0.95, metalness: 0.05 })
    );
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Target Landing Pad with illuminated perimeter
    const pad = new THREE.Group();
    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(5.8, 6.4, 48),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.y = 0.05;
    pad.add(padRing);

    const padCenter = new THREE.Mesh(
      new THREE.CircleGeometry(5.8, 36),
      new THREE.MeshStandardMaterial({ color: 0x222832, roughness: 0.8 })
    );
    padCenter.rotation.x = -Math.PI / 2;
    padCenter.position.y = 0.02;
    padCenter.receiveShadow = true;
    pad.add(padCenter);
    scene.add(pad);

    // ==========================================
    // COMPLEX REALISTIC LUNAR LANDER ROCKET
    // ==========================================
    const lander = new THREE.Group();
    lander.name = "lander";

    // High-tech materials
    const goldKapton = new THREE.MeshStandardMaterial({
      color: 0xdfa030,
      metalness: 0.85,
      roughness: 0.32
    });
    const silverMylar = new THREE.MeshStandardMaterial({
      color: 0xd4dce4,
      metalness: 0.88,
      roughness: 0.25
    });
    const darkComposite = new THREE.MeshStandardMaterial({
      color: 0x23272e,
      metalness: 0.4,
      roughness: 0.7
    });
    const titaniumEngine = new THREE.MeshStandardMaterial({
      color: 0x3d414a,
      metalness: 0.92,
      roughness: 0.35
    });
    const chromeStrut = new THREE.MeshStandardMaterial({
      color: 0xe8edf2,
      metalness: 0.95,
      roughness: 0.15
    });
    const cockpitGlass = new THREE.MeshPhysicalMaterial({
      color: 0x0f2b3c,
      roughness: 0.1,
      metalness: 0.9,
      transmission: 0.4,
      transparent: true,
      opacity: 0.9
    });
    const rocketWhite = new THREE.MeshStandardMaterial({
      color: 0xf0f2f5,
      metalness: 0.2,
      roughness: 0.42
    });
    const rocketRed = new THREE.MeshStandardMaterial({
      color: 0xc83232,
      metalness: 0.18,
      roughness: 0.48
    });

    // 1. STREAMLINED OCTAGONAL DESCENT STAGE
    const descentCore = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.72, 2.2, 12), silverMylar);
    descentCore.position.y = 2.4;
    descentCore.castShadow = true;
    descentCore.receiveShadow = true;
    lander.add(descentCore);

    const engineSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(1.48, 1.78, 0.9, 16),
      darkComposite
    );
    engineSkirt.position.y = 1.05;
    engineSkirt.castShadow = true;
    lander.add(engineSkirt);

    [1.52, 3.5].forEach((height, index) => {
      const reinforcementRing = new THREE.Mesh(
        new THREE.TorusGeometry(index === 0 ? 1.72 : 2.54, 0.11, 12, 48),
        titaniumEngine
      );
      reinforcementRing.position.y = height;
      reinforcementRing.rotation.x = Math.PI / 2;
      lander.add(reinforcementRing);
    });

    // Light armor panels and warm service markings on four sides.
    for (let f = 0; f < 4; f++) {
      const angle = (f * Math.PI) / 2 + Math.PI / 8;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.55, 0.09), goldKapton);
      panel.position.set(Math.cos(angle) * 2.32, 2.4, Math.sin(angle) * 2.32);
      panel.rotation.y = -angle + Math.PI / 2;
      lander.add(panel);
    }

    // 2. EXTERNAL CYLINDRICAL PROPELLANT TANKS
    const tankGeo = new THREE.CylinderGeometry(0.55, 0.68, 1.9, 16);
    const tankAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
    tankAngles.forEach((ang) => {
      const tank = new THREE.Mesh(tankGeo, silverMylar);
      tank.position.set(Math.cos(ang) * 2.4, 2.4, Math.sin(ang) * 2.4);
      tank.castShadow = true;
      lander.add(tank);

      [-0.62, 0.62].forEach((offset) => {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 8, 24), darkComposite);
        band.position.set(tank.position.x, tank.position.y + offset, tank.position.z);
        band.rotation.x = Math.PI / 2;
        lander.add(band);
      });
    });

    // 3. MAIN DESCENT ROCKET ENGINE BELL (Realistic Contoured de Laval Nozzle)
    const engineBell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 1.25, 1.6, 24, 1, true),
      titaniumEngine
    );
    engineBell.position.y = 0.8;
    engineBell.castShadow = true;
    lander.add(engineBell);

    // Gimbal actuator ring
    const gimbalRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 24), darkComposite);
    gimbalRing.position.y = 1.5;
    gimbalRing.rotation.x = Math.PI / 2;
    lander.add(gimbalRing);

    // Engine throat glow
    const engineThroatGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd066, side: THREE.DoubleSide })
    );
    engineThroatGlow.rotation.x = Math.PI / 2;
    engineThroatGlow.position.y = 1.45;
    lander.add(engineThroatGlow);

    // 4. ARTICULATED 4-LEG LANDING GEAR WITH CONTACT PROBES
    const legPoints = [];
    const rcsQuads = [];

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const c = Math.cos(angle), s = Math.sin(angle);

      // Outrigger mount
      const topMount = new THREE.Vector3(c * 2.3, 2.5, s * 2.3);
      const foot = new THREE.Vector3(c * 4.6, 0.12, s * 4.6);
      legPoints.push(foot);

      // Primary telescoping shock strut (Upper gold, lower chrome)
      const midStrut = topMount.clone().lerp(foot, 0.55);
      addStrut(lander, topMount, midStrut, 0.14, goldKapton);
      addStrut(lander, midStrut, foot, 0.10, chromeStrut);

      // Secondary A-frame triangulation braces
      const leftHinge = new THREE.Vector3(Math.cos(angle - 0.35) * 2.1, 1.5, Math.sin(angle - 0.35) * 2.1);
      const rightHinge = new THREE.Vector3(Math.cos(angle + 0.35) * 2.1, 1.5, Math.sin(angle + 0.35) * 2.1);
      addStrut(lander, leftHinge, midStrut, 0.06, darkComposite);
      addStrut(lander, rightHinge, midStrut, 0.06, darkComposite);

      // Articulated circular dish footpad
      const footpad = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.72, 0.15, 16), darkComposite);
      footpad.position.copy(foot);
      lander.add(footpad);

      // Surface contact sensing probe extending downwards (1.4m probe)
      const probeTip = new THREE.Vector3(foot.x, -0.4, foot.z);
      addStrut(lander, foot, probeTip, 0.02, chromeStrut);

      // Egress ladder on forward leg (i === 0)
      if (i === 0) {
        for (let r = 0; r < 8; r++) {
          const stepPos = topMount.clone().lerp(foot, 0.18 + r * 0.09);
          const rung = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.04), chromeStrut);
          rung.position.copy(stepPos);
          rung.rotation.y = -angle;
          lander.add(rung);
        }
      }
    }
    lander.userData.legPoints = legPoints;

    // 5. ASCENT STAGE (Crew Cabin, Windows, Docking Tunnel)
    const cabinGroup = new THREE.Group();
    cabinGroup.position.y = 8;

    // Extended fuselage gives the lander a distinct heavy-rocket silhouette.
    const cabinHull = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.92, 8, 20), rocketWhite);
    cabinHull.castShadow = true;
    cabinHull.receiveShadow = true;
    cabinGroup.add(cabinHull);

    const noseCone = new THREE.Mesh(new THREE.ConeGeometry(1.72, 3, 20), rocketWhite);
    noseCone.position.y = 5.5;
    noseCone.castShadow = true;
    cabinGroup.add(noseCone);

    [ -1.65, 0.65, 1.95 ].forEach((height) => {
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.84, 0.075, 10, 48), rocketRed);
      band.position.y = height;
      band.rotation.x = Math.PI / 2;
      cabinGroup.add(band);
    });

    for (let fin = 0; fin < 4; fin++) {
      const finGroup = new THREE.Group();
      finGroup.rotation.y = fin * Math.PI / 2;
      finGroup.position.y = -1.55;

      const finPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.45, 1.0), rocketWhite);
      finPanel.position.set(1.83, -0.25, 0);
      finPanel.rotation.z = -0.18;
      finPanel.castShadow = true;
      finGroup.add(finPanel);

      const finTip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 1.04), rocketRed);
      finTip.position.set(1.98, -0.82, 0);
      finTip.rotation.z = -0.18;
      finGroup.add(finTip);
      cabinGroup.add(finGroup);
    }

    const logoCanvas = document.createElement("canvas");
    logoCanvas.width = 512;
    logoCanvas.height = 512;
    const logoContext = logoCanvas.getContext("2d");
    logoContext.beginPath();
    logoContext.arc(256, 256, 248, 0, Math.PI * 2);
    logoContext.fillStyle = "#0b3d91";
    logoContext.fill();
    logoContext.save();
    logoContext.beginPath();
    logoContext.arc(256, 256, 244, 0, Math.PI * 2);
    logoContext.clip();
    logoContext.fillStyle = "#fff";
    [
      [125, 115, 8], [365, 105, 7], [410, 190, 6], [112, 355, 7],
      [382, 390, 8], [205, 410, 5], [305, 125, 5], [85, 235, 5]
    ].forEach(([x, y, radius]) => {
      logoContext.beginPath();
      logoContext.arc(x, y, radius, 0, Math.PI * 2);
      logoContext.fill();
    });
    logoContext.fillStyle = "#fff";
    logoContext.font = "900 126px Arial, sans-serif";
    logoContext.textAlign = "center";
    logoContext.textBaseline = "middle";
    logoContext.fillText("NASA", 256, 262);
    logoContext.beginPath();
    logoContext.moveTo(48, 340);
    logoContext.bezierCurveTo(170, 400, 310, 338, 458, 153);
    logoContext.lineTo(441, 212);
    logoContext.bezierCurveTo(325, 387, 164, 430, 48, 340);
    logoContext.fillStyle = "#e03a3e";
    logoContext.fill();
    logoContext.restore();
    logoContext.beginPath();
    logoContext.arc(256, 256, 248, 0, Math.PI * 2);
    logoContext.strokeStyle = "#e7edf7";
    logoContext.lineWidth = 12;
    logoContext.stroke();

    const logoTexture = new THREE.CanvasTexture(logoCanvas);
    logoTexture.encoding = THREE.sRGBEncoding;
    logoTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const nasaInsignia = new THREE.Mesh(
      new THREE.CircleGeometry(0.68, 64),
      new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true, side: THREE.DoubleSide })
    );
    nasaInsignia.position.set(0, -0.55, 1.94);
    cabinGroup.add(nasaInsignia);

    const insigniaRim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.045, 10, 64), silverMylar);
    insigniaRim.position.copy(nasaInsignia.position);
    cabinGroup.add(insigniaRim);

    // Front crew cockpit face with triangular windows
    const windowMat = cockpitGlass;
    const winGeo = new THREE.BufferGeometry();
    const winVertices = new Float32Array([
      -0.7, 0.5, 1.85,
      -0.1, 0.5, 1.85,
      -0.15, 0.05, 1.95,

      0.1, 0.5, 1.85,
      0.7, 0.5, 1.85,
      0.15, 0.05, 1.95
    ]);
    winGeo.setAttribute("position", new THREE.BufferAttribute(winVertices, 3));
    winGeo.computeVertexNormals();
    const winLeft = new THREE.Mesh(winGeo, windowMat);
    cabinGroup.add(winLeft);

    // Forward EVA ingress/egress hatch
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 16), silverMylar);
    hatch.rotation.x = Math.PI / 2;
    hatch.position.set(0, -0.35, 1.88);
    cabinGroup.add(hatch);

    // Top docking tunnel
    const dockingTunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.55, 16), silverMylar);
    dockingTunnel.rotation.z = Math.PI / 2;
    dockingTunnel.position.set(1.82, 1.25, -0.25);
    cabinGroup.add(dockingTunnel);

    // Rendezvous radar dish antenna
    const radarDish = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), titaniumEngine);
    radarDish.position.set(-0.9, 1.25, 0.7);
    radarDish.rotation.x = -Math.PI / 3;
    radarDish.rotation.z = Math.PI / 6;
    cabinGroup.add(radarDish);

    // Steerable High-Gain S-Band dish antenna (pointing towards Earth)
    const steerableDish = new THREE.Mesh(new THREE.SphereGeometry(0.65, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), silverMylar);
    steerableDish.position.set(1.4, 0.9, -0.8);
    steerableDish.rotation.x = -Math.PI / 4;
    steerableDish.rotation.y = -Math.PI / 3;
    cabinGroup.add(steerableDish);

    // 4 RCS Thruster Quads on Outrigger Truss Pylons
    for (let q = 0; q < 4; q++) {
      const qAng = (q * Math.PI) / 2;
      const qCos = Math.cos(qAng), qSin = Math.sin(qAng);

      const rcsOutrigger = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.75), darkComposite);
      rcsOutrigger.position.set(qCos * 2.1, 0.2, qSin * 2.1);
      rcsOutrigger.rotation.y = -qAng;
      cabinGroup.add(rcsOutrigger);

      const rcsCluster = new THREE.Group();
      rcsCluster.position.set(qCos * 2.5, 0.2, qSin * 2.5);

      // 4 tiny thruster bells facing N, S, E, W
      for (let t = 0; t < 4; t++) {
        const bell = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), titaniumEngine);
        if (t === 0) { bell.position.y = 0.12; }
        if (t === 1) { bell.position.y = -0.12; bell.rotation.x = Math.PI; }
        if (t === 2) { bell.position.x = 0.12; bell.rotation.z = -Math.PI / 2; }
        if (t === 3) { bell.position.x = -0.12; bell.rotation.z = Math.PI / 2; }
        rcsCluster.add(bell);
      }
      cabinGroup.add(rcsCluster);
      rcsQuads.push(rcsCluster);
    }

    lander.add(cabinGroup);
    lander.userData.rcsQuads = rcsQuads;

    // 6. REALISTIC DUAL-STAGE ROCKET PLUME FX
    const flameGroup = new THREE.Group();
    flameGroup.position.y = 0.1;

    // Supersonic diamond core (bright incandescent core)
    const coreFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 4.2, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
    );
    coreFlame.rotation.x = Math.PI;
    coreFlame.position.y = -1.9;
    flameGroup.add(coreFlame);

    // Expanding vacuum outer plume envelope
    const outerPlume = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 6.8, 18),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending })
    );
    outerPlume.rotation.x = Math.PI;
    outerPlume.position.y = -3.2;
    flameGroup.add(outerPlume);

    flameGroup.visible = false;
    lander.add(flameGroup);
    lander.userData.flame = flameGroup;
    lander.userData.coreFlame = coreFlame;
    lander.userData.outerPlume = outerPlume;

    lander.scale.set(0.78, 1, 0.78);
    scene.add(lander);

    // 7. SWIRLING SURFACE REGOLITH DUST PARTICLES
    const dustCount = 140;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({
        color: 0xc8c3b4,
        size: 0.55,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    dust.visible = false;
    scene.add(dust);
    dust.userData.positions = dustPositions;
    dust.userData.geometry = dustGeometry;

    window.addEventListener("resize", resizeRenderer);
    resizeRenderer();
    return { lander, groundGeometry, earth, dust, pad, sunLight };
  }

  function addStrut(group, start, end, radius, material) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), material);
    cylinder.position.copy(start).addScaledVector(direction, 0.5);
    cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    cylinder.castShadow = true;
    group.add(cylinder);
    return cylinder;
  }

  function terrainHeight(x, z, roughness) {
    const padDistance = Math.hypot(x, z);
    const padFade = Math.min(1, Math.max(0, (padDistance - 10) / 36));
    const wave = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 5
      + Math.sin(x * 0.06 + 1.2) * Math.sin(z * 0.05 + 0.4) * 2.2;
    return wave * roughness * padFade;
  }

  function resizeRenderer() {
    const width = simCanvas.clientWidth;
    const height = simCanvas.clientHeight;
    if (simCanvas.width !== width || simCanvas.height !== height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  function configFor(level) {
    return DIFFICULTIES[level] || DIFFICULTIES.normal;
  }

  function updateSimulatorLighting(siteLighting) {
    simLightingMode = siteLighting;
    if (!sunLight) return;
    if (siteLighting === "south-pole") {
      // 1.5° Grazing South Pole Sun
      sunLight.position.set(1000, 26, 400);
      sunLight.color.setHex(0xffedd5);
      hemiLight.color.setHex(0x101a28);
      hemiLight.groundColor.setHex(0x020406);
      $("hud-env-status").textContent = "Grazing 1.8° · Active DTE";
    } else {
      // Apollo 11 High Equatorial Sun (~65° elevation)
      sunLight.position.set(400, 950, 300);
      sunLight.color.setHex(0xffffff);
      hemiLight.color.setHex(0x283648);
      hemiLight.groundColor.setHex(0x0a0f16);
      $("hud-env-status").textContent = "High Sun 68° · Constant DTE";
    }
  }

  function startFlight() {
    SoundFX.click();
    difficulty = $("difficulty").value;
    updateSimulatorLighting($("sim-site-lighting").value);
    const cfg = configFor(difficulty);
    state = {
      y: cfg.altitude,
      verticalSpeed: cfg.initialVerticalSpeed ?? cfg.initialVy ?? -15,
      x: 0, z: 0,
      vx: 0, vz: 0,
      pitch: 0, roll: 0,
      fuelKg: VEHICLE.fuelCapacity * cfg.fuelFraction,
      contacts: [false, false, false, false],
      elapsed: 0,
      landed: false
    };
    latestTrace = [];
    replaySnapshots = [];
    actualThrottle = 0;
    throttleRampRemainder = 0;
    hoverTarget = null;
    $("phase-name").textContent = "BRAKING";
    $("phase-badge").textContent = "NOMINAL";
    $("phase-badge").style.background = "rgba(16, 185, 129, 0.15)";
    $("phase-badge").style.color = "#10b981";
    $("phase-help").textContent = PHASES.braking[1];
    setPhase("braking");
    $("ov").hidden = true;
    if ($("report-dialog").open) $("report-dialog").close();
    mode = "running";
    previousFrameTime = performance.now();
  }

  function setPhase(nextPhase) {
    phase = nextPhase;
    const [name, help] = PHASES[nextPhase] || PHASES.braking;
    $("phase-name").textContent = name;
    $("phase-help").textContent = help;
  }

  function desiredThrottle(cfg) {
    if (controls.boost) return 100;
    const keyboardThrust = keys.has(settings.keyMap.thrust) || keys.has("Space");
    if (keyboardThrust) {
      throttleRampRemainder += (keys.has(settings.keyMap.fine) ? 9 : 45) * FIXED_DT;
      const increase = Math.floor(throttleRampRemainder);
      if (increase > 0) {
        throttleRampRemainder -= increase;
        setThrottle(controls.throttle + increase);
      }
      hoverTarget = null;
      return controls.throttle;
    }
    throttleRampRemainder = 0;
    if ($("hover-assist").checked) {
      if (hoverTarget === null) hoverTarget = altitude();
      const error = hoverTarget - altitude();
      const targetSpeed = clamp(error * 0.7, -4.5, 4.5);
      const speedError = targetSpeed - state.verticalSpeed;
      const totalMass = VEHICLE.dryMass + state.fuelKg;
      const hoverThrust = (totalMass * cfg.gravity) / (VEHICLE.initialAcceleration * VEHICLE.dryMass);
      return clamp(Math.round((hoverThrust + speedError * 0.28) * 100), 0, 100);
    }
    if ($("rate-assist").checked) {
      hoverTarget = null;
      const targetSpeed = -1.5;
      const speedError = targetSpeed - state.verticalSpeed;
      const totalMass = VEHICLE.dryMass + state.fuelKg;
      const hoverThrust = (totalMass * cfg.gravity) / (VEHICLE.initialAcceleration * VEHICLE.dryMass);
      return clamp(Math.round((hoverThrust + speedError * 0.35) * 100), 0, 100);
    }
    hoverTarget = null;
    return controls.throttle;
  }

  function physicsStep(input, cfg) {
    const totalMass = VEHICLE.dryMass + state.fuelKg;
    const maxThrust = VEHICLE.initialAcceleration * VEHICLE.dryMass;
    const currentThrust = state.fuelKg > 0 ? (input.throttle / 100) * maxThrust : 0;
    const attitudeRate = (input.fine ? 0.5 : 1) * Math.PI / 180 * ATTITUDE_RATE_DEG_PER_SEC;
    state.pitch = clamp(
      state.pitch + input.pitch / 100 * attitudeRate * FIXED_DT,
      -ATTITUDE_LIMIT_RAD,
      ATTITUDE_LIMIT_RAD
    );
    state.roll = clamp(
      state.roll + input.roll / 100 * attitudeRate * FIXED_DT,
      -ATTITUDE_LIMIT_RAD,
      ATTITUDE_LIMIT_RAD
    );
    if (input.pitch === 0) state.pitch *= ATTITUDE_STABILIZATION;
    if (input.roll === 0) state.roll *= ATTITUDE_STABILIZATION;

    const cosP = Math.cos(state.pitch);
    const cosR = Math.cos(state.roll);
    const aThrustY = (currentThrust / totalMass) * cosP * cosR;
    const aNetY = aThrustY - cfg.gravity;

    state.verticalSpeed += aNetY * FIXED_DT;
    state.y += state.verticalSpeed * FIXED_DT;

    // Lateral drift dynamics
    const lateralScale = input.fine ? LATERAL_FINE_SCALE : 1;
    const aLatX = (currentThrust / totalMass) * Math.sin(state.pitch)
      + (input.lateral / 100) * LATERAL_ACCELERATION * lateralScale;
    const aLatZ = (currentThrust / totalMass) * Math.sin(state.roll);
    state.vx += aLatX * FIXED_DT;
    state.vz += aLatZ * FIXED_DT;
    const driftRetention = Math.exp(-HORIZONTAL_DRIFT_DAMPING_PER_SEC * FIXED_DT);
    state.vx *= driftRetention;
    state.vz *= driftRetention;
    state.x += state.vx * FIXED_DT;
    state.z += state.vz * FIXED_DT;

    if (currentThrust > 0 && state.fuelKg > 0) {
      const dm = (currentThrust / VEHICLE.exhaustVelocity) * FIXED_DT;
      state.fuelKg = Math.max(0, state.fuelKg - dm);
    }
    state.elapsed += FIXED_DT;
  }

  function getControlFrame(cfg) {
    readGamepad();
    const activeThrottle = desiredThrottle(cfg);
    actualThrottle = activeThrottle;
    let lateral = controls.lateral;
    let pitch = controls.pitch;
    let roll = controls.roll;

    if (keys.has(settings.keyMap.lateralLeft)) lateral -= 100;
    if (keys.has(settings.keyMap.lateralRight)) lateral += 100;
    if (keys.has(settings.keyMap.pitchUp)) pitch -= 100;
    if (keys.has(settings.keyMap.pitchDown)) pitch += 100;
    if (keys.has(settings.keyMap.rollLeft)) roll -= 100;
    if (keys.has(settings.keyMap.rollRight)) roll += 100;

    const fine = keys.has(settings.keyMap.fine) || controls.fine;
    const input = {
      throttle: activeThrottle,
      lateral: clamp(lateral, -100, 100),
      pitch: clamp(pitch, -100, 100),
      roll: clamp(roll, -100, 100),
      fine
    };

    if (input.pitch !== 0 || input.roll !== 0 || input.lateral !== 0) {
      if (Math.random() < 0.25) SoundFX.rcsBurst();
    }
    SoundFX.updateEngine(activeThrottle);
    return input;
  }

  function readGamepad() {
    const pad = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (!pad) return;
    const rx = Math.abs(pad.axes[2] || 0) > 0.15 ? pad.axes[2] : 0;
    const ly = Math.abs(pad.axes[1] || 0) > 0.15 ? pad.axes[1] : 0;
    const lx = Math.abs(pad.axes[0] || 0) > 0.15 ? pad.axes[0] : 0;
    controls.lateral = Math.round(rx * 100);
    controls.pitch = Math.round(ly * 100);
    controls.roll = Math.round(lx * 100);
    const rt = pad.buttons[7] ? pad.buttons[7].value : 0;
    const lt = pad.buttons[6] ? pad.buttons[6].value : 0;
    if (rt > 0.1) controls.throttle = Math.min(100, Math.round(rt * 100));
    else if (lt > 0.1) controls.throttle = Math.max(0, controls.throttle - Math.round(lt * 2));
  }

  function advanceFlight() {
    const cfg = configFor(difficulty);
    const input = getControlFrame(cfg);
    latestTrace.push([input.throttle, input.lateral, input.pitch, input.roll, input.fine ? 1 : 0]);
    physicsStep(input, cfg);

    // Save snapshot for replay
    replaySnapshots.push({
      x: state.x, y: state.y, z: state.z,
      pitch: state.pitch, roll: state.roll,
      verticalSpeed: state.verticalSpeed,
      throttle: input.throttle,
      fuelKg: state.fuelKg
    });

    // Check touchdown against landing gear footpads
    const groundY = terrainHeight(state.x, state.z, cfg.terrain);
    let anyContact = false;
    world.lander.userData.legPoints.forEach((foot, idx) => {
      const legWorldY = state.y + foot.y;
      const isContact = legWorldY <= groundY + 0.18;
      if (isContact && !state.contacts[idx]) {
        state.contacts[idx] = true;
        SoundFX.contactChime();
      }
      if (isContact) anyContact = true;
    });

    if (state.y <= groundY + 0.12 || anyContact || latestTrace.length >= MAX_FRAMES) {
      state.y = groundY + 0.05;
      finishFlight();
      return;
    }

    updatePhase();
    updateHUD();
  }

  function updatePhase() {
    const alt = altitude();
    if (alt > 160) setPhase("braking");
    else if (alt > 40) setPhase("approach");
    else if (alt > 0) setPhase("final");
  }

  function altitude() {
    const cfg = configFor(difficulty);
    return Math.max(0, state.y - terrainHeight(state.x, state.z, cfg.terrain));
  }

  function getMetrics() {
    const cfg = configFor(difficulty);
    const vs = Math.abs(state.verticalSpeed);
    const hs = Math.hypot(state.vx, state.vz);
    const tilt = Math.hypot(state.pitch, state.roll) * 180 / Math.PI;
    const fuelPct = (state.fuelKg / (VEHICLE.fuelCapacity * cfg.fuelFraction)) * 100;
    const padDist = Math.hypot(state.x, state.z);
    const safe = vs <= SAFE_VERTICAL_SPEED && hs <= SAFE_HORIZONTAL_SPEED && tilt <= SAFE_TILT_DEG;
    let score = 0;
    if (safe) {
      score = Math.round(1000 + fuelPct * 12 + Math.max(0, 300 - padDist * 18) - vs * 60 - hs * 50 - tilt * 25);
    }
    return { vs, hs, tilt, fuelPct, padDist, safe, score };
  }

  function finishFlight() {
    mode = "finished";
    setPhase("touchdown");
    SoundFX.updateEngine(0);
    const report = getMetrics();
    lastReport = report;
    $("replay").disabled = false;
    showReport(report);
  }

  function showReport(rep) {
    $("report-title").textContent = rep.safe ? "Safe Lunar Touchdown" : "Touchdown Exceeded Safe Limits";
    $("report-title").style.color = rep.safe ? "var(--green)" : "var(--red)";
    $("report-verdict").textContent = rep.safe
      ? "Lander structure intact. Probes deployed softly on regolith."
      : "Velocity or tilt limits exceeded. Descent module sustained structural damage.";
    $("report-vertical").textContent = `${rep.vs.toFixed(2)} m/s (Limit: 2.5 m/s)`;
    $("report-horizontal").textContent = `${rep.hs.toFixed(2)} m/s (Limit: 1.5 m/s)`;
    $("report-tilt").textContent = `${rep.tilt.toFixed(1)}° (Limit: 10.0°)`;
    $("report-fuel").textContent = `${rep.fuelPct.toFixed(1)}% remaining`;
    $("report-distance").textContent = `${rep.padDist.toFixed(1)} m to pad center`;
    $("report-score").textContent = rep.safe ? `${rep.score} pts` : "0 (Failed landing)";
    $("report-save").disabled = !rep.safe;
    $("report-status").textContent = rep.safe ? "Ready to submit to official verified flight log." : "Land safely to record score.";
    $("report-dialog").showModal();
  }

  function updateHUD() {
    $("alt").textContent = `${altitude().toFixed(1)} m`;
    const vsEl = $("vs");
    vsEl.textContent = `${state.verticalSpeed.toFixed(2)} m/s`;
    vsEl.className = Math.abs(state.verticalSpeed) <= SAFE_VERTICAL_SPEED ? "safe" : "fast";
    $("hs").textContent = `${Math.hypot(state.vx, state.vz).toFixed(2)} m/s`;
    const pDeg = (state.pitch * 180 / Math.PI).toFixed(0);
    const rDeg = (state.roll * 180 / Math.PI).toFixed(0);
    $("attitude").textContent = `${pDeg}° / ${rDeg}°`;
    const cfg = configFor(difficulty);
    const fuelPct = ((state.fuelKg / (VEHICLE.fuelCapacity * cfg.fuelFraction)) * 100);
    $("fuel-mass").textContent = `${fuelPct.toFixed(0)}% / ${(VEHICLE.dryMass + state.fuelKg).toFixed(0)} kg`;
    $("fb").style.width = `${Math.max(0, Math.min(100, fuelPct))}%`;

    // Contact lights
    state.contacts.forEach((active, i) => {
      const lamp = document.querySelector(`[data-leg="${i + 1}"]`);
      if (lamp) lamp.className = active ? "active" : "";
    });
  }

  function updateWorld() {
    if (!world || !state) return;
    world.lander.position.set(state.x, state.y, state.z);
    world.lander.rotation.set(state.pitch, 0, state.roll);

    // Update flame
    const flame = world.lander.userData.flame;
    if (flame) {
      if (actualThrottle > 1 && state.fuelKg > 0 && mode === "running") {
        flame.visible = true;
        const scale = (actualThrottle / 100) * (0.8 + Math.random() * 0.4);
        world.lander.userData.coreFlame.scale.set(1, scale, 1);
        world.lander.userData.outerPlume.scale.set(1 + scale * 0.3, scale, 1 + scale * 0.3);
      } else {
        flame.visible = false;
      }
    }

    // Regolith dust vortex near ground
    const alt = altitude();
    const dust = world.dust;
    if (dust) {
      if (alt < 26 && actualThrottle > 5 && mode === "running") {
        dust.visible = true;
        const positions = dust.userData.positions;
        const count = positions.length / 3;
        for (let i = 0; i < count; i++) {
          const r = 1.2 + Math.random() * (26 - alt) * 0.55;
          const theta = Math.random() * Math.PI * 2;
          positions[i * 3] = state.x + Math.cos(theta) * r;
          positions[i * 3 + 1] = terrainHeight(state.x, state.z, 1) + Math.random() * 1.8;
          positions[i * 3 + 2] = state.z + Math.sin(theta) * r;
        }
        dust.userData.geometry.attributes.position.needsUpdate = true;
      } else {
        dust.visible = false;
      }
    }

    updateCamera();
  }

  function updateCamera() {
    const camMode = settings.camera;
    if (camMode === "cockpit") {
      camera.position.set(state.x, state.y + 4.8, state.z + 1.2);
      camera.lookAt(state.x, state.y - 10, state.z);
    } else if (camMode === "top") {
      camera.position.set(state.x, state.y + 120, state.z);
      camera.lookAt(state.x, state.y, state.z);
    } else if (camMode === "cinematic") {
      camera.position.set(24, 6, 24);
      camera.lookAt(state.x, state.y + 2, state.z);
    } else {
      // Chase Camera with interactive Orbit
      const cx = state.x + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance;
      const cy = state.y + Math.sin(orbit.pitch) * orbit.distance + 4;
      const cz = state.z + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance;
      camera.position.set(cx, cy, cz);
      camera.lookAt(state.x - 6, state.y + 7.5, state.z);
    }
  }

  function renderReplayFrame() {
    if (replayIndex >= replaySnapshots.length) {
      mode = "finished";
      $("replay").disabled = false;
      return;
    }
    const snap = replaySnapshots[replayIndex++];
    state.x = snap.x;
    state.y = snap.y;
    state.z = snap.z;
    state.pitch = snap.pitch;
    state.roll = snap.roll;
    state.verticalSpeed = snap.verticalSpeed;
    state.fuelKg = snap.fuelKg;
    actualThrottle = snap.throttle;
    updateHUD();
  }

  function startReplay() {
    if (!replaySnapshots.length) return;
    SoundFX.click();
    replayIndex = 0;
    mode = "replay";
    if ($("report-dialog").open) $("report-dialog").close();
  }

  function togglePause() {
    if (mode === "running") {
      mode = "paused";
      $("pause").textContent = "Resume P";
      $("pause").setAttribute("aria-pressed", "true");
      setPhase("paused");
      SoundFX.updateEngine(0);
    } else if (mode === "paused") {
      mode = "running";
      $("pause").textContent = "Pause P";
      $("pause").setAttribute("aria-pressed", "false");
      updatePhase();
    }
  }

  function setThrottle(val) {
    controls.throttle = clamp(val, 0, 100);
    $("throttle").value = controls.throttle;
    $("throttle-output").textContent = `${controls.throttle}%`;
    $("touch-throttle").value = controls.throttle;
  }

  // ==========================================
  // CONTROLS & EVENT LISTENERS
  // ==========================================
  function setupControls() {
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      const flightKeys = [
        settings.keyMap.thrust, "Space",
        settings.keyMap.lateralLeft, settings.keyMap.lateralRight,
        settings.keyMap.pitchUp, settings.keyMap.pitchDown,
        settings.keyMap.rollLeft, settings.keyMap.rollRight
      ];
      if (flightKeys.includes(e.code) && e.target.tagName !== "BUTTON") e.preventDefault();
      keys.add(e.code);
      if (e.code === settings.keyMap.pause) togglePause();
      if (e.code === settings.keyMap.restart) startFlight();
      if (e.code === settings.keyMap.camera) cycleCamera();
      if (e.code === settings.keyMap.throttleUp) setThrottle(controls.throttle + 5);
      if (e.code === settings.keyMap.throttleDown) setThrottle(controls.throttle - 5);
      if (e.code === settings.keyMap.cutThrottle) setThrottle(0);
    });

    window.addEventListener("keyup", (e) => keys.delete(e.code));

    $("start").addEventListener("click", startFlight);
    $("pause").addEventListener("click", togglePause);
    $("replay").addEventListener("click", startReplay);
    $("report-replay").addEventListener("click", startReplay);

    $("throttle").addEventListener("input", (e) => setThrottle(Number(e.target.value)));
    $("touch-throttle").addEventListener("input", (e) => setThrottle(Number(e.target.value)));
    $("touch-fine").addEventListener("click", () => {
      controls.fine = !controls.fine;
      $("touch-fine").textContent = controls.fine ? "FINE: ON" : "FINE: OFF";
      $("touch-fine").setAttribute("aria-pressed", String(controls.fine));
    });

    $("difficulty").addEventListener("change", () => {
      if (mode !== "running") startFlight();
    });

    $("sim-site-lighting").addEventListener("change", (e) => {
      updateSimulatorLighting(e.target.value);
    });

    $("camera-mode").addEventListener("change", (e) => {
      settings.camera = e.target.value;
    });

    // Touch Pads
    const bt = $("bt");
    bt.addEventListener("pointerdown", () => { controls.boost = true; });
    bt.addEventListener("pointerup", () => { controls.boost = false; });
    bt.addEventListener("pointerleave", () => { controls.boost = false; });

    const bl = $("bl");
    bl.addEventListener("pointerdown", () => { controls.lateral = -100; SoundFX.rcsBurst(); });
    bl.addEventListener("pointerup", () => { controls.lateral = 0; });
    bl.addEventListener("pointerleave", () => { controls.lateral = 0; });

    const br = $("br");
    br.addEventListener("pointerdown", () => { controls.lateral = 100; SoundFX.rcsBurst(); });
    br.addEventListener("pointerup", () => { controls.lateral = 0; });
    br.addEventListener("pointerleave", () => { controls.lateral = 0; });

    const joystick = $("joystick");
    let joystickPointerId = null;
    const moveAttitudeStick = (e) => {
      const rect = joystick.getBoundingClientRect();
      const maxTravel = (rect.width - 26) / 2;
      const x = clamp((e.clientX - rect.left - rect.width / 2) / maxTravel, -1, 1);
      const y = clamp((e.clientY - rect.top - rect.height / 2) / maxTravel, -1, 1);
      joystick.style.setProperty("--stick-x", `${x * maxTravel}px`);
      joystick.style.setProperty("--stick-y", `${y * maxTravel}px`);
      controls.roll = Math.round(x * 100);
      controls.pitch = Math.round(y * 100);
    };
    const releaseAttitudeStick = (e) => {
      if (e.pointerId !== joystickPointerId) return;
      joystickPointerId = null;
      controls.pitch = 0;
      controls.roll = 0;
      joystick.style.setProperty("--stick-x", "0px");
      joystick.style.setProperty("--stick-y", "0px");
    };
    joystick.addEventListener("pointerdown", (e) => {
      joystickPointerId = e.pointerId;
      joystick.setPointerCapture(e.pointerId);
      moveAttitudeStick(e);
    });
    joystick.addEventListener("pointermove", (e) => {
      if (e.pointerId === joystickPointerId) moveAttitudeStick(e);
    });
    joystick.addEventListener("pointerup", releaseAttitudeStick);
    joystick.addEventListener("pointercancel", releaseAttitudeStick);
    joystick.addEventListener("lostpointercapture", releaseAttitudeStick);

    // Orbit Camera Drag
    simCanvas.addEventListener("pointerdown", (e) => {
      orbit.dragging = true;
      orbit.lastX = e.clientX;
      orbit.lastY = e.clientY;
    });
    window.addEventListener("pointermove", (e) => {
      if (!orbit.dragging) return;
      const dx = e.clientX - orbit.lastX;
      const dy = e.clientY - orbit.lastY;
      orbit.lastX = e.clientX;
      orbit.lastY = e.clientY;
      orbit.yaw -= dx * 0.007;
      orbit.pitch = clamp(orbit.pitch + dy * 0.007, -0.2, 1.4);
    });
    window.addEventListener("pointerup", () => { orbit.dragging = false; });
    simCanvas.addEventListener("wheel", (e) => {
      orbit.distance = clamp(orbit.distance + e.deltaY * 0.04, 12, 120);
    }, { passive: true });

    // Audio toggle button in top nav
    $("audio-toggle").addEventListener("click", () => {
      const on = SoundFX.toggle();
      $("audio-label").textContent = on ? "AUDIO: ON" : "AUDIO: MUTED";
      document.querySelector(".pill-dot").className = on ? "pill-dot active" : "pill-dot";
    });

    $("open-controls").addEventListener("click", () => {
      setupKeyRemapping();
      $("controls-dialog").showModal();
    });
    $("save-settings").addEventListener("click", saveSettings);
    $("reset-settings").addEventListener("click", resetSettings);
  }

  function cycleCamera() {
    const modes = ["chase", "cockpit", "top", "cinematic"];
    const next = modes[(modes.indexOf(settings.camera) + 1) % modes.length];
    settings.camera = next;
    $("camera-mode").value = next;
  }

  function setupKeyRemapping() {
    const list = $("key-remap-list");
    list.innerHTML = Object.entries(DEFAULT_KEYS).map(([action, code]) => `
      <div class="key-remap-row">
        <span>${KEY_LABELS[action]}</span>
        <button type="button" data-action="${action}">${settings.keyMap[action] || code}</button>
      </div>
    `).join("");

    list.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        captureAction = btn.dataset.action;
        btn.textContent = "Press key…";
      });
    });

    window.addEventListener("keydown", (e) => {
      if (!captureAction) return;
      settings.keyMap[captureAction] = e.code;
      captureAction = null;
      setupKeyRemapping();
    }, { once: true });
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      $("settings-status").textContent = "Settings saved.";
    } catch (e) {
      $("settings-status").textContent = "Could not save settings.";
    }
  }

  function resetSettings() {
    settings = { keyMap: { ...DEFAULT_KEYS }, camera: "chase" };
    localStorage.removeItem(STORAGE_KEY);
    setupKeyRemapping();
    $("settings-status").textContent = "Defaults restored.";
  }

  // ==========================================
  // LUNAR LANDING SITE NAVIGATOR SUITE
  // ==========================================
  let activeSiteKey = "shackleton";
  let activeEpoch = new Date("2026-10-24T12:00:00Z");
  let scrubberOffsetHours = 0;
  let isScrubberPlaying = false;
  let scrubberPlayTimer = null;
  let mapProjectionMode = "polar"; // "polar" or "global"

  // ==========================================
  // 3D LUNAR GLOBE VISUALIZER (NASA LROC)
  // ==========================================
  let globeScene, globeCamera, globeRenderer, globeMoonMesh, globeSunLight, globeSiteGroup, globeActivePin;
  let globeOrbit = {
    yaw: -Math.PI / 2,
    pitch: -1.35, // Looking directly at the South Pole by default
    distance: 38,
    targetYaw: -Math.PI / 2,
    targetPitch: -1.35,
    targetDistance: 38,
    dragging: false,
    lastX: 0,
    lastY: 0,
    autoRotate: false
  };
  let globeRaycaster = null;
  let globeMouse = null;
  let globeSiteMeshes = [];
  let globeAnimId = null;

  function toLunarSpherePos(latDeg, lonDeg, r = 14.15) {
    const phi = (90 - latDeg) * (Math.PI / 180);
    const theta = (lonDeg + 180) * (Math.PI / 180);
    const x = -r * Math.sin(phi) * Math.cos(theta);
    const z = r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  }

  function showGlobeFallback(message) {
    const canvas = $("globe-canvas");
    const fallback = $("globe-fallback");
    const status = $("globe-status");
    if (canvas) canvas.hidden = true;
    if (fallback) fallback.hidden = false;
    if (status) {
      status.textContent = message;
      status.hidden = false;
    }
  }

  function initGlobeVisualizer() {
    const canvas = $("globe-canvas");
    if (!canvas) return;
    if (typeof THREE === "undefined") {
      console.error("Three.js failed to load; showing the Moon preview instead.");
      showGlobeFallback("3D renderer unavailable. Showing a Moon preview.");
      return;
    }
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 460;

    globeScene = new THREE.Scene();
    globeScene.background = new THREE.Color(0x020408);
    globeCamera = new THREE.PerspectiveCamera(40, w / (h || 1), 0.1, 1000);
    try {
      globeRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    } catch (error) {
      console.error("WebGL globe renderer could not be created.", error);
      showGlobeFallback("WebGL is unavailable. Showing a Moon preview.");
      return;
    }
    globeRenderer.setSize(w, h, false);
    globeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    globeRenderer.outputEncoding = THREE.sRGBEncoding;

    // Deep space background starfield
    const starCount = 800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 220 + Math.random() * 50;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    globeScene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x94a3b8, size: 1.4, sizeAttenuation: false })));

    // 3D Moon Sphere Geometry
    const moonRadius = 14;
    const moonGeo = new THREE.SphereGeometry(moonRadius, 64, 64);

    // Load authentic lunar surface texture (downloaded from NASA LROC / Three.js data)
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.05
    });
    globeMoonMesh = new THREE.Mesh(moonGeo, moonMat);
    globeScene.add(globeMoonMesh);

    const texLoader = new THREE.TextureLoader();
    const moonTexture = texLoader.load(new URL("moon_1024.jpg", document.baseURI).href, (texture) => {
      texture.encoding = THREE.sRGBEncoding;
      texture.anisotropy = 4;
      moonMat.map = texture;
      moonMat.needsUpdate = true;
      $("globe-fallback").hidden = true;
      $("globe-status").hidden = true;
      if (globeRenderer && globeScene && globeCamera) {
        globeRenderer.render(globeScene, globeCamera);
      }
    }, undefined, (error) => {
      console.error("Lunar surface texture failed to load.", error);
      moonMat.map = null;
      moonMat.color.setHex(0x9ca3af);
      moonMat.needsUpdate = true;
      showGlobeFallback("Moon texture unavailable. Showing a shaded Moon preview.");
    });
    moonTexture.encoding = THREE.sRGBEncoding;
    moonTexture.anisotropy = 4;

    // Subtle atmospheric rim / limb glow ring
    const rimGeo = new THREE.RingGeometry(moonRadius * 1.002, moonRadius * 1.035, 64);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    globeScene.add(rimMesh);

    // Ambient Lighting (space deep bounce)
    const ambLight = new THREE.AmbientLight(0x67758b, 0.65);
    globeScene.add(ambLight);

    // Directional Sunlight (will be dynamically positioned by ephemeris)
    globeSunLight = new THREE.DirectionalLight(0xfff8e7, 2.0);
    globeSunLight.position.set(45, 8, 30);
    globeScene.add(globeSunLight);

    // Site markers group
    globeSiteGroup = new THREE.Group();
    globeScene.add(globeSiteGroup);
    globeSiteMeshes = [];

    // Populate Candidate Landing Site Markers
    Object.entries(SITES_DATA).forEach(([key, site]) => {
      if (key === "custom") return;
      const pos = toLunarSpherePos(site.lat, site.lon, moonRadius + 0.12);

      let pinColor = 0x00f0ff; // Artemis default cyan
      if (site.category.includes("CLPS") || site.category.includes("Commercial")) pinColor = 0xd946ef;
      else if (site.category.includes("Apollo")) pinColor = 0x10b981;
      else if (site.category.includes("International")) pinColor = 0xf59e0b;

      // Pin sphere dot
      const pinGeo = new THREE.SphereGeometry(0.32, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: pinColor });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.copy(pos);
      pinMesh.userData = { siteKey: key, site };
      globeSiteGroup.add(pinMesh);
      globeSiteMeshes.push(pinMesh);

      // Radar Ring around pin
      const ringGeo = new THREE.RingGeometry(0.42, 0.54, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: pinColor, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(pos.clone().multiplyScalar(2));
      globeSiteGroup.add(ringMesh);
    });

    // Active Observer Pin (High-visibility neon magenta/red pulsing beacon)
    const activeGeo = new THREE.SphereGeometry(0.44, 16, 16);
    const activeMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    globeActivePin = new THREE.Mesh(activeGeo, activeMat);
    const activeRingGeo = new THREE.RingGeometry(0.6, 0.78, 24);
    const activeRingMat = new THREE.MeshBasicMaterial({ color: 0xff0055, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    const activeRingMesh = new THREE.Mesh(activeRingGeo, activeRingMat);
    globeActivePin.add(activeRingMesh);
    globeScene.add(globeActivePin);

    // Initial position for active pin
    const initSite = SITES_DATA[activeSiteKey] || SITES_DATA.shackleton;
    globeActivePin.position.copy(toLunarSpherePos(initSite.lat, initSite.lon, moonRadius + 0.22));
    activeRingMesh.lookAt(globeActivePin.position.clone().multiplyScalar(2));

    // Mouse / Touch Drag and Interaction
    globeRaycaster = new THREE.Raycaster();
    globeMouse = new THREE.Vector2();
    const tooltip = $("globe-tooltip");

    canvas.addEventListener("mousedown", (e) => {
      globeOrbit.dragging = true;
      globeOrbit.lastX = e.clientX;
      globeOrbit.lastY = e.clientY;
    });

    window.addEventListener("mouseup", () => {
      globeOrbit.dragging = false;
    });

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (globeOrbit.dragging) {
        const dx = e.clientX - globeOrbit.lastX;
        const dy = e.clientY - globeOrbit.lastY;
        globeOrbit.targetYaw += dx * 0.008;
        globeOrbit.targetPitch = Math.max(-1.54, Math.min(1.54, globeOrbit.targetPitch + dy * 0.008));
        globeOrbit.lastX = e.clientX;
        globeOrbit.lastY = e.clientY;
      }

      // Raycast for hover tooltip
      globeMouse.x = (mx / rect.width) * 2 - 1;
      globeMouse.y = -(my / rect.height) * 2 + 1;
      globeRaycaster.setFromCamera(globeMouse, globeCamera);
      const intersects = globeRaycaster.intersectObjects(globeSiteMeshes);

      if (intersects.length > 0 && tooltip) {
        const hit = intersects[0].object;
        const site = hit.userData.site;
        tooltip.hidden = false;
        tooltip.style.left = `${mx}px`;
        tooltip.style.top = `${my}px`;
        const latStr = site.lat >= 0 ? `${site.lat}°N` : `${Math.abs(site.lat)}°S`;
        const lonStr = site.lon >= 0 ? `${site.lon}°E` : `${Math.abs(site.lon)}°W`;
        tooltip.innerHTML = `<strong>${site.name}</strong><br><span style="color:#00f0ff;">${site.category}</span><br>${latStr}, ${lonStr} · Elev: +${site.elev} km`;
        canvas.style.cursor = "pointer";
      } else {
        if (tooltip) tooltip.hidden = true;
        canvas.style.cursor = globeOrbit.dragging ? "grabbing" : "grab";
      }
    });

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      globeOrbit.targetDistance = Math.max(20, Math.min(65, globeOrbit.targetDistance + e.deltaY * 0.04));
    }, { passive: false });

    // Click to select site pin
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      globeMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      globeMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      globeRaycaster.setFromCamera(globeMouse, globeCamera);
      const intersects = globeRaycaster.intersectObjects(globeSiteMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const siteKey = hit.userData.siteKey;
        if (siteKey && $("target-site-select")) {
          $("target-site-select").value = siteKey;
          $("target-site-select").dispatchEvent(new Event("change"));
        }
      }
    });

    // Preset view buttons
    const btnSouthPole = $("btn-view-southpole");
    const btnNearside = $("btn-view-nearside");
    const btnFarside = $("btn-view-farside");
    const btnRotate = $("btn-toggle-rotate");

    function clearPresetActive() {
      if (btnSouthPole) btnSouthPole.classList.remove("active");
      if (btnNearside) btnNearside.classList.remove("active");
      if (btnFarside) btnFarside.classList.remove("active");
    }

    if (btnSouthPole) {
      btnSouthPole.addEventListener("click", () => {
        clearPresetActive();
        btnSouthPole.classList.add("active");
        globeOrbit.targetPitch = -1.35;
        globeOrbit.targetYaw = -Math.PI / 2;
        globeOrbit.targetDistance = 34;
      });
    }

    if (btnNearside) {
      btnNearside.addEventListener("click", () => {
        clearPresetActive();
        btnNearside.classList.add("active");
        globeOrbit.targetPitch = 0.0;
        globeOrbit.targetYaw = -Math.PI / 2;
        globeOrbit.targetDistance = 38;
      });
    }

    if (btnFarside) {
      btnFarside.addEventListener("click", () => {
        clearPresetActive();
        btnFarside.classList.add("active");
        globeOrbit.targetPitch = 0.0;
        globeOrbit.targetYaw = Math.PI / 2;
        globeOrbit.targetDistance = 38;
      });
    }

    if (btnRotate) {
      btnRotate.addEventListener("click", () => {
        globeOrbit.autoRotate = !globeOrbit.autoRotate;
        btnRotate.classList.toggle("active", globeOrbit.autoRotate);
      });
    }

    // Window resize handler
    window.addEventListener("resize", () => {
      if (!canvas || !globeRenderer || !globeCamera) return;
      const rw = canvas.clientWidth || 800;
      const rh = canvas.clientHeight || 460;
      globeCamera.aspect = rw / (rh || 1);
      globeCamera.updateProjectionMatrix();
      globeRenderer.setSize(rw, rh, false);
    });

    // Animation Loop
    let pulseT = 0;
    function animateGlobe() {
      globeAnimId = requestAnimationFrame(animateGlobe);

      if ($("globe-view-container") && $("globe-view-container").hidden) {
        return; // Don't draw if tab hidden
      }

      // Smooth camera lerp
      globeOrbit.yaw += (globeOrbit.targetYaw - globeOrbit.yaw) * 0.08;
      globeOrbit.pitch += (globeOrbit.targetPitch - globeOrbit.pitch) * 0.08;
      globeOrbit.distance += (globeOrbit.targetDistance - globeOrbit.distance) * 0.08;

      if (globeOrbit.autoRotate && !globeOrbit.dragging) {
        globeOrbit.targetYaw += 0.003;
      }

      // Spherical to Cartesian camera position
      const cy = globeOrbit.distance * Math.sin(globeOrbit.pitch);
      const horizR = globeOrbit.distance * Math.cos(globeOrbit.pitch);
      const cx = horizR * Math.cos(globeOrbit.yaw);
      const cz = horizR * Math.sin(globeOrbit.yaw);

      globeCamera.position.set(cx, cy, cz);
      globeCamera.lookAt(0, 0, 0);

      // Pulse active beacon pin
      pulseT += 0.05;
      if (globeActivePin) {
        const s = 1.0 + Math.sin(pulseT * 2) * 0.25;
        globeActivePin.scale.set(s, s, s);
      }

      // Keep limb rim ring facing camera
      rimMesh.quaternion.copy(globeCamera.quaternion);

      globeRenderer.render(globeScene, globeCamera);
    }
    animateGlobe();
  }

  function updateGlobeActiveSite(site, ephem) {
    if (!globeActivePin || !globeScene) return;

    const pos = toLunarSpherePos(site.lat, site.lon, 14 + 0.22);
    globeActivePin.position.copy(pos);
    globeActivePin.lookAt(pos.clone().multiplyScalar(2));

    // Update overlay labels
    if ($("globe-focus-name")) $("globe-focus-name").textContent = site.name;
    if ($("globe-focus-coords")) {
      const latStr = site.lat >= 0 ? `${site.lat.toFixed(2)}°N` : `${Math.abs(site.lat).toFixed(2)}°S`;
      const lonStr = site.lon >= 0 ? `${site.lon.toFixed(2)}°E` : `${Math.abs(site.lon).toFixed(2)}°W`;
      $("globe-focus-coords").textContent = `${latStr} / ${lonStr}`;
    }

    // Orient solar directional light to match calculated solar azimuth & subsolar angle
    if (globeSunLight && ephem && ephem.sun) {
      const sunAzRad = ephem.sun.az * Math.PI / 180;
      const sunElRad = Math.max(-0.2, ephem.sun.el) * Math.PI / 180;
      const lx = 45 * Math.sin(sunAzRad) * Math.cos(sunElRad);
      const ly = 45 * Math.sin(sunElRad) + 5;
      const lz = 45 * Math.cos(sunAzRad) * Math.cos(sunElRad);
      globeSunLight.position.set(lx, ly, lz);
    }

    if ($("globe-illum-pct")) {
      const el = ephem && ephem.sun ? ephem.sun.el : 0;
      const lit = el > (site.mask || 1.0);
      $("globe-illum-pct").textContent = lit ? `Sun Elev: ${el >= 0 ? "+" : ""}${el.toFixed(1)}° (Lit)` : `Sun Elev: ${el.toFixed(1)}° (Shadow)`;
    }
  }

  // 3D Dome Observer Visualizer
  let domeScene, domeCamera, domeRenderer, domeSunMesh, domeEarthMesh, domeSunBeam, domeEarthBeam;
  let domeOrbit = { yaw: 0.8, pitch: 0.35, distance: 42, dragging: false, lastX: 0, lastY: 0 };

  function initDomeVisualizer() {
    const canvas = $("dome-canvas");
    if (!canvas) return;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 460;
    domeScene = new THREE.Scene();
    domeScene.background = new THREE.Color(0x020408);
    domeCamera = new THREE.PerspectiveCamera(45, w / (h || 1), 0.1, 1000);
    domeRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    domeRenderer.setSize(w, h, false);
    domeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Dome Stars
    const starCount = 600;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 180;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 2; // above horizon
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    domeScene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false })));

    // Ground Plane & Horizon Ring
    const groundGeo = new THREE.CircleGeometry(25, 48);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x111927 });
    domeScene.add(new THREE.Mesh(groundGeo, groundMat));

    // 0° Horizon Compass Ring
    const horizonRing = new THREE.Mesh(
      new THREE.RingGeometry(24.8, 25.2, 64),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide })
    );
    horizonRing.rotation.x = -Math.PI / 2;
    horizonRing.position.y = 0.05;
    domeScene.add(horizonRing);

    // Altitude Elevation Rings (15°, 30°, 60°)
    [15, 30, 60].forEach((altDeg) => {
      const r = 25 * Math.cos(altDeg * Math.PI / 180);
      const h = 25 * Math.sin(altDeg * Math.PI / 180);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.1, r + 0.1, 48),
        new THREE.MeshBasicMaterial({ color: 0x33475f, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = h;
      domeScene.add(ring);
    });

    // Crater Rim Silhouette Mask (Simulating elevated terrain obstruction)
    const rimCount = 64;
    const rimPoints = [];
    for (let i = 0; i <= rimCount; i++) {
      const ang = (i / rimCount) * Math.PI * 2;
      const maskDeg = 1.2 + Math.sin(ang * 4) * 0.8 + Math.cos(ang * 7) * 0.5;
      const r = 24.5 * Math.cos(maskDeg * Math.PI / 180);
      const y = 24.5 * Math.sin(maskDeg * Math.PI / 180);
      rimPoints.push(new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r));
    }
    const rimGeo = new THREE.BufferGeometry().setFromPoints(rimPoints);
    const rimLine = new THREE.Line(rimGeo, new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 2 }));
    domeScene.add(rimLine);

    // 3D Sun Sphere & Light Vector
    domeSunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xffdd44 })
    );
    domeScene.add(domeSunMesh);

    const sunBeamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)]);
    domeSunBeam = new THREE.Line(sunBeamGeo, new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.6 }));
    domeScene.add(domeSunBeam);

    // 3D Earth Sphere & Communication Vector
    domeEarthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    domeScene.add(domeEarthMesh);

    const earthBeamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)]);
    domeEarthBeam = new THREE.Line(earthBeamGeo, new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 }));
    domeScene.add(domeEarthBeam);

    // Dome Orbit Controls
    canvas.addEventListener("pointerdown", (e) => {
      domeOrbit.dragging = true;
      domeOrbit.lastX = e.clientX;
      domeOrbit.lastY = e.clientY;
    });
    window.addEventListener("pointermove", (e) => {
      if (!domeOrbit.dragging) return;
      const dx = e.clientX - domeOrbit.lastX;
      const dy = e.clientY - domeOrbit.lastY;
      domeOrbit.lastX = e.clientX;
      domeOrbit.lastY = e.clientY;
      domeOrbit.yaw -= dx * 0.008;
      domeOrbit.pitch = clamp(domeOrbit.pitch + dy * 0.008, 0.05, 1.4);
    });
    window.addEventListener("pointerup", () => { domeOrbit.dragging = false; });
    canvas.addEventListener("wheel", (e) => {
      domeOrbit.distance = clamp(domeOrbit.distance + e.deltaY * 0.03, 16, 75);
    }, { passive: true });
  }

  function updateDomePositions(sunAzDeg, sunElDeg, earthAzDeg, earthElDeg) {
    if (!domeSunMesh || !domeEarthMesh) return;
    const R = 25;

    // Sun Vector
    const sunAzRad = (sunAzDeg - 90) * Math.PI / 180;
    const sunElRad = sunElDeg * Math.PI / 180;
    const sx = Math.cos(sunAzRad) * Math.cos(sunElRad) * R;
    const sy = Math.sin(sunElRad) * R;
    const sz = Math.sin(sunAzRad) * Math.cos(sunElRad) * R;
    domeSunMesh.position.set(sx, sy, sz);

    const sunPts = [new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(sx, sy, sz)];
    domeSunBeam.geometry.setFromPoints(sunPts);

    // Earth Vector
    const earthAzRad = (earthAzDeg - 90) * Math.PI / 180;
    const earthElRad = earthElDeg * Math.PI / 180;
    const ex = Math.cos(earthAzRad) * Math.cos(earthElRad) * R;
    const ey = Math.sin(earthElRad) * R;
    const ez = Math.sin(earthAzRad) * Math.cos(earthElRad) * R;
    domeEarthMesh.position.set(ex, ey, ez);

    const earthPts = [new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(ex, ey, ez)];
    domeEarthBeam.geometry.setFromPoints(earthPts);

    // Color code Earth comms line based on line-of-sight
    if (earthElDeg > 0) {
      domeEarthBeam.material.color.setHex(0x00f0ff);
      domeEarthMesh.material.color.setHex(0x38bdf8);
    } else {
      domeEarthBeam.material.color.setHex(0xef4444);
      domeEarthMesh.material.color.setHex(0xef4444);
    }

    // Update Dome Camera Position
    const cx = Math.cos(domeOrbit.yaw) * Math.cos(domeOrbit.pitch) * domeOrbit.distance;
    const cy = Math.sin(domeOrbit.pitch) * domeOrbit.distance + 2;
    const cz = Math.sin(domeOrbit.yaw) * Math.cos(domeOrbit.pitch) * domeOrbit.distance;
    domeCamera.position.set(cx, cy, cz);
    domeCamera.lookAt(0, 3, 0);

    domeRenderer.render(domeScene, domeCamera);
  }

  // ==========================================
  // 2D LUNAR MAP RENDERER (POLAR & GLOBAL)
  // ==========================================
  function renderLunarMap() {
    const canvas = $("lunar-map-canvas");
    if (!canvas) return;
    const w = canvas.width = canvas.clientWidth || 800;
    const h = canvas.height = canvas.clientHeight || 460;
    if (w <= 50 || h <= 50) return;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#03060a";
    ctx.fillRect(0, 0, w, h);

    if (mapProjectionMode === "polar") {
      // South Pole Polar Stereographic Projection (60°S to 90°S)
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.max(10, Math.min(cx, cy) - 24);

      // Concentric latitude rings (90°S center, 85°S, 80°S, 70°S)
      [90, 85, 80, 75, 70].forEach((lat) => {
        const r = Math.max(0, ((90 - Math.abs(lat)) / 25) * maxR);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(188, 208, 231, 0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "rgba(188, 208, 231, 0.35)";
        ctx.font = "9px 'DM Mono', monospace";
        ctx.fillText(`${lat}°S`, cx + 6, cy - r + 10);
      });

      // Longitude radial rays (0°, 90°E, 180°, 270°/90°W)
      [0, 45, 90, 135, 180, 225, 270, 315].forEach((deg) => {
        const rad = (deg - 90) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(rad) * maxR, cy + Math.sin(rad) * maxR);
        ctx.strokeStyle = "rgba(188, 208, 231, 0.08)";
        ctx.stroke();

        ctx.fillStyle = "rgba(188, 208, 231, 0.4)";
        ctx.font = "9px 'DM Mono', monospace";
        ctx.fillText(`${deg}°`, cx + Math.cos(rad) * (maxR + 12) - 8, cy + Math.sin(rad) * (maxR + 12) + 4);
      });

      // Permanently Shadowed Regions (PSRs) shaded in dark indigo/cyan
      const psrs = [
        { name: "Shackleton", lat: -89.9, lon: 0, r: 18 },
        { name: "Shoemaker", lat: -88.1, lon: 45, r: 24 },
        { name: "Faustini", lat: -87.3, lon: 84, r: 20 },
        { name: "Haworth", lat: -87.4, lon: -5, r: 22 },
        { name: "Amundsen", lat: -84.5, lon: 85, r: 32 }
      ];

      psrs.forEach((psr) => {
        const rad = (psr.lon - 90) * Math.PI / 180;
        const dist = ((90 - Math.abs(psr.lat)) / 25) * maxR;
        const px = cx + Math.cos(rad) * dist;
        const py = cy + Math.sin(rad) * dist;
        const psrR = Math.max(1, psr.r * (maxR / 180));

        ctx.beginPath();
        ctx.arc(px, py, psrR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, 0.35)";
        ctx.fill();
        ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
        ctx.stroke();
      });

      // Landing Sites Markers
      Object.entries(SITES_DATA).forEach(([key, site]) => {
        if (site.lat > -60) return; // only polar in this view
        const rad = (site.lon - 90) * Math.PI / 180;
        const dist = ((90 - Math.abs(site.lat)) / 25) * maxR;
        const px = cx + Math.cos(rad) * dist;
        const py = cy + Math.sin(rad) * dist;

        const isSelected = key === activeSiteKey;
        ctx.beginPath();
        ctx.arc(px, py, isSelected ? 7 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#00f0ff" : (site.category.includes("Artemis") ? "#38bdf8" : "#f59e0b");
        ctx.fill();
        ctx.strokeStyle = isSelected ? "#ffffff" : "rgba(0,0,0,0.8)";
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(px, py, 13, 0, Math.PI * 2);
          ctx.strokeStyle = "#00f0ff";
          ctx.stroke();
        }

        ctx.fillStyle = isSelected ? "#00f0ff" : "#94a3b8";
        ctx.font = isSelected ? "bold 10px 'DM Mono', monospace" : "9px 'DM Mono', monospace";
        ctx.fillText(site.name.split(" ")[0], px + 8, py + 3);
      });
    } else {
      // Global Equirectangular Lunar Map (-180° to +180° Lon, -90° to +90° Lat)
      ctx.strokeStyle = "rgba(188, 208, 231, 0.1)";
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = h / 2 - (lat / 90) * (h / 2 - 20);
        ctx.beginPath();
        ctx.moveTo(30, y);
        ctx.lineTo(w - 30, y);
        ctx.stroke();
        ctx.fillStyle = "rgba(188, 208, 231, 0.3)";
        ctx.font = "9px 'DM Mono', monospace";
        ctx.fillText(`${lat}°`, 6, y + 3);
      }
      for (let lon = -120; lon <= 120; lon += 60) {
        const x = w / 2 + (lon / 180) * (w / 2 - 30);
        ctx.beginPath();
        ctx.moveTo(x, 15);
        ctx.lineTo(x, h - 15);
        ctx.stroke();
        ctx.fillText(`${lon}°`, x - 8, h - 4);
      }

      // Draw equator line
      ctx.beginPath();
      ctx.moveTo(30, h / 2);
      ctx.lineTo(w - 30, h / 2);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.3)";
      ctx.stroke();

      // Render Sites
      Object.entries(SITES_DATA).forEach(([key, site]) => {
        const px = w / 2 + (site.lon / 180) * (w / 2 - 30);
        const py = h / 2 - (site.lat / 90) * (h / 2 - 20);
        const isSelected = key === activeSiteKey;

        ctx.beginPath();
        ctx.arc(px, py, isSelected ? 6 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#00f0ff" : "#f59e0b";
        ctx.fill();

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(px, py, 11, 0, Math.PI * 2);
          ctx.strokeStyle = "#00f0ff";
          ctx.stroke();
        }
      });
    }
  }

  // Handle click on 2D map to pick coordinates
  function setupMapInteractions() {
    const canvas = $("lunar-map-canvas");
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      if (mapProjectionMode === "polar") {
        const cx = w / 2;
        const cy = h / 2;
        const maxR = Math.min(cx, cy) - 24;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxR) return;

        const deltaDeg = (dist / maxR) * 25;
        const lat = - (90 - deltaDeg);
        let ang = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
        if (ang > 180) ang -= 360;

        setCustomCoordinates(lat, ang);
      } else {
        const lon = ((x - w / 2) / (w / 2 - 30)) * 180;
        const lat = - ((y - h / 2) / (h / 2 - 20)) * 90;
        setCustomCoordinates(clamp(lat, -90, 90), clamp(lon, -180, 180));
      }
    });

    $("map-mode-polar").addEventListener("click", () => {
      mapProjectionMode = "polar";
      $("map-mode-polar").classList.add("active");
      $("map-mode-global").classList.remove("active");
      renderLunarMap();
    });
    $("map-mode-global").addEventListener("click", () => {
      mapProjectionMode = "global";
      $("map-mode-global").classList.add("active");
      $("map-mode-polar").classList.remove("active");
      renderLunarMap();
    });
  }

  function setCustomCoordinates(lat, lon) {
    activeSiteKey = "custom";
    SITES_DATA.custom.lat = Number(lat.toFixed(2));
    SITES_DATA.custom.lon = Number(lon.toFixed(2));
    $("target-site-select").value = "custom";
    syncCoordinateInputs(SITES_DATA.custom);
    updateNavigator();
  }

  function syncCoordinateInputs(site) {
    $("custom-lat").value = site.lat;
    $("custom-lon").value = site.lon;
    $("custom-elev").value = site.elev;
    $("custom-mask").value = site.mask;
  }

  function updateCustomSiteFromInputs() {
    const site = SITES_DATA.custom;
    site.lat = Number($("custom-lat").value);
    site.lon = Number($("custom-lon").value);
    site.elev = Number($("custom-elev").value);
    site.mask = Number($("custom-mask").value);
    activeSiteKey = "custom";
    $("target-site-select").value = "custom";
    updateNavigator();
  }

  // ==========================================
  // 30-DAY TEMPORAL TIMELINE CURVE RENDERER
  // ==========================================
  function renderTimelineChart() {
    const canvas = $("timeline-chart-canvas");
    if (!canvas) return;
    const w = canvas.width = canvas.clientWidth || 1100;
    const h = canvas.height = canvas.clientHeight || 240;
    if (w <= 100 || h <= 50) return;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#03060a";
    ctx.fillRect(0, 0, w, h);

    const site = SITES_DATA[activeSiteKey] || SITES_DATA.shackleton;
    const padding = { top: 24, right: 30, bottom: 32, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // 0° Horizon line
    const zeroY = padding.top + chartH * 0.55;
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(padding.left + chartW, zeroY);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "10px 'DM Mono', monospace";
    ctx.fillText("0° HORIZON", padding.left - 42, zeroY + 3);

    // Grid ticks for time (0 to 30 days)
    for (let day = 0; day <= 30; day += 5) {
      const x = padding.left + (day / 30) * chartW;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartH);
      ctx.strokeStyle = "rgba(188, 208, 231, 0.08)";
      ctx.stroke();
      ctx.fillText(`D+${day}`, x - 8, h - 10);
    }

    // Compute 30-day curve points
    const points = 120;
    const sunPoints = [];
    const earthPoints = [];
    const baseTime = activeEpoch.getTime();

    for (let i = 0; i <= points; i++) {
      const dayOffset = (i / points) * 29.53;
      const tDate = new Date(baseTime + dayOffset * 86400 * 1000);
      const res = Ephemeris.compute(site.lat, site.lon, tDate);
      const x = padding.left + (i / points) * chartW;
      // Scale angles: south pole angles range from -10° to +10°, equator up to 90°
      const scale = Math.abs(site.lat) > 60 ? 6.5 : 1.2;
      const ySun = zeroY - res.sun.el * scale;
      const yEarth = zeroY - res.earth.el * scale;
      sunPoints.push({ x, y: ySun, el: res.sun.el });
      earthPoints.push({ x, y: yEarth, el: res.earth.el });
    }

    // Draw Earth Elevation Curve (Cyan)
    ctx.beginPath();
    earthPoints.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Draw Sun Elevation Curve (Gold)
    ctx.beginPath();
    sunPoints.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Current scrubber position cursor
    const scrubFraction = scrubberOffsetHours / 708.7;
    const cursorX = padding.left + scrubFraction * chartW;
    ctx.beginPath();
    ctx.moveTo(cursorX, padding.top);
    ctx.lineTo(cursorX, padding.top + chartH);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cursorX, padding.top + 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ==========================================
  // UPDATE NAVIGATOR TELEMETRY & WORKSPACE
  // ==========================================
  function updateNavigator() {
    const site = SITES_DATA[activeSiteKey] || SITES_DATA.shackleton;
    const currentEpoch = new Date(activeEpoch.getTime() + scrubberOffsetHours * 3600 * 1000);

    // Compute Ephemeris
    const ephem = Ephemeris.compute(site.lat, site.lon, currentEpoch);

    // Update site overview card
    $("card-site-name").textContent = site.name;
    $("card-site-coords").textContent = `${site.lat > 0 ? site.lat + "°N" : Math.abs(site.lat) + "°S"}, ${site.lon > 0 ? site.lon + "°E" : Math.abs(site.lon) + "°W"} · Elev: ${site.elev > 0 ? "+" + site.elev : site.elev} km`;
    $("card-site-category").textContent = site.category;
    $("card-site-desc").textContent = site.desc;
    $("advisory-text").innerHTML = `<strong>Mission Advisory:</strong> ${site.advisory}`;

    // Feasibility Badge
    const feasBadge = $("card-feasibility-badge");
    const feasScore = $("card-feasibility-badge").querySelector(".feasibility-score");
    feasScore.textContent = site.feasibility;
    if (site.feasibility === "HIGH") {
      feasBadge.style.borderColor = "rgba(16, 185, 129, 0.4)";
      feasBadge.style.background = "rgba(16, 185, 129, 0.12)";
      feasScore.style.color = "#10b981";
    } else if (site.feasibility === "CAUTION" || site.feasibility === "FAR SIDE (RELAY ONLY)") {
      feasBadge.style.borderColor = "rgba(239, 68, 68, 0.4)";
      feasBadge.style.background = "rgba(239, 68, 68, 0.12)";
      feasScore.style.color = "#ef4444";
    } else {
      feasBadge.style.borderColor = "rgba(245, 158, 11, 0.4)";
      feasBadge.style.background = "rgba(245, 158, 11, 0.12)";
      feasScore.style.color = "#f59e0b";
    }

    // Solar Elevation & Power
    const sunEl = ephem.sun.el;
    const sunAz = ephem.sun.az;
    $("sun-elevation-val").textContent = `${sunEl >= 0 ? "+" : ""}${sunEl.toFixed(1)}°`;
    $("sun-azimuth-val").textContent = `Az: ${sunAz.toFixed(1)}° (${cardinalDirection(sunAz)})`;

    const isLit = sunEl > site.mask;
    const sunStatusTag = $("sun-status-tag");
    sunStatusTag.textContent = isLit ? (sunEl < 2.5 ? "GRAZING SUN" : "DIRECT SUN") : "LOCAL SHADOW";
    sunStatusTag.className = isLit ? "status-indicator-lit" : "status-indicator-lit shadow-mode";
    if (!isLit) {
      sunStatusTag.style.background = "rgba(99, 102, 241, 0.2)";
      sunStatusTag.style.color = "#818cf8";
    } else {
      sunStatusTag.style.background = "rgba(245, 158, 11, 0.15)";
      sunStatusTag.style.color = "#f59e0b";
    }

    // Power yield estimation (vertical array at south pole)
    const powerPct = isLit ? Math.min(100, Math.round(Math.cos(sunEl * Math.PI / 180) * 100)) : 0;
    const powerKW = ((powerPct / 100) * 1.95).toFixed(2);
    $("power-yield-val").textContent = `${powerPct}% (~${powerKW} kW)`;
    $("power-meter-fill").style.width = `${powerPct}%`;

    // Time to Sunset / Sunrise
    const sunTrans = Ephemeris.findNextTransition(site.lat, site.lon, currentEpoch, site.mask, true);
    $("sun-countdown-val").textContent = `${sunTrans.hours}h remaining (${sunTrans.sets ? "until Sunset" : "until Sunrise"})`;

    // Earth Elevation & DTE Comms
    const earthEl = ephem.earth.el;
    const earthAz = ephem.earth.az;
    $("earth-elevation-val").textContent = `${earthEl >= 0 ? "+" : ""}${earthEl.toFixed(1)}°`;
    $("earth-azimuth-val").textContent = `Az: ${earthAz.toFixed(1)}° (${cardinalDirection(earthAz)})`;

    const isConnected = earthEl > site.mask;
    const earthStatusTag = $("earth-status-tag");
    earthStatusTag.textContent = isConnected ? "ACTIVE LINK" : "OCCLUDED / RELAY REQ";
    earthStatusTag.className = isConnected ? "status-indicator-link" : "status-indicator-link blackout-mode";
    if (!isConnected) {
      earthStatusTag.style.background = "rgba(239, 68, 68, 0.2)";
      earthStatusTag.style.color = "#ef4444";
    } else {
      earthStatusTag.style.background = "rgba(0, 240, 255, 0.15)";
      earthStatusTag.style.color = "#00f0ff";
    }

    const marginDB = isConnected ? (10 + Math.min(6, earthEl * 1.2)).toFixed(1) : "-28.0";
    $("comms-margin-val").textContent = isConnected ? `+${marginDB} dB (LOS)` : "0 dB (NO DTE)";
    $("libration-val").textContent = `${ephem.earth.libLat >= 0 ? "+" : ""}${ephem.earth.libLat.toFixed(1)}° / ${ephem.earth.libLon >= 0 ? "+" : ""}${ephem.earth.libLon.toFixed(1)}°`;
    $("relay-status-val").textContent = isConnected ? "NO (Direct DSN Link)" : "YES (Relay Required)";

    const earthTrans = Ephemeris.findNextTransition(site.lat, site.lon, currentEpoch, site.mask, false);
    $("earth-countdown-val").textContent = earthTrans.continuous
      ? "Constant Window (No Set)"
      : `${earthTrans.hours}h (${earthTrans.sets ? "until Earthset" : "until Earthrise"})`;

    // Topography specs
    $("terrain-elev-val").textContent = `${site.elev > 0 ? "+" : ""}${site.elev} km`;
    $("terrain-mask-val").textContent = `${site.mask}° rim angle`;
    $("terrain-psr-dist-val").textContent = `${site.psrDistKm} km`;

    // Scrubber labels
    $("scrubber-offset-label").textContent = `LUNAR DAY OFFSET: +${scrubberOffsetHours.toFixed(1)} hrs`;
    $("scrubber-utc-preview").textContent = currentEpoch.toISOString().replace("T", " ").substring(0, 19) + " UTC";

    // Quickmap link coordinate update
    const qLat = site.lat;
    const qLon = site.lon;
    const qLink = `https://quickmap.lroc.asu.edu/?extent=${qLon - 0.2},${qLat - 0.2},${qLon + 0.2},${qLat + 0.2}&proj=10`;
    $("link-quickmap").href = qLink;
    $("quickmap-coord-label").textContent = `Open (${site.lat.toFixed(1)}°, ${site.lon.toFixed(1)}°) in Quickmap →`;

    // Render Canvas Visualizations
    updateDomePositions(sunAz, sunEl, earthAz, earthEl);
    updateGlobeActiveSite(site, ephem);
    renderLunarMap();
    renderTimelineChart();
  }

  function cardinalDirection(azDeg) {
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    const idx = Math.round(azDeg / 22.5) % 16;
    return dirs[idx];
  }

  // ==========================================
  // MULTI-SITE TRADE-OFF COMPARATOR
  // ==========================================
  function updateComparatorTable() {
    const s1 = SITES_DATA[$("comp-site-1").value] || SITES_DATA.shackleton;
    const s2 = SITES_DATA[$("comp-site-2").value] || SITES_DATA.malapert_mountain;
    const s3 = SITES_DATA[$("comp-site-3").value] || SITES_DATA.apollo11;

    $("th-site-1").textContent = `Site A: ${s1.name}`;
    $("th-site-2").textContent = `Site B: ${s2.name}`;
    $("th-site-3").textContent = `Site C: ${s3.name}`;

    const rows = [
      { label: "Target Region & Coordinates", v1: `${s1.lat}°S, ${s1.lon}°E`, v2: `${s2.lat}°S, ${s2.lon}°E`, v3: `${s3.lat}°S, ${s3.lon}°E` },
      { label: "Surface Elevation", v1: `+${s1.elev} km`, v2: `+${s2.elev} km`, v3: `${s3.elev > 0 ? "+" : ""}${s3.elev} km` },
      { label: "Sunlight Availability (% of Lunar Year)", v1: `${s1.sunlightPct}%`, v2: `${s2.sunlightPct}%`, v3: `${s3.sunlightPct}%` },
      { label: "Longest Continuous Darkness Phase", v1: `${s1.maxNightHrs} hours`, v2: `${s2.maxNightHrs} hours`, v3: `${s3.maxNightHrs} hours (14.7 Earth days)` },
      { label: "Direct-to-Earth (DTE) Visibility", v1: `${s1.earthLosPct}% of month`, v2: `${s2.earthLosPct}% of month`, v3: `${s3.earthLosPct}% (100% constant)` },
      { label: "Longest Communication Blackout", v1: `${s1.maxBlackoutHrs} hours`, v2: `${s2.maxBlackoutHrs} hours`, v3: `${s3.maxBlackoutHrs} hours (Zero blackout)` },
      { label: "Distance to Water-Ice Cold Trap", v1: `${s1.psrDistKm} km`, v2: `${s2.psrDistKm} km`, v3: `${s3.psrDistKm} km` },
      { label: "Landing Slope & Roughness Hazard", v1: `${s1.slopeDeg}° slope`, v2: `${s2.slopeDeg}° slope`, v3: `${s3.slopeDeg}° slope` },
      { label: "Relay Satellite Dependency", v1: "Optional during libration dips", v2: "Minimal (near-constant LOS)", v3: "None (Direct LOS always)" },
      { label: "Overall Mission Architecture Feasibility", v1: s1.feasibility, v2: s2.feasibility, v3: s3.feasibility }
    ];

    $("comparison-tbody").innerHTML = rows.map((r) => `
      <tr>
        <td class="comp-metric-label">${r.label}</td>
        <td><b>${r.v1}</b></td>
        <td><b>${r.v2}</b></td>
        <td><b>${r.v3}</b></td>
      </tr>
    `).join("");
  }

  // ==========================================
  // INITIALIZATION & MAIN RAF LOOP
  // ==========================================
  function setupNavigatorInteractions() {
    $("target-site-select").addEventListener("change", (e) => {
      activeSiteKey = e.target.value;
      syncCoordinateInputs(SITES_DATA[activeSiteKey]);
      updateNavigator();
      updateComparatorTable();
    });

    ["custom-lat", "custom-lon", "custom-elev", "custom-mask"].forEach((id) => {
      $(id).addEventListener("input", updateCustomSiteFromInputs);
    });

    // Date Picker
    const dateInput = $("ephemeris-date");
    dateInput.value = "2026-10-24T12:00";
    dateInput.addEventListener("change", (e) => {
      if (!e.target.value) {
        e.target.setCustomValidity("Select a valid date and time.");
        e.target.reportValidity();
        return;
      }
      const selectedEpoch = new Date(e.target.value + ":00Z");
      if (Number.isNaN(selectedEpoch.getTime())) {
        e.target.setCustomValidity("Select a valid date and time.");
        e.target.reportValidity();
        return;
      }
      e.target.setCustomValidity("");
      activeEpoch = selectedEpoch;
      const missionSiteKey = MISSION_DATE_SITES[activeEpoch.toISOString().slice(0, 10)];
      if (missionSiteKey) {
        activeSiteKey = missionSiteKey;
        $("target-site-select").value = missionSiteKey;
        syncCoordinateInputs(SITES_DATA[missionSiteKey]);
      }
      scrubberOffsetHours = 0;
      $("lunar-day-slider").value = 0;
      document.querySelectorAll(".preset-pill").forEach((pill) => pill.classList.remove("active"));
      updateNavigator();
    });

    $("epoch-now").addEventListener("click", () => {
      activeEpoch = new Date();
      dateInput.value = activeEpoch.toISOString().substring(0, 16);
      scrubberOffsetHours = 0;
      $("lunar-day-slider").value = 0;
      updateNavigator();
    });

    // Quick Scenario Presets
    document.querySelectorAll(".preset-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".preset-pill").forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        const preset = pill.dataset.preset;
        if (preset === "artemis3") {
          activeSiteKey = "shackleton";
          activeEpoch = new Date("2026-10-24T12:00:00Z");
        } else if (preset === "solstice") {
          activeSiteKey = "malapert_mountain";
          activeEpoch = new Date("2026-12-21T06:00:00Z"); // southern summer max sun
        } else if (preset === "im1") {
          activeSiteKey = "im1_odysseus";
          activeEpoch = new Date("2024-02-22T23:23:00Z");
        } else if (preset === "chandrayaan3") {
          activeSiteKey = "chandrayaan3";
          activeEpoch = new Date("2023-08-23T12:34:00Z");
        } else if (preset === "apollo11") {
          activeSiteKey = "apollo11";
          activeEpoch = new Date("1969-07-20T20:17:00Z");
        }
        $("target-site-select").value = activeSiteKey;
        syncCoordinateInputs(SITES_DATA[activeSiteKey]);
        dateInput.value = activeEpoch.toISOString().substring(0, 16);
        scrubberOffsetHours = 0;
        $("lunar-day-slider").value = 0;
        updateNavigator();
        updateComparatorTable();
      });
    });

    // Temporal Scrubber
    const slider = $("lunar-day-slider");
    slider.addEventListener("input", (e) => {
      scrubberOffsetHours = Number(e.target.value);
      updateNavigator();
    });

    $("scrubber-step-back-day").addEventListener("click", () => {
      scrubberOffsetHours = Math.max(0, scrubberOffsetHours - 24);
      slider.value = scrubberOffsetHours;
      updateNavigator();
    });
    $("scrubber-step-back-hr").addEventListener("click", () => {
      scrubberOffsetHours = Math.max(0, scrubberOffsetHours - 1);
      slider.value = scrubberOffsetHours;
      updateNavigator();
    });
    $("scrubber-step-fwd-hr").addEventListener("click", () => {
      scrubberOffsetHours = Math.min(708.7, scrubberOffsetHours + 1);
      slider.value = scrubberOffsetHours;
      updateNavigator();
    });
    $("scrubber-step-fwd-day").addEventListener("click", () => {
      scrubberOffsetHours = Math.min(708.7, scrubberOffsetHours + 24);
      slider.value = scrubberOffsetHours;
      updateNavigator();
    });
    $("scrubber-reset").addEventListener("click", () => {
      scrubberOffsetHours = 0;
      slider.value = 0;
      updateNavigator();
    });

    $("scrubber-play").addEventListener("click", () => {
      isScrubberPlaying = !isScrubberPlaying;
      $("scrubber-play").textContent = isScrubberPlaying ? "⏸ Pause Cycle" : "▶ Play 30d Cycle";
      if (isScrubberPlaying) {
        scrubberPlayTimer = setInterval(() => {
          scrubberOffsetHours = (scrubberOffsetHours + 2) % 708.7;
          slider.value = scrubberOffsetHours;
          updateNavigator();
        }, 60);
      } else {
        clearInterval(scrubberPlayTimer);
      }
    });

    // Viz Tab switching (3D Globe vs 3D Dome vs 2D Map)
    const tabGlobe = $("tab-3d-globe");
    const tabDome = $("tab-3d-dome");
    const tabMap = $("tab-2d-map");

    if (tabGlobe) {
      tabGlobe.addEventListener("click", () => {
        tabGlobe.classList.add("active");
        if (tabDome) tabDome.classList.remove("active");
        if (tabMap) tabMap.classList.remove("active");
        if ($("globe-view-container")) $("globe-view-container").hidden = false;
        if ($("dome-view-container")) $("dome-view-container").hidden = true;
        if ($("map-view-container")) $("map-view-container").hidden = true;
        if (globeRenderer && globeCamera && $("globe-canvas")) {
          const rw = $("globe-canvas").clientWidth || 800;
          const rh = $("globe-canvas").clientHeight || 460;
          globeCamera.aspect = rw / (rh || 1);
          globeCamera.updateProjectionMatrix();
          globeRenderer.setSize(rw, rh, false);
        }
      });
    }

    if (tabDome) {
      tabDome.addEventListener("click", () => {
        tabDome.classList.add("active");
        if (tabGlobe) tabGlobe.classList.remove("active");
        if (tabMap) tabMap.classList.remove("active");
        if ($("globe-view-container")) $("globe-view-container").hidden = true;
        if ($("dome-view-container")) $("dome-view-container").hidden = false;
        if ($("map-view-container")) $("map-view-container").hidden = true;
        updateNavigator();
      });
    }

    if (tabMap) {
      tabMap.addEventListener("click", () => {
        tabMap.classList.add("active");
        if (tabGlobe) tabGlobe.classList.remove("active");
        if (tabDome) tabDome.classList.remove("active");
        if ($("globe-view-container")) $("globe-view-container").hidden = true;
        if ($("dome-view-container")) $("dome-view-container").hidden = true;
        if ($("map-view-container")) $("map-view-container").hidden = false;
        renderLunarMap();
      });
    }

    // Comparator selects
    $("comp-site-1").addEventListener("change", updateComparatorTable);
    $("comp-site-2").addEventListener("change", updateComparatorTable);
    $("comp-site-3").addEventListener("change", updateComparatorTable);
  }

  function setupMissionCards() {
    $("mission-cards").innerHTML = MISSION_DATA.map((mission) => `
      <article class="mission-card">
        <p class="mission-number">APOLLO ${mission.id}</p>
        <h3>${mission.site}</h3>
        <dl>
          <div><dt>Landing date</dt><dd>${mission.date}</dd></div>
          <div><dt>Crew</dt><dd>${mission.crew}</dd></div>
          <div><dt>EVA time</dt><dd>${mission.surfaceHours.toFixed(2)} h</dd></div>
          <div><dt>Samples returned</dt><dd>${mission.samplesKg.toFixed(2)} kg</dd></div>
          <div><dt>Lander</dt><dd>Lunar Module ${mission.lander}</dd></div>
        </dl>
        <a class="source" href="${mission.source}" target="_blank" rel="noopener">NASA mission record ↗</a>
      </article>`).join("");
  }

  function setupGallery() {
    $("gallery-grid").innerHTML = GALLERY.map((item, index) => `
      <figure class="gallery-card">
        <button type="button" class="thumb gallery-open" data-image="${index}" data-full="${item.full || item.src}" data-cap="${item.caption} Credit: NASA." aria-label="Open ${item.title}">
          <img src="${item.src}" alt="${item.alt}" width="800" height="600" loading="lazy">
        </button>
        <figcaption><strong>${item.title}</strong><span>${item.caption}</span><small>NASA ID: ${item.id}</small><a href="${item.nasa}" target="_blank" rel="noopener">Source ↗</a></figcaption>
      </figure>`).join("");

    $("gallery-grid").addEventListener("click", (e) => {
      const btn = e.target.closest(".thumb[data-image]");
      if (btn) openLightbox(Number(btn.dataset.image), btn);
    });
    $("lightbox-close").addEventListener("click", () => $("lightbox").close());
    $("lightbox-prev").addEventListener("click", () => openLightbox((lightboxIndex - 1 + GALLERY.length) % GALLERY.length));
    $("lightbox-next").addEventListener("click", () => openLightbox((lightboxIndex + 1) % GALLERY.length));
    $("lightbox").addEventListener("click", (e) => { if (e.target === $("lightbox")) $("lightbox").close(); });
  }

  let lightboxIndex = 0;
  function openLightbox(index, btn) {
    lightboxIndex = index;
    const item = GALLERY[index];
    $("lightbox-image").src = btn?.dataset.full || item.full || item.src;
    $("lightbox-image").alt = item.alt;
    $("lightbox-caption").textContent = `${btn?.dataset.cap || item.caption} · NASA ID ${item.id}`;
    $("lightbox").showModal();
  }

  function setupCodeTabs() {
    document.querySelectorAll(".tabs [role=tab]").forEach((tab) => tab.addEventListener("click", () => {
      document.querySelectorAll(".tabs [role=tab]").forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
      document.querySelectorAll(".code-panel").forEach((panel) => { panel.hidden = panel.id !== tab.dataset.code; });
    }));
  }

  async function submitScore() {
    if (!lastReport || !lastReport.safe) return;
    const name = $("report-name").value.trim();
    if (!name) {
      $("report-status").textContent = "Enter a pilot name before submitting.";
      $("report-name").focus();
      return;
    }
    $("report-save").disabled = true;
    $("report-status").textContent = "Validating descent trace with server…";
    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.slice(0, 24), difficulty, inputs: latestTrace })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Server status ${response.status}`);
      $("report-status").textContent = `Verified! Official score: ${result.score}.`;
      await loadLeaderboard();
    } catch (error) {
      $("report-status").textContent = `Score verification offline: ${error.message}.`;
      $("report-save").disabled = false;
    }
  }

  async function loadLeaderboard() {
    const body = $("lb");
    if (window.location.protocol === "file:") {
      body.innerHTML = '<tr><td colspan="7">Verified scores require the JDK server. Open http://localhost:8080/ after starting it.</td></tr>';
      return;
    }

    try {
      const response = await fetch("/api/leaderboard");
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const rows = await response.json();
      body.textContent = "";
      if (!rows.length) {
        body.innerHTML = '<tr><td colspan="7">No verified flights yet. Be the first to land safely.</td></tr>';
      } else {
        rows.forEach((row, idx) => {
          const tr = document.createElement("tr");
          [idx + 1, row.name, row.difficulty, `${row.verticalSpeed.toFixed(2)} m/s`,
            `${row.horizontalSpeed.toFixed(2)} m/s`, `${row.tiltDeg.toFixed(1)}°`, row.score]
            .forEach((val) => {
              const td = document.createElement("td");
              td.textContent = String(val);
              tr.appendChild(td);
            });
          body.appendChild(tr);
        });
      }
    } catch (e) {
      body.innerHTML = '<tr><td colspan="7">Leaderboard offline. Start JDK server to sync scores.</td></tr>';
    }
  }

  $("report-save").addEventListener("click", submitScore);

  function updateFrame(now) {
    requestAnimationFrame(updateFrame);
    const elapsed = Math.min((now - previousFrameTime) / 1000, 0.1);
    previousFrameTime = now;

    if (mode === "running") {
      frameAccumulator += elapsed;
      while (frameAccumulator >= FIXED_DT && mode === "running") {
        advanceFlight();
        frameAccumulator -= FIXED_DT;
      }
    } else if (mode === "replay") {
      renderReplayFrame();
    }

    if (world && world.earth) {
      world.earth.rotation.y += elapsed * 0.012;
    }
    updateWorld();
    renderer.render(scene, camera);
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.camera) settings.camera = parsed.camera;
        if (parsed.keyMap) settings.keyMap = { ...DEFAULT_KEYS, ...parsed.keyMap };
      }
    } catch (e) {}
  }

  // BOOTSTRAP APP
  loadSettings();
  SoundFX.init();
  world = createWorld();
  setupControls();
  setupMissionCards();
  setupGallery();
  setupCodeTabs();
  loadLeaderboard();
  initGlobeVisualizer();
  initDomeVisualizer();
  setupMapInteractions();
  setupNavigatorInteractions();
  updateComparatorTable();
  updateNavigator();

  state = {
    y: DIFFICULTIES.normal.altitude,
    verticalSpeed: DIFFICULTIES.normal.initialVy,
    x: 0, z: 0, vx: 0, vz: 0,
    pitch: 0, roll: 0,
    fuelKg: VEHICLE.fuelCapacity,
    contacts: [false, false, false, false],
    elapsed: 0,
    landed: false
  };
  updateWorld();
  requestAnimationFrame(updateFrame);
})();
