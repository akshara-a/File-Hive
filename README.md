# File Hive

File Hive is an open-source Visual Studio Code extension for inspecting local data files without leaving your editor. It provides a local viewer for browsing tabular data, running read-only SQL queries, creating Parquet files, performing exploratory data analysis, exporting results, comparing and joining files, visualizing query results, reviewing schema metadata, and diagnosing common data quality issues.

All file processing runs locally through DuckDB in an isolated Python environment created by the extension. When `uv` is available, File Hive uses it to create the environment and install DuckDB faster, with Python/pip as a fallback.

## Features

- Open `.parquet`, `.duckdb`, `.sqlite`, `.sqlite3`, `.db`, `.csv`, `.tsv`, `.psv`, `.jsonl`, `.ndjson`, `.avro`, `.orc`, `.arrow`, `.feather`, `.ipc`, `.xlsx`, and `.xls` files in a custom VS Code editor.
- **Mount Workspace Database**: Run the `File Hive: Mount Workspace Database` command to instantly turn all supported files in your workspace into queryable views (`SELECT * FROM my_file_csv JOIN my_other_file_parquet`).
- **Pagination**: View massive datasets effortlessly with paginated scrolling.
- Choose tables or views from multi-relation DuckDB and SQLite sources.
- Navigate grouped tabs for Explore, Transform, Export, Compare & Join, and Quality workflows. Tabs and subtabs are shown only when they apply to the loaded file and current result.
- Browse rows in a table view with result counts, column counts, sorting, and column visibility.
- Collapse Data tab controls when you want the table preview to take over the view.
- Reload CSV, TSV, and PSV files with header, delimiter, encoding, quote, escape, and null-string options.
- Reload JSON, JSONL, and NDJSON files with nested-field flattening and record-path selection.
- Run read-only SQL using the `file_data` table alias.
- Build quick group-by aggregations without writing SQL.
- Profile the current query result in the EDA tab with column types, missing values, duplicate rows, numeric summaries, quality checks, and suggested next steps.
- Create Parquet files natively from CSV, DuckDB, JSON, Excel, and other tabular files with editable schema, compression, and row group size controls.
- Export the current query result to any supported target format instantly via DuckDB COPY.
- Edit loaded result rows, rename output columns, and save the result as a new same-format copy.
- Compare supported data files with Smart Diff, strict column matching, or custom same-type column mapping.
- Join the open data file with another supported data file and preview the result.
- Visualize current query results with bar, line, scatter, and histogram charts.
- Inspect schema structure, physical types, logical types, nullability, repetition levels, definition levels, decimals, and timestamps.
- Run File Doctor diagnostics on demand for integrity, schema quality, data quality, schema drift, and dataset partition checks for all tabular formats.
- Copy schema JSON or generate Markdown schema documentation.

## Installation

Install File Hive from the Visual Studio Code Marketplace, then open any supported data file from your workspace.

File Hive activates when you open a supported data file or run setup, and prepares its local Python/DuckDB environment only when needed. Setup reports progress in VS Code notifications, the status bar, and the File Hive output channel while it checks Python, creates the isolated environment, installs DuckDB, and verifies everything is ready. The prepared environment is stored in VS Code global storage and reused afterward.

Marketplace note: File Hive is published as an in-place upgrade of the original Parquet-X extension, so the Marketplace extension ID remains `CosmicTechnoid.parquet-x`.

## Usage

### Open A Data File

Select a supported data file in VS Code. File Hive opens it in the custom viewer and renders an initial preview of the data.

### Query Data

Use the SQL editor in the Explore group's Data subtab to query the open file as `file_data`.

Only read-only `SELECT` and `WITH` queries are supported.

Use **Collapse** in the Data subtab to hide query controls, source options, quick aggregations, and table tools while keeping the current data preview visible.

The older `parquet_data` alias is still available for existing saved queries.

For DuckDB and SQLite files with more than one table or view, use the Table dropdown to choose which relation backs the `file_data` alias.

For CSV, TSV, and PSV files, use the flat-file options in the Data subtab to reload with a header toggle, delimiter override, encoding, quote character, escape character, and null-string value. Use `\t` for a tab delimiter.

