"""
Data Population Script for Predictive Maintenance Database

This script populates the database with realistic sample data:
- 10 machines with different types
- 48 sensors per machine (as required by ML models)
- 90 days of historical sensor readings
- Failure events and maintenance logs
"""

import sys
import os
from datetime import datetime, timedelta
import random
import numpy as np
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.models import (
    Base,
    Machine,
    Sensor,
    SensorReading,
    MachineFailure,
    MaintenanceLog,
    MLModel,
)


# Configuration
NUM_MACHINES = 10
SENSORS_PER_MACHINE = 48
DAYS_OF_HISTORY = 90
READINGS_PER_HOUR = 12  # One reading every 5 minutes
FAILURE_PROBABILITY = 0.05  # 5% chance of failure per machine


# Machine types and their characteristics
MACHINE_TYPES = {
    "Compressor": {
        "manufacturer": ["Atlas Copco", "Ingersoll Rand", "Sullair"],
        "rated_power": (75, 250),  # kW
        "rated_speed": (1500, 3000),  # RPM
    },
    "Pump": {
        "manufacturer": ["Grundfos", "KSB", "Flowserve"],
        "rated_power": (30, 150),
        "rated_speed": (1000, 2000),
    },
    "Motor": {
        "manufacturer": ["ABB", "Siemens", "WEG"],
        "rated_power": (50, 500),
        "rated_speed": (1200, 1800),
    },
    "Fan": {
        "manufacturer": ["Howden", "Carrier", "Trane"],
        "rated_power": (15, 100),
        "rated_speed": (600, 1200),
    },
    "Conveyor": {
        "manufacturer": ["Dorner", "Hytrol", "Ultimation"],
        "rated_power": (10, 75),
        "rated_speed": (50, 200),
    },
}


# Sensor types and their characteristics
SENSOR_CONFIGS = [
    # Temperature sensors (16 sensors)
    *[
        {
            "type": "Temperature",
            "unit": "°C",
            "min": 20,
            "max": 80,
            "crit_min": 10,
            "crit_max": 100,
            "position": f"Position_{i}",
        }
        for i in range(16)
    ],
    # Vibration sensors (12 sensors)
    *[
        {
            "type": "Vibration",
            "unit": "Hz",
            "min": 0,
            "max": 50,
            "crit_min": 0,
            "crit_max": 100,
            "position": f"Axis_{i}",
        }
        for i in range(12)
    ],
    # Pressure sensors (8 sensors)
    *[
        {
            "type": "Pressure",
            "unit": "Bar",
            "min": 1,
            "max": 10,
            "crit_min": 0,
            "crit_max": 15,
            "position": f"Point_{i}",
        }
        for i in range(8)
    ],
    # Current sensors (6 sensors)
    *[
        {
            "type": "Current",
            "unit": "A",
            "min": 10,
            "max": 100,
            "crit_min": 0,
            "crit_max": 150,
            "position": f"Phase_{i}",
        }
        for i in range(6)
    ],
    # Voltage sensors (3 sensors)
    *[
        {
            "type": "Voltage",
            "unit": "V",
            "min": 200,
            "max": 240,
            "crit_min": 180,
            "crit_max": 260,
            "position": f"Phase_{i}",
        }
        for i in range(3)
    ],
    # Speed sensors (2 sensors)
    *[
        {
            "type": "Speed",
            "unit": "RPM",
            "min": 1000,
            "max": 3000,
            "crit_min": 0,
            "crit_max": 4000,
            "position": f"Shaft_{i}",
        }
        for i in range(2)
    ],
    # Humidity sensor (1 sensor)
    {
        "type": "Humidity",
        "unit": "%",
        "min": 30,
        "max": 70,
        "crit_min": 10,
        "crit_max": 90,
        "position": "Ambient",
    },
]


def create_database_connection(db_url: str = None):
    """Create database connection"""
    if db_url is None:
        db_name = os.getenv("POSTGRES_DB", "thingsboard")
        db_user = os.getenv("POSTGRES_USER", "postgres")
        db_password = os.getenv("POSTGRES_PASSWORD", "postgres")
        db_host = os.getenv("POSTGRES_HOST", "localhost")
        db_port = os.getenv("POSTGRES_PORT", "5432")
        db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    engine = create_engine(db_url, echo=False)
    Session = sessionmaker(bind=engine)
    return engine, Session


def create_tables(engine):
    """Create all tables"""
    print("Creating tables...")
    Base.metadata.create_all(engine)
    print("✓ Tables created")


