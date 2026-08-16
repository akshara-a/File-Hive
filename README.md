# Parquet-X

Parquet-X is an open-source Visual Studio Code extension for inspecting Apache Parquet files without leaving your editor. It provides a local viewer for browsing data, running read-only SQL queries, creating Parquet files, performing exploratory data analysis, exporting results, comparing and joining files, visualizing query results, reviewing schema metadata, and diagnosing common Parquet issues.

All file processing runs locally through DuckDB in an isolated Python environment created by the extension. When `uv` is available, Parquet-X uses it to create the environment and install DuckDB faster, with Python/pip as a fallback.

## Features

- Open `.parquet` files in a custom VS Code editor.
- Navigate grouped tabs with subtabs for Explore, Transform, Compare & Join, and Quality workflows.
- Browse rows in a table view with result counts, column counts, sorting, and column visibility.
- Run read-only SQL using the `parquet_data` table alias.
- Build quick group-by aggregations without writing SQL.
- Profile the current query result in the EDA tab with column types, missing values, duplicate rows, numeric summaries, quality checks, and suggested next steps.
- Create Parquet files from pasted JSON arrays, NDJSON streams, or the current query result with editable schema, compression, and row group size controls.
- Export the current query result to CSV, JSON, or SQLite.
- Edit loaded result rows, rename output columns, and save the result as a new Parquet file.
- Compare Parquet files with Smart Diff, strict column matching, or custom same-type column mapping.
- Join the open Parquet file with another Parquet or CSV file and preview the result.
- Visualize current query results with bar, line, scatter, and histogram charts.
- Inspect schema structure, physical types, logical types, nullability, repetition levels, definition levels, decimals, and timestamps.
- Run Parquet Doctor diagnostics on demand for integrity, schema quality, row groups, statistics, data quality, compression, encoding, schema drift, and dataset partitions.
- Copy schema JSON or generate Markdown schema documentation.

## Installation

Install Parquet-X from the Visual Studio Code Marketplace, then open any `.parquet` file from your workspace.

Parquet-X activates when you open a `.parquet` file (or run setup) and prepares its local Python/DuckDB environment only when needed. Setup reports progress while it checks Python, creates the isolated environment, installs DuckDB, and verifies everything is ready. The prepared environment is stored in VS Code global storage and reused afterward.

## Usage

### Open A Parquet File

Select a `.parquet` file in VS Code. Parquet-X opens it in the custom viewer and renders an initial preview of the data.

### Query Data

Use the SQL editor in the Explore group's Data subtab to query the open file as `parquet_data`.

Only read-only `SELECT` and `WITH` queries are supported.

```sql
SELECT *
FROM parquet_data
WHERE status = 'active'
LIMIT 100;
```

### Refine The Table View

Use the table tools in the Explore group's Data subtab to sort rows, choose visible columns from a dropdown, show all columns again, and reset the table layout.

### Quick Aggregations

Use the aggregation controls in the Explore group's Data subtab to choose a group column, metric column, count/sum/average/min/max function, and result limit. Parquet-X generates the DuckDB SQL and runs it against `parquet_data`.

### Explore Data

Open the Explore group, then choose the EDA subtab to profile the current query result. Parquet-X summarizes inferred column types, distinct values, missingness, duplicate rows, numeric min/mean/max values, quality checks, and suggested follow-up analysis.

### Create Parquet Files

Open the Transform group, then choose the Create Parquet subtab to create a new `.parquet` file from the current query result, pasted JSON array, or pasted NDJSON stream. Preview the inferred structure, edit output column names and types, choose Snappy, Gzip, Brotli, Zstd, or uncompressed output, set the row group size, and save the new file.

### Export Results

Use the export buttons in the Explore group's Data subtab to save the current query result as:

- CSV
- JSON
- SQLite

Exports respect the active SQL query, so you can filter rows or select columns before saving.

### Edit Data

Open the Transform group, then choose the Edit Data subtab to modify the currently loaded result rows. You can update cell values, add rows, delete rows, reset edits, rename output columns, and save the edited data.

