import * as vscode from 'vscode';

export interface IParquetReader {
    readParquetFile(uri: vscode.Uri, query?: string): Promise<ParquetDataResult>;
}

export interface ParquetDataResult {
    success: boolean;
    data?: any[];
    columns?: string[];
    rowCount?: number;
    totalRows?: number;
    query?: string;
    resultLimited?: boolean;
    error?: string;
    traceback?: string;
}
