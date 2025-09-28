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
package org.thingsboard.server.common.data.forecast;

/**
 * Enum representing the status of a Forecast model.
 */
public enum ForecastStatus {
    /**
     * The forecast is inactive and not running.
     */
    INACTIVE("inactive"),
    
    /**
     * The forecast is active and running.
     */
    ACTIVE("active"),
    
    /**
     * The forecast is pending activation or processing.
     */
    PENDING("pending"),
    
    /**
     * The forecast has failed during execution or processing.
     */
    FAILED("failed");

    private final String value;

    ForecastStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static ForecastStatus fromString(String value) {
        if (value == null) {
            return INACTIVE;
        }
        for (ForecastStatus status : ForecastStatus.values()) {
            if (status.value.equalsIgnoreCase(value)) {
                return status;
            }
        }
        return INACTIVE; // Default to inactive if unknown value
    }

    @Override
    public String toString() {
        return value;
    }
}