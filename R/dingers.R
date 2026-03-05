library(tidyverse)

# ----------------------------
# 1) Pull HR leaderboard from Baseball Savant
# ----------------------------
savant_hr_tracker_leaders <- function(season,
                                      cat = c("adj_xhr", "xhr"),
                                      player_type = "Batter",
                                      team = "",
                                      min = 0,
                                      sort = "hr_total",
                                      sortDir = "desc") {
  season <- as.integer(season)
  cat <- match.arg(cat)
  
  url <- paste0(
    "https://baseballsavant.mlb.com/leaderboard/home-runs?",
    "player_type=", player_type,
    "&team=", team,
    "&min=", min,
    "&cat=", cat,
    "&year=", season,
    "&sort=", sort,
    "&sortDir=", sortDir,
    "&csv=true"
  )
  
  df <- readr::read_csv(url, show_col_types = FALSE, progress = FALSE)
  
  # Identify columns (tolerant to small header changes)
  hr_col <- intersect(names(df), c("hr_total", "actual_hr", "HR", "Actual HR"))[1]
  player_col <- intersect(names(df), c("player", "Player", "player_name"))[1]
  
  if (is.na(hr_col)) stop("Could not find the 'Actual HR' column (expected hr_total).")
  if (is.na(player_col)) stop("Could not find the player name column.")
  if (!"player_id" %in% names(df)) stop("Could not find player_id column in Savant leaderboard.")
  
  # Normalize to consistent names
  df %>%
    rename(
      player = all_of(player_col),
      hr_total = all_of(hr_col)
    ) %>%
    mutate(
      player_id = as.integer(player_id),
      hr_total = suppressWarnings(as.integer(hr_total))
    )
}

# ----------------------------
# 2) Wrapper: returns standardized columns for joining
# ----------------------------
savant_hr <- function(season, cat = c("adj_xhr", "xhr"),
                      player_type = "Batter", team = "", min = 0,
                      sort = "hr_total", sortDir = "desc") {
  
  df <- savant_hr_tracker_leaders(
    season = season, cat = cat, player_type = player_type,
    team = team, min = min, sort = sort, sortDir = sortDir
  )
  
  df %>%
    select(player_id, player, hr_total, everything())
}

# ----------------------------
# 3) Team leaderboard
# ----------------------------
team_leaderboard <- function(rosters, hr_df) {
  rosters %>%
    mutate(player_id = as.integer(player_id)) %>%
    left_join(hr_df %>% select(player_id, hr_total), by = "player_id") %>%
    mutate(hr_total = replace_na(as.integer(hr_total), 0L)) %>%
    group_by(manager) %>%
    summarise(total_hr = sum(hr_total), .groups = "drop") %>%
    arrange(desc(total_hr), manager) %>%
    mutate(rank = row_number()) %>%
    select(rank, manager, total_hr)
}

# ----------------------------
# 4) Player leaderboard (top N)
# ----------------------------
player_leaderboard <- function(rosters, hr_df, top_n = 50) {
  rosters %>%
    mutate(player_id = as.integer(player_id)) %>%
    left_join(hr_df %>% select(player_id, player, hr_total),
              by = "player_id") %>%
    mutate(
      hr_total = replace_na(as.integer(hr_total), 0L),
      # roster has player_roster, hr_df has player
      player = coalesce(player, player_roster)
    ) %>%
    arrange(desc(hr_total), player) %>%
    mutate(rank = row_number()) %>%
    select(rank, player_id, player, manager, hr_total) %>%
    slice_head(n = top_n)
}

# ----------------------------
# 5) One-call updater for the site
# ----------------------------
update_dingers <- function(roster_csv, season, top_n = 50, cat = "xhr") {
  rosters <- readr::read_csv(roster_csv, show_col_types = FALSE) %>%
    mutate(player_id = as.integer(player_id))
  
  hr_df <- savant_hr(season, cat = cat)
  
  list(
    team = team_leaderboard(rosters, hr_df),
    players = player_leaderboard(rosters, hr_df, top_n = top_n)
  )
}

##############################
# Function to Update Website #
##############################
savant_hr_tracker_leaders <- function(season,
                                      cat = c("adj_xhr", "xhr"),
                                      player_type = "Batter",
                                      team = "",
                                      min = 0,
                                      sort = "hr_total",
                                      sortDir = "desc",
                                      cache_dir = "cache",
                                      max_age_hours = 6) {
  
  season <- as.integer(season)
  cat <- match.arg(cat)
  
  dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)
  
  cache_file <- file.path(
    cache_dir,
    paste0("savant_hr_", season, "_", cat, "_", player_type, ".csv")
  )
  
  is_fresh <- file.exists(cache_file) &&
    difftime(Sys.time(), file.info(cache_file)$mtime, units = "hours") < max_age_hours
  
  if (is_fresh) {
    df <- readr::read_csv(cache_file, show_col_types = FALSE, progress = FALSE)
  } else {
    url <- paste0(
      "https://baseballsavant.mlb.com/leaderboard/home-runs?",
      "player_type=", player_type,
      "&team=", team,
      "&min=", min,
      "&cat=", cat,
      "&year=", season,
      "&sort=", sort,
      "&sortDir=", sortDir,
      "&csv=true"
    )
    df <- readr::read_csv(url, show_col_types = FALSE, progress = FALSE)
    readr::write_csv(df, cache_file)
  }
  
  # column checks + normalization
  hr_col <- intersect(names(df), c("hr_total", "actual_hr", "HR", "Actual HR"))[1]
  player_col <- intersect(names(df), c("player", "Player", "player_name"))[1]
  if (is.na(hr_col)) stop("Could not find the 'Actual HR' column (expected hr_total).")
  if (is.na(player_col)) stop("Could not find the player name column.")
  if (!"player_id" %in% names(df)) stop("Could not find player_id column in Savant leaderboard.")
  
  df %>%
    rename(player = all_of(player_col), hr_total = all_of(hr_col)) %>%
    mutate(
      player_id = as.integer(player_id),
      hr_total  = suppressWarnings(as.integer(hr_total))
    )
}

#########################################
# Function to add links to player names #
#########################################
library(stringi)

player_slug <- function(name) {
  # Convert "Raleigh, Cal" -> "cal-raleigh"
  n <- trimws(name)
  if (grepl(",", n)) {
    parts <- trimws(unlist(strsplit(n, ",")))
    n <- paste(parts[2], parts[1])  # "Cal Raleigh"
  }
  # lower + replace non-alphanum with hyphens + trim hyphens
  slug <- tolower(n)
  slug <- gsub("[^a-z0-9]+", "-", slug)
  slug <- gsub("(^-|-$)", "", slug)
  slug
}

savant_player_url <- function(player_name, player_id) {
  paste0(
    "https://baseballsavant.mlb.com/savant-player/",
    player_slug(player_name), "-", player_id,
    "?stats=statcast-r-hitting-mlb"
  )
}





