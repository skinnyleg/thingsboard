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
package org.thingsboard.server.service.install;

import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvException;
import com.opencsv.exceptions.CsvValidationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallbackWithoutResult;
import org.springframework.transaction.support.TransactionTemplate;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.kv.BasicTsKvEntry;
import org.thingsboard.server.common.data.kv.StringDataEntry;
import org.thingsboard.server.common.data.kv.TsKvEntry;
import org.thingsboard.server.dao.tenant.TenantService;
import org.thingsboard.server.dao.timeseries.TimeseriesService;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

/**
 * Automatically loads predictive maintenance sample data on Spring Boot startup
 * Adjusts timestamps to make data current (ending at current time)
 */
@Slf4j
@Component
@Order(2) // Run after PredictiveMaintenanceDataLoader
public class PredictiveMaintenanceStartupLoader implements CommandLineRunner {
    @Autowired
    private TimeseriesService timeseriesService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TenantService tenantService;

    @Autowired
    private PredictiveMaintenanceDataLoader dataLoader;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Value("${predictive-maintenance.auto-load-on-startup:false}")
    private boolean autoLoadOnStartup;

    @Value("${predictive-maintenance.rollback-on-failure:true}")
    private boolean rollbackOnFailure;

    @Value("${predictive-maintenance.exit-on-failure:true}")
    private boolean exitOnFailure;

    @Value("${predictive-maintenance.data-path:predictive-maintenance/data}")
    private String dataPath;

    @Value("${predictive-maintenance.tenant-email:tenant@thingsboard.org}")
    private String tenantEmail;

    @Value("${predictive-maintenance.machine-filter.machine-ids:}")
    private String machineIdsConfig;

    @Value("${predictive-maintenance.machine-filter.max-machines:100}")
    private int maxMachines;

    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    private long timeAdjustmentMillis = 0;

    // Filtered machine IDs to load
    private Set<Integer> allowedMachineIds = null;

    @Override
    public void run(String... args) {
        if (!autoLoadOnStartup) {
            log.info("Predictive maintenance auto-load on startup is disabled. Set 'predictive-maintenance.auto-load-on-startup=true' to enable.");
            return;
        }

        try {
            // Wait for PredictiveMaintenanceDataLoader to complete if it's running
            if (dataLoader.isLoadingInProgress()) {
                log.info("Waiting for PredictiveMaintenanceDataLoader to complete before starting startup loader...");
                dataLoader.waitForLoadingComplete();
                log.info("PredictiveMaintenanceDataLoader completed. Continuing with startup loader...");
            }

            log.info("Starting predictive maintenance automatic data loading on startup...");
            log.info("Rollback on failure: {}, Exit on failure: {}", rollbackOnFailure, exitOnFailure);

            // Parse and validate machine filter configuration
            parseMachineFilter();

            // Check if data already exists
            if (!isDataAlreadyLoaded()) {
                log.info("No predictive maintenance data found. Skipping startup load.");
                return;
            }

            Optional<TenantId> tenant = tenantService.findTenantByEmail(tenantEmail);
            if (!tenant.isPresent()) {
                log.error("Tenant with email {} not found", tenantEmail);
                return;
            }

            TenantId tenantId = tenant.get();

            // Calculate time adjustment to make data end at current time
            calculateTimeAdjustmentToNow();

            // Get existing devices
            Map<Integer, UUID> machineToDeviceMap = loadExistingDevices();

            if (rollbackOnFailure) {
                // Load data with transaction support and automatic rollback on failure
                TransactionTemplate transactionTemplate = new TransactionTemplate(transactionManager);
                transactionTemplate.execute(new TransactionCallbackWithoutResult() {
                    @Override
                    protected void doInTransactionWithoutResult(TransactionStatus status) {
                        try {
                            log.info("Reloading data within transaction...");
                            // Reload all timeseries data with adjusted timestamps
                            reloadAllTimeseriesData(machineToDeviceMap, tenantId);
                            log.info("Predictive maintenance data reloaded successfully with current timestamps!");
                        } catch (Exception e) {
                            log.error("Error during data reloading, rolling back transaction", e);
                            status.setRollbackOnly();
                            throw new RuntimeException("Failed to reload predictive maintenance data", e);
                        }
                    }
                });
            } else {
                // Load data without transaction (no automatic rollback)
                log.info("Reloading data without transaction support (rollback disabled)...");
                reloadAllTimeseriesData(machineToDeviceMap, tenantId);
                log.info("Predictive maintenance data reloaded successfully with current timestamps!");
            }
        } catch (Exception e) {
            log.error("Failed to reload predictive maintenance data on startup", e);
            if (rollbackOnFailure) {
                log.error("All database changes have been rolled back due to failure");
            }
            if (exitOnFailure) {
                log.error("Application will exit due to critical data reloading failure");
                System.exit(1); // Exit with error code
            }
        }
    }

