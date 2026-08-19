const fs = require('fs');
const html = fs.readFileSync('./dist/webview/index.html', 'utf8');
const nonce = 'TEST_NONCE_123';
const csp = "default-src 'none'; img-src vscode-webview-resource: https: data:; script-src 'nonce-" + nonce + "' 'unsafe-inline'; style-src vscode-webview-resource: 'unsafe-inline'; font-src vscode-webview-resource:; connect-src https: http:";

let newHtml = html.replace(
  '<head>',
  `<head>
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <script nonce="${nonce}">
      window.onerror = function(msg) { console.log(msg); };
    </script>`
);

newHtml = newHtml.replace(/<script(?! nonce)/g, `<script nonce="${nonce}"`);

fs.writeFileSync('./test-output.html', newHtml);
console.log("Replaced. Checking scripts:");
const scripts = newHtml.match(/<script[^>]*>/g);
console.log(scripts);
