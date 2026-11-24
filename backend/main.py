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
import random
import re
from urllib.parse import quote_plus
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


class ChangePassword(BaseModel):
    current_password: str
    new_password: str

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

    if not user.username.strip() or not user.password:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="Username and password are required"
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


@app.post("/api/auth/refresh")
def refresh_access_token(refresh_token: str):
    try:
        payload = jwt.decode(
            refresh_token,
            JWT_SECRET_KEY,
            algorithms=["HS256"]
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token"
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=401,
            detail="Refresh token required"
        )

    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid refresh token"
        )

    db: Session = SessionLocal()

    user = db.query(User).filter(
        User.id == int(user_id)
    ).first()

    db.close()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    access_token = create_token(
        user_id=user.id,
        token_type="access",
        expires_delta=timedelta(minutes=30)
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }



@app.post("/api/auth/change-password")
def change_password(
    passwords: ChangePassword,
    current_user: User = Depends(get_current_user)
):
    db: Session = SessionLocal()

    try:
        # Load the user into this database session
        user = db.query(User).filter(
            User.id == current_user.id
        ).first()

        if user is None:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        # Check the current password
        if not password_hash.verify(
            passwords.current_password,
            user.password_hash
        ):
            raise HTTPException(
                status_code=400,
                detail="Current password is incorrect"
            )

        # Hash and save the new password
        user.password_hash = password_hash.hash(
            passwords.new_password
        )

        db.commit()

        return {
            "message": "Password changed successfully"
        }

    finally:
        db.close()



@app.get("/api/auth/me")
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email
    }


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
         "http://localhost:53351",
         "http://localhost:64495",
         "http://localhost:51987",
         "http://localhost:56410"

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

    if not RAWG_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="RAWG API key is missing"
        )

    try:
        response = requests.get(
            "https://api.rawg.io/api/games",
            params={
                "key": RAWG_API_KEY,
                "search": query
            },
            timeout=15
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException:
        raise HTTPException(
            status_code=502,
            detail="Unable to search games on RAWG"
        )

    games = []

    for game in data.get("results", []):
        games.append({
            "rawg_id": game["id"],
            "title": game["name"],
            "genre": ", ".join(
                genre["name"] for genre in game.get("genres") or []
            ),
            "release_date": game.get("released"),
            "rating": game.get("rating"),
            "image": game.get("background_image")
        })

    return games


@app.get("/api/games/random")
def get_random_games():

    if not RAWG_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="RAWG API key is missing"
        )

    try:
        response = requests.get(
            "https://api.rawg.io/api/games",
            params={
                "key": RAWG_API_KEY,
                "page_size": 40
            },
            timeout=15
        )

        response.raise_for_status()

        data = response.json()

        games = []

        for game in data.get("results", []):
            games.append({
                "rawg_id": game["id"],
                "title": game["name"],
                "genre": ", ".join(
                    genre["name"]
                    for genre in game.get("genres", [])
                ),
                "release_date": game.get("released"),
                "rating": game.get("rating"),
                "image": game.get("background_image")
            })

        random.shuffle(games)

        return games[:15]

    except requests.RequestException:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve games from RAWG"
        )



@app.post("/api/games")
def create_game(
    game: GameCreate,
    current_user: User = Depends(get_current_user)
):

    if not game.title.strip():
        raise HTTPException(
            status_code=400,
            detail="Game title is required"
        )

    db: Session = SessionLocal()

    existing_game = None

    if game.rawg_id is not None:
        existing_game = db.query(Game).filter(
            Game.rawg_id == game.rawg_id,
            Game.user_id == current_user.id
        ).first()

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
        raise HTTPException(
            status_code=404,
            detail="Game not found"
        )

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
        raise HTTPException(
            status_code=404,
            detail="Game not found"
        )

    db.delete(existing_game)
    db.commit()

    db.close()

    return {"message": "Game deleted successfully"}


# =========================
# WHERE TO BUY
# =========================

# RAWG store ids -> display names
RAWG_STORES = {
    1: "Steam",
    2: "Xbox Store",
    3: "PlayStation Store",
    4: "App Store",
    5: "GOG",
    6: "Nintendo eShop",
    7: "Xbox 360 Store",
    8: "Google Play",
    9: "itch.io",
    11: "Epic Games Store",
}

# Store links that don't work reliably for users
HIDDEN_RAWG_STORES = {3}

# CheapShark asks clients to identify themselves
CHEAPSHARK_HEADERS = {"User-Agent": "GameLibrary/1.0 (personal project)"}


def normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]", "", title.lower())


