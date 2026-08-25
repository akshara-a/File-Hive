import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MESSAGES, REGISTER_COMMANDS, VS_CODE_PYTHON_EXTENSION, WINDOWS_PLATFORM } from './common/constant';
import { LoggingService } from './services/LoggingService';

interface PythonExtension {
    environments: {
        known: Array<{
            id: string;
            path: string;
            version?: { major: number; minor: number; micro: number };
        }>;
        getActive?(): Promise<{ path: string } | undefined>;
        getActiveEnvironmentPath?(): string | { path: string };
    };
    settings?: {
        getExecutionCommand?(): { command?: string };
        getInterpreterPath?(): string;
    };
    getActiveEnvironmentPath?(): Promise<string | { path: string }>;
}

interface InitializeEnvironmentOptions {
    allowPrompts?: boolean;
    showProgress?: boolean;
    progress?: vscode.Progress<SetupProgress>;
}

type SetupProgress = {
    message?: string;
    increment?: number;
};

type ResolvedInitializeEnvironmentOptions = {
    allowPrompts: boolean;
    showProgress: boolean;
    progress?: vscode.Progress<SetupProgress>;
};

const INITIALIZED_STATE_KEY = 'fileHiveInitialized';

/**
 * Checks if a file or directory exists at the given path.
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
    private readonly isWindows: boolean;
    private isInitialized: boolean = false;
    private initializationPromise: Promise<boolean> | null = null;
    private initializationAllowsPrompts: boolean = true;
    private uvCommand: string | null | undefined;
    private readonly setupStatusBarItem: vscode.StatusBarItem;
    private setupStatusDepth: number = 0;
    private setupStatusHideTimer: NodeJS.Timeout | null = null;
    private readonly stateValidationPromise: Promise<void>;
    private dataDependenciesVerified = false;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly logger: LoggingService
    ) {
        this.isWindows = os.platform() === WINDOWS_PLATFORM;
        
        this.venvPath = path.join(
            this.context.globalStorageUri.fsPath,
            '.parquet-venv'
        );
        
        this.venvPythonPath = this.isWindows
            ? path.join(this.venvPath, 'Scripts', 'python.exe')
            : path.join(this.venvPath, 'bin', 'python');

        this.setupStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.setupStatusBarItem.name = 'File Hive Setup';
        this.setupStatusBarItem.command = REGISTER_COMMANDS.SHOW_LOGS;
        this.setupStatusBarItem.hide();
        this.context.subscriptions.push(this.setupStatusBarItem);
        
        this.stateValidationPromise = this.validateState();
    }

    private async validateState(): Promise<void> {
        try {
            const storedState = this.context.globalState.get(INITIALIZED_STATE_KEY);
            if (storedState && !(await exists(this.venvPythonPath))) {
                this.log('State mismatch detected: venv missing but marked as initialized');
                await this.context.globalState.update(INITIALIZED_STATE_KEY, false);
                this.isInitialized = false;
            }
        } catch (error) {
            this.log(`State validation warning: ${error}`);
        }
    }

    public async initializeEnvironment(options: InitializeEnvironmentOptions = {}): Promise<boolean> {
        await this.stateValidationPromise;
        this.log('Starting environment initialization...');

        const effectiveOptions: ResolvedInitializeEnvironmentOptions = {
            allowPrompts: options.allowPrompts ?? true,
            showProgress: options.showProgress ?? true,
            progress: options.progress
        };

        if (this.initializationPromise) {
            const result = await this.initializationPromise;
            if (!result && effectiveOptions.allowPrompts && !this.initializationAllowsPrompts) {
                return this.initializeEnvironment(effectiveOptions);
            }

            return result;
        }

        this.initializationAllowsPrompts = effectiveOptions.allowPrompts;
        this.initializationPromise = this.withSetupProgress(effectiveOptions, (progress) => {
            return this.doInitialize({
                ...effectiveOptions,
                progress
            });
        });

        try {
            return await this.initializationPromise;
        } finally {
            this.initializationPromise = null;
            this.initializationAllowsPrompts = true;
        }
    }

    private async doInitialize(options: ResolvedInitializeEnvironmentOptions): Promise<boolean> {
        if (this.isInitialized) {
            this.log('Environment ready');
            this.reportSetupProgress(options, 'Python environment is already ready.', 100);
            return true;
        }

        this.reportSetupProgress(options, 'Checking existing Python environment...', 10);
        if (await this.isVenvValid()) {
            this.log('Virtual environment ready');
            this.isInitialized = true;
            this.dataDependenciesVerified = true;
            this.reportSetupProgress(options, 'Existing Python environment is ready.', 90);
            return true;
        }

        if (await exists(this.venvPythonPath)) {
            this.reportSetupProgress(options, 'Installing missing data dependencies...', 10);
            const installed = await this.installDataPackages(options);
            if (!installed) {
                return false;
            }

            this.reportSetupProgress(options, 'Verifying repaired environment...', 10);
            const repaired = await this.verifyDataPackages();
            if (repaired) {
                this.isInitialized = true;
                this.dataDependenciesVerified = true;
                await this.context.globalState.update(INITIALIZED_STATE_KEY, true);
                this.reportSetupProgress(options, 'Existing Python environment repaired.', 80);
            }
            return repaired;
        }

        this.reportSetupProgress(options, 'Looking for a Python interpreter...', 10);
        this.systemPythonPath = await this.getPythonFromExtension();
        
        if (!this.systemPythonPath) {
            this.systemPythonPath = await this.findSystemPython();
        }

        if (!this.systemPythonPath) {
            const pythonExt = vscode.extensions.getExtension(VS_CODE_PYTHON_EXTENSION);
            if (!options.allowPrompts) {
                this.log('Python path not found; prompts are disabled');
                return false;
            }

            if (!pythonExt) {
                const installed = await this.promptForPythonExtension();
                if (!installed) {
                    return false;
                }
                this.systemPythonPath = await this.getPythonFromExtension();
            } else {
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
        this.reportSetupProgress(options, `Using Python: ${this.systemPythonPath}`, 10);

        const venvCreated = await this.createVirtualEnvironment(options);
        if (!venvCreated) {
            return false;
        }

        const installed = await this.installDataPackages(options);
        if (!installed) {
            return false;
        }

        this.reportSetupProgress(options, 'Verifying data dependencies...', 10);
        const verified = await this.verifyDataPackages();
        if (verified) {
            this.isInitialized = true;
            this.dataDependenciesVerified = true;
            this.log('Environment ready');
            await this.context.globalState.update(INITIALIZED_STATE_KEY, true);
            this.reportSetupProgress(options, 'Python environment is ready.', 20);
        }
        return verified;
    }

    private async isVenvValid(): Promise<boolean> {
        if (!(await exists(this.venvPythonPath))) {
            return false;
        }

        try {
            await this.runCommand(this.venvPythonPath, [
                '-c',
                'import duckdb, pyarrow; print(duckdb.__version__); print(pyarrow.__version__)'
            ], 10000);
            return true;
        } catch {
            return false;
        }
    }

    private async createVirtualEnvironment(options: ResolvedInitializeEnvironmentOptions): Promise<boolean> {
        const systemPythonPath = this.systemPythonPath;
        if (!systemPythonPath) {
            return false;
        }

        return this.withSetupProgress(options, async (progress) => {
            const progressOptions = {
                ...options,
                progress
            };

            try {
                this.reportSetupProgress(progressOptions, 'Creating isolated Python environment...', 20);
                
                if (await exists(this.venvPath)) {
                    this.reportSetupProgress(progressOptions, 'Removing stale environment...');
                    await this.removeVenvIfPresent();
                }

                await fs.promises.mkdir(path.dirname(this.venvPath), { recursive: true });

                const uvCommand = await this.getUvCommand(options);
                if (uvCommand) {
                    try {
                        this.reportSetupProgress(progressOptions, 'Creating environment with uv...');
                        await this.runCommand(uvCommand, [
                            'venv',
                            this.venvPath,
                            '--python',
                            systemPythonPath,
                            '--seed'
                        ], 120000);
                    } catch (error) {
                        this.log(`uv environment creation failed, falling back to python venv: ${error}`);
                        this.reportSetupProgress(progressOptions, 'uv setup failed. Falling back to Python venv...');
                        await this.removeVenvIfPresent();
                        await this.createVirtualEnvironmentWithPython(systemPythonPath);
                    }
                } else {
                    await this.createVirtualEnvironmentWithPython(systemPythonPath);
                }

                await this.resolveVenvPythonPath();

                await this.runCommand(this.venvPythonPath, [
                    '-c', 'import sys'
                ], 10000);

                this.log('Virtual environment created');
                this.reportSetupProgress(progressOptions, 'Python environment created.', 10);
                return true;

            } catch (error) {
                this.log(`Failed to create venv: ${error}`);
                vscode.window.showErrorMessage(`File Hive failed to create its Python environment: ${error}`);
                return false;
            }
        });
    }

    private async installDataPackages(options: ResolvedInitializeEnvironmentOptions): Promise<boolean> {
        return this.withSetupProgress(options, async (progress) => {
            const progressOptions = {
                ...options,
                progress
            };

            try {
                this.reportSetupProgress(progressOptions, 'Installing DuckDB and PyArrow. This only runs the first time...', 20);

                const uvCommand = await this.getUvCommand(options);
                if (uvCommand) {
                    try {
                        this.reportSetupProgress(progressOptions, 'Installing DuckDB and PyArrow with uv...', 5);
                        await this.runCommand(uvCommand, [
                            'pip',
                            'install',
                            '--python',
                            this.venvPythonPath,
                            '--only-binary',
                            ':all:',
                            'duckdb',
                            'pyarrow'
                        ], 120000);
                    } catch (error) {
                        this.log(`uv data package install failed, falling back to pip: ${error}`);
                        this.reportSetupProgress(progressOptions, 'uv install failed. Falling back to pip...');
                        await this.installDataPackagesWithPip();
                    }
                } else {
                    await this.installDataPackagesWithPip();
                }

                this.log('DuckDB and PyArrow installed');
                this.reportSetupProgress(progressOptions, 'DuckDB and PyArrow installed.', 10);
                return true;
            } catch (error) {
                this.log(`Failed to install data dependencies: ${error}`);
                vscode.window.showErrorMessage(`File Hive failed to install data dependencies: ${error}`);
                return false;
            }
        });
    }

    private async withSetupProgress<T>(
        options: ResolvedInitializeEnvironmentOptions,
        task: (progress: vscode.Progress<SetupProgress>) => Thenable<T>
    ): Promise<T> {
        const shouldShowStatus = options.showProgress || Boolean(options.progress);
        const isRootStatus = shouldShowStatus && this.setupStatusDepth === 0;

        if (shouldShowStatus) {
            this.setupStatusDepth += 1;
            if (isRootStatus) {
                this.showSetupStatus('Setting up Python environment...');
            }
        }

        try {
            let result: T;

            if (options.progress) {
                result = await task(options.progress);
            } else if (options.showProgress) {
                result = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "File Hive - Setting Up Python Environment",
                    cancellable: false
                }, task);
            } else {
                result = await task({ report: () => undefined });
            }

            if (isRootStatus) {
                this.finishSetupStatus(result !== false);
            }

            return result;
        } catch (error) {
            if (isRootStatus) {
                this.finishSetupStatus(false);
            }
            throw error;
        } finally {
            if (shouldShowStatus) {
                this.setupStatusDepth = Math.max(0, this.setupStatusDepth - 1);
            }
        }
    }

    private reportSetupProgress(
        options: ResolvedInitializeEnvironmentOptions,
        message: string,
        increment?: number
    ): void {
        this.log(`Setup progress: ${message}`);
        this.updateSetupStatus(message);
        options.progress?.report({ message, increment });
    }

    private showSetupStatus(message: string): void {
        if (this.setupStatusHideTimer) {
            clearTimeout(this.setupStatusHideTimer);
            this.setupStatusHideTimer = null;
        }

        this.setupStatusBarItem.text = '$(sync~spin) File Hive: Setting up';
        this.setupStatusBarItem.tooltip = message;
        this.setupStatusBarItem.command = REGISTER_COMMANDS.SHOW_LOGS;
        this.setupStatusBarItem.show();
    }

    private updateSetupStatus(message: string): void {
        if (this.setupStatusDepth === 0) {
            return;
        }

        this.setupStatusBarItem.tooltip = message;
        this.setupStatusBarItem.show();
    }

    private finishSetupStatus(success: boolean): void {
        this.setupStatusBarItem.text = success ? '$(check) File Hive: Ready' : '$(error) File Hive: Setup failed';
        this.setupStatusBarItem.tooltip = success
            ? 'File Hive Python environment is ready.'
            : 'File Hive Python environment setup failed. Click to show logs.';
        this.setupStatusBarItem.command = REGISTER_COMMANDS.SHOW_LOGS;
        this.setupStatusBarItem.show();

        this.setupStatusHideTimer = setTimeout(() => {
            this.setupStatusBarItem.hide();
            this.setupStatusHideTimer = null;
        }, 7000);
    }

    private async getUvCommand(options?: ResolvedInitializeEnvironmentOptions): Promise<string | null> {
        if (this.uvCommand !== undefined) {
            return this.uvCommand;
        }

        this.reportSetupProgressIfPresent(options, 'Checking for uv...');

        try {
            const version = await this.runCommand('uv', ['--version'], 5000);
            this.uvCommand = 'uv';
            this.log(`Using ${version.trim()} for Python environment setup`);
            this.reportSetupProgressIfPresent(options, `${version.trim()} available. Using uv for setup.`);
            return this.uvCommand;
        } catch (error) {
            this.uvCommand = null;
            this.log(`uv not available, falling back to Python/pip setup: ${error}`);
            this.reportSetupProgressIfPresent(options, 'uv not found. Falling back to Python/pip setup.');
            return null;
        }
    }

    private reportSetupProgressIfPresent(
        options: ResolvedInitializeEnvironmentOptions | undefined,
        message: string,
        increment?: number
    ): void {
        if (options) {
            this.reportSetupProgress(options, message, increment);
        }
    }

    private async removeVenvIfPresent(): Promise<void> {
        if (!(await exists(this.venvPath))) {
            return;
        }

        try {
            await fs.promises.rm(this.venvPath, {
                recursive: true,
                force: true,
                maxRetries: this.isWindows ? 5 : 2,
                retryDelay: 250
            });
            return;
        } catch (error) {
            this.log(`Could not remove virtual environment directly: ${error}`);
        }

        const stalePath = `${this.venvPath}.stale-${Date.now()}`;
        try {
            await fs.promises.rename(this.venvPath, stalePath);
            this.log(`Moved locked virtual environment aside: ${stalePath}`);
        } catch (renameError) {
            throw new Error(
                `Could not remove or rename the existing Python environment. Close any running File Hive viewers and retry. ${renameError}`
            );
        }

        try {
            await fs.promises.rm(stalePath, {
                recursive: true,
                force: true,
                maxRetries: this.isWindows ? 5 : 2,
                retryDelay: 250
            });
        } catch (cleanupError) {
            this.log(`Deferred cleanup needed for stale virtual environment ${stalePath}: ${cleanupError}`);
        }
    }

    private async createVirtualEnvironmentWithPython(systemPythonPath: string): Promise<void> {
        await this.runCommand(systemPythonPath, [
            '-m', 'venv',
            this.venvPath
        ], 120000);
    }

    private async resolveVenvPythonPath(): Promise<void> {
        if (await exists(this.venvPythonPath)) {
            return;
        }

        const altPythonPath = this.isWindows 
            ? path.join(this.venvPath, 'Scripts', 'python.exe')
            : path.join(this.venvPath, 'bin', 'python3');
        
        if (await exists(altPythonPath)) {
            this.venvPythonPath = altPythonPath;
            return;
        }

        throw new Error('No Python in venv');
    }

    private async installDataPackagesWithPip(): Promise<void> {
        await this.runCommand(this.venvPythonPath, [
            '-m', 'pip', 'install',
            '--disable-pip-version-check',
            '--only-binary=:all:',
            'duckdb',
            'pyarrow',
            '--quiet'
        ], 120000);
    }

    private async verifyDataPackages(): Promise<boolean> {
        try {
            const versionInfo = await this.runCommand(this.venvPythonPath, [
                '-c',
                'import duckdb, pyarrow; print(f"duckdb {duckdb.__version__} | pyarrow {pyarrow.__version__}")'
            ], 10000);

            this.log(`${versionInfo.trim()} ready`);
            return true;
        } catch (error) {
            this.log(`Data dependency verification failed: ${error}`);
            vscode.window.showErrorMessage(`Data dependency verification failed: ${error}`);
            return false;
        }
    }

    private async getPythonFromExtension(): Promise<string | null> {
        try {
            const pythonExt = vscode.extensions.getExtension(VS_CODE_PYTHON_EXTENSION);
            
            if (!pythonExt) {
                return null;
            }

            if (!pythonExt.isActive) {
                await pythonExt.activate();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const api = pythonExt.exports as any;
            if (!api) {
                this.log('Python extension API not available');
                return null;
            }

            let pythonPath: string | undefined | null;

            if (typeof api.getActiveEnvironmentPath === 'function') {
                try {
                    const envPath = await api.getActiveEnvironmentPath();
                    pythonPath = typeof envPath === 'string' ? envPath : envPath?.path;
                    if (pythonPath && pythonPath.trim()) {
                        this.log(`Found Python via getActiveEnvironmentPath: ${pythonPath}`);
                    }
                } catch (error) {
                    this.log(`getActiveEnvironmentPath failed: ${error}`);
                }
            }

            if (!pythonPath && api.settings) {
                try {
                    if (typeof api.settings.getExecutionCommand === 'function') {
                        const executionCommand = api.settings.getExecutionCommand();
                        pythonPath = executionCommand?.command;
                        if (pythonPath) {
                            this.log(`Found Python via getExecutionCommand: ${pythonPath}`);
                        }
                    }
                    
                    if (!pythonPath && typeof api.settings.getInterpreterPath === 'function') {
                        pythonPath = api.settings.getInterpreterPath();
                        if (pythonPath) {
                            this.log(`Found Python via getInterpreterPath: ${pythonPath}`);
                        }
                    }
                } catch (error) {
                    this.log(`Settings method failed: ${error}`);
                }
            }

            if (!pythonPath && api.environments) {
                try {
                    if (typeof api.environments.getActive === 'function') {
                        const activeEnv = await api.environments.getActive();
                        pythonPath = activeEnv?.path;
                        if (pythonPath) {
                            this.log(`Found Python via environments.getActive: ${pythonPath}`);
                        }
                    }
                    
                    if (!pythonPath && api.environments.known && Array.isArray(api.environments.known)) {
                        const availableEnv = api.environments.known.find((env: { path: any; }) => 
                            env.path && typeof env.path === 'string'
                        );
                        
                        if (availableEnv?.path) {
                            pythonPath = availableEnv.path;
                            this.log(`Found Python via known environments: ${pythonPath}`);
                        }
                    }
                } catch (error) {
                    this.log(`Environments API failed: ${error}`);
                }
            }

            if (!pythonPath) {
                pythonPath = await this.getPythonFromCommand();
            }

            if (!pythonPath) {
                try {
                    const config = vscode.workspace.getConfiguration('python');
                    pythonPath = config.get<string>('defaultInterpreterPath');
                    if (pythonPath) {
                        this.log(`Found Python via workspace config: ${pythonPath}`);
                    }
                } catch (error) {
                    this.log(`Workspace config method failed: ${error}`);
                }
            }

            if (!pythonPath) {
                this.log('No Python path found from extension');
                return null;
            }

            return await this.verifyPythonInstallation(pythonPath);

        } catch (error) {
            this.log(`Error getting Python from extension: ${error}`);
            return null;
        }
    }

    private async getPythonFromCommand(): Promise<string | null> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            this.debug('Skipping Python interpreter command lookup because no workspace is open');
            return null;
        }

        try {
            const pythonPath = await vscode.commands.executeCommand('python.interpreterPath') as string;
            
            if (pythonPath && pythonPath.trim() && pythonPath !== 'python') {
                this.log(`Found Python via command: ${pythonPath}`);
                return pythonPath.trim();
            }
            
            return null;
        } catch (error) {
            this.debug(`Python interpreter command lookup failed: ${error}`);
            return null;
        }
    }

    private async findSystemPython(): Promise<string | null> {
        const commands = this.isWindows 
            ? ['python', 'python3', 'py -3', 'py'] 
            : ['python3', 'python'];
        
        for (const cmd of commands) {
            try {
                if (this.isWindows && (cmd === 'python' || cmd === 'python3')) {
                    const actualPath = await this.findWindowsPythonPath();
                    if (actualPath) {
                        this.log(`Found Windows Python at: ${actualPath}`);
                        return actualPath;
                    }
                }

                const versionCheck = await this.runCommand(cmd, [
                    '-c',
                    'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'
                ], 5000);

                const versionMatch = versionCheck.trim().match(/^(\d+)\.(\d+)$/);
                if (!versionMatch) {
                    continue;
                }

                const major = parseInt(versionMatch[1]);
                const minor = parseInt(versionMatch[2]);
                
                if (major !== 3) {
                    this.log(`Found Python ${major}.x at ${cmd}, but need Python 3.x`);
                    continue;
                }

                // Check if version is 3.14 or higher
                if (minor > 13) {
                    this.log(`Found Python ${versionCheck.trim()} at ${cmd}, but maximum supported version is 3.13`);
                    continue;
                }

                this.log(`Found Python ${versionCheck.trim()} at ${cmd}`);

                try {
                    await this.runCommand(cmd, ['-c', 'import venv'], 5000);
                    
                    const fullPath = await this.runCommand(cmd, [
                        '-c',
                        'import sys; print(sys.executable)'
                    ], 5000);
                    
                    const pythonPath = fullPath.trim();
                    this.log(`Python executable path: ${pythonPath}`);
                    return pythonPath;

                } catch (error) {
                    this.log(`Python at ${cmd} missing venv module: ${error}`);
                    continue;
                }

            } catch (error) {
                this.log(`Command ${cmd} failed: ${error}`);
                continue;
            }
        }
        
        if (this.isWindows) {
            return await this.findWindowsPythonPath();
        }
        
        this.log('No suitable system Python found (Python 3.13 or earlier required)');
        return null;
    }

    private async findWindowsPythonPath(): Promise<string | null> {
    try {
        // Try py -3 first (usually gives latest Python 3)
        try {
            const pyOutput = await this.runCommand('py', ['-3', '-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'], 5000);
            const versionStr = pyOutput.trim();
            const [major, minor] = versionStr.split('.').map(Number);
            
            if (major === 3 && minor <= 13) {
                const pythonPath = await this.runCommand('py', ['-3', '-c', 'import sys; print(sys.executable)'], 5000);
                const verifiedPath = pythonPath.trim();
                if (verifiedPath && await exists(verifiedPath)) {
                    this.log(`Found Python ${versionStr} via 'py -3': ${verifiedPath}`);
                    return verifiedPath;
                }
            } else {
                this.log(`Python ${versionStr} via 'py -3' is too new, need 3.13 or earlier`);
            }
        } catch (error) {
            this.log(`'py -3' command failed: ${error}`);
        }

        // Try specific Python 3 versions from highest to lowest (3.13 down to 3.0)
        const supportedVersions = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
        
        for (const minor of supportedVersions) {
            try {
                const versionCheck = await this.runCommand('py', [`-3.${minor}`, '-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'], 5000);
                const versionStr = versionCheck.trim();
                
                if (versionStr === `3.${minor}`) {
                    const pythonPath = await this.runCommand('py', [`-3.${minor}`, '-c', 'import sys; print(sys.executable)'], 5000);
                    const verifiedPath = pythonPath.trim();
                    if (verifiedPath && await exists(verifiedPath)) {
                        this.log(`Found Python ${versionStr} via 'py -3.${minor}': ${verifiedPath}`);
                        return verifiedPath;
                    }
                }
            } catch (error) {
                continue;
            }
        }

        const commonPaths = [
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python'),
            path.join(process.env.ProgramFiles || '', 'Python'),
            path.join(process.env.ProgramFiles || '', 'Python*'),
            path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Python'),
            path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Python*')
        ];

        for (const basePath of commonPaths) {
            try {
                if (basePath.includes('*')) {
                    const parentDir = path.dirname(basePath);
                    const pattern = path.basename(basePath);
                    
                    if (await exists(parentDir)) {
                        const entries = await fs.promises.readdir(parentDir);
                        const pythonDirs = entries.filter(entry => 
                            entry.startsWith('Python')
                        ).sort().reverse();
                        
                        for (const dir of pythonDirs) {
                            const pythonExe = path.join(parentDir, dir, 'python.exe');
                            if (await exists(pythonExe)) {
                                this.log(`Found Python in common location: ${pythonExe}`);
                                const verified = await this.verifyPythonInstallation(pythonExe);
                                if (verified) {
                                    return verified;
                                }
                            }
                        }
                    }
                } else if (await exists(basePath)) {
                    const entries = await fs.promises.readdir(basePath);
                    for (const entry of entries) {
                        const pythonExe = path.join(basePath, entry, 'python.exe');
                        if (await exists(pythonExe)) {
                            this.log(`Found Python in common location: ${pythonExe}`);
                            const verified = await this.verifyPythonInstallation(pythonExe);
                            if (verified) {
                                return verified;
                            }
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }

        return null;
    } catch (error) {
        this.log(`Windows Python discovery failed: ${error}`);
        return null;
    }
}

    private async verifyPythonInstallation(pythonPath: string): Promise<string | null> {
    try {
        if (!(await exists(pythonPath))) {
            this.log(`Python path does not exist: ${pythonPath}`);
            return null;
        }

        const version = await this.runCommand(pythonPath, [
            '-c',
            'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'
        ], 5000);

        const versionStr = version.trim();
        if (!versionStr.startsWith('3.')) {
            this.log(`Python found but not version 3.x (found ${versionStr})`);
            return null;
        }

        // Parse version components
        const [major, minor] = versionStr.split('.').map(Number);
        
        // Restrict to Python 3.13 and below (3.0 - 3.13)
        if (major === 3 && minor > 13) {
            this.log(`Python ${versionStr} is too new. Maximum supported version is 3.13`);
            return null;
        }

        await this.runCommand(pythonPath, ['-c', 'import venv'], 5000);
        this.log(`Python ${versionStr} with venv module found at: ${pythonPath}`);
        return pythonPath;

    } catch (error: any) {
        this.log(`Python verification failed for ${pythonPath}: ${error}`);
        
        if (this.isWindows && error.toString().includes('Microsoft Store')) {
            this.log('Microsoft Store Python alias detected. Please install Python from python.org');
        }
        
        return null;
    }
}

    private async promptUserForPythonInterpreter(): Promise<string | null> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                const choice = await vscode.window.showWarningMessage(
                    'Please open a folder or workspace to select a Python interpreter, or use system Python.',
                    'Open Folder',
                    'Use System Python',
                    'Cancel'
                );

                if (choice === 'Open Folder') {
                    await vscode.commands.executeCommand('workbench.action.files.openFolder');
                    return null;
                } else if (choice === 'Use System Python') {
                    return await this.findSystemPython();
                }
                return null;
            }

            await vscode.commands.executeCommand('python.setInterpreter');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            for (let attempt = 0; attempt < 3; attempt++) {
                const pythonPath = await this.getPythonFromExtension();
                if (pythonPath) {
                    return pythonPath;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            return null;
        } catch (error) {
            this.log(`Failed to prompt for Python interpreter: ${error}`);
            return null;
        }
    }

    private async promptForPythonExtension(): Promise<boolean> {
        const choice = await vscode.window.showWarningMessage(
            'File Hive requires Python to create an isolated environment. Install Python extension?',
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

    private async promptForPythonSelection(): Promise<boolean> {
        const choice = await vscode.window.showWarningMessage(
            'Please select a Python 3.x interpreter (version 3.13 or earlier) in VS Code for File Hive.',
            'Select Python Interpreter',
            'Cancel'
        );

        if (choice === 'Select Python Interpreter') {
            const pythonPath = await this.promptUserForPythonInterpreter();
            return pythonPath !== null;
        }

        return false;
    }

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

    private log(message: string): void {
        this.logger.info(message);
    }

    private debug(message: string): void {
        this.logger.debug(message);
    }

    public getPythonPath(): string {
        if (!this.isInitialized) {
            throw new Error('Environment not initialized yet.');
        }
        return this.venvPythonPath;
    }

    public async ensureInitialized(): Promise<void> {
        if (this.isInitialized && !this.dataDependenciesVerified) {
            if (await this.isVenvValid()) {
                this.dataDependenciesVerified = true;
            } else {
                this.isInitialized = false;
                await this.context.globalState.update(INITIALIZED_STATE_KEY, false);
            }
        }

        if (!this.isInitialized) {
            const initialized = await this.initializeEnvironment();
            if (!initialized) {
                throw new Error('Failed to initialize environment');
            }
        }
    }

    public isEnvironmentReady(): boolean {
        return this.isInitialized;
    }

    public showOutputChannel(): void {
        this.logger.show(true);
    }

    public async resetEnvironment(options: InitializeEnvironmentOptions = {}): Promise<boolean> {
        const resetProgressOptions: ResolvedInitializeEnvironmentOptions = {
            allowPrompts: options.allowPrompts ?? true,
            showProgress: options.showProgress ?? true,
            progress: options.progress
        };

        return this.withSetupProgress(resetProgressOptions, async (progress) => {
            const progressOptions = {
                ...resetProgressOptions,
                progress
            };

            this.log('Resetting environment...');
            this.isInitialized = false;
            this.reportSetupProgress(progressOptions, 'Resetting existing Python environment...', 5);

            try {
                if (await exists(this.venvPath)) {
                    await this.removeVenvIfPresent();
                }
                
                await this.context.globalState.update(INITIALIZED_STATE_KEY, false);
                this.reportSetupProgress(progressOptions, 'Environment reset. Rebuilding dependencies...', 10);
            } catch (error) {
                this.log(`Cleanup warning: ${error}`);
            }
            
            return await this.initializeEnvironment(progressOptions);
        });
    }

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
                try:
                    import pyarrow
                    pyarrow_info = f"pyarrow {pyarrow.__version__}"
                except:
                    pyarrow_info = "pyarrow NOT AVAILABLE"
                import json
                print(json.dumps({
                    "python": sys.version.split()[0],
                    "platform": platform.platform(),
                    "duckdb": duckdb_info,
                    "pyarrow": pyarrow_info,
                    "venv": sys.prefix
                }))`
            ], 10000);

            const parsed = JSON.parse(info);
            return `Python ${parsed.python} | ${parsed.duckdb} | ${parsed.pyarrow}`;
        } catch {
            return 'Environment info unavailable';
        }
    }

    public async getEnvironmentDiagnostics(): Promise<string> {
        await this.stateValidationPromise;

        const storedState = this.context.globalState.get<boolean>(INITIALIZED_STATE_KEY) === true;
        const venvExists = await exists(this.venvPath);
        const venvPythonExists = await exists(this.venvPythonPath);
        const pythonExtension = vscode.extensions.getExtension(VS_CODE_PYTHON_EXTENSION);
        const uvCommand = await this.getUvCommand();
        const uvInfo = uvCommand
            ? (await this.runCommand(uvCommand, ['--version'], 5000)).trim()
            : 'Not found on PATH';

        let runtimeInfo = 'Not available';
        if (venvPythonExists) {
            try {
                const info = await this.runCommand(this.venvPythonPath, [
                    '-c',
                    `import json, sys
try:
    import duckdb
    duckdb_info = duckdb.__version__
except Exception:
    duckdb_info = None
try:
    import pyarrow
    pyarrow_info = pyarrow.__version__
except Exception:
    pyarrow_info = None
print(json.dumps({
    "python": sys.version.split()[0],
    "executable": sys.executable,
    "prefix": sys.prefix,
    "duckdb": duckdb_info,
    "pyarrow": pyarrow_info
}))`
                ], 10000);
                const parsed = JSON.parse(info);
                runtimeInfo = [
                    `Python ${parsed.python}`,
                    `DuckDB ${parsed.duckdb || 'not installed'}`,
                    `PyArrow ${parsed.pyarrow || 'not installed'}`,
                    `Executable: ${parsed.executable}`,
                    `Prefix: ${parsed.prefix}`
                ].join('\n');
            } catch (error) {
                runtimeInfo = `Could not inspect venv runtime: ${error}`;
            }
        }

        const report = [
            'File Hive Environment Doctor',
            `Extension version: ${this.getExtensionVersion()}`,
            `Platform: ${process.platform} ${process.arch}`,
            `Environment ready in this session: ${this.isInitialized ? 'Yes' : 'No'}`,
            `Stored ready state: ${storedState ? 'Yes' : 'No'}`,
            `Python extension installed: ${pythonExtension ? 'Yes' : 'No'}`,
            `System Python selected this session: ${this.systemPythonPath || 'Not selected'}`,
            `uv: ${uvInfo}`,
            `Global storage: ${this.context.globalStorageUri.fsPath}`,
            `Virtual environment path: ${this.venvPath}`,
            `Virtual environment folder exists: ${venvExists ? 'Yes' : 'No'}`,
            `Virtual environment Python exists: ${venvPythonExists ? 'Yes' : 'No'}`,
            'Runtime:',
            runtimeInfo
        ].join('\n');

        this.log('Environment doctor report:');
        for (const line of report.split('\n')) {
            this.log(line);
        }

        return report;
    }

    public getSystemPythonPath(): string | null {
        return this.systemPythonPath;
    }

    private getExtensionVersion(): string {
        const version = this.context.extension.packageJSON?.version;
        return typeof version === 'string' && version.trim() ? version : 'unknown';
    }
}
