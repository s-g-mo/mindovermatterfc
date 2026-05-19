"""
Sync Supabase from the local CSV files.

Run this whenever you've added new games to the CSVs (e.g. after each week).

Usage (from repo root, with your base virtualenv active):
    python scripts/seed_supabase.py

Requires a .env file at the repo root:
    SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
    SUPABASE_ANON_KEY=eyJhbGc...
    SUPABASE_SERVICE_KEY=eyJhbGc...   ← needed to bypass RLS for writes

How it works:
    - Clears the seasonal_stats table and re-inserts from CSV (safe to re-run)
    - Clears the game_stats table and re-inserts from CSV. The CSV is the single
      source of truth for all data including youtube_url.
"""

import os
import sys

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not (url and key):
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    sys.exit(1)

client = create_client(url, key)

# ─────────────────────────────────────────────────────────────────────────────
# seasonal_stats — full replace (no extra data stored here, safe to wipe)
# ─────────────────────────────────────────────────────────────────────────────
print("Syncing seasonal_stats...")
client.table("seasonal_stats").delete().neq("id", 0).execute()

df_seasonal = pd.read_csv("app/data/seasonal_stats.csv")

seasonal_rows = []
for _, row in df_seasonal.iterrows():
    seasonal_rows.append(
        {
            "season_code": row["Season_Code"] if pd.notna(row.get("Season_Code")) else None,
            "season_name": row["Season_Name"] if pd.notna(row.get("Season_Name")) else None,
            "year": int(row["Year"]) if pd.notna(row.get("Year")) else None,
            "organization": row["Organization"] if pd.notna(row.get("Organization")) else None,
            "game_type": row["Game_Type"],
            "games_played": int(row["Games_Played"]),
            "goals": int(row["Goals"]),
            "assists": float(row["Assists"]) if pd.notna(row.get("Assists")) else None,
            "notes": row["Notes"] if pd.notna(row.get("Notes")) else None,
        }
    )

client.table("seasonal_stats").insert(seasonal_rows).execute()
print(f"  {len(seasonal_rows)} rows written.")

# ─────────────────────────────────────────────────────────────────────────────
# game_stats — full replace from CSV (CSV is the source of truth for all fields)
# ─────────────────────────────────────────────────────────────────────────────
print("Syncing game_stats...")

client.table("game_stats").delete().neq("id", 0).execute()

df_games = pd.read_csv("app/data/game_stats.csv")

game_rows = []
for _, row in df_games.iterrows():
    date_str = str(row["Date"])
    game_type = row["Game_Type"]
    youtube_url = row.get("Youtube_URL") if pd.notna(row.get("Youtube_URL")) else None

    game_rows.append(
        {
            "date": date_str,
            "season_code": row["Season_Code"] if pd.notna(row.get("Season_Code")) else None,
            "season_name": row["Season_Name"] if pd.notna(row.get("Season_Name")) else None,
            "year": int(row["Year"]) if pd.notna(row.get("Year")) else None,
            "organization": row["Organization"] if pd.notna(row.get("Organization")) else None,
            "game_type": game_type,
            "outcome": int(row["Outcome"]) if pd.notna(row.get("Outcome")) else None,
            "goals": int(row["Goals"]) if pd.notna(row.get("Goals")) else 0,
            "goal_body_part": row["Goal_Body_Part"] if pd.notna(row.get("Goal_Body_Part")) else None,
            "assists": int(row["Assists"]) if pd.notna(row.get("Assists")) else None,
            "notes": row["Notes"] if pd.notna(row.get("Notes")) else None,
            "youtube_url": youtube_url,
        }
    )

client.table("game_stats").insert(game_rows).execute()
print(f"  {len(game_rows)} rows written.")

print("\nDone! Supabase is now in sync with your CSVs.")
