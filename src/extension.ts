import * as vscode from 'vscode';
import { ParquetViewerFactory } from './factories/ParquetViewerFactory';
import { PythonEnvironmentManager } from './PythonEnvironmentManager';
import { CANCEL, EXTENSION_NAME, MESSAGES, REGISTER_COMMANDS, RESET_ENVIRONMENT, SHOW_LOGS } from './common/constant';

let pythonManager: PythonEnvironmentManager;

/**
 * Activates the Parquet Viewer extension.
 * Initializes the isolated Python environment and registers the custom editor provider.
 * @param {vscode.ExtensionContext} context - The VS Code extension context.
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('Parquet Viewer extension is activating...');
    
    // Initialize isolated Python environment
    pythonManager = new PythonEnvironmentManager(context);
    
    const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: EXTENSION_NAME,
        cancellable: false
    };

    let isReady = false;
    
    try {
        isReady = await vscode.window.withProgress(progressOptions, async (progress) => {
            progress.report({ message: MESSAGES.ENVIRONMENT_INITIALIZING });
            return await pythonManager.initializeEnvironment();
        });
    } catch (error) {
        console.error('Failed to initialize environment:', error);
        vscode.window.showErrorMessage(`Parquet Viewer initialization failed: ${error}`);
        pythonManager.showOutputChannel();
        return;
    }
    
    if (!isReady) {
        const choice = await vscode.window.showErrorMessage(
            MESSAGES.ENVIRONMENT_SETUP_FAILED,
            SHOW_LOGS,
            RESET_ENVIRONMENT
        );
        
        if (choice === SHOW_LOGS) {
            pythonManager.showOutputChannel();
        } else if (choice === RESET_ENVIRONMENT) {
            await vscode.window.withProgress(progressOptions, async (progress) => {
                progress.report({ message: MESSAGES.ENVIRONMENT_RESETTING });
                const success = await pythonManager.resetEnvironment();
                if (success) {
                    vscode.window.showInformationMessage(MESSAGES.ENVIRONMENT_RESET_SUCCESS);
                }
            });
        }
        return;
    }

    try {
        // Register our custom editor provider using the factory
        const parquetViewer = ParquetViewerFactory.create(context, pythonManager);
        context.subscriptions.push(parquetViewer);
        
        // Add commands
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
                        return await pythonManager.resetEnvironment();
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
        
        console.log('Parquet Viewer extension activated successfully');
        
    } catch (error) {
        console.error('Failed to register Parquet Viewer:', error);
        vscode.window.showErrorMessage(`Parquet Viewer registration failed: ${error}`);
        pythonManager.showOutputChannel();
    }
}

/**
 * Called when the extension is deactivated.
 * This is typically done when the extension is uninstalled or disabled.
 */
export function deactivate() {
    console.log('Parquet Viewer extension deactivated');
}