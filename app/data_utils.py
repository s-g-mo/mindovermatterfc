import os

import pandas as pd


# ─────────────────────────────────────────────────────────────────────────────
# Supabase client (optional)
# Returns a Supabase client when SUPABASE_URL and SUPABASE_ANON_KEY are set,
# otherwise returns None and the app falls back to reading the local CSV files.
# ─────────────────────────────────────────────────────────────────────────────
def _get_supabase_client():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not (url and key):
        return None
    try:
        from supabase import create_client

        return create_client(url, key)
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Data loaders — Supabase when configured, CSV otherwise
# ─────────────────────────────────────────────────────────────────────────────
def load_game_stats(filepath="app/data/game_stats.csv"):
    client = _get_supabase_client()
    if client:
        result = client.table("game_stats").select("*").order("date").execute()
        df = pd.DataFrame(result.data)
        # Normalise column names to match the CSV convention used downstream
        df.columns = [c.replace(" ", "_").title() for c in df.columns]
        col_map = {
            "Date": "Date",
            "Season_Code": "Season_Code",
            "Season_Name": "Season_Name",
            "Year": "Year",
            "Organization": "Organization",
            "Game_Type": "Game_Type",
            "Outcome": "Outcome",
            "Goals": "Goals",
            "Goal_Body_Part": "Goal_Body_Part",
            "Assists": "Assists",
            "Notes": "Notes",
            "Youtube_Url": "Youtube_URL",
        }
        df.rename(columns=col_map, inplace=True)
        return df
    return pd.read_csv(filepath)


def load_seasonal_stats(filepath="app/data/seasonal_stats.csv"):
    client = _get_supabase_client()
    if client:
        result = (
            client.table("seasonal_stats").select("*").order("year").execute()
        )
        df = pd.DataFrame(result.data)
        col_map = {
            "season_code": "Season_Code",
            "season_name": "Season_Name",
            "year": "Year",
            "organization": "Organization",
            "game_type": "Game_Type",
            "games_played": "Games_Played",
            "goals": "Goals",
            "assists": "Assists",
            "notes": "Notes",
        }
        df.rename(columns=col_map, inplace=True)
        return df
    return pd.read_csv(filepath)


# ─────────────────────────────────────────────────────────────────────────────
# Processing — unchanged from original
# ─────────────────────────────────────────────────────────────────────────────
def process_game_stats(df_game_stats):
    dataframes = {
        "All": df_game_stats.copy(),
        "11v11": df_game_stats[df_game_stats["Game_Type"] == "11v11"].copy(),
        "7v7": df_game_stats[df_game_stats["Game_Type"] == "7v7"].copy(),
        "5v5": df_game_stats[df_game_stats["Game_Type"] == "5v5"].copy(),
    }

    for df in dataframes.values():
        df["Cumulative_Games"] = range(1, len(df) + 1)
        df["Cumulative_Goals"] = df["Goals"].cumsum()
        df["Goals_Per_Game"] = df["Cumulative_Goals"] / df["Cumulative_Games"]
        df["Cumulative_Wins"] = (df["Outcome"] == 1).cumsum()
        df["Win_Percentage"] = (df["Cumulative_Wins"] / df["Cumulative_Games"]) * 100

    return {
        key: df[["Date", "Game_Type", "Goals_Per_Game", "Win_Percentage"]].to_dict(
            orient="records"
        )
        for key, df in dataframes.items()
    }


def process_seasonal_stats(df_seasonal):
    df_seasonal = df_seasonal.assign(Game_Type=df_seasonal["Game_Type"].str.strip())

    game_data = (
        df_seasonal.groupby("Game_Type")
        .agg(
            games_played=("Games_Played", "sum"),
            goals=("Goals", "sum"),
            assists=("Assists", "sum"),
        )
        .reset_index()
    )

    game_data.loc[game_data["Game_Type"] == "11v11", "games_played"] += 5
    game_data.loc[game_data["Game_Type"] == "7v7", "games_played"] += 18
    game_data.loc[game_data["Game_Type"] == "11v11", "goals"] += 3
    game_data.loc[game_data["Game_Type"] == "7v7", "goals"] += 4
    game_data.loc[game_data["Game_Type"] == "11v11", "assists"] += 3
    game_data.loc[game_data["Game_Type"] == "7v7", "assists"] += 4
    game_data = game_data[game_data["Game_Type"] != "11v11/7v7"].copy()

    game_data = game_data.assign(
        goals_per_game=game_data["goals"] / game_data["games_played"],
        assists_per_game=game_data["assists"] / game_data["games_played"],
    )

    n_games_with_assists_tracked = df_seasonal[
        df_seasonal.Assists.notna()
    ].Games_Played.sum()

    all_row = pd.DataFrame(
        {
            "Game_Type": ["All"],
            "games_played": [game_data["games_played"].sum()],
            "goals": [game_data["goals"].sum()],
            "goals_per_game": [
                game_data["goals"].sum() / game_data["games_played"].sum()
            ],
            "assists": [game_data["assists"].sum()],
            "assists_per_game": [
                game_data["assists"].sum() / n_games_with_assists_tracked
            ],
        }
    )

    game_data = pd.concat([game_data, all_row], ignore_index=True)
    return game_data.rename(columns={"Game_Type": "game_type"}).to_dict(
        orient="records"
    )


