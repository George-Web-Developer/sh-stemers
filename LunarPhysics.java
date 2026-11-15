import java.util.List;

/** Deterministic fixed-step lunar descent model shared with the browser simulator. */
public final class LunarPhysics {
    public static final double STEP_SECONDS = 1.0 / 30.0;
    public static final double DRY_MASS_KG = 5200.0;
    public static final double FUEL_CAPACITY_KG = 1800.0;
    public static final double EXHAUST_VELOCITY_MPS = 3000.0;
    public static final double INITIAL_ACCELERATION_MPS2 = 4.2;
    public static final double SAFE_VERTICAL_MPS = 2.5;
    public static final double SAFE_HORIZONTAL_MPS = 1.5;
    public static final double SAFE_TILT_DEG = 10.0;
    private static final double ATTITUDE_RATE_DEG_PER_SEC = 14.0;
    private static final double ATTITUDE_LIMIT_RAD = Math.PI / 7.0;
    private static final double LATERAL_ACCELERATION = 0.9;
    private static final double LATERAL_FINE_SCALE = 0.35;
    private static final double ATTITUDE_STABILIZATION = 0.995;
    private static final double HORIZONTAL_DRIFT_DAMPING_PER_SEC = 0.35;

    public enum Difficulty {
        EASY(560.0, 1.45, 0.45, 1.0, -11.0),
        NORMAL(400.0, 1.62, 1.0, 1.0, -15.0),
        HARD(290.0, 1.82, 1.8, 0.8, -17.0);

        public final double startAltitude;
        public final double gravity;
        public final double terrainRoughness;
        public final double fuelFraction;
        public final double initialVerticalSpeed;

        Difficulty(double startAltitude, double gravity, double terrainRoughness,
                   double fuelFraction, double initialVerticalSpeed) {
            this.startAltitude = startAltitude;
            this.gravity = gravity;
            this.terrainRoughness = terrainRoughness;
            this.fuelFraction = fuelFraction;
            this.initialVerticalSpeed = initialVerticalSpeed;
        }

        public static Difficulty fromString(String value) {
            try {
                return Difficulty.valueOf(value.toUpperCase());
            } catch (IllegalArgumentException | NullPointerException exception) {
                throw new IllegalArgumentException("Unknown difficulty.");
            }
        }
    }

    public record Input(int throttle, int lateral, int pitch, int roll, boolean fine) {
        public Input {
            if (throttle < 0 || throttle > 100
                    || lateral < -100 || lateral > 100
                    || pitch < -100 || pitch > 100
                    || roll < -100 || roll > 100) {
                throw new IllegalArgumentException("Control values are out of range.");
            }
        }
    }

    public static final class State {
        public double y;
        public double verticalSpeed;
        public double x;
        public double z;
        public double vx;
        public double vz;
        public double pitch;
        public double roll;
        public double fuelKg;
        public double elapsed;
        public boolean landed;

        private State(Difficulty difficulty) {
            y = difficulty.startAltitude;
            verticalSpeed = difficulty.initialVerticalSpeed;
            fuelKg = FUEL_CAPACITY_KG * difficulty.fuelFraction;
        }

        private State(State source) {
            y = source.y;
            verticalSpeed = source.verticalSpeed;
            x = source.x;
            z = source.z;
            vx = source.vx;
            vz = source.vz;
            pitch = source.pitch;
            roll = source.roll;
            fuelKg = source.fuelKg;
            elapsed = source.elapsed;
            landed = source.landed;
        }
    }

    public record Result(double verticalSpeed, double horizontalSpeed, double tiltDeg,
                         double fuelPercent, double padDistance, int score,
                         boolean safe, int frames, State touchdown) { }

    private LunarPhysics() { }

