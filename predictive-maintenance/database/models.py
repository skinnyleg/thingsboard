"""
SQLAlchemy ORM Models for Predictive Maintenance

These models map to the database schema and provide
an object-oriented interface for database operations.
"""

from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    Index,
    BigInteger,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

Base = declarative_base()


class Machine(Base):
    """Machine/Equipment being monitored"""

    __tablename__ = "machines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id = Column(String(255), unique=True, nullable=False, index=True)
    machine_name = Column(String(255), nullable=False)
    machine_type = Column(String(100), index=True)
    location = Column(String(255))
    installation_date = Column(DateTime)
    manufacturer = Column(String(255))
    model = Column(String(255))
    rated_power = Column(Float)
    rated_speed = Column(Float)
    is_active = Column(Boolean, default=True, index=True)
    metadata = Column(JSONB)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    sensors = relationship(
        "Sensor", back_populates="machine", cascade="all, delete-orphan"
    )
    sensor_readings = relationship("SensorReading", back_populates="machine")
    failures = relationship("MachineFailure", back_populates="machine")
    maintenance_logs = relationship("MaintenanceLog", back_populates="machine")
    predictions = relationship("Prediction", back_populates="machine")

    def __repr__(self):
        return f"<Machine(id={self.machine_id}, name={self.machine_name}, type={self.machine_type})>"


class Sensor(Base):
    """Sensor attached to a machine"""

    __tablename__ = "sensors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sensor_id = Column(String(255), unique=True, nullable=False, index=True)
    sensor_name = Column(String(255), nullable=False)
    sensor_type = Column(String(100), nullable=False)
    sensor_position = Column(String(100))
    unit = Column(String(50))
    min_value = Column(Float)
    max_value = Column(Float)
    critical_min = Column(Float)
    critical_max = Column(Float)
    is_active = Column(Boolean, default=True, index=True)
    metadata = Column(JSONB)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    machine = relationship("Machine", back_populates="sensors")
    readings = relationship("SensorReading", back_populates="sensor")
    statistics = relationship("SensorStatistic", back_populates="sensor")

    def __repr__(self):
        return f"<Sensor(id={self.sensor_id}, type={self.sensor_type}, machine={self.machine_id})>"


class SensorReading(Base):
    """Time-series sensor readings"""

    __tablename__ = "sensor_readings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    sensor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sensors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    machine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestamp = Column(DateTime, nullable=False, default=func.now(), index=True)
    value = Column(Float, nullable=False)
    quality_score = Column(Float, default=1.0)
    is_anomaly = Column(Boolean, default=False)
    metadata = Column(JSONB)

    # Relationships
    sensor = relationship("Sensor", back_populates="readings")
    machine = relationship("Machine", back_populates="sensor_readings")

    # Composite indexes
    __table_args__ = (
        Index("idx_sensor_readings_sensor_timestamp", "sensor_id", "timestamp"),
        Index("idx_sensor_readings_machine_timestamp", "machine_id", "timestamp"),
    )

    def __repr__(self):
        return f"<SensorReading(sensor={self.sensor_id}, time={self.timestamp}, value={self.value})>"


class MachineFailure(Base):
    """Machine failure events"""

    __tablename__ = "machine_failures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    failure_time = Column(DateTime, nullable=False, index=True)
    detection_time = Column(DateTime)
    resolved_time = Column(DateTime)
    failure_type = Column(String(255), nullable=False, index=True)
    failure_severity = Column(String(50))
    failure_description = Column(Text)
    root_cause = Column(Text)
    downtime_hours = Column(Float)
    repair_cost = Column(Float)
    replaced_parts = Column(JSONB)
    maintenance_actions = Column(JSONB)
    was_predicted = Column(Boolean, default=False)
    prediction_lead_time_hours = Column(Float)
    metadata = Column(JSONB)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    machine = relationship("Machine", back_populates="failures")

    def __repr__(self):
        return f"<MachineFailure(machine={self.machine_id}, type={self.failure_type}, time={self.failure_time})>"


class MaintenanceLog(Base):
    """Maintenance activity logs"""

    __tablename__ = "maintenance_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    maintenance_type = Column(String(100), nullable=False)
    maintenance_date = Column(DateTime, nullable=False, index=True)
    duration_hours = Column(Float)
    cost = Column(Float)
    technician = Column(String(255))
    description = Column(Text)
    parts_replaced = Column(JSONB)
    actions_performed = Column(JSONB)
    next_maintenance_date = Column(DateTime)
    metadata = Column(JSONB)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    machine = relationship("Machine", back_populates="maintenance_logs")

    def __repr__(self):
        return f"<MaintenanceLog(machine={self.machine_id}, type={self.maintenance_type}, date={self.maintenance_date})>"


class MLModel(Base):
    """ML Model metadata"""

    __tablename__ = "ml_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(String(255), unique=True, nullable=False, index=True)
    model_name = Column(String(255), nullable=False)
    model_type = Column(String(100), nullable=False)
    algorithm = Column(String(100))
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id"), index=True)
    training_start_time = Column(DateTime)
    training_end_time = Column(DateTime)
    training_data_start = Column(DateTime)
    training_data_end = Column(DateTime)
    training_samples = Column(Integer)
    model_metrics = Column(JSONB)
    model_path = Column(String(500))
    is_active = Column(Boolean, default=True, index=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    predictions = relationship("Prediction", back_populates="model")

    def __repr__(self):
        return f"<MLModel(id={self.model_id}, type={self.model_type}, algorithm={self.algorithm})>"


class Prediction(Base):
    """ML Model predictions"""

    __tablename__ = "predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ml_models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    machine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    prediction_time = Column(DateTime, nullable=False, default=func.now(), index=True)
    prediction_type = Column(String(100), nullable=False)
    prediction_horizon_hours = Column(Float)
    predicted_value = Column(Float)
    confidence_score = Column(Float)
    will_fail = Column(Boolean)
    failure_probability = Column(Float)
    predicted_failure_time = Column(DateTime)
    sensor_contributions = Column(JSONB)
    was_correct = Column(Boolean)
    actual_outcome = Column(Text)
    metadata = Column(JSONB)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    model = relationship("MLModel", back_populates="predictions")
    machine = relationship("Machine", back_populates="predictions")

    def __repr__(self):
        return f"<Prediction(model={self.model_id}, machine={self.machine_id}, type={self.prediction_type})>"


class SensorStatistic(Base):
    """Pre-computed sensor statistics"""

    __tablename__ = "sensor_statistics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id = Column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sensor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sensors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    time_window_start = Column(DateTime, nullable=False, index=True)
    time_window_end = Column(DateTime, nullable=False)
    sample_count = Column(Integer)
    mean_value = Column(Float)
    std_dev = Column(Float)
    min_value = Column(Float)
    max_value = Column(Float)
    median_value = Column(Float)
    q1_value = Column(Float)
    q3_value = Column(Float)
    anomaly_count = Column(Integer, default=0)
    computed_at = Column(DateTime, default=func.now())

    # Relationships
    sensor = relationship("Sensor", back_populates="statistics")

    __table_args__ = (
        Index(
            "idx_stats_sensor_time_window",
            "sensor_id",
            "time_window_start",
            unique=True,
        ),
    )

    def __repr__(self):
        return f"<SensorStatistic(sensor={self.sensor_id}, window={self.time_window_start})>"
