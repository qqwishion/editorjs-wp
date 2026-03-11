<?php

if (!defined('ABSPATH')) {
    exit;
}

class EditorJS_WP_Frontend_Renderer {
    public static function init(): void {
        add_filter('the_content', [__CLASS__, 'filter_the_content'], 20);
        // Load late so plugin content styles override active theme typography/color rules.
        add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue_frontend_assets'], 999);
        // Run before theme/frontend plugins to always intercept the publish route.
        add_action('template_redirect', [__CLASS__, 'maybe_render_frontend_editor_page'], 0);
    }

    public static function maybe_bootstrap_frontend_draft(): void {
        if (is_admin() || !self::is_publish_request()) {
            return;
        }

        if (!EditorJS_WP_Settings::is_editor_enabled() || !EditorJS_WP_Settings::is_frontend_editor_enabled()) {
            return;
        }

        $post_id = self::resolve_publish_request_post_id();
        if ($post_id > 0) {
            return;
        }

        if (!is_user_logged_in()) {
            return;
        }

        $created_post_id = self::create_frontend_draft_for_current_user();
        if ($created_post_id <= 0) {
            return;
        }

        $redirect_target = self::build_publish_editor_url((int) $created_post_id);
        if ($redirect_target === '') {
            return;
        }

        wp_safe_redirect($redirect_target);
        exit;
    }

    public static function enqueue_frontend_assets(): void {
        if (is_admin()) {
            return;
        }

        $publish_post = self::resolve_publish_request_post();
        if ($publish_post && self::is_frontend_editor_mode($publish_post)) {
            EditorJS_WP_Editor_Loader::enqueue_editor_assets((int) $publish_post->ID, false, 'frontend');
            return;
        }

        $post = self::resolve_standard_post();
        if (!$post || !EditorJS_WP_Settings::is_frontend_render_enabled()) {
            return;
        }

        wp_enqueue_style(
            'editorjs-wp-style',
            EDITORJS_WP_URL . 'assets/css/editor-style.css',
            [],
            EDITORJS_WP_VERSION
        );
    }

    public static function filter_the_content(string $content): string {
        if (is_admin()) {
            return $content;
        }

        $publish_post = self::resolve_publish_request_post();
        if ($publish_post && self::is_frontend_editor_mode($publish_post)) {
            return self::render_frontend_editor((int) $publish_post->ID);
        }

        $post = self::resolve_standard_post();
        if (!$post) {
            return $content;
        }

        if (!EditorJS_WP_Settings::is_frontend_render_enabled()) {
            return $content;
        }

        $data = EditorJS_WP_Save_Handler::get_saved_data((int) $post->ID);
        if (empty($data['blocks']) || !is_array($data['blocks'])) {
            return $content;
        }

        return self::render_blocks($data['blocks']);
    }

    public static function maybe_render_frontend_editor_page(): void {
        if (is_admin()) {
            return;
        }

        self::suppress_runtime_warning_output();
        $debug_publish_request = self::should_log_publish_debug();

        if ($debug_publish_request) {
            self::log_publish_debug(
                'template_redirect_enter',
                [
                    'uri' => self::get_request_uri(),
                    'path' => self::get_normalized_request_path(),
                    'postId' => self::resolve_publish_request_post_id(),
                ]
            );
        }

        if (!self::is_publish_request()) {
            if ($debug_publish_request) {
                self::log_publish_debug('skip_not_publish_request');
            }
            return;
        }

        if (!EditorJS_WP_Settings::is_editor_enabled() || !EditorJS_WP_Settings::is_frontend_editor_enabled()) {
            self::log_publish_debug('fallback_editor_disabled');
            self::render_frontend_fallback_page(
                __('Frontend editor is disabled in plugin settings.', 'editorjs-wordpress'),
                200
            );
            exit;
        }

        if (!is_user_logged_in()) {
            $login_url = self::resolve_frontend_login_url();
            self::log_publish_debug(
                'redirect_guest_to_login',
                [
                    'redirect' => $login_url,
                ]
            );
            wp_safe_redirect($login_url);
            exit;
        }

        $post_id = self::resolve_publish_request_post_id();
        if ($post_id <= 0) {
            $created_post_id = self::create_frontend_draft_for_current_user();
            if ($created_post_id > 0) {
                $redirect_target = self::build_publish_editor_url((int) $created_post_id);
                if ($redirect_target !== '') {
                    self::log_publish_debug(
                        'redirect_to_created_draft',
                        [
                            'draftPostId' => (int) $created_post_id,
                            'redirect' => $redirect_target,
                        ]
                    );
                    wp_safe_redirect($redirect_target);
                    exit;
                }
            }

            self::log_publish_debug('fallback_draft_create_failed');
            self::render_frontend_fallback_page(
                __('Could not create a draft for this account.', 'editorjs-wordpress'),
                403
            );
            exit;
        }

        $publish_post = get_post($post_id);
        if (!$publish_post instanceof WP_Post || $publish_post->post_type !== EditorJS_WP_Settings::TARGET_POST_TYPE) {
            self::log_publish_debug(
                'fallback_invalid_publish_url',
                [
                    'postId' => $post_id,
                ]
            );
            self::render_frontend_fallback_page(
                __('Invalid publish URL. Use /publish/?id={post_id}.', 'editorjs-wordpress'),
                400
            );
            exit;
        }

        if (!self::can_current_user_edit_frontend_post($publish_post)) {
            self::log_publish_debug(
                'fallback_forbidden',
                [
                    'postId' => (int) $publish_post->ID,
                    'loggedIn' => is_user_logged_in(),
                ]
            );
            self::render_frontend_fallback_page(
                __('You are not allowed to edit this post.', 'editorjs-wordpress'),
                403
            );
            exit;
        }

        try {
            EditorJS_WP_Editor_Loader::enqueue_editor_assets((int) $publish_post->ID, false, 'frontend');
            self::log_publish_debug(
                'render_frontend_editor_page',
                [
                    'postId' => (int) $publish_post->ID,
                ]
            );

            status_header(200);
            nocache_headers();

            echo '<!DOCTYPE html>';
            echo '<html ' . get_language_attributes() . '>';
            echo '<head>';
            echo '<meta charset="' . esc_attr(get_bloginfo('charset')) . '" />';
            echo '<meta name="viewport" content="width=device-width, initial-scale=1" />';
            echo '<title>' . esc_html(get_bloginfo('name')) . '</title>';
            self::print_frontend_theme_styles();
            echo '<link rel="stylesheet" href="' . esc_url(includes_url('css/admin-bar.min.css')) . '" />';
            echo '<link rel="stylesheet" href="' . esc_url(includes_url('css/dashicons.min.css')) . '" />';
            echo '<link rel="stylesheet" href="' . esc_url(includes_url('css/buttons.min.css')) . '" />';
            echo '<link rel="stylesheet" href="' . esc_url(admin_url('css/forms.min.css')) . '" />';
            echo '<link rel="stylesheet" href="' . esc_url(EDITORJS_WP_URL . 'assets/css/editor-style.css?ver=' . EDITORJS_WP_VERSION) . '" />';
            if (is_admin_bar_showing()) {
                echo '<style>#wpadminbar{position:fixed;top:0;left:0;right:0;z-index:99999;}html{margin-top:32px!important;}@media screen and (max-width:782px){html{margin-top:46px!important;}}</style>';
            }
            echo '</head>';
            echo '<body class="editorjs-wp-frontend-editor-page">';
            if (function_exists('wp_body_open')) {
                wp_body_open();
            }
            echo '<main class="editorjs-wp-frontend-root">';
            echo self::render_frontend_editor((int) $publish_post->ID);
            echo '</main>';
            self::print_frontend_editor_scripts();
            echo '</body>';
            echo '</html>';
            exit;
        } catch (Throwable $error) {
            self::log_publish_debug(
                'render_frontend_editor_exception',
                [
                    'postId' => (int) $publish_post->ID,
                    'message' => $error->getMessage(),
                    'file' => $error->getFile(),
                    'line' => $error->getLine(),
                ]
            );
            if (function_exists('editorjs_wp_log')) {
                editorjs_wp_log(
                    'Frontend editor render failed',
                    [
                        'postId' => (int) $publish_post->ID,
                        'message' => $error->getMessage(),
                        'file' => $error->getFile(),
                        'line' => $error->getLine(),
                    ]
                );
            }

            self::render_frontend_fallback_page(
                __('Frontend editor render failed. See wp-content/editorjs-wp.log', 'editorjs-wordpress'),
                500
            );
            exit;
        }
    }

