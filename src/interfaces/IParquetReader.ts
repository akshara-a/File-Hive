import * as vscode from 'vscode';

export interface IParquetReader {
    readParquetFile(uri: vscode.Uri): Promise<ParquetDataResult>;
}

export interface ParquetDataResult {
    success: boolean;
    data?: any[];
    columns?: string[];
    rowCount?: number;
    totalRows?: number;
    error?: string;
    traceback?: string;
}