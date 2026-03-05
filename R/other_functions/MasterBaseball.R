############################################################
# Baseball Savant / Statcast Toolkit 
# Current Functions:
#   1) Season summary table  -> returns a gt table
#   2) Run Value by pitch type -> returns a gt table
#   3) Strike-zone plot: hits only (1B/2B/3B/HR) -> returns ggplot
#   4) Scrape Homerun Leaders: Gets HR leaders for given year
#
# Notes:
# - Uses MLB StatsAPI for player lookup (no API key)
# - Uses Baseball Savant Statcast Search CSV export (no API key)
# - Caches downloads by default
############################################################

library(tidyverse)
library(stringr)
library(lubridate)
library(gt)
library(httr2)
library(jsonlite)


# ============================================================
# 0) Small helper for null-coalesce
# ============================================================
`%||%` <- function(a, b) if (!is.null(a)) a else b

# ============================================================
# 1) Player name -> MLBAM id (NO baseballr)
#    Uses MLB StatsAPI people search endpoint (no key)
# ============================================================

mlbam_search <- function(player_name, limit = 10) {
  stopifnot(is.character(player_name), length(player_name) == 1)
  
  url <- "https://statsapi.mlb.com/api/v1/people/search"
  resp <- request(url) %>%
    req_url_query(names = player_name) %>%
    req_perform()
  
  js <- jsonlite::fromJSON(resp_body_string(resp), flatten = TRUE)
  
  if (!"people" %in% names(js) || length(js$people) == 0) {
    return(tibble())
  }
  
  tibble(
    name = js$people$fullName,
    mlbam_id = js$people$id,
    primary_position = js$people$primaryPosition.name %||% NA_character_,
    current_team = js$people$currentTeam.name %||% NA_character_
  ) %>%
    distinct() %>%
    slice_head(n = limit)
}

# default: pick first match; you can override by passing mlbam_id manually downstream
get_mlbam_id <- function(player_name) {
  hits <- mlbam_search(player_name, limit = 10)
  if (nrow(hits) == 0) stop("No MLBAM matches found for: ", player_name)
  hits$mlbam_id[[1]]
}

# ============================================================
# 2) Statcast CSV URL builder + downloader (Savant export)
# ============================================================

season_date_range <- function(season) {
  list(
    start_date = sprintf("%d-03-01", as.integer(season)),
    end_date   = sprintf("%d-11-30", as.integer(season))
  )
}

make_statcast_csv_url <- function(player_id, start_date, end_date, player_type = c("batter","pitcher")) {
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
    purrr::map_chr(names(qs), \(k) paste0(URLencode(k, reserved = TRUE), "=", URLencode(qs[[k]], reserved = TRUE))),
    collapse = "&"
  )
  
  paste0(base, "?", query)
}

statcast_download_csv <- function(url) {
  readr::read_csv(url, show_col_types = FALSE, progress = FALSE)
}

get_player_statcast_details <- function(player,
                                        season,
                                        player_type = c("batter","pitcher"),
                                        mlbam_id = NULL,
                                        start_date = NULL,
                                        end_date = NULL,
                                        cache_dir = "statcast_cache",
                                        use_cache = TRUE) {
  player_type <- match.arg(player_type)
  season <- as.integer(season)
  
  if (is.null(start_date) || is.null(end_date)) {
    rng <- season_date_range(season)
    if (is.null(start_date)) start_date <- rng$start_date
    if (is.null(end_date))   end_date   <- rng$end_date
  }
  
  dir.create(cache_dir, showWarnings = FALSE)
  
  pid <- if (!is.null(mlbam_id)) as.integer(mlbam_id) else get_mlbam_id(player)
  
  url <- make_statcast_csv_url(pid, start_date, end_date, player_type = player_type)
  cache_file <- file.path(cache_dir, paste0(player_type, "_", pid, "_", season, ".csv"))
  
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
      Player = player,
      game_date = if ("game_date" %in% names(dat)) as.Date(game_date) else as.Date(NA)
    )
}

# ============================================================
# 3) Shared metric helpers
# ============================================================

safe_mean <- function(x) if (all(is.na(x))) NA_real_ else mean(x, na.rm = TRUE)
safe_pct  <- function(x) if (length(x) == 0) NA_real_ else mean(x, na.rm = TRUE) * 100

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