    public static function resolve_current_post(): ?WP_Post {
        $publish_post = self::resolve_publish_request_post();
        if ($publish_post) {
            return $publish_post;
        }

        return self::resolve_standard_post();
    }

    private static function resolve_standard_post(): ?WP_Post {
        if (!is_singular(EditorJS_WP_Settings::TARGET_POST_TYPE)) {
            return null;
        }

        $post = get_post();
        if (!$post instanceof WP_Post || $post->post_type !== EditorJS_WP_Settings::TARGET_POST_TYPE) {
            return null;
        }

        return $post;
    }

    private static function resolve_publish_request_post(): ?WP_Post {
        if (!self::is_publish_request()) {
            return null;
        }

        $post_id = self::resolve_publish_request_post_id();
        if ($post_id <= 0) {
            return null;
        }

        $post = get_post($post_id);
        if (!$post instanceof WP_Post || $post->post_type !== EditorJS_WP_Settings::TARGET_POST_TYPE) {
            return null;
        }

        return $post;
    }

    private static function resolve_publish_request_post_id(): int {
        $query_keys = ['id', 'post', 'post_id'];
        foreach ($query_keys as $key) {
            if (!empty($_GET[$key])) {
                return (int) $_GET[$key];
            }
        }

        if (function_exists('get_query_var')) {
            foreach ($query_keys as $key) {
                $query_value = get_query_var($key);
                if (!empty($query_value)) {
                    return (int) $query_value;
                }
            }
        }

        $path = self::get_normalized_request_path();
        if (!is_string($path) || $path === '') {
            return 0;
        }

        $path = trim($path, '/');
        if ($path === '') {
            return 0;
        }

        $segments = explode('/', $path);
        $last = array_pop($segments);
        if (is_string($last) && preg_match('/^\d+$/', $last) === 1) {
            return (int) $last;
        }

        return 0;
    }

    private static function get_publish_editor_path(): string {
        $path = EditorJS_WP_Settings::get_frontend_editor_path();
        if (!is_string($path) || $path === '') {
            return 'publish';
        }

        return trim($path, '/');
    }

    private static function get_publish_route_candidates(): array {
        $configured = strtolower(self::get_publish_editor_path());
        $candidates = array_values(
            array_unique(
                array_filter(
                    [$configured, 'publish'],
                    static function ($value): bool {
                        return is_string($value) && $value !== '';
                    }
                )
            )
        );

        return $candidates;
    }

    private static function path_has_suffix(string $path, string $suffix): bool {
        if ($suffix === '') {
            return false;
        }

        if ($path === $suffix) {
            return true;
        }

        $needle = '/' . $suffix;
        return strlen($path) > strlen($needle) && substr($path, -strlen($needle)) === $needle;
    }

    private static function build_publish_editor_url(int $post_id): string {
        if ($post_id <= 0) {
            return '';
        }

        $base_url = '';

        foreach (self::get_publish_route_candidates() as $candidate_path) {
            $publish_page = get_page_by_path($candidate_path);
            if (!$publish_page instanceof WP_Post) {
                continue;
            }

            $permalink = get_permalink($publish_page->ID);
            if (is_string($permalink) && $permalink !== '') {
                $base_url = $permalink;
                break;
            }
        }

        if ($base_url === '') {
            $publish_path = self::get_publish_editor_path();
            if ($publish_path === '') {
                $publish_path = 'publish';
            }
            $base_url = home_url('/' . $publish_path . '/');
        }

        return esc_url_raw(add_query_arg('id', (string) $post_id, $base_url));
    }

