import * as vscode from 'vscode';

export interface IDataFileReader {
    readDataFile(uri: vscode.Uri, query?: string, selectedRelation?: DataFileRelation, sourceOptions?: DataFileSourceOptions, offset?: number, limit?: number): Promise<DataFileReadResult>;
    runFileDoctor(uri: vscode.Uri, selectedRelation?: DataFileRelation, sourceOptions?: DataFileSourceOptions): Promise<DataFileDoctorRunResult>;
    releaseFileSession(uri: vscode.Uri): Promise<void>;
    exportDataFile(
        uri: vscode.Uri,
        format: DataFileExportFormat,
        outputUri: vscode.Uri,
        query?: string,
        selectedRelation?: DataFileRelation,
        exportScope?: DataFileExportScope,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileExportResult>;
    saveEditedParquetFile(
        uri: vscode.Uri,
        outputUri: vscode.Uri,
        format: DataFileExportFormat,
        columns: string[],
        rows: Record<string, any>[]
    ): Promise<ParquetEditSaveResult>;
    createParquetFile(
        uri: vscode.Uri,
        outputUri: vscode.Uri,
        options: ParquetWriteOptions,
        selectedRelation?: DataFileRelation | null,
        sourceOptions?: DataFileSourceOptions | null
    ): Promise<ParquetWriteResult>;
    getCompareMetadata(
        uri: vscode.Uri,
        compareUri: vscode.Uri,
        selectedRelation?: DataFileRelation,
        compareSelectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileCompareMetadataResult>;
    compareDataFile(
        uri: vscode.Uri,
        compareUri: vscode.Uri,
        mappings?: DataFileCompareMapping[],
        orderMapping?: DataFileCompareOrderMapping,
        selectedRelation?: DataFileRelation,
        compareSelectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileCompareResult>;
    smartDiffDataFile(
        uri: vscode.Uri,
        compareUri: vscode.Uri,
        selectedRelation?: DataFileRelation,
        compareSelectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileCompareResult>;
    getJoinMetadata(
        uri: vscode.Uri,
        joinUri: vscode.Uri,
        selectedRelation?: DataFileRelation,
        joinSelectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileJoinResult>;
    joinDataFile(
        uri: vscode.Uri,
        joinUri: vscode.Uri,
        options: DataFileJoinOptions,
        selectedRelation?: DataFileRelation,
        joinSelectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileJoinResult>;
    detectSchemaDrift(
        uri: vscode.Uri,
        referenceUri: vscode.Uri,
        selectedRelation?: DataFileRelation,
        referenceSelectedRelation?: DataFileRelation,
        sourceOptions?: DataFileSourceOptions
    ): Promise<DataFileSchemaDriftResult>;
    scanParquetDataset(uri: vscode.Uri, folderUri: vscode.Uri): Promise<DataFileDatasetAnalysisResult>;
}

export type DataFileExportFormat =
    | 'csv'
    | 'tsv'
    | 'psv'
    | 'json'
    | 'jsonl'
    | 'ndjson'
    | 'sqlite'
    | 'parquet'
    | 'duckdb'
    | 'avro'
    | 'orc'
    | 'arrow'
    | 'feather'
    | 'ipc';

export type DataFileSourceFormat = DataFileExportFormat | 'excel' | 'xlsx' | 'xls' | 'workspace';

export interface DataFileReadResult {
    success: boolean;
    fileType?: DataFileType;
    sourceFormat?: DataFileSourceFormat;
    data?: any[];
    columns?: string[];
    rowCount?: number;
    offset?: number;
    limit?: number;
    hasMore?: boolean;
    query?: string;
    schema?: DataFileSchemaResult;
    doctor?: DataFileDoctorResult;
    relations?: DataFileRelation[];
    selectedRelation?: DataFileRelation;
    sourceOptions?: DataFileSourceOptions;
    textPreview?: DataFileTextPreview;
    error?: string;
    traceback?: string;
}

export interface DataFileDoctorRunResult {
    success: boolean;
    fileType?: DataFileType;
    sourceFormat?: DataFileSourceFormat;
    doctor?: DataFileDoctorResult;
    relations?: DataFileRelation[];
    selectedRelation?: DataFileRelation;
    sourceOptions?: DataFileSourceOptions;
    error?: string;
    traceback?: string;
}

export interface DataFileRelation {
    database?: string;
    schema: string;
    name: string;
    type: 'BASE TABLE' | 'VIEW';
}

export interface DataFileSourceOptions {
    delimitedText?: DataFileDelimitedTextOptions;
    json?: DataFileJsonOptions;
    excel?: DataFileExcelOptions;
}

export interface DataFileDelimitedTextOptions {
    header?: boolean;
    delimiter?: string;
    encoding?: string;
    quote?: string;
    escape?: string;
    nullString?: string;
}

export interface DataFileJsonOptions {
    flatten?: boolean;
    recordPath?: string;
}

export interface DataFileExcelOptions {
    headerRow?: number;
    dataStartRow?: number;
    inferTypes?: boolean;
}

export type DataFileExportScope = 'query' | 'relation' | 'allRelations';

export type DataFileType =
    | 'parquet'
    | 'workspace'
    | 'duckdb'
    | 'sqlite'
    | 'excel'
    | 'csv'
    | 'tsv'
    | 'psv'
    | 'json'
    | 'avro'
    | 'orc'
    | 'arrow'
    | 'feather'
    | 'ipc';

export interface DataFileTextPreview {
    content: string;
    lineCount: number;
    sizeBytes: number;
    truncated: boolean;
}

export interface DataFileDoctorResult {
    healthReport: DataFileDoctorHealthReport;
    integrity: Record<string, any>;
    schemaValidation: {
        columns: DataFileDoctorSchemaColumn[];
    };
    rowGroupAnalysis: {
        rowGroups: DataFileDoctorRowGroup[];
    };
    columnStatistics: {
        columns: DataFileDoctorColumnStatistics[];
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

export interface DataFileDoctorHealthReport {
    healthScore: number;
    errors: DataFileDoctorIssue[];
    warnings: DataFileDoctorIssue[];
    passedChecks: DataFileDoctorIssue[];
    recommendations: string[];
}

export interface DataFileDoctorIssue {
    category: string;
    message: string;
    recommendation?: string;
}

export interface DataFileDoctorSchemaColumn {
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

export interface DataFileDoctorRowGroup {
    id: number | string;
    rowCount: number;
    compression?: string;
    compressedSize?: number;
    uncompressedSize?: number;
    compressionRatio?: number;
    columnChunks: any[];
    issues: string[];
}

export interface DataFileDoctorColumnStatistics {
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

export interface DataFileExportResult {
    success: boolean;
    format?: DataFileExportFormat;
    outputPath?: string;
    rowsExported?: number;
    filesExported?: number;
    query?: string;
    error?: string;
    traceback?: string;
}

export interface ParquetEditSaveResult {
    success: boolean;
    format?: DataFileExportFormat;
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
    rows?: Record<string, any>[];
    query?: string;
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

export interface DataFileCompareResult {
    success: boolean;
    basePath?: string;
    comparePath?: string;
    columns?: string[];
    totalRowsBase?: number;
    totalRowsCompare?: number;
    rowsCompared?: number;
    mismatchCount?: number;
    mismatches?: ParquetRowMismatch[];
    mappings?: DataFileCompareMapping[];
    orderMapping?: DataFileCompareOrderMapping;
    mismatchLimit?: number;
    truncated?: boolean;
    diffMode?: 'smart';
    smartDiff?: ParquetSmartDiffSummary;
    error?: string;
    traceback?: string;
}

export interface ParquetSmartDiffSummary {
    keyMapping?: DataFileCompareOrderMapping & {
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

export interface DataFileCompareMetadataResult {
    success: boolean;
    basePath?: string;
    comparePath?: string;
    baseColumns?: DataFileCompareColumn[];
    compareColumns?: DataFileCompareColumn[];
    error?: string;
    traceback?: string;
}

export interface DataFileCompareColumn {
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

export interface DataFileCompareMapping {
    baseColumn: string;
    compareColumn: string;
    displayColumn?: string;
}

export interface DataFileCompareOrderMapping {
    baseColumn: string;
    compareColumn: string;
}

export type DataFileJoinType = 'inner' | 'left' | 'right' | 'full';

export interface DataFileJoinOptions {
    baseColumn: string;
    joinColumn: string;
    joinType: DataFileJoinType;
    limit?: number;
}

export interface DataFileJoinResult {
    success: boolean;
    basePath?: string;
    joinPath?: string;
    joinType?: DataFileJoinType;
    baseColumns?: DataFileCompareColumn[];
    joinColumns?: DataFileCompareColumn[];
    columns?: string[];
    data?: Record<string, any>[];
    rowCount?: number;
    totalRows?: number;
    resultLimited?: boolean;
    error?: string;
    traceback?: string;
}

export interface DataFileSchemaDriftResult {
    success: boolean;
    currentPath?: string;
    referencePath?: string;
    addedColumns?: DataFileCompareColumn[];
    removedColumns?: DataFileCompareColumn[];
    typeChangedColumns?: any[];
    renameCandidates?: any[];
    summary?: Record<string, number>;
    error?: string;
    traceback?: string;
}

export interface DataFileDatasetAnalysisResult {
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

export interface DataFileSchemaResult {
    columns: DataFileSchemaColumn[];
    tree: DataFileSchemaColumn[];
    raw: any[];
    columnCount: number;
}

export interface DataFileSchemaColumn {
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
    children: DataFileSchemaColumn[];
}
