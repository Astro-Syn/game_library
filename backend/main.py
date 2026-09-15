from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import engine, SessionLocal
from models import Base, Game


app = FastAPI()

Base.metadata.create_all(bind=engine)


class GameCreate(BaseModel):
    title: str
    genre: str | None = None
    platform: str | None = None


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/hello")
def hello():
    return {"message": "Hello from Python!"}


@app.post("/api/games")
def create_game(game: GameCreate):

    db: Session = SessionLocal()

    new_game = Game(
        title=game.title,
        genre=game.genre,
        platform=game.platform
    )

    db.add(new_game)
    db.commit()
    db.refresh(new_game)

    db.close()

    return new_game