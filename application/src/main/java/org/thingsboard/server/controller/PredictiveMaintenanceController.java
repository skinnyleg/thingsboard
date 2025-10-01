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

import org.springframework.web.bind.annotation.RestController;
import org.thingsboard.server.queue.util.TbCoreComponent;
import org.thingsboard.server.service.predictive.FastAPIService;
import org.thingsboard.server.service.predictive.TbForecastsService;
import org.thingsboard.server.service.predictive.TbAnomalyDetectorService;

import com.fasterxml.jackson.databind.JsonNode;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.thingsboard.server.common.data.exception.ThingsboardErrorCode;
import org.thingsboard.server.common.data.exception.ThingsboardException;
import org.thingsboard.server.common.data.id.ForecastId;
import org.thingsboard.server.common.data.id.DetectorId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.common.data.Forecast;
import org.thingsboard.server.common.data.Detector;
import org.thingsboard.server.config.annotations.ApiOperation;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ResponseBody;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@TbCoreComponent
@RequestMapping("/api")
public class PredictiveMaintenanceController extends BaseController {

    @Autowired
    private FastAPIService fastAPIService;

    @Autowired
    protected TbForecastsService forecastsService;

    @Autowired
    protected TbAnomalyDetectorService anomalyDetectorService;

    @ApiOperation(value = "Get predictiveMaintenance Hello World", notes = "access the hello world in predictive maintenance route directive")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @GetMapping(value = "/predictiveMaintenance", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public JsonNode getHelloWorld() {
        return fastAPIService.getHelloWorld();
    }

    @ApiOperation(value = "Get predictiveMaintenance forecasts", notes = "access the forecasts in predictive maintenance route directive")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @GetMapping(value = "/forecasts", params = { "pageSize", "page" })
    @ResponseBody
    public PageData<Forecast> getForcasts(
            @Parameter(description = "The number of items to return", required = true) @RequestParam int pageSize,
            @Parameter(description = "The page number", required = true) @RequestParam int page,
            @Parameter(description = "The sort property", schema = @Schema(allowableValues = { "name", "createdTime",
                    "entityId" })) @RequestParam(required = false) String sortProperty,
            @Parameter(description = "The sort order", schema = @Schema(allowableValues = { "ASC",
                    "DESC" })) @RequestParam(required = false) String sortOrder,
            @Parameter(description = "The text search") @RequestParam(required = false) String textSearch)
            throws ThingsboardException {
        TenantId tenantId = getCurrentUser().getTenantId();
        PageLink pageLink = createPageLink(pageSize, page, textSearch, sortProperty, sortOrder);
        return checkNotNull(forecastsService.findTenantForcasts(tenantId, pageLink));
    }

    // get model status by forecastId
    @ApiOperation(value = "Get predictiveMaintenance model status by forecastId", notes = "access the model status by forecastId in predictive maintenance route directive")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @GetMapping(value = "/forecasts/{forecastId}/status", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public JsonNode getModelStatus(
            @Parameter(description = "Forecast Id") @PathVariable("forecastId") String strForecastId)
            throws ThingsboardException {
        checkParameter("forecastId", strForecastId);
        ForecastId forecastId = new ForecastId(toUUID(strForecastId));
        return fastAPIService.getModelStatus(forecastId);
    }

    @ApiOperation(value = "Get predictiveMaintenance forecast by id", notes = "access the forecast by id")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @GetMapping(value = "/forecasts/{forecastId}")
    @ResponseBody
    public Forecast getForecast(
            @Parameter(description = "Forecast Id") @PathVariable("forecastId") String strForecastId)
            throws ThingsboardException {
        checkParameter("forecastId", strForecastId);
        ForecastId forecastId = new ForecastId(toUUID(strForecastId));
        return checkNotNull(forecastsService.findTenantForecast(getTenantId(), forecastId));
    }

    @ApiOperation(value = "Post predictiveMaintenance forecast", notes = "access the forecasts in predictive maintenance route directive")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @PostMapping(value = "/forecasts", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Forecast saveForecast(@RequestBody Forecast forecast) throws Exception {
        TenantId tenantId = getCurrentUser().getTenantId();
        forecast.setId(null);
        forecast.setTenantId(tenantId);
        return checkNotNull(forecastsService.save(forecast, getCurrentUser()));
    }

    @ApiOperation(value = "Update predictiveMaintenance forecast", notes = "Update an existing forecast including view preferences")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @PostMapping(value = "/forecasts/{forecastId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Forecast updateForecast(
            @Parameter(description = "Forecast Id") @PathVariable("forecastId") String strForecastId,
            @RequestBody Forecast forecast) throws Exception {
        checkParameter("forecastId", strForecastId);
        ForecastId forecastId = new ForecastId(toUUID(strForecastId));
        TenantId tenantId = getCurrentUser().getTenantId();

        // Ensure the forecast ID and tenant ID are set correctly
        forecast.setId(forecastId);
        forecast.setTenantId(tenantId);

        return checkNotNull(forecastsService.save(forecast, getCurrentUser()));
    }

    @ApiOperation(value = "Delete predictiveMaintenance forecast", notes = "access the forecasts in predictive maintenance route directive")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @DeleteMapping(value = "/forecasts/{forecastId}")
    @ResponseBody
    public void deleteForecast(@PathVariable("forecastId") String strForecastId) throws ThingsboardException {
        checkParameter("forecastId", strForecastId);
        ForecastId forecastId = new ForecastId(toUUID(strForecastId));
        forecastsService.delete(new Forecast(forecastId), getCurrentUser());
    }

    @ApiOperation(value = "Activate predictiveMaintenance forecast", notes = "access the forecasts in predictive maintenance route directive")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @PatchMapping(value = "/forecasts/{forecastId}/activate")
    @ResponseBody
    public void activateForecast(@PathVariable("forecastId") String strForecastId) throws Exception {
        checkParameter("forecastId", strForecastId);
        ForecastId forecastId = new ForecastId(toUUID(strForecastId));
        // check if forecast exists otherwise not found
        checkNotNull(forecastsService.findTenantForecast(getTenantId(), forecastId));
        try {
            fastAPIService.activateForecast(forecastId);
        } catch (Exception e) {
            throw new ThingsboardException("Failed to activate forecast", e, ThingsboardErrorCode.GENERAL);
        }
    }

    // create anomaly detector apis
    @ApiOperation(value = "Get predictiveMaintenance detectors", notes = "access the detectors in predictive maintenance route directive")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @GetMapping(value = "/detectors", params = { "pageSize", "page" })
    @ResponseBody
    public PageData<Detector> getDetectors(
            @Parameter(description = "The number of items to return", required = true) @RequestParam int pageSize,
            @Parameter(description = "The page number", required = true) @RequestParam int page,
            @Parameter(description = "The sort property", schema = @Schema(allowableValues = { "name", "createdTime",
                    "entityId" })) @RequestParam(required = false) String sortProperty,
            @Parameter(description = "The sort order", schema = @Schema(allowableValues = { "ASC",
                    "DESC" })) @RequestParam(required = false) String sortOrder,
            @Parameter(description = "The text search") @RequestParam(required = false) String textSearch)
            throws ThingsboardException {
        TenantId tenantId = getCurrentUser().getTenantId();
        PageLink pageLink = createPageLink(pageSize, page, textSearch, sortProperty, sortOrder);
        return checkNotNull(anomalyDetectorService.findTenantDetectors(tenantId, pageLink));
    }

    @ApiOperation(value = "Get predictiveMaintenance detector by id", notes = "access the detector by id")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @GetMapping(value = "/detectors/{detectorId}")
    @ResponseBody
    public Detector getDetector(
            @Parameter(description = "Detector Id") @PathVariable("detectorId") String strDetectorId)
            throws ThingsboardException {
        checkParameter("detectorId", strDetectorId);
        DetectorId detectorId = new DetectorId(toUUID(strDetectorId));
        return checkNotNull(anomalyDetectorService.findTenantDetector(getTenantId(), detectorId));
    }

    @ApiOperation(value = "Post predictiveMaintenance detector", notes = "access the detectors in predictive maintenance route directive")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @PostMapping(value = "/detectors", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Detector saveDetector(@RequestBody Detector detector) throws Exception {
        TenantId tenantId = getCurrentUser().getTenantId();
        detector.setId(null);
        detector.setTenantId(tenantId);
        return checkNotNull(anomalyDetectorService.save(detector, getCurrentUser()));
    }
}
