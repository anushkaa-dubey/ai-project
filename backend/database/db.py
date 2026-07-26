from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "feedback.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class FeedbackRecord(Base):
    __tablename__ = "feedback"
    id              = Column(Integer, primary_key=True, index=True)
    timestamp       = Column(DateTime, default=datetime.utcnow)
    grade           = Column(Integer)
    predicted_bw    = Column(Float)
    actual_bw       = Column(Float, nullable=True)
    recommendation  = Column(Text)
    action          = Column(String(10))   # "accept" | "reject"
    comment         = Column(Text, nullable=True)
    operator_id     = Column(String(50), default="OP-001")
    confidence      = Column(Float, nullable=True)
    status          = Column(String(20), nullable=True)


class PredictionLog(Base):
    __tablename__ = "prediction_log"
    id              = Column(Integer, primary_key=True, index=True)
    timestamp       = Column(DateTime, default=datetime.utcnow)
    grade           = Column(Integer)
    predicted_bw    = Column(Float)
    actual_bw       = Column(Float, nullable=True)
    confidence      = Column(Float)
    status          = Column(String(20))
    anomaly_prob    = Column(Float)
    machine_speed   = Column(Float)
    steam_pressure  = Column(Float)
    moisture        = Column(Float)


def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
