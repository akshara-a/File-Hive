# Changelog

All notable changes to Parquet-X are documented here.

## [1.0.8] - 2026-07-16
### Added
- Added an Edit tab for modifying loaded result rows in the webview.
- Added save-as-new-Parquet support for edited rows, including a clear message that the original file is not changed and the new Parquet file should be opened to view edits.
- Added row add, row delete, edit reset, and change-count controls for the edit workflow.

### Changed
- Improved button styling with clearer backgrounds, hover states, and fallback colors across VS Code themes.
- Updated package metadata for a more professional extension name and description.

## [1.0.6] - 2026-07-15
### Added
- SQL-like querying for opened Parquet files using the `parquet_data` table alias.
- CSV, JSON, and SQLite export for the current query result.
- Parquet-to-Parquet comparison with mandatory order column selection, same-column validation, custom same-type column mapping, and highlighted row/value mismatches.
- Parquet Doctor diagnostics for file integrity, schema validation, row group analysis, column statistics, and health report recommendations.
- Parquet Doctor Version 2 diagnostics for schema drift detection, data quality validation, decimal/timestamp diagnostics, compression and encoding analysis, and dataset/partition folder scans.
- Dedicated schema panel with searchable columns, nested structure, physical types, logical types, nullability, repetition levels, definition levels, decimals, and timestamps.
- Copy schema as JSON and generate schema documentation actions.

## [1.0.3] - 2025-10-08
### Changed
- Improved Python support.
- Improved extension logs.

### Added
- Added new logo.

## [1.0.2] - 2025-10-08
### Changed
- Enhanced Python support.

## [1.0.1] - 2025-10-08
### Fixed
- Fixed Python path resolving.

## [1.0.0] - 2025-10-07
### Added
- Initial release of Parquet-X.
- Parquet file viewing with DuckDB.
- Custom editor for `.parquet` files.
