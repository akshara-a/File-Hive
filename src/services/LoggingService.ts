import * as vscode from 'vscode';
import log = require('loglevel');
import { EXTENSION_NAME } from '../common/constant';

export class LoggingService implements vscode.Disposable {
    private readonly outputChannel: vscode.OutputChannel;
    private readonly logger: log.Logger;

    constructor(name: string = EXTENSION_NAME) {
        this.outputChannel = vscode.window.createOutputChannel(name);
        this.logger = log.getLogger('parquet-x');
        this.logger.methodFactory = (methodName) => {
            return (...messages: unknown[]) => {
                this.outputChannel.appendLine(
                    `[${new Date().toLocaleTimeString()}] [${methodName.toUpperCase()}] ${messages.map(formatLogValue).join(' ')}`
                );
            };
        };
        this.logger.setDefaultLevel('info');
        this.logger.rebuild();
    }

    public trace(message: string, ...details: unknown[]): void {
        this.logger.trace(message, ...details);
    }

    public debug(message: string, ...details: unknown[]): void {
        this.logger.debug(message, ...details);
    }

    public info(message: string, ...details: unknown[]): void {
        this.logger.info(message, ...details);
    }

    public warn(message: string, ...details: unknown[]): void {
        this.logger.warn(message, ...details);
    }

    public error(message: string, ...details: unknown[]): void {
        this.logger.error(message, ...details);
    }

    public show(preserveFocus: boolean = true): void {
        this.outputChannel.show(preserveFocus);
    }

    public dispose(): void {
        this.outputChannel.dispose();
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
