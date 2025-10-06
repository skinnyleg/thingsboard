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
package org.thingsboard.server.dao.sql.deviceerror;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.thingsboard.server.dao.model.sql.DeviceErrorEntity;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

public interface DeviceErrorRepository extends JpaRepository<DeviceErrorEntity, UUID> {

    @Query("SELECT de FROM DeviceErrorEntity de WHERE de.deviceId = :deviceId " +
            "AND (:startTime IS NULL OR de.errorTime >= :startTime) " +
            "AND (:endTime IS NULL OR de.errorTime <= :endTime) " +
            "ORDER BY de.errorTime DESC")
    Page<DeviceErrorEntity> findByDeviceIdAndTimeWindow(@Param("deviceId") UUID deviceId,
            @Param("startTime") Timestamp startTime,
            @Param("endTime") Timestamp endTime,
            Pageable pageable);

    @Query("SELECT de FROM DeviceErrorEntity de WHERE de.deviceId = :deviceId " +
            "ORDER BY de.errorTime DESC")
    List<DeviceErrorEntity> findAllByDeviceId(@Param("deviceId") UUID deviceId);

    void deleteByDeviceId(UUID deviceId);
}
