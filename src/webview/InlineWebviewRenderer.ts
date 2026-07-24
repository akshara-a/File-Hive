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
            <title>Parquet Viewer</title>
        </head>
        <body>
            <div class="container">
                ${this.generateHeader()}
                ${this.generateViewTabs()}
                ${this.generateErrorContainer()}
                ${this.generateLoadingContainer()}
                <div id="data-view" class="view-panel">
                    ${this.generateQueryContainer()}
                    ${this.generateDataContainer()}
                </div>
                ${this.generateEditContainer()}
                ${this.generateSchemaContainer()}
                ${this.generateDoctorContainer()}
                ${this.generateCompareContainer()}
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

    private generateHeader(): string {
        return `
        <header class="header">
            <h1>Parquet File Viewer</h1>
            <div class="controls">
                <button id="refresh-btn" class="btn">
                    <span class="icon">↻</span> Refresh
                </button>
                <span id="status" class="status status-loading">Loading...</span>
            </div>
        </header>`;
    }

    private generateViewTabs(): string {
        return `
        <div class="view-tabs" role="tablist">
            <button id="data-tab" class="tab-btn active" role="tab" aria-selected="true">Data</button>
            <button id="edit-tab" class="tab-btn" role="tab" aria-selected="false">Edit</button>
            <button id="doctor-tab" class="tab-btn" role="tab" aria-selected="false">Doctor</button>
            <button id="schema-tab" class="tab-btn" role="tab" aria-selected="false">Schema</button>
            <button id="compare-tab" class="tab-btn" role="tab" aria-selected="false">Compare</button>
            <button id="visualizer-tab" class="tab-btn" role="tab" aria-selected="false">Visualize</button>
        </div>`;
    }

    private generateDoctorContainer(): string {
        return `
        <section id="doctor-container" class="doctor-container view-panel hidden">
            <div class="doctor-hero">
                <div>
                    <h2>Parquet Doctor</h2>
                    <p>Integrity, schema, row group, statistics, data quality, compression, and dataset diagnostics.</p>
                </div>
                <div class="doctor-actions">
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
                <section class="doctor-panel">
                    <h3>Column Statistics Check</h3>
                    <div id="doctor-column-statistics"></div>
                </section>
                <section class="doctor-panel">
                    <h3>Data Quality Validation</h3>
                    <div id="doctor-data-quality"></div>
                </section>
                <section class="doctor-panel">
                    <h3>Decimal and Timestamp Diagnostics</h3>
                    <div id="doctor-decimal-timestamp"></div>
                </section>
                <section class="doctor-panel">
                    <h3>Compression and Encoding Analysis</h3>
                    <div id="doctor-compression-encoding"></div>
                </section>
                <section class="doctor-panel">
                    <h3>Schema Drift Detection</h3>
                    <div id="doctor-schema-drift"></div>
                </section>
            </div>
            <section class="doctor-panel doctor-row-groups-panel">
                <h3>Row Group Analysis</h3>
                <div id="doctor-row-groups"></div>
            </section>
            <section class="doctor-panel doctor-row-groups-panel">
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
        <section class="query-container">
            <div class="query-toolbar">
                <label for="query-input">SQL Query</label>
                <div class="query-actions">
                    <button id="run-query-btn" class="btn">Run Query</button>
                    <button id="reset-query-btn" class="btn btn-secondary">Reset</button>
                    <button id="export-csv-btn" class="btn btn-secondary">Export CSV</button>
                    <button id="export-json-btn" class="btn btn-secondary">Export JSON</button>
                    <button id="export-sqlite-btn" class="btn btn-secondary">Export SQLite</button>
                </div>
            </div>
            <textarea id="query-input" spellcheck="false">SELECT * FROM parquet_data</textarea>
            <div class="query-meta">
                Table: <code>parquet_data</code>
                <span id="query-limit-message" class="hidden">Showing first 1000 rows.</span>
            </div>
        </section>`;
    }

    private generateCompareContainer(): string {
        return `
        <section id="compare-container" class="compare-container view-panel hidden">
            <div class="compare-toolbar">
                <div>
                    <h2>Compare Parquet Files</h2>
                    <p>Strict compare requires matching column names and order. Custom mapping compares selected same-type columns by row order.</p>
                </div>
                <div class="compare-actions">
                    <label class="compare-toggle">
                        <input id="custom-compare-toggle" type="checkbox" />
                        Custom mapping
                    </label>
                    <button id="select-compare-file-btn" class="btn">Choose Compare File</button>
                    <button id="run-strict-compare-btn" class="btn btn-secondary">Run Strict Compare</button>
                    <button id="run-custom-compare-btn" class="btn btn-secondary hidden">Run Custom Compare</button>
                </div>
            </div>
            <div id="compare-error" class="compare-error hidden"></div>
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
            <div id="compare-empty" class="empty-value">Choose another Parquet file to compare.</div>
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

    private generateErrorContainer(): string {
        return `
        <div id="error-container" class="error-container hidden">
            <div class="error-message">
                <h3>Error Reading Parquet File</h3>
                <p id="error-text"></p>
            </div>
        </div>`;
    }

    private generateLoadingContainer(): string {
        return `
        <div id="loading-container" class="loading-container">
            <div class="loading-spinner"></div>
            <div>Loading parquet file...</div>
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
                    <h2>Edit Data</h2>
                    <p>Edits will be saved as a new Parquet file. To view the changes, open that new Parquet file.</p>
                </div>
                <div class="edit-actions">
                    <button id="add-edit-row-btn" class="btn btn-secondary">Add Row</button>
                    <button id="reset-edits-btn" class="btn btn-secondary">Reset Edits</button>
                    <button id="save-edits-btn" class="btn">Save New Parquet</button>
                </div>
            </div>
            <div class="edit-summary">
                <div class="summary-item">Editable Rows: <span id="edit-row-count">0</span></div>
                <div class="summary-item">Columns: <span id="edit-column-count">0</span></div>
                <div class="summary-item">Changes: <span id="edit-change-count">0</span></div>
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
        const DEFAULT_QUERY = 'SELECT * FROM parquet_data';
        let currentQuery = DEFAULT_QUERY;
        let currentSchema = null;
        let currentSchemaDocs = '';
        let currentCompareResult = null;
        let currentCompareMetadata = null;
        let currentDoctorSchemaDrift = null;
        let currentDoctorDataset = null;
        let currentColumns = [];
        let currentRows = [];
        let editRows = [];

        function initialize(data) {
            const queryInput = document.getElementById('query-input');
            currentQuery = data.query || DEFAULT_QUERY;
            if (queryInput) {
                queryInput.value = currentQuery;
            }
            updateView(data);
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
            const dataTab = document.getElementById('data-tab');
            const visualizerTab = document.getElementById('visualizer-tab');
            const editTab = document.getElementById('edit-tab');
            const doctorTab = document.getElementById('doctor-tab');
            const schemaTab = document.getElementById('schema-tab');
            const compareTab = document.getElementById('compare-tab');
            const dataView = document.getElementById('data-view');
            const visualizerContainer = document.getElementById('visualizer-container');
            const editContainer = document.getElementById('edit-container');
            const doctorContainer = document.getElementById('doctor-container');
            const schemaContainer = document.getElementById('schema-container');
            const compareContainer = document.getElementById('compare-container');

            const showVisualizer = viewName === 'visualizer';
            const showEdit = viewName === 'edit';
            const showDoctor = viewName === 'doctor';
            const showSchema = viewName === 'schema';
            const showCompare = viewName === 'compare';
            dataTab.classList.toggle('active', !showVisualizer && !showEdit && !showDoctor && !showSchema && !showCompare);
            visualizerTab.classList.toggle('active', showVisualizer);
            editTab.classList.toggle('active', showEdit);
            doctorTab.classList.toggle('active', showDoctor);
            schemaTab.classList.toggle('active', showSchema);
            compareTab.classList.toggle('active', showCompare);
            dataTab.setAttribute('aria-selected', String(!showVisualizer && !showEdit && !showDoctor && !showSchema && !showCompare));
            visualizerTab.setAttribute('aria-selected', String(showVisualizer));
            editTab.setAttribute('aria-selected', String(showEdit));
            doctorTab.setAttribute('aria-selected', String(showDoctor));
            schemaTab.setAttribute('aria-selected', String(showSchema));
            compareTab.setAttribute('aria-selected', String(showCompare));
            dataView.classList.toggle('hidden', showVisualizer || showEdit || showDoctor || showSchema || showCompare);
            visualizerContainer.classList.toggle('hidden', !showVisualizer);
            editContainer.classList.toggle('hidden', !showEdit);
            doctorContainer.classList.toggle('hidden', !showDoctor);
            schemaContainer.classList.toggle('hidden', !showSchema);
            compareContainer.classList.toggle('hidden', !showCompare);

            if (showVisualizer) {
                renderVisualizer();
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

        function exportCurrentQuery(format) {
            const queryInput = document.getElementById('query-input');
            currentQuery = queryInput ? queryInput.value.trim() || DEFAULT_QUERY : DEFAULT_QUERY;
            setStatus('Exporting ' + format.toUpperCase() + '...', 'status-loading');
            vscode.postMessage({ type: 'export', format, query: currentQuery });
        }

        function handleExportResult(result) {
            if (!result || !result.success) {
                if (result && result.error === 'Export cancelled.') {
                    setStatus('Export cancelled', 'status-success');
                } else {
                    setStatus(result && result.error ? result.error : 'Export failed', 'status-error');
                }
                return;
            }

            setStatus(
                'Exported ' + formatCount(result.rowsExported) + ' rows to ' + result.format.toUpperCase(),
                'status-success'
            );
        }

        function cloneRows(rows) {
            return JSON.parse(JSON.stringify(rows || []));
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
            let changes = Math.abs(editRows.length - currentRows.length) * Math.max(currentColumns.length, 1);
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

            if (rowCount) {
                rowCount.textContent = formatCount(editRows.length);
            }

            if (columnCount) {
                columnCount.textContent = formatCount(currentColumns.length);
            }

            if (changeCount) {
                changeCount.textContent = formatCount(countEditedCells());
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

            currentColumns.forEach((column) => {
                const th = document.createElement('th');
                th.textContent = column;
                th.title = column;
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

        function saveEditedParquet() {
            if (!currentColumns.length) {
                setStatus('No editable data loaded', 'status-error');
                return;
            }

            setStatus('Saving new Parquet...', 'status-loading');
            vscode.postMessage({
                type: 'saveEditedParquet',
                columns: currentColumns,
                rows: editRows
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

            const outputPath = result.outputPath || 'the new Parquet file';
            const successText = 'Saved ' + formatCount(result.rowsExported) + ' rows as a new Parquet file. To view the changes, open ' + outputPath + '.';
            setStatus('Saved new Parquet', 'status-success');

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
            setStatus(
                'Found ' + formatCount(result.mismatchCount) + ' mismatched rows',
                result.mismatchCount ? 'status-error' : 'status-success'
            );
        }

        function resetCompareState() {
            currentCompareResult = null;
            currentCompareMetadata = null;

            document.getElementById('compare-error').classList.add('hidden');
            document.getElementById('compare-summary').classList.add('hidden');
            document.getElementById('compare-results').classList.add('hidden');
            document.getElementById('compare-order-panel').classList.add('hidden');
            document.getElementById('compare-mapping-panel').classList.add('hidden');
            document.getElementById('compare-empty').textContent = 'Choose another Parquet file to compare.';
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
            const customCompareToggle = document.getElementById('custom-compare-toggle');
            const baseColumn = (metadata.baseColumns || []).find((column) => column.name === baseSelect.value);
            compareSelect.innerHTML = '';

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

            compareSelect.disabled = !customCompareToggle.checked;
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

        function renderCompareResult(result) {
            const errorElement = document.getElementById('compare-error');
            const summaryElement = document.getElementById('compare-summary');
            const emptyElement = document.getElementById('compare-empty');
            const resultsElement = document.getElementById('compare-results');

            errorElement.classList.add('hidden');
            summaryElement.classList.add('hidden');
            resultsElement.classList.add('hidden');
            emptyElement.classList.remove('hidden');

            if (!result) {
                emptyElement.textContent = 'Choose another Parquet file to compare.';
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
            summaryElement.classList.remove('hidden');
            emptyElement.classList.add('hidden');
            resultsElement.classList.remove('hidden');

            if (result.truncated) {
                errorElement.textContent = 'Showing first ' + formatCount(result.mismatchLimit) + ' mismatches.';
                errorElement.classList.remove('hidden');
            }

            createCompareTables(result.columns || [], result.mismatches || []);
        }

        function renderDoctorPanel(doctor) {
            if (!doctor) {
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
            ];
            container.innerHTML = '';
            checks.forEach(([label, passed]) => {
                container.appendChild(createDoctorCheckRow(label, passed));
            });
            container.appendChild(createDoctorMetricRow('File size', formatBytes(integrity.fileSize || 0)));
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
                container.appendChild(createDoctorEmpty('Choose a reference Parquet file to detect added, removed, renamed, or type-changed columns.'));
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
            header.innerHTML = '<tr><th>Row Group</th><th>Rows</th><th>Compressed</th><th>Uncompressed</th><th>Compression Ratio</th><th>Column Chunks</th><th>Warnings</th></tr>';
            const body = document.createElement('tbody');
            rowGroups.forEach((rowGroup) => {
                const row = document.createElement('tr');
                if (rowGroup.issues && rowGroup.issues.length) {
                    row.className = 'doctor-warning-row';
                }
                [
                    rowGroup.id,
                    formatCount(rowGroup.rowCount),
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
            createCompareHeader(document.getElementById('compare-base-header'), columns);
            createCompareHeader(document.getElementById('compare-other-header'), columns);

            const baseBody = document.getElementById('compare-base-body');
            const otherBody = document.getElementById('compare-other-body');
            baseBody.innerHTML = '';
            otherBody.innerHTML = '';

            if (!mismatches.length) {
                appendCompareEmptyRow(baseBody, columns.length + 1, 'No mismatches found');
                appendCompareEmptyRow(otherBody, columns.length + 1, 'No mismatches found');
                return;
            }

            mismatches.forEach((mismatch) => {
                baseBody.appendChild(createCompareRow(columns, mismatch, mismatch.base, 'base'));
                otherBody.appendChild(createCompareRow(columns, mismatch, mismatch.compare, 'compare'));
            });
        }

        function createCompareHeader(headerElement, columns) {
            headerElement.innerHTML = '';
            const row = document.createElement('tr');
            const rowIndexHeader = document.createElement('th');
            rowIndexHeader.textContent = '#';
            row.appendChild(rowIndexHeader);

            columns.forEach((column) => {
                const th = document.createElement('th');
                th.textContent = column;
                th.title = column;
                row.appendChild(th);
            });

            headerElement.appendChild(row);
        }

        function createCompareRow(columns, mismatch, rowData, side) {
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
            const statusElement = document.getElementById('status');
            const errorContainer = document.getElementById('error-container');
            const errorText = document.getElementById('error-text');
            const dataContainer = document.getElementById('data-container');
            const loadingContainer = document.getElementById('loading-container');
            const queryLimitMessage = document.getElementById('query-limit-message');

            // Hide loading container
            loadingContainer.classList.add('hidden');

            // Reset all states
            errorContainer.classList.add('hidden');
            dataContainer.classList.add('hidden');
            statusElement.classList.remove('status-success', 'status-error', 'status-loading');
            queryLimitMessage.classList.add('hidden');

            if (!data.success) {
                if (data.doctor) {
                    renderDoctorPanel(data.doctor);
                }
                errorText.textContent = data.error || 'Unknown error occurred';
                errorContainer.classList.remove('hidden');
                statusElement.textContent = 'Error';
                statusElement.classList.add('status-error');
                return;
            }
            
            // Update summary information
            document.getElementById('total-rows').textContent = formatCount(data.totalRows);
            document.getElementById('showing-rows').textContent = formatCount(data.rowCount);
            document.getElementById('column-count').textContent = data.columns ? data.columns.length : 0;
            if (data.query) {
                currentQuery = data.query;
                const queryInput = document.getElementById('query-input');
                if (queryInput) {
                    queryInput.value = data.query;
                }
            }

            if (data.resultLimited) {
                queryLimitMessage.classList.remove('hidden');
            }

            if (data.schema) {
                currentSchema = data.schema;
                renderSchemaPanel(currentSchema);
            }

            if (data.doctor) {
                renderDoctorPanel(data.doctor);
            }

            currentColumns = data.columns || [];
            currentRows = cloneRows(data.data || []);
            editRows = cloneRows(currentRows);
            renderEditPanel();
            populateVisualizerControls();
            renderVisualizer();
             
            // Create table
            if (data.columns) {
                createTable(data.columns, data.data || []);
                dataContainer.classList.remove('hidden');
                statusElement.textContent = 'Loaded ' + formatCount(data.rowCount) + ' rows';
                if (data.resultLimited) {
                    statusElement.textContent += ' (limited)';
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
            const lines = ['# Parquet Schema', ''];
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
            
            columns.forEach(column => {
                const th = document.createElement('th');
                th.textContent = column;
                th.title = column;
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
                columns.forEach(column => {
                    const td = document.createElement('td');
                    const value = row[column];
                    
                    // Format the value for display
                    if (value === null || value === undefined) {
                        td.textContent = 'NULL';
                        td.className = 'null-value';
                    } else if (typeof value === 'object') {
                        td.textContent = JSON.stringify(value);
                        td.className = 'object-value';
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
            const dataTab = document.getElementById('data-tab');
            const visualizerTab = document.getElementById('visualizer-tab');
            const editTab = document.getElementById('edit-tab');
            const doctorTab = document.getElementById('doctor-tab');
            const schemaTab = document.getElementById('schema-tab');
            const compareTab = document.getElementById('compare-tab');
            const runQueryBtn = document.getElementById('run-query-btn');
            const resetQueryBtn = document.getElementById('reset-query-btn');
            const exportCsvBtn = document.getElementById('export-csv-btn');
            const exportJsonBtn = document.getElementById('export-json-btn');
            const exportSqliteBtn = document.getElementById('export-sqlite-btn');
            const addEditRowBtn = document.getElementById('add-edit-row-btn');
            const resetEditsBtn = document.getElementById('reset-edits-btn');
            const saveEditsBtn = document.getElementById('save-edits-btn');
            const editTableBody = document.getElementById('edit-table-body');
            const doctorSchemaDriftBtn = document.getElementById('doctor-schema-drift-btn');
            const doctorDatasetScanBtn = document.getElementById('doctor-dataset-scan-btn');
            const selectCompareFileBtn = document.getElementById('select-compare-file-btn');
            const runStrictCompareBtn = document.getElementById('run-strict-compare-btn');
            const runCustomCompareBtn = document.getElementById('run-custom-compare-btn');
            const customCompareToggle = document.getElementById('custom-compare-toggle');
            const queryInput = document.getElementById('query-input');
            const schemaSearchInput = document.getElementById('schema-search-input');
            const copySchemaJsonBtn = document.getElementById('copy-schema-json-btn');
            const generateSchemaDocsBtn = document.getElementById('generate-schema-docs-btn');
            const copySchemaDocsBtn = document.getElementById('copy-schema-docs-btn');
            const visualizerChartType = document.getElementById('visualizer-chart-type');
            const visualizerXColumn = document.getElementById('visualizer-x-column');
            const visualizerYColumn = document.getElementById('visualizer-y-column');
            const visualizerAggregation = document.getElementById('visualizer-aggregation');
            const visualizerLimit = document.getElementById('visualizer-limit');

            if (dataTab) {
                dataTab.addEventListener('click', () => {
                    setActiveView('data');
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
            
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    currentQuery = queryInput ? queryInput.value.trim() || DEFAULT_QUERY : currentQuery;
                    setLoading('Refreshing...');
                    vscode.postMessage({ type: 'refresh', query: currentQuery });
                });
            }

            if (runQueryBtn) {
                runQueryBtn.addEventListener('click', () => {
                    currentQuery = queryInput ? queryInput.value.trim() || DEFAULT_QUERY : DEFAULT_QUERY;
                    setLoading('Running query...');
                    vscode.postMessage({ type: 'query', query: currentQuery });
                });
            }

            if (resetQueryBtn) {
                resetQueryBtn.addEventListener('click', () => {
                    currentQuery = DEFAULT_QUERY;
                    if (queryInput) {
                        queryInput.value = currentQuery;
                    }
                    setLoading('Resetting query...');
                    vscode.postMessage({ type: 'query', query: currentQuery });
                });
            }

            if (queryInput) {
                queryInput.addEventListener('keydown', (event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault();
                        currentQuery = queryInput.value.trim() || DEFAULT_QUERY;
                        setLoading('Running query...');
                        vscode.postMessage({ type: 'query', query: currentQuery });
                    }
                });
            }

            if (exportCsvBtn) {
                exportCsvBtn.addEventListener('click', () => {
                    exportCurrentQuery('csv');
                });
            }

            if (exportJsonBtn) {
                exportJsonBtn.addEventListener('click', () => {
                    exportCurrentQuery('json');
                });
            }

            if (exportSqliteBtn) {
                exportSqliteBtn.addEventListener('click', () => {
                    exportCurrentQuery('sqlite');
                });
            }

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

            if (saveEditsBtn) {
                saveEditsBtn.addEventListener('click', () => {
                    saveEditedParquet();
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
                    vscode.postMessage({ type: 'selectDoctorReferenceFile' });
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
                        customMappingEnabled: customCompareToggle ? customCompareToggle.checked : false
                    });
                });
            }

            if (runStrictCompareBtn) {
                runStrictCompareBtn.addEventListener('click', () => {
                    const orderMapping = collectCompareOrderMapping();
                    if (!orderMapping) {
                        setStatus('Select an order column before comparing', 'status-error');
                        return;
                    }

                    setActiveView('compare');
                    setStatus('Running strict compare...', 'status-loading');
                    vscode.postMessage({ type: 'runStrictCompare', orderMapping });
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
                    vscode.postMessage({ type: 'runCustomCompare', mappings, orderMapping });
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
                case 'compareResult':
                    handleCompareResult(message.result);
                    break;
                case 'compareMetadata':
                    handleCompareMetadata(message.result);
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
        .header h1 { 
            color: var(--vscode-titleBar-activeForeground); font-size: 18px; 
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
        .view-tabs {
            display: flex; gap: 4px; margin-bottom: 14px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .tab-btn {
            background: var(--vscode-toolbar-hoverBackground, transparent);
            color: var(--vscode-descriptionForeground);
            border: none; border-bottom: 2px solid transparent;
            padding: 8px 12px; cursor: pointer; border-radius: 3px 3px 0 0;
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
        .data-container { display: flex; flex-direction: column; gap: 15px; }
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
        @media (max-width: 980px) {
            .compare-toolbar { grid-template-columns: 1fr; }
            .compare-actions { justify-content: stretch; grid-template-columns: 1fr; }
            .compare-results { grid-template-columns: 1fr; }
            .compare-column-lists { grid-template-columns: 1fr; }
            .compare-mapping-row { grid-template-columns: 1fr; }
            .compare-order-controls { grid-template-columns: 1fr; }
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
