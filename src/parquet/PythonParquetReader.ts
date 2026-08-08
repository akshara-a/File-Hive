import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import {
    IParquetReader,
    ParquetCompareMapping,
    ParquetCompareOrderMapping,
    ParquetCompareMetadataResult,
    ParquetCompareResult,
    ParquetDataResult,
    ParquetDatasetAnalysisResult,
    ParquetEditSaveResult,
    ParquetExportFormat,
    ParquetExportResult,
    ParquetJoinOptions,
    ParquetJoinResult,
    ParquetSchemaDriftResult,
    ParquetWriteOptions,
    ParquetWriteResult
} from '../interfaces/IParquetReader';
import { LoggingService } from '../services/LoggingService';

export class PythonParquetReader implements IParquetReader {
    constructor(
        private readonly pythonManager: { getPythonPath(): string | null; ensureInitialized?(): Promise<void> },
        private readonly context: vscode.ExtensionContext,
        private readonly logger: LoggingService
    ) {}

    /**
     * Reads a parquet file from the given URI.
     * 
     * This function executes a Python script in the background
     * to read the parquet file. The Python script is bundled with
     * the extension and can be found in the out directory.
     * 
     * If the Python environment is not configured, this function
     * will return an error. To configure the Python environment,
     * call the initializeEnvironment method on the PythonEnvironmentManager.
     * 
     * @param uri The URI of the parquet file to read.
     * @returns A promise that resolves to a ParquetDataResult.
     */
    async readParquetFile(uri: vscode.Uri, query?: string): Promise<ParquetDataResult> {
        const readyPython = await this.getReadyPythonPath();

        if (!readyPython.pythonPath) {
            return { success: false, error: readyPython.error };
        }
        const pythonPath = readyPython.pythonPath;

        this.logger.info('Reading parquet file', uri.fsPath);
        
        return new Promise((resolve) => {
            const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_parquet.py');
            
            if (!this.ensurePythonScriptExists(pythonScriptPath)) {
                resolve({ success: false, error: `Python script not found: ${pythonScriptPath}` });
                return;
            }

            this.executePythonScript(pythonScriptPath, uri.fsPath, pythonPath, resolve, query);
        });
    }

    async exportParquetFile(
        uri: vscode.Uri,
        format: ParquetExportFormat,
        outputUri: vscode.Uri,
        query?: string
    ): Promise<ParquetExportResult> {
        const readyPython = await this.getReadyPythonPath();

        if (!readyPython.pythonPath) {
            return {
                success: false,
                error: readyPython.error
            };
        }
        const pythonPath = readyPython.pythonPath;

        return new Promise((resolve) => {
            const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_parquet.py');

            if (!this.ensurePythonScriptExists(pythonScriptPath)) {
                resolve({ success: false, error: `Python script not found: ${pythonScriptPath}` });
                return;
            }

            const args = [
                pythonScriptPath,
                uri.fsPath,
                query && query.trim() ? query : '',
                '--export',
                format,
                outputUri.fsPath
            ];
            this.executePythonScriptWithArgs(args, pythonPath, resolve, 120000);
        });
    }

