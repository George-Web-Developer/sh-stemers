# Lunar Landing Site Navigator & Orbital Flight Lab
**NASA International Space Apps Challenge 2026**
*Challenge Track: Lunar Landing Site Navigator*
*Challenge URL:* [https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/)

---

## Overview

Missions to the Moon’s south pole face extreme lighting and communication constraints. Planning lunar missions requires coordinated evaluation between science and engineering teams. This application provides an intuitive mission planning and educational platform to rapidly compare candidate landing sites and landing dates, visualizing Sun and Earth positions relative to the local lunar horizon to evaluate:
1. **Solar Power Generation Potential**: High-precision solar elevation angles, grazing sun dynamics, vertical array irradiance, and daylight duration.
2. **Direct-to-Earth (DTE) Communication Windows**: Real-time line-of-sight tracking accounting for the Moon's optical and physical libration wobble ($\pm 6.7^\circ$ latitude and $\pm 7.9^\circ$ longitude), identifying blackout phases and relay satellite requirements.
3. **Terrain & Shadow Obstruction Profile**: Modeling crater rim elevations, Permanently Shadowed Regions (PSRs) with cryogenic water-ice volatiles, and Peaks of Eternal Light (PELs).
4. **Interactive Multi-Site Comparator**: Side-by-side trade-off matrix for mission planners evaluating shifts in launch schedules or rover landing targets.
5. **High-Fidelity 3D Lunar Descent Simulator**: Realistic variable-mass flight mechanics with a complex multi-stage lunar lander featuring gold Kapton MLI blankets, titanium bell engine, 4 articulated shock-absorbing landing gear legs with contact probes, active RCS attitude thruster firings, and polar grazing lighting.
6. **Classified Deep Space Telemetry Easter Egg**: A classified transmission located in the bottom-right corner at the end of the website.

---

## Challenge Features & Tools

### 1. Interactive Site Selection & Comparison
- **Curated Landing Sites**:
  - **Artemis III South Pole Candidate Sites**: Shackleton Crater Rim, Connecting Ridge, Malapert Mountain (Peak), de Gerlache Rim 2, Peak Near Shackleton, Haworth Crater Rim, Nobile Rim 1 (VIPER site), Faustini Rim A, Amundsen Rim.
  - **CLPS Commercial Missions**: Intuitive Machines IM-1 Odysseus (Malapert A), IM-2 Athena (Shackleton Ridge), Astrobotic Griffin / VIPER (Mons Mouton), Firefly Blue Ghost 1 (Mare Crisium), ispace HAKUTO-R (Atlas Crater).
  - **Historic Apollo Heritage**: Apollo 11, 12, 14, 15, 16, 17.
  - **International Programs**: ISRO Chandrayaan-3 (Shiv Shakti Point), CNSA Chang'e 4 (Far Side Von Kármán), Chang'e 6 (Far Side Sample), JAXA SLIM (Shioli Crater).
  - **Custom Coordinates**: Full manual latitude ($-90^\circ$ to $+90^\circ$), longitude ($-180^\circ$ to $+180^\circ$), elevation, and horizon mask angle inputs.
- **Side-by-Side Comparator**: Select any 3 sites to view side-by-side trade-offs in solar availability, maximum continuous night, Earth line-of-sight %, blackout duration, slope risk, and relay satellite dependency.

### 2. Ephemeris & Temporal Dynamics
- **UTC Date & Time Flexibility**: Select any landing epoch with instant presets (Artemis III 2026 Window, Peak South Pole Summer Solstice, IM-1 Odysseus, Chandrayaan-3, Apollo 11, Current Time). Dates matching known lunar missions automatically select that mission's site and update its latitude, longitude, and elevation; other dates retain the selected site.
- **29.53-Day Synodic Lunar Day Scrubber**: Real-time slider and playback engine animating solar and Earth celestial trajectories across an entire lunar day.

