import requests
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
import logging
import sys
from entities import entities

DB_NAME = "thingsboard"
DB_USER = "postgres"
DB_PASSWORD = "postgres"
DB_HOST = "thingsboard_db"
DB_PORT = "5432"

THINGSBOARD_WS_HOST_ADDR = "thingsboard"
THINGSBOARD_WS_PORT = 8080
THINGSBOARD_WS_URL = f"ws://{THINGSBOARD_WS_HOST_ADDR}:{THINGSBOARD_WS_PORT}/api/ws"

# Set up the database URL and connection
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Create the engine
engine = create_engine(DATABASE_URL, echo=True)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

logging.basicConfig()
logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

session = SessionLocal()
conn = session.connection().connection
cur = conn.cursor()




def main():
    try:
        pass
        # 1. parse the dataset
        # 2. sort by time and slide the window size to current time
        # 3. delete old devices of type anomaly-detector-device in database
        # 4. get the count of devices in dataset from the dataset
        # 5. create new devices with label anomaly-detector-device
        # 6. push ts data to devices
        # 7. push the failures dataset of these devices to database
    except Exception as e:
        print("Error:", e)
        sys.exit(1)

if __name__ == "__main__":
    main()