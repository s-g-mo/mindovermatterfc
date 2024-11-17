import pandas as pd


def load_game_stats(filepath="app/data/game_stats.csv"):
    return pd.read_csv(filepath)


def load_seasonal_stats(filepath="app/data/seasonal_stats.csv"):
    return pd.read_csv(filepath)


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
        key: df[["Date", "Game_Type", "Goals_Per_Game", "Win_Percentage"]].to_dict(orient="records")
        for key, df in dataframes.items()
    }


def process_seasonal_stats(df_seasonal):
    df_seasonal["Game_Type"] = df_seasonal["Game_Type"].str.strip()

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
    game_data = game_data[game_data["Game_Type"] != "11v11/7v7"]

    game_data["goals_per_game"] = game_data["goals"] / game_data["games_played"]
    game_data["assists_per_game"] = game_data["assists"] / game_data["games_played"]

    n_games_with_assists_tracked = df_seasonal[df_seasonal.Assists.notna()].Games_Played.sum()

    all_row = pd.DataFrame(
        {
            "Game_Type": ["All"],
            "games_played": [game_data["games_played"].sum()],
            "goals": [game_data["goals"].sum()],
            "goals_per_game": [game_data["goals"].sum() / game_data["games_played"].sum()],
            "assists": [game_data["assists"].sum()],
            "assists_per_game": [game_data["assists"].sum() / n_games_with_assists_tracked],
        }
    )

    game_data = pd.concat([game_data, all_row], ignore_index=True)
    return game_data.rename(columns={"Game_Type": "game_type"}).to_dict(orient="records")


def rename_and_select(df, columns_mapping, display_cols):
    df.rename(columns=columns_mapping, inplace=True)
    return df[display_cols]


def format_game_stats_for_frontend_display(df):
    columns_mapping = {
        "Game_Type": "Game Type",
        "Games_Played": "Total Games Played",
        "Goal_Body_Part": "Goal Body Part",
    }
    display_cols = [
        "Date",
        "Game Type",
        "Outcome",
        "Goals",
        "Goal Body Part",
        "Assists",
        "Notes",
    ]
    df = rename_and_select(df, columns_mapping, display_cols)
    return df.fillna("")


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
