from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import engine, SessionLocal
from models import Base, Game, User
from pwdlib import PasswordHash
from datetime import datetime, timedelta, timezone
import jwt
import os
import requests
from dotenv import load_dotenv


load_dotenv()
password_hash = PasswordHash.recommended()
security = HTTPBearer()

RAWG_API_KEY = os.getenv("RAWG_API_KEY")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")


def create_token(user_id: int, token_type: str, expires_delta: timedelta):
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "exp": datetime.now(timezone.utc) + expires_delta
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm="HS256"
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=["HS256"]
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail="Access token required"
        )

    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    db: Session = SessionLocal()

    current_user = db.query(User).filter(
        User.id == int(user_id)
    ).first()

    db.close()

    if current_user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return current_user

app = FastAPI()

Base.metadata.create_all(bind=engine)


class GameCreate(BaseModel):
    title: str
    genre: str | None = None
    platform: str | None = None
    release_date: str | None = None
    rating: float | None = None
    image: str | None = None
    rawg_id: int | None = None
    favorite: bool = False
    status: str = "Backlog"
    notes: str | None = None

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str


@app.post("/api/auth/register")
def register_user(user: UserCreate):
    db: Session = SessionLocal()

    existing_user = db.query(User).filter(
        (User.username == user.username) |
        (User.email == user.email)
    ).first()

    if existing_user:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="Username or email already exists"
        )

    hashed_password = password_hash.hash(user.password)

    new_user = User(
        username=user.username,
        email=user.email,
        password_hash=hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    db.close()

    return {
        "message": "User registered successfully",
        "username": new_user.username,
        "email": new_user.email
    }


@app.post("/api/auth/login")
def login_user(user: UserLogin):
    db: Session = SessionLocal()

    existing_user = db.query(User).filter(
        User.username == user.username
    ).first()

    if existing_user is None:
        db.close()
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    password_is_valid = password_hash.verify(
        user.password,
        existing_user.password_hash
    )

    if not password_is_valid:
        db.close()
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    access_token = create_token(
        user_id=existing_user.id,
        token_type="access",
        expires_delta=timedelta(minutes=30)
    )

    refresh_token = create_token(
        user_id=existing_user.id,
        token_type="refresh",
        expires_delta=timedelta(days=7)
    )

    db.close()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }



app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
         "http://localhost:53351",
         "http://localhost:64495"

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
    "rawg_id": game["id"],
    "title": game["name"],
    "genre": ", ".join(
        genre["name"] for genre in game["genres"]
    ),
    "release_date": game["released"],
    "rating": game["rating"],
    "image": game["background_image"]
})

    return games



@app.post("/api/games")
def create_game(
    game: GameCreate,
    current_user: User = Depends(get_current_user)
):

    db: Session = SessionLocal()

    existing_game = None

    if game.rawg_id is not None:
        existing_game = db.query(Game).filter(Game.rawg_id == game.rawg_id).first()

    if existing_game:
        db.close()
        raise HTTPException(
            status_code=409,
            detail="Game already in library"
    )

    new_game = Game(
        title=game.title,
        genre=game.genre,
        platform=game.platform,
        release_date=game.release_date,
        rating=game.rating,
        image=game.image,
        rawg_id=game.rawg_id,
        favorite=game.favorite,
        status=game.status,
        notes=game.notes,
        user_id=current_user.id
        
    )

    db.add(new_game)
    db.commit()
    db.refresh(new_game)

    db.close()

    return new_game


@app.get("/api/games")
def get_games(current_user: User = Depends(get_current_user)):
    db: Session = SessionLocal()

    games = db.query(Game).filter(
        Game.user_id == current_user.id
    ).all()

    db.close()

    return games

@app.put("/api/games/{game_id}")
def update_game(
    game_id: int,
    game: GameCreate,
    current_user: User = Depends(get_current_user)
):

    db: Session = SessionLocal()

    existing_game = db.query(Game).filter(
    Game.id == game_id,
    Game.user_id == current_user.id
).first()

    if existing_game is None:
        db.close()
        return {"error": "Game not found"}

    existing_game.title = game.title
    existing_game.genre = game.genre
    existing_game.platform = game.platform
    existing_game.release_date = game.release_date
    existing_game.rating = game.rating
    existing_game.image = game.image
    existing_game.rawg_id = game.rawg_id
    existing_game.favorite = game.favorite
    existing_game.status = game.status
    existing_game.notes = game.notes
    

    db.commit()
    db.refresh(existing_game)

    db.close()

    return existing_game

@app.delete("/api/games/{game_id}")
def delete_game(
    game_id: int,
    current_user: User = Depends(get_current_user)
):

    db: Session = SessionLocal()

    existing_game = db.query(Game).filter(
    Game.id == game_id,
    Game.user_id == current_user.id
).first()

    if existing_game is None:
        db.close()
        return {"error": "Game not found"}

    db.delete(existing_game)
    db.commit()

    db.close()

    return {"message": "Game deleted successfully"}