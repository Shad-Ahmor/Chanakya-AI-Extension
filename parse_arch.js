const fs = require('fs');
const path = require('path');

function parseFiles(dir) {
    let results = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            results = results.concat(parseFiles(fullPath));
        } else if (fullPath.endsWith('.ts') && !fullPath.includes('.test.')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            
            // Extract class
            const classMatch = content.match(/export class ([A-Za-z0-9_]+)/);
            if (classMatch) {
                const className = classMatch[1];
                
                // Extract imports
                const importMatches = [...content.matchAll(/import.*from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
                
                results.push({ file: fullPath, className, imports: importMatches });
            }
        }
    }
    return results;
}

const data = parseFiles('src/services');
console.log(JSON.stringify(data, null, 2));
