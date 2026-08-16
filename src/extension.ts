import * as vscode from 'vscode';
import { ParquetViewerFactory } from './factories/ParquetViewerFactory';
import { PythonEnvironmentManager } from './PythonEnvironmentManager';
import { CANCEL, EXTENSION_NAME, MESSAGES, REGISTER_COMMANDS, RESET_ENVIRONMENT, SHOW_LOGS } from './common/constant';
import { LoggingService } from './services/LoggingService';

let pythonManager: PythonEnvironmentManager;
let logger: LoggingService;

/**
 * Activates the Parquet Viewer extension.
 * Registers the custom editor provider and supporting commands.
 * The isolated Python environment is initialized lazily when a Parquet action needs it.
 * @param {vscode.ExtensionContext} context - The VS Code extension context.
 */
export async function activate(context: vscode.ExtensionContext) {
    logger = new LoggingService();
    context.subscriptions.push(logger);
    logger.info('Parquet Viewer extension is activating...');
    
    // Create the manager now; it prepares Python lazily on first use.
    pythonManager = new PythonEnvironmentManager(context, logger);

    const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: EXTENSION_NAME,
        cancellable: false
    };

    try {
        // Register our custom editor provider using the factory
        const parquetViewer = ParquetViewerFactory.create(context, pythonManager, logger);
        context.subscriptions.push(parquetViewer);
        
        // Add commands
        context.subscriptions.push(
            vscode.commands.registerCommand(REGISTER_COMMANDS.SETUP_ENVIRONMENT, async () => {
                const success = await pythonManager.initializeEnvironment();

                if (success) {
                    vscode.window.showInformationMessage(MESSAGES.ENVIRONMENT_SETUP_SUCCESS);
                } else {
                    const choice = await vscode.window.showErrorMessage(
                        MESSAGES.ENVIRONMENT_SETUP_FAILED,
                        SHOW_LOGS,
                        RESET_ENVIRONMENT
                    );

                    if (choice === SHOW_LOGS) {
                        pythonManager.showOutputChannel();
                    } else if (choice === RESET_ENVIRONMENT) {
                        await vscode.commands.executeCommand(REGISTER_COMMANDS.RESET_ENVIRONMENT);
                    }
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand(REGISTER_COMMANDS.SHOW_LOGS, () => {
                pythonManager.showOutputChannel();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand(REGISTER_COMMANDS.RESET_ENVIRONMENT, async () => {
                const choice = await vscode.window.showWarningMessage(
                    MESSAGES.ENVIRONMENT_RESET_WARNING,
                    { modal: true },
                    RESET_ENVIRONMENT,
                    CANCEL
                );
                
                if (choice === RESET_ENVIRONMENT) {
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
            })
        );

        logger.info('Parquet Viewer extension activated successfully');
        
    } catch (error) {
        logger.error('Failed to register Parquet Viewer:', error);
        vscode.window.showErrorMessage(`Parquet Viewer registration failed: ${error}`);
        pythonManager.showOutputChannel();
    }
}

/**
 * Called when the extension is deactivated.
 * This is typically done when the extension is uninstalled or disabled.
 */
export function deactivate() {
    logger?.info('Parquet Viewer extension deactivated');
}
