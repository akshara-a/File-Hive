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
                ${this.generateSchemaContainer()}
                ${this.generateCompareContainer()}
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
            <button id="schema-tab" class="tab-btn" role="tab" aria-selected="false">Schema</button>
            <button id="compare-tab" class="tab-btn" role="tab" aria-selected="false">Compare</button>
        </div>`;
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
                    <p>Compares rows by row order. Column names and order must match before comparison starts.</p>
                </div>
                <button id="select-compare-file-btn" class="btn">Choose Compare File</button>
            </div>
            <div id="compare-error" class="compare-error hidden"></div>
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

        function initialize(data) {
            console.log('Webview initialized with data:', data);
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
            const schemaTab = document.getElementById('schema-tab');
            const compareTab = document.getElementById('compare-tab');
            const dataView = document.getElementById('data-view');
            const schemaContainer = document.getElementById('schema-container');
            const compareContainer = document.getElementById('compare-container');

            const showSchema = viewName === 'schema';
            const showCompare = viewName === 'compare';
            dataTab.classList.toggle('active', !showSchema && !showCompare);
            schemaTab.classList.toggle('active', showSchema);
            compareTab.classList.toggle('active', showCompare);
            dataTab.setAttribute('aria-selected', String(!showSchema && !showCompare));
            schemaTab.setAttribute('aria-selected', String(showSchema));
            compareTab.setAttribute('aria-selected', String(showCompare));
            dataView.classList.toggle('hidden', showSchema || showCompare);
            schemaContainer.classList.toggle('hidden', !showSchema);
            compareContainer.classList.toggle('hidden', !showCompare);
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

        function handleCompareResult(result) {
            currentCompareResult = result;
            renderCompareResult(result);

            if (!result || !result.success) {
                if (result && result.error === 'Compare cancelled.') {
                    setStatus('Compare cancelled', 'status-success');
                } else {
                    setStatus(result && result.error ? result.error : 'Compare failed', 'status-error');
                }
                return;
            }

            setActiveView('compare');
            setStatus(
                'Found ' + formatCount(result.mismatchCount) + ' mismatched rows',
                result.mismatchCount ? 'status-error' : 'status-success'
            );
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
            console.log('Cleared existing table content');
            
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
            const schemaTab = document.getElementById('schema-tab');
            const compareTab = document.getElementById('compare-tab');
            const runQueryBtn = document.getElementById('run-query-btn');
            const resetQueryBtn = document.getElementById('reset-query-btn');
            const exportCsvBtn = document.getElementById('export-csv-btn');
            const exportJsonBtn = document.getElementById('export-json-btn');
            const exportSqliteBtn = document.getElementById('export-sqlite-btn');
            const selectCompareFileBtn = document.getElementById('select-compare-file-btn');
            const queryInput = document.getElementById('query-input');
            const schemaSearchInput = document.getElementById('schema-search-input');
            const copySchemaJsonBtn = document.getElementById('copy-schema-json-btn');
            const generateSchemaDocsBtn = document.getElementById('generate-schema-docs-btn');
            const copySchemaDocsBtn = document.getElementById('copy-schema-docs-btn');

            if (dataTab) {
                dataTab.addEventListener('click', () => {
                    setActiveView('data');
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
            } else {
                console.log('Refresh button not found!');
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

            if (selectCompareFileBtn) {
                selectCompareFileBtn.addEventListener('click', () => {
                    setActiveView('compare');
                    setStatus('Choosing compare file...', 'status-loading');
                    vscode.postMessage({ type: 'selectCompareFile' });
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
                case 'compareResult':
                    handleCompareResult(message.result);
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        });

        console.log('JavaScript loaded successfully');
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
            background-color: var(--vscode-button-background); 
            color: var(--vscode-button-foreground); border: none; 
            padding: 8px 12px; border-radius: 3px; cursor: pointer; 
            display: flex; align-items: center; gap: 5px; 
        }
        .btn:hover { background-color: var(--vscode-button-hoverBackground); }
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover { background-color: var(--vscode-button-secondaryHoverBackground); }
        .status { font-size: 12px; padding: 4px 8px; border-radius: 3px; }
        .view-tabs {
            display: flex; gap: 4px; margin-bottom: 14px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .tab-btn {
            background: transparent; color: var(--vscode-descriptionForeground);
            border: none; border-bottom: 2px solid transparent;
            padding: 8px 12px; cursor: pointer;
        }
        .tab-btn.active {
            color: var(--vscode-foreground);
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
        @media (max-width: 820px) {
            .schema-layout { grid-template-columns: 1fr; }
            .schema-toolbar { align-items: stretch; }
            .schema-actions { width: 100%; }
        }
        .compare-container { display: flex; flex-direction: column; gap: 14px; }
        .compare-toolbar {
            display: flex; justify-content: space-between; align-items: center;
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
            .compare-results { grid-template-columns: 1fr; }
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
