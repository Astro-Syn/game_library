from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine

app = FastAPI()

try:
    with engine.connect() as connection:
        print("Database connection successful!")
except Exception as error:
    print("Database connection failed:", error)


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