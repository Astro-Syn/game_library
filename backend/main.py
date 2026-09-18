from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import engine, SessionLocal
from models import Base, Game

import os
import requests
from dotenv import load_dotenv

load_dotenv()

RAWG_API_KEY = os.getenv("RAWG_API_KEY")


app = FastAPI()

Base.metadata.create_all(bind=engine)


class GameCreate(BaseModel):
    title: str
    genre: str | None = None
    platform: str | None = None


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
         "http://localhost:53351"

        ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/hello")
def hello():
    return {"message": "Hello from Python!"}




@app.get("/api/games/search")
def search_games(query: str):

    url = "https://api.rawg.io/api/games"

    params = {
        "key": RAWG_API_KEY,
        "search": query
    }

    response = requests.get(url, params=params)

    data = response.json()

    games = []

    for game in data["results"]:
        games.append({
            "id": game["id"],
            "title": game["name"],
            "release_date": game["released"],
            "rating": game["rating"],
            "image": game["background_image"]
        })

    return games



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


@app.get("/api/games")
def get_games():

    db: Session = SessionLocal()

    games = db.query(Game).all()

    db.close()

    return games

@app.put("/api/games/{game_id}")
def update_game(game_id: int, game: GameCreate):

    db: Session = SessionLocal()

    existing_game = db.query(Game).filter(Game.id == game_id).first()

    if existing_game is None:
        db.close()
        return {"error": "Game not found"}

    existing_game.title = game.title
    existing_game.genre = game.genre
    existing_game.platform = game.platform

    db.commit()
    db.refresh(existing_game)

    db.close()

    return existing_game

@app.delete("/api/games/{game_id}")
def delete_game(game_id: int):

    db: Session = SessionLocal()

    existing_game = db.query(Game).filter(Game.id == game_id).first()

    if existing_game is None:
        db.close()
        return {"error": "Game not found"}

    db.delete(existing_game)
    db.commit()

    db.close()

    return {"message": "Game deleted successfully"}