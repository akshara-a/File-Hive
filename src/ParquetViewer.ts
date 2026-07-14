import * as vscode from 'vscode';
import * as path from 'path';
import { IParquetReader } from './interfaces/IParquetReader';
import { IWebviewRenderer } from './interfaces/IWebviewRenderer';

export class ParquetViewer implements vscode.CustomReadonlyEditorProvider {
    public static readonly viewType = 'parquetViewer.parquetViewer';

    /**
     * Constructs a ParquetViewer object.
     * @param {IParquetReader} parquetReader - The parquet reader to use.
     * @param {IWebviewRenderer} webviewRenderer - The webview renderer to use.
     */
    constructor(
        private readonly parquetReader: IParquetReader,
        private readonly webviewRenderer: IWebviewRenderer
    ) {}

    /**
     * Registers a custom editor provider for the parquet viewer.
     * 
     * This function registers a custom editor provider which can be used to
     * render parquet files in VS Code.
     * 
     * @param {IParquetReader} parquetReader - The parquet reader to use.
     * @param {IWebviewRenderer} webviewRenderer - The webview renderer to use.
     * @returns {vscode.Disposable} The disposable custom editor provider.
     */
    public static register(
        parquetReader: IParquetReader,
        webviewRenderer: IWebviewRenderer
    ): vscode.Disposable {
        const provider = new ParquetViewer(parquetReader, webviewRenderer);
        return vscode.window.registerCustomEditorProvider(
            ParquetViewer.viewType,
            provider
        );
    }

