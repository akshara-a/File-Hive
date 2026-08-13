import * as vscode from 'vscode';

export interface IParquetReader {
    readParquetFile(uri: vscode.Uri, query?: string): Promise<ParquetDataResult>;
    runParquetDoctor(uri: vscode.Uri): Promise<ParquetDoctorRunResult>;
    releaseFileSession(uri: vscode.Uri): Promise<void>;
    exportParquetFile(
        uri: vscode.Uri,
        format: ParquetExportFormat,
        outputUri: vscode.Uri,
        query?: string
    ): Promise<ParquetExportResult>;
    saveEditedParquetFile(
        uri: vscode.Uri,
        outputUri: vscode.Uri,
        columns: string[],
        rows: Record<string, any>[]
    ): Promise<ParquetEditSaveResult>;
    createParquetFile(
        uri: vscode.Uri,
        outputUri: vscode.Uri,
        options: ParquetWriteOptions
    ): Promise<ParquetWriteResult>;
    getParquetCompareMetadata(uri: vscode.Uri, compareUri: vscode.Uri): Promise<ParquetCompareMetadataResult>;
    compareParquetFile(
        uri: vscode.Uri,
        compareUri: vscode.Uri,
        mappings?: ParquetCompareMapping[],
        orderMapping?: ParquetCompareOrderMapping
    ): Promise<ParquetCompareResult>;
    smartDiffParquetFile(uri: vscode.Uri, compareUri: vscode.Uri): Promise<ParquetCompareResult>;
    getJoinMetadata(uri: vscode.Uri, joinUri: vscode.Uri): Promise<ParquetJoinResult>;
    joinParquetFile(uri: vscode.Uri, joinUri: vscode.Uri, options: ParquetJoinOptions): Promise<ParquetJoinResult>;
    detectSchemaDrift(uri: vscode.Uri, referenceUri: vscode.Uri): Promise<ParquetSchemaDriftResult>;
    scanParquetDataset(uri: vscode.Uri, folderUri: vscode.Uri): Promise<ParquetDatasetAnalysisResult>;
}

export type ParquetExportFormat = 'csv' | 'json' | 'sqlite' | 'parquet';

export interface ParquetDataResult {
    success: boolean;
    data?: any[];
    columns?: string[];
    rowCount?: number;
    totalRows?: number;
    query?: string;
    resultLimited?: boolean;
    schema?: ParquetSchemaResult;
    doctor?: ParquetDoctorResult;
    error?: string;
    traceback?: string;
}

export interface ParquetDoctorRunResult {
    success: boolean;
    doctor?: ParquetDoctorResult;
    error?: string;
    traceback?: string;
}

export interface ParquetDoctorResult {
    healthReport: ParquetDoctorHealthReport;
    integrity: Record<string, any>;
    schemaValidation: {
        columns: ParquetDoctorSchemaColumn[];
    };
    rowGroupAnalysis: {
        rowGroups: ParquetDoctorRowGroup[];
    };
    columnStatistics: {
        columns: ParquetDoctorColumnStatistics[];
    };
    dataQuality?: {
        totalRows: number;
        distinctRows: number;
        duplicateRowsEstimate: number;
        columns: any[];
    };
    decimalTimestampDiagnostics?: {
        columns: any[];
    };
    compressionEncodingAnalysis?: {
        columns: any[];
    };
}

export interface ParquetDoctorHealthReport {
    healthScore: number;
    errors: ParquetDoctorIssue[];
    warnings: ParquetDoctorIssue[];
    passedChecks: ParquetDoctorIssue[];
    recommendations: string[];
}

export interface ParquetDoctorIssue {
    category: string;
    message: string;
    recommendation?: string;
}

export interface ParquetDoctorSchemaColumn {
    name?: string;
    path?: string;
    physicalType?: string;
    logicalType?: string;
    nullableStatus?: string;
    decimalPrecision?: number;
    decimalScale?: number;
    timestampUnit?: string;
    status: string;
    issues: string[];
}

export interface ParquetDoctorRowGroup {
    id: number | string;
    rowCount: number;
    compression?: string;
    compressedSize?: number;
    uncompressedSize?: number;
    compressionRatio?: number;
    columnChunks: any[];
    issues: string[];
}

export interface ParquetDoctorColumnStatistics {
    column: string;
    hasMinMax: boolean;
    hasNullCount: boolean;
    hasDistinctCount: boolean;
    nullCount?: number;
    distinctCount?: number;
    allNull: boolean;
    constantValue: boolean;
    issues: string[];
}

export interface ParquetExportResult {
    success: boolean;
    format?: ParquetExportFormat;
    outputPath?: string;
    rowsExported?: number;
    query?: string;
    error?: string;
    traceback?: string;
}

export interface ParquetEditSaveResult {
    success: boolean;
    format?: 'parquet';
    outputPath?: string;
    rowsExported?: number;
    columnsExported?: number;
    error?: string;
    traceback?: string;
}

export type ParquetCompressionCodec = 'uncompressed' | 'snappy' | 'gzip' | 'brotli' | 'zstd';

