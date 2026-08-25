import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IDataFileReader, DataFileCompareMapping, DataFileCompareOrderMapping, DataFileExportFormat, DataFileJoinOptions, ParquetWriteOptions, DataFileRelation, DataFileExportScope, DataFileSourceOptions } from './interfaces/IDataFileReader';
import { IWebviewRenderer } from './interfaces/IWebviewRenderer';

export class FileHiveViewer implements vscode.CustomReadonlyEditorProvider {
    public static readonly viewType = 'fileHive.fileViewer';
    private static readonly exportFormats: readonly DataFileExportFormat[] = [
        'csv',
        'tsv',
        'psv',
        'json',
        'jsonl',
        'ndjson',
        'sqlite',
        'parquet',
        'duckdb',
        'avro',
        'orc',
        'arrow',
        'feather',
        'ipc'
    ];
    private readonly compareFiles = new WeakMap<vscode.WebviewPanel, vscode.Uri>();
    private readonly joinFiles = new WeakMap<vscode.WebviewPanel, vscode.Uri>();
    private readonly compareFileRelations = new WeakMap<vscode.WebviewPanel, DataFileRelation>();
    private readonly joinFileRelations = new WeakMap<vscode.WebviewPanel, DataFileRelation>();

    /**
     * Constructs a FileHiveViewer object.
     * @param {IDataFileReader} dataFileReader - The data file reader to use.
     * @param {IWebviewRenderer} webviewRenderer - The webview renderer to use.
     */
    constructor(
        private readonly dataFileReader: IDataFileReader,
        private readonly webviewRenderer: IWebviewRenderer
    ) {}

