import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import {
    IDataFileReader,
    DataFileCompareMapping,
    DataFileCompareOrderMapping,
    DataFileCompareMetadataResult,
    DataFileCompareResult,
    DataFileReadResult,
    DataFileDoctorRunResult,
    DataFileRelation,
    DataFileDatasetAnalysisResult,
    ParquetEditSaveResult,
    DataFileExportFormat,
    DataFileExportResult,
    DataFileJoinOptions,
    DataFileJoinResult,
    DataFileSchemaDriftResult,
    ParquetWriteOptions,
    ParquetWriteResult,
    DataFileExportScope,
    DataFileSourceOptions
} from '../interfaces/IDataFileReader';
import { LoggingService } from '../services/LoggingService';

type PythonScriptResult =
    | DataFileReadResult
    | DataFileDoctorRunResult
    | DataFileExportResult
    | ParquetEditSaveResult
    | DataFileCompareResult
    | DataFileCompareMetadataResult
    | DataFileJoinResult
    | DataFileSchemaDriftResult
    | DataFileDatasetAnalysisResult
    | ParquetWriteResult;

interface WorkerRequest {
    requestId: string;
    command: string;
    payload?: Record<string, unknown>;
}

interface WorkerResponse {
    requestId?: string;
    result?: PythonScriptResult;
    error?: string;
}

interface PendingRequest {
    resolve: (result: PythonScriptResult) => void;
    timeoutHandle: NodeJS.Timeout;
}

export class PythonDataFileReader implements IDataFileReader, vscode.Disposable {
    private workerProcess: ChildProcessWithoutNullStreams | null = null;
    private workerReadyPromise: Promise<void> | null = null;
    private workerStdoutBuffer = '';
    private readonly pendingRequests = new Map<string, PendingRequest>();
    private readonly fileSessions = new Map<string, string>();
    private requestCounter = 0;

    constructor(
        private readonly pythonManager: { getPythonPath(): string | null; ensureInitialized?(): Promise<void> },
        private readonly context: vscode.ExtensionContext,
        private readonly logger: LoggingService
    ) {}

