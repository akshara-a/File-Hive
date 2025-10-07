import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MESSAGES, VS_CODE_PYTHON_EXTENSION, WINDOWS_PLATFORM } from './common/constant';

interface PythonExtension {
    environments: {
        known: Array<{
            id: string;
            path: string;
            version?: { major: number; minor: number; micro: number };
        }>;
        getActive(): Promise<{ path: string } | undefined>;
    };
}

/**
 * Checks if a file or directory exists at the given path.
 * 
 * This function returns a promise that resolves to true if the file or
 * directory exists, and false otherwise. If an error occurs during the
 * check, the promise is rejected with the error.
 * 
 * @param path The path to the file or directory to check.
 * @returns A promise that resolves to true if the file or directory exists,
 *          false otherwise.
 */
const exists = async (path: string): Promise<boolean> => {
    try {
        await fs.promises.access(path);
        return true;
    } catch {
        return false;
    }
};

export class PythonEnvironmentManager {
    private systemPythonPath: string | null = null;
    private readonly venvPath: string;
    private venvPythonPath: string;
    private readonly outputChannel: vscode.OutputChannel;
    private readonly isWindows: boolean;
    private isInitialized: boolean = false;
    private initializationPromise: Promise<boolean> | null = null;

    /**
     * Constructs a new PythonEnvironmentManager.
     * 
     * @param context The VS Code extension context.
     */
    constructor(private readonly context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Parquet Viewer');
        this.isWindows = os.platform() === WINDOWS_PLATFORM;
        
        this.venvPath = path.join(
            this.context.extensionPath,
            '.parquet-venv'
        );
        
        this.venvPythonPath = this.isWindows
            ? path.join(this.venvPath, 'Scripts', 'python.exe')
            : path.join(this.venvPath, 'bin', 'python');
        
        // Validate state on startup
        this.validateState();
    }

    /**
     * Validates that the stored initialization state matches the actual environment state.
     * If the state says initialized but the venv doesn't exist, resets the state.
     */
    private async validateState(): Promise<void> {
        try {
            const storedState = this.context.globalState.get('parquetViewerInitialized');
            if (storedState && !(await exists(this.venvPythonPath))) {
                this.log('State mismatch detected: venv missing but marked as initialized');
                await this.context.globalState.update('parquetViewerInitialized', false);
                this.isInitialized = false;
            }
        } catch (error) {
            this.log(`State validation warning: ${error}`);
        }
    }

    /**
     * Initializes the isolated Python environment.
     * This function sets up the isolated Python environment which is used by the Parquet Viewer extension.
     * It creates a virtual environment at `.parquet-venv` in the extension directory and installs the required packages.
     * The function returns a promise that resolves to true if the initialization is successful, and false otherwise.
     * If the initialization is already in progress, the function returns the existing promise.
     * @returns A promise that resolves to true if the initialization is successful, and false otherwise.
     */
    public async initializeEnvironment(): Promise<boolean> {
        this.outputChannel.show(true);
        this.log('Starting environment initialization...');
        
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.doInitialize();
        const result = await this.initializationPromise;
        this.initializationPromise = null;
        return result;
    }

    
    /**
     * Initializes the isolated Python environment.
     * This function sets up the isolated Python environment which is used by the Parquet Viewer extension.
     * It creates a virtual environment at `.parquet-venv` in the extension directory and installs the required packages.
     * The function returns a promise that resolves to true if the initialization is successful, and false otherwise.
     * If the initialization is already in progress, the function returns the existing promise.
     * @returns A promise that resolves to true if the initialization is successful, and false otherwise.
     */
    private async doInitialize(): Promise<boolean> {
        if (this.isInitialized) {
            this.log('Environment ready');
            return true;
        }

        // Check existing venv
        if (await this.isVenvValid()) {
            this.log('Virtual environment ready');
            this.isInitialized = true;
            return true;
        }

        // Get Python from extension first
        this.systemPythonPath = await this.getPythonFromExtension();
        
        if (!this.systemPythonPath) {
            // If no Python from extension, try system Python
            this.systemPythonPath = await this.findSystemPython();
        }

        if (!this.systemPythonPath) {
            // Only prompt for Python extension if no Python found at all
            const pythonExt = vscode.extensions.getExtension(VS_CODE_PYTHON_EXTENSION);
            if (!pythonExt) {
                const installed = await this.promptForPythonExtension();
                if (!installed) {
                    return false;
                }
                // After installation, try again
                this.systemPythonPath = await this.getPythonFromExtension();
            } else {
                // Extension exists but no Python found - help user select one
                const configured = await this.promptForPythonSelection();
                if (configured) {
                    this.systemPythonPath = await this.getPythonFromExtension();
                }
            }
            
            if (!this.systemPythonPath) {
                vscode.window.showErrorMessage(MESSAGES.SYSTEM_PYTHON_PATH_NOT_AVAILABLE);
                return false;
            }
        }

        this.log(`Using Python: ${this.systemPythonPath}`);

        // Create venv
        const venvCreated = await this.createVirtualEnvironment();
        if (!venvCreated) {
            return false;
        }

        // Install DuckDB
        const installed = await this.installDuckDB();
        if (!installed) {
            return false;
        }

        // Verify
        const verified = await this.verifyDuckDB();
        if (verified) {
            this.isInitialized = true;
            this.log('Environment ready');
            await this.context.globalState.update('parquetViewerInitialized', true);
        }
        return verified;
    }

