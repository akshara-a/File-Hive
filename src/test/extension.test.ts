import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Parquet-X extension commands', () => {
    test('registers environment support commands', async () => {
        const extension = vscode.extensions.getExtension('CosmicTechnoid.parquet-x')
            || vscode.extensions.getExtension('cosmictechnoid.parquet-x')
            || vscode.extensions.all.find((candidate) => candidate.packageJSON?.name === 'parquet-x');
        assert.ok(extension, 'Parquet-X extension should be available in the test host');

        await extension.activate();

        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('parquetViewer.setupEnvironment'), 'setup command should be registered');
        assert.ok(commands.includes('parquetViewer.showLogs'), 'show logs command should be registered');
        assert.ok(commands.includes('parquetViewer.resetEnvironment'), 'reset command should be registered');
        assert.ok(commands.includes('parquetViewer.environmentDoctor'), 'environment doctor command should be registered');
    });
});
