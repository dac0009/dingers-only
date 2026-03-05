library(tidyverse)
library(stringr)
library(lubridate)
library(gt)
library(httr2)
library(jsonlite)

fake_rosters <- read.csv("rosters_test.csv")
print(fake_rosters)

savant_hr <- function(season, cat = c("adj_xhr", "xhr"),
                      player_type = "Batter", team = "", min = 0,
                      sort = "hr_total", sortDir = "desc") {
  
  df <- savant_hr_tracker_leaders(
    season = season, cat = cat, player_type = player_type,
    team = team, min = min, sort = sort, sortDir = sortDir
  )
  
  # Normalize columns for downstream joins
  # (Your output already has hr_total and player_id, but this guards changes.)
  df <- df %>%
    rename_with(~"player_id", any_of(c("player_id", "mlbam_id"))) %>%
    rename_with(~"player",    any_of(c("player", "Player", "player_name")))
  
  # Ensure hr_total exists and numeric
  if (!"hr_total" %in% names(df)) {
    hr_col <- intersect(names(df), c("actual_hr", "HR", "Actual HR"))[1]
    if (is.na(hr_col)) stop("Could not find HR column.")
    df <- df %>% rename(hr_total = all_of(hr_col))
  }
  
  df %>%
    mutate(
      player_id = as.integer(player_id),
      hr_total  = suppressWarnings(as.integer(hr_total))
    )
}

team_leaderboard <- function(rosters, hr_df) {
  rosters %>%
    mutate(player_id = as.integer(player_id)) %>%
    left_join(hr_df %>% select(player_id, hr_total), by = "player_id") %>%
    mutate(hr_total = replace_na(hr_total, 0L)) %>%
    group_by(manager) %>%
    summarise(total_hr = sum(hr_total), .groups = "drop") %>%
    arrange(desc(total_hr), manager) %>%
    mutate(rank = row_number()) %>%
    select(rank, manager, total_hr)
}


player_leaderboard <- function(rosters, hr_df, top_n = 50) {
  rosters %>%
    mutate(player_id = as.integer(player_id)) %>%
    left_join(hr_df %>% select(player_id, player, hr_total),
              by = "player_id") %>%
    mutate(
      hr_total = replace_na(as.integer(hr_total), 0L),
      player = coalesce(player, player_roster)
    ) %>%
    arrange(desc(hr_total), player) %>%
    mutate(rank = row_number()) %>%
    select(rank, player, manager, hr_total) %>%
    slice_head(n = top_n)
}

hr_2025 <- savant_hr(2025, cat = "adj_xhr")

team_lb   <- team_leaderboard(fake_rosters, hr_2025)
player_lb <- player_leaderboard(fake_rosters, hr_2025, top_n = 50)

team_lb
player_lb

###########
# Automatically update the website with this function?
update_dingers <- function(fake_rosters, season, top_n = 50, cat = "xhr") {
  rosters <- readr::read_csv(fake_rosters, show_col_types = FALSE) %>%
    mutate(player_id = as.integer(player_id))
  
  hr_df <- savant_hr_tracker_leaders(season, cat = cat) %>%
    mutate(player_id = as.integer(player_id),
           hr_total   = as.integer(hr_total))
  
  team_lb <- rosters %>%
    left_join(hr_df %>% select(player_id, hr_total), by = "player_id") %>%
    mutate(hr_total = replace_na(hr_total, 0L)) %>%
    group_by(manager) %>%
    summarise(total_hr = sum(hr_total), .groups = "drop") %>%
    arrange(desc(total_hr), manager) %>%
    mutate(rank = row_number()) %>%
    select(rank, manager, total_hr)
  
  player_lb <- rosters %>%
    left_join(hr_df %>% select(player_id, player, hr_total), by = "player_id") %>%
    mutate(
      hr_total = replace_na(hr_total, 0L),
      player   = coalesce(player, player_roster)
    ) %>%
    arrange(desc(hr_total), player) %>%
    mutate(rank = row_number()) %>%
    select(rank, player, manager, hr_total) %>%
    slice_head(n = top_n)
  list(team = team_lb, players = player_lb)
}

lbs <- update_dingers("rosters_test.csv", season = 2025, top_n = 50, cat = "xhr")
lbs$team
lbs$players

validate_rosters <- function(rosters) {
  stopifnot(all(c("manager","player_id","player_roster") %in% names(rosters)))
  
  if (any(is.na(rosters$player_id))) stop("Roster has missing player_id values.")
  if (any(duplicated(rosters$player_id))) {
    dups <- rosters %>% count(player_id) %>% filter(n > 1)
    stop("Duplicate player_id(s) in roster: ", paste(dups$player_id, collapse = ", "))
  }
  invisible(TRUE)
}