    /**
     * Parse and validate machine filter configuration
     */
    private void parseMachineFilter() {
        if (machineIdsConfig == null || machineIdsConfig.trim().isEmpty()) {
            log.info("No machine ID list configured. Will reload first {} machines (max-machines limit).", maxMachines);
            allowedMachineIds = null; // null means use max-machines limit
            return;
        }

        allowedMachineIds = new HashSet<>();
        String[] machineIdStrings = machineIdsConfig.split(",");

        for (String machineIdStr : machineIdStrings) {
            try {
                Integer machineId = Integer.parseInt(machineIdStr.trim());
                allowedMachineIds.add(machineId);
            } catch (NumberFormatException e) {
                String errorMsg = "Invalid machine ID in configuration: " + machineIdStr;
                log.error(errorMsg);
                throw new IllegalArgumentException(errorMsg, e);
            }
        }

        // Validate that the number of machines doesn't exceed the maximum
        if (allowedMachineIds.size() > maxMachines) {
            String errorMsg = String.format(
                "Number of configured machine IDs (%d) exceeds maximum allowed (%d). " +
                "Please reduce the machine-ids list or increase max-machines setting.",
                allowedMachineIds.size(), maxMachines
            );
            log.error(errorMsg);
            throw new IllegalArgumentException(errorMsg);
        }

        log.info("Machine filter configured: {} specific machines will be reloaded (max allowed: {})",
                 allowedMachineIds.size(), maxMachines);
        log.debug("Allowed machine IDs: {}", allowedMachineIds);
    }

    /**
     * Check if a machine ID should be loaded based on the filter
     * @param machineId the machine ID to check
     * @param loadedCount current count of loaded machines (used for max-machines limit)
     * @return true if machine should be loaded
     */
    private boolean shouldLoadMachine(Integer machineId, int loadedCount) {
        if (allowedMachineIds == null) {
            // No specific list configured, use max-machines limit
            return loadedCount < maxMachines;
        }
        // Specific list configured, check if machine is in the list
        return allowedMachineIds.contains(machineId);
    }

    /**
     * Check if data is already loaded
     */
    private boolean isDataAlreadyLoaded() {
        String sql = "SELECT COUNT(*) FROM device WHERE name LIKE 'PdM-Machine-%'";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
        return count != null && count > 0;
    }

    /**
     * Calculate time adjustment to make max date = current time
     */
    private void calculateTimeAdjustmentToNow() throws IOException, CsvException, ParseException {
        Date maxDate = findMaxDateInDatasets();
        long currentTimeMillis = System.currentTimeMillis();

        timeAdjustmentMillis = currentTimeMillis - maxDate.getTime();

        log.info("Original max date: {}", DATE_FORMAT.format(maxDate));
        log.info("Target max date (now): {}", DATE_FORMAT.format(new Date(currentTimeMillis)));
        log.info("Time adjustment: {} days", timeAdjustmentMillis / (24 * 60 * 60 * 1000));
    }

    /**
     * Find the maximum date across all CSV files
     */
    private Date findMaxDateInDatasets() throws IOException, CsvException, ParseException {
        Date maxDate = new Date(0);

        // Check errors file
        List<String[]> errorRows = readCsv(dataPath + "/PdM_errors.csv");
        for (int i = 1; i < errorRows.size(); i++) {
            Date date = DATE_FORMAT.parse(errorRows.get(i)[0]);
            if (date.after(maxDate))
                maxDate = date;
        }

        // Check failures file
        List<String[]> failureRows = readCsv(dataPath + "/PdM_failures.csv");
        for (int i = 1; i < failureRows.size(); i++) {
            Date date = DATE_FORMAT.parse(failureRows.get(i)[0]);
            if (date.after(maxDate))
                maxDate = date;
        }

        // Check maintenance file
        List<String[]> maintRows = readCsv(dataPath + "/PdM_maint.csv");
        for (int i = 1; i < maintRows.size(); i++) {
            Date date = DATE_FORMAT.parse(maintRows.get(i)[0]);
            if (date.after(maxDate))
                maxDate = date;
        }

        // Check telemetry file
        List<String[]> telemetryRows = readCsv(dataPath + "/PdM_telemetry.csv");
        for (int i = 1; i < telemetryRows.size(); i++) {
            Date date = DATE_FORMAT.parse(telemetryRows.get(i)[0]);
            if (date.after(maxDate))
                maxDate = date;
        }

        return maxDate;
    }