    /**
     * Reads a data file from the given URI.
     * 
     * This function executes a Python script in the background
     * to read the data file. The Python script is bundled with
     * the extension and can be found in the out directory.
     * 
     * If the Python environment is not configured, this function
     * will return an error. To configure the Python environment,
     * call the initializeEnvironment method on the PythonEnvironmentManager.
     * 
     * @param uri The URI of the data file to read.
     * @returns A promise that resolves to a DataFileReadResult.
     */
    async readDataFile(
        uri: vscode.Uri,
        query?: string,
        selectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions,
        offset?: number,
        limit?: number
    ): Promise<DataFileReadResult> {
        this.logger.info('Reading data file', uri.fsPath);

        const result = await this.sendWorkerRequest(
            'read',
            {
                sessionId: this.getOrCreateSessionId(uri),
                filePath: uri.fsPath,
                query: query ?? null,
                selectedRelation: selectedRelation ?? null,
                sourceOptions: sourceOptions ?? null,
                offset: offset ?? 0,
                limit: limit ?? 1000
            },
            120000
        );
        return result as DataFileReadResult;
    }
    async runFileDoctor(
        uri: vscode.Uri,
        selectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileDoctorRunResult> {
        const result = await this.sendWorkerRequest(
            'doctor',
            {
                sessionId: this.getOrCreateSessionId(uri),
                filePath: uri.fsPath,
                selectedRelation: selectedRelation ?? null,
                sourceOptions: sourceOptions ?? null
            },
            180000
        );
        return result as DataFileDoctorRunResult;
    }

    async releaseFileSession(uri: vscode.Uri): Promise<void> {
        const fileKey = this.getFileSessionKey(uri);
        const sessionId = this.fileSessions.get(fileKey);
        if (!sessionId) {
            return;
        }

        this.fileSessions.delete(fileKey);
        if (!this.workerProcess) {
            return;
        }

        const result = await this.sendWorkerRequest(
            'release_session',
            { sessionId },
            10000
        );

        if (!result.success) {
        this.logger.warn('Failed to release File Hive worker session', { sessionId, error: result.error });
        }
    }

    async exportDataFile(
        uri: vscode.Uri,
        format: DataFileExportFormat,
        outputUri: vscode.Uri,
        query?: string,
        selectedRelation?: DataFileRelation,
        exportScope?: DataFileExportScope,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileExportResult> {
        const result = await this.sendWorkerRequest(
            'export',
            {
                sessionId: this.getOrCreateSessionId(uri),
                filePath: uri.fsPath,
                query: query ?? null,
                format,
                outputPath: outputUri.fsPath,
                selectedRelation: selectedRelation ?? null,
                exportScope: exportScope ?? 'query',
                sourceOptions: sourceOptions ?? null
            },
            120000
        );
        return result as DataFileExportResult;
    }

    async saveEditedParquetFile(
        uri: vscode.Uri,
        outputUri: vscode.Uri,
        format: DataFileExportFormat,
        columns: string[],
        rows: Record<string, any>[]
    ): Promise<ParquetEditSaveResult> {
        let tempDir: string | undefined;

        try {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-hive-edit-'));
            const payloadPath = path.join(tempDir, 'edited-rows.json');
            fs.writeFileSync(payloadPath, JSON.stringify({ columns, rows }), 'utf8');

            const result = await this.sendWorkerRequest(
                'save_edits',
                {
                    filePath: uri.fsPath,
                    outputPath: outputUri.fsPath,
                    editsPath: payloadPath,
                    format
                },
                120000
            );
            return result as ParquetEditSaveResult;
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        } finally {
            if (tempDir) {
                fs.rm(tempDir, { recursive: true, force: true }, () => undefined);
            }
        }
    }

    async createParquetFile(
        uri: vscode.Uri,
        outputUri: vscode.Uri,
        options: ParquetWriteOptions,
        selectedRelation?: DataFileRelation | null,
        sourceOptions?: DataFileSourceOptions | null
    ): Promise<ParquetWriteResult> {
        let tempDir: string | undefined;

        try {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-hive-write-'));
            const payloadPath = path.join(tempDir, 'write-payload.json');
            fs.writeFileSync(payloadPath, JSON.stringify(options), 'utf8');

            const result = await this.sendWorkerRequest(
                'create_parquet',
                {
                    sessionId: this.getOrCreateSessionId(uri),
                    filePath: uri.fsPath,
                    selectedRelation: selectedRelation ?? null,
                    sourceOptions: sourceOptions ?? null,
                    outputPath: outputUri.fsPath,
                    payloadPath
                },
                120000
            );
            return result as ParquetWriteResult;
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        } finally {
            if (tempDir) {
                fs.rm(tempDir, { recursive: true, force: true }, () => undefined);
            }
        }
    }

    async getCompareMetadata(
        uri: vscode.Uri,
        compareUri: vscode.Uri,
        selectedRelation?: DataFileRelation,
        compareSelectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileCompareMetadataResult> {
        const result = await this.sendWorkerRequest(
            'compare_metadata',
            {
                filePath: uri.fsPath,
                comparePath: compareUri.fsPath,
                selectedRelation: selectedRelation ?? null,
                compareSelectedRelation: compareSelectedRelation ?? null,
                sourceOptions: sourceOptions ?? null
            },
            120000
        );
        return result as DataFileCompareMetadataResult;
    }

    async compareDataFile(
        uri: vscode.Uri,
        compareUri: vscode.Uri,
        mappings?: DataFileCompareMapping[],
        orderMapping?: DataFileCompareOrderMapping,
        selectedRelation?: DataFileRelation,
        compareSelectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileCompareResult> {
        const result = await this.sendWorkerRequest(
            'compare',
            {
                filePath: uri.fsPath,
                comparePath: compareUri.fsPath,
                mappings: mappings ?? null,
                orderMapping: orderMapping ?? null,
                selectedRelation: selectedRelation ?? null,
                compareSelectedRelation: compareSelectedRelation ?? null,
                sourceOptions: sourceOptions ?? null
            },
            120000
        );
        return result as DataFileCompareResult;
    }

    async smartDiffDataFile(
        uri: vscode.Uri,
        compareUri: vscode.Uri,
        selectedRelation?: DataFileRelation,
        compareSelectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileCompareResult> {
        const result = await this.sendWorkerRequest(
            'smart_diff',
            {
                filePath: uri.fsPath,
                comparePath: compareUri.fsPath,
                selectedRelation: selectedRelation ?? null,
                compareSelectedRelation: compareSelectedRelation ?? null,
                sourceOptions: sourceOptions ?? null
            },
            120000
        );
        return result as DataFileCompareResult;
    }

    async joinDataFile(
        uri: vscode.Uri,
        joinUri: vscode.Uri,
        options: DataFileJoinOptions,
        selectedRelation?: DataFileRelation,
        joinSelectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileJoinResult> {
        const result = await this.sendWorkerRequest(
            'join',
            {
                filePath: uri.fsPath,
                joinPath: joinUri.fsPath,
                options,
                selectedRelation: selectedRelation ?? null,
                joinSelectedRelation: joinSelectedRelation ?? null,
                sourceOptions: sourceOptions ?? null
            },
            120000
        );
        return result as DataFileJoinResult;
    }

    async getJoinMetadata(
        uri: vscode.Uri,
        joinUri: vscode.Uri,
        selectedRelation?: DataFileRelation,
        joinSelectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileJoinResult> {
        const result = await this.sendWorkerRequest(
            'join_metadata',
            {
                filePath: uri.fsPath,
                joinPath: joinUri.fsPath,
                selectedRelation: selectedRelation ?? null,
                joinSelectedRelation: joinSelectedRelation ?? null,
                sourceOptions: sourceOptions ?? null
            },
            120000
        );
        return result as DataFileJoinResult;
    }

    async detectSchemaDrift(
        uri: vscode.Uri,
        referenceUri: vscode.Uri,
        selectedRelation?: DataFileRelation,
        referenceSelectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileSchemaDriftResult> {
        const result = await this.sendWorkerRequest(
            'schema_drift',
            {
                filePath: uri.fsPath,
                referencePath: referenceUri.fsPath,
                selectedRelation: selectedRelation ?? null,
                referenceSelectedRelation: referenceSelectedRelation ?? null,
                sourceOptions: sourceOptions ?? null
            },
            120000
        );
        return result as DataFileSchemaDriftResult;
    }

    async scanParquetDataset(uri: vscode.Uri, folderUri: vscode.Uri): Promise<DataFileDatasetAnalysisResult> {
        void uri;
        const result = await this.sendWorkerRequest(
            'dataset_scan',
            {
                folderPath: folderUri.fsPath
            },
            180000
        );
        return result as DataFileDatasetAnalysisResult;
    }

    public dispose(): void {
        this.fileSessions.clear();
        this.workerStdoutBuffer = '';
        this.workerReadyPromise = null;

        for (const [requestId, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timeoutHandle);
            pending.resolve({
                success: false,
                error: 'File Hive Python worker stopped before completing the request.'
            });
            this.pendingRequests.delete(requestId);
        }

        if (this.workerProcess) {
            this.workerProcess.kill();
            this.workerProcess = null;
        }
    }

    private async getReadyPythonPath(): Promise<{ pythonPath?: string; error?: string }> {
        try {
            if (this.pythonManager.ensureInitialized) {
                await this.pythonManager.ensureInitialized();
            }

            const pythonPath = this.pythonManager.getPythonPath();
            if (!pythonPath) {
                return { error: 'Python environment is not configured yet.' };
            }

            return { pythonPath };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { error: `Could not prepare the Python environment: ${message}` };
        }
    }

    private ensurePythonScriptExists(scriptPath: string): boolean {
        const exists = fs.existsSync(scriptPath);
        if (!exists) {
            this.logger.error('Python script not found', scriptPath);
        }
        return exists;
    }

    private async sendWorkerRequest(
        command: string,
        payload: Record<string, unknown>,
        timeoutMs: number
    ): Promise<PythonScriptResult> {
        try {
            await this.ensureWorkerReady();
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }

        const process = this.workerProcess;
        if (!process || process.killed) {
            return { success: false, error: 'File Hive Python worker is not available.' };
        }

        const requestId = this.buildRequestId();
        const request: WorkerRequest = {
            requestId,
            command,
            payload
        };

        return new Promise((resolve) => {
            const timeoutHandle = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                resolve({
                    success: false,
                    error: `Operation timed out after ${timeoutMs / 1000} seconds`
                });
            }, timeoutMs);

            this.pendingRequests.set(requestId, { resolve, timeoutHandle });

            process.stdin.write(`${JSON.stringify(request)}\n`, (writeError) => {
                if (!writeError) {
                    return;
                }

                const pending = this.pendingRequests.get(requestId);
                if (!pending) {
                    return;
                }

                clearTimeout(pending.timeoutHandle);
                this.pendingRequests.delete(requestId);
                resolve({
                    success: false,
                    error: `Failed to write request to Python worker: ${writeError.message}`
                });
            });
        });
    }

    private async ensureWorkerReady(): Promise<void> {
        if (this.workerProcess && !this.workerProcess.killed) {
            return;
        }

        if (this.workerReadyPromise) {
            await this.workerReadyPromise;
            return;
        }

        this.workerReadyPromise = this.startWorker();
        try {
            await this.workerReadyPromise;
        } finally {
            this.workerReadyPromise = null;
        }
    }

    private async startWorker(): Promise<void> {
        const readyPython = await this.getReadyPythonPath();
        if (!readyPython.pythonPath) {
            throw new Error(readyPython.error || 'Python environment is not configured yet.');
        }

        const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_data_file.py');
        if (!this.ensurePythonScriptExists(pythonScriptPath)) {
            throw new Error(`Python script not found: ${pythonScriptPath}`);
        }

        this.workerStdoutBuffer = '';
        const worker = spawn(readyPython.pythonPath, [pythonScriptPath, '--worker'], {
            stdio: 'pipe',
            shell: false
        });

        this.workerProcess = worker;
        worker.stdout.setEncoding('utf8');
        worker.stderr.setEncoding('utf8');

        worker.stdout.on('data', (chunk: string) => {
            this.handleWorkerStdout(chunk);
        });

        worker.stderr.on('data', (chunk: string) => {
            this.logger.debug('Python worker STDERR', chunk);
        });

        worker.on('close', (code, signal) => {
            this.handleWorkerClose(code, signal);
        });

        worker.on('error', (error) => {
            this.logger.error('Python worker failed', error);
            this.rejectAllPending(`Python worker error: ${error.message}`);
        });
    }

    private handleWorkerStdout(chunk: string): void {
        this.workerStdoutBuffer += chunk;
        const lines = this.workerStdoutBuffer.split(/\r?\n/);
        this.workerStdoutBuffer = lines.pop() ?? '';

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) {
                continue;
            }

            let response: WorkerResponse;
            try {
                response = JSON.parse(line) as WorkerResponse;
            } catch (error) {
                this.logger.error('Failed to parse worker response line', { line, error });
                continue;
            }

            const requestId = response.requestId;
            if (!requestId) {
                this.logger.warn('Worker response missing requestId', response);
                continue;
            }

            const pending = this.pendingRequests.get(requestId);
            if (!pending) {
                continue;
            }

            clearTimeout(pending.timeoutHandle);
            this.pendingRequests.delete(requestId);

            if (response.result) {
                pending.resolve(response.result);
                continue;
            }

            pending.resolve({
                success: false,
                error: response.error || 'Worker returned an empty response.'
            });
        }
    }

    private handleWorkerClose(code: number | null, signal: NodeJS.Signals | null): void {
        this.logger.warn('Python worker exited', { code, signal });
        this.workerProcess = null;
        this.workerStdoutBuffer = '';
        this.rejectAllPending(signal ? `Python worker terminated by signal: ${signal}` : `Python worker exited with code ${code}`);
    }

    private rejectAllPending(errorMessage: string): void {
        for (const [requestId, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timeoutHandle);
            pending.resolve({ success: false, error: errorMessage });
            this.pendingRequests.delete(requestId);
        }
    }

    private getFileSessionKey(uri: vscode.Uri): string {
        const normalized = path.resolve(uri.fsPath);
        if (os.platform() === 'win32') {
            return normalized.toLowerCase();
        }

        return normalized;
    }

    private getOrCreateSessionId(uri: vscode.Uri): string {
        const key = this.getFileSessionKey(uri);
        const existing = this.fileSessions.get(key);
        if (existing) {
            return existing;
        }

        const sessionId = `${Date.now()}-${++this.requestCounter}`;
        this.fileSessions.set(key, sessionId);
        return sessionId;
    }

    private buildRequestId(): string {
        return `req-${Date.now()}-${++this.requestCounter}`;
    }
}