Parquet-X does not overwrite the original file. Edited data is saved as a new `.parquet` file. After saving, open the new Parquet file to view the edited result.

### Compare Files

Open the Compare & Join group, choose the Compare subtab, and select another `.parquet` file.

Smart Diff automatically maps compatible columns, including likely renamed columns, infers a row key, and compares rows by that key so reordered, added, and deleted rows are easier to inspect. The Smart Diff summary shows the inferred key, mapped columns, added rows, deleted rows, changed rows, and unchanged rows.

Strict compare requires both files to have the same columns in the same order. Custom mapping lets you compare selected columns with different names, as long as mapped columns have compatible types.

Before comparing, choose an order column for both files. Rows are sorted by that column and then compared by row order. Mismatched rows and values are highlighted in the comparison table.

### Join Files

Open the Compare & Join group, then choose the Join subtab and select another `.parquet` or `.csv` file. Select the current file key, the join file key, the join type, and the preview row limit.

Supported join types are inner, left, right, and full outer joins. The join preview can be exported as CSV.

### Visualize Results

Open the Explore group, then choose the Visualize subtab to chart the current query result. Charts update when you change the chart type, columns, aggregation, or limit.

Supported charts are bar, line, scatter, and histogram.

### Inspect Schema

Open the Explore group, then choose the Schema subtab to explore:

- Column names and full paths
- Nested parent-child structure
- Physical and logical Parquet types
- Nullable, required, and repeated fields
- Repetition and definition levels
- Decimal precision and scale
- Timestamp unit and timezone interpretation

The Schema subtab can also copy the schema as JSON or generate Markdown documentation.

### Run Parquet Doctor

Open the Quality group, then choose the Doctor subtab and click **Run Doctor Checks** to review diagnostics and suggested fixes. Parquet Doctor includes checks for:

- File integrity and Parquet magic bytes
- Missing footers and unreadable row groups
- Schema consistency and suspicious type annotations
- Row group sizes and compression ratios
- Column statistics, null counts, and constant values
- High-null columns, duplicate rows, empty strings, and suspicious defaults
- Decimal and timestamp metadata issues
- Compression and encoding choices
- Schema drift against a reference file
- Dataset and partition folder health

## Commands

The following commands are available from the Command Palette:

- `Parquet Viewer: Show Parquet Viewer Logs`
- `Parquet Viewer: Setup Python Environment`
- `Parquet Viewer: Reset Python Environment`
- `Refresh`

## Privacy

- Parquet-X processes files locally.
- No file contents are sent to external services.
- The extension only accesses files you open or explicitly choose for compare, join, and diagnostics workflows.
- No telemetry or analytics collection is included.

## Requirements

- Visual Studio Code `1.104.0` or newer.
- A working Python installation. The extension manages its own isolated Python environment for DuckDB and stores it in VS Code global storage for reuse.
- Optional: `uv` on your `PATH` for faster first-time environment creation and DuckDB installation. If `uv` is not available, Parquet-X falls back to Python's built-in `venv` and pip.

## Known Limitations

- The viewer renders a limited number of result rows for UI performance.
- Very large files or broad diagnostics may take longer to process.
- Editing applies to the currently loaded result rows and saves them as a new Parquet file.
- Visualizations use the currently loaded query result rows.
- Join export currently exports the preview rows shown in the Join subtab.
- Some deeply nested schemas may not display as cleanly as flat or moderately nested schemas.
- Dataset scans can take longer on folders with many files.

## Development

Install dependencies:

```sh
npm install
```

Compile the extension:

```sh
npm run compile
```

Copy Python runtime files into `out/`:

```sh
npm run copy-files
```

Run type checking without emitting output:

```sh
npx tsc --noEmit
```

## Contributing

Contributions are welcome. Please keep changes focused, include clear testing notes, and avoid sending sample data that contains private or production information.

Useful contribution areas include performance improvements, nested schema rendering, additional diagnostics, accessibility improvements, and test coverage.

## Issues

Please report bugs and feature requests in the project issue tracker:

https://github.com/akshara-a/Parquet-X/issues

## License

Parquet-X is released under the MIT License. See [LICENSE](LICENSE).