    /**
     * Load existing device mappings from database
     */
    private Map<Integer, UUID> loadExistingDevices() {
        Map<Integer, UUID> machineToDeviceMap = new HashMap<>();
        final int[] loadedCount = {0}; // Use array to allow modification in lambda

        String sql = "SELECT id, name FROM device WHERE name LIKE 'PdM-Machine-%' ORDER BY name";
        jdbcTemplate.query(sql, rs -> {
            UUID deviceId = UUID.fromString(rs.getString("id"));
            String deviceName = rs.getString("name");
            // Extract machine ID from name (e.g., "PdM-Machine-1" -> 1)
            Integer machineId = Integer.parseInt(deviceName.substring("PdM-Machine-".length()));

            // Check if this machine should be loaded based on filter
            if (shouldLoadMachine(machineId, loadedCount[0])) {
                machineToDeviceMap.put(machineId, deviceId);
                loadedCount[0]++;
            }
        });

        log.info("Found {} existing PdM devices to reload", machineToDeviceMap.size());
        return machineToDeviceMap;
    }

    /**
     * Reload all timeseries data with adjusted timestamps
     * Uses concurrent saves for better performance
     */
    private void reloadAllTimeseriesData(Map<Integer, UUID> machineToDeviceMap, TenantId tenantId)
            throws IOException, CsvException, ParseException, ExecutionException, InterruptedException {
        log.info("Reloading all timeseries data with current timestamps...");

        // Map from deviceId to list of all telemetry entries
        Map<UUID, List<TsKvEntry>> deviceTelemetryMap = new HashMap<>();

        // Load all data types
        loadTelemetryData(machineToDeviceMap, deviceTelemetryMap);
        loadErrorsData(machineToDeviceMap, deviceTelemetryMap);
        loadFailuresData(machineToDeviceMap, deviceTelemetryMap);
        loadMaintenanceData(machineToDeviceMap, deviceTelemetryMap);

        // Clear existing timeseries data using TimeseriesService
        log.info("Clearing existing timeseries data for {} devices...", machineToDeviceMap.size());
        List<ListenableFuture<List<Void>>> clearFutures = new ArrayList<>();

        for (UUID deviceId : machineToDeviceMap.values()) {
            // Remove all latest entries for this device
            ListenableFuture<Collection<String>> keysFuture = timeseriesService.removeAllLatest(tenantId, new DeviceId(deviceId));
            clearFutures.add(Futures.transform(keysFuture,
                keys -> {
                    log.debug("Cleared {} timeseries keys for device {}", keys.size(), deviceId);
                    return null;
                },
                Runnable::run));
        }

        // Wait for all clears to complete
        Futures.allAsList(clearFutures).get();
        log.info("Cleared timeseries data for all devices");

        // Save all new telemetry data concurrently
        log.info("Saving updated timeseries data for {} devices concurrently...", deviceTelemetryMap.size());
        List<ListenableFuture<Integer>> saveFutures = new ArrayList<>();

        for (Map.Entry<UUID, List<TsKvEntry>> entry : deviceTelemetryMap.entrySet()) {
            UUID deviceId = entry.getKey();
            List<TsKvEntry> telemetryEntries = entry.getValue();
            if (!telemetryEntries.isEmpty()) {
                ListenableFuture<Integer> future = timeseriesService.save(
                    tenantId,
                    new DeviceId(deviceId),
                    telemetryEntries,
                    0L
                );
                saveFutures.add(future);
                log.debug("Scheduled save of {} timeseries entries for device {}",
                         telemetryEntries.size(), deviceId);
            }
        }

        // Wait for all saves to complete
        List<Integer> results = Futures.allAsList(saveFutures).get();
        log.info("Successfully reloaded timeseries data for {} devices", results.size());
    }

