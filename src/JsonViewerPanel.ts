import * as vscode from 'vscode';
import { NONCE_STRING_POSSIBLE } from './common/constant';

export class JsonViewerPanel {
    public static readonly viewType = 'fileHive.jsonViewer';
    private static currentPanel: JsonViewerPanel | undefined;
    private readonly disposables: vscode.Disposable[] = [];

    private constructor(
        private readonly panel: vscode.WebviewPanel,
        private readonly initialText: string
    ) {
        this.panel.webview.options = {
            enableScripts: true,
            localResourceRoots: []
        };

        this.panel.webview.html = this.getHtml();

        this.panel.onDidDispose(
            () => this.dispose(),
            null,
            this.disposables
        );
    }

    public static createOrShow(initialText = ''): void {
        const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

        if (JsonViewerPanel.currentPanel) {
            JsonViewerPanel.currentPanel.panel.reveal(column);

            if (initialText.trim()) {
                void JsonViewerPanel.currentPanel.panel.webview.postMessage({
                    type: 'setInput',
                    text: initialText
                });
            }

            return;
        }

        const panel = vscode.window.createWebviewPanel(
            JsonViewerPanel.viewType,
            'JSON Viewer',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        JsonViewerPanel.currentPanel = new JsonViewerPanel(panel, initialText);
    }

    public dispose(): void {
        JsonViewerPanel.currentPanel = undefined;

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            disposable?.dispose();
        }
    }

