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
                ${this.generateQueryBox()}
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

    private generateQueryBox(): string {
        return `
        <div class="query-box">
            <div class="query-input-group">
                <input type="text" id="search-query" placeholder="Filter data (e.g.: status='active', age>25, name contains 'john')" />
                <button id="search-btn" class="btn btn-primary">
                    <span class="icon">🔍</span> Filter
                </button>
                <button id="clear-search-btn" class="btn btn-secondary">
                    Clear
                </button>
            </div>
            <div class="query-help">
                <span class="help-text">Examples: active, status='active', age>25, name contains 'john', city='New York'</span>
            </div>
            <div id="search-results" class="search-results hidden">
                Found <span id="match-count">0</span> matching rows out of <span id="total-count">0</span>
            </div>
        </div>`;
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
                <div class="summary-item">Total Rows: <span id="total-rows">0</span></div>
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
        let allData = [];
        let allColumns = [];
        let filteredData = [];

        function initialize(data) {
            console.log('Webview initialized with data:', data);
            if (data.success && data.data) {
                allData = data.data;
                allColumns = data.columns || [];
                filteredData = [...allData];
                updateView(data);
                setupSearchHandlers();
            } else {
                updateView(data);
            }
        }

        function setupSearchHandlers() {
            const searchBtn = document.getElementById('search-btn');
            const clearBtn = document.getElementById('clear-search-btn');
            const searchInput = document.getElementById('search-query');

            searchBtn.addEventListener('click', executeSearch);
            clearBtn.addEventListener('click', clearSearch);
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    executeSearch();
                }
            });

            // Real-time search as user types
            searchInput.addEventListener('input', debounce((e) => {
                if (e.target.value.length >= 2 || e.target.value.length === 0) {
                    executeSearch();
                }
            }, 300));
        }

        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        function executeSearch() {
            const query = document.getElementById('search-query').value.trim();
            const resultsInfo = document.getElementById('search-results');
            const matchCount = document.getElementById('match-count');
            const totalCount = document.getElementById('total-count');
            
            if (!query) {
                clearSearch();
                return;
            }

            try {
                filteredData = filterData(query, allData);
                
                // Update table with filtered data
                createTable(allColumns, filteredData);
                
                // Update summary and results info
                updateSummary(filteredData.length);
                matchCount.textContent = filteredData.length.toLocaleString();
                totalCount.textContent = allData.length.toLocaleString();
                resultsInfo.classList.remove('hidden');
                
                // Update status
                const statusElement = document.getElementById('status');
                if (filteredData.length === allData.length) {
                    statusElement.textContent = \`Showing all \${allData.length} rows\`;
                } else {
                    statusElement.textContent = \`Showing \${filteredData.length} of \${allData.length} rows\`;
                }
                statusElement.className = 'status status-success';
                
            } catch (error) {
                const statusElement = document.getElementById('status');
                statusElement.textContent = 'Search error: ' + error.message;
                statusElement.className = 'status status-error';
                console.error('Search error:', error);
            }
        }

        function filterData(query, data) {
            if (!query) return data;
            
            const lowerQuery = query.toLowerCase();
            
            return data.filter(row => {
                // Check for specific column patterns first
                if (tryColumnPatterns(row, query)) {
                    return true;
                }
                
                // Fallback to simple text search across all columns
                for (const column in row) {
                    if (row.hasOwnProperty(column)) {
                        const value = row[column];
                        if (value !== null && value !== undefined) {
                            const stringValue = String(value).toLowerCase();
                            if (stringValue.includes(lowerQuery)) {
                                return true;
                            }
                        }
                    }
                }
                return false;
            });
        }

        function tryColumnPatterns(row, query) {
            // Try different column pattern matches
            const patterns = [
                // column='value' pattern
                { 
                    regex: /^\\s*(\\w+)\\s*=\\s*['"]([^'"]+)['"]\\s*$/i, 
                    handler: (col, val) => String(row[col] || '').toLowerCase() === val.toLowerCase()
                },
                // column=value pattern (without quotes)
                { 
                    regex: /^\\s*(\\w+)\\s*=\\s*(\\S+)\\s*$/i, 
                    handler: (col, val) => String(row[col] || '').toLowerCase() === val.toLowerCase()
                },
                // column>number pattern
                { 
                    regex: /^\\s*(\\w+)\\s*>\\s*(\\d+)\\s*$/i, 
                    handler: (col, val) => {
                        const numVal = Number(row[col]);
                        return !isNaN(numVal) && numVal > Number(val);
                    }
                },
                // column<number pattern
                { 
                    regex: /^\\s*(\\w+)\\s*<\\s*(\\d+)\\s*$/i, 
                    handler: (col, val) => {
                        const numVal = Number(row[col]);
                        return !isNaN(numVal) && numVal < Number(val);
                    }
                },
                // column>=number pattern
                { 
                    regex: /^\\s*(\\w+)\\s*>=\\s*(\\d+)\\s*$/i, 
                    handler: (col, val) => {
                        const numVal = Number(row[col]);
                        return !isNaN(numVal) && numVal >= Number(val);
                    }
                },
                // column<=number pattern
                { 
                    regex: /^\\s*(\\w+)\\s*<=\\s*(\\d+)\\s*$/i, 
                    handler: (col, val) => {
                        const numVal = Number(row[col]);
                        return !isNaN(numVal) && numVal <= Number(val);
                    }
                },
                // column contains 'value' pattern
                { 
                    regex: /^\\s*(\\w+)\\s*contains\\s*['"]([^'"]+)['"]\\s*$/i, 
                    handler: (col, val) => String(row[col] || '').toLowerCase().includes(val.toLowerCase())
                },
                // column contains value pattern (without quotes)
                { 
                    regex: /^\\s*(\\w+)\\s*contains\\s*(\\S+)\\s*$/i, 
                    handler: (col, val) => String(row[col] || '').toLowerCase().includes(val.toLowerCase())
                }
            ];
            
            for (const pattern of patterns) {
                const match = query.match(pattern.regex);
                if (match) {
                    const columnName = match[1];
                    const value = match[2];
                    
                    // Check if column exists in row
                    if (row.hasOwnProperty(columnName)) {
                        return pattern.handler(columnName, value);
                    }
                }
            }
            
            return false;
        }

        function clearSearch() {
            const searchInput = document.getElementById('search-query');
            const resultsInfo = document.getElementById('search-results');
            
            searchInput.value = '';
            filteredData = [...allData];
            
            createTable(allColumns, filteredData);
            updateSummary(filteredData.length);
            resultsInfo.classList.add('hidden');
            
            const statusElement = document.getElementById('status');
            statusElement.textContent = \`Showing all \${allData.length} rows\`;
            statusElement.className = 'status status-success';
        }

        function updateView(data) {
            const statusElement = document.getElementById('status');
            const errorContainer = document.getElementById('error-container');
            const errorText = document.getElementById('error-text');
            const dataContainer = document.getElementById('data-container');
            const loadingContainer = document.getElementById('loading-container');

            // Hide loading container
            loadingContainer.classList.add('hidden');

            // Reset all states
            errorContainer.classList.add('hidden');
            dataContainer.classList.add('hidden');
            statusElement.classList.remove('status-success', 'status-error', 'status-loading');

            if (!data.success) {
                errorText.textContent = data.error || 'Unknown error occurred';
                errorContainer.classList.remove('hidden');
                statusElement.textContent = 'Error';
                statusElement.classList.add('status-error');
                return;
            }
            
            // Update summary information
            updateSummary(filteredData.length);
            document.getElementById('column-count').textContent = allColumns.length;
            document.getElementById('total-count').textContent = allData.length.toLocaleString();
            
            // Create table
            if (filteredData.length > 0) {
                createTable(allColumns, filteredData);
                dataContainer.classList.remove('hidden');
                statusElement.textContent = \`Showing \${filteredData.length} rows\`;
                statusElement.classList.add('status-success');
            } else {
                const tableBody = document.getElementById('table-body');
                const colCount = allColumns.length || 1;
                tableBody.innerHTML = '<tr><td colspan="' + colCount + '" style="text-align: center; padding: 20px;">No data found</td></tr>';
                dataContainer.classList.remove('hidden');
                statusElement.textContent = 'No data available';
                statusElement.classList.add('status-success');
            }
        }

        function updateSummary(showingRows) {
            document.getElementById('total-rows').textContent = allData.length.toLocaleString();
            document.getElementById('showing-rows').textContent = showingRows.toLocaleString();
        }

        function createTable(columns, data) {
            const tableHeader = document.getElementById('table-header');
            const tableBody = document.getElementById('table-body');
            
            // Clear existing content
            tableHeader.innerHTML = '';
            tableBody.innerHTML = '';
            
            if (!columns || columns.length === 0) {
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
            
            // Create data rows
            data.forEach((row) => {
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
            
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    const statusElement = document.getElementById('status');
                    const loadingContainer = document.getElementById('loading-container');
                    const dataContainer = document.getElementById('data-container');
                    const errorContainer = document.getElementById('error-container');
                    
                    // Show loading state
                    statusElement.textContent = 'Refreshing...';
                    statusElement.className = 'status status-loading';
                    loadingContainer.classList.remove('hidden');
                    dataContainer.classList.add('hidden');
                    errorContainer.classList.add('hidden');
                    
                    vscode.postMessage({ type: 'refresh' });
                });
            } else {
                console.log('Refresh button not found!');
            }
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'data':
                    if (message.data.success && message.data.data) {
                        allData = message.data.data;
                        allColumns = message.data.columns || [];
                        filteredData = [...allData];
                        updateView(message.data);
                    } else {
                        updateView(message.data);
                    }
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
            font-size: 12px;
        }
        .btn:hover { background-color: var(--vscode-button-hoverBackground); }
        .btn-primary {
            background-color: var(--vscode-button-background);
        }
        .btn-secondary {
            background-color: var(--vscode-secondaryButton-background, #3c3c3c);
        }
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
        
        /* Query Box Styles */
        .query-box {
            background-color: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin-bottom: 20px;
            padding: 15px;
        }
        .query-input-group {
            display: flex;
            gap: 10px;
            margin-bottom: 8px;
        }
        #search-query {
            flex: 1;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            padding: 8px 12px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
        }
        #search-query:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        .query-help {
            margin-bottom: 8px;
        }
        .help-text {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        .search-results {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            padding: 5px 0;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
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
            border-radius: 3px; max-height: 60vh;
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