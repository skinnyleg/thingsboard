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

import org.thingsboard.server.common.data.id.DeviceErrorId;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.maintenance.DeviceError;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;

import java.sql.Timestamp;
import java.util.List;

public interface DeviceErrorService {

    /**
     * Save or update device error
     */
    DeviceError saveDeviceError(DeviceError deviceError);

    /**
     * Find device error by ID
     */
    DeviceError findDeviceErrorById(DeviceErrorId id);

    /**
     * Find device errors by device ID with time window and pagination
     */
    PageData<DeviceError> findDeviceErrorsByDeviceId(DeviceId deviceId, Timestamp startTime, Timestamp endTime, PageLink pageLink);

    /**
     * Find all device errors by device ID
     */
    List<DeviceError> findAllDeviceErrorsByDeviceId(DeviceId deviceId);

    /**
     * Delete device error by ID
     */
    void deleteDeviceError(DeviceErrorId id);

    /**
     * Delete all device errors by device ID
     */
    void deleteDeviceErrorsByDeviceId(DeviceId deviceId);
}
