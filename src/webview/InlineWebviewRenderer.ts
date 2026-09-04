import * as vscode from 'vscode';
import { IWebviewRenderer } from '../interfaces/IWebviewRenderer';
import { NONCE_STRING_POSSIBLE } from '../common/constant';

export class InlineWebviewRenderer implements IWebviewRenderer {

    getWebviewContent(webview: vscode.Webview, data: any): string {
        const nonce = this.getNonce();
        const javaScriptContent = this.getJavaScriptContent();
        const cssContent = this.getCssContent();

        return this.generateHtml(nonce, javaScriptContent, cssContent, data);
    }

    private generateHtml(nonce: string, jsContent: string, cssContent: string, data: any): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <style>${cssContent}</style>
            <title>Data File Viewer</title>
        </head>
        <body>
            <div class="container">
                ${this.generateHeader(data)}
                ${this.generateViewTabs()}
                ${this.generateErrorContainer()}
                ${this.generateLoadingContainer()}
                <div id="data-view" class="view-panel">
                    ${this.generateQueryContainer()}
                    ${this.generateTextPreviewContainer()}
                    ${this.generateDataContainer()}
                </div>
                ${this.generateEdaContainer()}
                ${this.generateWriteContainer()}
                ${this.generateExportContainer()}
                ${this.generateEditContainer()}
                ${this.generateSchemaContainer()}
                ${this.generateDoctorContainer()}
                ${this.generateCompareContainer()}
                ${this.generateJoinContainer()}
                ${this.generateVisualizerContainer()}
            </div>

            <script nonce="${nonce}">
                ${jsContent}
                