export interface ParquetWriteColumn {
    name: string;
    type: string;
}

export interface ParquetWriteOptions {
    columns: ParquetWriteColumn[];
    rows: Record<string, any>[];
    compression: ParquetCompressionCodec;
    rowGroupSize?: number;
}

export interface ParquetWriteResult {
    success: boolean;
    format?: 'parquet';
    outputPath?: string;
    rowsExported?: number;
    columnsExported?: number;
    compression?: ParquetCompressionCodec;
    rowGroupSize?: number;
    error?: string;
    traceback?: string;
}

export interface ParquetCompareResult {
    success: boolean;
    basePath?: string;
    comparePath?: string;
    columns?: string[];
    totalRowsBase?: number;
    totalRowsCompare?: number;
    rowsCompared?: number;
    mismatchCount?: number;
    mismatches?: ParquetRowMismatch[];
    mappings?: ParquetCompareMapping[];
    orderMapping?: ParquetCompareOrderMapping;
    mismatchLimit?: number;
    truncated?: boolean;
    diffMode?: 'smart';
    smartDiff?: ParquetSmartDiffSummary;
    error?: string;
    traceback?: string;
}

export interface ParquetSmartDiffSummary {
    keyMapping?: ParquetCompareOrderMapping & {
        displayColumn?: string;
        score?: number;
        baseStats?: Record<string, number>;
        compareStats?: Record<string, number>;
    };
    mappedColumns?: number;
    exactMatches?: number;
    fuzzyMatches?: number;
    skippedBaseColumns?: string[];
    skippedCompareColumns?: string[];
    insertedRows?: number;
    deletedRows?: number;
    changedRows?: number;
    unchangedRows?: number;
}

export interface ParquetCompareMetadataResult {
    success: boolean;
    basePath?: string;
    comparePath?: string;
    baseColumns?: ParquetCompareColumn[];
    compareColumns?: ParquetCompareColumn[];
    error?: string;
    traceback?: string;
}

export interface ParquetCompareColumn {
    name: string;
    path: string;
    duckdbType?: string;
    physicalType?: string;
    logicalType?: string;
    nullableStatus?: string;
    decimalPrecision?: number;
    decimalScale?: number;
    timestampUnit?: string;
    typeSignature: string;
}

export interface ParquetCompareMapping {
    baseColumn: string;
    compareColumn: string;
    displayColumn?: string;
}

export interface ParquetCompareOrderMapping {
    baseColumn: string;
    compareColumn: string;
}

export type ParquetJoinType = 'inner' | 'left' | 'right' | 'full';

export interface ParquetJoinOptions {
    baseColumn: string;
    joinColumn: string;
    joinType: ParquetJoinType;
    limit?: number;
}

export interface ParquetJoinResult {
    success: boolean;
    basePath?: string;
    joinPath?: string;
    joinType?: ParquetJoinType;
    baseColumns?: ParquetCompareColumn[];
    joinColumns?: ParquetCompareColumn[];
    columns?: string[];
    data?: Record<string, any>[];
    rowCount?: number;
    totalRows?: number;
    resultLimited?: boolean;
    error?: string;
    traceback?: string;
}

export interface ParquetSchemaDriftResult {
    success: boolean;
    currentPath?: string;
    referencePath?: string;
    addedColumns?: ParquetCompareColumn[];
    removedColumns?: ParquetCompareColumn[];
    typeChangedColumns?: any[];
    renameCandidates?: any[];
    summary?: Record<string, number>;
    error?: string;
    traceback?: string;
}

export interface ParquetDatasetAnalysisResult {
    success: boolean;
    folderPath?: string;
    fileCount?: number;
    totalSize?: number;
    totalRows?: number;
    schemaGroups?: any[];
    partitionKeys?: string[];
    partitionSizes?: any[];
    missingPartitions?: any[];
    smallFiles?: any[];
    emptyFiles?: any[];
    unreadableFiles?: any[];
    unevenPartitionSizes?: any;
    warnings?: string[];
    recommendations?: string[];
    error?: string;
    traceback?: string;
}

export interface ParquetRowMismatch {
    rowIndex: number;
    keyValue?: string | number | boolean | null;
    type: 'value_mismatch' | 'missing_in_base' | 'missing_in_compare';
    base?: Record<string, any>;
    compare?: Record<string, any>;
    mismatchedColumns: string[];
}

export interface ParquetSchemaResult {
    columns: ParquetSchemaColumn[];
    tree: ParquetSchemaColumn[];
    raw: any[];
    columnCount: number;
}

export interface ParquetSchemaColumn {
    name: string;
    path: string;
    parentPath?: string;
    depth: number;
    physicalType?: string;
    logicalType?: string;
    convertedType?: string;
    nullableStatus: string;
    repetitionType?: string;
    repetitionLevel: number;
    definitionLevel: number;
    decimalPrecision?: number;
    decimalScale?: number;
    timestampUnit?: string;
    timestampTimezoneInterpretation?: string;
    timestampIsAdjustedToUTC?: boolean;
    numChildren: number;
    children: ParquetSchemaColumn[];
}
