library(tidyverse)
library(stringr)
library(lubridate)
library(purrr)
library(tibble)
library(readr)
library(baseballr)

# -------------------------
# 1) Player -> MLBAM id
# -------------------------
get_mlbam_id <- function(player) {
  parts <- str_split(str_trim(player), "\\s+")[[1]]
  first <- parts[1]
  last  <- paste(parts[-1], collapse = " ")
  
  out <- playerid_lookup(last_name = last, first_name = first)
  
  if (nrow(out) == 0) stop("Could not find MLBAM id for: ", player)
  
  out %>%
    filter(!is.na(mlbam_id)) %>%
    slice(1) %>%
    pull(mlbam_id)
}

# -------------------------
# 2) Date range per season
# -------------------------
season_date_range <- function(season) {
  list(
    start_date = sprintf("%d-03-01", season),
    end_date   = sprintf("%d-11-30", season)
  )
}

# -------------------------
# 3) Helpers
# -------------------------
safe_mean <- function(x) if (all(is.na(x))) NA_real_ else mean(x, na.rm = TRUE)
safe_pct  <- function(x) if (length(x) == 0) NA_real_ else mean(x, na.rm = TRUE) * 100

is_batted_ball <- function(events) {
  events %in% c(
    "single","double","triple","home_run",
    "field_out","force_out","grounded_into_double_play","double_play","triple_play",
    "field_error","fielders_choice","fielders_choice_out",
    "sac_fly","sac_bunt","sac_fly_double_play",
    "other_out"
  )
}
is_k  <- function(events) events %in% c("strikeout", "strikeout_double_play")
is_bb <- function(events) events %in% c("walk", "intent_walk")

is_barrel_approx <- function(ev, la) {
  ifelse(
    is.na(ev) | is.na(la),
    NA,
    (
      (ev >= 98  & la >= 26 & la <= 30) |
        (ev >= 99  & la >= 25 & la <= 31) |
        (ev >= 100 & la >= 24 & la <= 33) |
        (ev >= 101 & la >= 23 & la <= 34) |
        (ev >= 102 & la >= 22 & la <= 35) |
        (ev >= 103 & la >= 21 & la <= 36) |
        (ev >= 104 & la >= 20 & la <= 37) |
        (ev >= 105 & la >= 19 & la <= 38) |
        (ev >= 106 & la >= 18 & la <= 39) |
        (ev >= 107 & la >= 17 & la <= 40) |
        (ev >= 108 & la >= 16 & la <= 41) |
        (ev >= 109 & la >= 15 & la <= 42) |
        (ev >= 110 & la >= 14 & la <= 43)
    )
  )
}

# -------------------------
# 4) Build Statcast CSV URL (stable interface)
# -------------------------
make_statcast_csv_url <- function(player_id, start_date, end_date, player_type = c("batter","pitcher")) {
  player_type <- match.arg(player_type)
  
  # - mirrors what Savant uses. The important parts:
  # - player_type=batter/pitcher
  # - batters_lookup[]=ID or pitchers_lookup[]=ID
  # - game_date_gt / game_date_lt
  # - type=details
  base <- "https://baseballsavant.mlb.com/statcast_search/csv"
  
  # start from a minimal query set (Savant accepts lots of empty filters)
  qs <- list(
    all = "true",
    hfGT = "R|PO|S|",
    hfSea = paste0(year(ymd(start_date)), "|"),
    player_type = player_type,
    game_date_gt = start_date,
    game_date_lt = end_date,
    min_pitches = "0",
    min_results = "0",
    group_by = "name",
    sort_col = "pitches",
    sort_order = "desc",
    min_abs = "0",
    type = "details"
  )
  
  # add the correct lookup param
  if (player_type == "batter") {
    qs[["batters_lookup[]"]] <- as.character(player_id)
  } else {
    qs[["pitchers_lookup[]"]] <- as.character(player_id)
  }
  
  # build query string safely
  query <- paste(
    map_chr(names(qs), \(k) paste0(URLencode(k, reserved = TRUE), "=", URLencode(qs[[k]], reserved = TRUE))),
    collapse = "&"
  )
  
  paste0(base, "?", query)
}

# -------------------------
# 5) Download CSV robustly (no schema assumptions)
# -------------------------
statcast_download_csv <- function(url) {
  # readr will keep whatever columns Savant returns
  readr::read_csv(url, show_col_types = FALSE, progress = FALSE)
}

