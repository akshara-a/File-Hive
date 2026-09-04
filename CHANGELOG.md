# Changelog

All notable changes to File Hive, formerly Parquet-X, are documented here.

## 1.2.x

### [1.2.2] - 2026-09-04

#### Added
- Added a Data tab collapse control that hides query, source option, aggregation, and table tool controls so the data grid can use more space.

#### Changed
- Quick aggregations now hide the metric selector when using Count because Count runs against rows with `COUNT(*)`.

### [1.2.1] - 2026-08-26

#### Added
- Added `.xlsx` (Excel) and `.sqlite3` file support to the data viewer.
- Added `.xlsx` reload options for choosing the header row and first data row.
- Excel reads default to text columns to avoid failures when a column mixes values like numbers and labels.
- Added a **Mount Workspace Database** command that mounts the entire workspace as queryable views.
- Added UI Pagination for viewing large datasets without performance degradation.
- Dataset scans (partition analysis) are now available for all tabular datasets, not just Parquet.

#### Changed
- Removed `.markdown` and `.md` file support, as well as automatic `.json` interception for a less intrusive user experience.
- The "Create Parquet" tool is now available for all tabular sources (CSV, DuckDB, JSON, Excel, etc.), not just Parquet files.

#### Performance
- Rewrote the "Create Parquet" (Write) engine to execute a native DuckDB `COPY` operation instead of serializing JSON between V8 and Python. File conversion overhead is gone!
- Rewrote data "Export" engine to execute DuckDB native `COPY` for CSV, TSV, PSV, JSON, JSONL, and NDJSON files, making exports incredibly fast.

### [1.2.0] - 2026-08-24

#### Added
- Added table/view discovery for multi-table DuckDB and SQLite files.
- Added multi-relation export choices for database sources: export the current SQL result, one selected table/view, or every table/view as separate files in a ZIP archive.
- Added table/view selection for multi-relation DuckDB and SQLite files used as Compare, Join, and Schema Drift secondary inputs.
- Added CSV, TSV, and PSV reload options for header rows, delimiter overrides, encodings, quote characters, escape characters, and null-string handling.
- Added JSON, JSONL, and NDJSON reload options for nested-field flattening and record-path selection.
- Added Markdown file support with a text-only preview and only applicable viewer actions.
- Added an Open as Text action for CSV, TSV, PSV, JSON, JSONL, NDJSON, and Markdown sources.

#### Changed
- DuckDB and SQLite files now expose available tables/views in the Data tab and preserve the selected relation across query, refresh, export, quick aggregation, and Doctor workflows.
- Export save defaults now include the selected table/view name when exporting one relation from a multi-relation source.
- Viewer tabs, subtabs, and Doctor panels now hide workflows that do not apply to the loaded source or current query result.
- Edited result saves now write a same-format copy; use Export for format conversion.

## 1.1.x

### [1.1.5] - 2026-08-21

#### Added
- Rebranded the extension UI and documentation to File Hive while keeping the Marketplace package identity as `CosmicTechnoid.parquet-x` for in-place upgrades.
- Added first-class open/query support for DuckDB, SQLite, CSV, TSV, PSV, JSON, JSONL, NDJSON, Avro, ORC, Arrow, Feather, and IPC files alongside Parquet.
- Added source format badges so the viewer shows whether the open file is Parquet, DuckDB, SQLite, CSV, TSV, PSV, JSON, JSONL, NDJSON, Avro, ORC, Arrow, Feather, or IPC.
- Added export targets for CSV, TSV, PSV, JSON, JSONL, NDJSON, SQLite, Parquet, DuckDB, Avro, ORC, Arrow, Feather, and IPC.
- Added exact source-format tracking so `.json`, `.jsonl`, and `.ndjson` can share JSON reading while keeping distinct export behavior.
- Added rainbow-style column color accents for CSV-like table views.

#### Changed
- Moved Export to its own top-level tab so conversion tools stay visible for every supported source format.
- Export now hides only the current file's own format and keeps every other supported target available.
- Renamed core implementation files and types from Parquet-specific names to File Hive/data-file names.
- Changed the default SQL table alias to `file_data`; the old `parquet_data` alias remains available for saved queries.
- Updated README, package metadata, release guide, command titles, logs, and tests for File Hive branding.

#### Fixed
- Fixed non-Parquet formats falling into the Parquet reader path by routing each supported extension through the correct reader.
- Fixed PSV loading so pipe-separated files use pipe-delimited ingestion.
- Fixed stale virtual-environment cleanup on Windows by retrying locked cleanup paths more carefully.

### [1.1.4] - 2026-08-17

#### Fixed
- Fixed extension activation by removing the runtime `loglevel` dependency from the logging service.

### [1.1.3] - 2026-08-17

#### Added
- Added `Parquet Viewer: Show Environment Doctor` to write Python, `uv`, virtual environment, DuckDB, and setup state diagnostics to the Parquet Viewer output channel.
- Added a setup status bar indicator that links to the Parquet Viewer output channel.
- Added a **Retry Setup** action when environment setup fails.
- Added command-registration smoke coverage for environment setup, reset, logs, and Doctor commands.

#### Changed
- Setup and reset now open the Parquet Viewer output channel and show a VS Code notification when they start.
- Setup progress messages are now written to the Parquet Viewer output channel as well as VS Code progress notifications.

#### Fixed
- Ensured the reset-environment command is registered before editor setup and can be launched from setup failure recovery.

### [1.1.2] - 2026-08-17

#### Changed
- Added user-facing progress updates during Python/DuckDB environment setup and reset.
- Environment setup now uses `uv` for faster virtual environment creation and DuckDB installation when available, with Python `venv` and pip as a fallback.

### [1.1.1] - 2026-08-11

#### Added
- Added an explicit **Run Doctor Checks** action in the Doctor tab for on-demand diagnostics.

#### Changed
- Improved startup performance by activating Parquet-X only when a supported data file is opened or setup is requested.
- Python/DuckDB environment setup now runs only when needed and then reuses the prepared environment.
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
