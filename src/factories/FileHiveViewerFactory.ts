import * as vscode from 'vscode';
import { FileHiveViewer } from '../FileHiveViewer';
import { PythonDataFileReader } from '../readers/PythonDataFileReader';
import { InlineWebviewRenderer } from '../webview/InlineWebviewRenderer';
import { PythonEnvironmentManager } from '../PythonEnvironmentManager';
import { LoggingService } from '../services/LoggingService';

export class FileHiveViewerFactory {
    /**
     * Creates a FileHiveViewer which can be used to render supported data files
     * in VS Code.
     *
     * @param {vscode.ExtensionContext} context - The VS Code extension context.
     * @param {PythonEnvironmentManager} pythonManager - The environment manager for the Python extension.
     * @returns {vscode.Disposable} The disposable FileHiveViewer object.
     */
    static create(
        context: vscode.ExtensionContext,
        pythonManager: PythonEnvironmentManager,
        logger: LoggingService
    ): vscode.Disposable {
        const dataFileReader = new PythonDataFileReader(pythonManager, context, logger);
        const webviewRenderer = new InlineWebviewRenderer();
        const providerDisposable = FileHiveViewer.register(dataFileReader, webviewRenderer);

        return vscode.Disposable.from(
            providerDisposable,
            dataFileReader
        );
    }
}