                // Initialize with data
                const initialData = ${JSON.stringify(data)};
                initialize(initialData);
            </script>
        </body>
        </html>`;
    }

    private generateHeader(data: any): string {
        const fileType = this.formatFileTypeLabel(data?.fileType);

        return `
        <header class="header">
            <div class="header-title">
                <h1>Data File Viewer</h1>
                <span id="source-type" class="source-pill">${fileType}</span>
            </div>
            <div class="controls">
                <button id="header-open-text-editor-btn" class="btn btn-secondary hidden">Open as Text</button>
                <button id="refresh-btn" class="btn">
                    <span class="icon">↻</span> Refresh
                </button>
                <span id="status" class="status status-loading">Loading...</span>
            </div>
        </header>`;
    }

    private formatFileTypeLabel(fileType: unknown): string {
        const normalizedFileType = String(fileType || '').toLowerCase();
        if (normalizedFileType === 'duckdb') {
            return 'DuckDB';
        }
        if (normalizedFileType === 'sqlite') {
            return 'SQLite';
        }
        if (normalizedFileType === 'csv') {
            return 'CSV';
        }
        if (normalizedFileType === 'tsv') {
            return 'TSV';
        }
        if (normalizedFileType === 'psv') {
            return 'PSV';
        }
        if (normalizedFileType === 'json') {
            return 'JSON';
        }
        if (normalizedFileType === 'avro') {
            return 'Avro';
        }
        if (normalizedFileType === 'orc') {
            return 'ORC';
        }
        if (normalizedFileType === 'arrow') {
            return 'Arrow';
        }
        if (normalizedFileType === 'feather') {
            return 'Feather';
        }
        if (normalizedFileType === 'ipc') {
            return 'IPC';
        }
        if (normalizedFileType === 'excel' || normalizedFileType === 'xlsx' || normalizedFileType === 'xls') {
            return 'Excel';
        }
        if (normalizedFileType === 'sqlite3') {
            return 'SQLite';
        }
        if (normalizedFileType === 'workspace') {
            return 'Workspace';
        }
        return 'Parquet';
    }

    private generateViewTabs(): string {
        return `
        <nav class="view-navigation" aria-label="File Hive sections">
            <div class="view-tabs primary-tabs" role="tablist" aria-label="Feature groups">
                <button id="explore-tab" class="tab-btn primary-tab active" data-view-group="explore" role="tab" aria-selected="true">Explore</button>
                <button id="transform-tab" class="tab-btn primary-tab" data-view-group="transform" role="tab" aria-selected="false">Transform</button>
                <button id="export-tab" class="tab-btn primary-tab" data-view-group="export" role="tab" aria-selected="false">Export</button>
                <button id="combine-tab" class="tab-btn primary-tab" data-view-group="combine" role="tab" aria-selected="false">Compare &amp; Join</button>
                <button id="quality-tab" class="tab-btn primary-tab" data-view-group="quality" role="tab" aria-selected="false">Quality</button>
            </div>
            <div class="subtabs" aria-label="Feature subtabs">
                <div class="subtab-group" data-tab-group="explore" role="tablist">
                    <button id="data-tab" class="tab-btn subtab-btn active" role="tab" aria-selected="true">Data</button>
                    <button id="eda-tab" class="tab-btn subtab-btn" role="tab" aria-selected="false">EDA</button>
                    <button id="visualizer-tab" class="tab-btn subtab-btn" role="tab" aria-selected="false">Visualize</button>
                    <button id="schema-tab" class="tab-btn subtab-btn" role="tab" aria-selected="false">Schema</button>
                </div>
                <div class="subtab-group hidden" data-tab-group="transform" role="tablist">
                    <button id="edit-tab" class="tab-btn subtab-btn" role="tab" aria-selected="false">Edit Data</button>
                    <button id="write-tab" class="tab-btn subtab-btn" role="tab" aria-selected="false">Create Parquet</button>
                </div>
                <div class="subtab-group hidden" data-tab-group="combine" role="tablist">
                    <button id="compare-tab" class="tab-btn subtab-btn" role="tab" aria-selected="false">Compare</button>
                    <button id="join-tab" class="tab-btn subtab-btn" role="tab" aria-selected="false">Join</button>
                </div>
                <div class="subtab-group hidden" data-tab-group="quality" role="tablist">
                    <button id="doctor-tab" class="tab-btn subtab-btn" role="tab" aria-selected="false">Doctor</button>
                </div>
            </div>
        </nav>`;
    }

    private generateWriteContainer(): string {
        return `
        <section id="write-container" class="write-container view-panel hidden">
            <div class="write-toolbar">
                <div>
                    <h2>Create Parquet</h2>
                    <p>Create a new Parquet file from pasted JSON, NDJSON, or the current query result.</p>
                </div>
                <button id="write-create-btn" class="btn">Create Parquet</button>
            </div>
            <div class="write-controls">
                <label>
                    Source
                    <select id="write-source">
                        <option value="current">Current Result</option>
                        <option value="json">JSON Array</option>
                        <option value="ndjson">NDJSON Stream</option>
                    </select>
                </label>
                <label>
                    Compression
                    <select id="write-compression">
                        <option value="snappy">Snappy</option>
                        <option value="zstd">Zstd</option>
                        <option value="gzip">Gzip</option>
                        <option value="brotli">Brotli</option>
                        <option value="uncompressed">Uncompressed</option>
                    </select>
                </label>
                <label>
                    Row Group Size
                    <input id="write-row-group-size" type="number" min="1" max="10000000" value="100000" />
                </label>
                <button id="write-preview-btn" class="btn btn-secondary">Preview Structure</button>
            </div>
            <textarea id="write-json-input" spellcheck="false" placeholder='[{"id":1,"name":"Ada","score":98.5}]'></textarea>
            <div id="write-message" class="write-message hidden"></div>
            <div class="write-summary">
                <div class="summary-item">Rows: <span id="write-row-count">0</span></div>
                <div class="summary-item">Columns: <span id="write-column-count">0</span></div>
                <div class="summary-item">Compression: <span id="write-compression-summary">Snappy</span></div>
                <div class="summary-item">Row Group Size: <span id="write-row-group-summary">100,000</span></div>
            </div>
            <section class="write-panel">
                <h3>Structure</h3>
                <div class="write-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Source</th>
                                <th>Parquet Column</th>
                                <th>Type</th>
                                <th>Sample</th>
                                <th>Nulls</th>
                            </tr>
                        </thead>
                        <tbody id="write-schema-body"></tbody>
                    </table>
                </div>
            </section>
        </section>`;
    }

    private generateExportContainer(): string {
        const exportFormats = [
            { format: 'csv', label: 'CSV', detail: '.csv' },
            { format: 'tsv', label: 'TSV', detail: '.tsv' },
            { format: 'psv', label: 'PSV', detail: '.psv' },
            { format: 'json', label: 'JSON', detail: '.json' },
            { format: 'jsonl', label: 'JSONL', detail: '.jsonl' },
            { format: 'ndjson', label: 'NDJSON', detail: '.ndjson' },
            { format: 'parquet', label: 'Parquet', detail: '.parquet' },
            { format: 'duckdb', label: 'DuckDB', detail: '.duckdb' },
            { format: 'avro', label: 'Avro', detail: '.avro' },
            { format: 'orc', label: 'ORC', detail: '.orc' },
            { format: 'arrow', label: 'Arrow', detail: '.arrow' },
            { format: 'feather', label: 'Feather', detail: '.feather' },
            { format: 'ipc', label: 'IPC', detail: '.ipc' },
            { format: 'sqlite', label: 'SQLite', detail: '.sqlite' }
        ];

        return `
        <section id="export-container" class="export-container view-panel hidden">
            <div class="export-toolbar">
                <div>
                    <h2>Export</h2>
                    <p>Convert the current SQL result into another file format.</p>
                </div>
            </div>
            <div class="export-summary">
                <div class="summary-item">Source: <span id="export-source-type">-</span></div>
                <div class="summary-item">Rows: <span id="export-row-count">0</span></div>
                <div class="summary-item export-query-summary">Query: <code id="export-query-summary">SELECT * FROM file_data</code></div>
            </div>
            <div class="export-grid">
                ${exportFormats.map((item) => `
                    <button class="export-option" data-export-format="${item.format}" type="button">
                        <span class="export-option-label">${item.label}</span>
                        <span class="export-option-detail">${item.detail}</span>
                    </button>
                `).join('')}
            </div>
            <div id="export-message" class="export-message hidden"></div>
        </section>`;
    }

    private generateEdaContainer(): string {
        return `
        <section id="eda-container" class="eda-container view-panel hidden">
            <div class="eda-toolbar">
                <div>
                    <h2>Exploratory Data Analysis</h2>
                    <p>Profile the current query result and surface useful next checks.</p>
                </div>
            </div>
            <div class="eda-summary">
                <div class="summary-item">Rows: <span id="eda-row-count">0</span></div>
                <div class="summary-item">Columns: <span id="eda-column-count">0</span></div>
                <div class="summary-item">Numeric: <span id="eda-numeric-count">0</span></div>
                <div class="summary-item">Missing Cells: <span id="eda-missing-count">0</span></div>
                <div class="summary-item">Duplicate Rows: <span id="eda-duplicate-count">0</span></div>
            </div>
            <div class="eda-grid">
                <section class="eda-panel">
                    <h3>Suggestions</h3>
                    <div id="eda-suggestions" class="eda-list"></div>
                </section>
                <section class="eda-panel">
                    <h3>Data Quality</h3>
                    <div id="eda-quality" class="eda-list"></div>
                </section>
                <section class="eda-panel">
                    <h3>Numeric Summary</h3>
                    <div class="eda-table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Column</th>
                                    <th>Missing</th>
                                    <th>Mean</th>
                                    <th>Min</th>
                                    <th>Max</th>
                                </tr>
                            </thead>
                            <tbody id="eda-numeric-body"></tbody>
                        </table>
                    </div>
                </section>
                <section class="eda-panel">
                    <h3>Column Profile</h3>
                    <div class="eda-table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Column</th>
                                    <th>Type</th>
                                    <th>Distinct</th>
                                    <th>Missing</th>
                                    <th>Top Values</th>
                                </tr>
                            </thead>
                            <tbody id="eda-profile-body"></tbody>
                        </table>
                    </div>
                </section>
            </div>
        </section>`;
    }

    private generateDoctorContainer(): string {
        return `
        <section id="doctor-container" class="doctor-container view-panel hidden">
            <div class="doctor-hero">
                <div>
                    <h2>File Doctor</h2>
                    <p>Integrity, schema, row group, statistics, data quality, compression, and dataset diagnostics.</p>
                </div>
                <div class="doctor-actions">
                    <button id="doctor-run-btn" class="btn">Run Doctor Checks</button>
                    <button id="doctor-schema-drift-btn" class="btn btn-secondary">Schema Drift</button>
                    <button id="doctor-dataset-scan-btn" class="btn btn-secondary">Scan Dataset</button>
                </div>
                <div class="doctor-score">
                    <span id="doctor-health-score">0</span>
                    <small>Health Score</small>
                </div>
            </div>
            <div class="doctor-summary">
                <div class="summary-item">Errors: <span id="doctor-error-count">0</span></div>
                <div class="summary-item">Warnings: <span id="doctor-warning-count">0</span></div>
                <div class="summary-item">Passed: <span id="doctor-pass-count">0</span></div>
            </div>
            <div class="doctor-grid">
                <section class="doctor-panel">
                    <h3>File Integrity Check</h3>
                    <div id="doctor-integrity"></div>
                </section>
                <section class="doctor-panel">
                    <h3>Health Report with Suggested Fixes</h3>
                    <div id="doctor-health-report"></div>
                </section>
                <section class="doctor-panel">
                    <h3>Schema Validation</h3>
                    <div id="doctor-schema-validation"></div>
                </section>
                <section class="doctor-panel" data-format-scope="parquet">
                    <h3>Column Statistics Check</h3>
                    <div id="doctor-column-statistics"></div>
                </section>
                <section class="doctor-panel">
                    <h3>Data Quality Validation</h3>
                    <div id="doctor-data-quality"></div>
                </section>
                <section class="doctor-panel" data-format-scope="parquet">
                    <h3>Decimal and Timestamp Diagnostics</h3>
                    <div id="doctor-decimal-timestamp"></div>
                </section>
                <section class="doctor-panel" data-format-scope="parquet">
                    <h3>Compression and Encoding Analysis</h3>
                    <div id="doctor-compression-encoding"></div>
                </section>
                <section class="doctor-panel">
                    <h3>Schema Drift Detection</h3>
                    <div id="doctor-schema-drift"></div>
                </section>
            </div>
            <section class="doctor-panel doctor-row-groups-panel" data-format-scope="parquet">
                <h3>Row Group Analysis</h3>
                <div id="doctor-row-groups"></div>
            </section>
            <section class="doctor-panel doctor-row-groups-panel" data-format-scope="parquet">
                <h3>Dataset and Partition Analysis</h3>
                <div id="doctor-dataset-analysis"></div>
            </section>
        </section>`;
    }

    private generateVisualizerContainer(): string {
        return `
        <section id="visualizer-container" class="visualizer-container view-panel hidden">
            <div class="visualizer-toolbar">
                <div>
                    <h2>Data Visualizer</h2>
                    <p>Chart the current query result locally.</p>
                </div>
                <div class="visualizer-controls">
                    <label>
                        Chart
                        <select id="visualizer-chart-type">
                            <option value="bar">Bar</option>
                            <option value="line">Line</option>
                            <option value="scatter">Scatter</option>
                            <option value="histogram">Histogram</option>
                        </select>
                    </label>
                    <label>
                        X
                        <select id="visualizer-x-column"></select>
                    </label>
                    <label>
                        Y
                        <select id="visualizer-y-column"></select>
                    </label>
                    <label>
                        Aggregate
                        <select id="visualizer-aggregation">
                            <option value="count">Count</option>
                            <option value="sum">Sum</option>
                            <option value="avg">Average</option>
                            <option value="min">Min</option>
                            <option value="max">Max</option>
                        </select>
                    </label>
                    <label>
                        Limit
                        <input id="visualizer-limit" type="number" min="5" max="100" value="25" />
                    </label>
                </div>
            </div>
            <div class="visualizer-summary">
                <div class="summary-item">Rows: <span id="visualizer-row-count">0</span></div>
                <div class="summary-item">Points: <span id="visualizer-point-count">0</span></div>
                <div class="summary-item">Mode: <span id="visualizer-mode">-</span></div>
            </div>
            <div id="visualizer-message" class="visualizer-message hidden"></div>
            <div class="visualizer-chart-wrap">
                <svg id="visualizer-chart" viewBox="0 0 900 420" role="img" aria-label="Data chart"></svg>
            </div>
        </section>`;
    }

    private generateQueryContainer(): string {
        return `
        <section id="query-container" class="query-container">
            <div class="query-toolbar">
                <label for="query-input">SQL Query</label>
                <div class="query-actions">
                    <button id="data-controls-toggle-btn" class="btn btn-secondary" type="button" aria-expanded="true">Collapse</button>
                    <button id="open-text-editor-btn" class="btn btn-secondary hidden">Open as Text</button>
                    <button id="run-query-btn" class="btn">Run Query</button>
                    <button id="reset-query-btn" class="btn btn-secondary">Reset</button>
                </div>
            </div>
            <div id="data-controls-body" class="data-controls-body">
                <textarea id="query-input" spellcheck="false">SELECT * FROM file_data</textarea>
                <div class="query-meta">
                    Table: <code>file_data</code>
                    <label id="relation-picker-wrap" class="relation-picker hidden">
                        Table
                        <select id="relation-picker"></select>
                    </label>
                    <span id="query-limit-message" class="hidden">Showing first 1000 rows.</span>
                    <div class="pagination-controls hidden" id="pagination-controls" style="display: inline-flex; align-items: center; gap: 8px; margin-left: auto;">
                        <button id="prev-page-btn" class="btn btn-secondary btn-sm" disabled>&lt; Prev</button>
                        <span id="page-info">1 - 1000</span>
                        <button id="next-page-btn" class="btn btn-secondary btn-sm">&gt; Next</button>
                        <select id="page-size-select" style="margin-left: 8px;">
                            <option value="100">100</option>
                            <option value="500">500</option>
                            <option value="1000" selected>1000</option>
                            <option value="5000">5000</option>
                        </select>
                    </div>
                </div>
                <div id="flat-file-options" class="flat-file-options hidden">
                    <label class="flat-file-header-toggle">
                        <input id="flat-file-header" type="checkbox" checked />
                        Header row
                    </label>
                    <label>
                        Delimiter
                        <input id="flat-file-delimiter" type="text" maxlength="8" />
                    </label>
                    <label>
                        Encoding
                        <select id="flat-file-encoding">
                            <option value="utf-8">UTF-8</option>
                            <option value="latin-1">Latin-1</option>
                            <option value="utf-16">UTF-16</option>
                        </select>
                    </label>
                    <label>
                        Quote
                        <input id="flat-file-quote" type="text" maxlength="1" value="&quot;" />
                    </label>
                    <label>
                        Escape
                        <input id="flat-file-escape" type="text" maxlength="1" value="&quot;" />
                    </label>
                    <label>
                        Null
                        <input id="flat-file-null" type="text" maxlength="64" />
                    </label>
                    <div class="flat-file-actions">
                        <button id="apply-flat-file-options-btn" class="btn btn-secondary">Reload</button>
                        <button id="reset-flat-file-options-btn" class="btn btn-secondary">Reset Options</button>
                    </div>
                </div>
                <div id="json-file-options" class="json-file-options hidden">
                    <label class="json-flatten-toggle">
                        <input id="json-flatten" type="checkbox" />
                        Flatten nested fields
                    </label>
                    <label>
                        Record path
                        <input id="json-record-path" type="text" maxlength="240" placeholder="data.items" />
                    </label>
                    <div class="json-file-actions">
                        <button id="apply-json-options-btn" class="btn btn-secondary">Reload</button>
                        <button id="reset-json-options-btn" class="btn btn-secondary">Reset Options</button>
                    </div>
                </div>
                <div id="excel-file-options" class="excel-file-options hidden">
                    <label>
                        Header row
                        <input id="excel-header-row" type="number" min="0" max="1048576" value="1" />
                    </label>
                    <label>
                        Data starts
                        <input id="excel-data-start-row" type="number" min="1" max="1048576" value="2" />
                    </label>
                    <label class="excel-infer-toggle">
                        <input id="excel-infer-types" type="checkbox" />
                        Infer types
                    </label>
                    <div class="excel-file-actions">
                        <button id="apply-excel-options-btn" class="btn btn-secondary">Reload</button>
                        <button id="reset-excel-options-btn" class="btn btn-secondary">Reset Options</button>
                    </div>
                </div>
                <div class="quick-aggregation" data-capability-scope="columns">
                    <label>
                        Group
                        <select id="aggregation-group-column"></select>
                    </label>
                    <label id="aggregation-value-column-label">
                        Metric
                        <select id="aggregation-value-column"></select>
                    </label>
                    <label>
                        Function
                        <select id="aggregation-function">
                            <option value="count">Count</option>
                            <option value="sum">Sum</option>
                            <option value="avg">Average</option>
                            <option value="min">Min</option>
                            <option value="max">Max</option>
                        </select>
                    </label>
                    <label>
                        Limit
                        <input id="aggregation-limit" type="number" min="1" max="1000" value="100" />
                    </label>
                    <div class="aggregation-actions">
                        <button id="run-aggregation-btn" class="btn btn-secondary">Run Aggregation</button>
                        <button id="reset-aggregation-btn" class="btn btn-secondary">Reset</button>
                    </div>
                </div>
            </div>
        </section>`;
    }

    private generateTextPreviewContainer(): string {
        return `
        <section id="text-preview-container" class="text-preview-container hidden">
            <div class="text-preview-summary">
                <div class="summary-item">Lines: <span id="text-preview-lines">0</span></div>
                <div class="summary-item">Size: <span id="text-preview-size">0 B</span></div>
                <div id="text-preview-truncated" class="summary-item hidden">Preview truncated</div>
            </div>
            <pre id="text-preview-content" class="text-preview-content"></pre>
        </section>`;
    }

    private generateCompareContainer(): string {
        return `
        <section id="compare-container" class="compare-container view-panel hidden">
            <div class="compare-toolbar">
                <div>
                    <h2>Compare Data Files</h2>
                    <p>Smart Diff auto-maps renamed columns and matches reordered rows by an inferred key. Strict and custom modes remain available for exact checks.</p>
                </div>
                <div class="compare-actions">
                    <label class="compare-toggle">
                        <input id="custom-compare-toggle" type="checkbox" />
                        Custom mapping
                    </label>
                    <button id="select-compare-file-btn" class="btn">Choose Compare File</button>
                    <button id="run-smart-diff-btn" class="btn">Run Smart Diff</button>
                    <button id="run-strict-compare-btn" class="btn btn-secondary">Run Strict Compare</button>
                    <button id="run-custom-compare-btn" class="btn btn-secondary hidden">Run Custom Compare</button>
                </div>
            </div>
            <div id="compare-error" class="compare-error hidden"></div>
            <div id="compare-smart-summary" class="compare-smart-summary hidden">
                <div class="smart-summary-header">
                    <h3>Smart Diff Plan</h3>
                    <span id="smart-diff-key">Key: -</span>
                </div>
                <div class="smart-summary-grid">
                    <div class="summary-item">Mapped Columns: <span id="smart-mapped-columns">0</span></div>
                    <div class="summary-item">Auto Rename Matches: <span id="smart-fuzzy-columns">0</span></div>
                    <div class="summary-item">Added Rows: <span id="smart-inserted-rows">0</span></div>
                    <div class="summary-item">Deleted Rows: <span id="smart-deleted-rows">0</span></div>
                    <div class="summary-item">Changed Rows: <span id="smart-changed-rows">0</span></div>
                    <div class="summary-item">Unchanged Rows: <span id="smart-unchanged-rows">0</span></div>
                </div>
                <div id="smart-skipped-columns" class="smart-skipped-columns hidden"></div>
            </div>
            <div id="compare-order-panel" class="compare-order-panel hidden">
                <h3>Order Rows By</h3>
                <div class="compare-order-controls">
                    <label>
                        Current file column
                        <select id="compare-base-order-select"></select>
                    </label>
                    <label>
                        Compare file column
                        <select id="compare-other-order-select"></select>
                    </label>
                </div>
            </div>
            <div id="compare-mapping-panel" class="compare-mapping-panel hidden">
                <div class="compare-mapping-header">
                    <h3>Custom Column Mapping</h3>
                    <span id="compare-selected-file">No compare file selected</span>
                </div>
                <div class="compare-column-lists">
                    <div>
                        <h4>Current File Columns</h4>
                        <div id="compare-base-column-list" class="compare-column-list"></div>
                    </div>
                    <div>
                        <h4>Compare File Columns</h4>
                        <div id="compare-other-column-list" class="compare-column-list"></div>
                    </div>
                </div>
                <div id="compare-mapping-list" class="compare-mapping-list"></div>
            </div>
            <div id="compare-summary" class="compare-summary hidden">
                <div class="summary-item">Base Rows: <span id="compare-base-rows">0</span></div>
                <div class="summary-item">Compare Rows: <span id="compare-other-rows">0</span></div>
                <div class="summary-item">Rows Checked: <span id="compare-rows-checked">0</span></div>
                <div class="summary-item">Mismatched Rows: <span id="compare-mismatch-count">0</span></div>
            </div>
            <div id="compare-empty" class="empty-value">Choose another data file to compare.</div>
            <div id="compare-results" class="compare-results hidden">
                <div class="compare-pane">
                    <h3>Current File</h3>
                    <div class="compare-table-wrap">
                        <table>
                            <thead id="compare-base-header"></thead>
                            <tbody id="compare-base-body"></tbody>
                        </table>
                    </div>
                </div>
                <div class="compare-pane">
                    <h3>Compare File</h3>
                    <div class="compare-table-wrap">
                        <table>
                            <thead id="compare-other-header"></thead>
                            <tbody id="compare-other-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>`;
    }

    private generateJoinContainer(): string {
        return `
        <section id="join-container" class="join-container view-panel hidden">
            <div class="join-toolbar">
                <div>
                    <h2>Join Data Files</h2>
                    <p>Join the current data file with another supported data file.</p>
                </div>
                <div class="join-actions">
                    <button id="select-join-file-btn" class="btn">Choose Join File</button>
                    <button id="run-join-btn" class="btn btn-secondary">Preview Join</button>
                    <button id="export-join-preview-btn" class="btn btn-secondary">Export Preview CSV</button>
                </div>
            </div>
            <div id="join-error" class="join-error hidden"></div>
            <div id="join-controls" class="join-controls hidden">
                <label>
                    Current file key
                    <select id="join-base-column"></select>
                </label>
                <label>
                    Join file key
                    <select id="join-other-column"></select>
                </label>
                <label>
                    Type
                    <select id="join-type">
                        <option value="inner">Inner</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="full">Full Outer</option>
                    </select>
                </label>
                <label>
                    Preview Rows
                    <input id="join-limit" type="number" min="1" max="1000" value="100" />
                </label>
            </div>
            <div id="join-summary" class="join-summary hidden">
                <div class="summary-item">Join File: <span id="join-selected-file">None</span></div>
                <div class="summary-item">Rows: <span id="join-row-count">0</span></div>
                <div class="summary-item">Total: <span id="join-total-rows">0</span></div>
                <div class="summary-item">Columns: <span id="join-column-count">0</span></div>
            </div>
            <div id="join-empty" class="empty-value">Choose another supported data file to join.</div>
            <div id="join-results" class="join-results hidden">
                <table>
                    <thead id="join-table-header"></thead>
                    <tbody id="join-table-body"></tbody>
                </table>
            </div>
        </section>`;
    }

    private generateErrorContainer(): string {
        return `
        <div id="error-container" class="error-container hidden">
            <div class="error-message">
                <h3>Error Reading Data File</h3>
                <p id="error-text"></p>
            </div>
        </div>`;
    }

    private generateLoadingContainer(): string {
        return `
        <div id="loading-container" class="loading-container">
            <div class="loading-spinner"></div>
            <div>Loading data file...</div>
        </div>`;
    }

    private generateDataContainer(): string {
        return `
        <div id="data-container" class="data-container hidden">
            <div class="summary">
                <div class="summary-item">Result Rows: <span id="total-rows">0</span></div>
                <div class="summary-item">Showing: <span id="showing-rows">0</span> rows</div>
                <div class="summary-item">Columns: <span id="column-count">0</span></div>
            </div>
            <div class="table-tools" data-capability-scope="columns">
                <label>
                    Sort
                    <select id="table-sort-column"></select>
                </label>
                <label>
                    Direction
                    <select id="table-sort-direction">
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </label>
                <div class="table-column-picker">
                    <label for="column-picker-toggle">Columns</label>
                    <button id="column-picker-toggle" class="column-picker-toggle" type="button">
                        <span id="column-picker-summary">Columns</span>
                        <span class="column-picker-caret">v</span>
                    </button>
                    <div id="column-picker-menu" class="column-picker-menu hidden">
                        <div id="column-picker-list" class="column-picker-list"></div>
                    </div>
                </div>
                <div class="table-tool-actions">
                    <button id="show-all-columns-btn" class="btn btn-secondary">Show All</button>
                    <button id="reset-table-view-btn" class="btn btn-secondary">Reset View</button>
                </div>
            </div>
            
            <div class="table-container">
                <table id="data-table">
                    <thead id="table-header"></thead>
                    <tbody id="table-body"></tbody>
                </table>
            </div>
        </div>`;
    }

    private generateEditContainer(): string {
        return `
        <section id="edit-container" class="edit-container view-panel hidden">
            <div class="edit-toolbar">
                <div>
                    <h2>Edit Result</h2>
                    <p>Edits are saved as a new file in the format you choose.</p>
                </div>
                <div class="edit-actions">
                    <button id="add-edit-row-btn" class="btn btn-secondary">Add Row</button>
                    <button id="reset-edits-btn" class="btn btn-secondary">Reset Edits</button>
                    <button id="save-edits-btn" class="btn">Save As...</button>
                </div>
            </div>
            <div class="edit-column-tools">
                <div>
                    <h3>Column Names</h3>
                    <p>Rename columns here before saving the edited result.</p>
                </div>
                <button id="reset-column-names-btn" class="btn btn-secondary">Reset Names</button>
            </div>
            <div class="edit-summary">
                <div class="summary-item">Editable Rows: <span id="edit-row-count">0</span></div>
                <div class="summary-item">Columns: <span id="edit-column-count">0</span></div>
                <div class="summary-item">Changes: <span id="edit-change-count">0</span></div>
                <div class="summary-item">Renamed Columns: <span id="edit-renamed-column-count">0</span></div>
            </div>
            <div id="edit-result-message" class="edit-message hidden"></div>
            <div class="edit-table-container">
                <table id="edit-table">
                    <thead id="edit-table-header"></thead>
                    <tbody id="edit-table-body"></tbody>
                </table>
            </div>
        </section>`;
    }

    private generateSchemaContainer(): string {
        return `
        <section id="schema-container" class="schema-container view-panel hidden">
            <div class="schema-toolbar">
                <div class="schema-search">
                    <label for="schema-search-input">Search Columns</label>
                    <input id="schema-search-input" type="search" placeholder="Column name, path, type" />
                </div>
                <div class="schema-actions">
                    <button id="copy-schema-json-btn" class="btn">Copy JSON</button>
                    <button id="generate-schema-docs-btn" class="btn btn-secondary">Generate Documentation</button>
                </div>
            </div>
            <div class="schema-summary">
                <div class="summary-item">Columns: <span id="schema-column-count">0</span></div>
                <div class="summary-item">Nested Fields: <span id="schema-nested-count">0</span></div>
            </div>
            <div class="schema-layout">
                <div class="schema-tree-panel">
                    <h2>Nested Structure</h2>
                    <div id="schema-tree"></div>
                </div>
                <div class="schema-column-panel">
                    <h2>Columns</h2>
                    <div id="schema-column-list"></div>
                </div>
            </div>
            <div id="schema-docs-panel" class="schema-docs-panel hidden">
                <div class="schema-docs-toolbar">
                    <h2>Schema Documentation</h2>
                    <button id="copy-schema-docs-btn" class="btn btn-secondary">Copy Documentation</button>
                </div>
                <textarea id="schema-docs-output" readonly></textarea>
            </div>
        </section>`;
    }

    private getJavaScriptContent(): string {
        return `
        const vscode = acquireVsCodeApi();
        const DEFAULT_QUERY = 'SELECT * FROM file_data';
        const EXPORT_FORMATS = ['csv', 'tsv', 'psv', 'json', 'jsonl', 'ndjson', 'sqlite', 'parquet', 'duckdb', 'avro', 'orc', 'arrow', 'feather', 'ipc'];
        const SOURCE_FORMATS = [...EXPORT_FORMATS, 'excel', 'xlsx', 'xls', 'workspace'];
        const VIEW_TO_GROUP = {
            data: 'explore',
            eda: 'explore',
            visualizer: 'explore',
            schema: 'explore',
            edit: 'transform',
            write: 'transform',
            export: 'export',
            compare: 'combine',
            join: 'combine',
            doctor: 'quality'
        };
        let currentQuery = DEFAULT_QUERY;
        let currentFileType = 'parquet';
        let currentSourceFormat = 'parquet';
        let currentRelations = [];
        let currentSelectedRelation = null;
        let currentSourceOptions = getDefaultSourceOptions('parquet');
        let currentFeatureCapabilities = getDefaultFeatureCapabilities();
        let currentTextPreview = null;
        let currentSchema = null;
        let currentSchemaDocs = '';
        let currentCompareResult = null;
        let currentCompareMetadata = null;
        let currentDoctor = null;
        let currentDoctorSchemaDrift = null;
        let currentDoctorDataset = null;
        let doctorRequestInFlight = false;
        let currentColumns = [];
        let currentRows = [];
        let currentOffset = 0;
        let currentLimit = 1000;
        let currentHasMore = false;
        let dataControlsCollapsed = false;
        let editRows = [];
        let editColumnNames = [];
        let writeRows = [];
        let writeSchema = [];
        let currentJoinMetadata = null;
        let currentJoinResult = null;
        let tableViewState = {
            columnOrder: [],
            visibleColumns: [],
            sortColumn: '',
            sortDirection: 'asc'
        };

        function initialize(data) {
            const queryInput = document.getElementById('query-input');
            currentFileType = normalizeFileType(data && data.fileType);
            currentSourceFormat = normalizeSourceFormat(data && (data.sourceFormat || data.fileType));
            currentSourceOptions = normalizeSourceOptions(data && data.sourceOptions, currentSourceFormat || currentFileType);
            updateSourceTypeBadge();
            currentQuery = data.query || DEFAULT_QUERY;
            if (queryInput) {
                queryInput.value = currentQuery;
            }
            updateView(data);
        }

        function normalizeFileType(fileType) {
            const supportedFileTypes = ['workspace', 'duckdb', 'sqlite', 'sqlite3', 'csv', 'tsv', 'psv', 'json', 'jsonl', 'ndjson', 'avro', 'orc', 'arrow', 'feather', 'ipc', 'excel', 'xlsx', 'xls'];
            if (supportedFileTypes.includes(fileType)) {
                return fileType;
            }
            return 'parquet';
        }

        function normalizeSourceFormat(format) {
            if (SOURCE_FORMATS.includes(format)) {
                return format;
            }
            return 'parquet';
        }

        function normalizeExportFormat(format) {
            if (EXPORT_FORMATS.includes(format)) {
                return format;
            }
            return 'parquet';
        }

        function isDelimitedTextSource() {
            return ['csv', 'tsv', 'psv'].includes(currentSourceFormat || currentFileType);
        }

        function isJsonSource() {
            return ['json', 'jsonl', 'ndjson'].includes(currentSourceFormat || currentFileType);
        }

        function isExcelSource() {
            return ['excel', 'xlsx'].includes(currentSourceFormat || currentFileType);
        }

        function isTextEditorSource() {
            return isDelimitedTextSource() || isJsonSource() || isTextOnlySource();
        }

        function isTextOnlySource() {
            return false;
        }

        function getDefaultDelimiter(format) {
            if (format === 'tsv') {
                return '\\t';
            }
            if (format === 'psv') {
                return '|';
            }
            return ',';
        }

        function getDefaultSourceOptions(format) {
            if (['csv', 'tsv', 'psv'].includes(format)) {
                return {
                    delimitedText: {
                        header: true,
                        delimiter: getDefaultDelimiter(format),
                        encoding: 'utf-8',
                        quote: '"',
                        escape: '"',
                        nullString: ''
                    }
                };
            }

            if (['json', 'jsonl', 'ndjson'].includes(format)) {
                return {
                    json: {
                        flatten: false,
                        recordPath: ''
                    }
                };
            }

            if (['excel', 'xlsx'].includes(format)) {
                return {
                    excel: {
                        headerRow: 1,
                        dataStartRow: 2,
                        inferTypes: false
                    }
                };
            }

            return {};
        }

        function normalizeExcelRowNumber(value, fallback, minimum) {
            const numberValue = Number(value);
            if (!Number.isFinite(numberValue)) {
                return fallback;
            }
            return Math.min(1048576, Math.max(minimum, Math.trunc(numberValue)));
        }

        function normalizeJsonRecordPath(value) {
            return String(value || '')
                .trim()
                .replace(/^\\$\\.?/, '')
                .replace(/^\\./, '')
                .slice(0, 240);
        }

        function normalizeSourceOptions(options, format) {
            const defaults = getDefaultSourceOptions(format);
            if (defaults.delimitedText) {
                const incoming = options && options.delimitedText ? options.delimitedText : {};
                const supportedEncodings = ['utf-8', 'latin-1', 'utf-16'];
                const incomingEncoding = typeof incoming.encoding === 'string'
                    ? incoming.encoding.trim().toLowerCase()
                    : defaults.delimitedText.encoding;
                return {
                    delimitedText: {
                        header: typeof incoming.header === 'boolean' ? incoming.header : defaults.delimitedText.header,
                        delimiter: typeof incoming.delimiter === 'string' && incoming.delimiter ? incoming.delimiter : defaults.delimitedText.delimiter,
                        encoding: supportedEncodings.includes(incomingEncoding) ? incomingEncoding : defaults.delimitedText.encoding,
                        quote: typeof incoming.quote === 'string' ? incoming.quote.slice(0, 1) : defaults.delimitedText.quote,
                        escape: typeof incoming.escape === 'string' ? incoming.escape.slice(0, 1) : defaults.delimitedText.escape,
                        nullString: typeof incoming.nullString === 'string' ? incoming.nullString.slice(0, 64) : defaults.delimitedText.nullString
                    }
                };
            }

            if (defaults.json) {
                const incoming = options && options.json ? options.json : {};
                return {
                    json: {
                        flatten: typeof incoming.flatten === 'boolean' ? incoming.flatten : defaults.json.flatten,
                        recordPath: normalizeJsonRecordPath(incoming.recordPath)
                    }
                };
            }

            if (defaults.excel) {
                const incoming = options && options.excel ? options.excel : {};
                const headerRow = normalizeExcelRowNumber(incoming.headerRow, defaults.excel.headerRow, 0);
                const minimumDataStart = headerRow > 0 ? headerRow + 1 : 1;
                return {
                    excel: {
                        headerRow,
                        dataStartRow: normalizeExcelRowNumber(incoming.dataStartRow, Math.max(defaults.excel.dataStartRow, minimumDataStart), minimumDataStart),
                        inferTypes: typeof incoming.inferTypes === 'boolean' ? incoming.inferTypes : defaults.excel.inferTypes
                    }
                };
            }

            return {};
        }

        function getSourceOptionsPayload() {
            if (isDelimitedTextSource() || isJsonSource() || isExcelSource()) {
                return JSON.parse(JSON.stringify(currentSourceOptions));
            }

            return null;
        }

        function getDefaultFeatureCapabilities() {
            return {
                data: true,
                eda: false,
                visualizer: false,
                schema: false,
                edit: false,
                write: false,
                export: false,
                compare: false,
                join: false,
                doctor: false
            };
        }

        function isParquetSource() {
            return currentFileType === 'parquet' || currentSourceFormat === 'parquet';
        }

        function getFeatureCapabilities(data) {
            const success = Boolean(data && data.success);
            const hasColumns = currentColumns.length > 0;
            const hasRows = currentRows.length > 0;
            const hasSchema = Boolean(currentSchema && Array.isArray(currentSchema.columns) && currentSchema.columns.length > 0);
            const hasDoctor = Boolean(data && data.doctor);

            if (!success) {
                return {
                    ...getDefaultFeatureCapabilities(),
                    data: true,
                    doctor: hasDoctor
                };
            }

            if (isTextOnlySource()) {
                return getDefaultFeatureCapabilities();
            }

            return {
                data: true,
                eda: hasColumns && hasRows,
                visualizer: hasColumns && hasRows,
                schema: hasSchema,
                edit: hasColumns,
                write: hasColumns,
                export: hasColumns,
                compare: hasColumns,
                join: hasColumns,
                doctor: true
            };
        }

        function setCapabilityElementHidden(element, hidden) {
            if (!element) {
                return;
            }

            element.hidden = hidden;
            element.classList.toggle('hidden', hidden);
        }

        function applyDataControlsCollapsedState() {
            const body = document.getElementById('data-controls-body');
            const toggleButton = document.getElementById('data-controls-toggle-btn');
            const tableTools = document.querySelector('.table-tools');

            setCapabilityElementHidden(body, dataControlsCollapsed);
            setCapabilityElementHidden(tableTools, dataControlsCollapsed || currentColumns.length === 0);

            if (toggleButton) {
                toggleButton.textContent = dataControlsCollapsed ? 'Show Controls' : 'Collapse';
                toggleButton.setAttribute('aria-expanded', dataControlsCollapsed ? 'false' : 'true');
            }
        }

        function getAvailableViewsForGroup(groupName) {
            return Object.keys(VIEW_TO_GROUP).filter((viewName) => {
                return VIEW_TO_GROUP[viewName] === groupName && currentFeatureCapabilities[viewName];
            });
        }

        function getFirstAvailableView() {
            return ['data', 'schema', 'edit', 'write', 'export', 'compare', 'join', 'doctor', 'eda', 'visualizer']
                .find((viewName) => currentFeatureCapabilities[viewName]) || 'data';
        }

        function getActiveViewName() {
            const activeTab = document.querySelector('.subtab-btn.active');
            if (!activeTab || !activeTab.id || !activeTab.id.endsWith('-tab')) {
                return 'data';
            }

            return activeTab.id.slice(0, -4);
        }

        function isViewAvailable(viewName) {
            return Boolean(currentFeatureCapabilities[viewName]);
        }

        function applyFeatureAvailability(data) {
            currentFeatureCapabilities = getFeatureCapabilities(data);

            Object.keys(VIEW_TO_GROUP).forEach((viewName) => {
                setCapabilityElementHidden(
                    document.getElementById(viewName + '-tab'),
                    !currentFeatureCapabilities[viewName]
                );
            });

            document.querySelectorAll('[data-view-group]').forEach((tab) => {
                const groupViews = getAvailableViewsForGroup(tab.dataset.viewGroup);
                setCapabilityElementHidden(tab, groupViews.length === 0);
            });

            document.querySelectorAll('[data-format-scope="parquet"]').forEach((panel) => {
                setCapabilityElementHidden(panel, !isParquetSource());
            });

            document.querySelectorAll('[data-capability-scope="columns"]').forEach((panel) => {
                setCapabilityElementHidden(panel, currentColumns.length === 0);
            });
            applyDataControlsCollapsedState();
            setCapabilityElementHidden(document.getElementById('doctor-dataset-scan-btn'), isTextOnlySource());
        }

        function formatDelimiterForInput(delimiter) {
            return delimiter === '\\t' ? '\\\\t' : delimiter;
        }

        function parseDelimiterInput(value) {
            const text = String(value || '');
            return text === '\\\\t' ? '\\t' : text;
        }

        function renderFlatFileOptions() {
            const container = document.getElementById('flat-file-options');
            if (!container) {
                return;
            }

            setCapabilityElementHidden(container, !isDelimitedTextSource());
            if (!isDelimitedTextSource()) {
                return;
            }

            currentSourceOptions = normalizeSourceOptions(currentSourceOptions, currentSourceFormat || currentFileType);
            const options = currentSourceOptions.delimitedText;
            const headerInput = document.getElementById('flat-file-header');
            const delimiterInput = document.getElementById('flat-file-delimiter');
            const encodingSelect = document.getElementById('flat-file-encoding');
            const quoteInput = document.getElementById('flat-file-quote');
            const escapeInput = document.getElementById('flat-file-escape');
            const nullInput = document.getElementById('flat-file-null');

            if (headerInput) {
                headerInput.checked = Boolean(options.header);
            }
            if (delimiterInput) {
                delimiterInput.value = formatDelimiterForInput(options.delimiter);
            }
            if (encodingSelect) {
                encodingSelect.value = options.encoding;
            }
            if (quoteInput) {
                quoteInput.value = options.quote;
            }
            if (escapeInput) {
                escapeInput.value = options.escape;
            }
            if (nullInput) {
                nullInput.value = options.nullString;
            }
        }

        function readFlatFileOptionsFromControls() {
            const headerInput = document.getElementById('flat-file-header');
            const delimiterInput = document.getElementById('flat-file-delimiter');
            const encodingSelect = document.getElementById('flat-file-encoding');
            const quoteInput = document.getElementById('flat-file-quote');
            const escapeInput = document.getElementById('flat-file-escape');
            const nullInput = document.getElementById('flat-file-null');
            const fallback = normalizeSourceOptions(currentSourceOptions, currentSourceFormat || currentFileType).delimitedText;
            const delimiter = parseDelimiterInput(delimiterInput ? delimiterInput.value : fallback.delimiter);

            return {
                delimitedText: {
                    header: headerInput ? headerInput.checked : fallback.header,
                    delimiter: delimiter || fallback.delimiter,
                    encoding: encodingSelect ? encodingSelect.value : fallback.encoding,
                    quote: quoteInput ? quoteInput.value.slice(0, 1) : fallback.quote,
                    escape: escapeInput ? escapeInput.value.slice(0, 1) : fallback.escape,
                    nullString: nullInput ? nullInput.value.slice(0, 64) : fallback.nullString
                }
            };
        }

        function reloadWithFlatFileOptions(reset) {
            if (!isDelimitedTextSource()) {
                return;
            }

            currentSourceOptions = reset
                ? getDefaultSourceOptions(currentSourceFormat || currentFileType)
                : normalizeSourceOptions(readFlatFileOptionsFromControls(), currentSourceFormat || currentFileType);
            renderFlatFileOptions();
            currentDoctor = null;
            renderDoctorPanel(null);
            currentQuery = DEFAULT_QUERY;
            currentOffset = 0;
            const queryInput = document.getElementById('query-input');
            if (queryInput) {
                queryInput.value = currentQuery;
            }
            setLoading(reset ? 'Reloading with default options...' : 'Reloading flat file...');
            vscode.postMessage({
                type: 'query',
                query: currentQuery,
                selectedRelation: getSelectedRelationPayload(),
                sourceOptions: getSourceOptionsPayload(),
                offset: currentOffset,
                limit: currentLimit
            });
        }

        function renderJsonFileOptions() {
            const container = document.getElementById('json-file-options');
            if (!container) {
                return;
            }

            setCapabilityElementHidden(container, !isJsonSource());
            if (!isJsonSource()) {
                return;
            }

            currentSourceOptions = normalizeSourceOptions(currentSourceOptions, currentSourceFormat || currentFileType);
            const options = currentSourceOptions.json;
            const flattenInput = document.getElementById('json-flatten');
            const recordPathInput = document.getElementById('json-record-path');

            if (flattenInput) {
                flattenInput.checked = Boolean(options.flatten);
            }
            if (recordPathInput) {
                recordPathInput.value = options.recordPath || '';
            }
        }

        function readJsonOptionsFromControls() {
            const flattenInput = document.getElementById('json-flatten');
            const recordPathInput = document.getElementById('json-record-path');
            const fallback = normalizeSourceOptions(currentSourceOptions, currentSourceFormat || currentFileType).json;

            return {
                json: {
                    flatten: flattenInput ? flattenInput.checked : fallback.flatten,
                    recordPath: recordPathInput ? normalizeJsonRecordPath(recordPathInput.value) : fallback.recordPath
                }
            };
        }

        function reloadWithJsonOptions(reset) {
            if (!isJsonSource()) {
                return;
            }

            currentSourceOptions = reset
                ? getDefaultSourceOptions(currentSourceFormat || currentFileType)
                : normalizeSourceOptions(readJsonOptionsFromControls(), currentSourceFormat || currentFileType);
            renderJsonFileOptions();
            currentDoctor = null;
            renderDoctorPanel(null);
            currentQuery = DEFAULT_QUERY;
            currentOffset = 0;
            const queryInput = document.getElementById('query-input');
            if (queryInput) {
                queryInput.value = currentQuery;
            }
            setLoading(reset ? 'Reloading JSON with default options...' : 'Reloading JSON...');
            vscode.postMessage({
                type: 'query',
                query: currentQuery,
                selectedRelation: getSelectedRelationPayload(),
                sourceOptions: getSourceOptionsPayload(),
                offset: currentOffset,
                limit: currentLimit
            });
        }

        function renderExcelFileOptions() {
            const container = document.getElementById('excel-file-options');
            if (!container) {
                return;
            }

            setCapabilityElementHidden(container, !isExcelSource());
            if (!isExcelSource()) {
                return;
            }

            currentSourceOptions = normalizeSourceOptions(currentSourceOptions, currentSourceFormat || currentFileType);
            const options = currentSourceOptions.excel;
            const headerRowInput = document.getElementById('excel-header-row');
            const dataStartRowInput = document.getElementById('excel-data-start-row');
            const inferTypesInput = document.getElementById('excel-infer-types');

            if (headerRowInput) {
                headerRowInput.value = String(options.headerRow);
            }
            if (dataStartRowInput) {
                dataStartRowInput.value = String(options.dataStartRow);
                dataStartRowInput.min = String(options.headerRow > 0 ? options.headerRow + 1 : 1);
            }
            if (inferTypesInput) {
                inferTypesInput.checked = Boolean(options.inferTypes);
            }
        }

        function readExcelOptionsFromControls() {
            const headerRowInput = document.getElementById('excel-header-row');
            const dataStartRowInput = document.getElementById('excel-data-start-row');
            const inferTypesInput = document.getElementById('excel-infer-types');
            const fallback = normalizeSourceOptions(currentSourceOptions, currentSourceFormat || currentFileType).excel;
            const headerRow = normalizeExcelRowNumber(headerRowInput ? headerRowInput.value : fallback.headerRow, fallback.headerRow, 0);
            const minimumDataStart = headerRow > 0 ? headerRow + 1 : 1;

            return {
                excel: {
                    headerRow,
                    dataStartRow: normalizeExcelRowNumber(dataStartRowInput ? dataStartRowInput.value : fallback.dataStartRow, Math.max(fallback.dataStartRow, minimumDataStart), minimumDataStart),
                    inferTypes: inferTypesInput ? inferTypesInput.checked : fallback.inferTypes
                }
            };
        }

        function reloadWithExcelOptions(reset) {
            if (!isExcelSource()) {
                return;
            }

            currentSourceOptions = reset
                ? getDefaultSourceOptions(currentSourceFormat || currentFileType)
                : normalizeSourceOptions(readExcelOptionsFromControls(), currentSourceFormat || currentFileType);
            renderExcelFileOptions();
            currentDoctor = null;
            renderDoctorPanel(null);
            currentQuery = DEFAULT_QUERY;
            currentOffset = 0;
            const queryInput = document.getElementById('query-input');
            if (queryInput) {
                queryInput.value = currentQuery;
            }
            setLoading(reset ? 'Reloading Excel with default options...' : 'Reloading Excel...');
            vscode.postMessage({
                type: 'query',
                query: currentQuery,
                selectedRelation: getSelectedRelationPayload(),
                sourceOptions: getSourceOptionsPayload(),
                offset: currentOffset,
                limit: currentLimit
            });
        }

        function renderTextEditorOption() {
            const hidden = !isTextEditorSource();
            setCapabilityElementHidden(document.getElementById('header-open-text-editor-btn'), hidden);
            setCapabilityElementHidden(document.getElementById('open-text-editor-btn'), hidden);
        }

        function renderTransformControls() {
            const saveButton = document.getElementById('save-edits-btn');
            if (saveButton) {
                saveButton.textContent = 'Save ' + formatFileTypeLabel(currentSourceFormat || currentFileType) + ' Copy...';
            }
        }

        function formatBytes(value) {
            const bytes = Number(value);
            if (!Number.isFinite(bytes) || bytes <= 0) {
                return '0 B';
            }

            const units = ['B', 'KB', 'MB', 'GB'];
            let amount = bytes;
            let unitIndex = 0;
            while (amount >= 1024 && unitIndex < units.length - 1) {
                amount = amount / 1024;
                unitIndex += 1;
            }

            return (unitIndex === 0 ? String(Math.round(amount)) : amount.toFixed(amount >= 10 ? 1 : 2)) + ' ' + units[unitIndex];
        }

        function renderTextPreviewPanel() {
            const queryContainer = document.getElementById('query-container');
            const textContainer = document.getElementById('text-preview-container');
            const contentElement = document.getElementById('text-preview-content');
            const lineElement = document.getElementById('text-preview-lines');
            const sizeElement = document.getElementById('text-preview-size');
            const truncatedElement = document.getElementById('text-preview-truncated');
            const showTextPreview = isTextOnlySource();

            setCapabilityElementHidden(queryContainer, showTextPreview);
            setCapabilityElementHidden(textContainer, !showTextPreview);

            if (!showTextPreview || !textContainer || !contentElement) {
                return;
            }

            const preview = currentTextPreview || {};
            contentElement.textContent = preview.content || '';
            if (lineElement) {
                lineElement.textContent = formatCount(preview.lineCount || 0);
            }
            if (sizeElement) {
                sizeElement.textContent = formatBytes(preview.sizeBytes || 0);
            }
            if (truncatedElement) {
                setCapabilityElementHidden(truncatedElement, !preview.truncated);
            }
        }

        function relationKey(relation) {
            if (!relation) {
                return '';
            }

            return [
                relation.database || '',
                relation.schema || '',
                relation.name || '',
                relation.type || ''
            ].join('\\u001f');
        }

        function formatRelationLabel(relation) {
            if (!relation) {
                return '';
            }

            const schemaName = relation.schema ? relation.schema + '.' + relation.name : relation.name;
            const typeLabel = relation.type === 'VIEW' ? 'view' : 'table';
            return schemaName + ' (' + typeLabel + ')';
        }

        function getSelectedRelationPayload() {
            return currentSelectedRelation ? { ...currentSelectedRelation } : null;
        }

        function updateRelations(data) {
            currentRelations = Array.isArray(data && data.relations) ? data.relations : [];
            currentSelectedRelation = data && data.selectedRelation ? data.selectedRelation : null;
            renderRelationPicker();
        }

        function renderRelationPicker() {
            const pickerWrap = document.getElementById('relation-picker-wrap');
            const picker = document.getElementById('relation-picker');
            if (!pickerWrap || !picker) {
                return;
            }

            picker.innerHTML = '';
            if (currentRelations.length <= 1) {
                pickerWrap.classList.add('hidden');
                return;
            }

            currentRelations.forEach((relation) => {
                const option = document.createElement('option');
                option.value = relationKey(relation);
                option.textContent = formatRelationLabel(relation);
                picker.appendChild(option);
            });

            picker.value = relationKey(currentSelectedRelation) || relationKey(currentRelations[0]);
            pickerWrap.classList.remove('hidden');
        }

        function selectRelationFromPicker() {
            const picker = document.getElementById('relation-picker');
            if (!picker) {
                return;
            }

            const nextRelation = currentRelations.find((relation) => relationKey(relation) === picker.value);
            if (!nextRelation || relationKey(nextRelation) === relationKey(currentSelectedRelation)) {
                return;
            }

            currentSelectedRelation = nextRelation;
            currentDoctor = null;
            renderDoctorPanel(null);
            currentQuery = DEFAULT_QUERY;
            const queryInput = document.getElementById('query-input');
            if (queryInput) {
                queryInput.value = currentQuery;
            }
            currentOffset = 0;
            setLoading('Loading ' + formatRelationLabel(nextRelation) + '...');
            vscode.postMessage({
                type: 'query',
                query: currentQuery,
                selectedRelation: getSelectedRelationPayload(),
                sourceOptions: getSourceOptionsPayload(),
                offset: currentOffset,
                limit: currentLimit
            });
        }

        function formatFileTypeLabel(fileType) {
            const normalizedFileType = String(fileType || '').toLowerCase();
            if (normalizedFileType === 'csv') {
                return 'CSV';
            }
            if (normalizedFileType === 'sqlite') {
                return 'SQLite';
            }
            if (normalizedFileType === 'tsv') {
                return 'TSV';
            }
            if (normalizedFileType === 'psv') {
                return 'PSV';
            }
            if (normalizedFileType === 'json') {
                return 'JSON';
            }
            if (normalizedFileType === 'jsonl') {
                return 'JSONL';
            }
            if (normalizedFileType === 'ndjson') {
                return 'NDJSON';
            }
            if (normalizedFileType === 'avro') {
                return 'Avro';
            }
            if (normalizedFileType === 'orc') {
                return 'ORC';
            }
            if (normalizedFileType === 'arrow') {
                return 'Arrow';
            }
            if (normalizedFileType === 'feather') {
                return 'Feather';
            }
            if (normalizedFileType === 'ipc') {
                return 'IPC';
            }
            if (normalizedFileType === 'excel' || normalizedFileType === 'xlsx' || normalizedFileType === 'xls') {
                return 'Excel';
            }
            if (normalizedFileType === 'sqlite3') {
                return 'SQLite';
            }
            if (normalizedFileType === 'workspace') {
                return 'Workspace';
            }
            return normalizedFileType === 'duckdb' ? 'DuckDB' : 'Parquet';
        }

        function formatExportLabel(format) {
            const labels = {
                csv: 'CSV',
                tsv: 'TSV',
                psv: 'PSV',
                json: 'JSON',
                jsonl: 'JSONL',
                ndjson: 'NDJSON',
                sqlite: 'SQLite',
                parquet: 'Parquet',
                duckdb: 'DuckDB',
                avro: 'Avro',
                orc: 'ORC',
                arrow: 'Arrow',
                feather: 'Feather',
                ipc: 'IPC',
                excel: 'Excel',
                workspace: 'Workspace'
            };
            return labels[format] || String(format || '').toUpperCase();
        }

        function updateSourceTypeBadge() {
            const badge = document.getElementById('source-type');
            if (badge) {
                badge.textContent = formatFileTypeLabel(currentSourceFormat || currentFileType);
            }
        }

        function formatCount(value) {
            if (typeof value === 'number') {
                return value.toLocaleString();
            }

            return '0';
        }

        function valueOrDash(value) {
            if (value === null || value === undefined || value === '') {
                return '-';
            }

            return String(value);
        }

        function setActiveView(viewName) {
            if (!isViewAvailable(viewName)) {
                const requestedGroup = VIEW_TO_GROUP[viewName];
                const fallbackInGroup = requestedGroup ? getAvailableViewsForGroup(requestedGroup)[0] : undefined;
                viewName = fallbackInGroup || getFirstAvailableView();
            }

            const dataView = document.getElementById('data-view');
            const edaContainer = document.getElementById('eda-container');
            const writeContainer = document.getElementById('write-container');
            const exportContainer = document.getElementById('export-container');
            const visualizerContainer = document.getElementById('visualizer-container');
            const editContainer = document.getElementById('edit-container');
            const doctorContainer = document.getElementById('doctor-container');
            const schemaContainer = document.getElementById('schema-container');
            const compareContainer = document.getElementById('compare-container');
            const joinContainer = document.getElementById('join-container');
            const activeGroup = VIEW_TO_GROUP[viewName] || 'explore';

            const showEda = viewName === 'eda';
            const showWrite = viewName === 'write';
            const showExport = viewName === 'export';
            const showVisualizer = viewName === 'visualizer';
            const showEdit = viewName === 'edit';
            const showDoctor = viewName === 'doctor';
            const showSchema = viewName === 'schema';
            const showCompare = viewName === 'compare';
            const showJoin = viewName === 'join';
            const showData = !showEda && !showWrite && !showExport && !showVisualizer && !showEdit && !showDoctor && !showSchema && !showCompare && !showJoin;

            document.querySelectorAll('[data-view-group]').forEach((tab) => {
                const isActiveGroup = tab.dataset.viewGroup === activeGroup;
                tab.classList.toggle('active', isActiveGroup);
                tab.setAttribute('aria-selected', String(isActiveGroup));
            });

            document.querySelectorAll('[data-tab-group]').forEach((group) => {
                group.classList.toggle('hidden', group.dataset.tabGroup !== activeGroup);
            });

            document.querySelectorAll('.subtab-btn').forEach((tab) => {
                const isActive = tab.id === viewName + '-tab' || (showData && tab.id === 'data-tab');
                tab.classList.toggle('active', isActive);
                tab.setAttribute('aria-selected', String(isActive));
            });

            dataView.classList.toggle('hidden', !showData);
            edaContainer.classList.toggle('hidden', !showEda);
            writeContainer.classList.toggle('hidden', !showWrite);
            exportContainer.classList.toggle('hidden', !showExport);
            visualizerContainer.classList.toggle('hidden', !showVisualizer);
            editContainer.classList.toggle('hidden', !showEdit);
            doctorContainer.classList.toggle('hidden', !showDoctor);
            schemaContainer.classList.toggle('hidden', !showSchema);
            compareContainer.classList.toggle('hidden', !showCompare);
            joinContainer.classList.toggle('hidden', !showJoin);

            if (showVisualizer) {
                renderVisualizer();
            }
            if (showEda) {
                renderEdaPanel();
            }
            if (showWrite) {
                refreshWritePreview();
            }
            if (showExport) {
                refreshExportPanel();
            }
            if (showDoctor && !currentDoctor && !doctorRequestInFlight) {
                requestDoctorChecks(false);
            }
        }

        function writeTextToClipboard(text, successMessage) {
            const statusElement = document.getElementById('status');
            const fallbackCopy = () => {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
                textarea.remove();
            };

            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => {
                        statusElement.textContent = successMessage;
                    }).catch(() => {
                        fallbackCopy();
                        statusElement.textContent = successMessage;
                    });
                } else {
                    fallbackCopy();
                    statusElement.textContent = successMessage;
                }
            } catch (error) {
                statusElement.textContent = 'Copy failed';
                statusElement.className = 'status status-error';
            }
        }

        const SVG_NS = 'http://www.w3.org/2000/svg';

        function isNumericValue(value) {
            if (value === null || value === undefined || value === '') {
                return false;
            }

            const numberValue = typeof value === 'number' ? value : Number(value);
            return Number.isFinite(numberValue);
        }

        function toNumber(value) {
            return typeof value === 'number' ? value : Number(value);
        }

        function getNumericColumns() {
            return currentColumns.filter((column) => currentRows.some((row) => isNumericValue(row[column])));
        }

        function formatPercent(part, total) {
            if (!total) {
                return '0%';
            }

            return ((part / total) * 100).toFixed(1) + '%';
        }

        function formatEdaNumber(value) {
            if (!Number.isFinite(value)) {
                return '-';
            }

            const absoluteValue = Math.abs(value);
            if (absoluteValue >= 1000) {
                return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
            }
            if (absoluteValue > 0 && absoluteValue < 0.01) {
                return value.toExponential(2);
            }
            return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
        }

        function normalizeEdaValue(value) {
            if (value === null || value === undefined || value === '') {
                return 'NULL';
            }
            if (typeof value === 'object') {
                try {
                    return JSON.stringify(value);
                } catch (error) {
                    return String(value);
                }
            }
            return String(value);
        }

        function truncateEdaText(value, maxLength) {
            const text = String(value);
            return text.length > maxLength ? text.slice(0, maxLength - 1) + '...' : text;
        }

        function countDuplicateRows() {
            const seenRows = new Set();
            let duplicateCount = 0;

            currentRows.forEach((row) => {
                const signature = JSON.stringify(currentColumns.map((column) => normalizeEdaValue(row[column])));
                if (seenRows.has(signature)) {
                    duplicateCount += 1;
                    return;
                }
                seenRows.add(signature);
            });

            return duplicateCount;
        }

        function buildEdaProfiles() {
            const rowCount = currentRows.length;
            return currentColumns.map((column) => {
                const values = currentRows.map((row) => row[column]);
                const presentValues = values.filter((value) => value !== null && value !== undefined && value !== '');
                const missingCount = rowCount - presentValues.length;
                const numericValues = presentValues.filter(isNumericValue).map(toNumber);
                const booleanCount = presentValues.filter((value) => {
                    const text = String(value).toLowerCase();
                    return typeof value === 'boolean' || text === 'true' || text === 'false';
                }).length;
                const dateCount = presentValues.filter((value) => {
                    if (isNumericValue(value)) {
                        return false;
                    }
                    return Number.isFinite(Date.parse(String(value)));
                }).length;
                const distinctValues = new Set(presentValues.map(normalizeEdaValue));
                const topValueCounts = new Map();

                presentValues.forEach((value) => {
                    const normalized = normalizeEdaValue(value);
                    topValueCounts.set(normalized, (topValueCounts.get(normalized) || 0) + 1);
                });

                const topValues = Array.from(topValueCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([value, count]) => truncateEdaText(value, 24) + ' (' + count + ')')
                    .join(', ');

                const presentCount = presentValues.length;
                const numericRatio = presentCount ? numericValues.length / presentCount : 0;
                const distinctRatio = presentCount ? distinctValues.size / presentCount : 0;
                let inferredType = 'mixed';
                if (!presentCount) {
                    inferredType = 'empty';
                } else if (numericRatio >= 0.8) {
                    inferredType = 'numeric';
                } else if (booleanCount / presentCount >= 0.8) {
                    inferredType = 'boolean';
                } else if (dateCount / presentCount >= 0.8) {
                    inferredType = 'date';
                } else if (distinctValues.size <= Math.max(20, Math.ceil(presentCount * 0.2))) {
                    inferredType = 'categorical';
                } else {
                    inferredType = 'text';
                }

                const numericSum = numericValues.reduce((sum, value) => sum + value, 0);
                const numericMean = numericValues.length ? numericSum / numericValues.length : NaN;
                const numericMin = numericValues.length ? Math.min(...numericValues) : NaN;
                const numericMax = numericValues.length ? Math.max(...numericValues) : NaN;

                return {
                    column,
                    inferredType,
                    rowCount,
                    presentCount,
                    missingCount,
                    missingRatio: rowCount ? missingCount / rowCount : 0,
                    distinctCount: distinctValues.size,
                    distinctRatio,
                    topValues,
                    numericCount: numericValues.length,
                    numericMean,
                    numericMin,
                    numericMax
                };
            });
        }

        function renderEdaPanel() {
            const rowCount = currentRows.length;
            const columnCount = currentColumns.length;
            const profiles = buildEdaProfiles();
            const numericProfiles = profiles.filter((profile) => profile.inferredType === 'numeric');
            const missingCells = profiles.reduce((sum, profile) => sum + profile.missingCount, 0);
            const duplicateRows = countDuplicateRows();

            document.getElementById('eda-row-count').textContent = formatCount(rowCount);
            document.getElementById('eda-column-count').textContent = formatCount(columnCount);
            document.getElementById('eda-numeric-count').textContent = formatCount(numericProfiles.length);
            document.getElementById('eda-missing-count').textContent = formatCount(missingCells);
            document.getElementById('eda-duplicate-count').textContent = formatCount(duplicateRows);

            renderEdaSuggestions(profiles, duplicateRows);
            renderEdaQuality(profiles, duplicateRows);
            renderEdaNumericSummary(numericProfiles);
            renderEdaProfileTable(profiles);
        }

        function renderEdaSuggestions(profiles, duplicateRows) {
            const suggestions = [];
            const numericProfiles = profiles.filter((profile) => profile.inferredType === 'numeric');
            const categoricalProfiles = profiles.filter((profile) => profile.inferredType === 'categorical' || profile.inferredType === 'boolean');
            const dateProfiles = profiles.filter((profile) => profile.inferredType === 'date');
            const highMissing = profiles.filter((profile) => profile.missingRatio >= 0.2);
            const mostlyUnique = profiles.filter((profile) => profile.presentCount > 1 && profile.distinctRatio >= 0.95);
            if (currentHasMore) {
                suggestions.push('EDA is based on the currently loaded page (' + formatCount(currentRows.length) + ' rows). Load more pages or aggregate for full-file confidence.');
            }
            if (numericProfiles.length && categoricalProfiles.length) {
                suggestions.push('Compare numeric metrics by ' + categoricalProfiles[0].column + ' using Quick Aggregations or the Visualize tab.');
            }
            if (dateProfiles.length && numericProfiles.length) {
                suggestions.push('Plot ' + numericProfiles[0].column + ' over ' + dateProfiles[0].column + ' to check trend, seasonality, and gaps.');
            }
            if (highMissing.length) {
                suggestions.push('Review missing values in ' + highMissing.slice(0, 3).map((profile) => profile.column).join(', ') + ' before modeling or exporting.');
            }
            if (duplicateRows > 0) {
                suggestions.push('Investigate duplicate rows; they may inflate counts, averages, and joins.');
            }
            if (mostlyUnique.length) {
                suggestions.push('Columns like ' + mostlyUnique.slice(0, 3).map((profile) => profile.column).join(', ') + ' look identifier-like. Avoid aggregating by them unless that is intentional.');
            }
            if (!suggestions.length) {
                suggestions.push('Start with a bar chart for categorical columns or a histogram for numeric columns in the Visualize tab.');
            }

            renderEdaList('eda-suggestions', suggestions, 'eda-suggestion');
        }

        function renderEdaQuality(profiles, duplicateRows) {
            const issues = [];
            const emptyColumns = profiles.filter((profile) => profile.presentCount === 0);
            const highMissing = profiles.filter((profile) => profile.missingRatio >= 0.2 && profile.presentCount > 0);
            const constantColumns = profiles.filter((profile) => profile.presentCount > 0 && profile.distinctCount === 1);
            const mixedColumns = profiles.filter((profile) => profile.inferredType === 'mixed');

            if (!currentRows.length) {
                issues.push('No rows available for EDA. Run a query that returns rows.');
            }
            if (emptyColumns.length) {
                issues.push('Empty columns: ' + emptyColumns.map((profile) => profile.column).join(', '));
            }
            if (highMissing.length) {
                issues.push('High missingness: ' + highMissing.map((profile) => profile.column + ' ' + formatPercent(profile.missingCount, profile.rowCount)).join(', '));
            }
            if (constantColumns.length) {
                issues.push('Constant columns: ' + constantColumns.slice(0, 5).map((profile) => profile.column).join(', '));
            }
            if (mixedColumns.length) {
                issues.push('Mixed-looking columns: ' + mixedColumns.slice(0, 5).map((profile) => profile.column).join(', '));
            }
            if (duplicateRows > 0) {
                issues.push(formatCount(duplicateRows) + ' duplicate rows detected in the current result.');
            }
            if (!issues.length) {
                issues.push('No obvious quality issues found in the current result.');
            }

            renderEdaList('eda-quality', issues, 'eda-quality-item');
        }

        function renderEdaList(elementId, items, className) {
            const container = document.getElementById(elementId);
            container.innerHTML = '';
            items.forEach((item) => {
                const row = document.createElement('div');
                row.className = className;
                row.textContent = item;
                container.appendChild(row);
            });
        }

        function renderEdaNumericSummary(numericProfiles) {
            const body = document.getElementById('eda-numeric-body');
            body.innerHTML = '';
            if (!numericProfiles.length) {
                appendEdaEmptyRow(body, 5, 'No numeric columns detected.');
                return;
            }

            numericProfiles.forEach((profile) => {
                const row = document.createElement('tr');
                [
                    profile.column,
                    formatPercent(profile.missingCount, profile.rowCount),
                    formatEdaNumber(profile.numericMean),
                    formatEdaNumber(profile.numericMin),
                    formatEdaNumber(profile.numericMax)
                ].forEach((value) => {
                    const cell = document.createElement('td');
                    cell.textContent = value;
                    cell.title = value;
                    row.appendChild(cell);
                });
                body.appendChild(row);
            });
        }

        function renderEdaProfileTable(profiles) {
            const body = document.getElementById('eda-profile-body');
            body.innerHTML = '';
            if (!profiles.length) {
                appendEdaEmptyRow(body, 5, 'No columns available.');
                return;
            }

            profiles.forEach((profile) => {
                const row = document.createElement('tr');
                [
                    profile.column,
                    profile.inferredType,
                    formatCount(profile.distinctCount),
                    formatPercent(profile.missingCount, profile.rowCount),
                    profile.topValues || '-'
                ].forEach((value) => {
                    const cell = document.createElement('td');
                    cell.textContent = value;
                    cell.title = value;
                    row.appendChild(cell);
                });
                body.appendChild(row);
            });
        }

        function appendEdaEmptyRow(body, colSpan, message) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = colSpan;
            cell.className = 'empty-value';
            cell.textContent = message;
            row.appendChild(cell);
            body.appendChild(row);
        }

        const WRITE_TYPE_OPTIONS = ['VARCHAR', 'BOOLEAN', 'BIGINT', 'DOUBLE', 'DECIMAL(18, 4)', 'DATE', 'TIMESTAMP'];

        function refreshWritePreview() {
            const sourceSelect = document.getElementById('write-source');
            const jsonInput = document.getElementById('write-json-input');
            const source = sourceSelect ? sourceSelect.value : 'current';

            if (jsonInput) {
                jsonInput.disabled = source === 'current';
            }

            try {
                const parsed = parseWriteSourceRows(source);
                writeRows = parsed.rows;
                writeSchema = parsed.columns.map((column) => ({
                    sourceName: column,
                    name: column,
                    type: inferWriteType(column, writeRows),
                    sample: getWriteSample(column, writeRows),
                    nullCount: writeRows.filter((row) => isMissingWriteValue(row[column])).length
                }));
                renderWriteSchema();
                updateWriteSummary();
                setWriteMessage(writeRows.length ? '' : 'No rows available for this source.', !writeRows.length);
            } catch (error) {
                writeRows = [];
                writeSchema = [];
                renderWriteSchema();
                updateWriteSummary();
                setWriteMessage(error instanceof Error ? error.message : String(error), true);
            }
        }

        function parseWriteSourceRows(source) {
            if (source === 'current') {
                if (!currentRows.length) {
                    return { rows: [], columns: currentColumns.slice() };
                }
                return {
                    rows: cloneRows(currentRows),
                    columns: currentColumns.length ? currentColumns.slice() : collectColumnsFromRows(currentRows)
                };
            }

            const input = document.getElementById('write-json-input');
            const text = input ? input.value.trim() : '';
            if (!text) {
                return { rows: [], columns: [] };
            }

            let rows;
            if (source === 'ndjson') {
                rows = text.split(/\\r?\\n/)
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => JSON.parse(line));
            } else {
                const parsed = JSON.parse(text);
                rows = Array.isArray(parsed) ? parsed : [parsed];
            }

            rows = rows.map((row) => {
                if (typeof row !== 'object' || row === null || Array.isArray(row)) {
                    throw new Error('Each row must be a JSON object.');
                }
                return row;
            });

            return {
                rows,
                columns: collectColumnsFromRows(rows)
            };
        }

        function collectColumnsFromRows(rows) {
            const seen = new Set();
            rows.forEach((row) => {
                Object.keys(row).forEach((column) => {
                    if (!seen.has(column)) {
                        seen.add(column);
                    }
                });
            });
            return Array.from(seen);
        }

        function inferWriteType(column, rows) {
            const values = rows.map((row) => row[column]).filter((value) => !isMissingWriteValue(value));
            if (!values.length) {
                return 'VARCHAR';
            }

            if (values.every((value) => typeof value === 'boolean' || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'false')) {
                return 'BOOLEAN';
            }

            if (values.every((value) => isNumericValue(value) && Number.isInteger(toNumber(value)))) {
                return 'BIGINT';
            }

            if (values.every(isNumericValue)) {
                return 'DOUBLE';
            }

            if (values.every((value) => isDateLikeWriteValue(value))) {
                return values.some((value) => /[tT ]\\d{1,2}:\\d{2}/.test(String(value))) ? 'TIMESTAMP' : 'DATE';
            }

            return 'VARCHAR';
        }

        function isDateLikeWriteValue(value) {
            if (value instanceof Date) {
                return true;
            }
            if (isNumericValue(value)) {
                return false;
            }
            return Number.isFinite(Date.parse(String(value)));
        }

        function isMissingWriteValue(value) {
            return value === null || value === undefined || value === '';
        }

        function getWriteSample(column, rows) {
            const row = rows.find((candidate) => !isMissingWriteValue(candidate[column]));
            if (!row) {
                return '-';
            }
            return truncateEdaText(normalizeEdaValue(row[column]), 48);
        }

        function renderWriteSchema() {
            const body = document.getElementById('write-schema-body');
            body.innerHTML = '';

            if (!writeSchema.length) {
                appendEdaEmptyRow(body, 5, 'Preview a source to define structure.');
                return;
            }

            writeSchema.forEach((column) => {
                const row = document.createElement('tr');
                row.dataset.sourceColumn = column.sourceName;

                const sourceCell = document.createElement('td');
                sourceCell.textContent = column.sourceName;
                sourceCell.title = column.sourceName;

                const nameCell = document.createElement('td');
                const nameInput = document.createElement('input');
                nameInput.className = 'write-column-name';
                nameInput.value = column.name;
                nameInput.setAttribute('aria-label', 'Parquet column name');
                nameCell.appendChild(nameInput);

                const typeCell = document.createElement('td');
                const typeSelect = document.createElement('select');
                typeSelect.className = 'write-column-type';
                WRITE_TYPE_OPTIONS.forEach((type) => {
                    const option = document.createElement('option');
                    option.value = type;
                    option.textContent = type;
                    typeSelect.appendChild(option);
                });
                typeSelect.value = column.type;
                typeCell.appendChild(typeSelect);

                const sampleCell = document.createElement('td');
                sampleCell.textContent = column.sample;
                sampleCell.title = column.sample;

                const nullCell = document.createElement('td');
                nullCell.textContent = formatCount(column.nullCount);

                row.appendChild(sourceCell);
                row.appendChild(nameCell);
                row.appendChild(typeCell);
                row.appendChild(sampleCell);
                row.appendChild(nullCell);
                body.appendChild(row);
            });
        }

        function updateWriteSummary() {
            const rowGroupInput = document.getElementById('write-row-group-size');
            const compression = document.getElementById('write-compression');
            document.getElementById('write-row-count').textContent = formatCount(writeRows.length);
            document.getElementById('write-column-count').textContent = formatCount(writeSchema.length);
            document.getElementById('write-compression-summary').textContent = compression ? compression.options[compression.selectedIndex].textContent : 'Snappy';
            document.getElementById('write-row-group-summary').textContent = formatCount(Number(rowGroupInput ? rowGroupInput.value : 100000) || 100000);
        }

        function setWriteMessage(message, isError) {
            const messageElement = document.getElementById('write-message');
            if (!messageElement) {
                return;
            }

            messageElement.textContent = message;
            messageElement.classList.toggle('hidden', !message);
            messageElement.classList.toggle('write-message-error', Boolean(isError));
        }

        function collectWriteSchema() {
            const body = document.getElementById('write-schema-body');
            const rows = Array.from(body.querySelectorAll('tr'));
            const seen = new Set();
            const schema = [];

            rows.forEach((row) => {
                const nameInput = row.querySelector('.write-column-name');
                const typeSelect = row.querySelector('.write-column-type');
                const sourceName = row.dataset.sourceColumn || '';
                const name = nameInput ? nameInput.value.trim() : '';
                const type = typeSelect ? typeSelect.value : 'VARCHAR';

                if (!sourceName || !name) {
                    return;
                }
                if (seen.has(name)) {
                    throw new Error('Column names must be unique.');
                }
                seen.add(name);
                schema.push({ sourceName, name, type });
            });

            if (!schema.length) {
                throw new Error('Define at least one column.');
            }

            return schema;
        }

        function quoteSqlIdentifier(value) {
            return '"' + String(value).replace(/"/g, '""') + '"';
        }

        function createParquetFromWrite() {
            if (!writeRows.length || !writeSchema.length) {
                refreshWritePreview();
            }

            if (!writeRows.length) {
                setWriteMessage('Provide at least one row before creating a Parquet file.', true);
                return;
            }

            try {
                const schema = collectWriteSchema();
                const compression = document.getElementById('write-compression');
                const rowGroupInput = document.getElementById('write-row-group-size');
                const rowGroupSize = Math.min(10000000, Math.max(1, Number(rowGroupInput ? rowGroupInput.value : 100000) || 100000));
                
                const payloadOptions = {
                    columns: schema.map((column) => ({ name: column.name, type: column.type })),
                    compression: compression ? compression.value : 'snappy',
                    rowGroupSize
                };

                const writeSource = document.getElementById('write-source');
                if (writeSource && writeSource.value === 'current') {
                    const selectParts = schema.map((column) => 'TRY_CAST(' + quoteSqlIdentifier(column.sourceName) + ' AS ' + column.type + ') AS ' + quoteSqlIdentifier(column.name));
                    const query = 'SELECT ' + selectParts.join(', ') + ' FROM (' + currentQuery + ')';
                    payloadOptions.query = query;
                } else {
                    const rows = writeRows.map((row) => {
                        const outputRow = {};
                        schema.forEach((column) => {
                            outputRow[column.name] = row[column.sourceName];
                        });
                        return outputRow;
                    });
                    payloadOptions.rows = rows;
                }

                setStatus('Creating Parquet...', 'status-loading');
                setWriteMessage('', false);
                vscode.postMessage({
                    type: 'createParquet',
                    options: payloadOptions,
                    selectedRelation: getSelectedRelationPayload(),
                    sourceOptions: getSourceOptionsPayload()
                });
            } catch (error) {
                setWriteMessage(error instanceof Error ? error.message : String(error), true);
                setStatus('Create Parquet failed', 'status-error');
            }
        }

        function handleWriteResult(result) {
            if (result && result.success) {
                const message = 'Created ' + formatCount(result.rowsExported || 0) + ' rows with ' + valueOrDash(result.compression) + ' compression.';
                setWriteMessage(message, false);
                setStatus('Parquet created', 'status-success');
                return;
            }

            const error = result && result.error ? result.error : 'Create Parquet failed';
            setWriteMessage(error, true);
            setStatus(error, 'status-error');
        }

        function populateSelect(select, values, selectedValue, emptyLabel) {
            if (!select) {
                return;
            }

            select.innerHTML = '';
            if (emptyLabel) {
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = emptyLabel;
                select.appendChild(emptyOption);
            }

            values.forEach((value) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });

            if (selectedValue && values.includes(selectedValue)) {
                select.value = selectedValue;
            }
        }

        function populateVisualizerControls() {
            const xSelect = document.getElementById('visualizer-x-column');
            const ySelect = document.getElementById('visualizer-y-column');
            const numericColumns = getNumericColumns();
            const previousX = xSelect ? xSelect.value : '';
            const previousY = ySelect ? ySelect.value : '';
            const defaultX = currentColumns[0] || '';
            const defaultY = numericColumns[0] || '';

            populateSelect(xSelect, currentColumns, previousX || defaultX, '');
            populateSelect(ySelect, numericColumns, previousY || defaultY, 'None');
            syncVisualizerControls();
        }

        function syncVisualizerControls() {
            const chartType = document.getElementById('visualizer-chart-type');
            const aggregation = document.getElementById('visualizer-aggregation');
            const ySelect = document.getElementById('visualizer-y-column');
            if (!chartType || !aggregation || !ySelect) {
                return;
            }

            const type = chartType.value;
            const needsY = type === 'scatter' || aggregation.value !== 'count';
            ySelect.disabled = type === 'histogram' || !needsY;
            aggregation.disabled = type === 'scatter' || type === 'histogram';
        }

        function setVisualizerMessage(message, isError) {
            const messageElement = document.getElementById('visualizer-message');
            if (!messageElement) {
                return;
            }

            if (!message) {
                messageElement.textContent = '';
                messageElement.classList.add('hidden');
                messageElement.classList.remove('visualizer-message-error');
                return;
            }

            messageElement.textContent = message;
            messageElement.classList.remove('hidden');
            messageElement.classList.toggle('visualizer-message-error', Boolean(isError));
        }

        function renderVisualizer() {
            const chartType = document.getElementById('visualizer-chart-type');
            const xSelect = document.getElementById('visualizer-x-column');
            const ySelect = document.getElementById('visualizer-y-column');
            const aggregation = document.getElementById('visualizer-aggregation');
            const limitInput = document.getElementById('visualizer-limit');
            const svg = document.getElementById('visualizer-chart');

            if (!chartType || !xSelect || !ySelect || !aggregation || !limitInput || !svg) {
                return;
            }

            syncVisualizerControls();
            clearChart(svg);
            document.getElementById('visualizer-row-count').textContent = formatCount(currentRows.length);
            document.getElementById('visualizer-point-count').textContent = '0';
            document.getElementById('visualizer-mode').textContent = '-';

            if (!currentColumns.length || !currentRows.length) {
                setVisualizerMessage('No rows are available to visualize.', false);
                return;
            }

            const type = chartType.value;
            const limit = Math.min(100, Math.max(5, Number(limitInput.value) || 25));
            const chartData = type === 'scatter'
                ? buildScatterData(xSelect.value, ySelect.value, limit)
                : type === 'histogram'
                    ? buildHistogramData(xSelect.value, limit)
                    : buildGroupedChartData(xSelect.value, ySelect.value, aggregation.value, limit, type);

            if (!chartData.success) {
                setVisualizerMessage(chartData.error, true);
                return;
            }

            setVisualizerMessage('', false);
            if (type === 'scatter') {
                drawScatterChart(svg, chartData.points, xSelect.value, ySelect.value);
            } else {
                drawCategoryChart(svg, chartData.points, type);
            }

            document.getElementById('visualizer-point-count').textContent = formatCount(chartData.points.length);
            document.getElementById('visualizer-mode').textContent = chartData.mode;
        }

        function buildGroupedChartData(xColumn, yColumn, aggregation, limit, chartType) {
            if (!xColumn) {
                return { success: false, error: 'Choose an X column.' };
            }

            if (aggregation !== 'count' && !yColumn) {
                return { success: false, error: 'Choose a numeric Y column or use Count.' };
            }

            const groups = new Map();
            currentRows.forEach((row) => {
                const label = valueOrDash(row[xColumn]);
                const rawValue = aggregation === 'count' ? 1 : row[yColumn];
                if (aggregation !== 'count' && !isNumericValue(rawValue)) {
                    return;
                }

                const value = aggregation === 'count' ? 1 : toNumber(rawValue);
                if (!groups.has(label)) {
                    groups.set(label, { label, count: 0, sum: 0, min: value, max: value });
                }

                const group = groups.get(label);
                group.count += 1;
                group.sum += value;
                group.min = Math.min(group.min, value);
                group.max = Math.max(group.max, value);
            });

            let points = Array.from(groups.values()).map((group) => ({
                label: group.label,
                value: aggregateValue(group, aggregation)
            }));

            if (chartType === 'line') {
                points = sortByLabel(points);
            } else {
                points.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
            }

            return {
                success: points.length > 0,
                error: 'No plottable values found for this selection.',
                points: points.slice(0, limit),
                mode: aggregation === 'count' ? 'Count by ' + xColumn : aggregation + '(' + yColumn + ') by ' + xColumn
            };
        }

        function aggregateValue(group, aggregation) {
            if (aggregation === 'sum') {
                return group.sum;
            }

            if (aggregation === 'avg') {
                return group.count ? group.sum / group.count : 0;
            }

            if (aggregation === 'min') {
                return group.min;
            }

            if (aggregation === 'max') {
                return group.max;
            }

            return group.count;
        }

        function buildScatterData(xColumn, yColumn, limit) {
            if (!xColumn || !yColumn) {
                return { success: false, error: 'Choose numeric X and Y columns.' };
            }

            const points = currentRows
                .filter((row) => isNumericValue(row[xColumn]) && isNumericValue(row[yColumn]))
                .slice(0, Math.max(limit, 25))
                .map((row) => ({
                    label: valueOrDash(row[xColumn]) + ', ' + valueOrDash(row[yColumn]),
                    x: toNumber(row[xColumn]),
                    y: toNumber(row[yColumn])
                }));

            return {
                success: points.length > 0,
                error: 'Scatter charts need numeric X and Y values.',
                points,
                mode: yColumn + ' vs ' + xColumn
            };
        }

        function buildHistogramData(xColumn, limit) {
            if (!xColumn) {
                return { success: false, error: 'Choose a numeric X column.' };
            }

            const values = currentRows.map((row) => row[xColumn]).filter(isNumericValue).map(toNumber);
            if (!values.length) {
                return { success: false, error: 'Histogram needs a numeric X column.' };
            }

            const min = Math.min(...values);
            const max = Math.max(...values);
            const binCount = Math.min(30, Math.max(5, limit));
            const binSize = max === min ? 1 : (max - min) / binCount;
            const bins = Array.from({ length: binCount }, (_, index) => ({
                label: formatCompactNumber(min + (index * binSize)) + ' - ' + formatCompactNumber(min + ((index + 1) * binSize)),
                value: 0
            }));

            values.forEach((value) => {
                const index = max === min ? 0 : Math.min(binCount - 1, Math.floor((value - min) / binSize));
                bins[index].value += 1;
            });

            return {
                success: true,
                points: bins,
                mode: 'Distribution of ' + xColumn
            };
        }

        function sortByLabel(points) {
            return points.slice().sort((a, b) => {
                const aNumber = Number(a.label);
                const bNumber = Number(b.label);
                if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
                    return aNumber - bNumber;
                }

                const aDate = Date.parse(a.label);
                const bDate = Date.parse(b.label);
                if (Number.isFinite(aDate) && Number.isFinite(bDate)) {
                    return aDate - bDate;
                }

                return String(a.label).localeCompare(String(b.label));
            });
        }

        function clearChart(svg) {
            while (svg.firstChild) {
                svg.removeChild(svg.firstChild);
            }
        }

        function svgElement(name, attributes) {
            const element = document.createElementNS(SVG_NS, name);
            Object.keys(attributes || {}).forEach((key) => {
                element.setAttribute(key, String(attributes[key]));
            });
            return element;
        }

        function appendSvgText(svg, x, y, text, className, anchor) {
            const element = svgElement('text', {
                x,
                y,
                class: className || 'chart-label',
                'text-anchor': anchor || 'middle'
            });
            element.textContent = text;
            svg.appendChild(element);
            return element;
        }

        function drawCategoryChart(svg, points, type) {
            const width = 900;
            const height = 420;
            const margin = { top: 28, right: 24, bottom: 86, left: 72 };
            const plotWidth = width - margin.left - margin.right;
            const plotHeight = height - margin.top - margin.bottom;
            const values = points.map((point) => point.value);
            const minValue = Math.min(0, ...values);
            const maxValue = Math.max(0, ...values);
            const range = maxValue - minValue || 1;
            const yScale = (value) => margin.top + ((maxValue - value) / range) * plotHeight;
            const baseline = yScale(0);

            drawAxes(svg, margin, width, height, baseline);
            drawYAxisTicks(svg, margin, plotWidth, minValue, maxValue, yScale);

            if (type === 'line') {
                drawLineSeries(svg, points, margin, plotWidth, yScale);
            } else {
                drawBars(svg, points, margin, plotWidth, baseline, yScale);
            }
        }

        function drawBars(svg, points, margin, plotWidth, baseline, yScale) {
            const band = plotWidth / Math.max(points.length, 1);
            const barWidth = Math.max(3, band * 0.62);

            points.forEach((point, index) => {
                const x = margin.left + index * band + (band - barWidth) / 2;
                const y = yScale(Math.max(point.value, 0));
                const height = Math.abs(yScale(point.value) - baseline);
                const rect = svgElement('rect', {
                    x,
                    y: point.value >= 0 ? y : baseline,
                    width: barWidth,
                    height: Math.max(1, height),
                    class: 'chart-bar'
                });
                const title = svgElement('title', {});
                title.textContent = point.label + ': ' + formatCompactNumber(point.value);
                rect.appendChild(title);
                svg.appendChild(rect);

                if (index % Math.ceil(points.length / 12) === 0) {
                    appendSvgText(svg, x + barWidth / 2, 358, truncateLabel(point.label), 'chart-axis-label', 'end')
                        .setAttribute('transform', 'rotate(-35 ' + (x + barWidth / 2) + ' 358)');
                }
            });
        }

        function drawLineSeries(svg, points, margin, plotWidth, yScale) {
            if (points.length === 1) {
                const onlyPoint = points[0];
                const x = margin.left + plotWidth / 2;
                const y = yScale(onlyPoint.value);
                svg.appendChild(svgElement('circle', { cx: x, cy: y, r: 5, class: 'chart-point' }));
                appendSvgText(svg, x, 358, truncateLabel(onlyPoint.label), 'chart-axis-label', 'middle');
                return;
            }

            const step = plotWidth / Math.max(points.length - 1, 1);
            const pathData = points.map((point, index) => {
                const x = margin.left + index * step;
                const y = yScale(point.value);
                return (index === 0 ? 'M ' : 'L ') + x + ' ' + y;
            }).join(' ');

            svg.appendChild(svgElement('path', { d: pathData, class: 'chart-line' }));
            points.forEach((point, index) => {
                const x = margin.left + index * step;
                const y = yScale(point.value);
                const circle = svgElement('circle', { cx: x, cy: y, r: 4, class: 'chart-point' });
                const title = svgElement('title', {});
                title.textContent = point.label + ': ' + formatCompactNumber(point.value);
                circle.appendChild(title);
                svg.appendChild(circle);

                if (index % Math.ceil(points.length / 10) === 0) {
                    appendSvgText(svg, x, 358, truncateLabel(point.label), 'chart-axis-label', 'end')
                        .setAttribute('transform', 'rotate(-35 ' + x + ' 358)');
                }
            });
        }

        function drawScatterChart(svg, points, xColumn, yColumn) {
            const width = 900;
            const height = 420;
            const margin = { top: 28, right: 24, bottom: 72, left: 72 };
            const plotWidth = width - margin.left - margin.right;
            const plotHeight = height - margin.top - margin.bottom;
            const minX = Math.min(...points.map((point) => point.x));
            const maxX = Math.max(...points.map((point) => point.x));
            const minY = Math.min(...points.map((point) => point.y));
            const maxY = Math.max(...points.map((point) => point.y));
            const xRange = maxX - minX || 1;
            const yRange = maxY - minY || 1;
            const xScale = (value) => margin.left + ((value - minX) / xRange) * plotWidth;
            const yScale = (value) => margin.top + ((maxY - value) / yRange) * plotHeight;

            drawAxes(svg, margin, width, height, margin.top + plotHeight);
            drawYAxisTicks(svg, margin, plotWidth, minY, maxY, yScale);
            drawXAxisTicks(svg, margin, plotWidth, plotHeight, minX, maxX, xScale);

            points.forEach((point) => {
                const circle = svgElement('circle', {
                    cx: xScale(point.x),
                    cy: yScale(point.y),
                    r: 4,
                    class: 'chart-point'
                });
                const title = svgElement('title', {});
                title.textContent = point.label;
                circle.appendChild(title);
                svg.appendChild(circle);
            });

            appendSvgText(svg, margin.left + plotWidth / 2, 404, xColumn, 'chart-axis-title', 'middle');
            appendSvgText(svg, 18, margin.top + plotHeight / 2, yColumn, 'chart-axis-title', 'middle')
                .setAttribute('transform', 'rotate(-90 18 ' + (margin.top + plotHeight / 2) + ')');
        }

        function drawAxes(svg, margin, width, height, baseline) {
            svg.appendChild(svgElement('line', {
                x1: margin.left,
                y1: margin.top,
                x2: margin.left,
                y2: height - margin.bottom,
                class: 'chart-axis'
            }));
            svg.appendChild(svgElement('line', {
                x1: margin.left,
                y1: baseline,
                x2: width - margin.right,
                y2: baseline,
                class: 'chart-axis'
            }));
        }

        function drawYAxisTicks(svg, margin, plotWidth, minValue, maxValue, yScale) {
            const tickCount = 5;
            for (let index = 0; index <= tickCount; index++) {
                const value = minValue + ((maxValue - minValue) * index / tickCount);
                const y = yScale(value);
                svg.appendChild(svgElement('line', {
                    x1: margin.left,
                    y1: y,
                    x2: margin.left + plotWidth,
                    y2: y,
                    class: 'chart-grid'
                }));
                appendSvgText(svg, margin.left - 10, y + 4, formatCompactNumber(value), 'chart-axis-label', 'end');
            }
        }

        function drawXAxisTicks(svg, margin, plotWidth, plotHeight, minValue, maxValue, xScale) {
            const tickCount = 5;
            for (let index = 0; index <= tickCount; index++) {
                const value = minValue + ((maxValue - minValue) * index / tickCount);
                const x = xScale(value);
                svg.appendChild(svgElement('line', {
                    x1: x,
                    y1: margin.top,
                    x2: x,
                    y2: margin.top + plotHeight,
                    class: 'chart-grid'
                }));
                appendSvgText(svg, x, margin.top + plotHeight + 22, formatCompactNumber(value), 'chart-axis-label', 'middle');
            }
        }

        function formatCompactNumber(value) {
            if (!Number.isFinite(value)) {
                return '-';
            }

            return Number(value.toPrecision(4)).toLocaleString();
        }

        function truncateLabel(value) {
            const text = String(value);
            return text.length > 16 ? text.slice(0, 15) + '...' : text;
        }

        function sqlIdentifier(value) {
            return '"' + String(value).replace(/"/g, '""') + '"';
        }

        function initializeTableViewState() {
            tableViewState = {
                columnOrder: currentColumns.slice(),
                visibleColumns: currentColumns.slice(),
                sortColumn: '',
                sortDirection: 'asc'
            };

        }

        function populateTableControls() {
            const sortColumn = document.getElementById('table-sort-column');
            const sortDirection = document.getElementById('table-sort-direction');

            populateSelect(sortColumn, currentColumns, tableViewState.sortColumn, 'None');
            if (sortDirection) {
                sortDirection.value = tableViewState.sortDirection;
            }
            renderColumnPickerList();
            updateColumnPickerSummary();
        }

        function renderColumnPickerList() {
            const list = document.getElementById('column-picker-list');
            if (!list) {
                return;
            }

            list.innerHTML = '';
            if (!tableViewState.columnOrder.length) {
                const empty = document.createElement('div');
                empty.className = 'column-picker-empty';
                empty.textContent = 'No columns';
                list.appendChild(empty);
                return;
            }

            tableViewState.columnOrder.forEach((column) => {
                const row = document.createElement('div');
                row.className = 'column-picker-row';
                row.tabIndex = 0;
                row.setAttribute('role', 'option');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = tableViewState.visibleColumns.includes(column);
                checkbox.dataset.column = column;
                checkbox.setAttribute('aria-label', 'Show ' + column);

                const label = document.createElement('span');
                label.className = 'column-picker-label';
                label.textContent = column;

                row.addEventListener('click', () => {
                    checkbox.checked = !checkbox.checked;
                    updateVisibleColumnsFromPicker();
                });
                row.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        checkbox.checked = !checkbox.checked;
                        updateVisibleColumnsFromPicker();
                    }
                });
                checkbox.addEventListener('click', (event) => {
                    event.stopPropagation();
                });
                checkbox.addEventListener('change', updateVisibleColumnsFromPicker);

                row.appendChild(checkbox);
                row.appendChild(label);
                list.appendChild(row);
            });
        }

        function updateColumnPickerSummary() {
            const summary = document.getElementById('column-picker-summary');
            if (!summary) {
                return;
            }

            const visibleCount = getVisibleOrderedColumns().length;
            summary.textContent = visibleCount + ' of ' + currentColumns.length + ' columns';
        }

        function updateVisibleColumnsFromPicker() {
            const list = document.getElementById('column-picker-list');
            tableViewState.visibleColumns = list
                ? Array.from(list.querySelectorAll('input[type="checkbox"]'))
                    .filter((checkbox) => checkbox.checked)
                    .map((checkbox) => checkbox.dataset.column || '')
                    .filter(Boolean)
                : currentColumns.slice();

            if (!tableViewState.visibleColumns.length) {
                tableViewState.visibleColumns = tableViewState.columnOrder.slice();
            }

            populateTableControls();
            applyTableView();
        }

        function getVisibleOrderedColumns() {
            return tableViewState.columnOrder.filter((column) => tableViewState.visibleColumns.includes(column));
        }

        function getSortedRows() {
            const rows = currentRows.slice();
            const sortColumn = tableViewState.sortColumn;
            if (!sortColumn) {
                return rows;
            }

            const direction = tableViewState.sortDirection === 'desc' ? -1 : 1;
            rows.sort((a, b) => compareValues(a[sortColumn], b[sortColumn]) * direction);
            return rows;
        }

        function compareValues(a, b) {
            if (a === b) {
                return 0;
            }

            if (a === null || a === undefined) {
                return 1;
            }

            if (b === null || b === undefined) {
                return -1;
            }

            if (isNumericValue(a) && isNumericValue(b)) {
                return toNumber(a) - toNumber(b);
            }

            const aDate = Date.parse(String(a));
            const bDate = Date.parse(String(b));
            if (Number.isFinite(aDate) && Number.isFinite(bDate)) {
                return aDate - bDate;
            }

            return String(a).localeCompare(String(b));
        }

        function applyTableView() {
            const visibleColumns = getVisibleOrderedColumns();
            createTable(visibleColumns, getSortedRows());
            document.getElementById('column-count').textContent = visibleColumns.length;
        }

        function updateTableViewFromControls() {
            const sortColumn = document.getElementById('table-sort-column');
            const sortDirection = document.getElementById('table-sort-direction');
            const columnPickerList = document.getElementById('column-picker-list');

            tableViewState.sortColumn = sortColumn ? sortColumn.value : '';
            tableViewState.sortDirection = sortDirection && sortDirection.value === 'desc' ? 'desc' : 'asc';
            tableViewState.visibleColumns = columnPickerList
                ? Array.from(columnPickerList.querySelectorAll('input[type="checkbox"]'))
                    .filter((checkbox) => checkbox.checked)
                    .map((checkbox) => checkbox.dataset.column || '')
                    .filter(Boolean)
                : currentColumns.slice();

            if (!tableViewState.visibleColumns.length) {
                tableViewState.visibleColumns = tableViewState.columnOrder.slice();
                populateTableControls();
            }

            updateColumnPickerSummary();
            applyTableView();
        }

        function showAllColumns() {
            tableViewState.visibleColumns = tableViewState.columnOrder.slice();
            populateTableControls();
            applyTableView();
        }

        function resetTableViewPreference() {
            tableViewState = {
                columnOrder: currentColumns.slice(),
                visibleColumns: currentColumns.slice(),
                sortColumn: '',
                sortDirection: 'asc'
            };

            populateTableControls();
            applyTableView();
            setStatus('Table view reset', 'status-success');
        }

        function populateQuickAggregationControls() {
            const groupColumn = document.getElementById('aggregation-group-column');
            const valueColumn = document.getElementById('aggregation-value-column');
            populateSelect(groupColumn, currentColumns, currentColumns[0] || '', 'None');
            populateSelect(valueColumn, getNumericColumns(), getNumericColumns()[0] || '', 'None');
            syncAggregationControls();
        }

        function syncAggregationControls() {
            const aggregationFunction = document.getElementById('aggregation-function');
            const valueColumnLabel = document.getElementById('aggregation-value-column-label');
            const valueColumn = document.getElementById('aggregation-value-column');
            if (!aggregationFunction || !valueColumn) {
                return;
            }

            const metricRequired = aggregationFunction.value !== 'count';
            valueColumn.disabled = !metricRequired;
            if (valueColumnLabel) {
                valueColumnLabel.classList.toggle('hidden', !metricRequired);
            }
        }

        function runQuickAggregation() {
            const groupColumn = document.getElementById('aggregation-group-column');
            const valueColumn = document.getElementById('aggregation-value-column');
            const aggregationFunction = document.getElementById('aggregation-function');
            const aggregationLimit = document.getElementById('aggregation-limit');
            const queryInput = document.getElementById('query-input');
            const aggregate = aggregationFunction ? aggregationFunction.value : 'count';
            const group = groupColumn ? groupColumn.value : '';
            const metric = valueColumn ? valueColumn.value : '';
            const limit = Math.min(1000, Math.max(1, Number(aggregationLimit ? aggregationLimit.value : 100) || 100));

            if (aggregate !== 'count' && !metric) {
                setStatus('Choose a numeric metric column', 'status-error');
                return;
            }

            const metricExpression = aggregate === 'count'
                ? 'COUNT(*) AS row_count'
                : aggregate.toUpperCase() + '(' + sqlIdentifier(metric) + ') AS ' + sqlIdentifier(aggregate + '_' + metric);
            const orderAlias = aggregate === 'count' ? 'row_count' : aggregate + '_' + metric;
            const query = group
                ? 'SELECT ' + sqlIdentifier(group) + ', ' + metricExpression + ' FROM file_data GROUP BY ' + sqlIdentifier(group) + ' ORDER BY ' + sqlIdentifier(orderAlias) + ' DESC LIMIT ' + limit
                : 'SELECT ' + metricExpression + ' FROM file_data';

            currentQuery = query;
            if (queryInput) {
                queryInput.value = query;
            }
            setLoading('Running aggregation...');
            vscode.postMessage({
                type: 'query',
                query,
                selectedRelation: getSelectedRelationPayload(),
                sourceOptions: getSourceOptionsPayload()
            });
        }

        function resetQuickAggregation() {
            const aggregationFunction = document.getElementById('aggregation-function');
            const aggregationLimit = document.getElementById('aggregation-limit');
            const queryInput = document.getElementById('query-input');

            populateQuickAggregationControls();
            if (aggregationFunction) {
                aggregationFunction.value = 'count';
            }
            if (aggregationLimit) {
                aggregationLimit.value = '100';
            }
            syncAggregationControls();

            currentQuery = DEFAULT_QUERY;
            if (queryInput) {
                queryInput.value = currentQuery;
            }
            setLoading('Resetting aggregation...');
            vscode.postMessage({
                type: 'query',
                query: currentQuery,
                selectedRelation: getSelectedRelationPayload(),
                sourceOptions: getSourceOptionsPayload()
            });
        }

        function resetJoinState() {
            currentJoinMetadata = null;
            currentJoinResult = null;
            document.getElementById('join-controls').classList.add('hidden');
            document.getElementById('join-summary').classList.add('hidden');
            document.getElementById('join-results').classList.add('hidden');
            document.getElementById('join-error').classList.add('hidden');
            document.getElementById('join-empty').textContent = 'Choose another supported data file to join.';
            document.getElementById('join-empty').classList.remove('hidden');
            document.getElementById('join-table-header').innerHTML = '';
            document.getElementById('join-table-body').innerHTML = '';
        }

        function handleJoinMetadata(result) {
            if (!result || !result.success) {
                resetJoinState();
                document.getElementById('join-error').textContent = result && result.error ? result.error : 'Could not read join columns.';
                document.getElementById('join-error').classList.remove('hidden');
                setStatus(result && result.error ? result.error : 'Could not read join columns', 'status-error');
                return;
            }

            currentJoinMetadata = result;
            currentJoinResult = null;
            document.getElementById('join-error').classList.add('hidden');
            document.getElementById('join-controls').classList.remove('hidden');
            document.getElementById('join-summary').classList.remove('hidden');
            document.getElementById('join-results').classList.add('hidden');
            document.getElementById('join-empty').textContent = 'Choose keys, then preview the join.';
            document.getElementById('join-empty').classList.remove('hidden');
            document.getElementById('join-selected-file').textContent = result.joinPath || 'Join file selected';
            populateJoinColumnOptions(result);
            setStatus('Join file loaded', 'status-success');
        }

        function populateJoinColumnOptions(metadata) {
            const baseSelect = document.getElementById('join-base-column');
            const joinSelect = document.getElementById('join-other-column');
            const baseColumns = (metadata.baseColumns || []).map((column) => column.name);
            const joinColumns = (metadata.joinColumns || []).map((column) => column.name);
            populateSelect(baseSelect, baseColumns, baseColumns[0] || '', '');
            populateSelect(joinSelect, joinColumns, joinColumns[0] || '', '');

            const sameName = baseColumns.find((column) => joinColumns.includes(column));
            if (sameName) {
                baseSelect.value = sameName;
                joinSelect.value = sameName;
            }
        }

        function runJoinPreview() {
            if (!currentJoinMetadata || !currentJoinMetadata.success) {
                setStatus('Choose a join file first', 'status-error');
                return;
            }

            const baseColumn = document.getElementById('join-base-column').value;
            const joinColumn = document.getElementById('join-other-column').value;
            const joinType = document.getElementById('join-type').value;
            const limit = Math.min(1000, Math.max(1, Number(document.getElementById('join-limit').value) || 100));

            if (!baseColumn || !joinColumn) {
                setStatus('Choose join keys first', 'status-error');
                return;
            }

            setActiveView('join');
            setStatus('Previewing join...', 'status-loading');
            vscode.postMessage({
                type: 'runJoin',
                options: { baseColumn, joinColumn, joinType, limit },
                selectedRelation: getSelectedRelationPayload(),
                sourceOptions: getSourceOptionsPayload()
            });
        }

        function handleJoinResult(result) {
            if (!result || !result.success) {
                document.getElementById('join-error').textContent = result && result.error ? result.error : 'Join failed.';
                document.getElementById('join-error').classList.remove('hidden');
                document.getElementById('join-results').classList.add('hidden');
                setStatus(result && result.error ? result.error : 'Join failed', 'status-error');
                return;
            }

            currentJoinResult = result;
            currentJoinMetadata = result;
            document.getElementById('join-error').classList.add('hidden');
            document.getElementById('join-empty').classList.add('hidden');
            document.getElementById('join-summary').classList.remove('hidden');
            document.getElementById('join-results').classList.remove('hidden');
            document.getElementById('join-selected-file').textContent = result.joinPath || 'Join file selected';
            document.getElementById('join-row-count').textContent = formatCount(result.rowCount);
            document.getElementById('join-total-rows').textContent = formatCount(result.totalRows);
            document.getElementById('join-column-count').textContent = formatCount((result.columns || []).length);
            createJoinTable(result.columns || [], result.data || []);
            setStatus('Join preview loaded' + (result.resultLimited ? ' (limited)' : ''), 'status-success');
        }

        function createJoinTable(columns, rows) {
            const header = document.getElementById('join-table-header');
            const body = document.getElementById('join-table-body');
            header.innerHTML = '';
            body.innerHTML = '';

            const headerRow = document.createElement('tr');
            columns.forEach((column) => {
                const cell = document.createElement('th');
                cell.textContent = column;
                cell.title = column;
                headerRow.appendChild(cell);
            });
            header.appendChild(headerRow);

            if (!rows.length) {
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = Math.max(columns.length, 1);
                cell.className = 'empty-value';
                cell.textContent = 'No joined rows matched.';
                row.appendChild(cell);
                body.appendChild(row);
                return;
            }

            rows.forEach((rowData) => {
                const row = document.createElement('tr');
                columns.forEach((column) => {
                    const cell = document.createElement('td');
                    const value = rowData[column];
                    cell.textContent = value === null || value === undefined ? 'NULL' : String(value);
                    row.appendChild(cell);
                });
                body.appendChild(row);
            });
        }

        function exportJoinPreview() {
            if (!currentJoinResult || !currentJoinResult.success) {
                setStatus('Preview a join before exporting', 'status-error');
                return;
            }

            vscode.postMessage({
                type: 'exportJoinPreview',
                columns: currentJoinResult.columns || [],
                rows: currentJoinResult.data || []
            });
        }

        function setLoading(message) {
            const statusElement = document.getElementById('status');
            const loadingContainer = document.getElementById('loading-container');
            const dataContainer = document.getElementById('data-container');
            const errorContainer = document.getElementById('error-container');
            
            statusElement.textContent = message;
            statusElement.className = 'status status-loading';
            loadingContainer.classList.remove('hidden');
            dataContainer.classList.add('hidden');
            errorContainer.classList.add('hidden');
        }

        function setStatus(message, statusClass) {
            const statusElement = document.getElementById('status');
            statusElement.textContent = message;
            statusElement.className = 'status ' + statusClass;
        }

        function setExportMessage(message, isError) {
            const exportMessage = document.getElementById('export-message');
            if (!exportMessage) {
                return;
            }

            if (!message) {
                exportMessage.classList.add('hidden');
                exportMessage.textContent = '';
                return;
            }

            exportMessage.textContent = message;
            exportMessage.classList.toggle('export-message-error', Boolean(isError));
            exportMessage.classList.remove('hidden');
        }

        function refreshExportPanel() {
            const queryInput = document.getElementById('query-input');
            const sourceType = document.getElementById('export-source-type');
            const rowCount = document.getElementById('export-row-count');
            const querySummary = document.getElementById('export-query-summary');
            const exportButtons = document.querySelectorAll('[data-export-format]');

            if (sourceType) {
                sourceType.textContent = formatFileTypeLabel(currentSourceFormat || currentFileType);
            }
            if (rowCount) {
                const loadedEnd = currentOffset + currentRows.length;
                rowCount.textContent = currentHasMore ? formatCount(loadedEnd) + '+' : formatCount(loadedEnd);
            }
            if (querySummary) {
                const queryText = queryInput ? queryInput.value.trim() || DEFAULT_QUERY : currentQuery || DEFAULT_QUERY;
                querySummary.textContent = queryText;
            }
            exportButtons.forEach((button) => {
                const format = button.dataset.exportFormat;
                const isCurrentFormat = format === currentSourceFormat;
                button.hidden = isCurrentFormat;
                button.disabled = isCurrentFormat;
            });
        }

        function exportCurrentQuery(format) {
            const queryInput = document.getElementById('query-input');
            currentQuery = queryInput ? queryInput.value.trim() || DEFAULT_QUERY : DEFAULT_QUERY;
            refreshExportPanel();
            setExportMessage('Exporting ' + formatExportLabel(format) + '...', false);
            setStatus('Exporting ' + formatExportLabel(format) + '...', 'status-loading');
            vscode.postMessage({
                type: 'export',
                format,
                query: currentQuery,
                selectedRelation: getSelectedRelationPayload(),
                relations: currentRelations,
                sourceOptions: getSourceOptionsPayload()
            });
        }

        function handleExportResult(result) {
            if (!result || !result.success) {
                if (result && result.error === 'Export cancelled.') {
                    setExportMessage('Export cancelled', false);
                    setStatus('Export cancelled', 'status-success');
                } else {
                    setExportMessage(result && result.error ? result.error : 'Export failed', true);
                    setStatus(result && result.error ? result.error : 'Export failed', 'status-error');
                }
                return;
            }

            const message = result.filesExported
                ? 'Exported ' + formatCount(result.filesExported) + ' files with ' + formatCount(result.rowsExported) + ' rows to ZIP'
                : 'Exported ' + formatCount(result.rowsExported) + ' rows to ' + formatExportLabel(result.format);
            setExportMessage(message, false);
            setStatus(message, 'status-success');
        }

        function cloneRows(rows) {
            return JSON.parse(JSON.stringify(rows || []));
        }

        function resetEditColumnNames() {
            editColumnNames = currentColumns.slice();
        }

        function getRenamedColumnCount() {
            return currentColumns.reduce((count, column, index) => {
                return count + (editColumnNames[index] !== column ? 1 : 0);
            }, 0);
        }

        function validateEditColumnNames() {
            const normalizedNames = editColumnNames.map((column) => String(column || '').trim());
            const emptyIndex = normalizedNames.findIndex((column) => !column);

            if (emptyIndex >= 0) {
                return {
                    success: false,
                    error: 'Column ' + (emptyIndex + 1) + ' needs a name before saving.'
                };
            }

            const seen = new Set();
            const duplicateName = normalizedNames.find((column) => {
                const key = column.toLowerCase();
                if (seen.has(key)) {
                    return true;
                }
                seen.add(key);
                return false;
            });

            if (duplicateName) {
                return {
                    success: false,
                    error: 'Column names must be unique before saving. Duplicate: ' + duplicateName
                };
            }

            return {
                success: true,
                columns: normalizedNames
            };
        }

        function buildRenamedEditRows(outputColumns) {
            return editRows.map((row) => {
                const renamedRow = {};
                currentColumns.forEach((sourceColumn, index) => {
                    renamedRow[outputColumns[index]] = row[sourceColumn];
                });
                return renamedRow;
            });
        }

        function formatEditableValue(value) {
            if (value === null || value === undefined) {
                return 'NULL';
            }

            if (typeof value === 'object') {
                return JSON.stringify(value);
            }

            return String(value);
        }

        function parseEditedValue(rawValue, originalValue) {
            const text = String(rawValue);
            const trimmed = text.trim();

            if (trimmed.toLowerCase() === 'null') {
                return null;
            }

            if (typeof originalValue === 'number') {
                const numericValue = Number(trimmed);
                return Number.isNaN(numericValue) ? text : numericValue;
            }

            if (typeof originalValue === 'boolean') {
                if (trimmed.toLowerCase() === 'true') {
                    return true;
                }

                if (trimmed.toLowerCase() === 'false') {
                    return false;
                }

                return text;
            }

            if (typeof originalValue === 'object' && originalValue !== null) {
                try {
                    return JSON.parse(trimmed);
                } catch {
                    return text;
                }
            }

            return text;
        }

        function valuesMatch(left, right) {
            return JSON.stringify(left) === JSON.stringify(right);
        }

        function countEditedCells() {
            let changes = getRenamedColumnCount() + Math.abs(editRows.length - currentRows.length) * Math.max(currentColumns.length, 1);
            const rowCount = Math.min(editRows.length, currentRows.length);

            for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
                currentColumns.forEach((column) => {
                    const originalValue = currentRows[rowIndex] ? currentRows[rowIndex][column] : undefined;
                    const editedValue = editRows[rowIndex] ? editRows[rowIndex][column] : undefined;
                    if (!valuesMatch(originalValue, editedValue)) {
                        changes++;
                    }
                });
            }

            return changes;
        }

        function updateEditSummary() {
            const rowCount = document.getElementById('edit-row-count');
            const columnCount = document.getElementById('edit-column-count');
            const changeCount = document.getElementById('edit-change-count');
            const renamedColumnCount = document.getElementById('edit-renamed-column-count');

            if (rowCount) {
                rowCount.textContent = formatCount(editRows.length);
            }

            if (columnCount) {
                columnCount.textContent = formatCount(currentColumns.length);
            }

            if (changeCount) {
                changeCount.textContent = formatCount(countEditedCells());
            }

            if (renamedColumnCount) {
                renamedColumnCount.textContent = formatCount(getRenamedColumnCount());
            }
        }

        function renderEditPanel() {
            const tableHeader = document.getElementById('edit-table-header');
            const tableBody = document.getElementById('edit-table-body');
            const resultMessage = document.getElementById('edit-result-message');

            tableHeader.innerHTML = '';
            tableBody.innerHTML = '';
            resultMessage.classList.add('hidden');
            resultMessage.textContent = '';

            const headerRow = document.createElement('tr');
            const actionHeader = document.createElement('th');
            actionHeader.textContent = '';
            actionHeader.className = 'edit-action-column';
            headerRow.appendChild(actionHeader);

            currentColumns.forEach((column, columnIndex) => {
                const th = document.createElement('th');
                th.className = 'edit-column-name-cell';
                th.title = 'Original column: ' + column;

                const label = document.createElement('span');
                label.className = 'edit-column-original-name';
                label.textContent = column;

                const input = document.createElement('input');
                input.className = 'edit-column-name-input';
                input.dataset.columnIndex = String(columnIndex);
                input.value = editColumnNames[columnIndex] || column;
                input.title = 'Saved column name';

                th.appendChild(label);
                th.appendChild(input);
                headerRow.appendChild(th);
            });
            tableHeader.appendChild(headerRow);

            if (!currentColumns.length) {
                const emptyRow = document.createElement('tr');
                const emptyCell = document.createElement('td');
                emptyCell.colSpan = 1;
                emptyCell.className = 'empty-value';
                emptyCell.textContent = 'No editable data loaded';
                emptyRow.appendChild(emptyCell);
                tableBody.appendChild(emptyRow);
                updateEditSummary();
                return;
            }

            if (!editRows.length) {
                const emptyRow = document.createElement('tr');
                const emptyCell = document.createElement('td');
                emptyCell.colSpan = currentColumns.length + 1;
                emptyCell.className = 'empty-value';
                emptyCell.textContent = 'No rows. Add a row to create data.';
                emptyRow.appendChild(emptyCell);
                tableBody.appendChild(emptyRow);
                updateEditSummary();
                return;
            }

            editRows.forEach((row, rowIndex) => {
                const tr = document.createElement('tr');
                const actionCell = document.createElement('td');
                actionCell.className = 'edit-action-column';

                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'btn btn-danger edit-delete-row-btn';
                deleteButton.textContent = 'Delete';
                deleteButton.dataset.rowIndex = String(rowIndex);
                actionCell.appendChild(deleteButton);
                tr.appendChild(actionCell);

                currentColumns.forEach((column) => {
                    const td = document.createElement('td');
                    td.className = 'edit-cell';

                    const input = document.createElement('input');
                    input.className = 'edit-cell-input';
                    input.dataset.rowIndex = String(rowIndex);
                    input.dataset.column = column;
                    input.value = formatEditableValue(row[column]);
                    input.title = column;
                    td.appendChild(input);
                    tr.appendChild(td);
                });

                tableBody.appendChild(tr);
            });

            updateEditSummary();
        }

        function resetEditRows() {
            editRows = cloneRows(currentRows);
            renderEditPanel();
            setStatus('Edits reset', 'status-success');
        }

        function addEditRow() {
            if (!currentColumns.length) {
                setStatus('Load data before adding rows', 'status-error');
                return;
            }

            const row = {};
            currentColumns.forEach((column) => {
                row[column] = null;
            });
            editRows.push(row);
            renderEditPanel();
        }

        function deleteEditRow(rowIndex) {
            editRows.splice(rowIndex, 1);
            renderEditPanel();
        }

        function saveEditedData() {
            if (!currentColumns.length) {
                setStatus('No editable data loaded', 'status-error');
                return;
            }

            const columnValidation = validateEditColumnNames();
            if (!columnValidation.success) {
                setStatus(columnValidation.error, 'status-error');
                const message = document.getElementById('edit-result-message');
                if (message) {
                    message.textContent = columnValidation.error;
                    message.className = 'edit-message edit-message-error';
                    message.classList.remove('hidden');
                }
                return;
            }

            setStatus('Saving edited ' + formatFileTypeLabel(currentSourceFormat || currentFileType) + '...', 'status-loading');
            vscode.postMessage({
                type: 'saveEditedData',
                sourceFormat: currentSourceFormat || currentFileType,
                columns: columnValidation.columns,
                rows: buildRenamedEditRows(columnValidation.columns)
            });
        }

        function handleEditSaveResult(result) {
            const message = document.getElementById('edit-result-message');

            if (!result || !result.success) {
                if (result && result.error === 'Save cancelled.') {
                    setStatus('Save cancelled', 'status-success');
                } else {
                    setStatus(result && result.error ? result.error : 'Save failed', 'status-error');
                }

                if (message) {
                    message.textContent = result && result.error ? result.error : 'Save failed';
                    message.className = 'edit-message edit-message-error';
                    message.classList.remove('hidden');
                }
                return;
            }

            const formatLabel = formatExportLabel(result.format || 'parquet');
            const outputPath = result.outputPath || 'the new ' + formatLabel + ' file';
            const successText = 'Saved ' + formatCount(result.rowsExported) + ' rows as a new ' + formatLabel + ' file. To view the changes, open ' + outputPath + '.';
            setStatus('Saved new ' + formatLabel, 'status-success');

            if (message) {
                message.textContent = successText;
                message.className = 'edit-message edit-message-success';
                message.classList.remove('hidden');
            }
        }

        function handleCompareResult(result) {
            if (result && result.error === 'Compare cancelled.') {
                resetCompareState();
                setStatus('Compare cancelled', 'status-success');
                return;
            }

            currentCompareResult = result;
            renderCompareResult(result);

            if (!result || !result.success) {
                setStatus(result && result.error ? result.error : 'Compare failed', 'status-error');
                return;
            }

            setActiveView('compare');
            const resultLabel = result.diffMode === 'smart' ? 'Smart Diff found ' : 'Found ';
            setStatus(
                resultLabel + formatCount(result.mismatchCount) + ' mismatched rows',
                result.mismatchCount ? 'status-error' : 'status-success'
            );
        }

        function resetCompareState() {
            currentCompareResult = null;
            currentCompareMetadata = null;

            document.getElementById('compare-error').classList.add('hidden');
            document.getElementById('compare-smart-summary').classList.add('hidden');
            document.getElementById('compare-summary').classList.add('hidden');
            document.getElementById('compare-results').classList.add('hidden');
            document.getElementById('compare-order-panel').classList.add('hidden');
            document.getElementById('compare-mapping-panel').classList.add('hidden');
            document.getElementById('compare-empty').textContent = 'Choose another data file to compare.';
            document.getElementById('compare-empty').classList.remove('hidden');
            document.getElementById('compare-selected-file').textContent = 'No compare file selected';
            document.getElementById('compare-base-order-select').innerHTML = '';
            document.getElementById('compare-other-order-select').innerHTML = '';
            document.getElementById('compare-base-column-list').innerHTML = '';
            document.getElementById('compare-other-column-list').innerHTML = '';
            document.getElementById('compare-mapping-list').innerHTML = '';
            clearCompareTables();
        }

        function handleCompareMetadata(result) {
            currentCompareMetadata = result;

            if (!result || !result.success) {
                renderCompareResult(result);
                setStatus(result && result.error ? result.error : 'Could not load compare columns', 'status-error');
                return;
            }

            document.getElementById('compare-error').classList.add('hidden');
            document.getElementById('compare-smart-summary').classList.add('hidden');
            document.getElementById('compare-summary').classList.add('hidden');
            document.getElementById('compare-results').classList.add('hidden');
            document.getElementById('compare-empty').textContent = 'Select an order column, then run compare.';
            document.getElementById('compare-empty').classList.remove('hidden');
            clearCompareTables();
            renderCompareMappingPanel(result);
            setStatus('Compare file loaded', 'status-success');
        }

        function renderCompareMappingPanel(metadata) {
            const mappingPanel = document.getElementById('compare-mapping-panel');
            const selectedFile = document.getElementById('compare-selected-file');
            selectedFile.textContent = metadata.comparePath || 'Compare file selected';
            renderCompareOrderControls(metadata);
            renderCompareColumnList('compare-base-column-list', metadata.baseColumns || []);
            renderCompareColumnList('compare-other-column-list', metadata.compareColumns || []);
            renderCompareMappingRows(metadata);

            if (document.getElementById('custom-compare-toggle').checked) {
                mappingPanel.classList.remove('hidden');
            }
        }

        function renderCompareOrderControls(metadata) {
            const orderPanel = document.getElementById('compare-order-panel');
            const baseSelect = document.getElementById('compare-base-order-select');
            const compareSelect = document.getElementById('compare-other-order-select');
            const baseColumns = metadata.baseColumns || [];

            baseSelect.innerHTML = '';
            compareSelect.innerHTML = '';

            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = 'Select order column';
            baseSelect.appendChild(emptyOption);

            baseColumns.forEach((column) => {
                const option = document.createElement('option');
                option.value = column.name;
                option.textContent = column.name + ' - ' + getCompareColumnTypeLabel(column);
                baseSelect.appendChild(option);
            });

            baseSelect.onchange = () => {
                populateCompareOrderOptions(metadata);
            };

            if (baseColumns.length) {
                baseSelect.value = baseColumns[0].name;
                populateCompareOrderOptions(metadata);
            }

            orderPanel.classList.remove('hidden');
        }

        function populateCompareOrderOptions(metadata) {
            const baseSelect = document.getElementById('compare-base-order-select');
            const compareSelect = document.getElementById('compare-other-order-select');
            const baseColumn = (metadata.baseColumns || []).find((column) => column.name === baseSelect.value);
            compareSelect.innerHTML = '';
            compareSelect.disabled = false;

            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = 'Select order column';
            compareSelect.appendChild(emptyOption);

            if (!baseColumn) {
                return;
            }

            (metadata.compareColumns || []).forEach((column) => {
                const option = document.createElement('option');
                option.value = column.name;
                option.textContent = column.name + ' - ' + getCompareColumnTypeLabel(column);
                option.disabled = column.typeSignature !== baseColumn.typeSignature;
                compareSelect.appendChild(option);
            });

            const sameNameOption = Array.from(compareSelect.options).find((option) => option.value === baseColumn.name && !option.disabled);
            if (sameNameOption) {
                compareSelect.value = baseColumn.name;
            }
        }

        function renderCompareColumnList(elementId, columns) {
            const list = document.getElementById(elementId);
            list.innerHTML = '';

            if (!columns.length) {
                const empty = document.createElement('div');
                empty.className = 'empty-value';
                empty.textContent = 'No columns found';
                list.appendChild(empty);
                return;
            }

            columns.forEach((column) => {
                const item = document.createElement('div');
                item.className = 'compare-column-item';

                const name = document.createElement('span');
                name.textContent = column.name;
                name.title = column.path || column.name;

                const type = document.createElement('code');
                type.textContent = getCompareColumnTypeLabel(column);

                item.appendChild(name);
                item.appendChild(type);
                list.appendChild(item);
            });
        }

        function renderCompareMappingRows(metadata) {
            const mappingList = document.getElementById('compare-mapping-list');
            const baseColumns = metadata.baseColumns || [];
            const compareColumns = metadata.compareColumns || [];
            mappingList.innerHTML = '';

            if (!baseColumns.length || !compareColumns.length) {
                const empty = document.createElement('div');
                empty.className = 'empty-value';
                empty.textContent = 'No columns available for mapping';
                mappingList.appendChild(empty);
                return;
            }

            const header = document.createElement('div');
            header.className = 'compare-mapping-row compare-mapping-row-header';
            ['Current column', 'Compare column', 'Type'].forEach((label) => {
                const item = document.createElement('span');
                item.textContent = label;
                header.appendChild(item);
            });
            mappingList.appendChild(header);

            baseColumns.forEach((baseColumn) => {
                const row = document.createElement('div');
                row.className = 'compare-mapping-row';

                const base = document.createElement('div');
                base.className = 'compare-mapping-base';
                base.textContent = baseColumn.name;
                base.title = getCompareColumnTypeLabel(baseColumn);

                const select = document.createElement('select');
                select.dataset.baseColumn = baseColumn.name;

                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = 'Skip';
                select.appendChild(emptyOption);

                compareColumns.forEach((compareColumn) => {
                    const option = document.createElement('option');
                    option.value = compareColumn.name;
                    option.textContent = compareColumn.name + ' - ' + getCompareColumnTypeLabel(compareColumn);
                    option.disabled = baseColumn.typeSignature !== compareColumn.typeSignature;

                    if (baseColumn.name === compareColumn.name && !option.disabled) {
                        option.selected = true;
                    }

                    select.appendChild(option);
                });

                const type = document.createElement('code');
                type.textContent = getCompareColumnTypeLabel(baseColumn);

                row.appendChild(base);
                row.appendChild(select);
                row.appendChild(type);
                mappingList.appendChild(row);
            });
        }

        function getCompareColumnTypeLabel(column) {
            return valueOrDash(column.logicalType || column.duckdbType || column.physicalType);
        }

        function collectCompareMappings() {
            const selects = Array.from(document.querySelectorAll('#compare-mapping-list select'));
            return selects
                .filter((select) => select.value)
                .map((select) => ({
                    baseColumn: select.dataset.baseColumn,
                    compareColumn: select.value
                }));
        }

        function collectCompareOrderMapping() {
            const baseSelect = document.getElementById('compare-base-order-select');
            const compareSelect = document.getElementById('compare-other-order-select');

            if (!baseSelect || !compareSelect || !baseSelect.value || !compareSelect.value) {
                return null;
            }

            return {
                baseColumn: baseSelect.value,
                compareColumn: compareSelect.value
            };
        }

        function renderSmartDiffSummary(result) {
            const summaryElement = document.getElementById('compare-smart-summary');
            const skippedElement = document.getElementById('smart-skipped-columns');
            const smartDiff = result && result.smartDiff;

            if (!summaryElement || !smartDiff) {
                if (summaryElement) {
                    summaryElement.classList.add('hidden');
                }
                return;
            }

            const keyMapping = smartDiff.keyMapping || result.orderMapping || {};
            const keyText = keyMapping.baseColumn && keyMapping.compareColumn
                ? 'Key: ' + keyMapping.baseColumn + (keyMapping.baseColumn === keyMapping.compareColumn ? '' : ' -> ' + keyMapping.compareColumn)
                : 'Key: inferred';

            document.getElementById('smart-diff-key').textContent = keyText;
            document.getElementById('smart-mapped-columns').textContent = formatCount(smartDiff.mappedColumns);
            document.getElementById('smart-fuzzy-columns').textContent = formatCount(smartDiff.fuzzyMatches);
            document.getElementById('smart-inserted-rows').textContent = formatCount(smartDiff.insertedRows);
            document.getElementById('smart-deleted-rows').textContent = formatCount(smartDiff.deletedRows);
            document.getElementById('smart-changed-rows').textContent = formatCount(smartDiff.changedRows);
            document.getElementById('smart-unchanged-rows').textContent = formatCount(smartDiff.unchangedRows);

            const skippedBase = smartDiff.skippedBaseColumns || [];
            const skippedCompare = smartDiff.skippedCompareColumns || [];
            if (skippedBase.length || skippedCompare.length) {
                skippedElement.textContent = 'Skipped unmapped columns: current file ' + formatCount(skippedBase.length) + ', compare file ' + formatCount(skippedCompare.length) + '.';
                skippedElement.classList.remove('hidden');
            } else {
                skippedElement.textContent = '';
                skippedElement.classList.add('hidden');
            }

            summaryElement.classList.remove('hidden');
        }

        function renderCompareResult(result) {
            const errorElement = document.getElementById('compare-error');
            const smartSummaryElement = document.getElementById('compare-smart-summary');
            const summaryElement = document.getElementById('compare-summary');
            const emptyElement = document.getElementById('compare-empty');
            const resultsElement = document.getElementById('compare-results');

            errorElement.classList.add('hidden');
            smartSummaryElement.classList.add('hidden');
            summaryElement.classList.add('hidden');
            resultsElement.classList.add('hidden');
            emptyElement.classList.remove('hidden');

            if (!result) {
                emptyElement.textContent = 'Choose another data file to compare.';
                return;
            }

            if (!result.success) {
                emptyElement.classList.add('hidden');
                errorElement.textContent = result.error || 'Compare failed';
                errorElement.classList.remove('hidden');
                clearCompareTables();
                setActiveView('compare');
                return;
            }

            document.getElementById('compare-base-rows').textContent = formatCount(result.totalRowsBase);
            document.getElementById('compare-other-rows').textContent = formatCount(result.totalRowsCompare);
            document.getElementById('compare-rows-checked').textContent = formatCount(result.rowsCompared);
            document.getElementById('compare-mismatch-count').textContent = formatCount(result.mismatchCount);
            renderSmartDiffSummary(result);
            summaryElement.classList.remove('hidden');
            emptyElement.classList.add('hidden');
            resultsElement.classList.remove('hidden');

            if (result.truncated) {
                errorElement.textContent = 'Showing first ' + formatCount(result.mismatchLimit) + ' mismatches.';
                errorElement.classList.remove('hidden');
            }

            createCompareTables(result.columns || [], result.mismatches || []);
        }

        function requestDoctorChecks(forceRefresh) {
            if (doctorRequestInFlight) {
                return;
            }

            if (!forceRefresh && currentDoctor) {
                return;
            }

            doctorRequestInFlight = true;
            setActiveView('doctor');
            setStatus('Running data file doctor checks...', 'status-loading');
            vscode.postMessage({
                type: 'runDoctor',
                selectedRelation: getSelectedRelationPayload(),
                sourceOptions: getSourceOptionsPayload()
            });
        }

        function renderDoctorNotLoadedState(message) {
            const placeholder = message || 'Run Doctor checks to load integrity, schema, statistics, and data quality diagnostics.';
            document.getElementById('doctor-health-score').textContent = '0';
            document.getElementById('doctor-error-count').textContent = '0';
            document.getElementById('doctor-warning-count').textContent = '0';
            document.getElementById('doctor-pass-count').textContent = '0';

            [
                'doctor-integrity',
                'doctor-health-report',
                'doctor-schema-validation',
                'doctor-column-statistics',
                'doctor-data-quality',
                'doctor-decimal-timestamp',
                'doctor-compression-encoding',
                'doctor-row-groups'
            ].forEach((containerId) => {
                const container = document.getElementById(containerId);
                container.innerHTML = '';
                container.appendChild(createDoctorEmpty(placeholder));
            });

            renderDoctorSchemaDrift(currentDoctorSchemaDrift);
            renderDoctorDatasetAnalysis(currentDoctorDataset);
        }

        function renderDoctorPanel(doctor) {
            if (!doctor) {
                renderDoctorNotLoadedState();
                return;
            }

            const report = doctor.healthReport || { healthScore: 0, errors: [], warnings: [], passedChecks: [], recommendations: [] };
            document.getElementById('doctor-health-score').textContent = String(report.healthScore || 0);
            document.getElementById('doctor-error-count').textContent = formatCount((report.errors || []).length);
            document.getElementById('doctor-warning-count').textContent = formatCount((report.warnings || []).length);
            document.getElementById('doctor-pass-count').textContent = formatCount((report.passedChecks || []).length);

            renderDoctorIntegrity(doctor.integrity || {});
            renderDoctorHealthReport(report);
            renderDoctorSchemaValidation((doctor.schemaValidation && doctor.schemaValidation.columns) || []);
            renderDoctorColumnStatistics((doctor.columnStatistics && doctor.columnStatistics.columns) || []);
            renderDoctorDataQuality(doctor.dataQuality || {});
            renderDoctorDecimalTimestamp((doctor.decimalTimestampDiagnostics && doctor.decimalTimestampDiagnostics.columns) || []);
            renderDoctorCompressionEncoding((doctor.compressionEncodingAnalysis && doctor.compressionEncodingAnalysis.columns) || []);
            renderDoctorRowGroups((doctor.rowGroupAnalysis && doctor.rowGroupAnalysis.rowGroups) || []);
            renderDoctorSchemaDrift(currentDoctorSchemaDrift);
            renderDoctorDatasetAnalysis(currentDoctorDataset);
        }

        function renderDoctorIntegrity(integrity) {
            const container = document.getElementById('doctor-integrity');
            const checks = [
                ['Valid start magic bytes', integrity.startsWithParquetMagic],
                ['Valid footer magic bytes', integrity.endsWithParquetMagic],
                ['Footer present', integrity.footerPresent],
                ['DuckDB readable', integrity.duckdbReadable],
                ['Row groups readable', integrity.rowGroupsReadable]
            ].filter((check) => check[1] !== null && check[1] !== undefined);
            container.innerHTML = '';
            checks.forEach(([label, passed]) => {
                container.appendChild(createDoctorCheckRow(label, passed));
            });
            container.appendChild(createDoctorMetricRow('File size', formatBytes(integrity.fileSize || 0)));
            if (integrity.selectedTable) {
                container.appendChild(createDoctorMetricRow('Default table', integrity.selectedTable));
            }
            if (typeof integrity.tableCount === 'number') {
                container.appendChild(createDoctorMetricRow('Tables', formatCount(integrity.tableCount)));
            }
            if (typeof integrity.viewCount === 'number') {
                container.appendChild(createDoctorMetricRow('Views', formatCount(integrity.viewCount)));
            }
        }

        function renderDoctorHealthReport(report) {
            const container = document.getElementById('doctor-health-report');
            container.innerHTML = '';
            container.appendChild(createDoctorIssueList('Errors', report.errors || [], 'doctor-error'));
            container.appendChild(createDoctorIssueList('Warnings', report.warnings || [], 'doctor-warning'));
            container.appendChild(createDoctorRecommendations(report.recommendations || []));
        }

        function renderDoctorSchemaValidation(columns) {
            const container = document.getElementById('doctor-schema-validation');
            container.innerHTML = '';
            const suspiciousColumns = columns.filter((column) => column.issues && column.issues.length);
            if (!suspiciousColumns.length) {
                container.appendChild(createDoctorEmpty('No suspicious type mappings detected.'));
                return;
            }
            suspiciousColumns.forEach((column) => {
                const card = document.createElement('div');
                card.className = 'doctor-card doctor-warning-card';
                card.appendChild(createDoctorCardTitle(column.path || column.name || 'Column'));
                card.appendChild(createDoctorMetricRow('Physical', valueOrDash(column.physicalType)));
                card.appendChild(createDoctorMetricRow('Logical', valueOrDash(column.logicalType)));
                card.appendChild(createDoctorMetricRow('Nullable', valueOrDash(column.nullableStatus)));
                (column.issues || []).forEach((issue) => {
                    card.appendChild(createDoctorText(issue));
                });
                container.appendChild(card);
            });
        }

        function renderDoctorColumnStatistics(columns) {
            const container = document.getElementById('doctor-column-statistics');
            container.innerHTML = '';
            const flaggedColumns = columns.filter((column) => column.issues && column.issues.length);
            if (!flaggedColumns.length) {
                container.appendChild(createDoctorEmpty('Column statistics look healthy.'));
                return;
            }
            flaggedColumns.forEach((column) => {
                const card = document.createElement('div');
                card.className = 'doctor-card doctor-warning-card';
                card.appendChild(createDoctorCardTitle(column.column));
                card.appendChild(createDoctorMetricRow('Null count', valueOrDash(column.nullCount)));
                card.appendChild(createDoctorMetricRow('Distinct count', valueOrDash(column.distinctCount)));
                (column.issues || []).forEach((issue) => {
                    card.appendChild(createDoctorText(issue));
                });
                container.appendChild(card);
            });
        }

        function renderDoctorDataQuality(dataQuality) {
            const container = document.getElementById('doctor-data-quality');
            container.innerHTML = '';
            container.appendChild(createDoctorMetricRow('Total rows', formatCount(dataQuality.totalRows || 0)));
            container.appendChild(createDoctorMetricRow('Distinct rows', formatCount(dataQuality.distinctRows || 0)));
            container.appendChild(createDoctorMetricRow('Duplicate rows', formatCount(dataQuality.duplicateRowsEstimate || 0)));

            const flaggedColumns = ((dataQuality && dataQuality.columns) || []).filter((column) => column.issues && column.issues.length);
            if (!flaggedColumns.length) {
                container.appendChild(createDoctorEmpty('No high-null columns, empty strings, suspicious defaults, or invalid ranges detected.'));
                return;
            }

            flaggedColumns.slice(0, 25).forEach((column) => {
                const card = document.createElement('div');
                card.className = 'doctor-card doctor-warning-card';
                card.appendChild(createDoctorCardTitle(column.column));
                card.appendChild(createDoctorMetricRow('Type', valueOrDash(column.duckdbType)));
                card.appendChild(createDoctorMetricRow('Null ratio', valueOrDash(column.nullRatio)));
                if (column.emptyStringCount !== undefined) {
                    card.appendChild(createDoctorMetricRow('Empty strings', formatCount(column.emptyStringCount)));
                }
                if (column.suspiciousDefaultCount !== undefined) {
                    card.appendChild(createDoctorMetricRow('Default-like values', formatCount(column.suspiciousDefaultCount)));
                }
                (column.issues || []).forEach((issue) => {
                    card.appendChild(createDoctorText(issue));
                });
                container.appendChild(card);
            });
        }

        function renderDoctorDecimalTimestamp(columns) {
            const container = document.getElementById('doctor-decimal-timestamp');
            container.innerHTML = '';
            if (!columns.length) {
                container.appendChild(createDoctorEmpty('Decimal and timestamp annotations look consistent.'));
                return;
            }

            columns.forEach((column) => {
                const card = document.createElement('div');
                card.className = 'doctor-card doctor-warning-card';
                card.appendChild(createDoctorCardTitle(column.column));
                card.appendChild(createDoctorMetricRow('Physical', valueOrDash(column.physicalType)));
                card.appendChild(createDoctorMetricRow('Logical', valueOrDash(column.logicalType)));
                card.appendChild(createDoctorMetricRow('Precision', valueOrDash(column.decimalPrecision)));
                card.appendChild(createDoctorMetricRow('Scale', valueOrDash(column.decimalScale)));
                card.appendChild(createDoctorMetricRow('Timestamp unit', valueOrDash(column.timestampUnit)));
                card.appendChild(createDoctorMetricRow('Timezone', valueOrDash(column.timezoneInterpretation)));
                (column.issues || []).forEach((issue) => {
                    card.appendChild(createDoctorText(issue));
                });
                container.appendChild(card);
            });
        }

        function renderDoctorCompressionEncoding(columns) {
            const container = document.getElementById('doctor-compression-encoding');
            container.innerHTML = '';
            const flaggedColumns = columns.filter((column) => column.issues && column.issues.length);
            if (!flaggedColumns.length) {
                container.appendChild(createDoctorEmpty('Compression and encoding metadata look healthy.'));
                return;
            }

            flaggedColumns.slice(0, 25).forEach((column) => {
                const card = document.createElement('div');
                card.className = 'doctor-card doctor-warning-card';
                card.appendChild(createDoctorCardTitle(column.column));
                card.appendChild(createDoctorMetricRow('Compression', valueOrDash(column.compression)));
                card.appendChild(createDoctorMetricRow('Ratio', valueOrDash(column.compressionRatio)));
                card.appendChild(createDoctorMetricRow('Cardinality ratio', valueOrDash(column.cardinalityRatio)));
                card.appendChild(createDoctorMetricRow('Encodings', valueOrDash(column.encodings)));
                (column.issues || []).forEach((issue) => {
                    card.appendChild(createDoctorText(issue));
                });
                container.appendChild(card);
            });
        }

        function renderDoctorSchemaDrift(result) {
            const container = document.getElementById('doctor-schema-drift');
            container.innerHTML = '';
            if (!result) {
                container.appendChild(createDoctorEmpty('Choose a reference data file to detect added, removed, renamed, or type-changed columns.'));
                return;
            }
            if (!result.success) {
                container.appendChild(createDoctorText(result.error || 'Schema drift check failed.'));
                return;
            }

            const summary = result.summary || {};
            container.appendChild(createDoctorMetricRow('Added', formatCount(summary.added || 0)));
            container.appendChild(createDoctorMetricRow('Removed', formatCount(summary.removed || 0)));
            container.appendChild(createDoctorMetricRow('Type changed', formatCount(summary.typeChanged || 0)));
            container.appendChild(createDoctorMetricRow('Rename candidates', formatCount(summary.renameCandidates || 0)));
            appendDoctorColumnList(container, 'Added Columns', result.addedColumns || [], 'name');
            appendDoctorColumnList(container, 'Removed Columns', result.removedColumns || [], 'name');
            appendDoctorColumnList(container, 'Type Changed Columns', result.typeChangedColumns || [], 'column');
            appendDoctorColumnList(container, 'Rename Candidates', result.renameCandidates || [], 'referenceColumn', (item) => item.referenceColumn + ' -> ' + item.currentColumn);
        }

        function renderDoctorDatasetAnalysis(result) {
            const container = document.getElementById('doctor-dataset-analysis');
            container.innerHTML = '';
            if (!result) {
                container.appendChild(createDoctorEmpty('Choose a folder to scan parquet files for schema consistency, partition health, empty files, and small-file problems.'));
                return;
            }
            if (!result.success) {
                container.appendChild(createDoctorText(result.error || 'Dataset scan failed.'));
                return;
            }

            container.appendChild(createDoctorMetricRow('Files', formatCount(result.fileCount || 0)));
            container.appendChild(createDoctorMetricRow('Rows', formatCount(result.totalRows || 0)));
            container.appendChild(createDoctorMetricRow('Size', formatBytes(result.totalSize || 0)));
            container.appendChild(createDoctorMetricRow('Schema groups', formatCount((result.schemaGroups || []).length)));
            container.appendChild(createDoctorMetricRow('Partition keys', (result.partitionKeys || []).join(', ') || '-'));
            appendDoctorTextList(container, 'Warnings', result.warnings || []);
            appendDoctorTextList(container, 'Recommendations', result.recommendations || []);
            appendDoctorFileList(container, 'Empty Files', result.emptyFiles || []);
            appendDoctorFileList(container, 'Small Files', result.smallFiles || []);
            appendDoctorFileList(container, 'Unreadable Files', result.unreadableFiles || []);
            appendDoctorColumnList(container, 'Missing Partition Keys', result.missingPartitions || [], 'file', (item) => item.file + ': ' + (item.missingKeys || []).join(', '));
            if (result.unevenPartitionSizes) {
                const uneven = result.unevenPartitionSizes;
                const card = document.createElement('div');
                card.className = 'doctor-card doctor-warning-card';
                card.appendChild(createDoctorCardTitle('Uneven Partition Sizes'));
                card.appendChild(createDoctorMetricRow('Smallest', formatBytes(uneven.smallestPartitionSize || 0)));
                card.appendChild(createDoctorMetricRow('Largest', formatBytes(uneven.largestPartitionSize || 0)));
                card.appendChild(createDoctorMetricRow('Ratio', valueOrDash(uneven.ratio)));
                container.appendChild(card);
            }
        }

        function renderDoctorRowGroups(rowGroups) {
            const container = document.getElementById('doctor-row-groups');
            container.innerHTML = '';
            if (!rowGroups.length) {
                container.appendChild(createDoctorEmpty('No row group metadata available.'));
                return;
            }

            const table = document.createElement('table');
            const header = document.createElement('thead');
            header.innerHTML = '<tr><th>Row Group</th><th>Rows</th><th>Compression</th><th>Compressed</th><th>Uncompressed</th><th>Compression Ratio</th><th>Column Chunks</th><th>Warnings</th></tr>';
            const body = document.createElement('tbody');
            rowGroups.forEach((rowGroup) => {
                const row = document.createElement('tr');
                if (rowGroup.issues && rowGroup.issues.length) {
                    row.className = 'doctor-warning-row';
                }
                [
                    rowGroup.id,
                    formatCount(rowGroup.rowCount),
                    valueOrDash(rowGroup.compression),
                    formatBytes(rowGroup.compressedSize || 0),
                    formatBytes(rowGroup.uncompressedSize || 0),
                    valueOrDash(rowGroup.compressionRatio),
                    formatCount((rowGroup.columnChunks || []).length),
                    (rowGroup.issues || []).join('; ') || '-'
                ].forEach((value) => {
                    const cell = document.createElement('td');
                    cell.textContent = String(value);
                    cell.title = String(value);
                    row.appendChild(cell);
                });
                body.appendChild(row);
            });
            table.appendChild(header);
            table.appendChild(body);
            container.appendChild(table);
        }

        function appendDoctorColumnList(container, title, items, fallbackKey, formatter) {
            if (!items.length) {
                return;
            }

            const section = document.createElement('div');
            section.className = 'doctor-issue-list';
            section.appendChild(createDoctorCardTitle(title));
            items.slice(0, 30).forEach((item) => {
                section.appendChild(createDoctorText(formatter ? formatter(item) : valueOrDash(item[fallbackKey])));
            });
            if (items.length > 30) {
                section.appendChild(createDoctorText('Showing first 30 of ' + formatCount(items.length) + '.'));
            }
            container.appendChild(section);
        }

        function appendDoctorTextList(container, title, items) {
            if (!items.length) {
                return;
            }

            const section = document.createElement('div');
            section.className = 'doctor-issue-list';
            section.appendChild(createDoctorCardTitle(title));
            items.forEach((item) => {
                section.appendChild(createDoctorText(item));
            });
            container.appendChild(section);
        }

        function appendDoctorFileList(container, title, items) {
            appendDoctorColumnList(container, title, items, 'file', (item) => item.file);
        }

        function createDoctorCheckRow(label, passed) {
            const row = document.createElement('div');
            row.className = 'doctor-check-row ' + (passed ? 'doctor-pass' : 'doctor-error');
            const status = document.createElement('span');
            status.textContent = passed ? 'Pass' : 'Fail';
            const text = document.createElement('span');
            text.textContent = label;
            row.appendChild(status);
            row.appendChild(text);
            return row;
        }

        function createDoctorMetricRow(label, value) {
            const row = document.createElement('div');
            row.className = 'doctor-metric-row';
            const key = document.createElement('span');
            key.textContent = label;
            const val = document.createElement('strong');
            val.textContent = String(value);
            row.appendChild(key);
            row.appendChild(val);
            return row;
        }

        function createDoctorIssueList(title, issues, className) {
            const section = document.createElement('div');
            section.className = 'doctor-issue-list';
            section.appendChild(createDoctorCardTitle(title));
            if (!issues.length) {
                section.appendChild(createDoctorEmpty('None'));
                return section;
            }
            issues.forEach((issue) => {
                const item = document.createElement('div');
                item.className = 'doctor-issue ' + className;
                item.textContent = issue.category + ': ' + issue.message;
                section.appendChild(item);
            });
            return section;
        }

        function createDoctorRecommendations(recommendations) {
            const section = document.createElement('div');
            section.className = 'doctor-issue-list';
            section.appendChild(createDoctorCardTitle('Suggested Fixes'));
            if (!recommendations.length) {
                section.appendChild(createDoctorEmpty('No fixes needed.'));
                return section;
            }
            recommendations.forEach((recommendation) => {
                section.appendChild(createDoctorText(recommendation));
            });
            return section;
        }

        function createDoctorCardTitle(title) {
            const heading = document.createElement('h4');
            heading.textContent = title;
            return heading;
        }

        function createDoctorText(text) {
            const paragraph = document.createElement('p');
            paragraph.textContent = text;
            return paragraph;
        }

        function createDoctorEmpty(text) {
            const empty = document.createElement('div');
            empty.className = 'empty-value';
            empty.textContent = text;
            return empty;
        }

        function formatBytes(value) {
            const numberValue = Number(value || 0);
            if (numberValue < 1024) {
                return numberValue + ' B';
            }
            if (numberValue < 1024 * 1024) {
                return (numberValue / 1024).toFixed(1) + ' KB';
            }
            if (numberValue < 1024 * 1024 * 1024) {
                return (numberValue / (1024 * 1024)).toFixed(1) + ' MB';
            }
            return (numberValue / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
        }

        function clearCompareTables() {
            document.getElementById('compare-base-header').innerHTML = '';
            document.getElementById('compare-base-body').innerHTML = '';
            document.getElementById('compare-other-header').innerHTML = '';
            document.getElementById('compare-other-body').innerHTML = '';
        }

        function createCompareTables(columns, mismatches) {
            const showKey = mismatches.some((mismatch) => Object.prototype.hasOwnProperty.call(mismatch, 'keyValue'));
            createCompareHeader(document.getElementById('compare-base-header'), columns, showKey);
            createCompareHeader(document.getElementById('compare-other-header'), columns, showKey);

            const baseBody = document.getElementById('compare-base-body');
            const otherBody = document.getElementById('compare-other-body');
            baseBody.innerHTML = '';
            otherBody.innerHTML = '';

            if (!mismatches.length) {
                appendCompareEmptyRow(baseBody, columns.length + (showKey ? 2 : 1), 'No mismatches found');
                appendCompareEmptyRow(otherBody, columns.length + (showKey ? 2 : 1), 'No mismatches found');
                return;
            }

            mismatches.forEach((mismatch) => {
                baseBody.appendChild(createCompareRow(columns, mismatch, mismatch.base, 'base', showKey));
                otherBody.appendChild(createCompareRow(columns, mismatch, mismatch.compare, 'compare', showKey));
            });
        }

        function createCompareHeader(headerElement, columns, showKey) {
            headerElement.innerHTML = '';
            const row = document.createElement('tr');
            const rowIndexHeader = document.createElement('th');
            rowIndexHeader.textContent = '#';
            row.appendChild(rowIndexHeader);

            if (showKey) {
                const keyHeader = document.createElement('th');
                keyHeader.textContent = 'Key';
                row.appendChild(keyHeader);
            }

            columns.forEach((column) => {
                const th = document.createElement('th');
                th.textContent = column;
                th.title = column;
                row.appendChild(th);
            });

            headerElement.appendChild(row);
        }

        function createCompareRow(columns, mismatch, rowData, side, showKey) {
            const row = document.createElement('tr');
            row.className = 'compare-row-mismatch';

            if ((side === 'base' && mismatch.type === 'missing_in_base') ||
                (side === 'compare' && mismatch.type === 'missing_in_compare')) {
                row.classList.add('compare-row-missing');
            }

            const rowIndexCell = document.createElement('td');
            rowIndexCell.textContent = String(mismatch.rowIndex + 1);
            rowIndexCell.className = 'compare-row-index';
            row.appendChild(rowIndexCell);

            if (showKey) {
                const keyCell = document.createElement('td');
                keyCell.textContent = mismatch.keyValue === null || mismatch.keyValue === undefined ? 'NULL' : String(mismatch.keyValue);
                keyCell.title = keyCell.textContent;
                keyCell.className = 'compare-row-index';
                row.appendChild(keyCell);
            }

            columns.forEach((column) => {
                const cell = document.createElement('td');
                const value = rowData ? rowData[column] : undefined;
                cell.textContent = value === null || value === undefined ? 'NULL' : String(value);
                cell.title = cell.textContent;

                if (mismatch.mismatchedColumns && mismatch.mismatchedColumns.includes(column)) {
                    cell.classList.add('compare-cell-mismatch');
                }

                row.appendChild(cell);
            });

            return row;
        }

        function appendCompareEmptyRow(body, colspan, message) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = colspan;
            cell.className = 'empty-value';
            cell.textContent = message;
            row.appendChild(cell);
            body.appendChild(row);
        }

        function updateView(data) {
            const previousActiveView = getActiveViewName();
            const statusElement = document.getElementById('status');
            const errorContainer = document.getElementById('error-container');
            const errorText = document.getElementById('error-text');
            const dataContainer = document.getElementById('data-container');
            const loadingContainer = document.getElementById('loading-container');
            const queryLimitMessage = document.getElementById('query-limit-message');

            currentFileType = normalizeFileType(data && data.fileType);
            currentSourceFormat = normalizeSourceFormat(data && (data.sourceFormat || data.fileType));
            currentSourceOptions = normalizeSourceOptions(data && data.sourceOptions, currentSourceFormat || currentFileType);
            currentTextPreview = data && data.textPreview ? data.textPreview : null;
            updateSourceTypeBadge();
            updateRelations(data);

            loadingContainer.classList.add('hidden');

            errorContainer.classList.add('hidden');
            dataContainer.classList.add('hidden');
            statusElement.classList.remove('status-success', 'status-error', 'status-loading');
            queryLimitMessage.classList.add('hidden');

            if (!data.success) {
                if (data.doctor) {
                    currentDoctor = data.doctor;
                    renderDoctorPanel(currentDoctor);
                } else if (!currentDoctor) {
                    renderDoctorPanel(null);
                }
                currentColumns = [];
                currentRows = [];
                currentOffset = 0;
                currentHasMore = false;
                currentTextPreview = null;
                applyFeatureAvailability(data);
                renderFlatFileOptions();
                renderJsonFileOptions();
                renderExcelFileOptions();
                renderTextEditorOption();
                renderTextPreviewPanel();
                setActiveView(currentDoctor ? 'doctor' : 'data');
                errorText.textContent = data.error || 'Unknown error occurred';
                errorContainer.classList.remove('hidden');
                statusElement.textContent = 'Error';
                statusElement.classList.add('status-error');
                return;
            }
            
            // Update summary information
            const loadedStart = data.rowCount > 0 ? data.offset + 1 : 0;
            const loadedEnd = data.offset + data.rowCount;
            document.getElementById('total-rows').textContent = data.hasMore ? formatCount(loadedEnd) + '+' : formatCount(loadedEnd);
            document.getElementById('showing-rows').textContent = formatCount(data.rowCount);
            document.getElementById('column-count').textContent = data.columns ? data.columns.length : 0;
            if (data.query) {
                currentQuery = data.query;
                const queryInput = document.getElementById('query-input');
                if (queryInput) {
                    queryInput.value = data.query;
                }
            }

            // Update pagination UI
            const paginationControls = document.getElementById('pagination-controls');
            if (paginationControls) {
                paginationControls.classList.remove('hidden');
                
                const prevBtn = document.getElementById('prev-page-btn');
                if (prevBtn) {
                    prevBtn.disabled = data.offset === 0;
                }
                
                const nextBtn = document.getElementById('next-page-btn');
                if (nextBtn) {
                    nextBtn.disabled = !data.hasMore;
                }
                
                const pageInfo = document.getElementById('page-info');
                if (pageInfo) {
                    pageInfo.textContent = formatCount(loadedStart) + ' - ' + formatCount(loadedEnd);
                }

                const pageSizeSelect = document.getElementById('page-size-select');
                if (pageSizeSelect) {
                    pageSizeSelect.value = String(data.limit || 1000);
                }
            }

            if (data.schema) {
                currentSchema = data.schema;
                renderSchemaPanel(currentSchema);
            } else {
                currentSchema = null;
            }

            if (data.doctor) {
                currentDoctor = data.doctor;
                renderDoctorPanel(currentDoctor);
            } else if (isTextOnlySource() || !currentDoctor) {
                currentDoctor = null;
                renderDoctorPanel(null);
            }

            currentColumns = data.columns || [];
            currentRows = cloneRows(data.data || []);
            currentOffset = data.offset || 0;
            currentLimit = data.limit || 1000;
            currentHasMore = Boolean(data.hasMore);
            
            editRows = cloneRows(currentRows);
            resetEditColumnNames();
            renderEditPanel();
            initializeTableViewState();
            populateTableControls();
            populateQuickAggregationControls();
            renderEdaPanel();
            refreshWritePreview();
            refreshExportPanel();
            renderTransformControls();
            populateVisualizerControls();
            renderVisualizer();
            applyFeatureAvailability(data);
            renderFlatFileOptions();
            renderJsonFileOptions();
            renderExcelFileOptions();
            renderTextEditorOption();
            renderTextPreviewPanel();
            setActiveView(isViewAvailable(previousActiveView) ? previousActiveView : getFirstAvailableView());

            if (isTextOnlySource()) {
                dataContainer.classList.add('hidden');
                statusElement.textContent = 'Loaded Markdown';
                statusElement.classList.add('status-success');
                return;
            }
             
            // Create table
            if (data.columns) {
                applyTableView();
                dataContainer.classList.remove('hidden');
                statusElement.textContent = 'Loaded ' + formatCount(data.rowCount) + ' rows';
                if (data.hasMore) {
                    statusElement.textContent += ' (more available)';
                }
                statusElement.classList.add('status-success');
            } else {
                const tableBody = document.getElementById('table-body');
                tableBody.innerHTML = '<tr><td colspan="1" style="text-align: center; padding: 20px;">No data found in file</td></tr>';
                dataContainer.classList.remove('hidden');
                statusElement.textContent = 'No rows';
                statusElement.classList.add('status-success');
            }
        }

        function renderSchemaPanel(schema) {
            const columnCountElement = document.getElementById('schema-column-count');
            const nestedCountElement = document.getElementById('schema-nested-count');
            const searchInput = document.getElementById('schema-search-input');

            columnCountElement.textContent = formatCount(schema.columnCount || 0);
            nestedCountElement.textContent = formatCount(countNestedFields(schema.tree || []));
            renderSchemaTree(schema.tree || []);
            renderSchemaColumns(schema.columns || [], searchInput ? searchInput.value : '');
        }

        function countNestedFields(nodes) {
            return nodes.reduce((count, node) => {
                const childCount = node.children ? node.children.length : 0;
                return count + (childCount > 0 ? 1 : 0) + countNestedFields(node.children || []);
            }, 0);
        }

        function renderSchemaTree(nodes) {
            const treeContainer = document.getElementById('schema-tree');
            treeContainer.innerHTML = '';

            if (!nodes.length) {
                const empty = document.createElement('div');
                empty.className = 'empty-value';
                empty.textContent = 'No schema metadata found';
                treeContainer.appendChild(empty);
                return;
            }

            treeContainer.appendChild(createSchemaTreeList(nodes));
        }

        function createSchemaTreeList(nodes) {
            const list = document.createElement('ul');
            list.className = 'schema-tree-list';

            nodes.forEach((node) => {
                const item = document.createElement('li');
                const row = document.createElement('div');
                row.className = 'schema-tree-row';
                row.style.paddingLeft = Math.max(node.depth - 1, 0) * 12 + 'px';

                const name = document.createElement('span');
                name.className = 'schema-tree-name';
                name.textContent = node.name || node.path;

                const type = document.createElement('span');
                type.className = 'schema-chip';
                type.textContent = valueOrDash(node.logicalType || node.physicalType);

                const mode = document.createElement('span');
                mode.className = 'schema-chip schema-chip-muted';
                mode.textContent = valueOrDash(node.repetitionType);

                row.appendChild(name);
                row.appendChild(type);
                row.appendChild(mode);
                item.appendChild(row);

                if (node.children && node.children.length) {
                    item.appendChild(createSchemaTreeList(node.children));
                }

                list.appendChild(item);
            });

            return list;
        }

        function renderSchemaColumns(columns, filterText) {
            const list = document.getElementById('schema-column-list');
            const normalizedFilter = (filterText || '').trim().toLowerCase();
            const filteredColumns = normalizedFilter
                ? columns.filter((column) => schemaColumnMatches(column, normalizedFilter))
                : columns;

            list.innerHTML = '';

            if (!filteredColumns.length) {
                const empty = document.createElement('div');
                empty.className = 'empty-value';
                empty.textContent = 'No columns matched';
                list.appendChild(empty);
                return;
            }

            filteredColumns.forEach((column) => {
                list.appendChild(createSchemaColumnCard(column));
            });
        }

        function schemaColumnMatches(column, filterText) {
            return [
                column.name,
                column.path,
                column.physicalType,
                column.logicalType,
                column.convertedType,
                column.nullableStatus,
                column.repetitionType
            ].some((value) => valueOrDash(value).toLowerCase().includes(filterText));
        }

        function createSchemaColumnCard(column) {
            const card = document.createElement('article');
            card.className = 'schema-column-card';

            const header = document.createElement('div');
            header.className = 'schema-column-header';

            const title = document.createElement('div');
            title.className = 'schema-column-title';
            title.textContent = column.name || column.path;
            title.title = column.path;

            const path = document.createElement('code');
            path.textContent = column.path;

            header.appendChild(title);
            header.appendChild(path);
            card.appendChild(header);

            const fields = [
                ['Physical Type', column.physicalType],
                ['Logical Type', column.logicalType],
                ['Nullable', column.nullableStatus],
                ['Repetition Level', column.repetitionLevel],
                ['Definition Level', column.definitionLevel],
                ['Decimal Precision', column.decimalPrecision],
                ['Decimal Scale', column.decimalScale],
                ['Timestamp Unit', column.timestampUnit],
                ['Timezone', column.timestampTimezoneInterpretation]
            ];

            const grid = document.createElement('dl');
            grid.className = 'schema-field-grid';
            fields.forEach(([label, value]) => {
                const term = document.createElement('dt');
                term.textContent = label;
                const detail = document.createElement('dd');
                detail.textContent = valueOrDash(value);
                grid.appendChild(term);
                grid.appendChild(detail);
            });
            card.appendChild(grid);

            return card;
        }

        function generateSchemaDocumentation(schema) {
            const lines = ['# ' + formatFileTypeLabel(currentFileType) + ' Schema', ''];
            lines.push('Columns: ' + formatCount(schema.columnCount || 0));
            lines.push('');
            lines.push('| Path | Physical Type | Logical Type | Nullable | Repetition Level | Definition Level | Decimal | Timestamp |');
            lines.push('| --- | --- | --- | --- | ---: | ---: | --- | --- |');

            (schema.columns || []).forEach((column) => {
                const decimal = column.decimalPrecision !== null && column.decimalPrecision !== undefined
                    ? 'precision ' + column.decimalPrecision + ', scale ' + valueOrDash(column.decimalScale)
                    : '-';
                const timestamp = column.timestampUnit
                    ? column.timestampUnit + ' / ' + valueOrDash(column.timestampTimezoneInterpretation)
                    : '-';
                lines.push([
                    valueOrDash(column.path),
                    valueOrDash(column.physicalType),
                    valueOrDash(column.logicalType),
                    valueOrDash(column.nullableStatus),
                    valueOrDash(column.repetitionLevel),
                    valueOrDash(column.definitionLevel),
                    decimal,
                    timestamp
                ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
            });

            return lines.join('\\n');
        }

        function escapeMarkdownTableCell(value) {
            return String(value).replace(/\\|/g, '\\\\|').replace(/\\r?\\n/g, ' ');
        }

        function getCsvColumnColor(columnIndex) {
            const colors = [
                '#d73a49',
                '#0366d6',
                '#22863a',
                '#b08800',
                '#6f42c1',
                '#e36209',
                '#005cc5',
                '#b31d28',
                '#3192aa',
                '#735c0f',
                '#5a32a3',
                '#116329'
            ];
            return colors[columnIndex % colors.length];
        }

        function applyCsvColumnColor(element, columnIndex) {
            if (!['sqlite', 'csv', 'tsv', 'psv', 'json', 'avro', 'orc', 'arrow', 'feather', 'ipc'].includes(currentFileType)) {
                return;
            }

            element.classList.add('csv-column-color');
            element.style.setProperty('--csv-column-color', getCsvColumnColor(columnIndex));
        }

        function createTable(columns, data) {
            const tableHeader = document.getElementById('table-header');
            const tableBody = document.getElementById('table-body');
            
            // Clear existing content
            tableHeader.innerHTML = '';
            tableBody.innerHTML = '';
            
            if (!columns || !data) {
                return;
            }
            
            // Create header row
            const headerRow = document.createElement('tr');
            
            columns.forEach((column, columnIndex) => {
                const th = document.createElement('th');
                th.textContent = column;
                th.title = column;
                applyCsvColumnColor(th, columnIndex);
                headerRow.appendChild(th);
            });
            tableHeader.appendChild(headerRow);

            if (data.length === 0) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = Math.max(columns.length, 1);
                td.textContent = 'No rows matched this query';
                td.className = 'empty-value';
                tr.appendChild(td);
                tableBody.appendChild(tr);
                return;
            }
            
            // Create data rows
            data.forEach((row, rowIndex) => {
                const tr = document.createElement('tr');
                columns.forEach((column, columnIndex) => {
                    const td = document.createElement('td');
                    const value = row[column];
                    applyCsvColumnColor(td, columnIndex);
                    
                    // Format the value for display
                    if (value === null || value === undefined) {
                        td.textContent = 'NULL';
                        td.classList.add('null-value');
                    } else if (typeof value === 'object') {
                        td.textContent = JSON.stringify(value);
                        td.classList.add('object-value');
                    } else {
                        td.textContent = String(value);
                        td.title = String(value);
                    }
                    
                    tr.appendChild(td);
                });
                tableBody.appendChild(tr);

            });

        }

        // Event listeners
        document.addEventListener('DOMContentLoaded', () => {
            
            const refreshBtn = document.getElementById('refresh-btn');
            const headerOpenTextEditorBtn = document.getElementById('header-open-text-editor-btn');
            const exploreTab = document.getElementById('explore-tab');
            const transformTab = document.getElementById('transform-tab');
            const combineTab = document.getElementById('combine-tab');
            const qualityTab = document.getElementById('quality-tab');
            const dataTab = document.getElementById('data-tab');
            const edaTab = document.getElementById('eda-tab');
            const writeTab = document.getElementById('write-tab');
            const exportTab = document.getElementById('export-tab');
            const visualizerTab = document.getElementById('visualizer-tab');
            const editTab = document.getElementById('edit-tab');
            const doctorTab = document.getElementById('doctor-tab');
            const schemaTab = document.getElementById('schema-tab');
            const compareTab = document.getElementById('compare-tab');
            const joinTab = document.getElementById('join-tab');
            const runQueryBtn = document.getElementById('run-query-btn');
            const resetQueryBtn = document.getElementById('reset-query-btn');
            const openTextEditorBtn = document.getElementById('open-text-editor-btn');
            const dataControlsToggleBtn = document.getElementById('data-controls-toggle-btn');
            const runAggregationBtn = document.getElementById('run-aggregation-btn');
            const resetAggregationBtn = document.getElementById('reset-aggregation-btn');
            const aggregationFunction = document.getElementById('aggregation-function');
            const exportButtons = document.querySelectorAll('[data-export-format]');
            const tableSortColumn = document.getElementById('table-sort-column');
            const tableSortDirection = document.getElementById('table-sort-direction');
            const columnPickerToggle = document.getElementById('column-picker-toggle');
            const columnPickerMenu = document.getElementById('column-picker-menu');
            const showAllColumnsBtn = document.getElementById('show-all-columns-btn');
            const resetTableViewBtn = document.getElementById('reset-table-view-btn');
            const writeSource = document.getElementById('write-source');
            const writeCompression = document.getElementById('write-compression');
            const writeRowGroupSize = document.getElementById('write-row-group-size');
            const writeJsonInput = document.getElementById('write-json-input');
            const writePreviewBtn = document.getElementById('write-preview-btn');
            const writeCreateBtn = document.getElementById('write-create-btn');
            const addEditRowBtn = document.getElementById('add-edit-row-btn');
            const resetEditsBtn = document.getElementById('reset-edits-btn');
            const resetColumnNamesBtn = document.getElementById('reset-column-names-btn');
            const saveEditsBtn = document.getElementById('save-edits-btn');
            const editTableHeader = document.getElementById('edit-table-header');
            const editTableBody = document.getElementById('edit-table-body');
            const doctorRunBtn = document.getElementById('doctor-run-btn');
            const doctorSchemaDriftBtn = document.getElementById('doctor-schema-drift-btn');
            const doctorDatasetScanBtn = document.getElementById('doctor-dataset-scan-btn');
            const selectCompareFileBtn = document.getElementById('select-compare-file-btn');
            const runSmartDiffBtn = document.getElementById('run-smart-diff-btn');
            const runStrictCompareBtn = document.getElementById('run-strict-compare-btn');
            const runCustomCompareBtn = document.getElementById('run-custom-compare-btn');
            const customCompareToggle = document.getElementById('custom-compare-toggle');
            const selectJoinFileBtn = document.getElementById('select-join-file-btn');
            const runJoinBtn = document.getElementById('run-join-btn');
            const exportJoinPreviewBtn = document.getElementById('export-join-preview-btn');
            const joinBaseColumn = document.getElementById('join-base-column');
            const joinOtherColumn = document.getElementById('join-other-column');
            const joinType = document.getElementById('join-type');
            const joinLimit = document.getElementById('join-limit');
            const queryInput = document.getElementById('query-input');
            const relationPicker = document.getElementById('relation-picker');
            const applyFlatFileOptionsBtn = document.getElementById('apply-flat-file-options-btn');
            const resetFlatFileOptionsBtn = document.getElementById('reset-flat-file-options-btn');
            const applyJsonOptionsBtn = document.getElementById('apply-json-options-btn');
            const resetJsonOptionsBtn = document.getElementById('reset-json-options-btn');
            const applyExcelOptionsBtn = document.getElementById('apply-excel-options-btn');
            const resetExcelOptionsBtn = document.getElementById('reset-excel-options-btn');
            const schemaSearchInput = document.getElementById('schema-search-input');
            const copySchemaJsonBtn = document.getElementById('copy-schema-json-btn');
            const generateSchemaDocsBtn = document.getElementById('generate-schema-docs-btn');
            const copySchemaDocsBtn = document.getElementById('copy-schema-docs-btn');
            const visualizerChartType = document.getElementById('visualizer-chart-type');
            const visualizerXColumn = document.getElementById('visualizer-x-column');
            const visualizerYColumn = document.getElementById('visualizer-y-column');
            const visualizerAggregation = document.getElementById('visualizer-aggregation');
            const visualizerLimit = document.getElementById('visualizer-limit');

            if (exploreTab) {
                exploreTab.addEventListener('click', () => {
                    setActiveView('data');
                });
            }

            if (transformTab) {
                transformTab.addEventListener('click', () => {
                    setActiveView('edit');
                });
            }

            if (combineTab) {
                combineTab.addEventListener('click', () => {
                    setActiveView('compare');
                });
            }

            if (qualityTab) {
                qualityTab.addEventListener('click', () => {
                    setActiveView('doctor');
                });
            }

            if (dataTab) {
                dataTab.addEventListener('click', () => {
                    setActiveView('data');
                });
            }

            if (edaTab) {
                edaTab.addEventListener('click', () => {
                    setActiveView('eda');
                });
            }

            if (writeTab) {
                writeTab.addEventListener('click', () => {
                    setActiveView('write');
                });
            }

            if (exportTab) {
                exportTab.addEventListener('click', () => {
                    setActiveView('export');
                });
            }

            if (visualizerTab) {
                visualizerTab.addEventListener('click', () => {
                    setActiveView('visualizer');
                });
            }

            if (editTab) {
                editTab.addEventListener('click', () => {
                    setActiveView('edit');
                });
            }

            if (doctorTab) {
                doctorTab.addEventListener('click', () => {
                    setActiveView('doctor');
                });
            }

            if (doctorRunBtn) {
                doctorRunBtn.addEventListener('click', () => {
                    requestDoctorChecks(true);
                });
            }

            if (schemaTab) {
                schemaTab.addEventListener('click', () => {
                    setActiveView('schema');
                });
            }

            if (compareTab) {
                compareTab.addEventListener('click', () => {
                    setActiveView('compare');
                });
            }

            if (joinTab) {
                joinTab.addEventListener('click', () => {
                    setActiveView('join');
                });
            }

            [headerOpenTextEditorBtn, openTextEditorBtn].forEach((textEditorButton) => {
                if (!textEditorButton) {
                    return;
                }

                textEditorButton.addEventListener('click', () => {
                    vscode.postMessage({ type: 'openAsText' });
                });
            });

            if (dataControlsToggleBtn) {
                dataControlsToggleBtn.addEventListener('click', () => {
                    dataControlsCollapsed = !dataControlsCollapsed;
                    applyDataControlsCollapsedState();
                });
            }
            
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    currentQuery = queryInput ? queryInput.value.trim() || DEFAULT_QUERY : currentQuery;
                    setLoading('Refreshing...');
                    vscode.postMessage({
                        type: 'refresh',
                        query: currentQuery,
                        selectedRelation: getSelectedRelationPayload(),
                        sourceOptions: getSourceOptionsPayload(),
                        offset: currentOffset,
                        limit: currentLimit
                    });
                });
            }

            if (runQueryBtn) {
                runQueryBtn.addEventListener('click', () => {
                    currentQuery = queryInput ? queryInput.value.trim() || DEFAULT_QUERY : DEFAULT_QUERY;
                    currentOffset = 0; // Reset pagination when running a new query
                    setLoading('Running query...');
                    vscode.postMessage({
                        type: 'query',
                        query: currentQuery,
                        selectedRelation: getSelectedRelationPayload(),
                        sourceOptions: getSourceOptionsPayload(),
                        offset: currentOffset,
                        limit: currentLimit
                    });
                });
            }

            const prevPageBtn = document.getElementById('prev-page-btn');
            const nextPageBtn = document.getElementById('next-page-btn');
            const pageSizeSelect = document.getElementById('page-size-select');

            if (prevPageBtn) {
                prevPageBtn.addEventListener('click', () => {
                    if (currentOffset > 0) {
                        currentOffset = Math.max(0, currentOffset - currentLimit);
                        setLoading('Loading previous page...');
                        vscode.postMessage({
                            type: 'query',
                            query: currentQuery,
                            selectedRelation: getSelectedRelationPayload(),
                            sourceOptions: getSourceOptionsPayload(),
                            offset: currentOffset,
                            limit: currentLimit
                        });
                    }
                });
            }

            if (nextPageBtn) {
                nextPageBtn.addEventListener('click', () => {
                    if (currentHasMore) {
                        currentOffset += currentLimit;
                        setLoading('Loading next page...');
                        vscode.postMessage({
                            type: 'query',
                            query: currentQuery,
                            selectedRelation: getSelectedRelationPayload(),
                            sourceOptions: getSourceOptionsPayload(),
                            offset: currentOffset,
                            limit: currentLimit
                        });
                    }
                });
            }

            if (pageSizeSelect) {
                pageSizeSelect.addEventListener('change', (e) => {
                    const newLimit = parseInt(e.target.value, 10);
                    if (!isNaN(newLimit) && newLimit > 0) {
                        currentLimit = newLimit;
                        currentOffset = 0; // Reset offset when page size changes
                        setLoading('Changing page size...');
                        vscode.postMessage({
                            type: 'query',
                            query: currentQuery,
                            selectedRelation: getSelectedRelationPayload(),
                            sourceOptions: getSourceOptionsPayload(),
                            offset: currentOffset,
                            limit: currentLimit
                        });
                    }
                });
            }

            if (resetQueryBtn) {
                resetQueryBtn.addEventListener('click', () => {
                    currentQuery = DEFAULT_QUERY;
                    if (queryInput) {
                        queryInput.value = currentQuery;
                    }
                    setLoading('Resetting query...');
                    vscode.postMessage({
                        type: 'query',
                        query: currentQuery,
                        selectedRelation: getSelectedRelationPayload(),
                        sourceOptions: getSourceOptionsPayload(),
                        offset: 0,
                        limit: currentLimit
                    });
                });
            }

            if (queryInput) {
                queryInput.addEventListener('input', refreshExportPanel);
                queryInput.addEventListener('keydown', (event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault();
                        currentQuery = queryInput.value.trim() || DEFAULT_QUERY;
                        setLoading('Running query...');
                        vscode.postMessage({
                            type: 'query',
                            query: currentQuery,
                            selectedRelation: getSelectedRelationPayload(),
                            sourceOptions: getSourceOptionsPayload(),
                            offset: 0,
                            limit: currentLimit
                        });
                    }
                });
            }

            if (relationPicker) {
                relationPicker.addEventListener('change', selectRelationFromPicker);
            }

            if (applyFlatFileOptionsBtn) {
                applyFlatFileOptionsBtn.addEventListener('click', () => {
                    reloadWithFlatFileOptions(false);
                });
            }

            if (resetFlatFileOptionsBtn) {
                resetFlatFileOptionsBtn.addEventListener('click', () => {
                    reloadWithFlatFileOptions(true);
                });
            }

            if (applyJsonOptionsBtn) {
                applyJsonOptionsBtn.addEventListener('click', () => {
                    reloadWithJsonOptions(false);
                });
            }

            if (resetJsonOptionsBtn) {
                resetJsonOptionsBtn.addEventListener('click', () => {
                    reloadWithJsonOptions(true);
                });
            }

            if (applyExcelOptionsBtn) {
                applyExcelOptionsBtn.addEventListener('click', () => {
                    reloadWithExcelOptions(false);
                });
            }

            if (resetExcelOptionsBtn) {
                resetExcelOptionsBtn.addEventListener('click', () => {
                    reloadWithExcelOptions(true);
                });
            }

            if (runAggregationBtn) {
                runAggregationBtn.addEventListener('click', runQuickAggregation);
            }

            if (resetAggregationBtn) {
                resetAggregationBtn.addEventListener('click', resetQuickAggregation);
            }

            if (aggregationFunction) {
                aggregationFunction.addEventListener('change', syncAggregationControls);
            }

            [tableSortColumn, tableSortDirection].forEach((control) => {
                if (control) {
                    control.addEventListener('change', updateTableViewFromControls);
                }
            });

            if (columnPickerToggle && columnPickerMenu) {
                columnPickerToggle.addEventListener('click', (event) => {
                    event.stopPropagation();
                    columnPickerMenu.classList.toggle('hidden');
                });
                columnPickerMenu.addEventListener('click', (event) => {
                    event.stopPropagation();
                });
                document.addEventListener('click', () => {
                    columnPickerMenu.classList.add('hidden');
                });
            }

            if (showAllColumnsBtn) {
                showAllColumnsBtn.addEventListener('click', showAllColumns);
            }

            if (resetTableViewBtn) {
                resetTableViewBtn.addEventListener('click', resetTableViewPreference);
            }

            if (writeSource) {
                writeSource.addEventListener('change', refreshWritePreview);
            }

            if (writeCompression) {
                writeCompression.addEventListener('change', updateWriteSummary);
            }

            if (writeRowGroupSize) {
                writeRowGroupSize.addEventListener('input', updateWriteSummary);
            }

            if (writeJsonInput) {
                writeJsonInput.addEventListener('input', () => {
                    writeRows = [];
                    writeSchema = [];
                    renderWriteSchema();
                    updateWriteSummary();
                });
            }

            if (writePreviewBtn) {
                writePreviewBtn.addEventListener('click', refreshWritePreview);
            }

            if (writeCreateBtn) {
                writeCreateBtn.addEventListener('click', createParquetFromWrite);
            }

            exportButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    exportCurrentQuery(button.dataset.exportFormat);
                });
            });

            if (addEditRowBtn) {
                addEditRowBtn.addEventListener('click', () => {
                    addEditRow();
                });
            }

            if (resetEditsBtn) {
                resetEditsBtn.addEventListener('click', () => {
                    resetEditRows();
                });
            }

            if (resetColumnNamesBtn) {
                resetColumnNamesBtn.addEventListener('click', () => {
                    resetEditColumnNames();
                    renderEditPanel();
                    setStatus('Column names reset', 'status-success');
                });
            }

            if (saveEditsBtn) {
                saveEditsBtn.addEventListener('click', () => {
                    saveEditedData();
                });
            }

            if (editTableHeader) {
                editTableHeader.addEventListener('input', (event) => {
                    const target = event.target;
                    if (!target || !target.classList || !target.classList.contains('edit-column-name-input')) {
                        return;
                    }

                    const columnIndex = Number(target.dataset.columnIndex);
                    if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= currentColumns.length) {
                        return;
                    }

                    editColumnNames[columnIndex] = target.value;
                    updateEditSummary();
                });
            }

            if (editTableBody) {
                editTableBody.addEventListener('input', (event) => {
                    const target = event.target;
                    if (!target || !target.classList || !target.classList.contains('edit-cell-input')) {
                        return;
                    }

                    const rowIndex = Number(target.dataset.rowIndex);
                    const column = target.dataset.column;
                    if (!Number.isInteger(rowIndex) || !column || !editRows[rowIndex]) {
                        return;
                    }

                    const originalValue = currentRows[rowIndex] ? currentRows[rowIndex][column] : null;
                    editRows[rowIndex][column] = parseEditedValue(target.value, originalValue);
                    updateEditSummary();
                });

                editTableBody.addEventListener('click', (event) => {
                    const target = event.target;
                    if (!target || !target.classList || !target.classList.contains('edit-delete-row-btn')) {
                        return;
                    }

                    const rowIndex = Number(target.dataset.rowIndex);
                    if (Number.isInteger(rowIndex)) {
                        deleteEditRow(rowIndex);
                    }
                });
            }

            if (doctorSchemaDriftBtn) {
                doctorSchemaDriftBtn.addEventListener('click', () => {
                    setActiveView('doctor');
                    setStatus('Choosing reference file...', 'status-loading');
                    vscode.postMessage({
                        type: 'selectDoctorReferenceFile',
                        selectedRelation: getSelectedRelationPayload(),
                        sourceOptions: getSourceOptionsPayload()
                    });
                });
            }

            if (doctorDatasetScanBtn) {
                doctorDatasetScanBtn.addEventListener('click', () => {
                    setActiveView('doctor');
                    setStatus('Choosing dataset folder...', 'status-loading');
                    vscode.postMessage({ type: 'selectDoctorDatasetFolder' });
                });
            }

            if (selectCompareFileBtn) {
                selectCompareFileBtn.addEventListener('click', () => {
                    setActiveView('compare');
                    setStatus('Choosing compare file...', 'status-loading');
                    vscode.postMessage({
                        type: 'selectCompareFile',
                        customMappingEnabled: customCompareToggle ? customCompareToggle.checked : false,
                        selectedRelation: getSelectedRelationPayload(),
                        sourceOptions: getSourceOptionsPayload()
                    });
                });
            }

            if (runSmartDiffBtn) {
                runSmartDiffBtn.addEventListener('click', () => {
                    if (!currentCompareMetadata || !currentCompareMetadata.success) {
                        setStatus('Choose a compare file before running Smart Diff', 'status-error');
                        return;
                    }

                    setActiveView('compare');
                    setStatus('Running Smart Diff...', 'status-loading');
                    vscode.postMessage({
                        type: 'runSmartDiff',
                        selectedRelation: getSelectedRelationPayload(),
                        sourceOptions: getSourceOptionsPayload()
                    });
                });
            }

            if (selectJoinFileBtn) {
                selectJoinFileBtn.addEventListener('click', () => {
                    setActiveView('join');
                    setStatus('Choosing join file...', 'status-loading');
                    vscode.postMessage({
                        type: 'selectJoinFile',
                        selectedRelation: getSelectedRelationPayload(),
                        sourceOptions: getSourceOptionsPayload()
                    });
                });
            }

            if (runJoinBtn) {
                runJoinBtn.addEventListener('click', runJoinPreview);
            }

            if (exportJoinPreviewBtn) {
                exportJoinPreviewBtn.addEventListener('click', exportJoinPreview);
            }

            [joinBaseColumn, joinOtherColumn, joinType, joinLimit].forEach((control) => {
                if (control) {
                    control.addEventListener('change', () => {
                        if (currentJoinMetadata && currentJoinMetadata.success) {
                            runJoinPreview();
                        }
                    });
                }
            });

            if (runStrictCompareBtn) {
                runStrictCompareBtn.addEventListener('click', () => {
                    const orderMapping = collectCompareOrderMapping();
                    if (!orderMapping) {
                        setStatus('Select an order column before comparing', 'status-error');
                        return;
                    }

                    setActiveView('compare');
                    setStatus('Running strict compare...', 'status-loading');
                    vscode.postMessage({
                        type: 'runStrictCompare',
                        orderMapping,
                        selectedRelation: getSelectedRelationPayload(),
                        sourceOptions: getSourceOptionsPayload()
                    });
                });
            }

            if (runCustomCompareBtn) {
                runCustomCompareBtn.addEventListener('click', () => {
                    const mappings = collectCompareMappings();
                    const orderMapping = collectCompareOrderMapping();
                    if (mappings.length === 0) {
                        setStatus('Select at least one same-type mapping', 'status-error');
                        return;
                    }

                    if (!orderMapping) {
                        setStatus('Select an order column before comparing', 'status-error');
                        return;
                    }

                    setActiveView('compare');
                    setStatus('Running custom compare...', 'status-loading');
                    vscode.postMessage({
                        type: 'runCustomCompare',
                        mappings,
                        orderMapping,
                        selectedRelation: getSelectedRelationPayload(),
                        sourceOptions: getSourceOptionsPayload()
                    });
                });
            }

            if (customCompareToggle) {
                customCompareToggle.addEventListener('change', () => {
                    const mappingPanel = document.getElementById('compare-mapping-panel');
                    if (customCompareToggle.checked) {
                        if (runCustomCompareBtn) {
                            runCustomCompareBtn.classList.remove('hidden');
                        }
                        mappingPanel.classList.toggle('hidden', !currentCompareMetadata || !currentCompareMetadata.success);
                    } else {
                        if (runCustomCompareBtn) {
                            runCustomCompareBtn.classList.add('hidden');
                        }
                        mappingPanel.classList.add('hidden');
                    }

                    if (currentCompareMetadata && currentCompareMetadata.success) {
                        populateCompareOrderOptions(currentCompareMetadata);
                    }
                });
            }

            if (schemaSearchInput) {
                schemaSearchInput.addEventListener('input', () => {
                    if (currentSchema) {
                        renderSchemaColumns(currentSchema.columns || [], schemaSearchInput.value);
                    }
                });
            }

            if (copySchemaJsonBtn) {
                copySchemaJsonBtn.addEventListener('click', () => {
                    if (currentSchema) {
                        writeTextToClipboard(JSON.stringify(currentSchema, null, 2), 'Schema JSON copied');
                    }
                });
            }

            if (generateSchemaDocsBtn) {
                generateSchemaDocsBtn.addEventListener('click', () => {
                    if (!currentSchema) {
                        return;
                    }

                    currentSchemaDocs = generateSchemaDocumentation(currentSchema);
                    const docsPanel = document.getElementById('schema-docs-panel');
                    const docsOutput = document.getElementById('schema-docs-output');
                    docsOutput.value = currentSchemaDocs;
                    docsPanel.classList.remove('hidden');
                });
            }

            if (copySchemaDocsBtn) {
                copySchemaDocsBtn.addEventListener('click', () => {
                    if (currentSchemaDocs) {
                        writeTextToClipboard(currentSchemaDocs, 'Schema documentation copied');
                    }
                });
            }

            [visualizerChartType, visualizerXColumn, visualizerYColumn, visualizerAggregation, visualizerLimit].forEach((control) => {
                if (control) {
                    control.addEventListener('change', renderVisualizer);
                }
            });

            if (visualizerLimit) {
                visualizerLimit.addEventListener('input', renderVisualizer);
            }
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'data':
                    updateView(message.data);
                    break;
                case 'exportResult':
                    handleExportResult(message.result);
                    break;
                case 'editSaveResult':
                    handleEditSaveResult(message.result);
                    break;
                case 'writeResult':
                    handleWriteResult(message.result);
                    break;
                case 'compareResult':
                    handleCompareResult(message.result);
                    break;
                case 'compareMetadata':
                    handleCompareMetadata(message.result);
                    break;
                case 'joinMetadata':
                    handleJoinMetadata(message.result);
                    break;
                case 'joinResult':
                    handleJoinResult(message.result);
                    break;
                case 'joinPreviewExportResult':
                    setStatus(message.result && message.result.success ? 'Join preview exported' : (message.result && message.result.error) || 'Join preview export failed', message.result && message.result.success ? 'status-success' : 'status-error');
                    break;
                case 'doctorResult':
                    doctorRequestInFlight = false;
                    updateRelations(message.result);
                    currentDoctor = message.result && message.result.doctor ? message.result.doctor : null;
                    renderDoctorPanel(currentDoctor);
                    setStatus(message.result && message.result.success ? 'Doctor checks complete' : (message.result && message.result.error) || 'Doctor checks failed', message.result && message.result.success ? 'status-success' : 'status-error');
                    break;
                case 'doctorSchemaDriftResult':
                    currentDoctorSchemaDrift = message.result;
                    renderDoctorSchemaDrift(currentDoctorSchemaDrift);
                    setStatus(message.result && message.result.success ? 'Schema drift check complete' : (message.result && message.result.error) || 'Schema drift check failed', message.result && message.result.success ? 'status-success' : 'status-error');
                    break;
                case 'doctorDatasetResult':
                    currentDoctorDataset = message.result;
                    renderDoctorDatasetAnalysis(currentDoctorDataset);
                    setStatus(message.result && message.result.success ? 'Dataset scan complete' : (message.result && message.result.error) || 'Dataset scan failed', message.result && message.result.success ? 'status-success' : 'status-error');
                    break;
            }
        });
        `;
    }

    private getCssContent(): string {
        return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: var(--vscode-font-family); 
            font-size: var(--vscode-font-size); 
            color: var(--vscode-foreground); 
            background-color: var(--vscode-editor-background); 
            padding: 20px; 
        }
        .container { max-width: 100%; margin: 0 auto; }
        .header { 
            display: flex; justify-content: space-between; align-items: center; 
            margin-bottom: 20px; padding-bottom: 10px; 
            border-bottom: 1px solid var(--vscode-panel-border); 
        }
        .header-title {
            display: flex; align-items: center; gap: 10px; min-width: 0;
        }
        .header h1 { 
            color: var(--vscode-titleBar-activeForeground); font-size: 18px; 
        }
        .source-pill {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 999px;
            padding: 3px 8px;
            color: var(--vscode-descriptionForeground);
            background-color: var(--vscode-panelSectionHeader-background);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .controls { display: flex; align-items: center; gap: 10px; }
        .btn { 
            background-color: var(--vscode-button-background, #0e639c); 
            color: var(--vscode-button-foreground, #ffffff);
            border: 1px solid var(--vscode-button-border, transparent); 
            padding: 8px 12px; border-radius: 3px; cursor: pointer; 
            display: inline-flex; align-items: center; justify-content: center; gap: 5px;
            min-height: 32px; font-weight: 600;
        }
        .btn:hover { background-color: var(--vscode-button-hoverBackground, #1177bb); }
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground, #3a3d41);
            color: var(--vscode-button-secondaryForeground, #ffffff);
            border-color: var(--vscode-panel-border);
        }
        .btn-secondary:hover { background-color: var(--vscode-button-secondaryHoverBackground, #45494e); }
        .btn-danger {
            background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
            color: var(--vscode-inputValidation-errorForeground, #ffffff);
            border-color: var(--vscode-inputValidation-errorBorder, #be1100);
        }
        .btn-danger:hover { background-color: rgba(190, 17, 0, 0.35); }
        .status { font-size: 12px; padding: 4px 8px; border-radius: 3px; }
        .view-navigation {
            display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;
        }
        .view-tabs, .subtab-group {
            display: flex; gap: 4px; flex-wrap: wrap;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .subtabs { min-height: 33px; }
        .tab-btn {
            background: var(--vscode-toolbar-hoverBackground, transparent);
            color: var(--vscode-descriptionForeground);
            border: none; border-bottom: 2px solid transparent;
            padding: 8px 12px; cursor: pointer; border-radius: 3px 3px 0 0;
        }
        .primary-tab {
            font-weight: 600;
        }
        .subtab-btn {
            padding: 6px 10px;
        }
        .tab-btn:hover { background: var(--vscode-list-hoverBackground); }
        .tab-btn.active {
            color: var(--vscode-foreground);
            background: var(--vscode-panelSectionHeader-background);
            border-bottom-color: var(--vscode-focusBorder);
        }
        .view-panel { width: 100%; }
        .status-loading { 
            background-color: var(--vscode-inputValidation-warningBackground); 
            color: var(--vscode-inputValidation-warningForeground); 
        }
        .status-success { 
            background-color: var(--vscode-inputValidation-infoBackground); 
            color: var(--vscode-inputValidation-infoForeground); 
        }
        .status-error { 
            background-color: var(--vscode-inputValidation-errorBackground); 
            color: var(--vscode-inputValidation-errorForeground); 
        }
        .hidden { display: none !important; }
        .loading-container { 
            display: flex; flex-direction: column; align-items: center; 
            justify-content: center; padding: 40px; gap: 15px; 
        }
        .loading-spinner {
            width: 40px; height: 40px; border: 4px solid var(--vscode-panel-border);
            border-left: 4px solid var(--vscode-button-background); border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }
        }
        .error-container {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 15px; margin-bottom: 20px; border-radius: 3px;
        }
        .error-message h3 {
            color: var(--vscode-inputValidation-errorForeground); margin-bottom: 5px;
        }
        .query-container {
            display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;
            padding: 12px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .query-toolbar {
            display: flex; justify-content: space-between; align-items: center; gap: 12px;
        }
        .query-toolbar label {
            font-size: 12px; font-weight: 600; color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }
        .query-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .data-controls-body {
            display: flex; flex-direction: column; gap: 8px;
        }
        #query-input {
            width: 100%; min-height: 96px; resize: vertical; padding: 10px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            line-height: 1.45; border-radius: 3px;
        }
        #query-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        .query-meta {
            display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
            font-size: 12px; color: var(--vscode-descriptionForeground);
        }
        .query-meta code {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-textPreformat-foreground);
        }
        .relation-picker {
            display: inline-flex; align-items: center; gap: 6px;
            color: var(--vscode-descriptionForeground);
        }
        .relation-picker select {
            min-width: 180px; max-width: min(420px, 70vw); min-height: 28px;
            padding: 4px 8px; border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
        }
        .flat-file-options {
            display: grid; grid-template-columns: minmax(98px, auto) repeat(5, minmax(74px, 1fr)) auto;
            gap: 8px; align-items: end; padding: 10px 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .flat-file-options label {
            display: flex; flex-direction: column; gap: 5px;
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        .flat-file-header-toggle {
            min-height: 32px; justify-content: center;
        }
        .flat-file-header-toggle input {
            width: auto;
        }
        .flat-file-options input[type="text"], .flat-file-options select {
            width: 100%; min-height: 32px; padding: 6px 8px; border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        .flat-file-actions {
            display: grid; grid-template-columns: repeat(2, minmax(92px, 1fr));
            gap: 8px;
        }
        .json-file-options {
            display: grid; grid-template-columns: minmax(150px, auto) minmax(180px, 1fr) auto;
            gap: 8px; align-items: end; padding: 10px 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .json-file-options label {
            display: flex; flex-direction: column; gap: 5px;
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        .json-flatten-toggle {
            min-height: 32px; justify-content: center;
        }
        .json-flatten-toggle input {
            width: auto;
        }
        .json-file-options input[type="text"] {
            width: 100%; min-height: 32px; padding: 6px 8px; border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        .json-file-actions {
            display: grid; grid-template-columns: repeat(2, minmax(92px, 1fr));
            gap: 8px;
        }
        .excel-file-options {
            display: grid; grid-template-columns: repeat(2, minmax(120px, 180px)) minmax(110px, auto) auto;
            gap: 8px; align-items: end; padding: 10px 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .excel-file-options label {
            display: flex; flex-direction: column; gap: 5px;
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        .excel-file-options input[type="number"] {
            width: 100%; min-height: 32px; padding: 6px 8px; border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        .excel-infer-toggle {
            min-height: 32px; justify-content: center;
        }
        .excel-infer-toggle input {
            width: auto;
        }
        .excel-file-actions {
            display: grid; grid-template-columns: repeat(2, minmax(92px, 1fr));
            gap: 8px;
        }
        .quick-aggregation {
            display: grid; grid-template-columns: repeat(4, minmax(110px, 1fr)) auto;
            gap: 8px; align-items: end; padding-top: 4px;
        }
        .aggregation-actions {
            display: grid; grid-template-columns: repeat(2, minmax(82px, 1fr));
            gap: 8px;
        }
        .quick-aggregation label, .table-tools label, .join-controls label {
            display: flex; flex-direction: column; gap: 5px;
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        .quick-aggregation select, .quick-aggregation input,
        .table-tools select, .table-tools input,
        .write-controls select, .write-controls input,
        .join-controls select, .join-controls input {
            width: 100%; min-height: 32px; padding: 6px 8px; border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
        }
        .data-container { display: flex; flex-direction: column; gap: 15px; }
        .text-preview-container {
            display: flex; flex-direction: column; gap: 14px;
            padding: 14px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .text-preview-summary {
            display: flex; flex-wrap: wrap; gap: 10px;
        }
        .text-preview-content {
            margin: 0; min-height: 360px; max-height: 70vh; overflow: auto;
            padding: 14px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            line-height: 1.5; white-space: pre-wrap; word-break: break-word;
        }
        .table-tools {
            display: grid; grid-template-columns: minmax(130px, 1fr) minmax(120px, 0.7fr) minmax(240px, 1.4fr) auto;
            gap: 10px; align-items: end;
            padding: 12px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .table-column-picker {
            position: relative;
            display: flex; flex-direction: column; gap: 5px;
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        .column-picker-toggle {
            display: flex; align-items: center; justify-content: space-between; gap: 8px;
            width: 100%; min-height: 32px; padding: 6px 8px; border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            text-align: left; cursor: pointer;
        }
        .column-picker-caret {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
        }
        .column-picker-menu {
            position: absolute; top: calc(100% + 4px); left: 0; right: 0;
            z-index: 50; padding: 6px; border: 1px solid var(--vscode-dropdown-border);
            border-radius: 3px; background-color: var(--vscode-dropdown-background);
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
        }
        .column-picker-list {
            display: flex; flex-direction: column; gap: 2px;
            max-height: 220px; overflow: auto;
        }
        .column-picker-row {
            display: grid; grid-template-columns: 18px 1fr; gap: 7px; align-items: center;
            min-height: 28px; padding: 4px 6px; border-radius: 3px;
            color: var(--vscode-dropdown-foreground); cursor: pointer;
        }
        .column-picker-row:hover {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground);
        }
        .column-picker-row input {
            margin: 0;
        }
        .column-picker-label {
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .column-picker-empty {
            padding: 8px; color: var(--vscode-descriptionForeground);
        }
        .table-tool-actions {
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .table-tool-actions .btn {
            min-width: 86px;
        }
        .write-container { display: flex; flex-direction: column; gap: 14px; }
        .write-toolbar {
            display: flex; justify-content: space-between; align-items: center; gap: 12px;
            padding: 12px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .write-toolbar h2 { font-size: 15px; margin-bottom: 4px; }
        .write-toolbar p { color: var(--vscode-descriptionForeground); font-size: 12px; }
        .write-controls {
            display: grid; grid-template-columns: minmax(160px, 0.8fr) minmax(140px, 0.7fr) minmax(150px, 0.7fr) auto;
            gap: 10px; align-items: end;
            padding: 12px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .write-controls label {
            display: flex; flex-direction: column; gap: 5px;
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        #write-json-input {
            width: 100%; min-height: 150px; resize: vertical; padding: 10px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            line-height: 1.45; border-radius: 3px;
        }
        #write-json-input:disabled {
            opacity: 0.55;
        }
        .write-message {
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            background-color: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoForeground);
            border-radius: 3px; padding: 10px 12px;
        }
        .write-message-error {
            border-color: var(--vscode-inputValidation-errorBorder);
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
        }
        .write-summary {
            display: flex; gap: 20px; padding: 12px;
            background-color: var(--vscode-panelSectionHeader-background);
            border-radius: 3px; flex-wrap: wrap;
        }
        .write-panel {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
            padding: 12px; min-width: 0;
        }
        .write-panel h3 {
            font-size: 13px; margin-bottom: 10px;
            color: var(--vscode-foreground);
        }
        .write-table-wrap {
            overflow: auto; max-height: 360px;
        }
        .write-panel table {
            width: 100%; border-collapse: collapse; min-width: 760px;
        }
        .write-panel th,
        .write-panel td {
            padding: 7px 8px; border-bottom: 1px solid var(--vscode-panel-border);
            text-align: left; white-space: nowrap;
        }
        .write-panel th {
            position: sticky; top: 0; z-index: 1;
            background-color: var(--vscode-panelSectionHeader-background);
            color: var(--vscode-foreground);
        }
        .write-panel td {
            color: var(--vscode-descriptionForeground);
            max-width: 260px; overflow: hidden; text-overflow: ellipsis;
        }
        .write-column-name,
        .write-column-type {
            width: 100%; min-height: 30px; padding: 5px 7px; border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        .export-container { display: flex; flex-direction: column; gap: 14px; }
        .export-toolbar {
            display: flex; justify-content: space-between; align-items: center; gap: 12px;
            padding: 12px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .export-toolbar h2 { font-size: 15px; margin-bottom: 4px; }
        .export-toolbar p { color: var(--vscode-descriptionForeground); font-size: 12px; }
        .export-summary {
            display: flex; gap: 20px; padding: 12px;
            background-color: var(--vscode-panelSectionHeader-background);
            border-radius: 3px; flex-wrap: wrap;
        }
        .export-query-summary {
            flex: 1 1 360px; min-width: 220px;
        }
        .export-query-summary code {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-textPreformat-foreground);
            word-break: break-word;
        }
        .export-grid {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
            gap: 10px;
        }
        .export-option {
            min-height: 58px; padding: 10px 12px; border-radius: 3px;
            border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer; text-align: left;
            display: flex; flex-direction: column; justify-content: center; gap: 4px;
        }
        .export-option:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .export-option-label {
            font-weight: 700; color: var(--vscode-foreground);
            overflow-wrap: anywhere;
        }
        .export-option-detail {
            color: var(--vscode-descriptionForeground); font-size: 12px;
            font-family: var(--vscode-editor-font-family);
        }
        .export-message {
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            background-color: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoForeground);
            border-radius: 3px; padding: 10px 12px;
        }
        .export-message-error {
            border-color: var(--vscode-inputValidation-errorBorder);
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
        }
        .eda-container { display: flex; flex-direction: column; gap: 14px; }
        .eda-toolbar {
            display: flex; justify-content: space-between; align-items: center; gap: 12px;
            padding: 12px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .eda-toolbar h2 { font-size: 15px; margin-bottom: 4px; }
        .eda-toolbar p { color: var(--vscode-descriptionForeground); font-size: 12px; }
        .eda-summary {
            display: flex; gap: 20px; padding: 12px;
            background-color: var(--vscode-panelSectionHeader-background);
            border-radius: 3px; flex-wrap: wrap;
        }
        .eda-grid {
            display: grid; grid-template-columns: minmax(280px, 0.9fr) minmax(360px, 1.1fr);
            gap: 12px; align-items: start;
        }
        .eda-panel {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
            padding: 12px; min-width: 0;
        }
        .eda-panel h3 {
            font-size: 13px; margin-bottom: 10px;
            color: var(--vscode-foreground);
        }
        .eda-list {
            display: flex; flex-direction: column; gap: 8px;
        }
        .eda-suggestion,
        .eda-quality-item {
            padding: 9px 10px; border-radius: 3px;
            border: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            line-height: 1.4;
        }
        .eda-suggestion {
            border-left: 3px solid var(--vscode-focusBorder);
        }
        .eda-quality-item {
            color: var(--vscode-descriptionForeground);
        }
        .eda-table-wrap {
            overflow: auto; max-height: 360px;
        }
        .eda-panel table {
            width: 100%; border-collapse: collapse; min-width: 620px;
        }
        .eda-panel th,
        .eda-panel td {
            padding: 7px 8px; border-bottom: 1px solid var(--vscode-panel-border);
            text-align: left; white-space: nowrap;
        }
        .eda-panel th {
            position: sticky; top: 0; z-index: 1;
            background-color: var(--vscode-panelSectionHeader-background);
            color: var(--vscode-foreground);
        }
        .eda-panel td {
            color: var(--vscode-descriptionForeground);
            max-width: 240px; overflow: hidden; text-overflow: ellipsis;
        }
        .visualizer-container { display: flex; flex-direction: column; gap: 14px; }
        .visualizer-toolbar {
            display: grid; grid-template-columns: minmax(220px, 0.6fr) minmax(420px, 1.4fr);
            gap: 12px; align-items: end;
            padding: 12px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .visualizer-toolbar h2 { font-size: 15px; margin-bottom: 4px; }
        .visualizer-toolbar p { color: var(--vscode-descriptionForeground); font-size: 12px; }
        .visualizer-controls {
            display: grid; grid-template-columns: repeat(5, minmax(96px, 1fr));
            gap: 8px; align-items: end;
        }
        .visualizer-controls label {
            display: flex; flex-direction: column; gap: 5px;
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        .visualizer-controls select, .visualizer-controls input {
            width: 100%; min-height: 32px; padding: 6px 8px; border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
        }
        .visualizer-controls select:disabled {
            opacity: 0.55;
        }
        .visualizer-summary {
            display: flex; gap: 20px; padding: 12px;
            background-color: var(--vscode-panelSectionHeader-background);
            border-radius: 3px; flex-wrap: wrap;
        }
        .visualizer-message {
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            background-color: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoForeground);
            border-radius: 3px; padding: 10px 12px;
        }
        .visualizer-message-error {
            border-color: var(--vscode-inputValidation-warningBorder);
            background-color: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
        }
        .visualizer-chart-wrap {
            width: 100%; min-height: 420px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-editor-background);
            overflow: auto;
        }
        #visualizer-chart {
            display: block; width: 100%; min-width: 760px; height: 420px;
        }
        .chart-axis {
            stroke: var(--vscode-descriptionForeground); stroke-width: 1;
        }
        .chart-grid {
            stroke: var(--vscode-panel-border); stroke-width: 1;
        }
        .chart-axis-label, .chart-axis-title {
            fill: var(--vscode-descriptionForeground); font-size: 11px;
            font-family: var(--vscode-font-family);
        }
        .chart-axis-title {
            fill: var(--vscode-foreground); font-weight: 600;
        }
        .chart-bar {
            fill: var(--vscode-charts-blue, #3794ff);
        }
        .chart-bar:hover {
            fill: var(--vscode-charts-orange, #d18616);
        }
        .chart-line {
            fill: none; stroke: var(--vscode-charts-green, #89d185);
            stroke-width: 3; stroke-linejoin: round; stroke-linecap: round;
        }
        .chart-point {
            fill: var(--vscode-charts-purple, #b180d7);
            stroke: var(--vscode-editor-background); stroke-width: 1.5;
        }
        .chart-point:hover {
            fill: var(--vscode-charts-yellow, #cca700);
        }
        .summary {
            display: flex; gap: 20px; padding: 15px;
            background-color: var(--vscode-panelSectionHeader-background);
            border-radius: 3px; flex-wrap: wrap;
        }
        .summary-item { font-size: 13px; color: var(--vscode-descriptionForeground); }
        .summary-item span { font-weight: 600; color: var(--vscode-foreground); }
        .table-container {
            overflow-x: auto; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; max-height: 70vh;
        }
        table { width: 100%; border-collapse: collapse; min-width: 600px; }
        th {
            background-color: var(--vscode-panelSectionHeader-background);
            color: var(--vscode-panelTitle-activeForeground); padding: 12px 10px;
            text-align: left; border-bottom: 1px solid var(--vscode-panel-border);
            font-weight: 600; position: sticky; top: 0; z-index: 10;
        }
        td {
            padding: 10px; border-bottom: 1px solid var(--vscode-panel-border);
            word-break: break-word; max-width: 300px; overflow: hidden;
            text-overflow: ellipsis; white-space: nowrap; vertical-align: top;
        }
        th.csv-column-color {
            border-top: 3px solid var(--csv-column-color);
            box-shadow: inset 4px 0 0 var(--csv-column-color);
        }
        td.csv-column-color {
            box-shadow: inset 4px 0 0 var(--csv-column-color);
            background-image: linear-gradient(90deg, color-mix(in srgb, var(--csv-column-color) 12%, transparent), transparent 46px);
        }
        tr:hover { background-color: var(--vscode-list-hoverBackground); }
        .null-value {
            color: var(--vscode-inputPlaceholderForeground); font-style: italic;
        }
        .object-value {
            color: var(--vscode-textPreformat-foreground);
            font-family: var(--vscode-editor-font-family); font-size: 11px;
            white-space: pre-wrap; max-height: 100px; overflow-y: auto;
        }
        .empty-value {
            text-align: center; padding: 20px; color: var(--vscode-descriptionForeground);
        }
        .edit-container { display: flex; flex-direction: column; gap: 14px; }
        .edit-toolbar {
            display: flex; justify-content: space-between; align-items: center; gap: 12px;
            padding: 12px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .edit-toolbar h2 { font-size: 15px; margin-bottom: 4px; }
        .edit-toolbar p {
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        .edit-actions {
            display: flex; align-items: center; justify-content: flex-end;
            gap: 8px; flex-wrap: wrap;
        }
        .edit-column-tools {
            display: flex; justify-content: space-between; align-items: center; gap: 12px;
            padding: 10px 12px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .edit-column-tools h3 {
            font-size: 13px; margin-bottom: 4px;
        }
        .edit-column-tools p {
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        .edit-summary {
            display: flex; gap: 20px; padding: 12px;
            background-color: var(--vscode-panelSectionHeader-background);
            border-radius: 3px; flex-wrap: wrap;
        }
        .edit-message {
            border-radius: 3px; padding: 10px 12px; font-size: 12px;
            word-break: break-word;
        }
        .edit-message-success {
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            background-color: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoForeground);
        }
        .edit-message-error {
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
        }
        .edit-table-container {
            overflow: auto; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; max-height: 70vh;
        }
        #edit-table { width: max-content; min-width: 100%; }
        .edit-action-column {
            width: 92px; min-width: 92px; max-width: 92px;
            text-align: center;
        }
        .edit-cell { min-width: 160px; padding: 4px; }
        .edit-column-name-cell {
            min-width: 180px; padding: 6px;
            vertical-align: top;
        }
        .edit-column-original-name {
            display: block; max-width: 220px; margin-bottom: 4px;
            color: var(--vscode-descriptionForeground); font-size: 11px; font-weight: 400;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .edit-column-name-input {
            width: 100%; min-width: 160px; height: 28px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px; padding: 4px 7px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: 12px; font-weight: 600;
        }
        .edit-column-name-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        .edit-cell-input {
            width: 100%; min-width: 150px; height: 30px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px; padding: 4px 7px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }
        .edit-cell-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        .schema-container { display: flex; flex-direction: column; gap: 14px; }
        .schema-toolbar {
            display: flex; justify-content: space-between; align-items: flex-end;
            gap: 12px; flex-wrap: wrap;
        }
        .schema-search {
            display: flex; flex-direction: column; gap: 6px; min-width: 260px; flex: 1;
        }
        .schema-search label {
            font-size: 12px; font-weight: 600; color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }
        #schema-search-input {
            width: 100%; padding: 8px 10px; border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        #schema-search-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        .schema-actions, .schema-docs-toolbar {
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .schema-summary {
            display: flex; gap: 20px; padding: 12px;
            background-color: var(--vscode-panelSectionHeader-background);
            border-radius: 3px; flex-wrap: wrap;
        }
        .schema-layout {
            display: grid; grid-template-columns: minmax(260px, 34%) minmax(360px, 1fr);
            gap: 14px; align-items: start;
        }
        .schema-tree-panel, .schema-column-panel, .schema-docs-panel {
            border: 1px solid var(--vscode-panel-border); border-radius: 3px;
            background-color: var(--vscode-sideBar-background);
        }
        .schema-tree-panel h2, .schema-column-panel h2, .schema-docs-toolbar h2 {
            font-size: 13px; font-weight: 600; padding: 10px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        #schema-tree {
            max-height: 58vh; overflow: auto; padding: 8px;
        }
        .schema-tree-list {
            list-style: none; margin: 0; padding: 0;
        }
        .schema-tree-row {
            display: flex; align-items: center; gap: 6px; min-height: 28px;
            border-radius: 3px; padding: 3px 4px;
        }
        .schema-tree-row:hover { background-color: var(--vscode-list-hoverBackground); }
        .schema-tree-name {
            font-family: var(--vscode-editor-font-family); font-weight: 600;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .schema-chip {
            font-size: 11px; padding: 2px 6px; border-radius: 999px;
            border: 1px solid var(--vscode-panel-border);
            color: var(--vscode-textPreformat-foreground);
            white-space: nowrap;
        }
        .schema-chip-muted { color: var(--vscode-descriptionForeground); }
        #schema-column-list {
            display: flex; flex-direction: column; gap: 10px;
            max-height: 58vh; overflow: auto; padding: 10px;
        }
        .schema-column-card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-editor-background);
            padding: 10px;
        }
        .schema-column-header {
            display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px;
        }
        .schema-column-title {
            font-weight: 600; color: var(--vscode-foreground);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .schema-column-header code {
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family);
            word-break: break-all;
        }
        .schema-field-grid {
            display: grid; grid-template-columns: minmax(130px, 0.45fr) minmax(160px, 1fr);
            gap: 6px 10px; margin: 0;
        }
        .schema-field-grid dt {
            color: var(--vscode-descriptionForeground);
        }
        .schema-field-grid dd {
            margin: 0; font-family: var(--vscode-editor-font-family);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .schema-docs-panel { margin-top: 2px; }
        .schema-docs-toolbar {
            justify-content: space-between; border-bottom: 1px solid var(--vscode-panel-border);
        }
        .schema-docs-toolbar h2 { border-bottom: none; }
        #schema-docs-output {
            width: 100%; min-height: 220px; resize: vertical; padding: 10px;
            border: none; background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-editor-font-family); line-height: 1.45;
        }
        .doctor-container { display: flex; flex-direction: column; gap: 14px; }
        .doctor-hero {
            display: flex; justify-content: space-between; align-items: center; gap: 16px;
            padding: 14px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .doctor-hero h2 { font-size: 16px; margin-bottom: 4px; }
        .doctor-hero p { color: var(--vscode-descriptionForeground); font-size: 12px; }
        .doctor-actions {
            display: flex; gap: 8px; flex-wrap: wrap; margin-left: auto;
        }
        .doctor-score {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            min-width: 92px; min-height: 72px; border-radius: 3px;
            border: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
        }
        .doctor-score span {
            font-size: 28px; font-weight: 700;
        }
        .doctor-score small {
            color: var(--vscode-descriptionForeground); font-size: 11px;
        }
        .doctor-summary {
            display: flex; gap: 20px; padding: 12px;
            background-color: var(--vscode-panelSectionHeader-background);
            border-radius: 3px; flex-wrap: wrap;
        }
        .doctor-grid {
            display: grid; grid-template-columns: repeat(2, minmax(280px, 1fr));
            gap: 14px; align-items: start;
        }
        .doctor-panel {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
            overflow: hidden;
        }
        .doctor-panel h3 {
            font-size: 13px; padding: 10px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .doctor-panel > div {
            padding: 10px; display: flex; flex-direction: column; gap: 8px;
            max-height: 360px; overflow: auto;
        }
        .doctor-row-groups-panel > div { max-height: 460px; }
        .doctor-check-row, .doctor-metric-row {
            display: flex; justify-content: space-between; align-items: center; gap: 10px;
            padding: 6px 8px; border-radius: 3px;
            background-color: var(--vscode-editor-background);
        }
        .doctor-check-row span:first-child {
            font-weight: 700; min-width: 44px;
        }
        .doctor-pass span:first-child { color: var(--vscode-testing-iconPassed); }
        .doctor-error span:first-child { color: var(--vscode-testing-iconFailed); }
        .doctor-card, .doctor-issue-list {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; padding: 8px;
            background-color: var(--vscode-editor-background);
        }
        .doctor-warning-card { border-color: var(--vscode-inputValidation-warningBorder); }
        .doctor-card h4, .doctor-issue-list h4 {
            font-size: 12px; margin-bottom: 6px;
        }
        .doctor-card p, .doctor-issue-list p {
            color: var(--vscode-descriptionForeground); margin-top: 4px;
        }
        .doctor-issue {
            padding: 6px 8px; border-radius: 3px; margin-top: 6px;
        }
        .doctor-issue.doctor-error {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
        }
        .doctor-issue.doctor-warning {
            background-color: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
        }
        .doctor-warning-row {
            background-color: rgba(220, 170, 60, 0.18);
        }
        .doctor-panel table {
            min-width: 760px;
        }
        @media (max-width: 820px) {
            .flat-file-options { grid-template-columns: 1fr; }
            .flat-file-actions { grid-template-columns: 1fr; }
            .json-file-options { grid-template-columns: 1fr; }
            .json-file-actions { grid-template-columns: 1fr; }
            .excel-file-options { grid-template-columns: 1fr; }
            .excel-file-actions { grid-template-columns: 1fr; }
            .quick-aggregation { grid-template-columns: 1fr; }
            .aggregation-actions { grid-template-columns: 1fr; }
            .table-tools { grid-template-columns: 1fr; }
            .write-toolbar { align-items: stretch; flex-direction: column; }
            .edit-toolbar, .edit-column-tools { align-items: stretch; flex-direction: column; }
            .write-controls { grid-template-columns: 1fr; }
            .eda-grid { grid-template-columns: 1fr; }
            .visualizer-toolbar { grid-template-columns: 1fr; }
            .visualizer-controls { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
            .schema-layout { grid-template-columns: 1fr; }
            .schema-toolbar { align-items: stretch; }
            .schema-actions { width: 100%; }
            .doctor-grid { grid-template-columns: 1fr; }
            .doctor-hero { align-items: stretch; flex-direction: column; }
            .doctor-actions { margin-left: 0; }
        }
        .compare-container { display: flex; flex-direction: column; gap: 14px; }
        .compare-toolbar {
            display: grid; grid-template-columns: minmax(240px, 1fr) auto; align-items: center;
            gap: 12px; flex-wrap: wrap;
            padding: 12px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .compare-toolbar h2 {
            font-size: 15px; margin-bottom: 4px;
        }
        .compare-toolbar p {
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        .compare-actions {
            display: grid; grid-template-columns: repeat(2, max-content);
            align-items: center; justify-content: end;
            gap: 8px;
        }
        .compare-toggle {
            display: flex; align-items: center; gap: 6px;
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        .compare-order-panel {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
            padding: 12px; display: flex; flex-direction: column; gap: 10px;
        }
        .compare-order-panel h3 {
            font-size: 14px;
        }
        .compare-order-controls {
            display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 10px;
        }
        .compare-order-controls label {
            display: flex; flex-direction: column; gap: 6px;
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        .compare-order-controls select {
            width: 100%; padding: 6px 8px; border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
        }
        .compare-mapping-panel {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
            padding: 12px; display: flex; flex-direction: column; gap: 12px;
        }
        .compare-mapping-header {
            display: flex; justify-content: space-between; align-items: center;
            gap: 10px; flex-wrap: wrap;
        }
        .compare-mapping-header h3 {
            font-size: 14px;
        }
        .compare-mapping-header span {
            color: var(--vscode-descriptionForeground);
            font-size: 12px; word-break: break-all;
        }
        .compare-column-lists {
            display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px;
        }
        .compare-column-lists h4 {
            font-size: 12px; color: var(--vscode-descriptionForeground);
            margin-bottom: 6px; text-transform: uppercase;
        }
        .compare-column-list {
            border: 1px solid var(--vscode-panel-border); border-radius: 3px;
            max-height: 180px; overflow: auto; background-color: var(--vscode-editor-background);
        }
        .compare-column-item {
            display: grid; grid-template-columns: minmax(0, 1fr) minmax(90px, 0.7fr);
            gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border);
        }
        .compare-column-item span {
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .compare-column-item code {
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family); font-size: 11px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .compare-mapping-list {
            display: flex; flex-direction: column; gap: 6px;
            max-height: 260px; overflow: auto;
        }
        .compare-mapping-row {
            display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, 1.2fr) minmax(90px, 0.7fr);
            gap: 8px; align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .compare-mapping-row-header {
            color: var(--vscode-descriptionForeground);
            font-size: 11px; font-weight: 600; text-transform: uppercase;
            padding-top: 0;
        }
        .compare-mapping-base {
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            font-family: var(--vscode-editor-font-family);
        }
        .compare-mapping-row select {
            width: 100%; padding: 6px 8px; border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
        }
        .compare-mapping-row code {
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family); font-size: 11px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .compare-error {
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border-radius: 3px; padding: 10px 12px;
        }
        .compare-smart-summary {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; padding: 12px;
            background-color: var(--vscode-sideBar-background);
            display: flex; flex-direction: column; gap: 10px;
        }
        .smart-summary-header {
            display: flex; justify-content: space-between; align-items: center; gap: 12px;
            flex-wrap: wrap;
        }
        .smart-summary-header h3 {
            font-size: 14px;
        }
        .smart-summary-header span {
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }
        .smart-summary-grid {
            display: flex; gap: 12px; flex-wrap: wrap;
        }
        .smart-skipped-columns {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
        .compare-summary {
            display: flex; gap: 20px; padding: 12px;
            background-color: var(--vscode-panelSectionHeader-background);
            border-radius: 3px; flex-wrap: wrap;
        }
        .compare-results {
            display: grid; grid-template-columns: minmax(320px, 1fr) minmax(320px, 1fr);
            gap: 14px; align-items: start;
        }
        .compare-pane {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
            min-width: 0;
        }
        .compare-pane h3 {
            font-size: 13px; padding: 10px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .compare-table-wrap {
            max-height: 64vh; overflow: auto;
        }
        .compare-table-wrap table {
            min-width: 100%; width: max-content;
        }
        .compare-row-index {
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family);
            font-weight: 600;
        }
        .compare-row-mismatch {
            background-color: rgba(180, 40, 40, 0.18);
        }
        .compare-row-mismatch:hover {
            background-color: rgba(180, 40, 40, 0.26);
        }
        .compare-row-missing {
            background-color: rgba(180, 40, 40, 0.3);
        }
        .compare-cell-mismatch {
            background-color: rgba(220, 170, 60, 0.38);
            color: var(--vscode-editor-foreground);
            font-weight: 600;
            outline: 1px solid rgba(220, 170, 60, 0.7);
            outline-offset: -1px;
        }
        .join-container {
            display: flex; flex-direction: column; gap: 14px;
        }
        .join-toolbar {
            display: grid; grid-template-columns: minmax(240px, 1fr) auto; align-items: center;
            gap: 12px; padding: 12px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .join-toolbar h2 {
            font-size: 15px; margin-bottom: 4px;
        }
        .join-toolbar p {
            color: var(--vscode-descriptionForeground); font-size: 12px;
        }
        .join-actions {
            display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;
        }
        .join-controls {
            display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr));
            gap: 10px; padding: 12px; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; background-color: var(--vscode-sideBar-background);
        }
        .join-summary {
            display: flex; gap: 20px; padding: 12px;
            background-color: var(--vscode-panelSectionHeader-background);
            border-radius: 3px; flex-wrap: wrap;
        }
        .join-error {
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border-radius: 3px; padding: 10px 12px;
        }
        .join-results {
            overflow: auto; border: 1px solid var(--vscode-panel-border);
            border-radius: 3px; max-height: 70vh;
        }
        .join-results table {
            min-width: 100%; width: max-content;
        }
        @media (max-width: 980px) {
            .compare-toolbar { grid-template-columns: 1fr; }
            .compare-actions { justify-content: stretch; grid-template-columns: 1fr; }
            .compare-results { grid-template-columns: 1fr; }
            .compare-column-lists { grid-template-columns: 1fr; }
            .compare-mapping-row { grid-template-columns: 1fr; }
            .compare-order-controls { grid-template-columns: 1fr; }
            .join-toolbar { grid-template-columns: 1fr; }
            .join-actions { justify-content: stretch; }
            .join-controls { grid-template-columns: 1fr; }
        }
        .icon { font-size: 14px; }
        `;
    }

    /**
     * Generates a random nonce string that is 32 characters long.
     * The nonce string is used to allow the webview to execute a script
     * tag with a nonce attribute that matches the value of the nonce string.
     * @returns {string} A random nonce string that is 32 characters long.
     */
    private getNonce(): string {
        let text = '';
        const possible = NONCE_STRING_POSSIBLE;
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
