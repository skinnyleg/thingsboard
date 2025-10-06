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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.thingsboard.server.common.data.id.TenantId;

/**
 * Application runner that starts prediction jobs for all active models on
 * startup.
 * 
 * This ensures that any models that were running before a restart
 * will automatically resume their prediction jobs.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PredictiveMaintenanceJobStarter implements ApplicationRunner {

    private final ModelManagementService modelManagementService;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        log.info("===========================================");
        log.info("Starting Predictive Maintenance Job Starter");
        log.info("===========================================");

        try {
            // Give ThingsBoard time to fully initialize (5 seconds)
            Thread.sleep(5000);

            log.info("Checking for active models to start prediction jobs...");

            // Start jobs for all active models (uses system/default tenant)
            // In a multi-tenant system, you might want to iterate through all tenants
            JsonNode result = modelManagementService.startActiveModelJobs(TenantId.SYS_TENANT_ID);

            if (result.has("started")) {
                int startedCount = result.get("started").size();
                log.info("Successfully started {} prediction jobs", startedCount);

                if (startedCount > 0) {
                    log.info("Started jobs for models:");
                    result.get("started").forEach(modelId -> log.info("  - {}", modelId.asText()));
                }
            }

            if (result.has("already_running")) {
                int runningCount = result.get("already_running").size();
                if (runningCount > 0) {
                    log.info("{} jobs were already running", runningCount);
                }
            }

            if (result.has("failed")) {
                int failedCount = result.get("failed").size();
                if (failedCount > 0) {
                    log.warn("{} jobs failed to start", failedCount);
                }
            }

            log.info("Predictive Maintenance jobs initialization complete");

        } catch (Exception e) {
            log.error("Failed to start predictive maintenance jobs on startup", e);
            // Don't throw exception - allow application to continue starting
        }
    }
}
