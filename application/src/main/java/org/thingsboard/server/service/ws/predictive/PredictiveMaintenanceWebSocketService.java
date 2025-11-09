/**
 * Copyright © 2016-2024 The Thingsboard Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.thingsboard.server.service.ws.predictive;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.queue.util.TbCoreComponent;
import org.thingsboard.server.service.predictive.ModelManagementService;
import org.thingsboard.server.service.ws.WebSocketMsgEndpoint;
import org.thingsboard.server.service.ws.WebSocketSessionRef;
import org.thingsboard.common.util.JacksonUtil;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * WebSocket service for predictive maintenance operations.
 * Handles real-time communication between UI and predictive maintenance system.
 */
@Service
@TbCoreComponent
@Slf4j
@RequiredArgsConstructor
public class PredictiveMaintenanceWebSocketService {

    private final ModelManagementService modelManagementService;
    private final WebSocketMsgEndpoint msgEndpoint;
    private final ObjectMapper mapper = new ObjectMapper();

    // Map: subscriptionId -> SessionInfo
    private final ConcurrentMap<String, PredictiveMaintenanceSubscription> subscriptions = new ConcurrentHashMap<>();

    // Map: sessionId -> Set of subscriptionIds
    private final ConcurrentMap<String, Set<String>> sessionSubscriptions = new ConcurrentHashMap<>();

    /**
     * Handle predictive maintenance command from WebSocket client.
     */
    public void handleCommand(WebSocketSessionRef sessionRef, PredictiveMaintenanceCmd cmd) {
        log.debug("[{}] Handling predictive maintenance command: {}", sessionRef.getSessionId(), cmd.getAction());

        try {
            TenantId tenantId = sessionRef.getSecurityCtx().getTenantId();

            switch (cmd.getAction()) {
                case ACTIVATE_MODEL:
                    handleActivateModel(sessionRef, cmd, tenantId);
                    break;
                case START_JOBS:
                    handleStartJobs(sessionRef, cmd, tenantId);
                    break;
                case STOP_JOBS:
                    handleStopJobs(sessionRef, cmd, tenantId);
                    break;
                case GET_JOB_STATUS:
                    handleGetJobStatus(sessionRef, cmd, tenantId);
                    break;
                case GET_MODEL_LOGS:
                    handleGetModelLogs(sessionRef, cmd, tenantId);
                    break;
                case SUBSCRIBE_PREDICTIONS:
                    handleSubscribe(sessionRef, cmd, tenantId);
                    break;
                case UNSUBSCRIBE_PREDICTIONS:
                    handleUnsubscribe(sessionRef, cmd);
                    break;
                default:
                    sendError(sessionRef, cmd.getCmdId(), "Unknown action: " + cmd.getAction());
            }
        } catch (Exception e) {
            log.error("[{}] Error handling predictive maintenance command", sessionRef.getSessionId(), e);
            sendError(sessionRef, cmd.getCmdId(), "Error: " + e.getMessage());
        }
    }

    /**
     * Handle model activation (train + start jobs).
     */
    private void handleActivateModel(WebSocketSessionRef sessionRef, PredictiveMaintenanceCmd cmd, TenantId tenantId) {
        if (cmd.getDeviceId() == null || cmd.getDeviceId().isEmpty()) {
            sendError(sessionRef, cmd.getCmdId(), "deviceId is required for ACTIVATE_MODEL");
            return;
        }

        try {
            // Parse device ID
            org.thingsboard.server.common.data.id.DeviceId deviceId = new org.thingsboard.server.common.data.id.DeviceId(
                    UUID.fromString(cmd.getDeviceId()));

            ObjectNode response = mapper.createObjectNode();
            response.put("cmdId", cmd.getCmdId());
            response.put("action", "ACTIVATE_MODEL");
            response.put("deviceId", cmd.getDeviceId());

            ObjectNode trainingResults = mapper.createObjectNode();

            // Train AnomalyPredictor
            try {
                ObjectNode anomalyHyperparams = mapper.createObjectNode();
                anomalyHyperparams.put("n_estimators", 50);

                UUID anomalyModelId = modelManagementService.activateModel(
                        tenantId, deviceId, "AnomalyPredictor", "xgboost", anomalyHyperparams);

                JsonNode anomalyStatus = modelManagementService.getModelStatus(anomalyModelId);
                trainingResults.set("anomaly_predictor", anomalyStatus);
            } catch (Exception e) {
                log.error("Error training AnomalyPredictor", e);
                ObjectNode error = mapper.createObjectNode();
                error.put("status", "error");
                error.put("message", e.getMessage());
                trainingResults.set("anomaly_predictor", error);
            }

            // Train ForecastModel
            try {
                ObjectNode forecastHyperparams = mapper.createObjectNode();
                forecastHyperparams.put("changepoint_prior_scale", 0.05);

                UUID forecastModelId = modelManagementService.activateModel(
                        tenantId, deviceId, "ForecastModel", "prophet", forecastHyperparams);

                JsonNode forecastStatus = modelManagementService.getModelStatus(forecastModelId);
                trainingResults.set("forecast_model", forecastStatus);
            } catch (Exception e) {
                log.error("Error training ForecastModel", e);
                ObjectNode error = mapper.createObjectNode();
                error.put("status", "error");
                error.put("message", e.getMessage());
                trainingResults.set("forecast_model", error);
            }

            response.set("data", trainingResults);
            sendToSession(sessionRef, response);

            log.info("[{}] Model activation completed for device: {}", sessionRef.getSessionId(), cmd.getDeviceId());
        } catch (Exception e) {
            log.error("[{}] Error activating model", sessionRef.getSessionId(), e);
            sendError(sessionRef, cmd.getCmdId(), "Failed to activate model: " + e.getMessage());
        }
    }