    private static function resolve_frontend_login_url(): string {
        $request_uri = self::get_request_uri();
        $redirect_target = $request_uri !== '' ? home_url($request_uri) : home_url('/');
        $default_login_url = home_url('/profile/');

        $login_url = apply_filters(
            'editorjs_wp_frontend_login_url',
            $default_login_url,
            $redirect_target
        );

        if (!is_string($login_url) || $login_url === '') {
            $login_url = wp_login_url($redirect_target);
        } elseif (strpos($login_url, 'redirect_to=') === false) {
            $login_url = add_query_arg('redirect_to', $redirect_target, $login_url);
        }

        return esc_url_raw($login_url);
    }

    private static function is_publish_request(): bool {
        $normalized_path = strtolower(trim(self::get_normalized_request_path(), '/'));
        $candidates = self::get_publish_route_candidates();
        $resolved_post_id = self::resolve_publish_request_post_id();
        $has_post_id = $resolved_post_id > 0;

        $queried_pagename = '';
        if (function_exists('get_query_var')) {
            $queried_pagename = strtolower(trim((string) get_query_var('pagename'), '/'));
        }

        foreach ($candidates as $candidate) {
            if ($candidate === '') {
                continue;
            }

            if (self::path_has_suffix($normalized_path, $candidate)) {
                return true;
            }

            if ($has_post_id && strpos($normalized_path, $candidate) !== false) {
                return true;
            }

            if (is_page($candidate)) {
                return true;
            }

            if ($queried_pagename !== '' && self::path_has_suffix($queried_pagename, $candidate)) {
                return true;
            }

            if (strpos($candidate, '/') !== false) {
                $tail = basename($candidate);
                if (is_string($tail) && $tail !== '' && is_page($tail)) {
                    return true;
                }
            }
        }

        if ($has_post_id && strpos($normalized_path, 'publish') !== false) {
            return true;
        }

        return false;
    }

    private static function get_request_uri(): string {
        if (isset($_SERVER['REQUEST_URI']) && is_string($_SERVER['REQUEST_URI'])) {
            return (string) wp_unslash($_SERVER['REQUEST_URI']);
        }

        return '';
    }

    private static function get_normalized_request_path(): string {
        $request_uri = self::get_request_uri();
        $path = wp_parse_url($request_uri, PHP_URL_PATH);
        $path = is_string($path) ? trim($path) : '';

        $home_path = wp_parse_url(home_url('/'), PHP_URL_PATH);
        if (is_string($home_path) && $home_path !== '') {
            $normalized_home_path = '/' . trim($home_path, '/');
            if ($normalized_home_path !== '/' && strpos($path, $normalized_home_path) === 0) {
                $path = substr($path, strlen($normalized_home_path));
                if (!is_string($path)) {
                    $path = '';
                }
            }
        }

        return (string) $path;
    }

    private static function should_log_publish_debug(): bool {
        $uri = strtolower(self::get_request_uri());
        if ($uri === '') {
            return false;
        }

        if (strpos($uri, 'publish') !== false) {
            return true;
        }

        foreach (self::get_publish_route_candidates() as $candidate) {
            if ($candidate !== '' && strpos($uri, strtolower($candidate)) !== false) {
                return true;
            }
        }

        if (self::resolve_publish_request_post_id() > 0) {
            return true;
        }

        return false;
    }

    /**
     * @param array<string,mixed> $context
     */
    private static function log_publish_debug(string $message, array $context = []): void {
        if (!function_exists('editorjs_wp_log')) {
            return;
        }

        editorjs_wp_log('Frontend publish route: ' . $message, $context);
    }

    public static function is_frontend_editor_mode(?WP_Post $post = null): bool {
        if (!EditorJS_WP_Settings::is_frontend_editor_enabled() || !EditorJS_WP_Settings::is_editor_enabled()) {
            return false;
        }

        // Frontend editor mode is served only on configured route /{path}/?id={post_id}.
        if (!self::is_publish_request()) {
            return false;
        }

        $forced_mode = null;
        if (isset($_GET['editorjs_edit'])) {
            $editor_mode_value = strtolower(sanitize_text_field(wp_unslash($_GET['editorjs_edit'])));
            if (in_array($editor_mode_value, ['1', 'true', 'yes', 'on'], true)) {
                $forced_mode = true;
            } elseif (in_array($editor_mode_value, ['0', 'false', 'no', 'off'], true)) {
                $forced_mode = false;
            }
        }

        if ($forced_mode === false) {
            return false;
        }

        $post = $post ?: self::resolve_publish_request_post();
        if (!$post) {
            return false;
        }

        if (!self::can_current_user_edit_frontend_post($post)) {
            return false;
        }

        if ($forced_mode === true) {
            return true;
        }

        // Default behavior: frontend editor is enabled on configured route.
        return true;
    }

    private static function create_frontend_draft_for_current_user(): int {
        if (!is_user_logged_in()) {
            return 0;
        }

        $created_post_id = wp_insert_post(
            [
                'post_type' => EditorJS_WP_Settings::TARGET_POST_TYPE,
                'post_status' => 'draft',
                'post_author' => get_current_user_id(),
                'post_title' => __('Новый пост', 'editorjs-wordpress'),
            ],
            true
        );

        if (is_wp_error($created_post_id) || (int) $created_post_id <= 0) {
            return 0;
        }

        return (int) $created_post_id;
    }

    private static function can_current_user_edit_frontend_post(WP_Post $post): bool {
        if (!is_user_logged_in()) {
            return false;
        }

        $post_id = (int) $post->ID;
        if ($post_id <= 0) {
            return false;
        }

        if (current_user_can('edit_post', $post_id)) {
            return true;
        }

        return (int) $post->post_author === (int) get_current_user_id();
    }

