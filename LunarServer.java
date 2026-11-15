import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;

/** JDK-only HTTP server for the simulator, replay verification, and score table. */
public final class LunarServer {
    private static final int PORT = 8080;
    private static final int MAX_BODY_BYTES = 1_500_000;
    private static final Path PUBLIC_ROOT = Files.isDirectory(Path.of("public"))
            ? Path.of("public").toAbsolutePath().normalize()
            : Path.of(".").toAbsolutePath().normalize();
    private static final List<Score> SCORES = new CopyOnWriteArrayList<>();

    private record Score(String name, String difficulty, double verticalSpeed,
                         double horizontalSpeed, double tiltDeg, int score) { }

    private LunarServer() { }

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 64);
        server.createContext("/", LunarServer::handle);
        server.setExecutor(Executors.newFixedThreadPool(
                Math.max(4, Runtime.getRuntime().availableProcessors())));
        Runtime.getRuntime().addShutdownHook(new Thread(() -> server.stop(1), "lunar-server-shutdown"));
        server.start();
        System.out.println("Lunar Landing listening at http://localhost:" + PORT);
        System.out.println("Serving files from " + PUBLIC_ROOT);
    }

    private static void handle(HttpExchange exchange) throws IOException {
        addSecurityHeaders(exchange);
        String path = exchange.getRequestURI().getPath();
        String method = exchange.getRequestMethod();
        try {
            if ("/api/leaderboard".equals(path)) {
                if (!"GET".equals(method)) {
                    sendJson(exchange, 405, "{\"error\":\"Use GET for the leaderboard.\"}");
                    return;
                }
                sendJson(exchange, 200, leaderboardJson());
                return;
            }
            if ("/api/scores".equals(path)) {
                if (!"POST".equals(method)) {
                    sendJson(exchange, 405, "{\"error\":\"Use POST to submit a flight.\"}");
                    return;
                }
                submitScore(exchange);
                return;
            }
            if (path.startsWith("/api/")) {
                sendJson(exchange, 404, "{\"error\":\"API endpoint not found.\"}");
                return;
            }
            if (!"GET".equals(method) && !"HEAD".equals(method)) {
                sendText(exchange, 405, "Method not allowed.");
                return;
            }
            serveStatic(exchange, path, "HEAD".equals(method));
        } finally {
            exchange.close();
        }
    }

    private static void submitScore(HttpExchange exchange) throws IOException {
        byte[] body = exchange.getRequestBody().readNBytes(MAX_BODY_BYTES + 1);
        if (body.length > MAX_BODY_BYTES) {
            sendJson(exchange, 413, "{\"error\":\"Flight recording is too large.\"}");
            return;
        }
        try {
            String json = new String(body, StandardCharsets.UTF_8);
            String name = parseStringField(json, "name").strip();
            if (name.isBlank()) throw new IllegalArgumentException("Pilot name is required.");
            name = name.replaceAll("[\\p{Cntrl}]", "");
            if (name.isBlank()) throw new IllegalArgumentException("Pilot name is required.");
            if (name.length() > 24) name = name.substring(0, 24);

            LunarPhysics.Difficulty difficulty =
                    LunarPhysics.Difficulty.fromString(parseStringField(json, "difficulty"));
            List<LunarPhysics.Input> inputs = parseInputs(json);
            LunarPhysics.Result result = LunarPhysics.simulate(difficulty, inputs);
            if (!result.safe()) {
                sendJson(exchange, 422, "{\"error\":\"The server replay did not meet safe-landing limits.\"}");
                return;
            }

            Score score = new Score(name, difficulty.name().toLowerCase(Locale.ROOT),
                    result.verticalSpeed(), result.horizontalSpeed(), result.tiltDeg(), result.score());
            synchronized (SCORES) {
                SCORES.add(score);
                SCORES.sort(Comparator.comparingInt(Score::score).reversed()
                        .thenComparingDouble(Score::verticalSpeed)
                        .thenComparing(Score::name, String.CASE_INSENSITIVE_ORDER));
                while (SCORES.size() > 10) SCORES.remove(SCORES.size() - 1);
            }

            sendJson(exchange, 201, "{\"verified\":true,\"score\":" + result.score()
                    + ",\"verticalSpeed\":" + number(result.verticalSpeed())
                    + ",\"horizontalSpeed\":" + number(result.horizontalSpeed())
                    + ",\"tiltDeg\":" + number(result.tiltDeg())
                    + ",\"fuelPercent\":" + number(result.fuelPercent())
                    + ",\"padDistance\":" + number(result.padDistance())
                    + ",\"frames\":" + result.frames() + "}");
        } catch (IllegalArgumentException exception) {
            sendJson(exchange, 400, "{\"error\":" + jsonString(exception.getMessage()) + "}");
        }
    }

    private static List<LunarPhysics.Input> parseInputs(String json) {
        int key = json.indexOf("\"inputs\"");
        if (key < 0) throw new IllegalArgumentException("Missing control recording.");
        int arrayStart = json.indexOf('[', key + 8);
        if (arrayStart < 0) throw new IllegalArgumentException("Invalid control recording.");
        int depth = 0;
        int arrayEnd = -1;
        for (int i = arrayStart; i < json.length(); i++) {
            char current = json.charAt(i);
            if (current == '[') depth++;
            if (current == ']') {
                depth--;
                if (depth == 0) {
                    arrayEnd = i;
                    break;
                }
            }
        }
        if (arrayEnd < 0) throw new IllegalArgumentException("Unclosed control recording.");

        List<LunarPhysics.Input> inputs = new ArrayList<>();
        int cursor = arrayStart + 1;
        while (true) {
            cursor = skipWhitespace(json, cursor);
            if (cursor >= arrayEnd) break;
            if (json.charAt(cursor) == ',') {
                cursor++;
                continue;
            }
            if (json.charAt(cursor) != '[') throw new IllegalArgumentException("Invalid control frame.");
            cursor++;
            int[] values = new int[5];
            for (int i = 0; i < values.length; i++) {
                cursor = skipWhitespace(json, cursor);
                int start = cursor;
                if (cursor < json.length() && json.charAt(cursor) == '-') cursor++;
                while (cursor < json.length() && Character.isDigit(json.charAt(cursor))) cursor++;
                if (cursor == start || (cursor == start + 1 && json.charAt(start) == '-')) {
                    throw new IllegalArgumentException("Control frames must contain integers.");
                }
                try {
                    values[i] = Integer.parseInt(json.substring(start, cursor));
                } catch (NumberFormatException exception) {
                    throw new IllegalArgumentException("Control value is out of range.");
                }
                cursor = skipWhitespace(json, cursor);
                if (i < values.length - 1) {
                    if (cursor >= json.length() || json.charAt(cursor) != ',') {
                        throw new IllegalArgumentException("Each control frame needs five values.");
                    }
                    cursor++;
                }
            }
            cursor = skipWhitespace(json, cursor);
            if (cursor >= json.length() || json.charAt(cursor) != ']') {
                throw new IllegalArgumentException("Malformed control frame.");
            }
            cursor++;
            if (values[4] != 0 && values[4] != 1) {
                throw new IllegalArgumentException("Fine-control flag must be zero or one.");
            }
            inputs.add(new LunarPhysics.Input(values[0], values[1], values[2], values[3], values[4] == 1));
            if (inputs.size() > 18_000) throw new IllegalArgumentException("Too many control frames.");
        }
        if (inputs.isEmpty()) throw new IllegalArgumentException("Flight recording is empty.");
        return inputs;
    }

    private static String parseStringField(String json, String field) {
        int key = json.indexOf("\"" + field + "\"");
        if (key < 0) throw new IllegalArgumentException("Missing " + field + ".");
        int colon = json.indexOf(':', key + field.length() + 2);
        if (colon < 0) throw new IllegalArgumentException("Invalid " + field + ".");
        int cursor = skipWhitespace(json, colon + 1);
        if (cursor >= json.length() || json.charAt(cursor) != '"') {
            throw new IllegalArgumentException(field + " must be a string.");
        }
        StringBuilder value = new StringBuilder();
        for (int i = cursor + 1; i < json.length(); i++) {
            char current = json.charAt(i);
            if (current == '"') return value.toString();
            if (current < 0x20) throw new IllegalArgumentException("Invalid string value.");
            if (current != '\\') {
                value.append(current);
                continue;
            }
            if (++i >= json.length()) throw new IllegalArgumentException("Invalid string escape.");
            char escaped = json.charAt(i);
            switch (escaped) {
                case '"', '\\', '/' -> value.append(escaped);
                case 'b' -> value.append('\b');
                case 'f' -> value.append('\f');
                case 'n' -> value.append('\n');
                case 'r' -> value.append('\r');
                case 't' -> value.append('\t');
                case 'u' -> {
                    if (i + 4 >= json.length()) throw new IllegalArgumentException("Invalid Unicode escape.");
                    try {
                        value.append((char) Integer.parseInt(json.substring(i + 1, i + 5), 16));
                    } catch (NumberFormatException exception) {
                        throw new IllegalArgumentException("Invalid Unicode escape.");
                    }
                    i += 4;
                }
                default -> throw new IllegalArgumentException("Invalid string escape.");
            }
        }
        throw new IllegalArgumentException("Unclosed string value.");
    }

    private static int skipWhitespace(String value, int cursor) {
        while (cursor < value.length() && Character.isWhitespace(value.charAt(cursor))) cursor++;
        return cursor;
    }

    private static String leaderboardJson() {
        StringBuilder result = new StringBuilder("[");
        synchronized (SCORES) {
            for (int i = 0; i < SCORES.size(); i++) {
                if (i > 0) result.append(',');
                Score row = SCORES.get(i);
                result.append("{\"name\":").append(jsonString(row.name()))
                        .append(",\"difficulty\":").append(jsonString(row.difficulty()))
                        .append(",\"verticalSpeed\":").append(number(row.verticalSpeed()))
                        .append(",\"horizontalSpeed\":").append(number(row.horizontalSpeed()))
                        .append(",\"tiltDeg\":").append(number(row.tiltDeg()))
                        .append(",\"score\":").append(row.score()).append('}');
            }
        }
        return result.append(']').toString();
    }

    private static void serveStatic(HttpExchange exchange, String requestPath, boolean headOnly) throws IOException {
        String relative = requestPath.equals("/") ? "index.html" : requestPath.substring(1);
        Path file = PUBLIC_ROOT.resolve(relative).normalize();
        if (!file.startsWith(PUBLIC_ROOT) || !Files.isRegularFile(file)) {
            sendText(exchange, 404, "Not found.");
            return;
        }
        byte[] contents = Files.readAllBytes(file);
        exchange.getResponseHeaders().set("Content-Type", contentType(file));
        exchange.getResponseHeaders().set("Cache-Control", "no-cache");
        exchange.sendResponseHeaders(200, headOnly ? -1 : contents.length);
        if (!headOnly) exchange.getResponseBody().write(contents);
    }

    private static String contentType(Path file) {
        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.endsWith(".html")) return "text/html; charset=utf-8";
        if (name.endsWith(".css")) return "text/css; charset=utf-8";
        if (name.endsWith(".js")) return "text/javascript; charset=utf-8";
        if (name.endsWith(".json")) return "application/json; charset=utf-8";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".webp")) return "image/webp";
        if (name.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    private static void addSecurityHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.getResponseHeaders().set("Referrer-Policy", "strict-origin-when-cross-origin");
        exchange.getResponseHeaders().set("X-Frame-Options", "DENY");
    }

    private static void sendJson(HttpExchange exchange, int status, String body) throws IOException {
        send(exchange, status, "application/json; charset=utf-8", body);
    }

    private static void sendText(HttpExchange exchange, int status, String body) throws IOException {
        send(exchange, status, "text/plain; charset=utf-8", body);
    }

    private static void send(HttpExchange exchange, int status, String type, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", type);
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    private static String number(double value) {
        return String.format(Locale.ROOT, "%.6f", value);
    }

    private static String jsonString(String value) {
        StringBuilder escaped = new StringBuilder("\"");
        for (char character : value.toCharArray()) {
            switch (character) {
                case '"' -> escaped.append("\\\"");
                case '\\' -> escaped.append("\\\\");
                case '\b' -> escaped.append("\\b");
                case '\f' -> escaped.append("\\f");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> {
                    if (character < 0x20) escaped.append(String.format(Locale.ROOT, "\\u%04x", (int) character));
                    else escaped.append(character);
                }
            }
        }
        return escaped.append('"').toString();
    }
}
