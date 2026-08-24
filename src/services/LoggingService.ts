import * as vscode from 'vscode';
import { EXTENSION_NAME } from '../common/constant';

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

const levelPriority: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4
};

export class LoggingService implements vscode.Disposable {
    private readonly outputChannel: vscode.OutputChannel;
    private readonly level: LogLevel = 'info';

    constructor(name: string = EXTENSION_NAME) {
        this.outputChannel = vscode.window.createOutputChannel(name);
    }

    public trace(message: string, ...details: unknown[]): void {
        this.write('trace', message, ...details);
    }

    public debug(message: string, ...details: unknown[]): void {
        this.write('debug', message, ...details);
    }

    public info(message: string, ...details: unknown[]): void {
        this.write('info', message, ...details);
    }

    public warn(message: string, ...details: unknown[]): void {
        this.write('warn', message, ...details);
    }

    public error(message: string, ...details: unknown[]): void {
        this.write('error', message, ...details);
    }

    public show(preserveFocus: boolean = true): void {
        this.outputChannel.show(preserveFocus);
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }

    private write(level: LogLevel, message: string, ...details: unknown[]): void {
        if (levelPriority[level] < levelPriority[this.level]) {
            return;
        }

        this.outputChannel.appendLine(
            `[${new Date().toLocaleTimeString()}] [${level.toUpperCase()}] ${[message, ...details].map(formatLogValue).join(' ')}`
        );
    }
}

const formatLogValue = (value: unknown): string => {
    if (value instanceof Error) {
        return value.stack || value.message;
    }

    if (typeof value === 'string') {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};
