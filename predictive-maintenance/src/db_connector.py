from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

DB_NAME = os.getenv("POSTGRES_DB", "thingsboard")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
DB_HOST = os.getenv("POSTGRES_HOST", "database")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")

# Set up the database URL and connection
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Create the engine
engine = create_engine(DATABASE_URL)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
