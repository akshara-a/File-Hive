# Parquet-X

A powerful VS Code extension for viewing and exploring Apache Parquet files directly in your editor.

## Features

- **View Parquet Files** - Open and explore Parquet files with a custom viewer
- **Data Visualization** - Browse your data in a clean, organized interface
- **Fast & Efficient** - Powered by DuckDB for quick data processing
- **Easy Refresh** - Reload data with a single click

## Installation
1. Install the extension from the VS Code Marketplace
2. Open any `.parquet` file - the extension will handle everything automatically

## Usage

### Opening Parquet Files

Simply click on any `.parquet` file in your workspace, and it will open in the Parquet Viewer.

### Commands

Access these commands via the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- **`Parquet Viewer: Show Logs`** - View extension logs for troubleshooting
- **`Refresh`** - Reload the current Parquet file

## How It Works

1. **Native Performance**: Uses DuckDB compiled to WebAssembly for fast data processing
2. **No Setup Required**: Everything works immediately after installation
3. **File Processing**: Uses DuckDB to efficiently read and process Parquet files directly in the browser
4. **Isolated Environment**: Runs securely within VS Code's extension host

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

Found a bug or have a feature request? Please file an issue on our [GitHub repository](To be updated soon).

## Release Notes

### 1.0.0

- Initial release
- Parquet file viewing with DuckDB
- No additional dependencies required
- Custom editor for `.parquet` files

## License

[Soon to be updated]

## Author

**Akshara A**  
Email - akshararajan26@outlook.in

---

**Enjoy exploring your Parquet files!** 