    /**
     * Handle start jobs command.
     */
    private void handleStartJobs(WebSocketSessionRef sessionRef, PredictiveMaintenanceCmd cmd, TenantId tenantId) {
        try {
            JsonNode result = modelManagementService.startActiveModelJobs(tenantId);

            ObjectNode response = mapper.createObjectNode();
            response.put("cmdId", cmd.getCmdId());
            response.put("action", "START_JOBS");
            response.set("data", result);

            sendToSession(sessionRef, response);

            log.info("[{}] Jobs started successfully", sessionRef.getSessionId());
        } catch (Exception e) {
            log.error("[{}] Error starting jobs", sessionRef.getSessionId(), e);
            sendError(sessionRef, cmd.getCmdId(), "Failed to start jobs: " + e.getMessage());
        }
    }

    /**
     * Handle stop jobs command.
     */
    private void handleStopJobs(WebSocketSessionRef sessionRef, PredictiveMaintenanceCmd cmd, TenantId tenantId) {
        if (cmd.getModelIds() == null || cmd.getModelIds().isEmpty()) {
            sendError(sessionRef, cmd.getCmdId(), "modelIds is required for STOP_JOBS");
            return;
        }

        try {
            JsonNode result = modelManagementService.stopModelJobs(cmd.getModelIds());

            ObjectNode response = mapper.createObjectNode();
            response.put("cmdId", cmd.getCmdId());
            response.put("action", "STOP_JOBS");
            response.set("data", result);

            sendToSession(sessionRef, response);

            log.info("[{}] Jobs stopped: {}", sessionRef.getSessionId(), cmd.getModelIds());
        } catch (Exception e) {
            log.error("[{}] Error stopping jobs", sessionRef.getSessionId(), e);
            sendError(sessionRef, cmd.getCmdId(), "Failed to stop jobs: " + e.getMessage());
        }
    }

    /**
     * Handle get job status command.
     */
    private void handleGetJobStatus(WebSocketSessionRef sessionRef, PredictiveMaintenanceCmd cmd, TenantId tenantId) {
        try {
            JsonNode result = modelManagementService.getJobStatus(cmd.getModelIds());

            ObjectNode response = mapper.createObjectNode();
            response.put("cmdId", cmd.getCmdId());
            response.put("action", "GET_JOB_STATUS");
            response.set("data", result);

            sendToSession(sessionRef, response);
        } catch (Exception e) {
            log.error("[{}] Error getting job status", sessionRef.getSessionId(), e);
            sendError(sessionRef, cmd.getCmdId(), "Failed to get job status: " + e.getMessage());
        }
    }

    /**
     * Handle get model logs command.
     */
    private void handleGetModelLogs(WebSocketSessionRef sessionRef, PredictiveMaintenanceCmd cmd, TenantId tenantId) {
        if (cmd.getModelId() == null || cmd.getModelId().isEmpty()) {
            sendError(sessionRef, cmd.getCmdId(), "modelId is required for GET_MODEL_LOGS");
            return;
        }

        try {
            String type = "all";
            JsonNode result = modelManagementService.getModelLogs(
                    cmd.getModelId(),
                    cmd.getLogLevel(),
                    cmd.getLogLimit(),
                    type);

            ObjectNode response = mapper.createObjectNode();
            response.put("cmdId", cmd.getCmdId());
            response.put("action", "GET_MODEL_LOGS");
            response.set("data", result);

            sendToSession(sessionRef, response);
        } catch (Exception e) {
            log.error("[{}] Error getting model logs", sessionRef.getSessionId(), e);
            sendError(sessionRef, cmd.getCmdId(), "Failed to get model logs: " + e.getMessage());
        }
    }

