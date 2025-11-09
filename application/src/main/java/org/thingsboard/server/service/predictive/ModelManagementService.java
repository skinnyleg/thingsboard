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
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.id.TenantId;

import java.util.List;
import java.util.UUID;

/**
 * Service interface for managing ML models integration with Python predictive
 * maintenance service.
 * 
 * This service handles:
 * - Socket communication with Python FastAPI service for model training
 * - Storing model metadata in ml_models table
 * - Managing model lifecycle (creation, updates, activation)
 */
public interface ModelManagementService {

    /**
     * Request model training via socket connection to Python service.
     * Upon successful training, stores model metadata in ml_models table.
     * 
     * @param tenantId    Tenant ID
     * @param deviceId    Device ID (can be null for global models)
     * @param modelType   Type of model (AnomalyPredictor, ForecastModel)
     * @param algorithm   Algorithm name (XGBoost, Prophet, etc.)
     * @param hyperparams Algorithm hyperparameters as JSON
     * @return UUID of created/updated ml_models record
     */
    UUID activateModel(TenantId tenantId, DeviceId deviceId, String modelType, String algorithm, JsonNode hyperparams);

    /**
     * Get model status from ml_models table.
     * 
     * @param modelId Model UUID from ml_models table
     * @return Model metadata including is_active, metrics, etc.
     */
    JsonNode getModelStatus(UUID modelId);

    /**
     * Deactivate a model (sets is_active = false).
     * 
     * @param modelId Model UUID from ml_models table
     */
    void deactivateModel(UUID modelId);

    /**
     * Get active model for a device and type.
     * 
     * @param deviceId  Device ID
     * @param modelType Type of model (AnomalyPredictor, ForecastModel)
     * @return Model UUID or null if no active model
     */
    UUID getActiveModelForDevice(DeviceId deviceId, String modelType);

    /**
     * Start prediction jobs for active models.
     * Called on application startup to resume prediction jobs.
     * 
     * @param tenantId Tenant ID
     * @return JSON with started job IDs
     */
    JsonNode startActiveModelJobs(TenantId tenantId);

    /**
     * Stop prediction jobs for specific models.
     * 
     * @param modelIds List of model IDs to stop
     * @return JSON with stopped job IDs
     */
    JsonNode stopModelJobs(List<String> modelIds);

    /**
     * Get status of running prediction jobs.
     * 
     * @param modelIds Optional list of model IDs (null = all jobs)
     * @return JSON with job statuses
     */
    JsonNode getJobStatus(List<String> modelIds);

    /**
     * Get logs for a specific model.
     * 
     * @param modelId Model ID (from ml_models.model_id column, not UUID)
     * @param level   Log level filter (info, warn, error, all)
     * @param limit   Maximum number of log entries
     * @return JSON with log entries
     */
    JsonNode getModelLogs(String modelId, String level, int limit, String type);

    /**
     * Fetch predictions from the predictions table.
     * 
     * @param modelId        Model ID (predictive_maintenance_config UUID)
     * @param startTs        Start timestamp in milliseconds (optional)
     * @param endTs          End timestamp in milliseconds (optional)
     * @param predictionType Prediction type filter (Anomaly, Forecast, Failure -
     *                       optional)
     * @param limit          Maximum number of records to return
     * @return JSON with predictions array and totalCount
     */
    JsonNode fetchPredictions(UUID modelId, Long startTs, Long endTs, String predictionType, int limit);

    /**
     * Delete predictions for a specific model
     *
     * @param modelId        Model ID (predictive_maintenance_config ID)
     * @param predictionType Optional prediction type filter (Anomaly, Forecast,
     *                       Failure)
     * @return Number of deleted records
     */
    int deletePredictions(UUID modelId, String predictionType);
}