# -------------------------
# 6) Season table from Statcast pitch-by-pitch
# -------------------------
get_player_statcast_season_table <- function(player,
                                             seasons = 2015:year(Sys.Date()),
                                             type = c("hitting","pitching"),
                                             postseason = TRUE) {
  type <- match.arg(type)
  player_id <- get_mlbam_id(player)
  
  player_type <- ifelse(type == "hitting", "batter", "pitcher")
  
  out <- map_dfr(seasons, function(season) {
    rng <- season_date_range(season)
    
    url <- make_statcast_csv_url(
      player_id = player_id,
      start_date = rng$start_date,
      end_date = rng$end_date,
      player_type = player_type
    )
    
    dat <- tryCatch(
      statcast_download_csv(url),
      error = function(e) {
        message("Season ", season, ": download failed (", conditionMessage(e), ")")
        return(tibble())
      }
    )
    
    if (nrow(dat) == 0) return(tibble())
    
    # optional postseason drop (only works if game_date exists)
    if (!postseason && "game_date" %in% names(dat)) {
      dat <- dat %>% mutate(game_date = as.Date(game_date)) %>% filter(month(game_date) <= 9)
    }
    
    # Each row is a pitch in the "details" export
    pitches_n <- nrow(dat)
    
    # events exists only on PA-ending pitch; some exports name it "events"
    if (!("events" %in% names(dat))) {
      message("Season ", season, ": no 'events' column found in CSV; check export columns.")
      return(tibble())
    }
    
    pa  <- dat %>% filter(!is.na(events))
    bbe <- pa %>% filter(is_batted_ball(events))
    
    # columns are usually launch_speed/launch_angle; if missing, metrics become NA
    has_ev <- "launch_speed" %in% names(bbe)
    has_la <- "launch_angle" %in% names(bbe)
    
    avg_ev <- if (has_ev) safe_mean(bbe$launch_speed) else NA_real_
    avg_la <- if (has_la) safe_mean(bbe$launch_angle) else NA_real_
    
    sweet_spot_pct <- if (has_la) safe_pct(bbe$launch_angle >= 8 & bbe$launch_angle <= 32) else NA_real_
    hard_hit_pct   <- if (has_ev) safe_pct(bbe$launch_speed >= 95) else NA_real_
    
    barrel_flag <- if (has_ev && has_la) is_barrel_approx(bbe$launch_speed, bbe$launch_angle) else rep(NA, nrow(bbe))
    barrels_n   <- sum(barrel_flag %in% TRUE, na.rm = TRUE)
    barrel_pct  <- safe_pct(barrel_flag)
    
    pa_n  <- nrow(pa)
    k_pct <- if (pa_n == 0) NA_real_ else mean(is_k(pa$events)) * 100
    bb_pct <- if (pa_n == 0) NA_real_ else mean(is_bb(pa$events)) * 100
    
    # expected stats columns vary; handle gracefully
    pick_col <- function(df, candidates) {
      nm <- intersect(candidates, names(df))
      if (length(nm) == 0) return(rep(NA_real_, nrow(df)))
      df[[nm[1]]]
    }
    
    xba   <- pick_col(bbe, c("estimated_ba_using_speedangle", "estimated_ba_using_speedangle"))
    xslg  <- pick_col(bbe, c("estimated_slg_using_speedangle", "estimated_slg_using_speedangle"))
    xwoba <- pick_col(bbe, c("estimated_woba_using_speedangle", "estimated_woba_using_speedangle"))
    
    tibble(
      Season = season,
      Player = player,
      Pitches = pitches_n,
      Batted_Balls = nrow(bbe),
      Barrels = barrels_n,
      Barrel_Pct = barrel_pct,
      Avg_EV = avg_ev,
      Avg_LA = avg_la,
      Sweet_Spot_Pct = sweet_spot_pct,
      xBA = safe_mean(xba),
      xSLG = safe_mean(xslg),
      xwOBA = safe_mean(xwoba),
      xwOBAcon = safe_mean(xwoba),
      Hard_Hit_Pct = hard_hit_pct,
      K_Pct = k_pct,
      BB_Pct = bb_pct
    )
  })
  
  # Always return a tibble with expected columns even if empty
  if (nrow(out) == 0) {
    return(tibble(
      Season = integer(), Player = character(), Pitches = integer(), Batted_Balls = integer(),
      Barrels = integer(), Barrel_Pct = double(), Avg_EV = double(), Avg_LA = double(),
      Sweet_Spot_Pct = double(), xBA = double(), xSLG = double(), xwOBA = double(),
      xwOBAcon = double(), Hard_Hit_Pct = double(), K_Pct = double(), BB_Pct = double()
    ))
  }
  
  out %>% arrange(desc(Season))
}

