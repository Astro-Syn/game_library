from sqlalchemy import Column, Integer, Boolean, String, Float, ForeignKey
from database import engine
from sqlalchemy.orm import declarative_base


Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, unique=True)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    genre = Column(String)
    platform = Column(String)
    release_date = Column(String)
    rating = Column(Float)
    image = Column(String)
    rawg_id = Column(Integer)
    favorite = Column(Boolean, default=False)
    status = Column(String, default="Backlog")
    notes = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)