def populate_machines(session, num_machines=NUM_MACHINES):
    """Populate machines table"""
    print(f"\nPopulating {num_machines} machines...")
    machines = []

    for i in range(num_machines):
        machine_type = random.choice(list(MACHINE_TYPES.keys()))
        type_config = MACHINE_TYPES[machine_type]

        machine = Machine(
            machine_id=f"MACHINE_{i+1:03d}",
            machine_name=f"{machine_type} Unit {i+1}",
            machine_type=machine_type,
            location=f"Building {chr(65 + i // 3)}, Floor {(i % 3) + 1}",
            installation_date=datetime.now()
            - timedelta(days=random.randint(365, 3650)),
            manufacturer=random.choice(type_config["manufacturer"]),
            model=f"Model-{random.randint(1000, 9999)}",
            rated_power=random.uniform(*type_config["rated_power"]),
            rated_speed=random.uniform(*type_config["rated_speed"]),
            is_active=True,
            metadata={
                "serial_number": f"SN{random.randint(100000, 999999)}",
                "warranty_until": (datetime.now() + timedelta(days=365)).isoformat(),
            },
        )
        machines.append(machine)
        session.add(machine)

    session.commit()
    print(f"✓ Created {len(machines)} machines")
    return machines


def populate_sensors(session, machines):
    """Populate sensors for each machine"""
    print(f"\nPopulating sensors ({SENSORS_PER_MACHINE} per machine)...")
    all_sensors = []

    for machine in machines:
        for i, sensor_config in enumerate(SENSOR_CONFIGS):
            sensor = Sensor(
                machine_id=machine.id,
                sensor_id=f"{machine.machine_id}_SENSOR_{i:02d}",
                sensor_name=f"{sensor_config['type']} Sensor {i:02d}",
                sensor_type=sensor_config["type"],
                sensor_position=sensor_config["position"],
                unit=sensor_config["unit"],
                min_value=sensor_config["min"],
                max_value=sensor_config["max"],
                critical_min=sensor_config["crit_min"],
                critical_max=sensor_config["crit_max"],
                is_active=True,
                metadata={"calibration_date": datetime.now().isoformat()},
            )
            all_sensors.append(sensor)
            session.add(sensor)

    session.commit()
    print(f"✓ Created {len(all_sensors)} sensors")
    return all_sensors


def generate_sensor_pattern(
    sensor_config, timestamp, machine_health=1.0, failure_approaching=False
):
    """
    Generate realistic sensor value with patterns

    Args:
        sensor_config: Sensor configuration dict
        timestamp: Current timestamp
        machine_health: 0-1, where 1 is healthy
        failure_approaching: Boolean indicating if failure is approaching
    """
    # Base value in normal range
    normal_range = sensor_config["max"] - sensor_config["min"]
    base_value = sensor_config["min"] + (normal_range * 0.5)  # Middle of range

    # Add time-based variations (daily cycle)
    hour_of_day = timestamp.hour
    daily_variation = np.sin(2 * np.pi * hour_of_day / 24) * (normal_range * 0.1)

    # Add random noise
    noise = np.random.normal(0, normal_range * 0.05)

    # Degradation based on machine health
    degradation = (1 - machine_health) * (normal_range * 0.3)

    # If failure approaching, add anomaly
    failure_spike = 0
    if failure_approaching:
        failure_spike = random.uniform(0, normal_range * 0.5)

    value = base_value + daily_variation + noise + degradation + failure_spike

    # Clip to critical range
    value = max(sensor_config["crit_min"], min(value, sensor_config["crit_max"]))

    return value


def populate_sensor_readings(session, machines, sensors, days=DAYS_OF_HISTORY):
    """Populate sensor readings with realistic patterns"""
    print(f"\nPopulating sensor readings for {days} days...")
    print("This may take a few minutes...")

    total_readings = 0
    batch_size = 1000
    readings_batch = []

    # Group sensors by machine
    machine_sensors = {}
    for sensor in sensors:
        if sensor.machine_id not in machine_sensors:
            machine_sensors[sensor.machine_id] = []
        machine_sensors[sensor.machine_id].append(sensor)

    start_time = datetime.now() - timedelta(days=days)
    total_hours = days * 24

    for hour_offset in range(0, total_hours):
        timestamp = start_time + timedelta(hours=hour_offset)

        # Generate readings for each sensor
        for machine_id, machine_sensors_list in machine_sensors.items():
            # Simulate machine health degradation over time
            machine_health = (
                1.0 - (hour_offset / total_hours) * 0.2
            )  # Slight degradation

            # Random chance of approaching failure
            failure_approaching = random.random() < 0.01  # 1% chance

            # Generate readings every 5 minutes (12 per hour)
            for minute_offset in range(0, 60, 5):
                reading_time = timestamp + timedelta(minutes=minute_offset)

                for sensor in machine_sensors_list:
                    # Get sensor config
                    sensor_idx = int(sensor.sensor_id.split("_")[-1])
                    sensor_config = SENSOR_CONFIGS[sensor_idx]

                    # Generate value
                    value = generate_sensor_pattern(
                        sensor_config, reading_time, machine_health, failure_approaching
                    )

                    # Check if anomaly
                    is_anomaly = (
                        value < sensor_config["min"] or value > sensor_config["max"]
                    )

                    reading = SensorReading(
                        sensor_id=sensor.id,
                        machine_id=machine_id,
                        timestamp=reading_time,
                        value=value,
                        quality_score=random.uniform(0.95, 1.0),
                        is_anomaly=is_anomaly,
                    )
                    readings_batch.append(reading)
                    total_readings += 1

                    # Batch insert for performance
                    if len(readings_batch) >= batch_size:
                        session.bulk_save_objects(readings_batch)
                        session.commit()
                        readings_batch = []

                        if total_readings % 10000 == 0:
                            print(f"  Inserted {total_readings:,} readings...")

    # Insert remaining readings
    if readings_batch:
        session.bulk_save_objects(readings_batch)
        session.commit()

    print(f"✓ Created {total_readings:,} sensor readings")


