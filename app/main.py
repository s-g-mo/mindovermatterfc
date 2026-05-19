import json
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.data_utils import (
    load_game_stats,
    load_game_stats_table,
    load_media_videos,
    load_seasonal_stats,
    load_seasonal_stats_table,
    process_game_stats,
    process_recent_form,
    process_seasonal_stats,
    process_yearly_stats,
)

# Load .env for local development (no-op in production where env vars are set directly)
load_dotenv()

app = FastAPI()

app.mount(
    "/static",
    StaticFiles(directory="app/static"),
    name="static",
)
templates = Jinja2Templates(directory="app/templates")
templates.env.globals["current_year"] = datetime.now().year


@app.get("/")
async def read_index(request: Request):
    df_game = load_game_stats()
    df_seasonal = load_seasonal_stats()
    inline_data = json.dumps(
        {
            "seasonal": process_seasonal_stats(df_seasonal),
            "gameStats": process_game_stats(df_game),
            "yearlyStats": process_yearly_stats(df_seasonal),
            "recentForm": process_recent_form(df_game),
        }
    )
    recent_videos = load_media_videos()[:3]
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "page": "home",
            "recent_videos": recent_videos,
            "inline_data": inline_data,
        },
    )


@app.get("/about")
async def read_about(request: Request):
    return templates.TemplateResponse("about.html", {"request": request, "page": "about"})


@app.get("/raw-data")
async def read_raw_data(request: Request):
    game_data = load_game_stats_table()
    seasonal_data = load_seasonal_stats_table()
    return templates.TemplateResponse(
        "raw_data.html",
        {
            "request": request,
            "page": "raw-data",
            "game_stats_data": game_data,
            "seasonal_data": seasonal_data,
        },
    )


@app.get("/media")
async def read_media(request: Request):
    videos = load_media_videos()
    game_types = sorted({v["game_type"] for v in videos if v["game_type"]})
    years = sorted({v["year"] for v in videos if v["year"]}, reverse=True)
    return templates.TemplateResponse(
        "media.html",
        {
            "request": request,
            "page": "media",
            "videos": videos,
            "game_types": game_types,
            "years": years,
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


@app.get("/api/yearly-stats", response_class=JSONResponse)
async def yearly_stats():
    df_seasonal = load_seasonal_stats()
    return process_yearly_stats(df_seasonal)


@app.get("/api/recent-form", response_class=JSONResponse)
async def recent_form():
    df_game_stats = load_game_stats()
    return process_recent_form(df_game_stats)
