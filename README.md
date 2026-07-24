# Parquet-X

Parquet-X is an open-source Visual Studio Code extension for inspecting Apache Parquet files without leaving your editor. It provides a local viewer for browsing data, running read-only SQL queries, exporting results, comparing files, reviewing schema metadata, and diagnosing common Parquet issues.

All file processing runs locally through DuckDB in an isolated Python environment created by the extension.

## Features

- Open `.parquet` files in a custom VS Code editor.
- Browse rows in a table view with result counts and column counts.
- Run read-only SQL using the `parquet_data` table alias.
- Export the current query result to CSV, JSON, or SQLite.
- Edit loaded result rows and save them as a new Parquet file.
- Compare Parquet files with strict column matching or custom same-type column mapping.
- Inspect schema structure, physical types, logical types, nullability, repetition levels, definition levels, decimals, and timestamps.
- Run Parquet Doctor diagnostics for integrity, schema quality, row groups, statistics, data quality, compression, encoding, schema drift, and dataset partitions.
- Copy schema JSON or generate Markdown schema documentation.

## Installation

Install Parquet-X from the Visual Studio Code Marketplace, then open any `.parquet` file from your workspace.

The extension starts quickly and prewarms its local Python/DuckDB environment in the background after VS Code startup when possible. If that setup cannot run yet, Parquet-X falls back to preparing the environment the first time a Parquet workflow needs it. The prepared environment is stored in VS Code global storage and reused afterward.

## Usage

### Open A Parquet File

Select a `.parquet` file in VS Code. Parquet-X opens it in the custom viewer and renders an initial preview of the data.

### Query Data

Use the SQL editor in the Data tab to query the open file as `parquet_data`.

Only read-only `SELECT` and `WITH` queries are supported.

```sql
SELECT *
FROM parquet_data
WHERE status = 'active'
LIMIT 100;
```

### Export Results

Use the export buttons in the Data tab to save the current query result as:

- CSV
- JSON
- SQLite

Exports respect the active SQL query, so you can filter rows or select columns before saving.

### Edit Data

Open the Edit tab to modify the currently loaded result rows. You can update cell values, add rows, delete rows, reset edits, and save the edited data.

Parquet-X does not overwrite the original file. Edited data is saved as a new `.parquet` file. After saving, open the new Parquet file to view the edited result.

### Compare Files

Open the Compare tab and choose another `.parquet` file.

Strict compare requires both files to have the same columns in the same order. Custom mapping lets you compare selected columns with different names, as long as mapped columns have compatible types.

Before comparing, choose an order column for both files. Rows are sorted by that column and then compared by row order. Mismatched rows and values are highlighted in the comparison table.

### Inspect Schema

Open the Schema tab to explore:

- Column names and full paths
- Nested parent-child structure
- Physical and logical Parquet types
- Nullable, required, and repeated fields
- Repetition and definition levels
- Decimal precision and scale
- Timestamp unit and timezone interpretation

The Schema tab can also copy the schema as JSON or generate Markdown documentation.

### Run Parquet Doctor

Open the Doctor tab to review diagnostics and suggested fixes. Parquet Doctor includes checks for:

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
- The extension only accesses files you open or explicitly choose for compare and diagnostics workflows.
- No telemetry or analytics collection is included.

## Requirements

- Visual Studio Code `1.104.0` or newer.
- A working Python installation. The extension manages its own isolated Python environment for DuckDB and stores it in VS Code global storage for reuse.

## Known Limitations

- The viewer renders a limited number of result rows for UI performance.
- Very large files or broad diagnostics may take longer to process.
- Editing applies to the currently loaded result rows and saves them as a new Parquet file.
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
