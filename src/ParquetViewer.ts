import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IParquetReader, ParquetCompareMapping, ParquetCompareOrderMapping, ParquetJoinOptions, ParquetWriteOptions } from './interfaces/IParquetReader';
import { IWebviewRenderer } from './interfaces/IWebviewRenderer';

export class ParquetViewer implements vscode.CustomReadonlyEditorProvider {
    public static readonly viewType = 'parquetViewer.parquetViewer';
    private readonly compareFiles = new WeakMap<vscode.WebviewPanel, vscode.Uri>();
    private readonly joinFiles = new WeakMap<vscode.WebviewPanel, vscode.Uri>();

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
        return {
            uri,
            dispose: () => {
                void this.parquetReader.releaseFileSession(uri).catch(() => undefined);
            }
        };
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
        webviewPanel.webview.html = this.getLoadingWebviewContent();
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
                case 'saveEditedParquet':
                    await this.saveEditedParquet(webviewPanel, document.uri, message.columns, message.rows);
                    break;
                case 'createParquet':
                    await this.createParquet(webviewPanel, document.uri, message.options);
                    break;
                case 'selectCompareFile':
                    await this.selectCompareFile(webviewPanel, document.uri, message.customMappingEnabled);
                    break;
                case 'selectJoinFile':
                    await this.selectJoinFile(webviewPanel, document.uri);
                    break;
                case 'runJoin':
                    await this.runJoin(webviewPanel, document.uri, message.options);
                    break;
                case 'exportJoinPreview':
                    await this.exportJoinPreview(webviewPanel, document.uri, message.columns, message.rows);
                    break;
                case 'runStrictCompare':
                    await this.runCompare(webviewPanel, document.uri, undefined, message.orderMapping);
                    break;
                case 'runCustomCompare':
                    await this.runCompare(webviewPanel, document.uri, message.mappings, message.orderMapping);
                    break;
                case 'runSmartDiff':
                    await this.runSmartDiff(webviewPanel, document.uri);
                    break;
                case 'selectDoctorReferenceFile':
                    await this.selectDoctorReferenceFile(webviewPanel, document.uri);
                    break;
                case 'selectDoctorDatasetFolder':
                    await this.selectDoctorDatasetFolder(webviewPanel, document.uri);
                    break;
                case 'runDoctor':
                    await this.runDoctorChecks(webviewPanel, document.uri);
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

