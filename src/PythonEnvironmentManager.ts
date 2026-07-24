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
}

const INITIALIZED_STATE_KEY = 'parquetViewerInitialized';
const PREWARM_ATTEMPTED_VERSION_STATE_KEY = 'parquetViewerPrewarmAttemptedVersion';

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
    private readonly outputChannel: vscode.OutputChannel;
    private readonly isWindows: boolean;
    private isInitialized: boolean = false;
    private initializationPromise: Promise<boolean> | null = null;
    private initializationAllowsPrompts: boolean = true;
    private readonly stateValidationPromise: Promise<void>;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Parquet Viewer');
        this.isWindows = os.platform() === WINDOWS_PLATFORM;
        
        this.venvPath = path.join(
            this.context.globalStorageUri.fsPath,
            '.parquet-venv'
        );
        
        this.venvPythonPath = this.isWindows
            ? path.join(this.venvPath, 'Scripts', 'python.exe')
            : path.join(this.venvPath, 'bin', 'python');
        
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

        const effectiveOptions = {
            allowPrompts: options.allowPrompts ?? true,
            showProgress: options.showProgress ?? true
        };

        if (this.initializationPromise) {
            const result = await this.initializationPromise;
            if (!result && effectiveOptions.allowPrompts && !this.initializationAllowsPrompts) {
                return this.initializeEnvironment(effectiveOptions);
            }

            return result;
        }

        this.initializationAllowsPrompts = effectiveOptions.allowPrompts;
        this.initializationPromise = this.doInitialize(effectiveOptions);

        try {
            return await this.initializationPromise;
        } finally {
            this.initializationPromise = null;
            this.initializationAllowsPrompts = true;
        }
    }

    public prewarmEnvironmentInBackground(): void {
        void this.doPrewarmEnvironmentInBackground();
    }

    private async doPrewarmEnvironmentInBackground(): Promise<void> {
        try {
            await this.stateValidationPromise;

            const extensionVersion = this.getExtensionVersion();
            const attemptedVersion = this.context.globalState.get<string>(PREWARM_ATTEMPTED_VERSION_STATE_KEY);
            if (attemptedVersion === extensionVersion) {
                this.log(`Environment prewarm already attempted for ${extensionVersion}`);
                return;
            }

            this.log(`Prewarming Python environment for ${extensionVersion}`);
            const ready = await this.initializeEnvironment({
                allowPrompts: false,
                showProgress: false
            });

            await this.context.globalState.update(PREWARM_ATTEMPTED_VERSION_STATE_KEY, extensionVersion);
            if (ready) {
                this.log('Background environment prewarm complete');
            } else {
                this.log('Background environment prewarm skipped or failed; setup will retry on first Parquet action');
            }
        } catch (error) {
            this.log(`Background environment prewarm failed: ${error}`);
        }
    }

    private async doInitialize(options: Required<InitializeEnvironmentOptions>): Promise<boolean> {
        if (this.isInitialized) {
            this.log('Environment ready');
            return true;
        }

        if (await this.isVenvValid()) {
            this.log('Virtual environment ready');
            this.isInitialized = true;
            return true;
        }

        this.systemPythonPath = await this.getPythonFromExtension();
        
        if (!this.systemPythonPath) {
            this.systemPythonPath = await this.findSystemPython();
        }

        if (!this.systemPythonPath) {
            const pythonExt = vscode.extensions.getExtension(VS_CODE_PYTHON_EXTENSION);
            if (!options.allowPrompts) {
                this.log('Python path not found during background prewarm; prompts are disabled');
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

        const venvCreated = await this.createVirtualEnvironment(options.showProgress);
        if (!venvCreated) {
            return false;
        }

        const installed = await this.installDuckDB(options.showProgress);
        if (!installed) {
            return false;
        }

        const verified = await this.verifyDuckDB();
        if (verified) {
            this.isInitialized = true;
            this.log('Environment ready');
            await this.context.globalState.update(INITIALIZED_STATE_KEY, true);
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
                'import duckdb; print(duckdb.__version__)'
            ], 10000);
            return true;
        } catch {
            return false;
        }
    }

    private async createVirtualEnvironment(showProgress: boolean): Promise<boolean> {
        const systemPythonPath = this.systemPythonPath;
        if (!systemPythonPath) {
            return false;
        }

        return this.withOptionalProgress(showProgress, "Parquet Viewer - Creating Environment", async (progress) => {
            try {
                progress.report({ message: 'Creating environment...' });
                
                if (await exists(this.venvPath)) {
                    await fs.promises.rm(this.venvPath, { recursive: true, force: true });
                }

                await fs.promises.mkdir(path.dirname(this.venvPath), { recursive: true });

                await this.runCommand(systemPythonPath, [
                    '-m', 'venv',
                    this.venvPath
                ], 120000);

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

    private async installDuckDB(showProgress: boolean): Promise<boolean> {
        return this.withOptionalProgress(showProgress, "Parquet Viewer - Installing DuckDB", async (progress) => {
            try {
                progress.report({ message: 'Installing DuckDB. This only runs the first time...' });
                
                await this.runCommand(this.venvPythonPath, [
                    '-m', 'pip', 'install',
                    '--disable-pip-version-check',
                    '--only-binary=:all:',
                    'duckdb',
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

    private async withOptionalProgress<T>(
        showProgress: boolean,
        title: string,
        task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Thenable<T>
    ): Promise<T> {
        if (showProgress) {
            return vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title,
                cancellable: false
            }, task);
        }

        return task({ report: () => undefined });
    }

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
        try {
            const pythonPath = await vscode.commands.executeCommand('python.interpreterPath') as string;
            
            if (pythonPath && pythonPath.trim() && pythonPath !== 'python') {
                this.log(`Found Python via command: ${pythonPath}`);
                return pythonPath.trim();
            }
            
            return null;
        } catch (error) {
            this.log(`Command method failed (normal if no workspace): ${error}`);
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

    private async promptForPythonSelection(): Promise<boolean> {
        const choice = await vscode.window.showWarningMessage(
            'Please select a Python 3.x interpreter (version 3.13 or earlier) in VS Code for Parquet Viewer.',
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
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    public getPythonPath(): string {
        if (!this.isInitialized) {
            throw new Error('Environment not initialized yet.');
        }
        return this.venvPythonPath;
    }

    public async ensureInitialized(): Promise<void> {
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
        this.outputChannel.show(true);
    }

    public async resetEnvironment(): Promise<boolean> {
        this.log('Resetting environment...');
        this.isInitialized = false;
        
        try {
            if (await exists(this.venvPath)) {
                await fs.promises.rm(this.venvPath, { recursive: true, force: true });
            }
            
            await this.context.globalState.update(INITIALIZED_STATE_KEY, false);
            await this.context.globalState.update(PREWARM_ATTEMPTED_VERSION_STATE_KEY, undefined);
        } catch (error) {
            this.log(`Cleanup warning: ${error}`);
        }
        
        return await this.initializeEnvironment();
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

    public getSystemPythonPath(): string | null {
        return this.systemPythonPath;
    }

    private getExtensionVersion(): string {
        const version = this.context.extension.packageJSON?.version;
        return typeof version === 'string' && version.trim() ? version : 'unknown';
    }
}
