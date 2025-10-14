import * as vscode from 'vscode';

export interface IWebviewRenderer {
    getWebviewContent(webview: vscode.Webview, data: any): string;
}