    async saveEditedParquetFile(
        uri: vscode.Uri,
        outputUri: vscode.Uri,
        columns: string[],
        rows: Record<string, any>[]
    ): Promise<ParquetEditSaveResult> {
        const readyPython = await this.getReadyPythonPath();

        if (!readyPython.pythonPath) {
            return {
                success: false,
                error: readyPython.error
            };
        }
        const pythonPath = readyPython.pythonPath;

        return new Promise((resolve) => {
            const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_parquet.py');

            if (!this.ensurePythonScriptExists(pythonScriptPath)) {
                resolve({ success: false, error: `Python script not found: ${pythonScriptPath}` });
                return;
            }

            let tempDir: string | undefined;

            try {
                tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parquet-x-edit-'));
                const payloadPath = path.join(tempDir, 'edited-rows.json');
                fs.writeFileSync(payloadPath, JSON.stringify({ columns, rows }), 'utf8');

                const cleanup = () => {
                    if (tempDir) {
                        fs.rm(tempDir, { recursive: true, force: true }, () => undefined);
                    }
                };

                const resolveAndCleanup = (
                    result: ParquetDataResult | ParquetExportResult | ParquetEditSaveResult | ParquetCompareResult | ParquetCompareMetadataResult | ParquetSchemaDriftResult | ParquetDatasetAnalysisResult
                ) => {
                    cleanup();
                    resolve(result as ParquetEditSaveResult);
                };

                this.executePythonScriptWithArgs(
                    [pythonScriptPath, uri.fsPath, '--save-edits', outputUri.fsPath, payloadPath],
                    pythonPath,
                    resolveAndCleanup,
                    120000
                );
            } catch (error) {
                if (tempDir) {
                    fs.rm(tempDir, { recursive: true, force: true }, () => undefined);
                }
                resolve({
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
    }

    async createParquetFile(
        uri: vscode.Uri,
        outputUri: vscode.Uri,
        options: ParquetWriteOptions
    ): Promise<ParquetWriteResult> {
        const readyPython = await this.getReadyPythonPath();

        if (!readyPython.pythonPath) {
            return {
                success: false,
                error: readyPython.error
            };
        }
        const pythonPath = readyPython.pythonPath;

        return new Promise((resolve) => {
            const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_parquet.py');

            if (!this.ensurePythonScriptExists(pythonScriptPath)) {
                resolve({ success: false, error: `Python script not found: ${pythonScriptPath}` });
                return;
            }

            let tempDir: string | undefined;

            try {
                tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parquet-x-write-'));
                const payloadPath = path.join(tempDir, 'write-payload.json');
                fs.writeFileSync(payloadPath, JSON.stringify(options), 'utf8');

                const cleanup = () => {
                    if (tempDir) {
                        fs.rm(tempDir, { recursive: true, force: true }, () => undefined);
                    }
                };

                const resolveAndCleanup = (
                    result: ParquetDataResult | ParquetExportResult | ParquetEditSaveResult | ParquetCompareResult | ParquetCompareMetadataResult | ParquetJoinResult | ParquetSchemaDriftResult | ParquetDatasetAnalysisResult | ParquetWriteResult
                ) => {
                    cleanup();
                    resolve(result as ParquetWriteResult);
                };

                this.executePythonScriptWithArgs(
                    [pythonScriptPath, uri.fsPath, '--create-parquet', outputUri.fsPath, payloadPath],
                    pythonPath,
                    resolveAndCleanup,
                    120000
                );
            } catch (error) {
                if (tempDir) {
                    fs.rm(tempDir, { recursive: true, force: true }, () => undefined);
                }
                resolve({
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
    }

    async getParquetCompareMetadata(uri: vscode.Uri, compareUri: vscode.Uri): Promise<ParquetCompareMetadataResult> {
        const readyPython = await this.getReadyPythonPath();

        if (!readyPython.pythonPath) {
            return {
                success: false,
                error: readyPython.error
            };
        }
        const pythonPath = readyPython.pythonPath;

        return new Promise((resolve) => {
            const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_parquet.py');

            if (!this.ensurePythonScriptExists(pythonScriptPath)) {
                resolve({ success: false, error: `Python script not found: ${pythonScriptPath}` });
                return;
            }

            this.executePythonScriptWithArgs(
                [pythonScriptPath, uri.fsPath, '--compare-metadata', compareUri.fsPath],
                pythonPath,
                resolve,
                120000
            );
        });
    }

    async compareParquetFile(
        uri: vscode.Uri,
        compareUri: vscode.Uri,
        mappings?: ParquetCompareMapping[],
        orderMapping?: ParquetCompareOrderMapping
    ): Promise<ParquetCompareResult> {
        const readyPython = await this.getReadyPythonPath();

        if (!readyPython.pythonPath) {
            return {
                success: false,
                error: readyPython.error
            };
        }
        const pythonPath = readyPython.pythonPath;

        return new Promise((resolve) => {
            const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_parquet.py');

            if (!this.ensurePythonScriptExists(pythonScriptPath)) {
                resolve({ success: false, error: `Python script not found: ${pythonScriptPath}` });
                return;
            }

            const args = [pythonScriptPath, uri.fsPath, '--compare', compareUri.fsPath];
            if (mappings && mappings.length > 0) {
                args.push(JSON.stringify(mappings));
            } else {
                args.push('');
            }

            if (orderMapping) {
                args.push(JSON.stringify(orderMapping));
            }

            this.executePythonScriptWithArgs(
                args,
                pythonPath,
                resolve,
                120000
            );
        });
    }

    async smartDiffParquetFile(uri: vscode.Uri, compareUri: vscode.Uri): Promise<ParquetCompareResult> {
        const readyPython = await this.getReadyPythonPath();

        if (!readyPython.pythonPath) {
            return {
                success: false,
                error: readyPython.error
            };
        }
        const pythonPath = readyPython.pythonPath;

        return new Promise((resolve) => {
            const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_parquet.py');

            if (!this.ensurePythonScriptExists(pythonScriptPath)) {
                resolve({ success: false, error: `Python script not found: ${pythonScriptPath}` });
                return;
            }

            this.executePythonScriptWithArgs(
                [pythonScriptPath, uri.fsPath, '--smart-diff', compareUri.fsPath],
                pythonPath,
                resolve,
                120000
            );
        });
    }

    async joinParquetFile(uri: vscode.Uri, joinUri: vscode.Uri, options: ParquetJoinOptions): Promise<ParquetJoinResult> {
        const readyPython = await this.getReadyPythonPath();

        if (!readyPython.pythonPath) {
            return {
                success: false,
                error: readyPython.error
            };
        }
        const pythonPath = readyPython.pythonPath;

        return new Promise((resolve) => {
            const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_parquet.py');

            if (!this.ensurePythonScriptExists(pythonScriptPath)) {
                resolve({ success: false, error: `Python script not found: ${pythonScriptPath}` });
                return;
            }

            this.executePythonScriptWithArgs(
                [pythonScriptPath, uri.fsPath, '--join', joinUri.fsPath, JSON.stringify(options)],
                pythonPath,
                resolve,
                120000
            );
        });
    }

    async getJoinMetadata(uri: vscode.Uri, joinUri: vscode.Uri): Promise<ParquetJoinResult> {
        const readyPython = await this.getReadyPythonPath();

        if (!readyPython.pythonPath) {
            return {
                success: false,
                error: readyPython.error
            };
        }
        const pythonPath = readyPython.pythonPath;

        return new Promise((resolve) => {
            const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_parquet.py');

            if (!this.ensurePythonScriptExists(pythonScriptPath)) {
                resolve({ success: false, error: `Python script not found: ${pythonScriptPath}` });
                return;
            }

            this.executePythonScriptWithArgs(
                [pythonScriptPath, uri.fsPath, '--join-metadata', joinUri.fsPath],
                pythonPath,
                resolve,
                120000
            );
        });
    }

    async detectSchemaDrift(uri: vscode.Uri, referenceUri: vscode.Uri): Promise<ParquetSchemaDriftResult> {
        const readyPython = await this.getReadyPythonPath();

        if (!readyPython.pythonPath) {
            return {
                success: false,
                error: readyPython.error
            };
        }
        const pythonPath = readyPython.pythonPath;

        return new Promise((resolve) => {
            const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_parquet.py');

            if (!this.ensurePythonScriptExists(pythonScriptPath)) {
                resolve({ success: false, error: `Python script not found: ${pythonScriptPath}` });
                return;
            }

            this.executePythonScriptWithArgs(
                [pythonScriptPath, uri.fsPath, '--schema-drift', referenceUri.fsPath],
                pythonPath,
                resolve,
                120000
            );
        });
    }

    async scanParquetDataset(uri: vscode.Uri, folderUri: vscode.Uri): Promise<ParquetDatasetAnalysisResult> {
        const readyPython = await this.getReadyPythonPath();

        if (!readyPython.pythonPath) {
            return {
                success: false,
                error: readyPython.error
            };
        }
        const pythonPath = readyPython.pythonPath;

        return new Promise((resolve) => {
            const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_parquet.py');

            if (!this.ensurePythonScriptExists(pythonScriptPath)) {
                resolve({ success: false, error: `Python script not found: ${pythonScriptPath}` });
                return;
            }

            this.executePythonScriptWithArgs(
                [pythonScriptPath, uri.fsPath, '--dataset-scan', folderUri.fsPath],
                pythonPath,
                resolve,
                180000
            );
        });
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

    /**
     * Checks if a Python script exists at the given path.
     * If the script does not exist, a message is logged.
     * @param scriptPath The path to the Python script to check.
     * @returns True if the script exists, false otherwise.
     */
    private ensurePythonScriptExists(scriptPath: string): boolean {
        const exists = fs.existsSync(scriptPath);
        if (!exists) {
            this.logger.error('Python script not found', scriptPath);
        }
        return exists;
    }

    /**
     * Executes a Python script in the background to read a parquet file.
     * 
     * This function takes a path to a Python script, a path to the parquet
     * file to read, and the path to the Python executable as parameters.
     * It then executes the Python script with the given parameters in the
     * background and waits for the process to complete.
     * 
     * When the process completes, the result is passed to the given callback
     * function. The result is a ParquetDataResult which contains the
     * parsed parquet data and any errors that occurred during execution.
     * 
     * If the process takes longer than 30 seconds to complete, it is
     * terminated and an error is returned.
     * 
     * @param scriptPath The path to the Python script to execute.
     * @param filePath The path to the parquet file to read.
     * @param pythonPath The path to the Python executable.
     * @param resolve The callback function to call with the result of the
     *            Python script execution.
     */
    private executePythonScript(
        scriptPath: string,
        filePath: string,
        pythonPath: string,
        resolve: (result: ParquetDataResult) => void,
        query?: string
    ): void {
        const args = query && query.trim()
            ? [scriptPath, filePath, query]
            : [scriptPath, filePath];
        this.executePythonScriptWithArgs(args, pythonPath, resolve, 120000);
    }

    private executePythonScriptWithArgs(
        args: string[],
        pythonPath: string,
        resolve: (result: ParquetDataResult | ParquetExportResult | ParquetEditSaveResult | ParquetCompareResult | ParquetCompareMetadataResult | ParquetJoinResult | ParquetSchemaDriftResult | ParquetDatasetAnalysisResult | ParquetWriteResult) => void,
        timeoutMs: number
    ): void {
        const pythonProcess = spawn(pythonPath, args);
        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            this.logger.debug('Python STDOUT', data.toString());
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            this.logger.debug('Python STDERR', data.toString());
        });

        pythonProcess.on('close', (code, signal) => {
            this.handleProcessClose(code, signal, stdout, stderr, resolve);
        });

        pythonProcess.on('error', (error) => {
            this.logger.error('Failed to execute Python script', error);
            resolve({ success: false, error: `Failed to execute Python script: ${error.message}` });
        });

        this.setTimeoutHandler(pythonProcess, resolve, timeoutMs);
    }

    /**
     * Handles the process close event of the Python process.
     * If the process exits with success, the output of the process is
     * parsed as JSON and passed to the given callback function.
     * If the process exits with an error, or if the output cannot be
     * parsed as JSON, an error message is generated and passed to the
     * callback function.
     * @param code The exit code of the process.
     * @param signal The signal that terminated the process.
     * @param stdout The output of the process as a string.
     * @param stderr The error output of the process as a string.
     * @param resolve The callback function to call with the result of the
     *            process execution.
     */
    private handleProcessClose(
        code: number | null, 
        signal: NodeJS.Signals | null, 
        stdout: string, 
        stderr: string, 
        resolve: (result: ParquetDataResult | ParquetExportResult | ParquetEditSaveResult | ParquetCompareResult | ParquetCompareMetadataResult | ParquetJoinResult | ParquetSchemaDriftResult | ParquetDatasetAnalysisResult | ParquetWriteResult) => void
    ): void {
        this.logger.debug('Python process exited', { code, signal });
        
        try {
            if (stdout.trim()) {
                const result = JSON.parse(stdout);
                this.logger.debug('Parsed Python output', { success: result.success });
                resolve(result);
            } else {
                const errorMessage = signal 
                    ? `Process terminated by signal: ${signal}. STDERR: ${stderr}`
                    : `No output from Python. Exit code: ${code}. STDERR: ${stderr}`;
                
                this.logger.error('Python process returned no JSON output', errorMessage);
                resolve({ success: false, error: errorMessage });
            }
        } catch (error) {
            this.logger.error('Failed to parse Python output', error);
            resolve({ success: false, error: `Failed to parse Python output: ${error}. STDOUT: ${stdout}` });
        }
    }

    /**
     * Kills the given Python process after the configured timeout period and
     * resolves the given callback function with an error message indicating that
     * the operation timed out.
     * @param process The Python process to kill.
     * @param resolve The callback function to call with the result of the
     *            process execution.
     */
    private setTimeoutHandler(
        process: any,
        resolve: (result: ParquetDataResult | ParquetExportResult | ParquetEditSaveResult | ParquetCompareResult | ParquetCompareMetadataResult | ParquetJoinResult | ParquetSchemaDriftResult | ParquetDatasetAnalysisResult | ParquetWriteResult) => void,
        timeoutMs: number
    ): void {
        setTimeout(() => {
            process.kill();
            this.logger.warn('Python process timed out', { timeoutMs });
            resolve({ success: false, error: `Operation timed out after ${timeoutMs / 1000} seconds` });
        }, timeoutMs);
    }
}
