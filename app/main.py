from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request
from app.data_utils import (
    load_game_stats,
    load_seasonal_stats,
    process_game_stats,
    process_seasonal_stats,
    load_game_stats_table,
    load_seasonal_stats_table,
)

app = FastAPI()

app.mount(
    "/static",
    StaticFiles(directory="app/static"),
    name="static",
)
templates = Jinja2Templates(directory="app/templates")


@app.get("/")
async def read_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/about")
async def read_about(request: Request):
    return templates.TemplateResponse("about.html", {"request": request})


@app.get("/raw-data")
async def read_raw_data(request: Request):
    game_data = load_game_stats_table()
    seasonal_data = load_seasonal_stats_table()
    return templates.TemplateResponse(
        "raw_data.html",
        {
            "request": request,
            "game_stats_data": game_data,
            "seasonal_data": seasonal_data,
        },
    )


@app.get("/api/game-stats", response_class=JSONResponse)
async def game_stats():
    df_game_stats = load_game_stats()
    return process_game_stats(df_game_stats)


@app.get("/api/data", response_class=JSONResponse)
async def data():
    df_seasonal = load_seasonal_stats()
    return process_seasonal_stats(df_seasonal)