    private getHtml(): string {
        const nonce = this.getNonce();
        const initialText = JSON.stringify(this.initialText);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>JSON Viewer</title>
    <style>
        :root {
            color-scheme: light dark;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: 13px;
        }

        button, textarea, input {
            font: inherit;
        }

        .json-viewer {
            display: grid;
            grid-template-rows: auto 1fr;
            min-height: 100vh;
        }

        .toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBar-background);
        }

        .title {
            display: flex;
            align-items: baseline;
            gap: 10px;
            min-width: 0;
        }

        h1 {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
        }

        .status {
            color: var(--vscode-descriptionForeground);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .status-valid {
            color: var(--vscode-testing-iconPassed);
        }

        .status-error {
            color: var(--vscode-testing-iconFailed);
        }

        .actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: flex-end;
        }

        .btn {
            min-height: 28px;
            padding: 4px 10px;
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 3px;
            color: var(--vscode-button-foreground);
            background: var(--vscode-button-background);
            cursor: pointer;
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            color: var(--vscode-button-secondaryForeground);
            background: var(--vscode-button-secondaryBackground);
        }

        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .workspace {
            display: grid;
            grid-template-columns: minmax(300px, 38%) minmax(420px, 1fr);
            gap: 0;
            min-height: 0;
        }

        .input-pane, .output-pane {
            min-width: 0;
            min-height: 0;
            display: flex;
            flex-direction: column;
        }

        .input-pane {
            border-right: 1px solid var(--vscode-panel-border);
        }

        .pane-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            min-height: 36px;
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-panelSectionHeader-background);
        }

        .pane-header h2 {
            margin: 0;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .meta {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            white-space: nowrap;
        }

        #json-input {
            flex: 1;
            width: 100%;
            min-height: 260px;
            resize: none;
            border: none;
            outline: none;
            padding: 12px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-editor-font-family);
            line-height: 1.45;
            tab-size: 2;
        }

        .table-wrap {
            flex: 1;
            min-height: 0;
            overflow: auto;
        }

        table {
            width: max-content;
            min-width: 100%;
            border-collapse: collapse;
        }

        th, td {
            border-bottom: 1px solid var(--vscode-panel-border);
            border-right: 1px solid var(--vscode-panel-border);
            padding: 7px 9px;
            max-width: 460px;
            vertical-align: top;
            text-align: left;
        }

        th {
            position: sticky;
            top: 0;
            z-index: 1;
            background: var(--vscode-sideBar-background);
            color: var(--vscode-foreground);
            font-weight: 600;
        }

        td {
            font-family: var(--vscode-editor-font-family);
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        tr:hover td {
            background: var(--vscode-list-hoverBackground);
        }

        .empty-state, .error-state {
            display: grid;
            place-items: center;
            min-height: 100%;
            padding: 24px;
            color: var(--vscode-descriptionForeground);
            text-align: center;
        }

        .error-state {
            color: var(--vscode-inputValidation-errorForeground);
            background: var(--vscode-inputValidation-errorBackground);
        }

        @media (max-width: 820px) {
            .toolbar {
                align-items: stretch;
                flex-direction: column;
            }

            .title {
                justify-content: space-between;
            }

            .actions {
                justify-content: stretch;
            }

            .btn {
                flex: 1;
            }

            .workspace {
                grid-template-columns: 1fr;
                grid-template-rows: minmax(260px, 44vh) 1fr;
            }

            .input-pane {
                border-right: none;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
        }
    </style>
</head>
<body>
    <main class="json-viewer">
        <header class="toolbar">
            <div class="title">
                <h1>JSON Viewer</h1>
                <span id="status" class="status">Empty</span>
            </div>
            <div class="actions">
                <button id="format-btn" class="btn" type="button">Format</button>
                <button id="minify-btn" class="btn btn-secondary" type="button">Minify</button>
                <button id="copy-btn" class="btn btn-secondary" type="button">Copy</button>
                <button id="clear-btn" class="btn btn-secondary" type="button">Clear</button>
            </div>
        </header>
        <section class="workspace">
            <section class="input-pane" aria-label="JSON input">
                <div class="pane-header">
                    <h2>Input</h2>
                    <span id="input-meta" class="meta">0 chars</span>
                </div>
                <textarea id="json-input" spellcheck="false" placeholder='[{"id":1,"name":"Ada","score":98.5}]'></textarea>
            </section>
            <section class="output-pane" aria-label="Parsed JSON table">
                <div class="pane-header">
                    <h2>Table</h2>
                    <span id="table-meta" class="meta">0 rows</span>
                </div>
                <div id="table-output" class="table-wrap">
                    <div class="empty-state">Paste JSON to view it as a table.</div>
                </div>
            </section>
        </section>
    </main>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const initialText = ${initialText};
        const input = document.getElementById('json-input');
        const status = document.getElementById('status');
        const inputMeta = document.getElementById('input-meta');
        const tableMeta = document.getElementById('table-meta');
        const tableOutput = document.getElementById('table-output');
        const formatButton = document.getElementById('format-btn');
        const minifyButton = document.getElementById('minify-btn');
        const copyButton = document.getElementById('copy-btn');
        const clearButton = document.getElementById('clear-btn');
        const state = vscode.getState() || {};

        input.value = typeof state.text === 'string' ? state.text : initialText;

        function setState() {
            vscode.setState({ text: input.value });
        }

        function getType(value) {
            if (value === null) {
                return 'null';
            }

            if (Array.isArray(value)) {
                return 'array';
            }

            return typeof value;
        }

        function getDisplayValue(value) {
            if (typeof value === 'string') {
                return value;
            }

            if (value === undefined) {
                return '';
            }

            if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
                return String(value);
            }

            return JSON.stringify(value, null, 2);
        }

        function escapeHtml(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function updateStatus(text, className) {
            status.textContent = text;
            status.className = 'status ' + className;
        }

        function getRowsAndColumns(value) {
            if (Array.isArray(value)) {
                if (value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
                    const columns = [];
                    value.forEach((row) => {
                        Object.keys(row).forEach((key) => {
                            if (!columns.includes(key)) {
                                columns.push(key);
                            }
                        });
                    });
                    return { columns, rows: value, mode: 'records' };
                }

                return {
                    columns: ['index', 'type', 'value'],
                    rows: value.map((item, index) => ({
                        index,
                        type: getType(item),
                        value: item
                    })),
                    mode: 'values'
                };
            }

            if (value && typeof value === 'object') {
                return {
                    columns: ['key', 'type', 'value'],
                    rows: Object.keys(value).map((key) => ({
                        key,
                        type: getType(value[key]),
                        value: value[key]
                    })),
                    mode: 'object'
                };
            }

            return {
                columns: ['type', 'value'],
                rows: [{
                    type: getType(value),
                    value
                }],
                mode: 'scalar'
            };
        }

        function renderTable(value) {
            const result = getRowsAndColumns(value);
            const rowCount = result.rows.length;
            const columnCount = result.columns.length;
            tableMeta.textContent = rowCount + ' rows, ' + columnCount + ' columns';

            if (columnCount === 0) {
                tableOutput.innerHTML = '<div class="empty-state">No columns found.</div>';
                return;
            }

            const header = result.columns
                .map((column) => '<th scope="col">' + escapeHtml(column) + '</th>')
                .join('');
            const body = result.rows
                .map((row) => {
                    const cells = result.columns
                        .map((column) => '<td>' + escapeHtml(getDisplayValue(row[column])) + '</td>')
                        .join('');
                    return '<tr>' + cells + '</tr>';
                })
                .join('');

            tableOutput.innerHTML = '<table><thead><tr>' + header + '</tr></thead><tbody>' + body + '</tbody></table>';
        }

        function parseAndRender() {
            const text = input.value.trim();
            inputMeta.textContent = input.value.length.toLocaleString() + ' chars';
            setState();

            if (!text) {
                updateStatus('Empty', '');
                tableMeta.textContent = '0 rows';
                tableOutput.innerHTML = '<div class="empty-state">Paste JSON to view it as a table.</div>';
                return;
            }

            try {
                const parsed = JSON.parse(text);
                renderTable(parsed);
                updateStatus('Valid JSON', 'status-valid');
            } catch (error) {
                tableMeta.textContent = '0 rows';
                tableOutput.innerHTML = '<div class="error-state">' + escapeHtml(error.message || String(error)) + '</div>';
                updateStatus('Invalid JSON', 'status-error');
            }
        }

        input.addEventListener('input', parseAndRender);

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                event.preventDefault();
                const start = input.selectionStart;
                const end = input.selectionEnd;
                input.value = input.value.slice(0, start) + '  ' + input.value.slice(end);
                input.selectionStart = input.selectionEnd = start + 2;
                parseAndRender();
            }
        });

        formatButton.addEventListener('click', () => {
            const text = input.value.trim();
            if (!text) {
                return;
            }

            try {
                input.value = JSON.stringify(JSON.parse(text), null, 2);
                parseAndRender();
            } catch {
                parseAndRender();
            }
        });

        minifyButton.addEventListener('click', () => {
            const text = input.value.trim();
            if (!text) {
                return;
            }

            try {
                input.value = JSON.stringify(JSON.parse(text));
                parseAndRender();
            } catch {
                parseAndRender();
            }
        });

        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(input.value);
                updateStatus('Copied', 'status-valid');
                window.setTimeout(parseAndRender, 900);
            } catch {
                updateStatus('Copy failed', 'status-error');
            }
        });

        clearButton.addEventListener('click', () => {
            input.value = '';
            input.focus();
            parseAndRender();
        });

        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message && message.type === 'setInput' && typeof message.text === 'string') {
                input.value = message.text;
                parseAndRender();
            }
        });

        parseAndRender();
    </script>
</body>
</html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = NONCE_STRING_POSSIBLE;
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