is_batted_ball <- function(events) {
  events %in% c(
    "single","double","triple","home_run",
    "field_out","force_out","grounded_into_double_play","double_play","triple_play",
    "field_error","fielders_choice","fielders_choice_out",
    "sac_fly","sac_bunt","sac_fly_double_play",
    "other_out"
  )
}
is_hit_event <- function(e) e %in% c("single", "double", "triple", "home_run")
is_k_event   <- function(e) e %in% c("strikeout", "strikeout_double_play")
is_bb_event  <- function(e) e %in% c("walk", "intent_walk")

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

recode_pitch_name <- function(x) {
  ifelse(x %in% names(pitch_name_lookup), unname(pitch_name_lookup[x]), x)
}

# ============================================================
# 4) GT formatters (used by the 2 table functions)
# ============================================================

gt_season_summary <- function(df, title_text) {
  df %>%
    arrange(desc(Season)) %>%
    gt() %>%
    tab_header(title = title_text) %>%
    cols_hide(columns = Player) %>%
    cols_label(
      Season = "Season",
      Pitches = "Pitches",
      Batted_Balls = "BBE",
      Barrels = "Barrels",
      Barrel_Pct = "Barrel%",
      Avg_EV = "Avg EV",
      Avg_LA = "Avg LA",
      Sweet_Spot_Pct = "Sweet Spot%",
      xBA = "xBA",
      xSLG = "xSLG",
      xwOBA = "xwOBA",
      xwOBAcon = "xwOBAcon",
      Hard_Hit_Pct = "Hard Hit%",
      K_Pct = "K%",
      BB_Pct = "BB%"
    ) %>%
    fmt_number(columns = c(Pitches, Batted_Balls, Barrels), decimals = 0) %>%
    fmt_number(columns = c(Avg_EV, Avg_LA), decimals = 1) %>%
    fmt_number(columns = c(xBA, xSLG, xwOBA, xwOBAcon), decimals = 3) %>%
    fmt_number(columns = c(Barrel_Pct, Sweet_Spot_Pct, Hard_Hit_Pct, K_Pct, BB_Pct), decimals = 1) %>%
    tab_options(
      table.font.size = px(12),
      data_row.padding = px(3),
      heading.title.font.size = px(16)
    )
}

gt_rv_pitch_type <- function(df, title_text) {
  df %>%
    gt(groupname_col = "Season") %>%
    tab_header(title = title_text) %>%
    cols_hide(columns = Player) %>%
    cols_label(
      Role = "Role",
      pitch_type = "Pitch Type",
      RV_100 = "RV/100",
      Run_Value = "Run Value",
      Pitches = "Pitches",
      pitch_pct = "Pitch%",
      PA = "PA",
      BA = "BA",
      SLG = "SLG",
      wOBA = "wOBA",
      K_pct = "K%",
      Whiff_pct = "Whiff%",
      Putaway_pct = "Putaway%",
      xBA = "xBA",
      xSLG = "xSLG",
      xwOBA = "xwOBA"
    ) %>%
    fmt_number(columns = c(Pitches, PA), decimals = 0) %>%
    fmt_percent(columns = c(pitch_pct, K_pct, Whiff_pct, Putaway_pct), decimals = 1) %>%
    fmt_number(columns = c(RV_100, Run_Value), decimals = 2) %>%
    fmt_number(columns = c(BA, SLG, wOBA, xBA, xSLG, xwOBA), decimals = 3) %>%
    tab_options(
      table.font.size = px(12),
      data_row.padding = px(3),
      heading.title.font.size = px(16)
    )
}

# ============================================================
# 5) Function 1: Season summary table (returns GT)
# ============================================================