# -------------------------
# 7) Run it
# -------------------------
get_player_statcast_season_table(
  player = "Bryce Harper",
  seasons = 2023:2025,
  type = "hitting",
  postseason = TRUE
)

get_player_statcast_season_table(
  player = "Paul Skenes",
  seasons = 2024:2025,
  type = "pitching",
  postseason = TRUE
)

############################################################
#                Run Value by Pitch Type                  #
############################################################


# ---------- utilities ----------
get_mlbam_id <- function(player) {
  parts <- str_split(str_trim(player), "\\s+")[[1]]
  first <- parts[1]
  last  <- paste(parts[-1], collapse = " ")
  
  out <- playerid_lookup(last_name = last, first_name = first)
  if (nrow(out) == 0) stop("Could not find MLBAM id for: ", player)
  
  out %>%
    filter(!is.na(mlbam_id)) %>%
    slice(1) %>%
    pull(mlbam_id)
}

season_date_range <- function(season) {
  list(
    start_date = sprintf("%d-03-01", season),
    end_date   = sprintf("%d-11-30", season)
  )
}

make_statcast_csv_url <- function(player_id, start_date, end_date, player_type = c("batter", "pitcher")) {
  player_type <- match.arg(player_type)
  base <- "https://baseballsavant.mlb.com/statcast_search/csv"
  
  qs <- list(
    all = "true",
    hfGT = "R|PO|S|",
    hfSea = paste0(year(ymd(start_date)), "|"),
    player_type = player_type,
    game_date_gt = start_date,
    game_date_lt = end_date,
    min_pitches = "0",
    min_results = "0",
    group_by = "name",
    sort_col = "pitches",
    sort_order = "desc",
    min_abs = "0",
    type = "details"
  )
  
  if (player_type == "batter") {
    qs[["batters_lookup[]"]] <- as.character(player_id)
  } else {
    qs[["pitchers_lookup[]"]] <- as.character(player_id)
  }
  
  query <- paste(
    map_chr(names(qs), \(k) paste0(URLencode(k, reserved = TRUE), "=", URLencode(qs[[k]], reserved = TRUE))),
    collapse = "&"
  )
  
  paste0(base, "?", query)
}

statcast_download_csv <- function(url) {
  readr::read_csv(url, show_col_types = FALSE, progress = FALSE)
}

# swing/whiff flags from Statcast "description"
add_pitch_flags <- function(dat) {
  dat %>%
    mutate(
      is_swing = description %in% c(
        "swinging_strike", "swinging_strike_blocked",
        "foul", "foul_tip", "foul_bunt",
        "hit_into_play", "hit_into_play_no_out", "hit_into_play_score"
      ),
      is_whiff = description %in% c("swinging_strike", "swinging_strike_blocked")
    )
}

is_hit_event <- function(e) e %in% c("single", "double", "triple", "home_run")
is_ab_event <- function(e) e %in% c(
  "single","double","triple","home_run",
  "field_out","force_out","grounded_into_double_play","double_play","triple_play",
  "fielders_choice_out","other_out",
  "strikeout","strikeout_double_play"
)
is_k_event <- function(e) e %in% c("strikeout", "strikeout_double_play")

# pitch code -> full name
pitch_name_lookup <- c(
  FF = "Four-Seam Fastball",
  SI = "Sinker",
  FC = "Cutter",
  SL = "Slider",
  ST = "Sweeper",
  CH = "Changeup",
  CU = "Curveball",
  KC = "Knuckle Curve",
  FS = "Splitter",
  FO = "Forkball",
  KN = "Knuckleball",
  EP = "Eephus"
)