    /**
     * Opens a custom document for the given URI.
     * 
     * This function opens a custom document for the given URI. The custom
     * document is a simple object with a URI and a dispose method.
     * The dispose method does nothing and is only included for compatibility
     * with the VS Code CustomDocument API.
     * 
     * @param uri The URI of the custom document to open.
     * @returns {Promise<vscode.CustomDocument>} A promise that resolves to a custom document.
     */
    async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
        return { uri, dispose: () => {} };
    }

    /**
     * Resolves a custom editor for the given document.
     * 
     * This function is called by VS Code when a custom document is opened.
     * It sets up the webview for the custom document and initializes the webview content.
     * 
     * @param document The custom document to resolve.
     * @param webviewPanel The webview panel to use.
     * @param _token The cancellation token for the operation.
     * @returns A promise that resolves when the custom editor is resolved.
     */
    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.setupWebview(webviewPanel, document);
        await this.initializeWebviewContent(webviewPanel, document.uri);
    }

    /**
     * Sets up the webview for the given custom document.
     *
     * This function sets up the webview panel for the given custom document.
     * It enables scripts in the webview and sets up the message handlers for
     * the webview.
     * 
     * @param webviewPanel The webview panel to set up.
     * @param document The custom document to set up the webview for.
     */
    private setupWebview(webviewPanel: vscode.WebviewPanel, document: vscode.CustomDocument): void {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [] // No local resources needed with inline renderer
        };

        this.setupMessageHandlers(webviewPanel, document);
    }

    /**
     * Sets up the message handlers for the webview panel.
     * 
     * This function sets up the message handlers for the webview panel.
     * It listens for messages from the webview and handles them accordingly.
     * 
     * @param webviewPanel The webview panel to set up the message handlers for.
     * @param document The custom document to set up the message handlers for.
     */
    private setupMessageHandlers(webviewPanel: vscode.WebviewPanel, document: vscode.CustomDocument): void {
        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'refresh':
                    await this.refreshWebviewContent(webviewPanel, document.uri, message.query);
                    break;
                case 'query':
                    await this.queryWebviewContent(webviewPanel, document.uri, message.query);
                    break;
                case 'export':
                    await this.exportWebviewContent(webviewPanel, document.uri, message.format, message.query);
                    break;
            }
        });
    }

    /**
     * Initializes the webview content for the given webview panel and uri.
     * 
     * This function initializes the webview content for the given webview panel and uri.
     * It calls updateWebviewContent to update the webview content.
     * 
     * @param webviewPanel The webview panel to initialize the content for.
     * @param uri The uri of the parquet file to initialize the content with.
     * @returns A promise that resolves when the webview content is initialized.
     */
    private async initializeWebviewContent(webviewPanel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        await this.updateWebviewContent(webviewPanel, uri);
    }

    /**
     * Refreshes the webview content for the given webview panel and uri.
     * 
     * This function refreshes the webview content for the given webview panel and uri.
     * It calls updateWebviewContent to update the webview content.
     * 
     * @param webviewPanel The webview panel to refresh the content for.
     * @param uri The uri of the parquet file to refresh the content with.
     * @returns A promise that resolves when the webview content is refreshed.
     */
    private async refreshWebviewContent(webviewPanel: vscode.WebviewPanel, uri: vscode.Uri, query?: unknown): Promise<void> {
        const sqlQuery = typeof query === 'string' ? query : undefined;
        await this.updateWebviewContent(webviewPanel, uri, sqlQuery);
    }

    /**
     * Runs a SQL-like query against the parquet data and updates the existing webview.
     *
     * @param webviewPanel The webview panel to update.
     * @param uri The parquet file URI to query.
     * @param query The SQL query received from the webview.
     */
    private async queryWebviewContent(webviewPanel: vscode.WebviewPanel, uri: vscode.Uri, query?: unknown): Promise<void> {
        const sqlQuery = typeof query === 'string' ? query : undefined;
        const parquetData = await this.parquetReader.readParquetFile(uri, sqlQuery);
        await webviewPanel.webview.postMessage({ type: 'data', data: parquetData });
    }

    /**
     * Exports the current parquet query result to a user-selected file.
     *
     * @param webviewPanel The webview panel requesting the export.
     * @param uri The parquet file URI to export from.
     * @param format The requested export format.
     * @param query The SQL query received from the webview.
     */
    private async exportWebviewContent(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        format?: unknown,
        query?: unknown
    ): Promise<void> {
        if (format !== 'csv' && format !== 'json' && format !== 'sqlite') {
            await webviewPanel.webview.postMessage({
                type: 'exportResult',
                result: { success: false, error: 'Unsupported export format.' }
            });
            return;
        }

        const defaultUri = this.getDefaultExportUri(uri, format);
        const outputUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: this.getExportFilters(format),
            saveLabel: `Export ${format.toUpperCase()}`
        });

        if (!outputUri) {
            await webviewPanel.webview.postMessage({
                type: 'exportResult',
                result: { success: false, error: 'Export cancelled.' }
            });
            return;
        }

        const sqlQuery = typeof query === 'string' ? query : undefined;
        const result = await this.parquetReader.exportParquetFile(uri, format, outputUri, sqlQuery);

        if (result.success) {
            vscode.window.showInformationMessage(
                `Exported ${result.rowsExported ?? 0} rows to ${outputUri.fsPath}`
            );
        } else {
            vscode.window.showErrorMessage(result.error || 'Export failed.');
        }

        await webviewPanel.webview.postMessage({ type: 'exportResult', result });
    }

    private getDefaultExportUri(uri: vscode.Uri, format: 'csv' | 'json' | 'sqlite'): vscode.Uri {
        const extension = format === 'sqlite' ? 'sqlite' : format;
        const parsedPath = path.parse(uri.fsPath);
        return vscode.Uri.file(path.join(parsedPath.dir, `${parsedPath.name}.${extension}`));
    }

    private getExportFilters(format: 'csv' | 'json' | 'sqlite'): Record<string, string[]> {
        if (format === 'csv') {
            return { 'CSV Files': ['csv'] };
        }

        if (format === 'json') {
            return { 'JSON Files': ['json'] };
        }

        return { 'SQLite Databases': ['sqlite', 'db'] };
    }

        /**
         * Updates the webview content for the given webview panel and uri.
         * 
         * This function updates the webview content for the given webview panel and uri.
         * It reads the parquet file at the given uri using the parquet reader and
         * generates the webview content using the webview renderer.
         * 
         * @param webviewPanel The webview panel to update the content for.
         * @param uri The uri of the parquet file to update the content with.
         * @returns A promise that resolves when the webview content is updated.
         */
    private async updateWebviewContent(webviewPanel: vscode.WebviewPanel, uri: vscode.Uri, query?: string): Promise<void> {
        const parquetData = await this.parquetReader.readParquetFile(uri, query);
        webviewPanel.webview.html = this.webviewRenderer.getWebviewContent(webviewPanel.webview, parquetData);
    }
}
