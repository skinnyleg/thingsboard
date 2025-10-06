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
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * WebSocket update message for predictive maintenance.
 * Sent to subscribed clients when new predictions are available.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictiveMaintenanceUpdate {

    private String subscriptionId;
    private PredictiveMaintenanceUpdateType updateType;
    private JsonNode data;
    private Long timestamp;

    public enum PredictiveMaintenanceUpdateType {
        ANOMALY_DETECTED, // Anomaly prediction result
        FORECAST_UPDATE, // New forecast available
        JOB_STATUS_CHANGE, // Job started/stopped
        MODEL_TRAINED, // Model training completed
        ERROR // Error occurred
    }
}
