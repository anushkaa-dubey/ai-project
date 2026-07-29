from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
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
