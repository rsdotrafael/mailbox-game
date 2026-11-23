package com.mailboxgame;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class MailboxServer {
    private static final List<Message> inboxMessages = new CopyOnWriteArrayList<>();
    private static final List<Message> sentMessages = new CopyOnWriteArrayList<>();
    private static final List<Message> draftMessages = new CopyOnWriteArrayList<>();

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/messages", MailboxServer::messages);
        server.createContext("/api/drafts", MailboxServer::drafts);
        server.createContext("/", MailboxServer::staticFile);
        server.start();
        System.out.println("Mailbox Game disponível em http://localhost:" + port);
    }

    private static void messages(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        if ("GET".equals(method)) {
            String query = exchange.getRequestURI().getQuery();
            List<Message> source = query != null && query.contains("folder=sent") ? sentMessages : inboxMessages;
            if (query != null && query.contains("folder=draft")) source = draftMessages;
            sendJson(exchange, 200, messagesJson(source)); return;
        }
        if ("POST".equals(method)) {
            String body = readBody(exchange);
            String recipient = extractJson(body, "recipient");
            String subject = extractJson(body, "subject");
            String content = extractJson(body, "content");
            if (recipient == null || recipient.isBlank() || subject == null || subject.isBlank()) { sendJson(exchange, 400, "{\"error\":\"Destinatário e assunto são obrigatórios\"}"); return; }
            String time = OffsetDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
            sentMessages.add(new Message(String.valueOf(System.currentTimeMillis()), "Você", recipient, subject, content == null ? "" : content, time));
            sendJson(exchange, 201, "{\"ok\":true}"); return;
        }
        if ("DELETE".equals(method)) {
            String query = exchange.getRequestURI().getQuery();
            String parsedId = null;
            boolean sentFolder = false;
            if (query != null) {
                for (String part : query.split("&")) {
                    if (part.startsWith("id=")) parsedId = URLDecoder.decode(part.substring(3), StandardCharsets.UTF_8);
                    if (part.equals("folder=sent")) sentFolder = true;
                }
            }
            String finalId = parsedId;
            if (finalId != null && sentFolder) sentMessages.removeIf(message -> message.id().equals(finalId));
            else if (finalId != null) inboxMessages.removeIf(message -> message.id().equals(finalId));
            sendJson(exchange, 200, "{\"ok\":true}"); return;
        }
        sendJson(exchange, 405, "{\"error\":\"Método não permitido\"}");
    }

    private static void drafts(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        if ("GET".equals(method)) { sendJson(exchange, 200, messagesJson(draftMessages)); return; }
        if ("POST".equals(method)) {
            String body = readBody(exchange);
            String requestedId = extractJson(body, "id");
            String recipient = extractJson(body, "recipient");
            String subject = extractJson(body, "subject");
            String content = extractJson(body, "content");
            String time = OffsetDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
            if ((recipient == null || recipient.isBlank()) && (subject == null || subject.isBlank()) && (content == null || content.isBlank())) { sendJson(exchange, 400, "{\"error\":\"Rascunho vazio\"}"); return; }
            String finalId = requestedId != null && !requestedId.isBlank() ? requestedId : String.valueOf(System.currentTimeMillis());
            Message draft = new Message(finalId, "Você", recipient == null ? "" : recipient, subject == null ? "" : subject, content == null ? "" : content, time);
            draftMessages.removeIf(item -> item.id().equals(finalId));
            draftMessages.add(draft);
            sendJson(exchange, 201, "{\"id\":" + jsonString(finalId) + "}"); return;
        }
        if ("DELETE".equals(method)) {
            String query = exchange.getRequestURI().getQuery();
            if (query != null && query.startsWith("id=")) {
                String id = URLDecoder.decode(query.substring(3), StandardCharsets.UTF_8);
                draftMessages.removeIf(item -> item.id().equals(id));
            }
            sendJson(exchange, 200, "{\"ok\":true}"); return;
        }
        sendJson(exchange, 405, "{\"error\":\"Método não permitido\"}");
    }

    private static String messagesJson(List<Message> source) { return "[" + String.join(",", source.stream().map(Message::toJson).toList()) + "]"; }
    private static void staticFile(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath(); if (path.equals("/")) path = "/index.html";
        Path file = Paths.get("src/main/resources/static", path.substring(1)).normalize();
        if (!Files.exists(file) || !Files.isRegularFile(file)) { sendBytes(exchange, 404, "text/plain; charset=utf-8", "Não encontrado".getBytes(StandardCharsets.UTF_8)); return; }
        String type = path.endsWith(".css") ? "text/css; charset=utf-8" : path.endsWith(".js") ? "application/javascript; charset=utf-8" : path.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream";
        sendBytes(exchange, 200, type, Files.readAllBytes(file));
    }
    private static String readBody(HttpExchange exchange) throws IOException { try (InputStream input = exchange.getRequestBody()) { return new String(input.readAllBytes(), StandardCharsets.UTF_8); } }
    private static String extractJson(String json, String key) {
        String marker = "\"" + key + "\""; int keyIndex = json.indexOf(marker); if (keyIndex < 0) return null;
        int colon = json.indexOf(':', keyIndex + marker.length()); int start = json.indexOf('"', colon + 1); if (start < 0) return null;
        StringBuilder value = new StringBuilder();
        for (int i = start + 1; i < json.length(); i++) { char c = json.charAt(i); if (c == '\\' && i + 1 < json.length()) { char next = json.charAt(++i); value.append(next == 'n' ? '\n' : next == 'r' ? '\r' : next == 't' ? '\t' : next); } else if (c == '"') break; else value.append(c); }
        return value.toString();
    }
    private static String jsonString(String value) { return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\""; }
    private static void sendJson(HttpExchange exchange, int status, String json) throws IOException { sendBytes(exchange, status, "application/json; charset=utf-8", json.getBytes(StandardCharsets.UTF_8)); }
    private static void sendBytes(HttpExchange exchange, int status, String type, byte[] bytes) throws IOException { exchange.getResponseHeaders().set("Content-Type", type); exchange.sendResponseHeaders(status, bytes.length); try (var output = exchange.getResponseBody()) { output.write(bytes); } }
    private record Message(String id, String sender, String recipient, String subject, String content, String time) { String toJson() { return "{" + String.join(",", "\"id\":" + jsonString(id), "\"sender\":" + jsonString(sender), "\"recipient\":" + jsonString(recipient), "\"subject\":" + jsonString(subject), "\"content\":" + jsonString(content), "\"time\":" + jsonString(time)) + "}"; } }
}
