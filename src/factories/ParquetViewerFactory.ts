import * as vscode from 'vscode';
import { ParquetViewer } from '../ParquetViewer';
import { PythonParquetReader } from '../parquet/PythonParquetReader';
import { InlineWebviewRenderer } from '../webview/InlineWebviewRenderer';
import { PythonEnvironmentManager } from '../PythonEnvironmentManager';

export class ParquetViewerFactory {
    /**
     * Creates a ParquetViewer which can be used to render parquet files
     * in VS Code.
     *
     * @param {vscode.ExtensionContext} context - The VS Code extension context.
     * @param {PythonEnvironmentManager} pythonManager - The environment manager for the Python extension.
     * @returns {vscode.Disposable} The disposable ParquetViewer object.
     */
    static create(
        context: vscode.ExtensionContext,
        pythonManager: PythonEnvironmentManager
    ): vscode.Disposable {
        const parquetReader = new PythonParquetReader(pythonManager, context);
        const webviewRenderer = new InlineWebviewRenderer();
        
        return ParquetViewer.register(parquetReader, webviewRenderer);
    }
}