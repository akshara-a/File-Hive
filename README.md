# Parquet-X

A VS Code extension for viewing, querying, exporting, comparing, and diagnosing Apache Parquet files directly in your editor.

## Features

- **View Parquet Files** - Open and explore Parquet files with a custom viewer.
- **Data Browser** - Browse data in a clean table interface.
- **SQL Querying** - Run read-only `SELECT` and `WITH` queries against the open file.
- **Export Data** - Export the current query result to CSV, JSON, or SQLite.
- **Compare Parquet Files** - Compare matching files or custom same-type column mappings with highlighted row/value mismatches.
- **Schema Explorer** - Inspect physical types, logical types, nullability, levels, decimals, timestamps, and nested structure.
- **Parquet Doctor** - Diagnose file integrity, schema quality, row groups, statistics, data quality, schema drift, compression, partitions, and suggested fixes.
- **Local Processing** - Powered by DuckDB and a local Python environment.

## Installation

1. Install the extension from the VS Code Marketplace.
2. Open any `.parquet` file.
3. Wait for the initial Python environment setup to finish. The first setup may take a little time.

## Usage

### Opening Parquet Files

Click any `.parquet` file in your workspace. Parquet-X opens it in the custom Parquet Viewer.

### Querying Data

Use the SQL query box to query the open file as the `parquet_data` table.

Only read-only `SELECT` and `WITH` queries are supported.

```sql
SELECT *
FROM parquet_data
WHERE status = 'active'
LIMIT 100;
```

### Exporting Data

Use the export buttons in the query panel to save the current query result as:

- CSV
- JSON
- SQLite database

Exports use the current SQL query, so you can filter rows or select columns before saving.

### Comparing Parquet Files

Open the **Compare** tab and choose another `.parquet` file to compare with the current file.

Strict compare validates that both files have the same column names in the same order before comparison starts. Before running compare, choose the column that should be used to order rows in both files.

For files with different column names, enable **Custom mapping** to map columns manually. Custom mapped columns must have the same type before comparison runs, including the selected order columns.

Rows are sorted by the selected order column and then compared by row order. Mismatched rows are marked in red, and mismatched values are highlighted in the split current-file and compare-file tables.

### Running Parquet Doctor

Open the **Doctor** tab to review the file health report. Parquet Doctor includes:

- File integrity checks for magic bytes, missing footers, unreadable row groups, and incomplete writes.
- Schema validation for physical types, logical types, nullability, decimals, and timestamps.
- Row group analysis with row counts, sizes, compression ratio, and column-chunk details.
- Column statistics checks for min/max, null count, distinct count, all-null columns, constant-value columns, and missing statistics.
- Schema drift detection against a reference Parquet file, including added, removed, renamed, and type-changed columns.
- Data quality validation for high-null columns, duplicate rows, invalid date ranges, empty strings, and suspicious default values.
- Decimal and timestamp diagnostics for precision/scale mismatches, floating-point risk, timestamp unit differences, and timezone ambiguity.
- Compression and encoding analysis by column, with recommendations for weak compression or dictionary encoding choices.
- Dataset and partition analysis for folders of Parquet files, including inconsistent schemas, missing partition keys, empty files, small-file problems, and uneven partition sizes.
- Health score with errors, warnings, passed checks, and suggested fixes.

### Exploring Schema

Open the **Schema** tab to inspect the Parquet schema. The schema panel includes:

- Searchable column list.
- Nested parent-child structure.
- Column name and full path.
- Physical Parquet type and logical type.
- Nullable, required, or repeated status.
- Repetition and definition levels.
- Decimal precision and scale.
- Timestamp unit and timezone interpretation.
- Copy schema as JSON.
- Generate schema documentation.

Logical types are shown because Parquet physical types do not always describe the actual data meaning. For example, strings may be stored physically as `BYTE_ARRAY` with a logical string annotation.

## Commands

Access these commands from the Command Palette:

- `Parquet Viewer: Show Parquet Viewer Logs` - View extension logs for troubleshooting.
- `Parquet Viewer: Reset Python Environment` - Recreate the local Python environment.
- `Refresh` - Reload the current Parquet file.

## How It Works

1. Parquet-X uses a local isolated Python environment with DuckDB.
2. Parquet data, schema metadata, and diagnostics are processed locally.
3. SQL queries run against the open file through DuckDB.
4. Schema metadata is read from Parquet metadata to show physical types, logical annotations, nesting, and levels.

## Troubleshooting

### Extension Not Loading Files

1. Restart VS Code.
2. Check if the file is a valid Parquet file.
3. Run `Parquet Viewer: Show Parquet Viewer Logs` to see detailed error messages.

### Large Files Loading Slowly

- For files larger than 1 GB, use a more powerful machine when possible.
- The extension limits rendered result rows for better UI performance.
- Doctor diagnostics may take longer because they scan file metadata and selected data-quality signals.

### Behind Corporate Proxy or Firewall

1. Configure your system proxy settings for VS Code.
2. Check if your firewall allows VS Code extensions.
3. Check logs with `Parquet Viewer: Show Parquet Viewer Logs`.

### General Issues

1. Open the Command Palette.
2. Run `Parquet Viewer: Show Parquet Viewer Logs`.
3. Try `Developer: Reload Window`.

## Privacy and Data

- All data processing happens locally on your machine.
- No data is sent to external servers.
- The extension only accesses Parquet files you explicitly open or choose for compare/diagnostics.
- No telemetry or data collection is included.

## Known Limitations

- Very large files may take longer to load or diagnose.
- Some complex nested Parquet schemas may not display optimally.
- Dataset scans can take longer on folders with many Parquet files.
- The viewer is limited by VS Code webview rendering constraints for very large result sets.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT. See [LICENSE](LICENSE).

## Author

Akshara A  
akshararajan26@outlook.in
