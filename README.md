# Parquet-X

A powerful VS Code extension for viewing and exploring Apache Parquet files directly in your editor.

## Features

- **View Parquet Files** - Open and explore Parquet files with a custom viewer
- **Data Visualization** - Browse your data in a clean, organized interface
- **SQL Querying** - Run SQL-like `SELECT` queries against the open file
- **Export Data** - Export the current result set to CSV, JSON, or SQLite
- **Compare Parquet Files** - Compare matching files or custom same-type column mappings with highlighted row/value mismatches
- **Parquet Doctor** - Diagnose file integrity, schema quality, row groups, statistics, and suggested fixes
- **Schema Explorer** - Inspect physical types, logical types, nullability, levels, decimals, timestamps, and nested structure
- **Fast & Efficient** - Powered by DuckDB for quick data processing
- **Easy Refresh** - Reload data with a single click

## Installation
1. Install the extension from the VS Code Marketplace
2. Open any `.parquet` file - the extension will handle everything automatically
3. Pelease note, initial setup takes a bit of time. Kindly have patience

## Usage

### Opening Parquet Files

Simply click on any `.parquet` file in your workspace, and it will open in the Parquet Viewer.

### Querying Data

Use the SQL query box in the viewer to query the open file as the `parquet_data` table.

Only read-only `SELECT` and `WITH` queries are supported.

Example:

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

Exports use the current SQL query, so you can filter or select columns before saving.

### Comparing Parquet Files

Open the **Compare** tab and choose another `.parquet` file to compare with the current file.

Strict compare validates that both Parquet files have the same column names in the same order before comparison starts. Before running compare, choose the column that should be used to order rows in both files.

For files with different column names, enable **Custom mapping** to list columns from both files and map columns manually. Custom mapped columns must have the same type before comparison runs, including the selected order columns.

Rows are sorted by the selected order column and then compared by row order. Mismatched rows are marked in red, and mismatched values are highlighted inside the split current-file and compare-file tables.

### Running Parquet Doctor

Open the **Doctor** tab to review the file health report. Parquet Doctor includes:

- File integrity checks for magic bytes, missing footers, unreadable row groups, and incomplete writes
- Schema validation for physical types, logical types, nullability, decimals, and timestamps
- Row group analysis with row counts, sizes, compression ratio, and column-chunk details
- Column statistics checks for min/max, null count, distinct count, all-null columns, constant-value columns, and missing statistics
- Health score with errors, warnings, passed checks, and suggested fixes

### Exploring Schema

Open the **Schema** tab in the viewer to inspect the Parquet schema. The schema panel includes:

- Searchable column list
- Nested parent-child structure
- Column name and full path
- Physical Parquet type and logical type
- Nullable, required, or repeated status
- Repetition and definition levels
- Decimal precision and scale
- Timestamp unit and timezone interpretation
- Copy schema as JSON
- Generate schema documentation

Logical types are shown because Parquet physical types do not always describe the actual data meaning. For example, strings may be stored physically as `BYTE_ARRAY` with a logical string annotation.

### Commands

Access these commands via the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- **`Parquet Viewer: Show Logs`** - View extension logs for troubleshooting
- **`Refresh`** - Reload the current Parquet file

## How It Works

1. **Local Processing**: Uses a local isolated Python environment with DuckDB
2. **File Processing**: Reads Parquet data and schema metadata locally
3. **Query Execution**: Runs read-only SQL queries against the open file through DuckDB
4. **Schema Metadata**: Uses Parquet schema metadata to show physical types, logical annotations, nesting, and levels

## Troubleshooting

### Extension Not Loading Files

**Solution:**
1. Restart VS Code
2. Check if the file is a valid Parquet file
3. Run `Parquet Viewer: Show Logs` to see detailed error messages

### Large Files Loading Slowly

**Solution:**
- For files larger than 1GB, consider using a more powerful machine
- The extension automatically paginates data for better performance

### Behind Corporate Proxy/Firewall

If extension fails to load:
1. Configure your system proxy settings for VS Code
2. Check if your firewall allows VS Code extensions
3. Check logs with `Parquet Viewer: Show Logs`

### General Issues

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Run `Parquet Viewer: Show Logs` to see detailed error messages
3. Try reloading the window (Developer: Reload Window)

## Privacy & Data

- All data processing happens locally on your machine
- No data is sent to external servers
- The extension only accesses the Parquet files you explicitly open
- No telemetry or data collection

## Known Limitations

- Very large files (>1GB) may take longer to load
- Some complex nested Parquet schemas may not display optimally
- Limited by browser storage quotas for very large datasets

## Feedback & Issues

Found a bug or have a feature request? Please file an issue on our |GitHub repository|(To be updated soon).

## Release Notes

### 1.0.0

- Initial release
- Parquet file viewing with DuckDB
- No additional dependencies required
- Custom editor for `.parquet` files

## License

This project is licensed under the **MIT License** — you’re free to use, modify, and distribute it as long as proper credit is given.

## Author

**Akshara A**  
Email - akshararajan26@outlook.in

---

**Enjoy exploring your Parquet files!** 
