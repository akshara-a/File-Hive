import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import {
    IParquetReader,
    ParquetCompareResult,
    ParquetDataResult,
    ParquetExportFormat,
    ParquetExportResult
} from '../interfaces/IParquetReader';

export class PythonParquetReader implements IParquetReader {
    constructor(
        private readonly pythonManager: { getPythonPath(): string | null },
        private readonly context: vscode.ExtensionContext
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
        const pythonPath = this.pythonManager.getPythonPath();

        // Handle the null case
        if (!pythonPath) {
            return { 
                success: false, 
                error: 'Python environment not configured. Please initialize Python environment first.' 
            };
        }

        console.log(`[PythonParquetReader] Reading parquet file: ${uri.fsPath}`);
        
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
        const pythonPath = this.pythonManager.getPythonPath();

        if (!pythonPath) {
            return {
                success: false,
                error: 'Python environment not configured. Please initialize Python environment first.'
            };
        }

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

    async compareParquetFile(uri: vscode.Uri, compareUri: vscode.Uri): Promise<ParquetCompareResult> {
        const pythonPath = this.pythonManager.getPythonPath();

        if (!pythonPath) {
            return {
                success: false,
                error: 'Python environment not configured. Please initialize Python environment first.'
            };
        }

        return new Promise((resolve) => {
            const pythonScriptPath = path.join(this.context.extensionPath, 'out', 'read_parquet.py');

            if (!this.ensurePythonScriptExists(pythonScriptPath)) {
                resolve({ success: false, error: `Python script not found: ${pythonScriptPath}` });
                return;
            }

            this.executePythonScriptWithArgs(
                [pythonScriptPath, uri.fsPath, '--compare', compareUri.fsPath],
                pythonPath,
                resolve,
                120000
            );
        });
    }

    /**
     * Checks if a Python script exists at the given path.
     * If the script does not exist, a message is logged to the console.
     * @param scriptPath The path to the Python script to check.
     * @returns True if the script exists, false otherwise.
     */
    private ensurePythonScriptExists(scriptPath: string): boolean {
        const exists = fs.existsSync(scriptPath);
        if (!exists) {
            console.log(`[PythonParquetReader] Python script not found at: ${scriptPath}`);
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
        this.executePythonScriptWithArgs(args, pythonPath, resolve, 30000);
    }

    private executePythonScriptWithArgs(
        args: string[],
        pythonPath: string,
        resolve: (result: ParquetDataResult | ParquetExportResult | ParquetCompareResult) => void,
        timeoutMs: number
    ): void {
        const pythonProcess = spawn(pythonPath, args);
        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log(`[PythonParquetReader] Python STDOUT: ${data.toString()}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log(`[PythonParquetReader] Python STDERR: ${data.toString()}`);
        });

        pythonProcess.on('close', (code, signal) => {
            this.handleProcessClose(code, signal, stdout, stderr, resolve);
        });

        pythonProcess.on('error', (error) => {
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
        resolve: (result: ParquetDataResult | ParquetExportResult | ParquetCompareResult) => void
    ): void {
        console.log(`[PythonParquetReader] Python process exited with code: ${code}, signal: ${signal}`);
        
        try {
            if (stdout.trim()) {
                const result = JSON.parse(stdout);
                console.log(`[PythonParquetReader] Parse successful. Success: ${result.success}`);
                resolve(result);
            } else {
                const errorMessage = signal 
                    ? `Process terminated by signal: ${signal}. STDERR: ${stderr}`
                    : `No output from Python. Exit code: ${code}. STDERR: ${stderr}`;
                
                resolve({ success: false, error: errorMessage });
            }
        } catch (error) {
            resolve({ success: false, error: `Failed to parse Python output: ${error}. STDOUT: ${stdout}` });
        }
    }

    /**
     * Kills the given Python process after a timeout period of 30 seconds and
     * resolves the given callback function with an error message indicating that
     * the operation timed out.
     * @param process The Python process to kill.
     * @param resolve The callback function to call with the result of the
     *            process execution.
     */
    private setTimeoutHandler(
        process: any,
        resolve: (result: ParquetDataResult | ParquetExportResult | ParquetCompareResult) => void,
        timeoutMs: number
    ): void {
        setTimeout(() => {
            process.kill();
            console.log(`[PythonParquetReader] Python process timed out after ${timeoutMs}ms`);
            resolve({ success: false, error: `Operation timed out after ${timeoutMs / 1000} seconds` });
        }, timeoutMs);
    }
}