    private static function render_frontend_editor(int $post_id): string {
        $payload = EditorJS_WP_Save_Handler::get_saved_data($post_id);
        if (empty($payload)) {
            $payload = [
                'time' => (int) round(microtime(true) * 1000),
                'blocks' => [],
                'version' => EditorJS_WP_Editor_Loader::EDITORJS_VERSION,
            ];
        }

        // Keep JSON ASCII-safe in HTML to avoid charset-related mojibake on legacy themes/hosts.
        $json = wp_json_encode($payload, JSON_UNESCAPED_SLASHES);
        if (!is_string($json) || $json === '') {
            $json = '{"time":0,"blocks":[],"version":""}';
        }

        $meta = self::get_frontend_editor_meta($post_id);
        $drafts = self::get_frontend_editor_drafts($post_id);

        $save_label = esc_html__('Сохранить изменения', 'editorjs-wordpress');
        $preview_label = esc_html__('Просмотреть', 'editorjs-wordpress');
        $publish_label = esc_html__('Опубликовать', 'editorjs-wordpress');
        $autosave_label = esc_html__('Автосохранение готово', 'editorjs-wordpress');
        $photo_search_label = esc_html__('Поиск фото', 'editorjs-wordpress');
        $drafts_label = esc_html__('Черновики', 'editorjs-wordpress');
        $title_label = esc_html__('Заголовок', 'editorjs-wordpress');
        $excerpt_label = esc_html__('Отрывок', 'editorjs-wordpress');
        $text_label = esc_html__('Текст', 'editorjs-wordpress');
        $excerpt_help = esc_html__(
            'Отрывок - небольшое описание поста в двух предложениях. Обычно мотивирующее зайти и прочитать текст. Отрывок будет отображаться под заголовком и будет виден всегда, независимо от настроек приватности.',
            'editorjs-wordpress'
        );
        $featured_image_label = esc_html__('Установить изображение записи', 'editorjs-wordpress');
        $featured_image_remove = esc_html__('Удалить изображение', 'editorjs-wordpress');
        $topic_label = esc_html__('Топик', 'editorjs-wordpress');
        $format_label = esc_html__('Формат', 'editorjs-wordpress');
        $tags_label = esc_html__('Метки', 'editorjs-wordpress');
        $access_label = esc_html__('Доступ', 'editorjs-wordpress');
        $access_public_label = esc_html__('Публичный', 'editorjs-wordpress');
        $access_private_label = esc_html__('Приватный', 'editorjs-wordpress');
        $draft_editing_now_label = esc_html__('Вы сейчас редактируете этот пост.', 'editorjs-wordpress');
        $draft_view_label = esc_html__('Просмотреть', 'editorjs-wordpress');
        $draft_edit_label = esc_html__('Редактировать', 'editorjs-wordpress');

        ob_start();
        ?>
        <div class="editorjs-wp-admin-shell editorjs-wp-frontend-shell post-card">
            <div class="editorjs-wp-frontend-top-meta">
                <div id="editorjs-wp-autosave-status" class="editorjs-wp-autosave-status editorjs-wp-autosave-status--top-right" data-state="idle">
                    <?php echo $autosave_label; ?>
                </div>
            </div>

            <?php if (!empty($drafts)): ?>
                <details class="publish-drafts editorjs-wp-drafts">
                    <summary class="publish-drafts__header">
                        <?php echo $drafts_label; ?>
                        <span class="badge"><?php echo (int) count($drafts); ?></span>
                    </summary>
                    <div class="publish-drafts__body">
                        <?php foreach ($drafts as $draft_item): ?>
                            <div class="publish-draft">
                                <div class="publish-draft__title">
                                    <?php if (!empty($draft_item['isCurrent'])): ?>&rarr; <?php endif; ?>
                                    <?php echo esc_html((string) $draft_item['title']); ?>
                                </div>
                                <div class="publish-draft__actions">
                                    <?php if (!empty($draft_item['isCurrent'])): ?>
                                        <?php echo $draft_editing_now_label; ?>
                                    <?php else: ?>
                                        <?php if (!empty($draft_item['viewUrl'])): ?>
                                            <a
                                                href="<?php echo esc_url((string) $draft_item['viewUrl']); ?>"
                                                class="publish-draft__action"
                                                target="_blank"
                                                rel="noopener"
                                            ><?php echo $draft_view_label; ?></a>
                                        <?php endif; ?>
                                        <?php if (!empty($draft_item['editUrl'])): ?>
                                            <a href="<?php echo esc_url((string) $draft_item['editUrl']); ?>" class="publish-draft__action">
                                                <?php echo $draft_edit_label; ?>
                                            </a>
                                        <?php endif; ?>
                                    <?php endif; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </details>
            <?php endif; ?>

            <form class="publish-form js-publish-form" action="" method="post" onsubmit="return false;">
                <div class="publish-form__title editorjs-wp-post-meta editorjs-wp-post-meta--first">
                    <div class="editorjs-wp-post-meta-field editorjs-wp-post-meta-field--title">
                        <label class="editorjs-wp-post-meta-label" for="editorjs-wp-post-title"><?php echo $title_label; ?></label>
                        <input
                            type="text"
                            id="editorjs-wp-post-title"
                            class="editorjs-wp-post-title"
                            autocomplete="off"
                            value="<?php echo esc_attr($meta['title']); ?>"
                        />
                    </div>
                </div>

                <div class="publish-form__excerpt editorjs-wp-post-meta">
                    <div class="editorjs-wp-post-meta-field editorjs-wp-post-meta-field--excerpt">
                        <label class="editorjs-wp-post-meta-label" for="editorjs-wp-post-excerpt"><?php echo $excerpt_label; ?></label>
                        <textarea id="editorjs-wp-post-excerpt" class="editorjs-wp-post-excerpt" rows="4"><?php echo esc_textarea($meta['excerpt']); ?></textarea>
                        <p class="publish-form__description editorjs-wp-post-help-text"><?php echo $excerpt_help; ?></p>
                    </div>
                </div>

                <div class="publish_form__thumbnail editorjs-wp-post-meta" id="postimagediv">
                    <div class="inside editorjs-wp-post-meta-field editorjs-wp-post-meta-field--featured-image">
                        <button type="button" id="editorjs-wp-featured-image-button" class="button button-secondary">
                            <?php echo $featured_image_label; ?>
                        </button>
                        <button
                            type="button"
                            id="editorjs-wp-featured-image-remove"
                            class="button button-link-delete"
                            <?php echo $meta['featuredImageId'] > 0 ? '' : 'style="display:none;"'; ?>
                        >
                            <?php echo $featured_image_remove; ?>
                        </button>
                        <input type="file" id="editorjs-wp-featured-image-file" class="editorjs-wp-hidden" accept="image/*" />
                        <input type="hidden" id="editorjs-wp-featured-image-id" value="<?php echo esc_attr((string) $meta['featuredImageId']); ?>" />
                        <div id="editorjs-wp-featured-image-preview" class="editorjs-wp-featured-image-preview">
                            <?php if (!empty($meta['featuredImageUrl'])): ?>
                                <img src="<?php echo esc_url($meta['featuredImageUrl']); ?>" alt="" loading="lazy" />
                            <?php endif; ?>
                        </div>
                        <div id="editorjs-wp-featured-image-status" class="editorjs-wp-featured-image-status" aria-live="polite"></div>
                    </div>
                </div>

                <div class="editorjs-wp-integration-bar editorjs-wp-integration-bar--frontend">
                    <div class="editorjs-wp-integration-group">
                        <button type="button" id="editorjs-wp-stock-open" class="editorjs-wp-integration-button">
                            <?php echo $photo_search_label; ?>
                        </button>
                    </div>
                </div>

                <div class="publish-form__text editorjs-wp-post-meta">
                    <div class="editorjs-wp-post-meta-field">
                        <label class="editorjs-wp-post-meta-label" for="editorjs-wp-holder"><?php echo $text_label; ?></label>
                        <textarea id="editorjs_wp_data" class="editorjs-wp-hidden"><?php echo esc_textarea($json); ?></textarea>
                        <div id="editorjs-wp-holder" aria-label="<?php esc_attr_e('Редактор контента Editor.js', 'editorjs-wordpress'); ?>"></div>
                    </div>
                </div>

                <div class="publish-form__row editorjs-wp-post-options-row editorjs-wp-post-meta">
                    <div class="publish-form__topic editorjs-wp-post-meta-field editorjs-wp-post-meta-field--categories">
                        <label class="editorjs-wp-post-meta-label" for="editorjs-wp-post-categories"><?php echo $topic_label; ?></label>
                        <select id="editorjs-wp-post-categories" class="editorjs-wp-post-meta-select">
                            <?php foreach ($meta['categories'] as $category_item): ?>
                                <option value="<?php echo esc_attr((string) $category_item['id']); ?>" <?php selected(!empty($category_item['selected'])); ?>>
                                    <?php echo esc_html((string) $category_item['name']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="publish-form__format editorjs-wp-post-meta-field editorjs-wp-post-meta-field--format">
                        <label class="editorjs-wp-post-meta-label" for="editorjs-wp-post-format"><?php echo $format_label; ?></label>
                        <select id="editorjs-wp-post-format" class="editorjs-wp-post-meta-select">
                            <?php foreach ($meta['formats'] as $format_item): ?>
                                <option value="<?php echo esc_attr((string) $format_item['slug']); ?>" <?php selected(!empty($format_item['selected'])); ?>>
                                    <?php echo esc_html((string) $format_item['label']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>

                <div class="publish-form__row editorjs-wp-post-meta">
                    <div class="publish-form__topic editorjs-wp-post-meta-field editorjs-wp-post-meta-field--tags">
                        <label class="editorjs-wp-post-meta-label" for="editorjs-wp-post-tags"><?php echo $tags_label; ?></label>
                        <input
                            type="text"
                            id="editorjs-wp-post-tags"
                            class="editorjs-wp-post-meta-input"
                            value="<?php echo esc_attr($meta['tags']); ?>"
                        />
                    </div>
                </div>

                <div class="publish-form__row editorjs-wp-post-meta">
                    <div class="publish-form__access editorjs-wp-post-meta-field editorjs-wp-post-meta-field--access">
                        <label class="editorjs-wp-post-meta-label" for="editorjs-wp-post-visibility"><?php echo $access_label; ?></label>
                        <select id="editorjs-wp-post-visibility" class="editorjs-wp-post-meta-select">
                            <option value="public" <?php selected($meta['visibility'] === 'public'); ?>><?php echo $access_public_label; ?></option>
                            <option value="private" <?php selected($meta['visibility'] === 'private'); ?>><?php echo $access_private_label; ?></option>
                        </select>
                    </div>
                </div>

                <div class="publish-form__actions editorjs-wp-admin-toolbar editorjs-wp-admin-toolbar--frontend-actions">
                    <div class="editorjs-wp-frontend-controls">
                        <button type="button" id="editorjs-wp-frontend-save" class="editorjs-wp-frontend-save-button">
                            <?php echo $save_label; ?>
                        </button>
                        <button type="button" id="editorjs-wp-frontend-preview" class="editorjs-wp-frontend-save-button editorjs-wp-frontend-preview-button">
                            <?php echo $preview_label; ?>
                        </button>
                        <button type="button" id="editorjs-wp-frontend-publish" class="editorjs-wp-frontend-save-button editorjs-wp-frontend-publish-button">
                            <?php echo $publish_label; ?>
                        </button>
                    </div>
                </div>
            </form>
            <div id="editorjs-wp-frontend-save-result" class="editorjs-wp-frontend-save-result" aria-live="polite"></div>
        </div>
        <?php
        return (string) ob_get_clean();
    }

    /**
     * @return array{
     *   title:string,
     *   excerpt:string,
     *   tags:string,
     *   visibility:string,
     *   password:string,
     *   featuredImageId:int,
     *   featuredImageUrl:string,
     *   categories:array<int,array{id:int,name:string,selected:bool}>,
     *   formats:array<int,array{slug:string,label:string,selected:bool}>
     * }
     */
    private static function get_frontend_editor_meta(int $post_id): array {
        $title = '';
        $excerpt = '';
        $tags = '';
        $visibility = 'public';
        $password = '';
        $selected_categories = [];
        $selected_category_id = 0;
        $selected_format = 'standard';
        $featured_image_id = 0;
        $featured_image_url = '';

        if ($post_id > 0) {
            $title = (string) get_the_title($post_id);
            $excerpt = (string) get_post_field('post_excerpt', $post_id);
            $tags = implode(
                ', ',
                array_values(
                    array_filter(
                        array_map(
                            static function ($term): string {
                                return $term instanceof WP_Term ? (string) $term->name : '';
                            },
                            wp_get_post_tags($post_id)
                        )
                    )
                )
            );
            $selected_categories = array_values(array_filter(array_map('intval', wp_get_post_categories($post_id))));
            if (!empty($selected_categories)) {
                $selected_category_id = (int) reset($selected_categories);
            }
            $post_format = get_post_format($post_id);
            if (is_string($post_format) && $post_format !== '') {
                $selected_format = sanitize_key($post_format);
            }

            $post_status = get_post_status($post_id);
            if ($post_status === 'private') {
                $visibility = 'private';
            } else {
                $password = (string) get_post_field('post_password', $post_id);
                if ($password !== '') {
                    // Old publish template supports only Public/Private.
                    $visibility = 'private';
                }
            }

            $featured_image_id = (int) get_post_thumbnail_id($post_id);
            if ($featured_image_id > 0) {
                $url = wp_get_attachment_image_url($featured_image_id, 'large');
                if (!is_string($url) || $url === '') {
                    $url = wp_get_attachment_url($featured_image_id);
                }
                if (is_string($url) && $url !== '') {
                    $featured_image_url = $url;
                }
            }
        }

        $categories = [];
        $all_categories = get_categories(
            [
                'taxonomy' => 'category',
                'hide_empty' => false,
            ]
        );

        if (is_array($all_categories)) {
            foreach ($all_categories as $term) {
                if (!$term instanceof WP_Term) {
                    continue;
                }

                $term_id = (int) $term->term_id;
                if ($term_id <= 0) {
                    continue;
                }

                $categories[] = [
                    'id' => $term_id,
                    'name' => html_entity_decode((string) $term->name, ENT_QUOTES, 'UTF-8'),
                    'selected' => ($term_id === $selected_category_id),
                ];
            }
        }

        $formats = [
            [
                'slug' => 'standard',
                'label' => __('Стандарт', 'editorjs-wordpress'),
                'selected' => $selected_format === 'standard',
            ],
        ];

        $format_strings = get_post_format_strings();
        if (is_array($format_strings)) {
            foreach ($format_strings as $slug => $label) {
                $safe_slug = sanitize_key((string) $slug);
                if ($safe_slug === '' || $safe_slug === 'standard') {
                    continue;
                }

                $formats[] = [
                    'slug' => $safe_slug,
                    'label' => html_entity_decode((string) $label, ENT_QUOTES, 'UTF-8'),
                    'selected' => $selected_format === $safe_slug,
                ];
            }
        }

        return [
            'title' => $title,
            'excerpt' => $excerpt,
            'tags' => $tags,
            'visibility' => $visibility,
            'password' => $password,
            'featuredImageId' => $featured_image_id,
            'featuredImageUrl' => $featured_image_url,
            'categories' => $categories,
            'formats' => $formats,
        ];
    }

    /**
     * @return array<int,array{id:int,title:string,isCurrent:bool,editUrl:string,viewUrl:string}>
     */
    private static function get_frontend_editor_drafts(int $current_post_id): array {
        if (!is_user_logged_in()) {
            return [];
        }

        $author_id = get_current_user_id();
        if ($author_id <= 0) {
            return [];
        }

        $draft_posts = get_posts(
            [
                'post_type' => EditorJS_WP_Settings::TARGET_POST_TYPE,
                'post_status' => ['draft', 'auto-draft', 'pending'],
                'author' => $author_id,
                'posts_per_page' => 20,
                'orderby' => 'modified',
                'order' => 'DESC',
            ]
        );

        if (!is_array($draft_posts) || empty($draft_posts)) {
            return [];
        }

        $items = [];
        foreach ($draft_posts as $draft_post) {
            if (!$draft_post instanceof WP_Post) {
                continue;
            }

            $draft_id = (int) $draft_post->ID;
            if ($draft_id <= 0) {
                continue;
            }

            $title = trim((string) $draft_post->post_title);
            if ($title === '') {
                $title = __('Без названия', 'editorjs-wordpress');
            }

            $edit_url = self::build_publish_editor_url($draft_id);
            $view_url = get_permalink($draft_id);
            if (!is_string($view_url)) {
                $view_url = '';
            }

            $items[] = [
                'id' => $draft_id,
                'title' => html_entity_decode($title, ENT_QUOTES, 'UTF-8'),
                'isCurrent' => ($draft_id === $current_post_id),
                'editUrl' => $edit_url,
                'viewUrl' => $view_url,
            ];
        }

        return $items;
    }

    public static function is_supported_block(string $type): bool {
        $supported = [
            'paragraph',
            'header',
            'image',
            'video',
            'code',
            'quote',
            'delimiter',
            'table',
            'anybutton',
            'button',
        ];

        return in_array(strtolower($type), $supported, true);
    }

    public static function render_from_json(array $payload): string {
        $blocks = [];
        if (isset($payload['blocks']) && is_array($payload['blocks'])) {
            $blocks = $payload['blocks'];
        }

        return self::render_blocks($blocks);
    }

    public static function render_blocks(array $blocks): string {
        $output = '<div class="editorjs-wp-content">';

        foreach ($blocks as $block) {
            if (!is_array($block) || empty($block['type']) || !is_array($block['data'] ?? null)) {
                continue;
            }

            $type = strtolower((string) $block['type']);
            $data = $block['data'];

            switch ($type) {
                case 'paragraph':
                    $output .= self::render_paragraph($data);
                    break;
                case 'header':
                    $output .= self::render_header($data);
                    break;
                case 'image':
                    $output .= self::render_image($data);
                    break;
                case 'video':
                    $output .= self::render_video($data);
                    break;
                case 'code':
                    $output .= self::render_code($data);
                    break;
                case 'quote':
                    $output .= self::render_quote($data);
                    break;
                case 'delimiter':
                    $output .= '<hr class="editorjs-wp-delimiter" />';
                    break;
                case 'table':
                    $output .= self::render_table($data);
                    break;
                case 'anybutton':
                case 'button':
                    $output .= self::render_button($data);
                    break;
            }
        }

        $output .= '</div>';
        return $output;
    }

    private static function render_paragraph(array $data): string {
        $text = self::sanitize_rich_text_output((string) ($data['text'] ?? ''));
        if ($text === '') {
            return '';
        }

        return sprintf('<p>%s</p>', $text);
    }

    private static function render_header(array $data): string {
        $text = self::sanitize_rich_text_output((string) ($data['text'] ?? ''));
        if ($text === '') {
            return '';
        }

        $level = (int) ($data['level'] ?? 2);
        if ($level < 2 || $level > 6) {
            $level = 2;
        }

        return sprintf('<h%1$d>%2$s</h%1$d>', $level, $text);
    }

    private static function render_image(array $data): string {
        $url = '';

        $attachment_id = 0;
        if (!empty($data['file']['attachmentId'])) {
            $attachment_id = (int) $data['file']['attachmentId'];
        } elseif (!empty($data['attachmentId'])) {
            $attachment_id = (int) $data['attachmentId'];
        }

        if ($attachment_id <= 0) {
            if (!empty($data['file']['url'])) {
                $attachment_id = self::resolve_attachment_id_from_url((string) $data['file']['url']);
            } elseif (!empty($data['url'])) {
                $attachment_id = self::resolve_attachment_id_from_url((string) $data['url']);
            }
        }

        if ($attachment_id > 0) {
            $resolved_url = wp_get_attachment_url($attachment_id);
            if (is_string($resolved_url) && $resolved_url !== '') {
                $url = esc_url($resolved_url);
            }
        }

        if ($url === '' && !empty($data['file']['url'])) {
            $url = esc_url((string) $data['file']['url']);
        } elseif ($url === '' && !empty($data['url'])) {
            $url = esc_url((string) $data['url']);
        }

        if ($url === '') {
            return '';
        }

        $caption = self::sanitize_rich_text_output((string) ($data['caption'] ?? ''));

        $html = '<figure class="editorjs-wp-media editorjs-wp-image">';
        $html .= sprintf('<img src="%s" alt="" loading="lazy" />', $url);

        if ($caption !== '') {
            $html .= sprintf('<figcaption>%s</figcaption>', $caption);
        }

        $html .= '</figure>';
        return $html;
    }

    private static function render_video(array $data): string {
        $url = '';
        $attachment_id = !empty($data['attachmentId']) ? (int) $data['attachmentId'] : 0;
        if ($attachment_id <= 0 && !empty($data['url'])) {
            $attachment_id = self::resolve_attachment_id_from_url((string) $data['url']);
        }

        if ($attachment_id > 0) {
            $resolved_url = wp_get_attachment_url($attachment_id);
            if (is_string($resolved_url) && $resolved_url !== '') {
                $url = esc_url($resolved_url);
            }
        }

        if ($url === '') {
            $url = esc_url((string) ($data['url'] ?? ''));
        }

        if ($url === '') {
            return '';
        }

        $caption = self::sanitize_rich_text_output((string) ($data['caption'] ?? ''));
        $poster = self::sanitize_video_poster_for_output((string) ($data['poster'] ?? ''));
        $preload = $poster !== '' ? 'none' : 'metadata';

        $html = '<figure class="editorjs-wp-media editorjs-wp-video">';
        $poster_attr = $poster !== '' ? sprintf(' poster="%s"', esc_attr($poster)) : '';
        $html .= sprintf(
            '<video controls preload="%1$s" playsinline%2$s><source src="%3$s" /></video>',
            esc_attr($preload),
            $poster_attr,
            $url
        );

        if ($caption !== '') {
            $html .= sprintf('<figcaption>%s</figcaption>', $caption);
        }

        $html .= '</figure>';
        return $html;
    }

    private static function render_code(array $data): string {
        $code = (string) ($data['code'] ?? '');
        if ($code === '') {
            return '';
        }

        return sprintf(
            '<pre class="editorjs-wp-code"><code>%s</code></pre>',
            esc_html($code)
        );
    }

    private static function render_quote(array $data): string {
        $text = self::sanitize_rich_text_output((string) ($data['text'] ?? ''));
        if ($text === '') {
            return '';
        }

        $caption = self::sanitize_rich_text_output((string) ($data['caption'] ?? ''));

        $html = '<blockquote class="editorjs-wp-quote">';
        $html .= sprintf('<p>%s</p>', $text);

        if ($caption !== '') {
            $html .= sprintf('<cite>%s</cite>', $caption);
        }

        $html .= '</blockquote>';
        return $html;
    }

    private static function render_table(array $data): string {
        if (empty($data['content']) || !is_array($data['content'])) {
            return '';
        }

        $with_headings = !empty($data['withHeadings']);
        $rows = '';

        foreach ($data['content'] as $index => $row) {
            if (!is_array($row)) {
                continue;
            }

            $cell_tag = ($with_headings && $index === 0) ? 'th' : 'td';
            $cells = '';

            foreach ($row as $cell) {
                $cells .= sprintf(
                    '<%1$s>%2$s</%1$s>',
                    $cell_tag,
                    self::sanitize_rich_text_output((string) $cell)
                );
            }

            $rows .= sprintf('<tr>%s</tr>', $cells);
        }

        if ($rows === '') {
            return '';
        }

        return sprintf(
            '<div class="editorjs-wp-table-wrap"><table class="editorjs-wp-table">%s</table></div>',
            $rows
        );
    }

    private static function render_button(array $data): string {
        $url = esc_url((string) ($data['link'] ?? $data['url'] ?? ''));
        $text = sanitize_text_field((string) ($data['text'] ?? $data['label'] ?? ''));

        if ($url === '' || $text === '') {
            return '';
        }

        return sprintf(
            '<p class="editorjs-wp-button-wrap"><a class="editorjs-wp-button" href="%1$s" target="_blank" rel="noopener nofollow">%2$s</a></p>',
            $url,
            esc_html($text)
        );
    }

    private static function sanitize_rich_text_output(string $html): string {
        $safe = wp_kses_post($html);
        if ($safe === '') {
            return '';
        }

        $without_presentation = preg_replace(
            '/\s(?:style|color|bgcolor)\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+)/iu',
            '',
            $safe
        );

        if (is_string($without_presentation) && $without_presentation !== '') {
            return $without_presentation;
        }

        return $safe;
    }

    private static function sanitize_video_poster_for_output(string $poster): string {
        $poster = trim($poster);
        if ($poster === '') {
            return '';
        }

        if (preg_match('/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+\/=\r\n]+$/', $poster) === 1) {
            return $poster;
        }

        return esc_url($poster);
    }

    private static function resolve_attachment_id_from_url(string $url): int {
        $url = trim($url);
        if ($url === '') {
            return 0;
        }

        $attachment_id = attachment_url_to_postid($url);
        if ($attachment_id > 0) {
            return (int) $attachment_id;
        }

        global $wpdb;

        $by_guid = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'attachment' AND guid = %s LIMIT 1",
                $url
            )
        );
        if ($by_guid > 0) {
            return $by_guid;
        }

        $path = wp_parse_url($url, PHP_URL_PATH);
        $basename = is_string($path) ? wp_basename($path) : '';
        if ($basename === '') {
            return 0;
        }

        $meta_like = '%' . $wpdb->esc_like($basename);
        $by_meta = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attached_file' AND meta_value LIKE %s LIMIT 1",
                $meta_like
            )
        );

        return $by_meta > 0 ? $by_meta : 0;
    }

    private static function render_frontend_fallback_page(string $message, int $status = 200): void {
        self::suppress_runtime_warning_output();
        status_header($status);
        nocache_headers();

        echo '<!DOCTYPE html>';
        echo '<html ' . get_language_attributes() . '>';
        echo '<head>';
        echo '<meta charset="' . esc_attr(get_bloginfo('charset')) . '" />';
        echo '<meta name="viewport" content="width=device-width, initial-scale=1" />';
        echo '<title>' . esc_html(get_bloginfo('name')) . '</title>';
        echo '<link rel="stylesheet" href="' . esc_url(EDITORJS_WP_URL . 'assets/css/editor-style.css?ver=' . EDITORJS_WP_VERSION) . '" />';
        echo '</head>';
        echo '<body class="editorjs-wp-frontend-editor-page">';
        if (function_exists('wp_body_open')) {
            wp_body_open();
        }
        echo '<main class="editorjs-wp-frontend-root" style="max-width:760px;margin:32px auto;padding:0 16px;">';
        echo '<p>' . esc_html($message) . '</p>';
        echo '</main>';
        echo '</body>';
        echo '</html>';
    }

    private static function suppress_runtime_warning_output(): void {
        if (function_exists('ini_set')) {
            @ini_set('display_errors', '0');
            @ini_set('display_startup_errors', '0');
        }
    }

    private static function print_frontend_editor_scripts(): void {
        $handles = [
            'editorjs-core',
            'editorjs-paragraph',
            'editorjs-header',
            'editorjs-image',
            'editorjs-code',
            'editorjs-quote',
            'editorjs-delimiter',
            'editorjs-table',
            'editorjs-drag-drop',
            'editorjs-wp-tools',
            'editorjs-wp-autosaves',
            'editorjs-wp-integrations',
            'editorjs-wp-runtime-guard',
            'editorjs-wp-init',
        ];

        foreach ($handles as $handle) {
            if (wp_script_is($handle, 'enqueued') || wp_script_is($handle, 'registered')) {
                wp_print_scripts($handle);
            }
        }
    }

    private static function print_frontend_theme_styles(): void {
        $style_urls = [];

        $stylesheet_uri = get_stylesheet_uri();
        if (is_string($stylesheet_uri) && $stylesheet_uri !== '') {
            $style_urls[] = $stylesheet_uri;
        }

        $template_style_uri = trailingslashit(get_template_directory_uri()) . 'style.css';
        if (is_string($template_style_uri) && $template_style_uri !== '') {
            $style_urls[] = $template_style_uri;
        }

        $candidate_files = [
            [
                'path' => trailingslashit(get_stylesheet_directory()) . 'assets/public/css/style.min.css',
                'uri' => trailingslashit(get_stylesheet_directory_uri()) . 'assets/public/css/style.min.css',
            ],
            [
                'path' => trailingslashit(get_template_directory()) . 'assets/public/css/style.min.css',
                'uri' => trailingslashit(get_template_directory_uri()) . 'assets/public/css/style.min.css',
            ],
        ];

        foreach ($candidate_files as $candidate) {
            $path = isset($candidate['path']) && is_string($candidate['path']) ? $candidate['path'] : '';
            $uri = isset($candidate['uri']) && is_string($candidate['uri']) ? $candidate['uri'] : '';
            if ($path === '' || $uri === '') {
                continue;
            }
            if (is_readable($path)) {
                $style_urls[] = $uri;
            }
        }

        $style_urls = array_values(
            array_unique(
                array_filter(
                    $style_urls,
                    static function ($url): bool {
                        return is_string($url) && $url !== '';
                    }
                )
            )
        );

        foreach ($style_urls as $url) {
            echo '<link rel="stylesheet" href="' . esc_url($url) . '" />';
        }
    }
}