def retailer_links(title: str):
    q = quote_plus(title)
    q_game = quote_plus(f"{title} video game")

    online = [
        {"name": "Walmart", "url": f"https://www.walmart.com/search?q={q_game}"},
        {"name": "GameStop", "url": f"https://www.gamestop.com/search/?q={q}"},
        {"name": "Best Buy", "url": f"https://www.bestbuy.com/site/searchpage.jsp?st={q}"},
        {"name": "Target", "url": f"https://www.target.com/s?searchTerm={q_game}"},
    ]

    nearby = [
        {"name": "Game stores near me", "url": "https://www.google.com/maps/search/video+game+store+near+me"},
        {"name": "Walmart near me", "url": "https://www.google.com/maps/search/Walmart+near+me"},
        {"name": "GameStop near me", "url": "https://www.google.com/maps/search/GameStop+near+me"},
        {"name": "Best Buy near me", "url": "https://www.google.com/maps/search/Best+Buy+near+me"},
    ]

    return online, nearby


def digital_stores(rawg_id: int | None):
    if not rawg_id or not RAWG_API_KEY:
        return []

    try:
        response = requests.get(
            f"https://api.rawg.io/api/games/{rawg_id}/stores",
            params={"key": RAWG_API_KEY},
            timeout=10
        )
        response.raise_for_status()
        results = response.json().get("results", [])
    except (requests.RequestException, ValueError):
        return []

    stores = []
    for store in results:
        url = store.get("url")
        # PlayStation links from RAWG point at retired store pages
        if not url or store.get("store_id") in HIDDEN_RAWG_STORES:
            continue
        stores.append({
            "name": RAWG_STORES.get(store.get("store_id"), "Store"),
            "url": url
        })

    return stores


_cheapshark_store_names: dict[str, str] = {}


def cheapshark_store_names() -> dict[str, str]:
    """CheapShark store id -> name, fetched once and kept in memory."""
    if _cheapshark_store_names:
        return _cheapshark_store_names

    try:
        response = requests.get(
            "https://www.cheapshark.com/api/1.0/stores",
            headers=CHEAPSHARK_HEADERS,
            timeout=10
        )
        response.raise_for_status()
        for store in response.json():
            _cheapshark_store_names[str(store["storeID"])] = store["storeName"]
    except (requests.RequestException, ValueError, KeyError):
        pass

    return _cheapshark_store_names


def lowest_pc_price(title: str, digital: list[dict]):
    """
    Cheapest current PC price, with a link straight to the store selling it.

    CheapShark's own redirect links sit behind a bot check that never
    finishes in a normal browser, so they are never handed to the user.
    """
    try:
        response = requests.get(
            "https://www.cheapshark.com/api/1.0/games",
            params={"title": title, "limit": 10},
            headers=CHEAPSHARK_HEADERS,
            timeout=10
        )
        response.raise_for_status()
        results = response.json()
    except (requests.RequestException, ValueError):
        return None

    wanted = normalize_title(title)

    # Only trust an exact title match; CheapShark's search is fuzzy
    match = next(
        (g for g in results if normalize_title(g.get("external", "")) == wanted),
        None
    )

    if match is None:
        return None

    try:
        response = requests.get(
            "https://www.cheapshark.com/api/1.0/games",
            params={"id": match["gameID"]},
            headers=CHEAPSHARK_HEADERS,
            timeout=10
        )
        response.raise_for_status()
        details = response.json()
    except (requests.RequestException, ValueError, KeyError):
        return None

    deals = details.get("deals") or []
    if not deals:
        return None

    best = min(deals, key=lambda d: float(d.get("price", "inf")))
    store_name = cheapshark_store_names().get(str(best.get("storeID")), "")

    # Find a direct link to that store: Steam from its app id,
    # anything else from RAWG's official store links.
    url = None
    steam_app_id = match.get("steamAppID") or details.get("info", {}).get("steamAppID")

    if store_name == "Steam" and steam_app_id:
        url = f"https://store.steampowered.com/app/{steam_app_id}/"
    else:
        wanted_store = normalize_title(store_name)
        for store in digital:
            name = normalize_title(store["name"])
            if wanted_store and (wanted_store in name or name in wanted_store):
                url = store["url"]
                break

    return {
        "price": best.get("price"),
        "store": store_name or None,
        "url": url
    }


# Public, like search: guests use it too, and it only returns links
@app.get("/api/games/where-to-buy")
def where_to_buy(
    title: str,
    rawg_id: int | None = None
):
    title = title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Game title is required"
        )

    online, nearby = retailer_links(title)
    digital = digital_stores(rawg_id)

    return {
        "title": title,
        "digital": digital,
        "online": online,
        "nearby": nearby,
        "best_pc_deal": lowest_pc_price(title, digital)
    }