# ---------- main function ----------
# perspective:
#   "hitter"  -> run value is from batter perspective (positive = good for hitter)
#   "pitcher" -> run value is from pitcher perspective (positive = good for pitcher)
rv_by_pitch_type_all_seasons <- function(player,
                                         role = c("hitter", "pitcher"),
                                         start_season = 2015,
                                         end_season = lubridate::year(Sys.Date()),
                                         cache_dir = "statcast_cache") {
  role <- match.arg(role)
  dir.create(cache_dir, showWarnings = FALSE)
  
  player_id <- get_mlbam_id(player)
  seasons <- start_season:end_season
  
  player_type <- ifelse(role == "hitter", "batter", "pitcher")
  label_col <- ifelse(role == "hitter", "Batter", "Pitcher")
  
  # Pull all seasons
  dat_all <- map_dfr(seasons, function(season) {
    rng <- season_date_range(season)
    url <- make_statcast_csv_url(player_id, rng$start_date, rng$end_date, player_type = player_type)
    
    cache_file <- file.path(cache_dir, paste0(player_type, "_", player_id, "_", season, ".csv"))
    
    dat <- tryCatch(
      {
        if (file.exists(cache_file)) {
          readr::read_csv(cache_file, show_col_types = FALSE, progress = FALSE)
        } else {
          x <- statcast_download_csv(url)
          readr::write_csv(x, cache_file)
          x
        }
      },
      error = function(e) tibble()
    )
    
    if (nrow(dat) == 0) return(tibble())
    
    dat %>%
      mutate(
        Season = season,
        Player = player,
        Role = label_col
      )
  })
  
  # empty safe return
  if (nrow(dat_all) == 0) {
    return(tibble(
      Season = integer(), Player = character(), Role = character(), pitch_type = character(),
      RV_100 = double(), Run_Value = double(), Pitches = integer(), pitch_pct = double(),
      PA = integer(), BA = double(), SLG = double(), wOBA = double(),
      Whiff_pct = double(), Putaway_pct = double(),
      xBA = double(), xSLG = double(), xwOBA = double()
    ))
  }
  
  dat_all <- add_pitch_flags(dat_all) %>%
    filter(!is.na(pitch_type))
  
  # ---------- Run Value ----------
  # Savant delta_run_exp is from the batting team's perspective.
  # If we are evaluating a PITCHER, we flip the sign so:
  #   positive RV_100 = good for pitcher (suppresses runs)
  has_rv <- "delta_run_exp" %in% names(dat_all)
  
  dat_all <- dat_all %>%
    mutate(rv = if (has_rv) delta_run_exp else NA_real_) %>%
    mutate(rv = if (role == "pitcher") -rv else rv)
  
  # ---------- Pitch-level summary ----------
  pitch_level <- dat_all %>%
    group_by(Season, Player, Role, pitch_type) %>%
    summarise(
      Pitches = n(),
      Run_Value = if (has_rv) sum(rv, na.rm = TRUE) else NA_real_,
      RV_100 = if (has_rv) 100 * Run_Value / Pitches else NA_real_,
      swings = sum(is_swing, na.rm = TRUE),
      whiffs = sum(is_whiff, na.rm = TRUE),
      Whiff_pct = ifelse(swings == 0, NA_real_, whiffs / swings),
      .groups = "drop"
    ) %>%
    group_by(Season, Player, Role) %>%
    mutate(pitch_pct = Pitches / sum(Pitches)) %>%
    ungroup()
  
  # ---------- PA-level summary (final pitch of PA) ----------
  if (!("events" %in% names(dat_all))) {
    stop("No 'events' column found in the CSV. Savant export changed or returned a different schema.")
  }
  
  pa_end <- dat_all %>% filter(!is.na(events))
  has_woba <- "woba_value" %in% names(pa_end)
  
  pa_level <- pa_end %>%
    group_by(Season, Player, Role, pitch_type) %>%
    summarise(
      PA = n(),
      AB = sum(is_ab_event(events), na.rm = TRUE),
      H  = sum(is_hit_event(events), na.rm = TRUE),
      TB = sum(events == "single", na.rm = TRUE) +
        2 * sum(events == "double", na.rm = TRUE) +
        3 * sum(events == "triple", na.rm = TRUE) +
        4 * sum(events == "home_run", na.rm = TRUE),
      BA  = ifelse(AB == 0, NA_real_, H / AB),
      SLG = ifelse(AB == 0, NA_real_, TB / AB),
      wOBA = if (has_woba) mean(woba_value, na.rm = TRUE) else NA_real_,
      K_pct = mean(is_k_event(events), na.rm = TRUE),
      .groups = "drop"
    )
  
  # Putaway%: among pitches of this type thrown with 2 strikes, percent ending PA in K
  putaway <- tibble(Season = integer(), Player = character(), Role = character(),
                    pitch_type = character(), Putaway_pct = double())
  
  if ("strikes" %in% names(dat_all)) {
    putaway <- dat_all %>%
      filter(strikes == 2, !is.na(events)) %>%
      group_by(Season, Player, Role, pitch_type) %>%
      summarise(
        Putaway_pct = mean(is_k_event(events), na.rm = TRUE),
        .groups = "drop"
      )
  }
  
  # ---------- Expected stats ----------
  has_xba  <- "estimated_ba_using_speedangle" %in% names(dat_all)
  has_xslg <- "estimated_slg_using_speedangle" %in% names(dat_all)
  has_xw   <- "estimated_woba_using_speedangle" %in% names(dat_all)
  
  exp_level <- dat_all %>%
    group_by(Season, Player, Role, pitch_type) %>%
    summarise(
      xBA   = if (has_xba)  mean(estimated_ba_using_speedangle, na.rm = TRUE)  else NA_real_,
      xSLG  = if (has_xslg) mean(estimated_slg_using_speedangle, na.rm = TRUE) else NA_real_,
      xwOBA = if (has_xw)   mean(estimated_woba_using_speedangle, na.rm = TRUE) else NA_real_,
      .groups = "drop"
    )
  
  # ---------- Combine + rename pitch types ----------
  out <- pitch_level %>%
    left_join(pa_level, by = c("Season","Player","Role","pitch_type")) %>%
    left_join(putaway, by = c("Season","Player","Role","pitch_type")) %>%
    left_join(exp_level, by = c("Season","Player","Role","pitch_type")) %>%
    mutate(
      pitch_type = ifelse(
        pitch_type %in% names(pitch_name_lookup),
        unname(pitch_name_lookup[pitch_type]),
        pitch_type
      )
    ) %>%
    select(
      Season, Player, Role, pitch_type,
      RV_100, Run_Value, Pitches, pitch_pct,
      PA, BA, SLG, wOBA, K_pct,
      Whiff_pct, Putaway_pct,
      xBA, xSLG, xwOBA
    ) %>%
    arrange(desc(Season), desc(RV_100))
  
  out
}