For JSONL and NDJSON files, use the JSON options in the Data subtab to flatten nested object fields or choose a record path such as `data.items`.

For `.xlsx` files, use the Excel options in the Data subtab to choose the header row and the row where data starts, then reload the sheet. Type inference is off by default so mixed text/numeric columns still open; enable **Infer types** when the sheet is clean.

For CSV, TSV, PSV, JSONL, and NDJSON files, choose **Open as Text** when direct text editing is a better fit than the viewer.

```sql
SELECT *
FROM file_data
WHERE status = 'active'
LIMIT 100;
```

### Applicable Workflows

File Hive hides workflow tabs when the current source or query result cannot use them.

| Workflow | Applies To | Hidden When |
| --- | --- | --- |
| Tabular data preview and SQL query | Parquet, DuckDB, SQLite, Excel, CSV, TSV, PSV, JSONL, NDJSON, Avro, ORC, Arrow, Feather, IPC, and mounted workspace sources | Sources without tabular data |
| Flat-file reload options | CSV, TSV, and PSV files | Non-delimited sources |
| JSON reload options | JSONL and NDJSON files | Non-JSON sources |
| Excel row options | `.xlsx` files | Non-Excel sources |
| Table dropdown | DuckDB and SQLite files with more than one table or view | Single-table files, flat file formats, or databases with only one relation |
| Table tools and quick aggregation | Current result has columns | The current result has no columns |
| EDA | Current result has rows and columns | The current result is empty or has no columns |
| Visualize | Current result has rows and columns | The current result is empty or has no columns |
| Schema | Schema metadata is available | No schema metadata was returned |
| Edit Data | Current result has columns; saves a new copy in the same source format | The current result has no columns |
| Create Parquet | Current result has columns | The current result has no columns |
| Export | Current result has columns | The current result has no columns |
| Export one table/view | Multi-relation DuckDB and SQLite files | Single-relation sources and flat file formats |
| Export all tables/views as ZIP | Multi-relation DuckDB and SQLite files | Single-relation sources and flat file formats |
| Compare | Current result has columns | The current result has no columns |
| Join | Current result has columns | The current result has no columns |
| Secondary table/view picker | Compare, Join, and Schema Drift when the selected secondary file is multi-relation DuckDB or SQLite | Flat file formats and single-relation database files |
| Generic Doctor checks | Successfully loaded tabular sources | Markdown and files that cannot be loaded |
| Schema Drift | Successfully loaded tabular sources | Markdown and files that cannot be loaded |
| Parquet row groups, column statistics, compression/encoding, decimal/timestamp diagnostics, and dataset scan | Parquet files | Non-Parquet sources |

### Refine The Table View

Use the table tools in the Explore group's Data subtab to sort rows, choose visible columns from a dropdown, show all columns again, and reset the table layout.

### Quick Aggregations

Use the aggregation controls in the Explore group's Data subtab to choose a group column, function, optional metric column, and result limit. Count ignores the metric and counts rows with `COUNT(*)`; sum, average, min, and max require a numeric metric column. File Hive generates the DuckDB SQL and runs it against `file_data`.

### Explore Data

Open the Explore group, then choose the EDA subtab to profile the current query result. File Hive summarizes inferred column types, distinct values, missingness, duplicate rows, numeric min/mean/max values, quality checks, and suggested follow-up analysis.

### Create Parquet Files

Open the Transform group, then choose the Create Parquet subtab to create a new `.parquet` file from the current query result, pasted JSON array, or pasted NDJSON stream. Preview the inferred structure, edit output column names and types, choose Snappy, Gzip, Brotli, Zstd, or uncompressed output, set the row group size, and save the new file.

### Export Results

Open the Export tab to save the current query result as another supported format.

Exports respect the active SQL query, so you can filter rows or select columns before saving.

For each source file, File Hive hides only the matching output format and keeps every other supported target available. For example, a `.parquet` file can export to DuckDB, SQLite, CSV, TSV, PSV, JSON, JSONL, NDJSON, Avro, ORC, Arrow, Feather, and IPC; a `.duckdb` file can export to the same set except DuckDB. Multi-table databases can export the current SQL result, one selected table/view, or every table/view as separate files in a ZIP archive.

