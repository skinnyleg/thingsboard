package org.thingsboard.server.controller.ws;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.thingsboard.server.service.ws.PythonWebSocketClientService;

import java.io.IOException;

/**
 * WebSocket handler for UI clients to subscribe to model predictions, status,
 * and logs
 * 
 * Endpoint: /api/ws/model
 * 
 * UI clients connect to this endpoint and send messages in ThingsBoard command
 * pattern:
 * {
 * "commandId": 123,
 * "type": "job_status" | "job_logs" | "job_listen",
 * "forecastId": "uuid",
 * "modelType": "anomaly" | "forecast" // Required for job_listen
 * }
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ModelWebSocketHandler extends TextWebSocketHandler {

    private final PythonWebSocketClientService pythonWebSocketService;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        pythonWebSocketService.registerUiSession(sessionId, session);

        log.info("UI WebSocket connection established: {}", sessionId);

        // Send connection confirmation
        session.sendMessage(new TextMessage(
                "{\"type\":\"connection\"," +
                        "\"message\":\"Connected to model monitoring service\"," +
                        "\"sessionId\":\"" + sessionId + "\"," +
                        "\"timestamp\":" + System.currentTimeMillis() + "}"));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String sessionId = session.getId();
        String payload = message.getPayload();

        log.debug("Received message from UI session {}: {}", sessionId, payload);

        // Forward to Python WebSocket service
        pythonWebSocketService.handleUiMessage(sessionId, payload);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String sessionId = session.getId();
        pythonWebSocketService.unregisterUiSession(sessionId);

        log.info("UI WebSocket connection closed: {} - {}", sessionId, status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        String sessionId = session.getId();
        log.error("UI WebSocket transport error for session {}", sessionId, exception);

        try {
            session.close(CloseStatus.SERVER_ERROR);
        } catch (IOException e) {
            log.error("Error closing WebSocket session {}", sessionId, e);
        }
    }
}