# -------------------------
# Examples
# -------------------------
# Hitter perspective (positive RV_100 = good for hitter)
rv_by_pitch_type_all_seasons("Bryce Harper", role = "hitter")

# Pitcher perspective (positive RV_100 = good for pitcher; sign flipped)
rv_by_pitch_type_all_seasons("Paul Skenes", role = "pitcher")

##############################################################################
#                       Hitter Spray Chart                                   #
##############################################################################

# --- helper: name -> MLBAM id ---
get_mlbam_id <- function(player) {
  parts <- str_split(str_trim(player), "\\s+")[[1]]
  first <- parts[1]
  last  <- paste(parts[-1], collapse = " ")
  
  out <- baseballr::playerid_lookup(last_name = last, first_name = first)
  if (nrow(out) == 0) stop("Could not find MLBAM id for: ", player)
  
  out %>%
    filter(!is.na(mlbam_id)) %>%
    slice(1) %>%
    pull(mlbam_id)
}

# --- helper: build Savant CSV url for one hitter + date range ---
make_statcast_csv_url <- function(player_id, start_date, end_date) {
  base <- "https://baseballsavant.mlb.com/statcast_search/csv"
  
  qs <- list(
    all = "true",
    hfGT = "R|PO|S|",
    hfSea = paste0(year(ymd(start_date)), "|"),
    player_type = "batter",
    game_date_gt = start_date,
    game_date_lt = end_date,
    min_pitches = "0",
    min_results = "0",
    group_by = "name",
    sort_col = "pitches",
    sort_order = "desc",
    min_abs = "0",
    type = "details",
    `batters_lookup[]` = as.character(player_id)
  )
  
  query <- paste(
    purrr::map_chr(names(qs), \(k) paste0(URLencode(k, reserved = TRUE), "=", URLencode(qs[[k]], reserved = TRUE))),
    collapse = "&"
  )
  
  paste0(base, "?", query)
}

