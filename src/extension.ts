import * as vscode from 'vscode';
import { FileHiveViewerFactory } from './factories/FileHiveViewerFactory';
import { PythonEnvironmentManager } from './PythonEnvironmentManager';
import { CANCEL, ENVIRONMENT_DOCTOR, EXTENSION_NAME, MESSAGES, REGISTER_COMMANDS, RESET_ENVIRONMENT, RETRY_SETUP, SHOW_LOGS } from './common/constant';
import { LoggingService } from './services/LoggingService';

let pythonManager: PythonEnvironmentManager;
let logger: LoggingService;

/**
 * Activates the File Hive extension.
 * Registers the custom editor provider and supporting commands.
 * The isolated Python environment is initialized lazily when a File Hive action needs it.
 * @param {vscode.ExtensionContext} context - The VS Code extension context.
 */
export async function activate(context: vscode.ExtensionContext) {
    logger = new LoggingService();
    context.subscriptions.push(logger);
    logger.info('File Hive extension is activating...');
    
    // Create the manager now; it prepares Python lazily on first use.
    pythonManager = new PythonEnvironmentManager(context, logger);

    const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: EXTENSION_NAME,
        cancellable: false
    };

    const showEnvironmentDoctor = async () => {
        pythonManager.showOutputChannel();
        await pythonManager.getEnvironmentDiagnostics();

        const choice = await vscode.window.showInformationMessage(
            MESSAGES.ENVIRONMENT_DOCTOR_READY,
            RETRY_SETUP,
            RESET_ENVIRONMENT
        );

        if (choice === RETRY_SETUP) {
            await setupEnvironment();
        } else if (choice === RESET_ENVIRONMENT) {
            await resetEnvironment();
        }
    };

    const resetEnvironment = async () => {
        const choice = await vscode.window.showWarningMessage(
            MESSAGES.ENVIRONMENT_RESET_WARNING,
            { modal: true },
            RESET_ENVIRONMENT,
            CANCEL
        );
        
        if (choice === RESET_ENVIRONMENT) {
            pythonManager.showOutputChannel();
            void vscode.window.showInformationMessage(MESSAGES.ENVIRONMENT_RESETTING);
            const success = await vscode.window.withProgress(progressOptions, async (progress) => {
                progress.report({ message: MESSAGES.ENVIRONMENT_RESETTING });
                return await pythonManager.resetEnvironment({ progress });
            });
            
            if (success) {
                vscode.window.showInformationMessage(MESSAGES.ENVIRONMENT_RESET_SUCCESS);
            } else {
                vscode.window.showErrorMessage(MESSAGES.ENVIRONMENT_RESET_FAILED);
                pythonManager.showOutputChannel();
            }
        }
    };

    const setupEnvironment = async () => {
        pythonManager.showOutputChannel();
        void vscode.window.showInformationMessage(MESSAGES.ENVIRONMENT_INITIALIZING);
        const success = await pythonManager.initializeEnvironment();

        if (success) {
            vscode.window.showInformationMessage(MESSAGES.ENVIRONMENT_SETUP_SUCCESS);
            return;
        }

        const choice = await vscode.window.showErrorMessage(
            MESSAGES.ENVIRONMENT_SETUP_FAILED,
            RETRY_SETUP,
            SHOW_LOGS,
            ENVIRONMENT_DOCTOR,
            RESET_ENVIRONMENT
        );

        if (choice === RETRY_SETUP) {
            await setupEnvironment();
        } else if (choice === SHOW_LOGS) {
            pythonManager.showOutputChannel();
        } else if (choice === ENVIRONMENT_DOCTOR) {
            await showEnvironmentDoctor();
        } else if (choice === RESET_ENVIRONMENT) {
            await resetEnvironment();
        }
    };

    try {
        // Register commands before editor setup so recovery commands are always available.
        context.subscriptions.push(
            vscode.commands.registerCommand(REGISTER_COMMANDS.SETUP_ENVIRONMENT, setupEnvironment)
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand(REGISTER_COMMANDS.SHOW_LOGS, () => {
                pythonManager.showOutputChannel();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand(REGISTER_COMMANDS.RESET_ENVIRONMENT, resetEnvironment)
        );

        context.subscriptions.push(
            vscode.commands.registerCommand(REGISTER_COMMANDS.ENVIRONMENT_DOCTOR, showEnvironmentDoctor)
        );

        // Register our custom editor provider using the factory
        const fileHiveViewer = FileHiveViewerFactory.create(context, pythonManager, logger);
        context.subscriptions.push(fileHiveViewer);

        logger.info('File Hive extension activated successfully');
        
    } catch (error) {
        logger.error('Failed to register File Hive:', error);
        vscode.window.showErrorMessage(`File Hive registration failed: ${error}`);
        pythonManager.showOutputChannel();
    }
}

/**
 * Called when the extension is deactivated.
 * This is typically done when the extension is uninstalled or disabled.
 */
export function deactivate() {
    logger?.info('File Hive extension deactivated');
}
