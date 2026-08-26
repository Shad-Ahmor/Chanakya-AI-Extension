const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function runGitCommand(command) {
    try {
        return execSync(command).toString().trim();
    } catch (e) {
        return 'unknown';
    }
}

function generateMetadata() {
    const rootDir = path.resolve(__dirname, '..');
    const packageJsonPath = path.join(rootDir, 'package.json');
    const outputPath = path.join(rootDir, 'build-metadata.json');

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const now = new Date();
    const buildId = now.toISOString().replace(/[-T:]/g, '').split('.')[0]; // YYYYMMDDHHmmss
    
    // Create a readable formatted date
    const formattedDate = new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZoneName: 'short'
    }).format(now);

    const commit = runGitCommand('git rev-parse --short HEAD');
    const branch = runGitCommand('git branch --show-current');

    const metadata = {
        version: pkg.version || '0.0.0',
        publisher: pkg.publisher || 'Unknown',
        buildTime: now.toISOString(),
        formattedBuildTime: formattedDate,
        buildId: buildId,
        commit: commit,
        branch: branch,
        vscodeEngine: pkg.engines?.vscode || 'Unknown'
    };

    fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
    console.log(`[Build] Generated build metadata: ${metadata.version} (Build: ${buildId})`);
}

generateMetadata();
