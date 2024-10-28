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

import java.time.Duration;
import java.time.temporal.ChronoUnit;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.DefaultUriBuilderFactory;
import org.thingsboard.server.common.data.exception.ThingsboardErrorCode;
import org.thingsboard.server.common.data.exception.ThingsboardException;
import org.thingsboard.server.common.data.id.ForecastId;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

@Service
public class DefaultFastAPIService implements FastAPIService {
    private final static String baseUrl = "http://0.0.0.0:8000/api/v1/";

    private final RestTemplate restTemplate = new RestTemplateBuilder()
            .uriTemplateHandler(new DefaultUriBuilderFactory(baseUrl))
            .setConnectTimeout(Duration.of(15, ChronoUnit.SECONDS))
            .setReadTimeout(Duration.of(15, ChronoUnit.SECONDS))
            .build();

    public JsonNode getHelloWorld() {
        return this.restTemplate.getForObject("predictiveMaintenance", JsonNode.class);
    }

    public void activateForecast(ForecastId forecastId) throws ThingsboardException {
        try {
            this.restTemplate.patchForObject("forecast/{forecastId}/activate", null, JsonNode.class, forecastId);
        } catch (Exception e) {
            throw new ThingsboardException("Failed to activate forecast", e, ThingsboardErrorCode.GENERAL);
        }
    }
}