    /**
     * Handle subscription to prediction stream.
     */
    private void handleSubscribe(WebSocketSessionRef sessionRef, PredictiveMaintenanceCmd cmd, TenantId tenantId) {
        String subscriptionId = UUID.randomUUID().toString();

        PredictiveMaintenanceSubscription subscription = new PredictiveMaintenanceSubscription(
                subscriptionId,
                sessionRef,
                cmd.getSubscriptionType(),
                cmd.getDeviceId(),
                cmd.getModelIds());

        subscriptions.put(subscriptionId, subscription);

        sessionSubscriptions.computeIfAbsent(sessionRef.getSessionId(), k -> ConcurrentHashMap.newKeySet())
                .add(subscriptionId);

        // Send subscription confirmation
        ObjectNode response = mapper.createObjectNode();
        response.put("cmdId", cmd.getCmdId());
        response.put("action", "SUBSCRIBE_PREDICTIONS");
        response.put("subscriptionId", subscriptionId);
        response.put("subscriptionType", cmd.getSubscriptionType());

        sendToSession(sessionRef, response);

        log.info("[{}] Subscribed to predictions: {} (type: {})",
                sessionRef.getSessionId(), subscriptionId, cmd.getSubscriptionType());
    }

    /**
     * Handle unsubscribe from prediction stream.
     */
    private void handleUnsubscribe(WebSocketSessionRef sessionRef, PredictiveMaintenanceCmd cmd) {
        // Unsubscribe all subscriptions for this session
        Set<String> subs = sessionSubscriptions.remove(sessionRef.getSessionId());
        if (subs != null) {
            subs.forEach(subscriptions::remove);
            log.info("[{}] Unsubscribed from {} prediction streams", sessionRef.getSessionId(), subs.size());
        }

        // Send confirmation
        ObjectNode response = mapper.createObjectNode();
        response.put("cmdId", cmd.getCmdId());
        response.put("action", "UNSUBSCRIBE_PREDICTIONS");
        response.put("message", "Unsubscribed successfully");

        sendToSession(sessionRef, response);
    }

    /**
     * Send prediction update to subscribed clients.
     * Called when new predictions are available.
     */
    public void sendPredictionUpdate(String deviceId, String modelId,
            PredictiveMaintenanceUpdate.PredictiveMaintenanceUpdateType type, JsonNode data) {
        subscriptions.values().stream()
                .filter(sub -> matchesSubscription(sub, deviceId, modelId, type))
                .forEach(sub -> {
                    try {
                        ObjectNode update = mapper.createObjectNode();
                        update.put("subscriptionId", sub.getSubscriptionId());
                        update.put("updateType", type.name());
                        update.put("deviceId", deviceId);
                        update.put("modelId", modelId);
                        update.put("timestamp", System.currentTimeMillis());
                        update.set("data", data);

                        sendToSession(sub.getSessionRef(), update);
                    } catch (Exception e) {
                        log.error("[{}] Error sending prediction update", sub.getSessionRef().getSessionId(), e);
                    }
                });
    }

    /**
     * Check if subscription matches the update criteria.
     */
    private boolean matchesSubscription(PredictiveMaintenanceSubscription sub, String deviceId, String modelId,
            PredictiveMaintenanceUpdate.PredictiveMaintenanceUpdateType type) {
        // Check device filter
        if (sub.getDeviceId() != null && !sub.getDeviceId().equals(deviceId)) {
            return false;
        }

        // Check model filter
        if (sub.getModelIds() != null && !sub.getModelIds().isEmpty() && !sub.getModelIds().contains(modelId)) {
            return false;
        }

        // Check subscription type
        String subType = sub.getSubscriptionType();
        if ("all".equals(subType)) {
            return true;
        } else if ("anomaly".equals(subType)
                && type == PredictiveMaintenanceUpdate.PredictiveMaintenanceUpdateType.ANOMALY_DETECTED) {
            return true;
        } else if ("forecast".equals(subType)
                && type == PredictiveMaintenanceUpdate.PredictiveMaintenanceUpdateType.FORECAST_UPDATE) {
            return true;
        }

        return false;
    }

    /**
     * Clean up subscriptions when session closes.
     */
    public void cleanupSession(String sessionId) {
        Set<String> subs = sessionSubscriptions.remove(sessionId);
        if (subs != null) {
            subs.forEach(subscriptions::remove);
            log.info("[{}] Cleaned up {} prediction subscriptions", sessionId, subs.size());
        }
    }

    /**
     * Send message to WebSocket session.
     */
    private void sendToSession(WebSocketSessionRef sessionRef, ObjectNode message) {
        try {
            String msg = JacksonUtil.OBJECT_MAPPER.writeValueAsString(message);
            int cmdId = message.has("cmdId") ? message.get("cmdId").asInt() : 0;
            msgEndpoint.send(sessionRef, cmdId, msg);
        } catch (IOException e) {
            log.error("[{}] Error sending message to session", sessionRef.getSessionId(), e);
        }
    }

    /**
     * Send error message to client.
     */
    private void sendError(WebSocketSessionRef sessionRef, int cmdId, String errorMsg) {
        try {
            ObjectNode error = mapper.createObjectNode();
            error.put("cmdId", cmdId);
            error.put("error", errorMsg);
            error.put("timestamp", System.currentTimeMillis());

            sendToSession(sessionRef, error);
        } catch (Exception e) {
            log.error("[{}] Error sending error message", sessionRef.getSessionId(), e);
        }
    }
}