    /**
     * Checks if the virtual environment is valid by trying to import the DuckDB module.
     * If the virtual environment path does not exist, the function returns false.
     * If the import of the DuckDB module fails, the function returns false.
     * If the import is successful, the function returns true.
     * @returns A promise that resolves to true if the virtual environment is valid, false otherwise.
     */
    private async isVenvValid(): Promise<boolean> {
        if (!(await exists(this.venvPythonPath))) {
            return false;
        }

        try {
            await this.runCommand(this.venvPythonPath, [
                '-c',
                'import duckdb; print(duckdb.__version__)'
            ], 10000);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Creates a virtual environment using the given system Python path.
     * If the system Python path is null, the function returns false.
     * If the virtual environment already exists, it is cleaned before creation.
     * The virtual environment is created in the extension directory.
     * If the creation is successful, the function returns true, otherwise false.
     * @returns A promise that resolves to true if the virtual environment is created, false otherwise.
     */
    private async createVirtualEnvironment(): Promise<boolean> {
        const systemPythonPath = this.systemPythonPath;
        if (!systemPythonPath) {
            return false;
        }

        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Parquet Viewer - Creating Environment",
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Creating environment...' });
                
                // Clean old venv
                if (await exists(this.venvPath)) {
                    await fs.promises.rm(this.venvPath, { recursive: true, force: true });
                }

                // Create venv
                await this.runCommand(systemPythonPath, [
                    '-m', 'venv',
                    this.venvPath
                ], 120000);

                // Verify Python in venv
                if (!(await exists(this.venvPythonPath))) {
                    const altPythonPath = this.isWindows 
                        ? path.join(this.venvPath, 'Scripts', 'python.exe')
                        : path.join(this.venvPath, 'bin', 'python3');
                    
                    if (await exists(altPythonPath)) {
                        this.venvPythonPath = altPythonPath;
                    } else {
                        throw new Error('No Python in venv');
                    }
                }

                // Test venv Python
                await this.runCommand(this.venvPythonPath, [
                    '-c', 'import sys'
                ], 10000);

                this.log('Virtual environment created');
                return true;

            } catch (error) {
                this.log(`Failed to create venv: ${error}`);
                vscode.window.showErrorMessage(`Failed to create environment: ${error}`);
                return false;
            }
        });
    }

    /**
     * Installs DuckDB in the virtual environment.
     * If the virtual environment has not been created, this function will return false.
     * If the installation of DuckDB fails, this function will return false and log an error message.
     * The installation is performed with the --no-cache-dir and --quiet flags to avoid caching and suppress output.
     * @returns A promise that resolves to true if the installation of DuckDB is successful, false otherwise.
     */
    private async installDuckDB(): Promise<boolean> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Parquet Viewer - Installing DuckDB",
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Installing DuckDB...' });
                
                // Upgrade pip
                try {
                    await this.runCommand(this.venvPythonPath, [
                        '-m', 'pip', 'install', '--upgrade', 'pip', '--quiet'
                    ], 60000);
                } catch {
                    // Continue if pip upgrade fails
                }
                
                // Install DuckDB
                await this.runCommand(this.venvPythonPath, [
                    '-m', 'pip', 'install',
                    'duckdb',
                    '--no-cache-dir',
                    '--quiet'
                ], 120000);

                this.log('DuckDB installed');
                return true;
            } catch (error) {
                this.log(`Failed to install DuckDB: ${error}`);
                vscode.window.showErrorMessage(`Failed to install DuckDB: ${error}`);
                return false;
            }
        });
    }

    /**
     * Verifies that DuckDB is installed and ready to use.
     * This function runs a command to check the version of DuckDB installed in the virtual environment.
     * If the version of DuckDB is successfully retrieved, this function will return true and log a success message.
     * If the command fails, this function will return false and log an error message.
     * @returns A promise that resolves to true if the verification of DuckDB is successful, false otherwise.
     */
    private async verifyDuckDB(): Promise<boolean> {
        try {
            const version = await this.runCommand(this.venvPythonPath, [
                '-c',
                'import duckdb; print(duckdb.__version__)'
            ], 10000);

            this.log(`DuckDB ${version.trim()} ready`);
            return true;
        } catch (error) {
            this.log(`DuckDB verification failed: ${error}`);
            vscode.window.showErrorMessage(`DuckDB verification failed: ${error}`);
            return false;
        }
    }

    /**
     * Retrieves the path to the Python executable from the 'ms-python.python'
     * extension if available.
     * If the extension is not available, or the active environment is not Python 3.x
     * with the venv module, this function will return null.
     * @returns A promise that resolves to the path to the Python executable from the
     * 'ms-python.python' extension if available, or null otherwise.
     */
    private async getPythonFromExtension(): Promise<string | null> {
        try {
            const pythonExt = vscode.extensions.getExtension(VS_CODE_PYTHON_EXTENSION);
            
            if (!pythonExt) {
                return null;
            }

            // Activate extension if needed
            if (!pythonExt.isActive) {
                await pythonExt.activate();
                // Wait for activation
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const api = pythonExt.exports as PythonExtension;
            
            // Wait for environments to be ready
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const activeEnv = await api.environments.getActive();
            
            if (activeEnv?.path) {
                this.log(`Found Python from VS Code: ${activeEnv.path}`);
                
                // Verify it's Python 3 and has venv module
                try {
                    const version = await this.runCommand(activeEnv.path, [
                        '-c',
                        'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'
                    ], 5000);

                    if (!version.trim().startsWith('3.')) {
                        this.log('Python found but not version 3.x');
                        return null;
                    }

                    // Verify venv module is available
                    await this.runCommand(activeEnv.path, ['-c', 'import venv'], 5000);
                    this.log('Python 3.x with venv module found');
                    return activeEnv.path;

                } catch (error) {
                    this.log(`Python verification failed: ${error}`);
                    return null;
                }
            }

            this.log('No active Python environment found in VS Code');
            return null;

        } catch (error) {
            this.log(`Error getting Python from extension: ${error}`);
            return null;
        }
    }

    /**
     * Finds a system Python installation that has the venv module available.
     * This function will try to find the first Python executable in the system's PATH
     * that has the venv module available. If no such Python installation is found,
     * this function will return null.
     * @returns A promise that resolves to the path to the Python executable if found, or null otherwise.
     */
    private async findSystemPython(): Promise<string | null> {
        const commands = this.isWindows 
            ? ['python', 'python3', 'py -3', 'py'] 
            : ['python3', 'python'];
        
        for (const cmd of commands) {
            try {
                // Check version using a more reliable method
                const versionCheck = await this.runCommand(cmd, [
                    '-c',
                    'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")'
                ], 5000);

                const versionMatch = versionCheck.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
                if (!versionMatch) {
                    continue;
                }

                const major = parseInt(versionMatch[1]);
                if (major !== 3) {
                    this.log(`Found Python ${major}.x at ${cmd}, but need Python 3.x`);
                    continue;
                }

                this.log(`Found Python ${versionCheck.trim()} at ${cmd}`);

                // Verify venv module is available
                try {
                    await this.runCommand(cmd, ['-c', 'import venv'], 5000);
                    
                    // Get the full path to the Python executable
                    const fullPath = await this.runCommand(cmd, [
                        '-c',
                        'import sys; print(sys.executable)'
                    ], 5000);
                    
                    const pythonPath = fullPath.trim();
                    this.log(`Python executable path: ${pythonPath}`);
                    return pythonPath;

                } catch (error) {
                    this.log(`Python at ${cmd} missing venv module (install python3-venv on Debian/Ubuntu)`);
                    continue;
                }

            } catch (error) {
                // Command not found or failed to execute
                continue;
            }
        }
        
        this.log('No suitable system Python found');
        return null;
    }

    /**
     * Prompts the user to install the Python extension if it's not already installed.
     * If the user selects 'Install Python Extension', this function will execute the command to install the extension.
     * If the installation is successful, this function will show a message to reload VS Code to complete setup.
     * If the user selects 'Cancel', this function will return false.
     * @returns A promise that resolves to true if the user selects 'Install Python Extension', or false otherwise.
     */
    private async promptForPythonExtension(): Promise<boolean> {
        const choice = await vscode.window.showWarningMessage(
            'Parquet Viewer requires Python to create an isolated environment. Install Python extension?',
            'Install Python Extension',
            'Cancel'
        );

        if (choice === 'Install Python Extension') {
            try {
                await vscode.commands.executeCommand(
                    'workbench.extensions.installExtension',
                    'ms-python.python'
                );
                
                const reload = await vscode.window.showInformationMessage(
                    'Python extension installed. Reload VS Code to complete setup.',
                    'Reload Now'
                );
                
                if (reload === 'Reload Now') {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
                
                return true;
            } catch {
                vscode.window.showErrorMessage('Failed to install Python extension');
                return false;
            }
        }

        return false;
    }

    /**
     * Prompts the user to select a Python 3.x interpreter in VS Code for
     * the Parquet Viewer extension. If the user selects 'Select Python
     * Interpreter', this function will execute the command to set the
     * interpreter and return true. If the user selects 'Cancel', this
     * function will return false.
     * @returns A promise that resolves to true if the user selects 'Select
     * Python Interpreter', or false if the user selects 'Cancel'.
     */
    private async promptForPythonSelection(): Promise<boolean> {
        const choice = await vscode.window.showWarningMessage(
            'Please select a Python 3.x interpreter in VS Code for Parquet Viewer.',
            'Select Python Interpreter',
            'Cancel'
        );

        if (choice === 'Select Python Interpreter') {
            await vscode.commands.executeCommand('python.setInterpreter');
            return true;
        }

        return false;
    }

    /**
     * Runs a command with the given arguments and returns the output as a string.
     * If the command does not complete within the given timeout, the process will be terminated and an error will be returned.
     * @param command The command to run.
     * @param args The arguments to pass to the command.
     * @param timeout The timeout in milliseconds. Defaults to 30000ms.
     * @returns A promise that resolves to the output of the command as a string, or rejects with an error if the command fails or times out.
     */
    private async runCommand(
        command: string, 
        args: string[], 
        timeout: number = 30000
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, {
                stdio: 'pipe',
                shell: false
            });

            let stdout = '';
            let stderr = '';
            let timeoutHandle: NodeJS.Timeout;

            timeoutHandle = setTimeout(() => {
                proc.kill();
                reject(new Error(`Timeout after ${timeout}ms`));
            }, timeout);

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                clearTimeout(timeoutHandle);
                
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(stderr || `Exit code: ${code}`));
                }
            });

            proc.on('error', (err) => {
                clearTimeout(timeoutHandle);
                reject(err);
            });
        });
    }

    /**
     * Logs a message to the output channel with a timestamp.
     * 
     * @param message The message to log.
     */
    private log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    /**
     * Returns the path to the Python executable in the isolated environment.
     * If the environment has not been initialized, an error is thrown.
     * @returns The path to the Python executable in the isolated environment.
     * @throws {Error} If the environment has not been initialized.
     */
    public getPythonPath(): string {
        if (!this.isInitialized) {
            throw new Error('Environment not initialized yet.');
        }
        return this.venvPythonPath;
    }

    /**
     * Ensures that the environment is initialized.
     * If the environment has not been initialized, this function will initialize it.
     * If the environment initialization fails, an error is thrown.
     * @returns A promise that resolves when the environment has been initialized.
     * @throws {Error} If the environment initialization fails.
     */
    public async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            const initialized = await this.initializeEnvironment();
            if (!initialized) {
                throw new Error('Failed to initialize environment');
            }
        }
    }

    /**
     * Returns true if the isolated Python environment has been initialized and is ready to use,
     * false otherwise.
     * @returns True if the environment is ready, false otherwise.
     */
    public isEnvironmentReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Shows the output channel for the environment.
     * This is useful for debugging environment initialization issues.
     */
    public showOutputChannel(): void {
        this.outputChannel.show(true);
    }

    /**
     * Resets the isolated Python environment.
     * This function will delete the virtual environment directory and all its contents,
     * and then re-initialize the environment.
     * 
     * This function is useful for debugging environment initialization issues or if the
     * environment becomes corrupted.
     * 
     * @returns A promise that resolves to true if the environment was successfully reset,
     * false otherwise.
     */
    public async resetEnvironment(): Promise<boolean> {
        this.log('Resetting environment...');
        this.isInitialized = false;
        
        try {
            if (await exists(this.venvPath)) {
                await fs.promises.rm(this.venvPath, { recursive: true, force: true });
            }
            
            await this.context.globalState.update('parquetViewerInitialized', false);
        } catch (error) {
            this.log(`Cleanup warning: ${error}`);
        }
        
        return await this.initializeEnvironment();
    }

    /**
     * Retrieves information about the isolated Python environment.
     * If the environment has not been initialized, the function will return 'Environment not initialized'.
     * If the environment information is unavailable due to an error, the function will return 'Environment info unavailable'.
     * @returns A promise that resolves to a string containing information about the isolated Python environment.
     */
    public async getEnvironmentInfo(): Promise<string> {
        if (!this.isInitialized) {
            return 'Environment not initialized';
        }

        try {
            const info = await this.runCommand(this.venvPythonPath, [
                '-c',
                `import sys, platform
                try:
                    import duckdb
                    duckdb_info = f"duckdb {duckdb.__version__}"
                except:
                    duckdb_info = "duckdb NOT AVAILABLE"
                    
                import json
                print(json.dumps({
                    "python": sys.version.split()[0],
                    "platform": platform.platform(),
                    "duckdb": duckdb_info,
                    "venv": sys.prefix
                }))`
            ], 10000);

            const parsed = JSON.parse(info);
            return `Python ${parsed.python} | ${parsed.duckdb}`;
        } catch {
            return 'Environment info unavailable';
        }
    }

    /**
     * Returns the path to the system Python executable, if one was found.
     * If no system Python executable was found, null is returned.
     * @returns The path to the system Python executable, if one was found, null otherwise.
     */
    public getSystemPythonPath(): string | null {
        return this.systemPythonPath;
    }
}