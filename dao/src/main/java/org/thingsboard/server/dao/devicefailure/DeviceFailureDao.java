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
package org.thingsboard.server.dao.devicefailure;

import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.maintenance.DeviceFailure;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.Dao;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

public interface DeviceFailureDao extends Dao<DeviceFailure> {

    /**
     * Save or update device failure
     */
    DeviceFailure save(DeviceFailure deviceFailure);

    /**
     * Find device failure by ID
     */
    DeviceFailure findById(UUID id);

    /**
     * Find device failures by device ID with time window
     */
    PageData<DeviceFailure> findByDeviceId(DeviceId deviceId, Timestamp startTime, Timestamp endTime,
            PageLink pageLink);

    /**
     * Find all device failures by device ID
     */
    List<DeviceFailure> findAllByDeviceId(DeviceId deviceId);

    /**
     * Delete device failure by ID
     */
    boolean removeById(UUID id);

    /**
     * Delete all device failures by device ID
     */
    void removeByDeviceId(DeviceId deviceId);
}