    /**
     * Registers a custom editor provider for File Hive.
     * 
     * This function registers a custom editor provider which can be used to
     * render supported data files in VS Code.
     * 
     * @param {IDataFileReader} dataFileReader - The data file reader to use.
     * @param {IWebviewRenderer} webviewRenderer - The webview renderer to use.
     * @returns {vscode.Disposable} The disposable custom editor provider.
     */
    public static register(
        dataFileReader: IDataFileReader,
        webviewRenderer: IWebviewRenderer
    ): vscode.Disposable {
        const provider = new FileHiveViewer(dataFileReader, webviewRenderer);
        return vscode.window.registerCustomEditorProvider(
            FileHiveViewer.viewType,
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
                void this.dataFileReader.releaseFileSession(uri).catch(() => undefined);
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
                    await this.refreshWebviewContent(webviewPanel, document.uri, message.query, message.selectedRelation, message.sourceOptions);
                    break;
                case 'query':
                    await this.queryWebviewContent(webviewPanel, document.uri, message.query, message.selectedRelation, message.sourceOptions);
                    break;
                case 'export':
                    await this.exportWebviewContent(webviewPanel, document.uri, message.format, message.query, message.selectedRelation, message.relations, message.sourceOptions);
                    break;
                case 'openAsText':
                    await this.openAsTextEditor(document.uri);
                    break;
                case 'saveEditedData':
                case 'saveEditedParquet':
                    await this.saveEditedData(webviewPanel, document.uri, message.columns, message.rows, message.sourceFormat);
                    break;
                case 'createParquet':
                    await this.createParquet(webviewPanel, document.uri, message.options);
                    break;
                case 'selectCompareFile':
                    await this.selectCompareFile(webviewPanel, document.uri, message.customMappingEnabled, message.selectedRelation, message.sourceOptions);
                    break;
                case 'selectJoinFile':
                    await this.selectJoinFile(webviewPanel, document.uri, message.selectedRelation, message.sourceOptions);
                    break;
                case 'runJoin':
                    await this.runJoin(webviewPanel, document.uri, message.options, message.selectedRelation, message.sourceOptions);
                    break;
                case 'exportJoinPreview':
                    await this.exportJoinPreview(webviewPanel, document.uri, message.columns, message.rows);
                    break;
                case 'runStrictCompare':
                    await this.runCompare(webviewPanel, document.uri, undefined, message.orderMapping, message.selectedRelation, message.sourceOptions);
                    break;
                case 'runCustomCompare':
                    await this.runCompare(webviewPanel, document.uri, message.mappings, message.orderMapping, message.selectedRelation, message.sourceOptions);
                    break;
                case 'runSmartDiff':
                    await this.runSmartDiff(webviewPanel, document.uri, message.selectedRelation, message.sourceOptions);
                    break;
                case 'selectDoctorReferenceFile':
                    await this.selectDoctorReferenceFile(webviewPanel, document.uri, message.selectedRelation, message.sourceOptions);
                    break;
                case 'selectDoctorDatasetFolder':
                    await this.selectDoctorDatasetFolder(webviewPanel, document.uri);
                    break;
                case 'runDoctor':
                    await this.runDoctorChecks(webviewPanel, document.uri, message.selectedRelation, message.sourceOptions);
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
     * @param uri The uri of the data file to initialize the content with.
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
     * @param uri The uri of the data file to refresh the content with.
     * @returns A promise that resolves when the webview content is refreshed.
     */
    private async refreshWebviewContent(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        query?: unknown,
        selectedRelation?: unknown,
        sourceOptions?: unknown
    ): Promise<void> {
        const sqlQuery = typeof query === 'string' ? query : undefined;
        await this.updateWebviewContent(webviewPanel, uri, sqlQuery, this.parseSelectedRelation(selectedRelation), this.parseSourceOptions(sourceOptions));
    }

    /**
     * Runs a SQL-like query against the parquet data and updates the existing webview.
     *
     * @param webviewPanel The webview panel to update.
     * @param uri The data file URI to query.
     * @param query The SQL query received from the webview.
     */
    private async queryWebviewContent(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        query?: unknown,
        selectedRelation?: unknown,
        sourceOptions?: unknown
    ): Promise<void> {
        const sqlQuery = typeof query === 'string' ? query : undefined;
        const dataFileData = await this.dataFileReader.readDataFile(uri, sqlQuery, this.parseSelectedRelation(selectedRelation), this.parseSourceOptions(sourceOptions));
        await webviewPanel.webview.postMessage({ type: 'data', data: dataFileData });
    }

    /**
     * Exports the current parquet query result to a user-selected file.
     *
     * @param webviewPanel The webview panel requesting the export.
     * @param uri The data file URI to export from.
     * @param format The requested export format.
     * @param query The SQL query received from the webview.
     */
    private async exportWebviewContent(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        format?: unknown,
        query?: unknown,
        selectedRelation?: unknown,
        relations?: unknown,
        sourceOptions?: unknown
    ): Promise<void> {
        if (typeof format !== 'string' || !FileHiveViewer.exportFormats.includes(format as DataFileExportFormat)) {
            await webviewPanel.webview.postMessage({
                type: 'exportResult',
                result: { success: false, error: 'Unsupported export format.' }
            });
            return;
        }

        const exportFormat = format as DataFileExportFormat;
        const parsedRelations = this.parseRelations(relations);
        const currentRelation = this.parseSelectedRelation(selectedRelation);
        const parsedSourceOptions = this.parseSourceOptions(sourceOptions);
        const exportChoice = await this.chooseExportScope(parsedRelations, currentRelation);

        if (!exportChoice) {
            await webviewPanel.webview.postMessage({
                type: 'exportResult',
                result: { success: false, error: 'Export cancelled.' }
            });
            return;
        }

        const defaultUri = exportChoice.scope === 'allRelations'
            ? this.getDefaultExportZipUri(uri, exportFormat)
            : exportChoice.scope === 'relation' && exportChoice.selectedRelation
                ? this.getDefaultRelationExportUri(uri, exportFormat, exportChoice.selectedRelation)
                : this.getDefaultExportUri(uri, exportFormat);
        const outputUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: exportChoice.scope === 'allRelations'
                ? { 'ZIP Archives': ['zip'] }
                : this.getExportFilters(exportFormat),
            saveLabel: exportChoice.scope === 'allRelations'
                ? `Export All ${this.getExportLabel(exportFormat)} Files`
                : `Export ${this.getExportLabel(exportFormat)}`
        });

        if (!outputUri) {
            await webviewPanel.webview.postMessage({
                type: 'exportResult',
                result: { success: false, error: 'Export cancelled.' }
            });
            return;
        }

        if (path.resolve(outputUri.fsPath) === path.resolve(uri.fsPath)) {
            await webviewPanel.webview.postMessage({
                type: 'exportResult',
                result: { success: false, error: 'Choose a new file path instead of overwriting the currently open file.' }
            });
            return;
        }

        const sqlQuery = typeof query === 'string' ? query : undefined;
        const exportQuery = exportChoice.scope === 'relation' ? undefined : sqlQuery;
        const result = await this.dataFileReader.exportDataFile(
            uri,
            exportFormat,
            outputUri,
            exportQuery,
            exportChoice.selectedRelation,
            exportChoice.scope,
            parsedSourceOptions
        );

        if (result.success) {
            vscode.window.showInformationMessage(
                exportChoice.scope === 'allRelations'
                    ? `Exported ${result.filesExported ?? 0} files with ${result.rowsExported ?? 0} rows to ${outputUri.fsPath}`
                    : `Exported ${result.rowsExported ?? 0} rows to ${outputUri.fsPath}`
            );
        } else {
            vscode.window.showErrorMessage(result.error || 'Export failed.');
        }

        await webviewPanel.webview.postMessage({ type: 'exportResult', result });
    }