get_player_statcast_season_table <- function(player,
                                             seasons = 2015:year(Sys.Date()),
                                             type = c("hitting","pitching"),
                                             postseason = TRUE,
                                             mlbam_id = NULL,
                                             cache_dir = "statcast_cache",
                                             use_cache = TRUE) {
  type <- match.arg(type)
  player_type <- ifelse(type == "hitting", "batter", "pitcher")
  
  out <- map_dfr(seasons, function(season) {
    dat <- tryCatch(
      get_player_statcast_details(
        player = player, season = season, player_type = player_type,
        mlbam_id = mlbam_id, cache_dir = cache_dir, use_cache = use_cache
      ),
      error = function(e) tibble()
    )
    if (nrow(dat) == 0) return(tibble())
    if (!("events" %in% names(dat))) return(tibble())
    
    if (!postseason && "game_date" %in% names(dat)) {
      dat <- dat %>% filter(month(game_date) <= 9)
    }
    
    pitches_n <- nrow(dat)
    pa  <- dat %>% filter(!is.na(events))
    bbe <- pa %>% filter(is_batted_ball(events))
    
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
    k_pct <- if (pa_n == 0) NA_real_ else mean(is_k_event(pa$events)) * 100
    bb_pct <- if (pa_n == 0) NA_real_ else mean(is_bb_event(pa$events)) * 100
    
    xba   <- if ("estimated_ba_using_speedangle" %in% names(bbe))  bbe$estimated_ba_using_speedangle  else NA_real_
    xslg  <- if ("estimated_slg_using_speedangle" %in% names(bbe)) bbe$estimated_slg_using_speedangle else NA_real_
    xwoba <- if ("estimated_woba_using_speedangle" %in% names(bbe)) bbe$estimated_woba_using_speedangle else NA_real_
    
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
  
  if (nrow(out) == 0) {
    out <- tibble(
      Season = integer(), Player = character(), Pitches = integer(), Batted_Balls = integer(),
      Barrels = integer(), Barrel_Pct = double(), Avg_EV = double(), Avg_LA = double(),
      Sweet_Spot_Pct = double(), xBA = double(), xSLG = double(), xwOBA = double(),
      xwOBAcon = double(), Hard_Hit_Pct = double(), K_Pct = double(), BB_Pct = double()
    )
  }
  
  gt_season_summary(out, title_text = paste0(player, " — Statcast Season Summary"))
}

# ============================================================
# 6) Function 2: Run Value by pitch type (returns GT)
# ============================================================

rv_by_pitch_type_all_seasons <- function(player,
                                         role = c("hitter", "pitcher"),
                                         start_season = 2015,
                                         end_season = year(Sys.Date()),
                                         postseason = TRUE,
                                         mlbam_id = NULL,
                                         cache_dir = "statcast_cache",
                                         use_cache = TRUE) {
  role <- match.arg(role)
  player_type <- ifelse(role == "hitter", "batter", "pitcher")
  seasons <- start_season:end_season
  
  dat_all <- map_dfr(seasons, function(season) {
    dat <- tryCatch(
      get_player_statcast_details(
        player = player, season = season, player_type = player_type,
        mlbam_id = mlbam_id, cache_dir = cache_dir, use_cache = use_cache
      ),
      error = function(e) tibble()
    )
    if (nrow(dat) == 0) return(tibble())
    if (!postseason && "game_date" %in% names(dat)) dat <- dat %>% filter(month(game_date) <= 9)
    dat
  })
  
  if (nrow(dat_all) == 0) {
    out <- tibble(
      Season = integer(), Player = character(), Role = character(), pitch_type = character(),
      RV_100 = double(), Run_Value = double(), Pitches = integer(), pitch_pct = double(),
      PA = integer(), BA = double(), SLG = double(), wOBA = double(), K_pct = double(),
      Whiff_pct = double(), Putaway_pct = double(),
      xBA = double(), xSLG = double(), xwOBA = double()
    )
    return(gt_rv_pitch_type(out, title_text = paste0(player, " — Run Value by Pitch Type")))
  }
  
  if (!("events" %in% names(dat_all))) stop("No 'events' column in Statcast CSV.")
  
  dat_all <- dat_all %>%
    add_pitch_flags() %>%
    filter(!is.na(pitch_type))
  
  # delta_run_exp is from batting team perspective, so flip for pitcher
  has_rv <- "delta_run_exp" %in% names(dat_all)
  dat_all <- dat_all %>%
    mutate(
      rv = if (has_rv) delta_run_exp else NA_real_,
      rv = if (role == "pitcher") -rv else rv
    )
  
  pitch_level <- dat_all %>%
    group_by(Season, Player, pitch_type) %>%
    summarise(
      Pitches = n(),
      Run_Value = if (has_rv) sum(rv, na.rm = TRUE) else NA_real_,
      RV_100 = if (has_rv) 100 * Run_Value / Pitches else NA_real_,
      swings = sum(is_swing, na.rm = TRUE),
      whiffs = sum(is_whiff, na.rm = TRUE),
      Whiff_pct = ifelse(swings == 0, NA_real_, whiffs / swings),
      .groups = "drop"
    ) %>%
    group_by(Season, Player) %>%
    mutate(pitch_pct = Pitches / sum(Pitches)) %>%
    ungroup()
  
  pa_end <- dat_all %>% filter(!is.na(events))
  has_woba <- "woba_value" %in% names(pa_end)
  
  pa_level <- pa_end %>%
    group_by(Season, Player, pitch_type) %>%
    summarise(
      PA = n(),
      AB = sum(events %in% c(
        "single","double","triple","home_run",
        "field_out","force_out","grounded_into_double_play","double_play","triple_play",
        "fielders_choice_out","other_out",
        "strikeout","strikeout_double_play"
      ), na.rm = TRUE),
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
  
  putaway <- tibble(Season = integer(), Player = character(), pitch_type = character(), Putaway_pct = double())
  if ("strikes" %in% names(dat_all)) {
    putaway <- dat_all %>%
      filter(strikes == 2, !is.na(events)) %>%
      group_by(Season, Player, pitch_type) %>%
      summarise(Putaway_pct = mean(is_k_event(events), na.rm = TRUE), .groups = "drop")
  }
  
  exp_level <- dat_all %>%
    group_by(Season, Player, pitch_type) %>%
    summarise(
      xBA   = if ("estimated_ba_using_speedangle" %in% names(dat_all))  mean(estimated_ba_using_speedangle, na.rm = TRUE)  else NA_real_,
      xSLG  = if ("estimated_slg_using_speedangle" %in% names(dat_all)) mean(estimated_slg_using_speedangle, na.rm = TRUE) else NA_real_,
      xwOBA = if ("estimated_woba_using_speedangle" %in% names(dat_all)) mean(estimated_woba_using_speedangle, na.rm = TRUE) else NA_real_,
      .groups = "drop"
    )
  
  out <- pitch_level %>%
    left_join(pa_level, by = c("Season","Player","pitch_type")) %>%
    left_join(putaway, by = c("Season","Player","pitch_type")) %>%
    left_join(exp_level, by = c("Season","Player","pitch_type")) %>%
    mutate(
      Role = ifelse(role == "hitter", "Batter", "Pitcher"),
      pitch_type = recode_pitch_name(pitch_type)
    ) %>%
    select(
      Season, Player, Role, pitch_type,
      RV_100, Run_Value, Pitches, pitch_pct,
      PA, BA, SLG, wOBA, K_pct,
      Whiff_pct, Putaway_pct,
      xBA, xSLG, xwOBA
    ) %>%
    arrange(desc(Season), desc(RV_100))
  
  gt_rv_pitch_type(out, title_text = paste0(player, " — Run Value by Pitch Type"))
}

# ============================================================
# 7) Function 3: Strike-zone plot (hits only: 1B/2B/3B/HR)
# ============================================================

plot_hitter_hit_locations_strikezone <- function(hitter,
                                                 season,
                                                 mlbam_id = NULL,
                                                 start_date = NULL,
                                                 end_date = NULL,
                                                 cache_dir = "statcast_cache",
                                                 use_cache = TRUE,
                                                 sample_n = NULL) {
  
  dat <- get_player_statcast_details(
    player = hitter,
    season = season,
    player_type = "batter",
    mlbam_id = mlbam_id,
    start_date = start_date,
    end_date = end_date,
    cache_dir = cache_dir,
    use_cache = use_cache
  )
  
  if (!all(c("plate_x","plate_z","events") %in% names(dat))) {
    stop("Missing plate_x/plate_z/events in CSV.")
  }
  
  hits <- dat %>%
    filter(!is.na(events)) %>%
    filter(events %in% c("single","double","triple","home_run")) %>%
    filter(!is.na(plate_x), !is.na(plate_z)) %>%
    mutate(
      hit_type = factor(
        case_when(
          events == "single"   ~ "1B",
          events == "double"   ~ "2B",
          events == "triple"   ~ "3B",
          events == "home_run" ~ "HR"
        ),
        levels = c("1B","2B","3B","HR")
      )
    )
  
  if (nrow(hits) == 0) stop("No hits found.")
  
  if (!is.null(sample_n) && nrow(hits) > sample_n) {
    set.seed(1)
    hits <- hits %>% slice_sample(n = sample_n)
  }
  
  zone_half_width <- 0.83
  zone_bot <- if ("sz_bot" %in% names(hits)) mean(hits$sz_bot, na.rm = TRUE) else 1.5
  zone_top <- if ("sz_top" %in% names(hits)) mean(hits$sz_top, na.rm = TRUE) else 3.5
  plate_y <- max(0.55, zone_bot - 0.35)
  
  shape_map <- c("1B" = 21, "2B" = 22, "3B" = 24, "HR" = 23)
  
  fill_map <- c(
    "1B" = "#1f77b4",
    "2B" = "#2ca02c",
    "3B" = "#ff7f0e",
    "HR" = "#d62728"
  )
  
  ggplot(hits, aes(plate_x, plate_z)) +
    annotate("rect",
             xmin = -2.2, xmax = 2.2,
             ymin = 0.5, ymax = 4.6,
             fill = "white"
    ) +
    annotate("rect",
             xmin = -zone_half_width, xmax = zone_half_width,
             ymin = zone_bot, ymax = zone_top,
             fill = NA, color = "black", linewidth = 1.1
    ) +
    annotate("segment",
             x = 0, xend = 0,
             y = zone_bot, yend = zone_top,
             linewidth = 0.3, color = "grey60"
    ) +
    annotate("polygon",
             x = c(0, 0.25, 0, -0.25),
             y = c(plate_y + 0.20, plate_y, plate_y - 0.20, plate_y),
             fill = "grey30", alpha = 0.35
    ) +
    geom_point(
      aes(fill = hit_type, shape = hit_type),
      color = "black",
      size = 3,
      stroke = 0.4,
      alpha = 0.9
    ) +
    scale_shape_manual(values = shape_map) +
    scale_fill_manual(values = fill_map) +
    coord_fixed(xlim = c(-2.2, 2.2), ylim = c(0.5, 4.6)) +
    labs(
      title = hitter,
      subtitle = as.character(season),
      fill = NULL,
      shape = NULL
    ) +
    theme_void(base_size = 12) +
    theme(
      plot.title = element_text(face = "bold", size = 14),
      plot.subtitle = element_text(size = 11, color = "grey30"),
      legend.position = "right",
      legend.text = element_text(size = 10),
      plot.margin = margin(15, 15, 15, 15),
      plot.title.position = "plot"
    )
}

# ============================================================
# Examples
# ============================================================
# Season summary (GT output)
get_player_statcast_season_table("Bryce Harper", seasons = 2023:2025, type = "hitting")
get_player_statcast_season_table("Paul Skenes", seasons = 2024:2025, type = "pitching")

# Run value by pitch type (GT output)
rv_by_pitch_type_all_seasons("Bryce Harper", role = "hitter")
rv_by_pitch_type_all_seasons("Paul Skenes", role = "pitcher")

# Strike-zone hits-only plot
plot_hitter_hit_locations_strikezone("Bryce Harper", 2025)

##################################
# Scrape Homerun Leader Function #
##################################

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
  
  # Be tolerant to slight header changes
  # "Actual HR" is typically hr_total on this leaderboard.
  hr_col <- intersect(names(df), c("hr_total", "actual_hr", "HR", "Actual HR"))[1]
  player_col <- intersect(names(df), c("player", "Player", "player_name"))[1]
  
  if (is.na(hr_col)) stop("Could not find the 'Actual HR' column (expected hr_total).")
  if (is.na(player_col)) stop("Could not find the player name column.")
  
  df %>%
    mutate(
      # Force numeric for sorting; keep integer-looking output
      hr_total_num = suppressWarnings(as.integer(.data[[hr_col]]))
    ) %>%
    arrange(desc(hr_total_num), .data[[player_col]]) %>%
    select(-hr_total_num)
}

# Example:
hr2025 <- savant_hr_tracker_leaders(2025)

write.csv(hr2025, "homeruns2025.csv")











