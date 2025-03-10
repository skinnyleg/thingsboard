from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
import logging
import sys

DB_NAME = "thingsboard"
DB_USER = "postgres"
DB_PASSWORD = "postgres"
DB_HOST = "thingsboard_db"
DB_PORT = "5432"

# Set up the database URL and connection
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Create the engine
engine = create_engine(DATABASE_URL, echo=True)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

f = open("./machine_uuid.txt", "r")

machine_access_token = f.read().strip()

print("machine_access_token=", machine_access_token)
logging.basicConfig()
logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

session = SessionLocal()
conn = session.connection().connection
cur = conn.cursor()

try:
    device = session.execute(
        text(
            "SELECT device_id FROM public.device_credentials\
            WHERE credentials_id = :machine_access_token"
        ),
        {"machine_access_token": machine_access_token},
    )
    session.commit()
    entity_id = str(device.scalars().all()[0])
    result = session.execute(
        text(
            "DELETE FROM public.ts_kv\
                USING public.device_credentials, public.device\
                WHERE ts_kv.entity_id = device.id\
                AND device.id = device_credentials.device_id\
                AND device_credentials.credentials_id = :machine_access_token",
        ),
        {"machine_access_token": machine_access_token},
    )
    result = session.execute(
        text(
            "DELETE FROM public.ts_kv_latest\
                USING public.device_credentials, public.device\
                WHERE ts_kv_latest.entity_id = device.id\
                AND device.id = device_credentials.device_id\
                AND device_credentials.credentials_id = :machine_access_token"
        ),
        {"machine_access_token": machine_access_token},
    )
    result = session.execute(
        text(
            "INSERT INTO key_dictionary (key)\
                VALUES ('pressure'), ('datetime'), ('forecast')\
                ON CONFLICT (key) DO NOTHING"
        )
    )
    result = session.execute(
        text(
            "SELECT KEY_ID FROM KEY_DICTIONARY WHERE KEY IN ('pressure', 'datetime', 'forecast')"
        )
    )
    session.commit()
    pressure, datetime, forecast = result.scalars().all()
    if (
        os.system(
            f"bash ./preload_forecast_machine_csv.sh {entity_id} {pressure} {datetime} {forecast}"
        )
        != 0
    ):
        sys.exit("script has failed")
    with open("datetime.csv") as file:
        cur.copy_expert(
            "COPY ts_kv(ts,str_v,entity_id,key) FROM STDIN WITH (FORMAT csv, DELIMITER ',', HEADER)",
            file,
        )
        cur.connection.commit()
    with open("./pressure.csv") as file:
        cur.copy_expert(
            "COPY ts_kv(ts,dbl_v,entity_id,key) FROM STDIN WITH (FORMAT csv, DELIMITER ',', HEADER)",
            file,
        )
        cur.connection.commit()
    with open("./forecast.csv") as file:
        cur.copy_expert(
            "COPY ts_kv(ts,dbl_v,entity_id,key) FROM STDIN WITH (FORMAT csv, DELIMITER ',', HEADER)",
            file,
        )
        cur.connection.commit()
    session.commit()
    os.system("bash ./test_device_5_3.sh")
except Exception as e:
    print(e)
