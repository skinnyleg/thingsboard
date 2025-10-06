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
package org.thingsboard.server.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.thingsboard.server.common.data.exception.ThingsboardErrorCode;
import org.thingsboard.server.common.data.exception.ThingsboardException;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.dao.model.ModelLogService;
import org.thingsboard.server.queue.util.TbCoreComponent;
import org.thingsboard.server.service.predictive.ModelManagementService;
import org.thingsboard.server.service.security.permission.Operation;

import java.util.List;
import java.util.UUID;

/**
 * REST API for managing ML models (training, status, activation).
 * 
 * Provides endpoints for:
 * - Training models via Python service socket connection
 * - Querying model status from ml_models table
 * - Activating/deactivating models
 */
@Tag(name = "ML Model Management")
@RestController
@TbCoreComponent
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class ModelController extends BaseController {

    private final ModelManagementService modelManagementService;
    private final ModelLogService modelLogService;
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * PATCH /api/models/{forecastId}/activate
     * 
     * UI-facing endpoint that activates model training.
     * This endpoint matches the existing UI expectation and uses socket
     * communication
     * to train models via Python service.
     * 
     * Request: No body required, forecast_id in path is used to identify the
     * device/config
     * 
     * Response:
     * {
     * "forecast_id": "uuid-string",
     * "status": "active",
     * "models_trained": 2,
     * "training_results": {
     * "anomaly_predictor": {...},
     * "forecast_model": {...}
     * }
     * }
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN')")
    @RequestMapping(value = "/models/{forecastId}/activate", method = { RequestMethod.PATCH, RequestMethod.POST })
    @ResponseBody
    public JsonNode activateModel(
            @Parameter(description = "Forecast/Config ID (can be device ID or pm_config ID)") @PathVariable("forecastId") String forecastId)
            throws ThingsboardException {
        try {
            log.info("Activating models for forecast_id: {}", forecastId);

            // Parse forecast_id as device ID (or could be pm_config_id)
            DeviceId deviceId = null;
            try {
                deviceId = new DeviceId(UUID.fromString(forecastId));
                checkDeviceId(deviceId, Operation.WRITE);
            } catch (Exception e) {
                // If not a valid device ID, could be a pm_config_id or other identifier
                log.warn("forecast_id is not a valid device UUID: {}", forecastId);
            }

            ObjectNode response = mapper.createObjectNode();
            response.put("forecast_id", forecastId);

            ObjectNode trainingResults = mapper.createObjectNode();
            int successCount = 0;

            // Train AnomalyPredictor
            try {
                log.info("Training AnomalyPredictor for forecast_id: {}", forecastId);

                ObjectNode anomalyHyperparams = mapper.createObjectNode();
                anomalyHyperparams.put("n_estimators", 50);
                anomalyHyperparams.put("max_depth", 4);
                anomalyHyperparams.put("learning_rate", 0.1);

                UUID anomalyModelId = modelManagementService.activateModel(
                        getCurrentUser().getTenantId(),
                        deviceId,
                        "AnomalyPredictor",
                        "xgboost",
                        anomalyHyperparams);

                JsonNode anomalyStatus = modelManagementService.getModelStatus(anomalyModelId);

                ObjectNode anomalyResult = mapper.createObjectNode();
                anomalyResult.put("status", "success");
                anomalyResult.put("model_path", anomalyStatus.get("model_path").asText());
                if (anomalyStatus.has("model_metrics")) {
                    anomalyResult.set("metrics", anomalyStatus.get("model_metrics"));
                }

                trainingResults.set("anomaly_predictor", anomalyResult);
                successCount++;

                log.info("AnomalyPredictor trained successfully: modelId={}", anomalyModelId);

            } catch (Exception e) {
                log.error("Failed to train AnomalyPredictor", e);
                ObjectNode anomalyResult = mapper.createObjectNode();
                anomalyResult.put("status", "failed");
                anomalyResult.put("error", e.getMessage());
                trainingResults.set("anomaly_predictor", anomalyResult);
            }

            // Train ForecastModel
            try {
                log.info("Training ForecastModel for forecast_id: {}", forecastId);

                ObjectNode forecastHyperparams = mapper.createObjectNode();
                forecastHyperparams.put("seasonality_mode", "multiplicative");
                forecastHyperparams.put("changepoint_prior_scale", 0.05);

                UUID forecastModelId = modelManagementService.activateModel(
                        getCurrentUser().getTenantId(),
                        deviceId,
                        "ForecastModel",
                        "prophet",
                        forecastHyperparams);

                JsonNode forecastStatus = modelManagementService.getModelStatus(forecastModelId);

                ObjectNode forecastResult = mapper.createObjectNode();
                forecastResult.put("status", "success");
                forecastResult.put("model_path", forecastStatus.get("model_path").asText());
                if (forecastStatus.has("model_metrics")) {
                    forecastResult.set("metrics", forecastStatus.get("model_metrics"));
                }

                trainingResults.set("forecast_model", forecastResult);
                successCount++;

                log.info("ForecastModel trained successfully: modelId={}", forecastModelId);

            } catch (Exception e) {
                log.error("Failed to train ForecastModel", e);
                ObjectNode forecastResult = mapper.createObjectNode();
                forecastResult.put("status", "failed");
                forecastResult.put("error", e.getMessage());
                trainingResults.set("forecast_model", forecastResult);
            }

            response.put("status", successCount > 0 ? "active" : "failed");
            response.put("models_trained", successCount);
            response.set("training_results", trainingResults);
            response.put("message", String.format("Successfully trained and saved %d/2 models", successCount));

            return response;

        } catch (Exception e) {
            log.error("Failed to activate models for forecast_id: {}", forecastId, e);
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }

    /**
     * POST /api/models/train
     * 
     * Advanced endpoint for custom model training with full control over
     * parameters.
     * 
     * Request body:
     * {
     * "deviceId": "uuid-string", // optional, null for global models
     * "modelType": "AnomalyPredictor" | "ForecastModel",
     * "algorithm": "xgboost" | "prophet" | "arima",
     * "hyperparams": {
     * "n_estimators": 50,
     * "max_depth": 4
     * }
     * }
     * 
     * Response:
     * {
     * "modelId": "uuid-string",
     * "status": "active",
     * "message": "Model trained successfully"
     * }
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN')")
    @PostMapping("/models/train")
    @ResponseBody
    public JsonNode trainModel(@RequestBody JsonNode requestBody) throws ThingsboardException {
        try {
            if (!requestBody.has("modelType")) {
                throw new ThingsboardException("modelType is required", ThingsboardErrorCode.BAD_REQUEST_PARAMS);
            }
            if (!requestBody.has("algorithm")) {
                throw new ThingsboardException("algorithm is required", ThingsboardErrorCode.BAD_REQUEST_PARAMS);
            }

            String modelType = requestBody.get("modelType").asText();
            String algorithm = requestBody.get("algorithm").asText();

            DeviceId deviceId = null;
            if (requestBody.has("deviceId") && !requestBody.get("deviceId").isNull()) {
                deviceId = new DeviceId(UUID.fromString(requestBody.get("deviceId").asText()));
                // Check permission
                checkDeviceId(deviceId, Operation.WRITE);
            }

            JsonNode hyperparams = requestBody.has("hyperparams") ? requestBody.get("hyperparams") : null;

            // Activate model (trains via socket + stores in ml_models table)
            UUID modelRecordId = modelManagementService.activateModel(
                    getCurrentUser().getTenantId(),
                    deviceId,
                    modelType,
                    algorithm,
                    hyperparams);

            ObjectNode response = mapper.createObjectNode();
            response.put("modelId", modelRecordId.toString());
            response.put("status", "active");
            response.put("message", "Model trained and activated successfully");

            return response;

        } catch (ThingsboardException e) {
            throw e;
        } catch (Exception e) {
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }

    /**
     * GET /api/models/{modelId}/status
     * 
     * Returns model metadata from ml_models table.
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN', 'CUSTOMER_USER')")
    @GetMapping("/models/{modelId}/status")
    @ResponseBody
    public JsonNode getModelStatus(
            @Parameter(description = "Model ID from ml_models table") @PathVariable("modelId") String modelIdStr)
            throws ThingsboardException {
        try {
            UUID modelId = UUID.fromString(modelIdStr);

            JsonNode status = modelManagementService.getModelStatus(modelId);

            if (status == null) {
                throw new ThingsboardException("Model not found", ThingsboardErrorCode.ITEM_NOT_FOUND);
            }

            return status;

        } catch (ThingsboardException e) {
            throw e;
        } catch (Exception e) {
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }

    /**
     * DELETE /api/models/{modelId}
     * 
     * Deactivates a model (sets is_active = false).
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN')")
    @DeleteMapping("/models/{modelId}")
    @ResponseStatus(HttpStatus.OK)
    public void deactivateModel(
            @Parameter(description = "Model ID from ml_models table") @PathVariable("modelId") String modelIdStr)
            throws ThingsboardException {
        try {
            UUID modelId = UUID.fromString(modelIdStr);

            modelManagementService.deactivateModel(modelId);

        } catch (Exception e) {
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }

    /**
     * GET /api/models/device/{deviceId}/active?type={modelType}
     * 
     * Get active model for a device and type.
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN', 'CUSTOMER_USER')")
    @GetMapping("/models/device/{deviceId}/active")
    @ResponseBody
    public JsonNode getActiveModelForDevice(
            @Parameter(description = "Device ID") @PathVariable("deviceId") String deviceIdStr,
            @Parameter(description = "Model type: AnomalyPredictor or ForecastModel") @RequestParam("type") String modelType)
            throws ThingsboardException {
        try {
            DeviceId deviceId = new DeviceId(UUID.fromString(deviceIdStr));
            checkDeviceId(deviceId, Operation.READ);

            UUID modelRecordId = modelManagementService.getActiveModelForDevice(deviceId, modelType);

            ObjectNode response = mapper.createObjectNode();
            if (modelRecordId != null) {
                response.put("modelId", modelRecordId.toString());
                response.put("status", "active");
            } else {
                response.put("modelId", (String) null);
                response.put("status", "no_active_model");
            }

            return response;

        } catch (ThingsboardException e) {
            throw e;
        } catch (Exception e) {
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }

    /**
     * POST /api/models/jobs/start
     * 
     * Start prediction jobs for all active models.
     * Called automatically on application startup.
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN')")
    @PostMapping("/models/jobs/start")
    @ResponseBody
    public JsonNode startActiveJobs() throws ThingsboardException {
        try {
            log.info("Starting active model jobs for tenant: {}", getCurrentUser().getTenantId());
            return modelManagementService.startActiveModelJobs(getCurrentUser().getTenantId());
        } catch (Exception e) {
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }

    /**
     * POST /api/models/jobs/stop
     * 
     * Stop prediction jobs.
     * 
     * Request body:
     * {
     * "model_ids": ["model_id1", "model_id2"]
     * }
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN')")
    @PostMapping("/models/jobs/stop")
    @ResponseBody
    public JsonNode stopJobs(@RequestBody JsonNode requestBody) throws ThingsboardException {
        try {
            if (!requestBody.has("model_ids")) {
                throw new ThingsboardException("model_ids is required", ThingsboardErrorCode.BAD_REQUEST_PARAMS);
            }

            List<String> modelIds = mapper.convertValue(
                    requestBody.get("model_ids"),
                    mapper.getTypeFactory().constructCollectionType(List.class, String.class));

            return modelManagementService.stopModelJobs(modelIds);
        } catch (ThingsboardException e) {
            throw e;
        } catch (Exception e) {
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }

    /**
     * GET /api/models/jobs/status
     * 
     * Get status of running prediction jobs.
     * 
     * Query params:
     * - model_ids: Optional comma-separated list of model IDs
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN', 'CUSTOMER_USER')")
    @GetMapping("/models/jobs/status")
    @ResponseBody
    public JsonNode getJobStatus(
            @Parameter(description = "Comma-separated model IDs") @RequestParam(value = "model_ids", required = false) String modelIdsStr)
            throws ThingsboardException {
        try {
            List<String> modelIds = null;
            if (modelIdsStr != null && !modelIdsStr.isEmpty()) {
                modelIds = List.of(modelIdsStr.split(","));
            }

            return modelManagementService.getJobStatus(modelIds);
        } catch (Exception e) {
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }

    /**
     * GET /api/models/{modelId}/logs
     * 
     * Get logs for a specific model (OLD - kept for backward compatibility).
     * 
     * Query params:
     * - level: info, warn, error, all (default: all)
     * - limit: number of entries (default: 100)
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN', 'CUSTOMER_USER')")
    @GetMapping("/models/{modelId}/logs")
    @ResponseBody
    public JsonNode getModelLogs(
            @Parameter(description = "Model ID (model_id from ml_models table)") @PathVariable("modelId") String modelId,
            @Parameter(description = "Log level filter") @RequestParam(value = "level", required = false, defaultValue = "all") String level,
            @Parameter(description = "Maximum number of log entries") @RequestParam(value = "limit", required = false, defaultValue = "100") int limit)
            throws ThingsboardException {
        try {
            return modelManagementService.getModelLogs(modelId, level, limit);
        } catch (Exception e) {
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }

    // ============================================================================
    // NEW MODEL LOGS API (Database-backed with pagination)
    // ============================================================================

    /**
     * POST /api/model/logs
     * 
     * Create a new model log entry (for Python service to call).
     * 
     * Request body:
     * {
     * "modelId": "model-id-string",
     * "tenantId": "uuid-string",
     * "deviceId": "uuid-string",
     * "timestamp": 1234567890000,
     * "logLevel": "INFO" | "WARN" | "ERROR",
     * "message": "Log message text",
     * "source": "activation" | "ForecastModel" | "AnomalyPredictor",
     * "metadata": { ...optional metadata... }
     * }
     * 
     * Response:
     * {
     * "id": {"id": "uuid"},
     * "modelId": "model-id-string",
     * ...
     * }
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN')")
    @PostMapping("/model/logs")
    @ResponseBody
    public org.thingsboard.server.common.data.model.ModelLog addModelLog(
            @RequestBody org.thingsboard.server.common.data.model.ModelLog modelLog) throws ThingsboardException {
        try {
            // Validate required fields
            if (modelLog.getModelId() == null || modelLog.getModelId().isEmpty()) {
                throw new ThingsboardException("modelId is required", ThingsboardErrorCode.BAD_REQUEST_PARAMS);
            }
            if (modelLog.getLogLevel() == null || modelLog.getLogLevel().isEmpty()) {
                throw new ThingsboardException("logLevel is required", ThingsboardErrorCode.BAD_REQUEST_PARAMS);
            }
            if (modelLog.getMessage() == null || modelLog.getMessage().isEmpty()) {
                throw new ThingsboardException("message is required", ThingsboardErrorCode.BAD_REQUEST_PARAMS);
            }

            // Set tenant ID from current user if not provided
            if (modelLog.getTenantId() == null) {
                modelLog.setTenantId(getCurrentUser().getTenantId());
            }

            // Set timestamp if not provided
            if (modelLog.getTimestamp() == null) {
                modelLog.setTimestamp(System.currentTimeMillis());
            }

            // Save log
            return modelLogService.save(getCurrentUser().getTenantId(), modelLog);

        } catch (ThingsboardException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to add model log", e);
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }

    /**
     * GET /api/model/logs/{modelId}
     * 
     * Get logs for a model with pagination and filtering.
     * 
     * Query params:
     * - startTs: Start timestamp (milliseconds, required)
     * - endTs: End timestamp (milliseconds, required)
     * - logLevel: Optional log level filter (INFO, WARN, ERROR)
     * - source: Optional source filter (activation, ForecastModel,
     * AnomalyPredictor)
     * - page: Page number (default: 0)
     * - pageSize: Page size (default: 50)
     * 
     * Response:
     * {
     * "data": [...logs...],
     * "totalPages": 10,
     * "totalElements": 500,
     * "hasNext": true
     * }
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN', 'CUSTOMER_USER')")
    @GetMapping("/model/logs/{modelId}")
    @ResponseBody
    public org.thingsboard.server.common.data.page.PageData<org.thingsboard.server.common.data.model.ModelLog> getModelLogsPaginated(
            @Parameter(description = "Model ID") @PathVariable("modelId") String modelId,
            @Parameter(description = "Start timestamp (milliseconds)") @RequestParam("startTs") long startTs,
            @Parameter(description = "End timestamp (milliseconds)") @RequestParam("endTs") long endTs,
            @Parameter(description = "Log level filter (optional)") @RequestParam(value = "logLevel", required = false) String logLevel,
            @Parameter(description = "Source filter (optional)") @RequestParam(value = "source", required = false) String source,
            @Parameter(description = "Page number") @RequestParam(value = "page", required = false, defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(value = "pageSize", required = false, defaultValue = "50") int pageSize)
            throws ThingsboardException {
        try {
            org.thingsboard.server.common.data.page.PageLink pageLink = new org.thingsboard.server.common.data.page.PageLink(
                    pageSize, page);

            return modelLogService.findByModelIdAndTimeWindow(
                    modelId, startTs, endTs, logLevel, source, pageLink);

        } catch (Exception e) {
            log.error("Failed to get model logs for modelId: {}", modelId, e);
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }

    /**
     * GET /api/model/logs/{modelId}/count
     * 
     * Count logs for a model with filtering.
     * 
     * Query params:
     * - startTs: Start timestamp (milliseconds, required)
     * - endTs: End timestamp (milliseconds, required)
     * - logLevel: Optional log level filter
     * - source: Optional source filter
     * 
     * Response:
     * {
     * "count": 1234
     * }
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN', 'CUSTOMER_USER')")
    @GetMapping("/model/logs/{modelId}/count")
    @ResponseBody
    public JsonNode countModelLogs(
            @Parameter(description = "Model ID") @PathVariable("modelId") String modelId,
            @Parameter(description = "Start timestamp (milliseconds)") @RequestParam("startTs") long startTs,
            @Parameter(description = "End timestamp (milliseconds)") @RequestParam("endTs") long endTs,
            @Parameter(description = "Log level filter (optional)") @RequestParam(value = "logLevel", required = false) String logLevel,
            @Parameter(description = "Source filter (optional)") @RequestParam(value = "source", required = false) String source)
            throws ThingsboardException {
        try {
            long count = modelLogService.countByModelIdAndTimeWindow(
                    modelId, startTs, endTs, logLevel, source);

            ObjectNode response = mapper.createObjectNode();
            response.put("count", count);
            return response;

        } catch (Exception e) {
            log.error("Failed to count model logs for modelId: {}", modelId, e);
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }

    /**
     * DELETE /api/model/logs/{modelId}
     * 
     * Delete all logs for a specific model.
     */
    @PreAuthorize("hasAnyAuthority('SYS_ADMIN', 'TENANT_ADMIN')")
    @DeleteMapping("/model/logs/{modelId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteModelLogs(
            @Parameter(description = "Model ID") @PathVariable("modelId") String modelId) throws ThingsboardException {
        try {
            modelLogService.deleteByModelId(modelId);
            log.info("Deleted all logs for model: {}", modelId);
        } catch (Exception e) {
            log.error("Failed to delete model logs for modelId: {}", modelId, e);
            throw new ThingsboardException(e.getMessage(), ThingsboardErrorCode.GENERAL);
        }
    }
}
