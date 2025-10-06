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

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import org.thingsboard.server.service.ws.WsCmd;
import org.thingsboard.server.service.ws.WsCmdType;

import java.util.List;

/**
 * WebSocket command for predictive maintenance operations.
 * 
 * Supported actions:
 * - ACTIVATE_MODEL: Train and activate models for a device
 * - START_JOBS: Start prediction jobs
 * - STOP_JOBS: Stop prediction jobs
 * - GET_JOB_STATUS: Query job status
 * - GET_MODEL_LOGS: Retrieve model logs
 * - SUBSCRIBE_PREDICTIONS: Subscribe to real-time predictions
 * - UNSUBSCRIBE_PREDICTIONS: Unsubscribe from predictions
 */
@Getter
public class PredictiveMaintenanceCmd implements WsCmd {

    private final int cmdId;
    private final PredictiveMaintenanceAction action;

    // For ACTIVATE_MODEL
    private final String deviceId;

    // For STOP_JOBS, GET_JOB_STATUS
    private final List<String> modelIds;

    // For GET_MODEL_LOGS
    private final String modelId;
    private final String logLevel; // all, info, warn, error
    private final Integer logLimit; // max number of logs to retrieve

    // For SUBSCRIBE_PREDICTIONS
    private final String subscriptionType; // anomaly, forecast, all

    @JsonCreator
    public PredictiveMaintenanceCmd(
            @JsonProperty("cmdId") int cmdId,
            @JsonProperty("action") PredictiveMaintenanceAction action,
            @JsonProperty("deviceId") String deviceId,
            @JsonProperty("modelIds") List<String> modelIds,
            @JsonProperty("modelId") String modelId,
            @JsonProperty("logLevel") String logLevel,
            @JsonProperty("logLimit") Integer logLimit,
            @JsonProperty("subscriptionType") String subscriptionType) {
        this.cmdId = cmdId;
        this.action = action;
        this.deviceId = deviceId;
        this.modelIds = modelIds;
        this.modelId = modelId;
        this.logLevel = logLevel != null ? logLevel : "all";
        this.logLimit = logLimit != null ? logLimit : 100;
        this.subscriptionType = subscriptionType != null ? subscriptionType : "all";
    }

    @Override
    public WsCmdType getType() {
        return WsCmdType.PREDICTIVE_MAINTENANCE;
    }

    public enum PredictiveMaintenanceAction {
        ACTIVATE_MODEL, // Train and start jobs
        START_JOBS, // Start all active jobs
        STOP_JOBS, // Stop specific jobs
        GET_JOB_STATUS, // Query job status
        GET_MODEL_LOGS, // Retrieve logs
        SUBSCRIBE_PREDICTIONS, // Subscribe to prediction stream
        UNSUBSCRIBE_PREDICTIONS // Unsubscribe from predictions
    }
}