    private void loadTelemetryData(Map<Integer, UUID> machineToDeviceMap, Map<UUID, List<TsKvEntry>> deviceTelemetryMap)
            throws IOException, CsvException, ParseException, CsvValidationException {
        log.info("Loading telemetry records...");

        ClassPathResource resource = new ClassPathResource(dataPath + "/PdM_telemetry.csv");

        try (CSVReader csvReader = new CSVReader(new InputStreamReader(
                resource.getInputStream(), StandardCharsets.UTF_8))) {

            String[] header = csvReader.readNext();
            if (header == null) {
                log.warn("No telemetry data found in PdM_telemetry.csv");
                return;
            }

            int totalRows = 0;
            int skippedRows = 0;

            // Use iterator for memory-efficient streaming
            Iterator<String[]> iterator = csvReader.iterator();

            while (iterator.hasNext()) {
                String[] row = iterator.next();
                totalRows++;

                try {
                    Date originalDate = DATE_FORMAT.parse(row[0]);
                    long timestamp = originalDate.getTime() + timeAdjustmentMillis;
                    Integer machineId = Integer.parseInt(row[1]);
                    UUID deviceId = machineToDeviceMap.get(machineId);

                    if (deviceId == null) {
                        skippedRows++;
                        continue;
                    }

                    List<TsKvEntry> telemetryEntries = deviceTelemetryMap.computeIfAbsent(deviceId, k -> new ArrayList<>());
                    for (int j = 2; j < row.length && j < header.length; j++) {
                        String key = header[j];
                        String value = row[j];
                        telemetryEntries.add(new BasicTsKvEntry(timestamp, new StringDataEntry(key, value)));
                    }
                } catch (ParseException | NumberFormatException e) {
                    log.warn("Failed to parse telemetry row {}: {}", totalRows, e.getMessage());
                    skippedRows++;
                }
            }

            log.info("Loaded {} telemetry records for {} devices (skipped {} rows for filtered machines)",
                    totalRows - skippedRows, deviceTelemetryMap.size(), skippedRows);
        }
    }

    private void loadErrorsData(Map<Integer, UUID> machineToDeviceMap, Map<UUID, List<TsKvEntry>> deviceTelemetryMap)
            throws IOException, CsvException, ParseException {
        log.info("Loading errors...");

        List<String[]> rows = readCsv(dataPath + "/PdM_errors.csv");

        for (int i = 1; i < rows.size(); i++) {
            String[] row = rows.get(i);
            Date originalDate = DATE_FORMAT.parse(row[0]);
            long timestamp = originalDate.getTime() + timeAdjustmentMillis;

            Integer machineId = Integer.parseInt(row[1]);
            String errorId = row[2];

            UUID deviceId = machineToDeviceMap.get(machineId);
            if (deviceId == null) continue;

            List<TsKvEntry> telemetryEntries = deviceTelemetryMap.computeIfAbsent(deviceId, k -> new ArrayList<>());
            telemetryEntries.add(new BasicTsKvEntry(timestamp, new StringDataEntry("error_" + errorId, "1")));
        }

        log.info("Loaded {} error records", rows.size() - 1);
    }

    private void loadFailuresData(Map<Integer, UUID> machineToDeviceMap, Map<UUID, List<TsKvEntry>> deviceTelemetryMap)
            throws IOException, CsvException, ParseException {
        log.info("Loading failures...");

        List<String[]> rows = readCsv(dataPath + "/PdM_failures.csv");

        for (int i = 1; i < rows.size(); i++) {
            String[] row = rows.get(i);
            Date originalDate = DATE_FORMAT.parse(row[0]);
            long timestamp = originalDate.getTime() + timeAdjustmentMillis;

            Integer machineId = Integer.parseInt(row[1]);
            String failureComp = row[2];

            UUID deviceId = machineToDeviceMap.get(machineId);
            if (deviceId == null) continue;

            List<TsKvEntry> telemetryEntries = deviceTelemetryMap.computeIfAbsent(deviceId, k -> new ArrayList<>());
            telemetryEntries.add(new BasicTsKvEntry(timestamp, new StringDataEntry("failure_" + failureComp, "1")));
        }

        log.info("Loaded {} failure records", rows.size() - 1);
    }

    private void loadMaintenanceData(Map<Integer, UUID> machineToDeviceMap, Map<UUID, List<TsKvEntry>> deviceTelemetryMap)
            throws IOException, CsvException, ParseException {
        log.info("Loading maintenance records...");

        List<String[]> rows = readCsv(dataPath + "/PdM_maint.csv");

        for (int i = 1; i < rows.size(); i++) {
            String[] row = rows.get(i);
            Date originalDate = DATE_FORMAT.parse(row[0]);
            long timestamp = originalDate.getTime() + timeAdjustmentMillis;

            Integer machineId = Integer.parseInt(row[1]);
            String component = row[2];

            UUID deviceId = machineToDeviceMap.get(machineId);
            if (deviceId == null) continue;

            List<TsKvEntry> telemetryEntries = deviceTelemetryMap.computeIfAbsent(deviceId, k -> new ArrayList<>());
            telemetryEntries.add(new BasicTsKvEntry(timestamp, new StringDataEntry("maintenance_" + component, "1")));
        }

        log.info("Loaded {} maintenance records", rows.size() - 1);
    }

    private List<String[]> readCsv(String path) throws IOException, CsvException {
        ClassPathResource resource = new ClassPathResource(path);
        try (CSVReader reader = new CSVReader(new InputStreamReader(
                resource.getInputStream(), StandardCharsets.UTF_8))) {
            return reader.readAll();
        }
    }
}