    private async saveEditedParquet(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        columns?: unknown,
        rows?: unknown
    ): Promise<void> {
        const parsedColumns = this.parseEditColumns(columns);
        const parsedRows = this.parseEditRows(rows);

        if (parsedColumns.length === 0 || !parsedRows) {
            await webviewPanel.webview.postMessage({
                type: 'editSaveResult',
                result: { success: false, error: 'No editable rows are available to save.' }
            });
            return;
        }

        const defaultUri = this.getDefaultEditedParquetUri(uri);
        const outputUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'Parquet Files': ['parquet'] },
            saveLabel: 'Save New Parquet'
        });

        if (!outputUri) {
            await webviewPanel.webview.postMessage({
                type: 'editSaveResult',
                result: { success: false, error: 'Save cancelled.' }
            });
            return;
        }

        const result = await this.parquetReader.saveEditedParquetFile(uri, outputUri, parsedColumns, parsedRows);

        if (result.success) {
            const openAction = 'Open New Parquet';
            const message = `Saved edited data as a new Parquet file: ${outputUri.fsPath}. To view the changes, open the new Parquet file.`;
            const action = await vscode.window.showInformationMessage(message, openAction);

            if (action === openAction) {
                await vscode.commands.executeCommand('vscode.openWith', outputUri, ParquetViewer.viewType);
            }
        } else {
            vscode.window.showErrorMessage(result.error || 'Could not save edited Parquet file.');
        }

        await webviewPanel.webview.postMessage({ type: 'editSaveResult', result });
    }

    private getDefaultEditedParquetUri(uri: vscode.Uri): vscode.Uri {
        const parsedPath = path.parse(uri.fsPath);
        return vscode.Uri.file(path.join(parsedPath.dir, `${parsedPath.name}_edited.parquet`));
    }

    private async createParquet(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        options?: unknown
    ): Promise<void> {
        const writeOptions = this.parseWriteOptions(options);

        if (!writeOptions) {
            await webviewPanel.webview.postMessage({
                type: 'writeResult',
                result: { success: false, error: 'Provide rows, columns, compression, and a valid row group size.' }
            });
            return;
        }

        const defaultUri = this.getDefaultCreatedParquetUri(uri);
        const outputUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'Parquet Files': ['parquet'] },
            saveLabel: 'Create Parquet'
        });

        if (!outputUri) {
            await webviewPanel.webview.postMessage({
                type: 'writeResult',
                result: { success: false, error: 'Create cancelled.' }
            });
            return;
        }

        if (path.resolve(outputUri.fsPath) === path.resolve(uri.fsPath)) {
            await webviewPanel.webview.postMessage({
                type: 'writeResult',
                result: { success: false, error: 'Choose a new file path instead of overwriting the currently open file.' }
            });
            return;
        }

        const result = await this.parquetReader.createParquetFile(uri, outputUri, writeOptions);

        if (result.success) {
            const openAction = 'Open Created Parquet';
            const message = `Created Parquet file: ${outputUri.fsPath}`;
            const action = await vscode.window.showInformationMessage(message, openAction);

            if (action === openAction) {
                await vscode.commands.executeCommand('vscode.openWith', outputUri, ParquetViewer.viewType);
            }
        } else {
            vscode.window.showErrorMessage(result.error || 'Could not create Parquet file.');
        }

        await webviewPanel.webview.postMessage({ type: 'writeResult', result });
    }

    private getDefaultCreatedParquetUri(uri: vscode.Uri): vscode.Uri {
        const parsedPath = path.parse(uri.fsPath);
        return vscode.Uri.file(path.join(parsedPath.dir, `${parsedPath.name}_created.parquet`));
    }

    private parseWriteOptions(options?: unknown): ParquetWriteOptions | undefined {
        if (typeof options !== 'object' || options === null ||
            !('columns' in options) || !('rows' in options) || !('compression' in options)) {
            return undefined;
        }

        const rawColumns = (options as { columns?: unknown }).columns;
        const rawRows = (options as { rows?: unknown }).rows;
        const rawCompression = String((options as { compression?: unknown }).compression || '').toLowerCase();
        const rawRowGroupSize = (options as { rowGroupSize?: unknown }).rowGroupSize;
        const allowedCompressions = ['uncompressed', 'snappy', 'gzip', 'brotli', 'zstd'];

        if (!Array.isArray(rawColumns) || !Array.isArray(rawRows) || !allowedCompressions.includes(rawCompression)) {
            return undefined;
        }

        const columns = rawColumns
            .filter((column): column is { name: unknown; type: unknown } => {
                return typeof column === 'object' && column !== null && 'name' in column && 'type' in column;
            })
            .map((column) => ({
                name: String(column.name).trim(),
                type: String(column.type).trim().toUpperCase()
            }))
            .filter((column) => column.name.length > 0 && column.type.length > 0);

        const rows = rawRows.filter((row): row is Record<string, any> => {
            return typeof row === 'object' && row !== null && !Array.isArray(row);
        });

        const rowGroupSize = Number(rawRowGroupSize);
        const normalizedRowGroupSize = Number.isFinite(rowGroupSize)
            ? Math.min(10_000_000, Math.max(1, Math.trunc(rowGroupSize)))
            : undefined;

        if (!columns.length || !rows.length) {
            return undefined;
        }

        return {
            columns,
            rows,
            compression: rawCompression as ParquetWriteOptions['compression'],
            rowGroupSize: normalizedRowGroupSize
        };
    }

    private parseEditColumns(columns?: unknown): string[] {
        if (!Array.isArray(columns)) {
            return [];
        }

        return columns
            .map((column) => String(column))
            .filter((column) => column.length > 0);
    }

    private parseEditRows(rows?: unknown): Record<string, any>[] | undefined {
        if (!Array.isArray(rows)) {
            return undefined;
        }

        return rows.filter((row): row is Record<string, any> => {
            return typeof row === 'object' && row !== null && !Array.isArray(row);
        });
    }

    private async selectCompareFile(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        customMappingEnabled?: unknown
    ): Promise<void> {
        const selectedFiles = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'Parquet Files': ['parquet'] },
            openLabel: 'Compare With'
        });

        if (!selectedFiles || selectedFiles.length === 0) {
            this.compareFiles.delete(webviewPanel);
            await webviewPanel.webview.postMessage({
                type: 'compareResult',
                result: { success: false, error: 'Compare cancelled.' }
            });
            return;
        }

        const compareUri = selectedFiles[0];
        this.compareFiles.set(webviewPanel, compareUri);

        const metadataResult = await this.parquetReader.getParquetCompareMetadata(uri, compareUri);
        await webviewPanel.webview.postMessage({ type: 'compareMetadata', result: metadataResult });

        if (!metadataResult.success) {
            vscode.window.showErrorMessage(metadataResult.error || 'Could not read compare columns.');
            return;
        }
    }

    private async selectJoinFile(webviewPanel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        const selectedFiles = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Data Files': ['parquet', 'csv'],
                'Parquet Files': ['parquet'],
                'CSV Files': ['csv']
            },
            openLabel: 'Join With'
        });

        if (!selectedFiles || selectedFiles.length === 0) {
            this.joinFiles.delete(webviewPanel);
            await webviewPanel.webview.postMessage({
                type: 'joinMetadata',
                result: { success: false, error: 'Join cancelled.' }
            });
            return;
        }

        const joinUri = selectedFiles[0];
        this.joinFiles.set(webviewPanel, joinUri);

        const metadataResult = await this.parquetReader.getJoinMetadata(uri, joinUri);
        await webviewPanel.webview.postMessage({ type: 'joinMetadata', result: metadataResult });

        if (!metadataResult.success) {
            vscode.window.showErrorMessage(metadataResult.error || 'Could not read join columns.');
        }
    }

    private async runJoin(webviewPanel: vscode.WebviewPanel, uri: vscode.Uri, options?: unknown): Promise<void> {
        const joinUri = this.joinFiles.get(webviewPanel);

        if (!joinUri) {
            await webviewPanel.webview.postMessage({
                type: 'joinResult',
                result: { success: false, error: 'Choose a join file first.' }
            });
            return;
        }

        const joinOptions = this.parseJoinOptions(options);
        if (!joinOptions) {
            await webviewPanel.webview.postMessage({
                type: 'joinResult',
                result: { success: false, error: 'Choose join keys and a valid join type.' }
            });
            return;
        }

        const result = await this.parquetReader.joinParquetFile(uri, joinUri, joinOptions);

        if (!result.success) {
            vscode.window.showErrorMessage(result.error || 'Join failed.');
        }

        await webviewPanel.webview.postMessage({ type: 'joinResult', result });
    }

    private parseJoinOptions(options?: unknown): ParquetJoinOptions | undefined {
        if (typeof options !== 'object' || options === null ||
            !('baseColumn' in options) || !('joinColumn' in options) || !('joinType' in options)) {
            return undefined;
        }

        const joinType = String(options.joinType);
        if (joinType !== 'inner' && joinType !== 'left' && joinType !== 'right' && joinType !== 'full') {
            return undefined;
        }

        const limit = 'limit' in options ? Number(options.limit) : 100;
        return {
            baseColumn: String(options.baseColumn),
            joinColumn: String(options.joinColumn),
            joinType,
            limit: Number.isFinite(limit) ? Math.min(1000, Math.max(1, Math.trunc(limit))) : 100
        };
    }

    private async exportJoinPreview(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        columns?: unknown,
        rows?: unknown
    ): Promise<void> {
        const parsedColumns = this.parseEditColumns(columns);
        const parsedRows = this.parseEditRows(rows);

        if (parsedColumns.length === 0 || !parsedRows) {
            await webviewPanel.webview.postMessage({
                type: 'joinPreviewExportResult',
                result: { success: false, error: 'No join preview rows are available to export.' }
            });
            return;
        }

        const parsedPath = path.parse(uri.fsPath);
        const outputUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(parsedPath.dir, `${parsedPath.name}_join_preview.csv`)),
            filters: { 'CSV Files': ['csv'] },
            saveLabel: 'Export Join Preview'
        });

        if (!outputUri) {
            await webviewPanel.webview.postMessage({
                type: 'joinPreviewExportResult',
                result: { success: false, error: 'Export cancelled.' }
            });
            return;
        }

        try {
            const csv = this.toCsv(parsedColumns, parsedRows);
            await fs.promises.writeFile(outputUri.fsPath, csv, 'utf8');
            vscode.window.showInformationMessage(`Exported join preview to ${outputUri.fsPath}`);
            await webviewPanel.webview.postMessage({
                type: 'joinPreviewExportResult',
                result: { success: true, outputPath: outputUri.fsPath, rowsExported: parsedRows.length }
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Could not export join preview: ${message}`);
            await webviewPanel.webview.postMessage({
                type: 'joinPreviewExportResult',
                result: { success: false, error: message }
            });
        }
    }

    private toCsv(columns: string[], rows: Record<string, any>[]): string {
        const lines = [columns.map((column) => this.escapeCsvValue(column)).join(',')];
        rows.forEach((row) => {
            lines.push(columns.map((column) => this.escapeCsvValue(row[column])).join(','));
        });

        return `${lines.join('\n')}\n`;
    }

    private escapeCsvValue(value: unknown): string {
        if (value === null || value === undefined) {
            return '';
        }

        const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }

    private async runCompare(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        mappings?: unknown,
        orderMapping?: unknown
    ): Promise<void> {
        const compareUri = this.compareFiles.get(webviewPanel);

        if (!compareUri) {
            await webviewPanel.webview.postMessage({
                type: 'compareResult',
                result: { success: false, error: 'Choose a compare file first.' }
            });
            return;
        }

        const compareMappings = this.parseCompareMappings(mappings);
        const compareOrderMapping = this.parseCompareOrderMapping(orderMapping);

        if (!compareOrderMapping) {
            await webviewPanel.webview.postMessage({
                type: 'compareResult',
                result: { success: false, error: 'Select an order column before comparing.' }
            });
            return;
        }

        const result = await this.parquetReader.compareParquetFile(
            uri,
            compareUri,
            compareMappings,
            compareOrderMapping
        );

        if (!result.success) {
            vscode.window.showErrorMessage(result.error || 'Parquet compare failed.');
        }

        await webviewPanel.webview.postMessage({ type: 'compareResult', result });
    }

    private async runSmartDiff(webviewPanel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        const compareUri = this.compareFiles.get(webviewPanel);

        if (!compareUri) {
            await webviewPanel.webview.postMessage({
                type: 'compareResult',
                result: { success: false, error: 'Choose a compare file first.' }
            });
            return;
        }

        const result = await this.parquetReader.smartDiffParquetFile(uri, compareUri);

        if (!result.success) {
            vscode.window.showErrorMessage(result.error || 'Smart Parquet Diff failed.');
        }

        await webviewPanel.webview.postMessage({ type: 'compareResult', result });
    }

    private parseCompareMappings(mappings?: unknown): ParquetCompareMapping[] | undefined {
        if (!Array.isArray(mappings)) {
            return undefined;
        }

        const parsedMappings = mappings
            .filter((mapping): mapping is { baseColumn: unknown; compareColumn: unknown } => {
                return typeof mapping === 'object' && mapping !== null &&
                    'baseColumn' in mapping && 'compareColumn' in mapping;
            })
            .map((mapping) => ({
                baseColumn: String(mapping.baseColumn),
                compareColumn: String(mapping.compareColumn)
            }))
            .filter((mapping) => mapping.baseColumn && mapping.compareColumn);

        return parsedMappings.length > 0 ? parsedMappings : undefined;
    }

    private parseCompareOrderMapping(orderMapping?: unknown): ParquetCompareOrderMapping | undefined {
        if (typeof orderMapping !== 'object' || orderMapping === null ||
            !('baseColumn' in orderMapping) || !('compareColumn' in orderMapping)) {
            return undefined;
        }

        const parsedOrderMapping = {
            baseColumn: String(orderMapping.baseColumn),
            compareColumn: String(orderMapping.compareColumn)
        };

        return parsedOrderMapping.baseColumn && parsedOrderMapping.compareColumn
            ? parsedOrderMapping
            : undefined;
    }

    private async selectDoctorReferenceFile(webviewPanel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        const selectedFiles = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'Parquet Files': ['parquet'] },
            openLabel: 'Use as Reference'
        });

        if (!selectedFiles || selectedFiles.length === 0) {
            await webviewPanel.webview.postMessage({
                type: 'doctorSchemaDriftResult',
                result: { success: false, error: 'Schema drift check cancelled.' }
            });
            return;
        }

        const result = await this.parquetReader.detectSchemaDrift(uri, selectedFiles[0]);

        if (!result.success) {
            vscode.window.showErrorMessage(result.error || 'Schema drift check failed.');
        }

        await webviewPanel.webview.postMessage({ type: 'doctorSchemaDriftResult', result });
    }

    private async selectDoctorDatasetFolder(webviewPanel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        const selectedFolders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Scan Dataset'
        });

        if (!selectedFolders || selectedFolders.length === 0) {
            await webviewPanel.webview.postMessage({
                type: 'doctorDatasetResult',
                result: { success: false, error: 'Dataset scan cancelled.' }
            });
            return;
        }

        const result = await this.parquetReader.scanParquetDataset(uri, selectedFolders[0]);

        if (!result.success) {
            vscode.window.showErrorMessage(result.error || 'Dataset scan failed.');
        }

        await webviewPanel.webview.postMessage({ type: 'doctorDatasetResult', result });
    }

    private async runDoctorChecks(webviewPanel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        const result = await this.parquetReader.runParquetDoctor(uri);
        await webviewPanel.webview.postMessage({ type: 'doctorResult', result });
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

    private getLoadingWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }

        .status {
            display: grid;
            gap: 10px;
            justify-items: center;
            max-width: 420px;
            padding: 24px;
            text-align: center;
        }

        .spinner {
            width: 28px;
            height: 28px;
            border: 3px solid var(--vscode-progressBar-background);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.9s linear infinite;
        }

        .title {
            font-size: 14px;
            font-weight: 600;
        }

        .detail {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.5;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <main class="status">
        <div class="spinner" aria-hidden="true"></div>
        <div class="title">Preparing Parquet viewer</div>
        <div class="detail">Setting up local Python and DuckDB support. This only happens when needed.</div>
    </main>
</body>
</html>`;
    }
}
