# WordPress

## Core Principles
- Never modify WordPress core files (`wp-includes/`, `wp-admin/`, `wp-login.php`). Core is overwritten on every update.
- Use WordPress's hook system for all customization. Find the appropriate action or filter — never bypass the pipeline.
- Always sanitize input when data enters the system. Always escape output when data exits the system. These are two separate mandatory operations.

## Hooks: Actions & Filters
- `add_action()` attaches functionality. Actions do not return values.
- `add_filter()` modifies data. Filter callbacks MUST always `return` the (possibly modified) value.
- Anonymous functions cannot be removed with `remove_action()` / `remove_filter()`. Use named functions or stored references for hooks that may need removal.
- Prefix custom hook names with a project prefix: `myplugin_before_process`.

## Plugin Architecture
- Every plugin needs a properly formatted file header with `Plugin Name`, `Version`, `Requires PHP`.
- Prefix ALL function names, class names, globals, option names, and DB table names with a unique plugin prefix.
- Use `register_activation_hook()`, `register_deactivation_hook()`, `register_uninstall_hook()` for lifecycle events.
- Never place plugin logic in `functions.php` — it disappears if the theme changes.
- Add `if (!defined('ABSPATH')) { exit; }` as the first line of every PHP file.

## Nonces (CSRF Protection)
- Generate: `wp_create_nonce('action-name')`, `wp_nonce_field('action-name')`.
- Verify: `check_ajax_referer('action-name')` for AJAX, `wp_verify_nonce($_POST['_wpnonce'], 'action-name')` for forms.
- Always verify nonces before processing any form submission or AJAX request.

## Sanitization & Escaping
- **Sanitization (input)**: `sanitize_text_field()`, `sanitize_email()`, `absint()`, `wp_kses_post()`, `sanitize_url()`.
- **Escaping (output)**: `esc_html()`, `esc_attr()`, `esc_url()`, `esc_js()`, `wp_kses_post()`.
- Escape as close to the output point as possible (late escaping).

## Capabilities & Authorization
- Always verify capabilities: `if (!current_user_can('manage_options')) { wp_die(...); }`.
- Never trust client-supplied role values. Derive identity from verified authentication.
- Use `permission_callback` in REST API routes — never `'__return_true'` for sensitive endpoints.

## Database
- Use `$wpdb->prepare()` for ALL queries with dynamic values — it prevents SQL injection.
- Always use `$wpdb->prefix` for table names — never hardcode `wp_`.
- Prefer `WP_Query`, `get_posts()`, `get_terms()` over raw `$wpdb` queries for WordPress data.

## Security
- `define('DISALLOW_FILE_EDIT', true)` in `wp-config.php` — disables admin file editor.
- `define('FORCE_SSL_ADMIN', true)` — forces HTTPS for admin.
- `WP_DEBUG = false` and `WP_DEBUG_DISPLAY = false` in production.

## Performance & Caching
- Use Transients API (`set_transient()` / `get_transient()`) to cache expensive query results with expiry.
- Set `'no_found_rows' => true` on `WP_Query` when pagination is not needed.
- Never query the database inside `while (have_posts())` loops.

## Enqueueing
- Always enqueue scripts/styles via `wp_enqueue_scripts` or `admin_enqueue_scripts` hooks — never `<link>` or `<script>` tags directly.
- Use `wp_localize_script()` to pass PHP data to JavaScript — never output PHP variables directly into `<script>` tags.

## Verification Checklist
- [ ] Are all WordPress core files untouched?
- [ ] Are all customizations implemented through actions, filters, themes, or plugins?
- [ ] Is all user input sanitized using `sanitize_*()` before saving?
- [ ] Is all output escaped using `esc_*()` before rendering?
- [ ] Are nonces generated and verified for all form submissions and AJAX requests?
- [ ] Are capability checks applied before all privileged operations?
- [ ] Are all plugin functions and options prefixed to avoid conflicts?
- [ ] Are all `$wpdb` queries using `$wpdb->prepare()` for dynamic values?
- [ ] Is `if (!defined('ABSPATH')) { exit; }` present in all PHP files?
- [ ] Is `WP_DEBUG_DISPLAY` set to `false` in production?
