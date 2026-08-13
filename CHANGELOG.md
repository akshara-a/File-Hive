# Changelog

All notable changes to Parquet-X are documented here.

## 1.1.x

### [1.1.1] - 2026-08-11

#### Added
- Added an explicit **Run Doctor Checks** action in the Doctor tab for on-demand diagnostics.

#### Changed
- Improved startup performance by activating Parquet-X only when a Parquet file is opened or setup is requested.
- Parquet environment setup now runs only when needed and then reuses the prepared environment.
- Improved load and query responsiveness by reusing a long-lived local Python worker and Parquet file sessions.

#### Fixed
- Improved request stability in Python operations by preventing duplicate timeout/response races.

### [1.1.0] - 2026-07-25

#### Added
- Added grouped navigation with primary workflow tabs and subtabs:
  - Explore: Data, EDA, Visualize, Schema
  - Transform: Edit Data, Create Parquet
  - Compare & Join: Compare, Join
  - Quality: Doctor
- Added table view controls for sorting, hiding/showing columns from a dropdown picker, showing all columns, and resetting the table layout.
- Added quick aggregations that generate DuckDB SQL for group-by count, sum, average, min, and max queries.
- Added an EDA tab with column profiling, missing-value checks, duplicate-row detection, numeric summaries, and suggested next analysis steps.
- Added a Write tab for creating Parquet files from the current result, JSON arrays, or NDJSON streams with editable schema, compression, and row group size options.
- Added column renaming in the Edit Data workflow before saving edited rows as a new Parquet file.
- Added Smart Parquet Diff for comparing files by inferred compatible column mappings and an inferred row key.
- Added Smart Diff summary metrics for mapped columns, auto rename matches, added rows, deleted rows, changed rows, and unchanged rows.
- Added key values to Smart Diff mismatch tables.
- Added a Join tab for joining the current Parquet file with another Parquet or CSV file, selecting join keys and join type, previewing results, and exporting the preview as CSV.

#### Changed
- Doctor row group analysis now displays the compression codec summary for each row group.

#### Fixed
- Fixed the Compare section order-column selector so the compare-file column dropdown remains selectable outside custom mapping mode.

## 1.0.x

### [1.0.9] - 2026-07-25

#### Added
- Added background Python/DuckDB environment prewarming after VS Code startup, with lazy first-use setup as a fallback.
- Added `Parquet Viewer: Setup Python Environment` for explicit environment preparation.
- Added a local SVG-based Visualize tab with bar, line, scatter, and histogram charts over the current query result.
- Added a shared logging service backed by `loglevel` and routed logs through the Parquet Viewer output channel.

#### Changed
- Moved the managed Python virtual environment into VS Code global storage so it can be reused across extension updates.
- Improved DuckDB installation by using binary wheels and skipping the pip version check.
- Removed noisy extension-host and webview `console.*` logging.

### [1.0.8] - 2026-07-16

#### Added
- Added an Edit tab for modifying loaded result rows in the webview.
- Added save-as-new-Parquet support for edited rows, including a clear message that the original file is not changed and the new Parquet file should be opened to view edits.
- Added row add, row delete, edit reset, and change-count controls for the edit workflow.

#### Changed
- Improved button styling with clearer backgrounds, hover states, and fallback colors across VS Code themes.
- Updated package metadata for a more professional extension name and description.

### [1.0.6] - 2026-07-15

#### Added
- SQL-like querying for opened Parquet files using the `parquet_data` table alias.
- CSV, JSON, and SQLite export for the current query result.
- Parquet-to-Parquet comparison with mandatory order column selection, same-column validation, custom same-type column mapping, and highlighted row/value mismatches.
- Parquet Doctor diagnostics for file integrity, schema validation, row group analysis, column statistics, and health report recommendations.
- Parquet Doctor Version 2 diagnostics for schema drift detection, data quality validation, decimal/timestamp diagnostics, compression and encoding analysis, and dataset/partition folder scans.
- Dedicated schema panel with searchable columns, nested structure, physical types, logical types, nullability, repetition levels, definition levels, decimals, and timestamps.
- Copy schema as JSON and generate schema documentation actions.

### [1.0.3] - 2025-10-08

#### Added
- Added new logo.

#### Changed
- Improved Python support.
- Improved extension logs.

### [1.0.2] - 2025-10-08

#### Changed
- Enhanced Python support.

### [1.0.1] - 2025-10-08

#### Fixed
- Fixed Python path resolving.

### [1.0.0] - 2025-10-07

#### Added
- Initial release of Parquet-X.
- Parquet file viewing with DuckDB.
- Custom editor for `.parquet` files.