### 3. Multiple Visualization Paradigms
- **3D Celestial Horizon Dome Visualizer**: Interactive 3D hemispherical observer dome rendering the candidate site horizon, 360° compass ring, elevation altitude rings, Sun position with orbital trail, Earth position with line-of-sight vector, and terrain obstruction mask.
- **Interactive 2D Lunar Map**: Switch between South Pole Polar Stereographic projection (60°S to 90°S) and Global Equirectangular projection. Click anywhere on the map to evaluate custom coordinates.
- **30-Day Illumination & Comms Timeline Chart**: High-resolution canvas chart plotting continuous solar and Earth elevation curves over 29.53 days with shaded communication and power windows.

### 4. NASA & Partner Integration
- Direct one-click links to official space agency mission tools:
  - **NASA Quickmap (LROC / ASU)**: Opens candidate coordinates with NAC high-resolution layers.
  - **NASA Moon Trek**: 3D planetary GIS elevation profiles.
  - **JPL Horizons Ephemeris System**: Direct queries for ephemeris vector generation.
  - **Canadian Space Agency (CSA) Moon Exploration**: Canadian contributions to Artemis and lunar rovers.

### 5. High-Fidelity 3D Lunar Descent Simulator
- **Realistic Complex Rocket Design**:
  - Octagonal descent chassis with gold Kapton MLI foil and silver mylar thermal blankets.
  - 4 external spherical propellant tanks with metallic mounting brackets.
  - Main de Laval titanium engine bell with gimbal ring and combustion throat glow.
  - 4 articulated landing gear assemblies with main telescoping oleo shock struts, secondary A-frame braces, inverted dish footpads, and surface contact probes.
  - Egress crew ladder on forward landing leg.
  - Ascent stage with faceted crew cabin, triangular EVA cockpit windows, overhead docking tunnel, steerable high-gain dish antenna, and rendezvous radar.
  - 4 RCS thruster quads with dynamic puff particle firings upon user attitude maneuvers.
  - Dual-stage supersonic rocket plume with Mach diamonds and vacuum expansion envelope.
  - Surface regolith swirling dust vortex upon landing approach.
- **Landing Environment Lighting**: Toggle between South Pole grazing sun ($1.5^\circ$) with dramatic elongated shadows and Apollo 11 high equatorial sun.
- **Built-in Web Audio API Synthesizer**: Realistic engine rumble, RCS thruster bursts, touchdown chimes, and UI telemetry blips.

---

## Run Locally

You can open `index.html` directly or serve the static files with Python or Node to use the planner and simulator. The verified leaderboard and score submission require the JDK server below; a static file server cannot handle the `/api` endpoints.

```powershell
# Using Python:
python -m http.server 8080

# Or using Node:
npx serve .
```

To run with the JDK deterministic replay verification server:

```powershell
New-Item -ItemType Directory -Force out | Out-Null
javac -d out LunarPhysics.java LunarServer.java
java -cp out LunarServer
```

Open <http://localhost:8080/>.

---

## Controls

| Input | Action |
| --- | --- |
| Hold `W` or `Space` | Gradually increase main engine throttle (`Shift` ramps more slowly) |
| `S` | Cut throttle |
| `A` / `D` or `←` / `→` | Lateral RCS thrust (left / right) |
| `↑` / `↓` | Pitch attitude |
| `Q` / `E` | Roll attitude |
| `Shift` | Fine attitude and lateral control; `Shift+Z/X` adjusts throttle in smaller steps |
| `Z` / `X` | Decrease / increase throttle by 5% |
| Throttle slider | Set continuous throttle from 0–100% |
| `R` | Restart flight simulation |
| `P` | Pause / resume |
| `C` | Cycle chase, cockpit, top-down, and cinematic cameras |
| Mouse drag / wheel | Orbit camera / zoom |
| Gamepad | Right trigger thrust, left stick pitch/roll, right stick lateral |
| Touch | Virtual attitude joystick, fine-control toggle, and throttle slider |

Attitude responds more gradually, returns gently toward level when released, and horizontal drift is lightly damped to make corrections easier.

---

## Attribution & Guidelines

- NASA Space Apps Challenge 2026: "Lunar Landing Site Navigator"
- Historical mission records sourced from NASA NSSDCA.
- Archival photography sourced from NASA Image and Video Library.
- Educational and analytical project; independent work not affiliated with or endorsed by NASA or the Canadian Space Agency.
