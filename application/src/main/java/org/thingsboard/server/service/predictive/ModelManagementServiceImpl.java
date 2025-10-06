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
package org.thingsboard.server.service.predictive;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.id.TenantId;

import java.io.*;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

/**
 * Implementation of ModelManagementService that communicates with Python
 * service via socket.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ModelManagementServiceImpl implements ModelManagementService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${predictive-maintenance.python-service.host:localhost}")
    private String pythonServiceHost;

    @Value("${predictive-maintenance.python-service.port:9000}")
    private int pythonServicePort;

    @Value("${predictive-maintenance.python-service.timeout:300000}")
    private int socketTimeout; // 5 minutes default for model training

    @Override
    public UUID activateModel(TenantId tenantId, DeviceId deviceId, String modelType, String algorithm,
            JsonNode hyperparams) {
        log.info("Activating model: type={}, algorithm={}, deviceId={}", modelType, algorithm, deviceId);

        try {
            // Fetch configuration from predictive_maintenance_config table
            ObjectNode config = fetchPredictiveMaintenanceConfig(deviceId);

            if (config == null) {
                throw new RuntimeException("No predictive maintenance configuration found for device: " + deviceId);
            }

            // Generate unique model_id
            String modelId = String.format("%s_%s_%s",
                    modelType.toLowerCase(),
                    deviceId != null ? deviceId.getId().toString() : "global",
                    System.currentTimeMillis());

            // Prepare training request with config data
            ObjectNode request = mapper.createObjectNode();
            request.put("action", "train");
            request.put("model_id", modelId);
            request.put("model_type", modelType);
            request.put("algorithm", algorithm);

            if (deviceId != null) {
                request.put("device_id", deviceId.getId().toString());
            }

            // Include configuration data in the request
            request.set("config", config);

            // Use hyperparams from config or provided ones
            if (hyperparams != null) {
                request.set("hyperparams", hyperparams);
            } else {
                request.set("hyperparams", mapper.createObjectNode());
            }

            // Send request via socket and get response
            JsonNode response = sendSocketRequest(request);

            // Check if training was successful
            if (!response.has("status") || !response.get("status").asText().equals("success")) {
                String error = response.has("error") ? response.get("error").asText() : "Unknown error";
                throw new RuntimeException("Model training failed: " + error);
            }

            // Extract training results
            JsonNode trainingResults = response.get("training_results");
            String modelPath = response.get("model_path").asText();

            // Store model metadata in ml_models table
            UUID recordId = storeModelMetadata(
                    tenantId,
                    deviceId,
                    modelId,
                    modelType,
                    algorithm,
                    modelPath,
                    trainingResults);

            log.info("Model activated successfully: recordId={}, modelId={}", recordId, modelId);
            return recordId;

        } catch (Exception e) {
            log.error("Failed to activate model", e);
            throw new RuntimeException("Failed to activate model: " + e.getMessage(), e);
        }
    }

    @Override
    public JsonNode getModelStatus(UUID modelId) {
        String sql = "SELECT model_id, model_name, model_type, algorithm, device_id, " +
                "training_start_time, training_end_time, model_metrics, model_path, " +
                "is_active, version, created_at, updated_at " +
                "FROM ml_models WHERE id = ?";

        return jdbcTemplate.query(sql, rs -> {
            if (rs.next()) {
                ObjectNode node = mapper.createObjectNode();
                node.put("id", modelId.toString());
                node.put("model_id", rs.getString("model_id"));
                node.put("model_name", rs.getString("model_name"));
                node.put("model_type", rs.getString("model_type"));
                node.put("algorithm", rs.getString("algorithm"));

                String deviceIdStr = rs.getString("device_id");
                if (deviceIdStr != null) {
                    node.put("device_id", deviceIdStr);
                }

                Timestamp trainingStart = rs.getTimestamp("training_start_time");
                if (trainingStart != null) {
                    node.put("training_start_time", trainingStart.getTime());
                }

                Timestamp trainingEnd = rs.getTimestamp("training_end_time");
                if (trainingEnd != null) {
                    node.put("training_end_time", trainingEnd.getTime());
                }

                String metricsJson = rs.getString("model_metrics");
                if (metricsJson != null) {
                    try {
                        node.set("model_metrics", mapper.readTree(metricsJson));
                    } catch (Exception e) {
                        log.warn("Failed to parse model_metrics JSON", e);
                        node.put("model_metrics", metricsJson);
                    }
                }

                node.put("model_path", rs.getString("model_path"));
                node.put("is_active", rs.getBoolean("is_active"));
                node.put("version", rs.getInt("version"));
                node.put("created_at", rs.getTimestamp("created_at").getTime());
                node.put("updated_at", rs.getTimestamp("updated_at").getTime());

                return node;
            }
            return null;
        }, modelId);
    }

    @Override
    public void deactivateModel(UUID modelId) {
        String sql = "UPDATE ml_models SET is_active = false, updated_at = NOW() WHERE id = ?";
        int updated = jdbcTemplate.update(sql, modelId);

        if (updated > 0) {
            log.info("Model deactivated: {}", modelId);
        } else {
            log.warn("Model not found for deactivation: {}", modelId);
        }
    }

    @Override
    public UUID getActiveModelForDevice(DeviceId deviceId, String modelType) {
        String sql = "SELECT id FROM ml_models WHERE device_id = ? AND model_type = ? AND is_active = true " +
                "ORDER BY version DESC LIMIT 1";

        return jdbcTemplate.query(sql, rs -> {
            if (rs.next()) {
                return UUID.fromString(rs.getString("id"));
            }
            return null;
        }, deviceId.getId(), modelType);
    }

    @Override
    public JsonNode startActiveModelJobs(TenantId tenantId) {
        log.info("Starting prediction jobs for active models in tenant: {}", tenantId);

        try {
            // Get all active models from database
            String sql = "SELECT model_id, model_type, device_id FROM ml_models WHERE is_active = true";

            List<ObjectNode> models = jdbcTemplate.query(sql, (rs, rowNum) -> {
                ObjectNode model = mapper.createObjectNode();
                model.put("model_id", rs.getString("model_id"));
                model.put("model_type", rs.getString("model_type"));
                String deviceId = rs.getString("device_id");
                if (deviceId != null) {
                    model.put("device_id", deviceId);
                }
                return model;
            });

            if (models.isEmpty()) {
                log.info("No active models found");
                ObjectNode response = mapper.createObjectNode();
                response.put("status", "success");
                response.putArray("started");
                return response;
            }

            // Prepare request
            ObjectNode request = mapper.createObjectNode();
            request.put("action", "start_jobs");
            request.set("models", mapper.valueToTree(models));

            // Send via socket
            JsonNode response = sendSocketRequest(request);
            log.info("Started jobs for {} models", models.size());

            return response;

        } catch (Exception e) {
            log.error("Failed to start active model jobs", e);
            throw new RuntimeException("Failed to start active model jobs: " + e.getMessage(), e);
        }
    }

    @Override
    public JsonNode stopModelJobs(List<String> modelIds) {
        log.info("Stopping prediction jobs for models: {}", modelIds);

        try {
            ObjectNode request = mapper.createObjectNode();
            request.put("action", "stop_jobs");
            request.set("model_ids", mapper.valueToTree(modelIds));

            JsonNode response = sendSocketRequest(request);
            return response;

        } catch (Exception e) {
            log.error("Failed to stop model jobs", e);
            throw new RuntimeException("Failed to stop model jobs: " + e.getMessage(), e);
        }
    }

    @Override
    public JsonNode getJobStatus(List<String> modelIds) {
        try {
            ObjectNode request = mapper.createObjectNode();
            request.put("action", "get_job_status");
            if (modelIds != null && !modelIds.isEmpty()) {
                request.set("model_ids", mapper.valueToTree(modelIds));
            }

            JsonNode response = sendSocketRequest(request);
            return response;

        } catch (Exception e) {
            log.error("Failed to get job status", e);
            throw new RuntimeException("Failed to get job status: " + e.getMessage(), e);
        }
    }

    @Override
    public JsonNode getModelLogs(String modelId, String level, int limit) {
        try {
            ObjectNode request = mapper.createObjectNode();
            request.put("action", "get_logs");
            request.put("model_id", modelId);
            request.put("level", level != null ? level : "all");
            request.put("limit", limit);

            JsonNode response = sendSocketRequest(request);
            return response;

        } catch (Exception e) {
            log.error("Failed to get model logs", e);
            throw new RuntimeException("Failed to get model logs: " + e.getMessage(), e);
        }
    }

    /**
     * Send training request to Python service via socket connection.
     */
    private JsonNode sendSocketRequest(ObjectNode request) throws IOException {
        log.debug("Connecting to Python service at {}:{}", pythonServiceHost, pythonServicePort);

        try (Socket socket = new Socket(pythonServiceHost, pythonServicePort)) {
            socket.setSoTimeout(socketTimeout);

            // Send request
            OutputStream out = socket.getOutputStream();
            String requestJson = mapper.writeValueAsString(request);
            out.write(requestJson.getBytes(StandardCharsets.UTF_8));
            out.write('\n'); // Add newline as message delimiter
            out.flush();

            log.debug("Sent training request: {}", requestJson);

            // Read response
            InputStream in = socket.getInputStream();
            BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            String responseLine = reader.readLine();

            if (responseLine == null) {
                throw new IOException("No response from Python service");
            }

            log.debug("Received response: {}", responseLine);
            return mapper.readTree(responseLine);

        } catch (IOException e) {
            log.error("Socket communication failed", e);
            throw e;
        }
    }

    /**
     * Store model metadata in ml_models table after successful training.
     */
    private UUID storeModelMetadata(TenantId tenantId, DeviceId deviceId, String modelId,
            String modelType, String algorithm, String modelPath,
            JsonNode trainingResults) {

        UUID recordId = UUID.randomUUID();
        Timestamp now = new Timestamp(System.currentTimeMillis());

        // Extract metrics from training results
        ObjectNode metrics = mapper.createObjectNode();
        if (trainingResults != null) {
            if (trainingResults.has("average_accuracy")) {
                metrics.put("accuracy", trainingResults.get("average_accuracy").asDouble());
            }
            if (trainingResults.has("average_f1_score")) {
                metrics.put("f1_score", trainingResults.get("average_f1_score").asDouble());
            }
            if (trainingResults.has("rmse")) {
                metrics.put("rmse", trainingResults.get("rmse").asDouble());
            }
            if (trainingResults.has("r2_score")) {
                metrics.put("r2_score", trainingResults.get("r2_score").asDouble());
            }
            if (trainingResults.has("mae")) {
                metrics.put("mae", trainingResults.get("mae").asDouble());
            }
            if (trainingResults.has("training_time")) {
                metrics.put("training_time_seconds", trainingResults.get("training_time").asDouble());
            }
        }

        String modelName = String.format("%s_%s", modelType, algorithm);

        String sql = "INSERT INTO ml_models (id, model_id, model_name, model_type, algorithm, device_id, " +
                "training_start_time, training_end_time, model_metrics, model_path, is_active, version, " +
                "created_at, updated_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, true, 1, ?, ?)";

        jdbcTemplate.update(sql,
                recordId,
                modelId,
                modelName,
                modelType,
                algorithm,
                deviceId != null ? deviceId.getId() : null,
                now,
                now,
                metrics.toString(),
                modelPath,
                now,
                now);

        log.info("Stored model metadata: recordId={}, modelId={}", recordId, modelId);
        return recordId;
    }

    /**
     * Fetch predictive maintenance configuration from database.
     */
    private ObjectNode fetchPredictiveMaintenanceConfig(DeviceId deviceId) {
        log.info("Fetching predictive maintenance config for device: {}", deviceId);

        String sql = "SELECT id, name, created_time, tenant_id, device_id, attributes, " +
                "forecast_algorithm, forecast_start_date, forecast_end_date, " +
                "anomaly_algorithm, anomaly_start_date, anomaly_end_date, view_preferences " +
                "FROM predictive_maintenance_config WHERE device_id = ? " +
                "ORDER BY created_time DESC LIMIT 1";

        return jdbcTemplate.query(sql, rs -> {
            if (rs.next()) {
                ObjectNode config = mapper.createObjectNode();
                config.put("id", rs.getString("id"));
                config.put("name", rs.getString("name"));
                config.put("created_time", rs.getLong("created_time"));
                config.put("tenant_id", rs.getString("tenant_id"));
                config.put("device_id", rs.getString("device_id"));

                // Parse attributes JSON
                String attributesJson = rs.getString("attributes");
                if (attributesJson != null) {
                    try {
                        config.set("attributes", mapper.readTree(attributesJson));
                    } catch (Exception e) {
                        log.warn("Failed to parse attributes JSON", e);
                        config.put("attributes", attributesJson);
                    }
                }

                config.put("forecast_algorithm", rs.getString("forecast_algorithm"));
                config.put("forecast_start_date", rs.getLong("forecast_start_date"));
                config.put("forecast_end_date", rs.getLong("forecast_end_date"));
                config.put("anomaly_algorithm", rs.getString("anomaly_algorithm"));
                config.put("anomaly_start_date", rs.getLong("anomaly_start_date"));
                config.put("anomaly_end_date", rs.getLong("anomaly_end_date"));

                // Parse view_preferences JSON
                String viewPrefsJson = rs.getString("view_preferences");
                if (viewPrefsJson != null) {
                    try {
                        config.set("view_preferences", mapper.readTree(viewPrefsJson));
                    } catch (Exception e) {
                        log.warn("Failed to parse view_preferences JSON", e);
                        config.put("view_preferences", viewPrefsJson);
                    }
                }

                log.info("Found config: {}", config);
                return config;
            }
            log.warn("No predictive maintenance config found for device: {}", deviceId);
            return null;
        }, deviceId.getId());
    }
}