    public static Result simulate(Difficulty difficulty, List<Input> inputs) {
        if (inputs == null || inputs.isEmpty() || inputs.size() > 18_000) {
            throw new IllegalArgumentException("A flight must contain 1 to 18000 control frames.");
        }
        State state = new State(difficulty);
        int frames = 0;
        for (Input input : inputs) {
            if (state.landed) {
                throw new IllegalArgumentException("The control trace contains frames after touchdown.");
            }
            step(state, input, difficulty);
            frames++;
        }
        if (!state.landed) {
            throw new IllegalArgumentException("The submitted control trace did not reach touchdown.");
        }

        double vertical = Math.abs(state.verticalSpeed);
        double horizontal = Math.hypot(state.vx, state.vz);
        double tilt = Math.hypot(state.pitch, state.roll) * 180.0 / Math.PI;
        double fuel = state.fuelKg / FUEL_CAPACITY_KG * 100.0;
        double distance = Math.hypot(state.x, state.z);
        boolean safe = vertical <= SAFE_VERTICAL_MPS
                && horizontal <= SAFE_HORIZONTAL_MPS
                && tilt <= SAFE_TILT_DEG;
        int score = safe
                ? (int) Math.max(0, Math.round(1000 - 120 * vertical - 90 * horizontal
                    - 4 * tilt - 6 * distance + 2 * fuel))
                : 0;
        return new Result(vertical, horizontal, tilt, fuel, distance, score, safe, frames, new State(state));
    }

    private static void step(State state, Input input, Difficulty difficulty) {
        double requestedThrust = INITIAL_ACCELERATION_MPS2
                * (DRY_MASS_KG + FUEL_CAPACITY_KG) * input.throttle / 100.0;
        double requestedFuel = requestedThrust / EXHAUST_VELOCITY_MPS * STEP_SECONDS;
        double burnFraction = requestedFuel > 0 && state.fuelKg > 0
                ? Math.min(1.0, state.fuelKg / requestedFuel) : 0.0;
        double thrust = requestedThrust * burnFraction;
        double acceleration = thrust / (DRY_MASS_KG + state.fuelKg);
        double attitudeRate = (input.fine ? 0.5 : 1.0)
                * Math.PI / 180.0 * ATTITUDE_RATE_DEG_PER_SEC;
        state.pitch = clamp(state.pitch + input.pitch / 100.0 * attitudeRate * STEP_SECONDS,
                -ATTITUDE_LIMIT_RAD, ATTITUDE_LIMIT_RAD);
        state.roll = clamp(state.roll + input.roll / 100.0 * attitudeRate * STEP_SECONDS,
                -ATTITUDE_LIMIT_RAD, ATTITUDE_LIMIT_RAD);
        if (input.pitch == 0) state.pitch *= ATTITUDE_STABILIZATION;
        if (input.roll == 0) state.roll *= ATTITUDE_STABILIZATION;

        double verticalThrust = acceleration * Math.cos(state.pitch) * Math.cos(state.roll);
        double lateralScale = input.fine ? LATERAL_FINE_SCALE : 1.0;
        double horizontalX = acceleration * Math.sin(state.pitch)
                + input.lateral / 100.0 * LATERAL_ACCELERATION * lateralScale;
        double horizontalZ = acceleration * Math.sin(state.roll);
        state.verticalSpeed += (verticalThrust - difficulty.gravity) * STEP_SECONDS;
        state.vx += horizontalX * STEP_SECONDS;
        state.vz += horizontalZ * STEP_SECONDS;
        double driftRetention = Math.exp(-HORIZONTAL_DRIFT_DAMPING_PER_SEC * STEP_SECONDS);
        state.vx *= driftRetention;
        state.vz *= driftRetention;
        state.x += state.vx * STEP_SECONDS;
        state.z += state.vz * STEP_SECONDS;
        state.y += state.verticalSpeed * STEP_SECONDS;
        state.fuelKg = Math.max(0, state.fuelKg - thrust / EXHAUST_VELOCITY_MPS * STEP_SECONDS);
        state.elapsed += STEP_SECONDS;

        double ground = terrainHeight(state.x, state.z, difficulty.terrainRoughness);
        if (state.y <= ground) {
            state.y = ground;
            state.landed = true;
        }
    }

    private static double terrainHeight(double x, double z, double roughness) {
        double padBlend = Math.min(1.0, Math.hypot(x, z) / 8.0);
        double rough = Math.sin(x * 0.08) * Math.cos(z * 0.067) * 0.35
                + Math.sin(x * 0.23 + z * 0.19) * 0.12;
        return rough * roughness * padBlend * padBlend;
    }

    private static double clamp(double value, double minimum, double maximum) {
        return Math.min(maximum, Math.max(minimum, value));
    }
}