# ------------------------------------------------------------
# MAIN: Spray chart points for a hitter + season (user-defined)
# ------------------------------------------------------------
get_savant_spray_points <- function(hitter,
                                    season,
                                    start_date = NULL,
                                    end_date = NULL,
                                    cache_dir = "statcast_cache",
                                    use_cache = TRUE) {
  if (missing(hitter) || is.null(hitter) || hitter == "") stop("Provide `hitter`, e.g., 'Bryce Harper'")
  if (missing(season) || is.null(season)) stop("Provide `season`, e.g., 2025")
  
  season <- as.integer(season)
  
  # default date range if not provided
  if (is.null(start_date)) start_date <- sprintf("%d-03-01", season)
  if (is.null(end_date))   end_date   <- sprintf("%d-11-30", season)
  
  dir.create(cache_dir, showWarnings = FALSE)
  
  player_id <- get_mlbam_id(hitter)
  url <- make_statcast_csv_url(player_id, start_date, end_date)
  
  cache_file <- file.path(cache_dir, paste0("spray_", player_id, "_", season, ".csv"))
  
  dat <- if (use_cache && file.exists(cache_file)) {
    readr::read_csv(cache_file, show_col_types = FALSE, progress = FALSE)
  } else {
    x <- readr::read_csv(url, show_col_types = FALSE, progress = FALSE)
    if (use_cache) readr::write_csv(x, cache_file)
    x
  }
  
  # Keep batted balls with spray coordinates
  # hc_x / hc_y = Savant spray chart coordinates
  dat %>%
    mutate(Season = season, Hitter = hitter) %>%
    filter(!is.na(events), !is.na(hc_x), !is.na(hc_y)) %>%
    select(
      Season, Hitter, game_date, events,
      hc_x, hc_y,
      hit_distance_sc, launch_speed, launch_angle,
      stand, p_throws, pitch_type
    )
}

# -------------------------
# Example usage
# -------------------------
harper_spray_2025 <- get_savant_spray_points("Bryce Harper", season = 2025)
harper_spray_2025

harper_spray_2025 %>%
  mutate(
    result = case_when(
      events %in% c("home_run") ~ "HR",
      events %in% c("triple") ~ "3B",
      events %in% c("double") ~ "2B",
      events %in% c("single") ~ "1B",
      TRUE ~ "Out/Other"
    )
  ) %>%
  ggplot(aes(hc_x, hc_y, shape = result)) +
  geom_point(alpha = 0.7, size = 2) +
  coord_equal() +
  labs(
    title = "Bryce Harper spray chart (2025) by outcome",
    x = "hc_x",
    y = "hc_y"
  )

#######
###############################################
# Statcast Strike-Zone Plot (ALL PITCHES)
# Any hitter + any season you define
# Pulls Baseball Savant CSV (no API key)
###############################################

library(dplyr)
library(stringr)
library(lubridate)
library(purrr)
library(tibble)
library(readr)
library(baseballr)
library(ggplot2)

# -------------------------
# 1) Player name -> MLBAM id
# -------------------------
get_mlbam_id <- function(player) {
  parts <- str_split(str_trim(player), "\\s+")[[1]]
  first <- parts[1]
  last  <- paste(parts[-1], collapse = " ")
  
  out <- baseballr::playerid_lookup(last_name = last, first_name = first)
  if (nrow(out) == 0) stop("Could not find MLBAM id for: ", player)
  
  out %>%
    filter(!is.na(mlbam_id)) %>%
    slice(1) %>%
    pull(mlbam_id)
}

# -------------------------
# 2) Build Savant Statcast CSV URL for hitter + date range
# -------------------------
make_statcast_csv_url_hitter <- function(player_id, start_date, end_date) {
  base <- "https://baseballsavant.mlb.com/statcast_search/csv"
  
  qs <- list(
    all = "true",
    hfGT = "R|PO|S|",
    hfSea = paste0(year(ymd(start_date)), "|"),
    player_type = "batter",
    game_date_gt = start_date,
    game_date_lt = end_date,
    min_pitches = "0",
    min_results = "0",
    group_by = "name",
    sort_col = "pitches",
    sort_order = "desc",
    min_abs = "0",
    type = "details",
    `batters_lookup[]` = as.character(player_id)
  )
  
  query <- paste(
    purrr::map_chr(names(qs), \(k) paste0(URLencode(k, reserved = TRUE), "=", URLencode(qs[[k]], reserved = TRUE))),
    collapse = "&"
  )
  
  paste0(base, "?", query)
}

# -------------------------
# 3) Download (with optional caching)
# -------------------------
statcast_download_csv <- function(url) {
  readr::read_csv(url, show_col_types = FALSE, progress = FALSE)
}

