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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.thingsboard.server.config.annotations.ApiOperation;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ResponseBody;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@TbCoreComponent
@RequestMapping("/api")
public class PredictiveMaintenanceController extends BaseController {
    @ApiOperation(value = "Get predictiveMaintenance Hello World",
    notes = "access the hello world in predictive maintenance route directive")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @GetMapping("/predictiveMaintenance")
    @ResponseBody
    public String getHelloWorld() {
        return "Hello World";
    }
}
