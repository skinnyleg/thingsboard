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
package org.thingsboard.server.dao.deviceerror;

import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.maintenance.DeviceError;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.Dao;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

public interface DeviceErrorDao extends Dao<DeviceError> {

    /**
     * Save or update device error
     */
    DeviceError save(DeviceError deviceError);

    /**
     * Find device error by ID
     */
    DeviceError findById(UUID id);

    /**
     * Find device errors by device ID with time window
     */
    PageData<DeviceError> findByDeviceId(DeviceId deviceId, Timestamp startTime, Timestamp endTime,
            PageLink pageLink);

    /**
     * Find all device errors by device ID
     */
    List<DeviceError> findAllByDeviceId(DeviceId deviceId);

    /**
     * Delete device error by ID
     */
    boolean removeById(UUID id);

    /**
     * Delete all device errors by device ID
     */
    void removeByDeviceId(DeviceId deviceId);
}