get_hitter_statcast_pitches <- function(hitter,
                                        season,
                                        start_date = NULL,
                                        end_date = NULL,
                                        cache_dir = "statcast_cache",
                                        use_cache = TRUE) {
  if (missing(hitter) || hitter == "") stop("Provide `hitter`, e.g. 'Bryce Harper'")
  if (missing(season) || is.null(season)) stop("Provide `season`, e.g. 2025")
  
  season <- as.integer(season)
  if (is.null(start_date)) start_date <- sprintf("%d-03-01", season)
  if (is.null(end_date))   end_date   <- sprintf("%d-11-30", season)
  
  dir.create(cache_dir, showWarnings = FALSE)
  
  player_id <- get_mlbam_id(hitter)
  url <- make_statcast_csv_url_hitter(player_id, start_date, end_date)
  cache_file <- file.path(cache_dir, paste0("pitches_", player_id, "_", season, ".csv"))
  
  dat <- if (use_cache && file.exists(cache_file)) {
    readr::read_csv(cache_file, show_col_types = FALSE, progress = FALSE)
  } else {
    x <- statcast_download_csv(url)
    if (use_cache) readr::write_csv(x, cache_file)
    x
  }
  
  dat %>%
    mutate(
      Season = season,
      Hitter = hitter,
      game_date = as.Date(game_date)
    )
}

# -------------------------
# 4) Classify pitch outcome for plotting (ALL pitches)
# -------------------------
classify_pitch_outcome <- function(dat) {
  # Statcast uses "description" for pitch result and "events" for PA-ending result.
  # We want a clean plotting category for every pitch.
  dat %>%
    mutate(
      outcome = case_when(
        # In play outcomes
        description %in% c("hit_into_play", "hit_into_play_no_out", "hit_into_play_score") ~
          case_when(
            events == "home_run" ~ "In play: HR",
            events == "triple"   ~ "In play: 3B",
            events == "double"   ~ "In play: 2B",
            events == "single"   ~ "In play: 1B",
            TRUE ~ "In play: Out/ROE"
          ),
        
        # Miss / foul / called
        description %in% c("swinging_strike", "swinging_strike_blocked") ~ "Swinging strike",
        description %in% c("called_strike") ~ "Called strike",
        description %in% c("foul", "foul_tip", "foul_bunt") ~ "Foul",
        
        # Balls in/ out of zone (includes pitchouts)
        description %in% c("ball", "blocked_ball", "pitchout") ~ "Ball",
        
        # HBP / walk / strikeout show up as events on last pitch; label them too
        !is.na(events) & events %in% c("walk", "intent_walk") ~ "PA end: Walk",
        !is.na(events) & events %in% c("hit_by_pitch") ~ "PA end: HBP",
        !is.na(events) & events %in% c("strikeout", "strikeout_double_play") ~ "PA end: Strikeout",
        
        TRUE ~ "Other"
      )
    )
}

# -------------------------
# 5) Plot strike zone (catcher view)
# -------------------------
plot_hitter_strikezone <- function(hitter,
                                   season,
                                   start_date = NULL,
                                   end_date = NULL,
                                   cache_dir = "statcast_cache",
                                   use_cache = TRUE,
                                   sample_n = NULL) {
  
  dat <- get_hitter_statcast_pitches(
    hitter = hitter,
    season = season,
    start_date = start_date,
    end_date = end_date,
    cache_dir = cache_dir,
    use_cache = use_cache
  )
  
  # Need plate_x/plate_z for a strike-zone plot
  if (!all(c("plate_x", "plate_z") %in% names(dat))) {
    stop("This CSV did not include plate_x/plate_z. Savant export schema may have changed.")
  }
  
  dat <- dat %>%
    filter(!is.na(plate_x), !is.na(plate_z)) %>%
    classify_pitch_outcome()
  
  if (!is.null(sample_n) && nrow(dat) > sample_n) {
    set.seed(1)
    dat <- dat %>% slice_sample(n = sample_n)
  }
  
  # Strike zone dimensions
  # Horizontal: 17" plate ~ 0.708 ft wide, half-width ~ 0.354.
  # Most public strike-zone plots use ~0.83 ft half-width to approximate the zone edges.
  zone_half_width <- 0.83
  
  # Vertical: use batter-specific sz_bot/sz_top if present; otherwise a reasonable default
  zone_bot <- if ("sz_bot" %in% names(dat)) mean(dat$sz_bot, na.rm = TRUE) else 1.5
  zone_top <- if ("sz_top" %in% names(dat)) mean(dat$sz_top, na.rm = TRUE) else 3.5
  
  # Plot
  ggplot(dat, aes(x = plate_x, y = plate_z)) +
    geom_rect(
      aes(xmin = -zone_half_width, xmax = zone_half_width, ymin = zone_bot, ymax = zone_top),
      inherit.aes = FALSE,
      fill = NA,
      linewidth = 1.0
    ) +
    geom_point(aes(color = outcome, shape = outcome), alpha = 0.8, size = 2.2) +
    coord_fixed(xlim = c(-2.2, 2.2), ylim = c(0.5, 4.6)) +
    theme_minimal(base_size = 12) +
    theme(
      panel.grid.minor = element_blank(),
      panel.grid.major = element_line(linewidth = 0.2),
      legend.title = element_blank(),
      legend.position = "right"
    ) +
    labs(
      title = paste0(hitter, " — Pitch Locations (", season, ")"),
      subtitle = "Catcher view | All pitches | Strike zone shown using avg sz_bot/sz_top",
      x = "plate_x (ft)",
      y = "plate_z (ft)"
    )
}

