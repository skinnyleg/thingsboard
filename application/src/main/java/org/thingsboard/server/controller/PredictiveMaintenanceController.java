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

import com.fasterxml.jackson.databind.JsonNode;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.thingsboard.server.common.data.exception.ThingsboardException;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.common.data.Forecast;
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
}
