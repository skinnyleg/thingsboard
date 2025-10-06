package org.thingsboard.server.service.ws;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Job information for tracking active prediction jobs
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JobInfo {
    private String predictiveModelId;  // Renamed from forecastId, but keeping wire protocol compatibility
    private String deviceId;
    private String modelType;
    private String status;
    private String startTime;
    private int iterations;
    private boolean loadedFromDb;

    public JobInfo(String predictiveModelId) {
        this.predictiveModelId = predictiveModelId;
        this.loadedFromDb = false;
    }

    public JobInfo(String predictiveModelId, boolean loadedFromDb) {
        this.predictiveModelId = predictiveModelId;
        this.loadedFromDb = loadedFromDb;
    }

    // Deprecated compatibility methods
    @Deprecated
    public void setForecastId(String forecastId) {
        this.predictiveModelId = forecastId;
    }

    @Deprecated
    public String getForecastId() {
        return this.predictiveModelId;
    }
}
