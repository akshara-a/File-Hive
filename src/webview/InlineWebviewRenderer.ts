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
                ${this.generateQueryContainer()}
                ${this.generateErrorContainer()}
                ${this.generateLoadingContainer()}
                ${this.generateDataContainer()}
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

    private generateQueryContainer(): string {
        return `
        <section class="query-container">
            <div class="query-toolbar">
                <label for="query-input">SQL Query</label>
                <div class="query-actions">
                    <button id="run-query-btn" class="btn">Run Query</button>
                    <button id="reset-query-btn" class="btn btn-secondary">Reset</button>
                </div>
            </div>
            <textarea id="query-input" spellcheck="false">SELECT * FROM parquet_data</textarea>
            <div class="query-meta">
                Table: <code>parquet_data</code>
                <span id="query-limit-message" class="hidden">Showing first 1000 rows.</span>
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

    private getJavaScriptContent(): string {
        return `
        const vscode = acquireVsCodeApi();
        const DEFAULT_QUERY = 'SELECT * FROM parquet_data';
        let currentQuery = DEFAULT_QUERY;

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
            const runQueryBtn = document.getElementById('run-query-btn');
            const resetQueryBtn = document.getElementById('reset-query-btn');
            const queryInput = document.getElementById('query-input');
            
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
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'data':
                    updateView(message.data);
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
        .query-actions { display: flex; align-items: center; gap: 8px; }
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
