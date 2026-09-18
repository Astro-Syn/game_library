from sqlalchemy import Column, Integer, String
from database import engine
from sqlalchemy.orm import declarative_base


Base = declarative_base()


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    genre = Column(String)
    platform = Column(String)
    release_date = Column(String)