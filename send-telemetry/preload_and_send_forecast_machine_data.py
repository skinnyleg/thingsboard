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

# f = open("./machine_uuid.txt", "r")

# machine_access_token = f.read().strip()

phones_f = open("./send_to_phones.txt", "r")
phones = phones_f.read().strip()

entities = {
    "jxl8ni3f0em9zpmuq0oq": "03a88ca0-b63e-11ef-a198-07d41c920fc8",
    "8PyIT47tVem2abB0zi5e": "120e1d10-469d-11f0-b3d7-d5827fb4609f",
}

# print("machine_access_token=", machine_access_token)
print("send_to_phones=", phones)
logging.basicConfig()
logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

session = SessionLocal()
conn = session.connection().connection
cur = conn.cursor()

try:
    # result = session.execute(text("DELETE FROM alarm"))
    result = session.execute(text("DELETE FROM notification"))
    result = session.execute(
        text(
            "DELETE FROM public.ts_kv"
        ),
    )
    result = session.execute(
        text(
            "DELETE FROM public.ts_kv_latest"
        ),
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


    for token in entities.keys():
        print("token ", token)
        if (
            os.system(
                f"bash ./preload_forecast_machine_csv.sh {entities[token]} {token} {pressure} {datetime} {forecast}"
            )
            != 0
        ):
            sys.exit("script has failed")
        with open(f"datetime_{token}.csv") as file:
            cur.copy_expert(
                "COPY ts_kv(ts,str_v,entity_id,key) FROM STDIN WITH (FORMAT csv, DELIMITER ',', HEADER)",
                file,
            )
            cur.connection.commit()
        with open(f"./pressure_{token}.csv") as file:
            cur.copy_expert(
                "COPY ts_kv(ts,dbl_v,entity_id,key) FROM STDIN WITH (FORMAT csv, DELIMITER ',', HEADER)",
                file,
            )
            cur.connection.commit()
        with open(f"./forecast_{token}.csv") as file:
            cur.copy_expert(
                "COPY ts_kv(ts,dbl_v,entity_id,key) FROM STDIN WITH (FORMAT csv, DELIMITER ',', HEADER)",
                file,
            )
            cur.connection.commit()
        session.commit()
        os.system(f"bash ./test_device_5_3.sh {token} &")
except Exception as e:
    print(e)