def process_recent_form(df_game_stats, n=10):
    """Return the last n matches and their aggregate stats."""
    df = df_game_stats.sort_values("Date").tail(n).copy()

    matches = []
    for _, row in df.iterrows():
        outcome_val = int(row["Outcome"]) if pd.notna(row["Outcome"]) else None
        matches.append(
            {
                "date": str(row["Date"]),
                "game_type": row["Game_Type"],
                "outcome": outcome_val,
                "goals": int(row["Goals"]) if pd.notna(row["Goals"]) else 0,
                "assists": int(row["Assists"]) if pd.notna(row["Assists"]) else 0,
            }
        )

    # Most recent first so the leftmost square is the latest game
    matches = list(reversed(matches))

    total_goals = sum(m["goals"] for m in matches)
    total_assists = sum(m["assists"] for m in matches)
    wins = sum(1 for m in matches if m["outcome"] == 1)
    draws = sum(1 for m in matches if m["outcome"] == 0)
    losses = sum(1 for m in matches if m["outcome"] == -1)
    total = len(matches)

    return {
        "matches": matches,
        "stats": {
            "games": total,
            "wins": wins,
            "draws": draws,
            "losses": losses,
            "win_rate": round((wins / total) * 100, 1) if total else 0,
            "goals": total_goals,
            "assists": total_assists,
            "goals_per_game": round(total_goals / total, 2) if total else 0,
            "assists_per_game": round(total_assists / total, 2) if total else 0,
            "date_from": matches[-1]["date"] if matches else None,
            "date_to": matches[0]["date"] if matches else None,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Table display helpers — unchanged from original
# ─────────────────────────────────────────────────────────────────────────────
def rename_and_select(df, columns_mapping, display_cols):
    df.rename(columns=columns_mapping, inplace=True)
    return df[display_cols]


def format_game_stats_for_frontend_display(df):
    df = df.copy()
    # Add empty Video column when loading from CSV (Supabase provides youtube_url)
    if "Youtube_URL" not in df.columns:
        df["Youtube_URL"] = ""

    columns_mapping = {
        "Game_Type": "Game Type",
        "Games_Played": "Total Games Played",
        "Goal_Body_Part": "Goal Body Part",
        "Youtube_URL": "Video",
    }
    display_cols = [
        "Date",
        "Game Type",
        "Outcome",
        "Goals",
        "Goal Body Part",
        "Assists",
        "Notes",
        "Video",
    ]
    df = rename_and_select(df, columns_mapping, display_cols)
    return df.fillna("")


def process_yearly_stats(df_seasonal):
    """Aggregate seasonal_stats by year for the year-to-year dashboard."""
    df = df_seasonal.assign(Game_Type=df_seasonal["Game_Type"].str.strip())

    # "11v11/7v7" is an early mixed-type entry — include it in "All" totals
    # but exclude from individual game type breakdowns
    df_clean = df[df["Game_Type"] != "11v11/7v7"].copy()

    subsets = {
        "All": df_clean,
        "11v11": df_clean[df_clean["Game_Type"] == "11v11"],
        "7v7": df_clean[df_clean["Game_Type"] == "7v7"],
        "5v5": df_clean[df_clean["Game_Type"] == "5v5"],
    }

    results = {}
    for key, subset in subsets.items():
        if subset.empty:
            results[key] = []
            continue

        yearly = (
            subset.groupby("Year")
            .agg(games_played=("Games_Played", "sum"), goals=("Goals", "sum"))
            .reset_index()
            .assign(
                goals_per_game=lambda r: (r["goals"] / r["games_played"]).round(3),
                year=lambda r: r["Year"].astype(int),
            )
        )
        results[key] = yearly[["year", "games_played", "goals", "goals_per_game"]].to_dict(
            orient="records"
        )

    return results


def format_seasonal_stats_for_frontend_display(df):
    columns_mapping = {
        "Season_Name": "Season",
        "Game_Type": "Game Type",
        "Games_Played": "Total Games Played",
    }
    display_cols = [
        "Year",
        "Season",
        "Game Type",
        "Total Games Played",
        "Goals",
        "Assists",
        "Notes",
    ]
    df = rename_and_select(df, columns_mapping, display_cols)

    numeric_cols = ["Total Games Played", "Goals", "Assists"]
    df.loc[:, numeric_cols].map(lambda x: int(x) if pd.notnull(x) else "")

    return df.fillna("")


def load_game_stats_table():
    df_game_stats = load_game_stats()
    df_game_stats = format_game_stats_for_frontend_display(df_game_stats)
    return df_game_stats.to_dict(orient="records")


def load_seasonal_stats_table():
    df_seasonal_stats = load_seasonal_stats()
    df_seasonal_stats = format_seasonal_stats_for_frontend_display(df_seasonal_stats)
    return df_seasonal_stats.to_dict(orient="records")