# -------------------------
# Example usage
# -------------------------
# Plot all pitches for any hitter and season you choose:
plot_hitter_strikezone("Bryce Harper", 2025)

# If you want a smaller, faster plot:
# plot_hitter_strikezone("Bryce Harper", 2025, sample_n = 2000)



############################
# Batter Heat Map Function # 
############################

# --- assumes you already have these from earlier ---
# get_mlbam_id()
# make_statcast_csv_url_hitter()
# statcast_download_csv()
# get_hitter_statcast_pitches()

plot_hitter_hit_locations_strikezone <- function(hitter,
                                                 season,
                                                 start_date = NULL,
                                                 end_date = NULL,
                                                 cache_dir = "statcast_cache",
                                                 use_cache = TRUE,
                                                 sample_n = NULL) {
  season <- as.integer(season)
  if (is.null(start_date)) start_date <- sprintf("%d-03-01", season)
  if (is.null(end_date))   end_date   <- sprintf("%d-11-30", season)
  
  dat <- get_hitter_statcast_pitches(
    hitter = hitter,
    season = season,
    start_date = start_date,
    end_date = end_date,
    cache_dir = cache_dir,
    use_cache = use_cache
  )
  
  # Need plate location
  if (!all(c("plate_x", "plate_z", "events") %in% names(dat))) {
    stop("Missing plate_x/plate_z/events in the CSV. Savant export schema may have changed.")
  }
  
  # Keep ONLY hits (pitch location of the pitch that ended the PA)
  hits <- dat %>%
    filter(!is.na(events)) %>%                       # PA-ending pitch
    filter(events %in% c("single","double","triple","home_run")) %>%
    filter(!is.na(plate_x), !is.na(plate_z)) %>%
    mutate(
      hit_type = factor(
        case_when(
          events == "single" ~ "1B",
          events == "double" ~ "2B",
          events == "triple" ~ "3B",
          events == "home_run" ~ "HR"
        ),
        levels = c("1B","2B","3B","HR")
      )
    )
  
  if (nrow(hits) == 0) {
    stop("No hits found for this hitter/season/date range.")
  }
  
  if (!is.null(sample_n) && nrow(hits) > sample_n) {
    set.seed(1)
    hits <- hits %>% slice_sample(n = sample_n)
  }
  
  # Strike zone dimensions
  zone_half_width <- 0.83
  zone_bot <- if ("sz_bot" %in% names(hits)) mean(hits$sz_bot, na.rm = TRUE) else 1.5
  zone_top <- if ("sz_top" %in% names(hits)) mean(hits$sz_top, na.rm = TRUE) else 3.5
  
  ggplot(hits, aes(x = plate_x, y = plate_z)) +
    annotate(
      "rect",
      xmin = -zone_half_width, xmax = zone_half_width,
      ymin = zone_bot, ymax = zone_top,
      fill = NA, linewidth = 1.0
    ) +
    geom_point(aes(color = hit_type, shape = hit_type), alpha = 0.85, size = 2.6) +
    coord_fixed(xlim = c(-2.2, 2.2), ylim = c(0.5, 4.6)) +
    theme_minimal(base_size = 12) +
    theme(
      panel.grid.minor = element_blank(),
      panel.grid.major = element_line(linewidth = 0.2),
      legend.title = element_blank(),
      legend.position = "right"
    ) +
    labs(
      title = paste0(hitter, " — Hit Locations by Pitch Location (", season, ")"),
      subtitle = "Catcher view | Only hits (1B/2B/3B/HR)",
      x = "plate_x (ft)",
      y = "plate_z (ft)"
    )
}

# Example:
plot_hitter_hit_locations_strikezone("Bryce Harper", 2025)

