import argparse
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

parser = argparse.ArgumentParser(
    description="Train a Forecasting Model for Predictive Maintenance"
)
parser.add_argument(
    "--data-path",
    type=str,
    required=False,
    default=Path(__file__).parent,
)
parser.add_argument(
    "forecast_id",
    type=str,
    help="The ID of the forecast to train",
)
parser.add_argument(
    "db_url",
    type=str,
    help="The URL of the database to use",
)
parser.add_argument(
    "--forecast-table",
    type=str,
    default="forecast",
    required=False,
    help="The name of the table to store the forecast",
)

args = parser.parse_args()
FORECAST_ID = args.forecast_id
DATA_PATH = str(Path(args.data_path))
DB_URL = args.db_url
FORECAST_TABLE = args.forecast_table

engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

with SessionLocal() as session:
    result = session.execute(
        text(
            f"SELECT * FROM {FORECAST_TABLE} WHERE id = '{FORECAST_ID}'",
        ),
    )
    path = Path(DATA_PATH + "/data")
    os.makedirs(path, exist_ok=True)
    with open(f"{path}/{FORECAST_ID}.csv", "w") as f:
        f.write(', '.join(result.keys()) + '\n')
        forecast = result.fetchone()
        f.write(', '.join(map(str, forecast)) + '\n')