    private getDefaultExportUri(uri: vscode.Uri, format: DataFileExportFormat): vscode.Uri {
        const extension = this.getExportExtension(format);
        const parsedPath = path.parse(uri.fsPath);
        const outputName = parsedPath.ext.toLowerCase() === `.${extension}`
            ? `${parsedPath.name}_export`
            : parsedPath.name;
        return vscode.Uri.file(path.join(parsedPath.dir, `${outputName}.${extension}`));
    }

    private getDefaultExportZipUri(uri: vscode.Uri, format: DataFileExportFormat): vscode.Uri {
        const parsedPath = path.parse(uri.fsPath);
        return vscode.Uri.file(path.join(parsedPath.dir, `${parsedPath.name}_${format}_tables.zip`));
    }

    private getDefaultRelationExportUri(uri: vscode.Uri, format: DataFileExportFormat, relation: DataFileRelation): vscode.Uri {
        const extension = this.getExportExtension(format);
        const parsedPath = path.parse(uri.fsPath);
        const relationName = `${relation.schema}_${relation.name}`.replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^[._]+|[._]+$/g, '') || 'table';
        return vscode.Uri.file(path.join(parsedPath.dir, `${parsedPath.name}_${relationName}.${extension}`));
    }

    private getExportExtension(format: DataFileExportFormat): string {
        return format;
    }

    private getExportLabel(format: DataFileExportFormat): string {
        const labels: Record<DataFileExportFormat, string> = {
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
            ipc: 'IPC'
        };
        return labels[format];
    }

    private getExportFilters(format: DataFileExportFormat): Record<string, string[]> {
        const filters: Record<DataFileExportFormat, Record<string, string[]>> = {
            csv: { 'CSV Files': ['csv'] },
            tsv: { 'TSV Files': ['tsv'] },
            psv: { 'PSV Files': ['psv'] },
            json: { 'JSON Files': ['json'] },
            jsonl: { 'JSON Lines Files': ['jsonl'] },
            ndjson: { 'NDJSON Files': ['ndjson'] },
            sqlite: { 'SQLite Databases': ['sqlite', 'db'] },
            parquet: { 'Parquet Files': ['parquet'] },
            duckdb: { 'DuckDB Databases': ['duckdb'] },
            avro: { 'Avro Files': ['avro'] },
            orc: { 'ORC Files': ['orc'] },
            arrow: { 'Arrow Files': ['arrow'] },
            feather: { 'Feather Files': ['feather'] },
            ipc: { 'IPC Files': ['ipc'] }
        };
        return filters[format];
    }

    private async saveEditedData(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        columns?: unknown,
        rows?: unknown,
        sourceFormat?: unknown
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

        const saveFormat = this.getEditedSaveFormat(sourceFormat);
        if (!saveFormat) {
            await webviewPanel.webview.postMessage({
                type: 'editSaveResult',
                result: { success: false, error: 'The current source format cannot be saved from Transform. Use Export for conversions.' }
            });
            return;
        }

        const defaultUri = this.getDefaultEditedDataUri(uri, saveFormat);
        const outputUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: this.getExportFilters(saveFormat),
            saveLabel: `Save Edited ${this.getExportLabel(saveFormat)}`
        });

        if (!outputUri) {
            await webviewPanel.webview.postMessage({
                type: 'editSaveResult',
                result: { success: false, error: 'Save cancelled.' }
            });
            return;
        }

        const result = await this.dataFileReader.saveEditedParquetFile(uri, outputUri, saveFormat, parsedColumns, parsedRows);

        if (result.success) {
            const openAction = 'Open New File';
            const message = `Saved edited data as a new ${this.getExportLabel(saveFormat)} file: ${outputUri.fsPath}.`;
            const action = await vscode.window.showInformationMessage(message, openAction);

            if (action === openAction) {
                await vscode.commands.executeCommand('vscode.openWith', outputUri, FileHiveViewer.viewType);
            }
        } else {
            vscode.window.showErrorMessage(result.error || `Could not save edited ${this.getExportLabel(saveFormat)} file.`);
        }

        await webviewPanel.webview.postMessage({ type: 'editSaveResult', result });
    }

    private async openAsTextEditor(uri: vscode.Uri): Promise<void> {
        await vscode.commands.executeCommand('vscode.openWith', uri, 'default', {
            preview: false,
            viewColumn: vscode.ViewColumn.Active
        });
    }

    private getEditedSaveFormat(sourceFormat?: unknown): DataFileExportFormat | undefined {
        return typeof sourceFormat === 'string' && FileHiveViewer.exportFormats.includes(sourceFormat as DataFileExportFormat)
            ? sourceFormat as DataFileExportFormat
            : undefined;
    }

    private getDefaultEditedDataUri(uri: vscode.Uri, format: DataFileExportFormat): vscode.Uri {
        const parsedPath = path.parse(uri.fsPath);
        return vscode.Uri.file(path.join(parsedPath.dir, `${parsedPath.name}_edited.${this.getExportExtension(format)}`));
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

        const result = await this.dataFileReader.createParquetFile(uri, outputUri, writeOptions);

        if (result.success) {
            const openAction = 'Open Created Parquet';
            const message = `Created Parquet file: ${outputUri.fsPath}`;
            const action = await vscode.window.showInformationMessage(message, openAction);

            if (action === openAction) {
                await vscode.commands.executeCommand('vscode.openWith', outputUri, FileHiveViewer.viewType);
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
        customMappingEnabled?: unknown,
        selectedRelation?: unknown,
        sourceOptions?: unknown
    ): Promise<void> {
        const selectedFiles = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Data Files': ['parquet', 'duckdb', 'sqlite', 'db', 'csv', 'tsv', 'psv', 'json', 'jsonl', 'ndjson', 'avro', 'orc', 'arrow', 'feather', 'ipc'],
                'Parquet Files': ['parquet'],
                'DuckDB Databases': ['duckdb'],
                'SQLite Databases': ['sqlite', 'db'],
                'CSV Files': ['csv'],
                'Delimited Files': ['tsv', 'psv'],
                'JSON Files': ['json', 'jsonl', 'ndjson'],
                'Avro Files': ['avro'],
                'ORC Files': ['orc'],
                'Arrow Files': ['arrow', 'feather', 'ipc']
            },
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
        const compareRelation = await this.chooseRelationForFile(compareUri, 'Compare');
        if (compareRelation === null) {
            this.compareFiles.delete(webviewPanel);
            this.compareFileRelations.delete(webviewPanel);
            await webviewPanel.webview.postMessage({
                type: 'compareResult',
                result: { success: false, error: 'Compare cancelled.' }
            });
            return;
        }

        this.compareFiles.set(webviewPanel, compareUri);
        if (compareRelation) {
            this.compareFileRelations.set(webviewPanel, compareRelation);
        } else {
            this.compareFileRelations.delete(webviewPanel);
        }

        const metadataResult = await this.dataFileReader.getCompareMetadata(
            uri,
            compareUri,
            this.parseSelectedRelation(selectedRelation),
            compareRelation,
            this.parseSourceOptions(sourceOptions)
        );
        await webviewPanel.webview.postMessage({ type: 'compareMetadata', result: metadataResult });

        if (!metadataResult.success) {
            vscode.window.showErrorMessage(metadataResult.error || 'Could not read compare columns.');
            return;
        }
    }

    private async selectJoinFile(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        selectedRelation?: unknown,
        sourceOptions?: unknown
    ): Promise<void> {
        const selectedFiles = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Data Files': ['parquet', 'duckdb', 'sqlite', 'db', 'csv', 'tsv', 'psv', 'json', 'jsonl', 'ndjson', 'avro', 'orc', 'arrow', 'feather', 'ipc'],
                'Parquet Files': ['parquet'],
                'DuckDB Databases': ['duckdb'],
                'SQLite Databases': ['sqlite', 'db'],
                'CSV Files': ['csv'],
                'Delimited Files': ['tsv', 'psv'],
                'JSON Files': ['json', 'jsonl', 'ndjson'],
                'Avro Files': ['avro'],
                'ORC Files': ['orc'],
                'Arrow Files': ['arrow', 'feather', 'ipc']
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
        const joinRelation = await this.chooseRelationForFile(joinUri, 'Join');
        if (joinRelation === null) {
            this.joinFiles.delete(webviewPanel);
            this.joinFileRelations.delete(webviewPanel);
            await webviewPanel.webview.postMessage({
                type: 'joinMetadata',
                result: { success: false, error: 'Join cancelled.' }
            });
            return;
        }

        this.joinFiles.set(webviewPanel, joinUri);
        if (joinRelation) {
            this.joinFileRelations.set(webviewPanel, joinRelation);
        } else {
            this.joinFileRelations.delete(webviewPanel);
        }

        const metadataResult = await this.dataFileReader.getJoinMetadata(
            uri,
            joinUri,
            this.parseSelectedRelation(selectedRelation),
            joinRelation,
            this.parseSourceOptions(sourceOptions)
        );
        await webviewPanel.webview.postMessage({ type: 'joinMetadata', result: metadataResult });

        if (!metadataResult.success) {
            vscode.window.showErrorMessage(metadataResult.error || 'Could not read join columns.');
        }
    }

    private async runJoin(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        options?: unknown,
        selectedRelation?: unknown,
        sourceOptions?: unknown
    ): Promise<void> {
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

        const result = await this.dataFileReader.joinDataFile(
            uri,
            joinUri,
            joinOptions,
            this.parseSelectedRelation(selectedRelation),
            this.joinFileRelations.get(webviewPanel),
            this.parseSourceOptions(sourceOptions)
        );

        if (!result.success) {
            vscode.window.showErrorMessage(result.error || 'Join failed.');
        }

        await webviewPanel.webview.postMessage({ type: 'joinResult', result });
    }

    private parseJoinOptions(options?: unknown): DataFileJoinOptions | undefined {
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
        orderMapping?: unknown,
        selectedRelation?: unknown,
        sourceOptions?: unknown
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

        const result = await this.dataFileReader.compareDataFile(
            uri,
            compareUri,
            compareMappings,
            compareOrderMapping,
            this.parseSelectedRelation(selectedRelation),
            this.compareFileRelations.get(webviewPanel),
            this.parseSourceOptions(sourceOptions)
        );

        if (!result.success) {
            vscode.window.showErrorMessage(result.error || 'Parquet compare failed.');
        }

        await webviewPanel.webview.postMessage({ type: 'compareResult', result });
    }

    private async runSmartDiff(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        selectedRelation?: unknown,
        sourceOptions?: unknown
    ): Promise<void> {
        const compareUri = this.compareFiles.get(webviewPanel);

        if (!compareUri) {
            await webviewPanel.webview.postMessage({
                type: 'compareResult',
                result: { success: false, error: 'Choose a compare file first.' }
            });
            return;
        }

        const result = await this.dataFileReader.smartDiffDataFile(
            uri,
            compareUri,
            this.parseSelectedRelation(selectedRelation),
            this.compareFileRelations.get(webviewPanel),
            this.parseSourceOptions(sourceOptions)
        );

        if (!result.success) {
            vscode.window.showErrorMessage(result.error || 'Smart Diff failed.');
        }

        await webviewPanel.webview.postMessage({ type: 'compareResult', result });
    }

    private parseCompareMappings(mappings?: unknown): DataFileCompareMapping[] | undefined {
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

    private parseCompareOrderMapping(orderMapping?: unknown): DataFileCompareOrderMapping | undefined {
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

    private async selectDoctorReferenceFile(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        selectedRelation?: unknown,
        sourceOptions?: unknown
    ): Promise<void> {
        const selectedFiles = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Data Files': ['parquet', 'duckdb', 'sqlite', 'db', 'csv', 'tsv', 'psv', 'json', 'jsonl', 'ndjson', 'avro', 'orc', 'arrow', 'feather', 'ipc'],
                'Parquet Files': ['parquet'],
                'DuckDB Databases': ['duckdb'],
                'SQLite Databases': ['sqlite', 'db'],
                'CSV Files': ['csv'],
                'Delimited Files': ['tsv', 'psv'],
                'JSON Files': ['json', 'jsonl', 'ndjson'],
                'Avro Files': ['avro'],
                'ORC Files': ['orc'],
                'Arrow Files': ['arrow', 'feather', 'ipc']
            },
            openLabel: 'Use as Reference'
        });

        if (!selectedFiles || selectedFiles.length === 0) {
            await webviewPanel.webview.postMessage({
                type: 'doctorSchemaDriftResult',
                result: { success: false, error: 'Schema drift check cancelled.' }
            });
            return;
        }

        const referenceUri = selectedFiles[0];
        const referenceRelation = await this.chooseRelationForFile(referenceUri, 'Reference');
        if (referenceRelation === null) {
            await webviewPanel.webview.postMessage({
                type: 'doctorSchemaDriftResult',
                result: { success: false, error: 'Schema drift check cancelled.' }
            });
            return;
        }

        const result = await this.dataFileReader.detectSchemaDrift(
            uri,
            referenceUri,
            this.parseSelectedRelation(selectedRelation),
            referenceRelation,
            this.parseSourceOptions(sourceOptions)
        );

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

        const result = await this.dataFileReader.scanParquetDataset(uri, selectedFolders[0]);

        if (!result.success) {
            vscode.window.showErrorMessage(result.error || 'Dataset scan failed.');
        }

        await webviewPanel.webview.postMessage({ type: 'doctorDatasetResult', result });
    }

    private async runDoctorChecks(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        selectedRelation?: unknown,
        sourceOptions?: unknown
    ): Promise<void> {
        const result = await this.dataFileReader.runFileDoctor(uri, this.parseSelectedRelation(selectedRelation), this.parseSourceOptions(sourceOptions));
        await webviewPanel.webview.postMessage({ type: 'doctorResult', result });
    }

        /**
         * Updates the webview content for the given webview panel and uri.
         * 
         * This function updates the webview content for the given webview panel and uri.
         * It reads the data file at the given uri using the data reader and
         * generates the webview content using the webview renderer.
         * 
         * @param webviewPanel The webview panel to update the content for.
         * @param uri The uri of the data file to update the content with.
         * @returns A promise that resolves when the webview content is updated.
         */
    private async updateWebviewContent(
        webviewPanel: vscode.WebviewPanel,
        uri: vscode.Uri,
        query?: string,
        selectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<void> {
        const dataFileData = await this.dataFileReader.readDataFile(uri, query, selectedRelation, sourceOptions);
        webviewPanel.webview.html = this.webviewRenderer.getWebviewContent(webviewPanel.webview, dataFileData);
    }

    private isRelationSelectableDataFile(uri: vscode.Uri): boolean {
        const extension = path.extname(uri.fsPath).toLowerCase();
        return extension === '.duckdb' || extension === '.sqlite' || extension === '.db';
    }

    private async chooseRelationForFile(uri: vscode.Uri, actionLabel: string): Promise<DataFileRelation | undefined | null> {
        if (!this.isRelationSelectableDataFile(uri)) {
            return undefined;
        }

        const result = await this.dataFileReader.readDataFile(uri);
        if (!result.success) {
            vscode.window.showErrorMessage(result.error || `Could not inspect ${actionLabel.toLowerCase()} file relations.`);
            return null;
        }

        const relations = (result.relations || [])
            .map((relation) => this.parseSelectedRelation(relation))
            .filter((relation): relation is DataFileRelation => Boolean(relation));

        if (relations.length <= 1) {
            return this.parseSelectedRelation(result.selectedRelation) || relations[0];
        }

        type RelationPick = vscode.QuickPickItem & {
            relation: DataFileRelation;
        };

        const selected = await vscode.window.showQuickPick<RelationPick>(
            relations.map((relation) => ({
                label: relation.type === 'VIEW'
                    ? `View: ${relation.schema}.${relation.name}`
                    : `Table: ${relation.schema}.${relation.name}`,
                description: relation.database,
                relation
            })),
            {
                placeHolder: `Choose ${actionLabel.toLowerCase()} table or view`
            }
        );

        return selected ? selected.relation : null;
    }

    private async chooseExportScope(
        relations: DataFileRelation[],
        currentRelation?: DataFileRelation
    ): Promise<{ scope: DataFileExportScope; selectedRelation?: DataFileRelation } | undefined> {
        if (relations.length <= 1) {
            return { scope: 'query', selectedRelation: currentRelation };
        }

        type ExportPick = vscode.QuickPickItem & {
            scope?: DataFileExportScope;
            relation?: DataFileRelation;
        };

        const picks: ExportPick[] = [
            {
                label: 'Current SQL Result',
                description: 'Export the query currently in the SQL editor',
                scope: 'query',
                relation: currentRelation
            },
            {
                label: 'All Tables/Views as ZIP',
                description: 'Export one file per table/view and package them together',
                scope: 'allRelations',
                relation: currentRelation
            },
            {
                label: 'Tables and Views',
                kind: vscode.QuickPickItemKind.Separator
            },
            ...relations.map((relation) => ({
                label: relation.type === 'VIEW'
                    ? `View: ${relation.schema}.${relation.name}`
                    : `Table: ${relation.schema}.${relation.name}`,
                description: 'Export this relation only',
                scope: 'relation' as DataFileExportScope,
                relation
            }))
        ];

        const selected = await vscode.window.showQuickPick(picks, {
            placeHolder: 'Choose what to export'
        });

        if (!selected || !selected.scope) {
            return undefined;
        }

        return {
            scope: selected.scope,
            selectedRelation: selected.relation
        };
    }

    private parseRelations(relations?: unknown): DataFileRelation[] {
        if (!Array.isArray(relations)) {
            return [];
        }

        return relations
            .map((relation) => this.parseSelectedRelation(relation))
            .filter((relation): relation is DataFileRelation => Boolean(relation));
    }

    private parseSelectedRelation(selectedRelation?: unknown): DataFileRelation | undefined {
        if (typeof selectedRelation !== 'object' || selectedRelation === null ||
            !('schema' in selectedRelation) || !('name' in selectedRelation) || !('type' in selectedRelation)) {
            return undefined;
        }

        const relationType = String(selectedRelation.type);
        if (relationType !== 'BASE TABLE' && relationType !== 'VIEW') {
            return undefined;
        }

        const schema = String(selectedRelation.schema);
        const name = String(selectedRelation.name);
        if (!schema || !name) {
            return undefined;
        }

        const database = 'database' in selectedRelation && selectedRelation.database
            ? String(selectedRelation.database)
            : undefined;

        return { database, schema, name, type: relationType };
    }

    private parseSourceOptions(sourceOptions?: unknown): DataFileSourceOptions | undefined {
        if (typeof sourceOptions !== 'object' || sourceOptions === null) {
            return undefined;
        }

        const parsedOptions: DataFileSourceOptions = {};

        if ('delimitedText' in sourceOptions && typeof sourceOptions.delimitedText === 'object' && sourceOptions.delimitedText !== null) {
            const delimitedText = sourceOptions.delimitedText;
            const readText = (key: string, maxLength: number): string | undefined => {
                if (!(key in delimitedText)) {
                    return undefined;
                }

                const value = String((delimitedText as Record<string, unknown>)[key] ?? '');
                return value.length <= maxLength ? value : value.slice(0, maxLength);
            };

            const parsed = {
                header: 'header' in delimitedText ? Boolean((delimitedText as Record<string, unknown>).header) : undefined,
                delimiter: readText('delimiter', 8),
                encoding: readText('encoding', 24),
                quote: readText('quote', 1),
                escape: readText('escape', 1),
                nullString: readText('nullString', 64)
            };

            if (Object.values(parsed).some((value) => value !== undefined)) {
                parsedOptions.delimitedText = parsed;
            }
        }

        if ('json' in sourceOptions && typeof sourceOptions.json === 'object' && sourceOptions.json !== null) {
            const jsonOptions = sourceOptions.json as Record<string, unknown>;
            parsedOptions.json = {
                flatten: 'flatten' in jsonOptions ? Boolean(jsonOptions.flatten) : undefined,
                recordPath: 'recordPath' in jsonOptions
                    ? String(jsonOptions.recordPath ?? '').trim().slice(0, 240)
                    : undefined
            };
        }

        return Object.keys(parsedOptions).length ? parsedOptions : undefined;
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
            <div class="title">Preparing data file viewer</div>
        <div class="detail">Setting up local Python and DuckDB support. This only happens when needed.</div>
    </main>
</body>
</html>`;
    }
}
