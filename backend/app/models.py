from sqlalchemy import Column, Integer, String, Float, BigInteger
from sqlalchemy import DateTime
from .database import Base


class Earthquake(Base):
    __tablename__ = "earthquakes"

    id = Column(Integer, primary_key=True, index=True)
    usgs_id = Column(String, unique=True, index=True, nullable=False)
    magnitude = Column(Float)
    place = Column(String)
    longitude = Column(Float)
    latitude = Column(Float)
    depth = Column(Float)
    time = Column(DateTime(timezone=True))