### Edit Data

Open the Transform group, then choose the Edit Data subtab to modify the currently loaded result rows. You can update cell values, add rows, delete rows, reset edits, rename output columns, and save the edited data as a new copy of the current source format.

File Hive does not overwrite the original file. Use Export when you want to convert the edited query result into another format.

### Compare Files

Open the Compare & Join group, choose the Compare subtab, and select another supported data file.

When the open file or compare file is a multi-relation DuckDB or SQLite database, File Hive compares the selected table or view. The open file uses the Data tab's active Table selection, and the compare file prompts you to choose a table or view after picking the file.

Smart Diff automatically maps compatible columns, including likely renamed columns, infers a row key, and compares rows by that key so reordered, added, and deleted rows are easier to inspect. The Smart Diff summary shows the inferred key, mapped columns, added rows, deleted rows, changed rows, and unchanged rows.

Strict compare requires both files to have the same columns in the same order. Custom mapping lets you compare selected columns with different names, as long as mapped columns have compatible types.

Before comparing, choose an order column for both files. Rows are sorted by that column and then compared by row order. Mismatched rows and values are highlighted in the comparison table.

### Join Files

Open the Compare & Join group, then choose the Join subtab and select another supported data file. Select the current file key, the join file key, the join type, and the preview row limit.

When the join file is a multi-relation DuckDB or SQLite database, File Hive prompts you to choose the table or view to join with. The open file uses the Data tab's active Table selection.

Supported join types are inner, left, right, and full outer joins. The join preview can be exported as CSV.

### Visualize Results

Open the Explore group, then choose the Visualize subtab to chart the current query result. Charts update when you change the chart type, columns, aggregation, or limit.

Supported charts are bar, line, scatter, and histogram.

### Inspect Schema

Open the Explore group, then choose the Schema subtab to explore:

- Column names and full paths
- Nested parent-child structure
- Physical, logical, or inferred DuckDB types where available
- Nullable, required, and repeated fields
- Repetition and definition levels
- Decimal precision and scale
- Timestamp unit and timezone interpretation

The Schema subtab can also copy the schema as JSON or generate Markdown documentation.

### Run File Doctor

Open the Quality group, then choose the Doctor subtab and click **Run Doctor Checks** to review diagnostics and suggested fixes. File Doctor includes checks for:

- File integrity and format-specific readability checks
- Schema consistency and suspicious type annotations
- High-null columns, duplicate rows, empty strings, and suspicious defaults
- Schema drift against a reference file
- Parquet row group sizes, missing footers, unreadable row groups, column statistics, compression ratios, decimal and timestamp metadata, and dataset partition health

When a schema drift reference file is a multi-relation DuckDB or SQLite database, File Hive prompts you to choose the reference table or view. The open file uses the Data tab's active Table selection.

## Commands

The following commands are available from the Command Palette:

- `File Hive: Show File Hive Logs`
- `File Hive: Setup Python Environment`
- `File Hive: Reset Python Environment`
- `File Hive: Show Environment Doctor`
- `Refresh`

## Privacy

- File Hive processes files locally.
- No file contents are sent to external services.
- The extension only accesses files you open or explicitly choose for compare, join, and diagnostics workflows.
- No telemetry or analytics collection is included.

## Requirements

- Visual Studio Code `1.104.0` or newer.
- A working Python installation. The extension manages its own isolated Python environment for DuckDB and stores it in VS Code global storage for reuse.
- Optional: `uv` on your `PATH` for faster first-time environment creation and data package installation. If `uv` is not available, File Hive falls back to Python's built-in `venv` and pip.

## Known Limitations

- The viewer renders a limited number of result rows for UI performance.
- Very large files or broad diagnostics may take longer to process.
- Editing applies to the currently loaded result rows and saves them as a new file.
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

https://github.com/akshara-a/File-Hive/issues

## License

File Hive is released under the MIT License. See [LICENSE](LICENSE).
