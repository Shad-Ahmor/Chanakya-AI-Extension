# Apache HTTP Server

## Core Principles
- Inspect active configuration before modifying: run `apache2ctl -S` (virtual hosts), `apache2ctl -M` (loaded modules), and read the relevant config file before any change.
- Never blindly replace production configuration. Always back up before editing: `cp /etc/apache2/sites-available/site.conf site.conf.bak`.
- Always run `apache2ctl configtest` / `httpd -t` before reloading — a syntax error prevents Apache from reloading, dropping all traffic.

## Configuration Architecture
- **Debian/Ubuntu**: Root `/etc/apache2/`. Sites in `sites-available/` (enabled via symlinks). Use `a2ensite`, `a2dissite`, `a2enmod`, `a2dismod`.
- **RHEL/CentOS**: Root `/etc/httpd/`. Main config `conf/httpd.conf`. Virtual hosts in `conf.d/`.
- Place virtual host configs in separate files, not in the main `httpd.conf` / `apache2.conf`.

## Virtual Hosts
- `ServerName` is the canonical hostname. `ServerAlias` defines additional hostnames (e.g., `www.`).
- The first virtual host in alphabetical order is the default for unmatched host headers.
- Ensure the port is in a `Listen` directive AND in `<VirtualHost *:PORT>`.

## Document Root
- Every `DocumentRoot` needs a `<Directory>` block with `Require all granted`.
- Always set `Options -Indexes` — never allow public directory listing.
- Set `AllowOverride None` where `.htaccess` is not needed — reduces per-request filesystem overhead.

## SSL/TLS
- Restrict to TLS 1.2 and TLS 1.3: `SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1`.
- Use Let's Encrypt Certbot (`certbot --apache`) for free, auto-renewing certificates.
- Add HSTS: `Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"`.
- Certificate private key files: `chmod 600`, owned by root.

## Security Headers
```apache
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "SAMEORIGIN"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
ServerTokens Prod
ServerSignature Off
TraceEnable Off
```

## Rewrite Rules
- Always add `RewriteEngine On` before `RewriteRule` directives.
- Front controller pattern (Laravel, WordPress):
```apache
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.php [L]
```
- Use `Redirect` for simple static redirects. Use `mod_rewrite` only for dynamic/conditional URL transforms.

## Reverse Proxy
- Enable `mod_proxy` + `mod_proxy_http`. Always set `ProxyRequests Off` (disables open forward proxy).
- Always set `ProxyPreserveHost On` to forward the original `Host` header.
- Set explicit `ProxyTimeout` to prevent workers hanging on slow backends.

## PHP Integration
- **PHP-FPM** (recommended): Works with event MPM, better scalability.
- **`mod_php`**: Embeds PHP in every worker — incompatible with event MPM.
- Never enable both simultaneously.

## Permissions
- Directories: `755`. Files: `644`. Never set `777`.
- Block sensitive files:
```apache
<FilesMatch "^\.env|composer\.(json|lock)$">
    Require all denied
</FilesMatch>
```

## Debugging
- `tail -f /var/log/apache2/error.log` — primary debugging tool.
- 403: Check filesystem permissions and Apache `Require` directives.
- 404: Check `DocumentRoot`, `<Directory>` block, and `RewriteRule` configuration.

## Verification Checklist
- [ ] Has `apache2ctl configtest` returned "Syntax OK" before reloading?
- [ ] Has the existing configuration been backed up before modification?
- [ ] Has `apache2ctl -S` been inspected to understand active virtual host configuration?
- [ ] Are TLS 1.0 and 1.1 explicitly disabled?
- [ ] Is `Options -Indexes` set on all document root directories?
- [ ] Is `ServerTokens Prod` and `ServerSignature Off` configured globally?
- [ ] Are PHP-FPM and `mod_php` not simultaneously enabled?
- [ ] Are sensitive files blocked from being served?