def populate_failures(session, machines):
    """Populate machine failures"""
    print(f"\nPopulating machine failures...")
    failures = []

    failure_types = [
        "Bearing Failure",
        "Motor Overheating",
        "Vibration Anomaly",
        "Pressure Drop",
        "Electrical Fault",
        "Mechanical Wear",
        "Seal Leakage",
        "Belt Slip",
    ]

    severities = ["Critical", "Major", "Minor"]

    for machine in machines:
        # Each machine has random number of failures
        num_failures = random.randint(
            0, int(DAYS_OF_HISTORY / 30)
        )  # Roughly 1 per month

        for _ in range(num_failures):
            failure_time = datetime.now() - timedelta(
                days=random.randint(0, DAYS_OF_HISTORY)
            )

            failure = MachineFailure(
                machine_id=machine.id,
                failure_time=failure_time,
                detection_time=failure_time + timedelta(hours=random.randint(1, 24)),
                resolved_time=failure_time + timedelta(days=random.randint(1, 7)),
                failure_type=random.choice(failure_types),
                failure_severity=random.choice(severities),
                failure_description=f"Equipment experienced {random.choice(failure_types).lower()}",
                root_cause=f"Wear and tear from extended operation",
                downtime_hours=random.uniform(2, 72),
                repair_cost=random.uniform(1000, 50000),
                was_predicted=random.random() < 0.3,  # 30% were predicted
                prediction_lead_time_hours=(
                    random.uniform(6, 72) if random.random() < 0.3 else None
                ),
                metadata={"operator_notes": "Handled during maintenance window"},
            )
            failures.append(failure)
            session.add(failure)

    session.commit()
    print(f"✓ Created {len(failures)} failure records")


def populate_maintenance_logs(session, machines):
    """Populate maintenance logs"""
    print(f"\nPopulating maintenance logs...")
    logs = []

    maintenance_types = ["Scheduled", "Unscheduled", "Predictive", "Emergency"]

    for machine in machines:
        # Each machine has regular maintenance
        num_maintenance = random.randint(3, 10)

        for _ in range(num_maintenance):
            maintenance_date = datetime.now() - timedelta(
                days=random.randint(0, DAYS_OF_HISTORY)
            )

            log = MaintenanceLog(
                machine_id=machine.id,
                maintenance_type=random.choice(maintenance_types),
                maintenance_date=maintenance_date,
                duration_hours=random.uniform(1, 8),
                cost=random.uniform(500, 10000),
                technician=f"Technician {random.randint(1, 10)}",
                description="Regular maintenance and inspection",
                next_maintenance_date=maintenance_date + timedelta(days=90),
                metadata={"work_order": f"WO-{random.randint(1000, 9999)}"},
            )
            logs.append(log)
            session.add(log)

    session.commit()
    print(f"✓ Created {len(logs)} maintenance logs")


def main():
    """Main execution"""
    print("=" * 70)
    print("Predictive Maintenance Database Population")
    print("=" * 70)

    # Create connection
    engine, Session = create_database_connection()
    session = Session()

    try:
        # Create tables
        create_tables(engine)

        # Populate data
        machines = populate_machines(session)
        sensors = populate_sensors(session, machines)
        populate_sensor_readings(session, machines, sensors)
        populate_failures(session, machines)
        populate_maintenance_logs(session, machines)

        # Summary
        print("\n" + "=" * 70)
        print("✓ Database population complete!")
        print("=" * 70)
        print(f"Machines: {len(machines)}")
        print(f"Sensors: {len(sensors)}")
        print(f"Days of history: {DAYS_OF_HISTORY}")
        print(f"Readings per hour: {READINGS_PER_HOUR}")
        print(
            f"Total estimated readings: {len(machines) * SENSORS_PER_MACHINE * DAYS_OF_HISTORY * 24 * READINGS_PER_HOUR:,}"
        )
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ Error: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
