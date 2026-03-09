<?php

if (!defined('ABSPATH')) {
    exit;
}

class EditorJS_WP_Save_Handler {
    public const META_KEY = '_editorjs_wp_data';
    public const META_AUTOSAVED_AT = '_editorjs_wp_autosaved_at';
    public const NONCE_FIELD = 'editorjs_wp_meta_nonce';
    public const AUTOSAVE_ACTION = 'editorjs_wp_autosave';
    public const FRONTEND_SAVE_ACTION = 'editorjs_wp_frontend_save';
    public const FRONTEND_PREVIEW_ACTION = 'editorjs_wp_frontend_preview';
    public const FRONTEND_PUBLISH_ACTION = 'editorjs_wp_frontend_publish';

    public static function init(): void {
        add_action(
            'save_post_' . EditorJS_WP_Settings::TARGET_POST_TYPE,
            [__CLASS__, 'save_post_content'],
            10,
            3
        );
        add_action('wp_ajax_' . self::AUTOSAVE_ACTION, [__CLASS__, 'ajax_autosave']);
        add_action('wp_ajax_' . self::FRONTEND_SAVE_ACTION, [__CLASS__, 'ajax_frontend_save']);
        add_action('wp_ajax_' . self::FRONTEND_PREVIEW_ACTION, [__CLASS__, 'ajax_frontend_preview']);
        add_action('wp_ajax_' . self::FRONTEND_PUBLISH_ACTION, [__CLASS__, 'ajax_frontend_publish']);
    }

    public static function get_saved_data(int $post_id): array {
        $raw = get_post_meta($post_id, self::META_KEY, true);
        if (!is_string($raw) || $raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        $normalized = [
            'time' => isset($decoded['time']) ? (int) $decoded['time'] : (int) round(microtime(true) * 1000),
            'version' => sanitize_text_field((string) ($decoded['version'] ?? '')),
            'blocks' => [],
        ];

        $blocks = isset($decoded['blocks']) && is_array($decoded['blocks']) ? $decoded['blocks'] : [];
        foreach ($blocks as $block) {
            if (!is_array($block) || empty($block['type'])) {
                continue;
            }

            $type = (string) $block['type'];
            if (!EditorJS_WP_Frontend_Renderer::is_supported_block($type)) {
                continue;
            }

            $data = isset($block['data']) && is_array($block['data']) ? $block['data'] : [];
            $normalized['blocks'][] = [
                'type' => $type,
                'data' => self::sanitize_block_data($type, $data),
            ];
        }

        return $normalized;
    }

    public static function save_post_content(int $post_id, WP_Post $post, bool $update): void {
        if (!EditorJS_WP_Settings::is_editor_enabled()) {
            return;
        }

        if (
            defined('DOING_AUTOSAVE')
            && DOING_AUTOSAVE
            && empty($_POST['editorjs_data'])
        ) {
            return;
        }

        if ($post->post_type !== EditorJS_WP_Settings::TARGET_POST_TYPE) {
            return;
        }

        if (wp_is_post_revision($post_id)) {
            return;
        }

        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        if (empty($_POST[self::NONCE_FIELD])) {
            return;
        }

        $nonce = sanitize_text_field(wp_unslash($_POST[self::NONCE_FIELD]));
        if (!wp_verify_nonce($nonce, EditorJS_WP_Settings::NONCE_ACTION)) {
            return;
        }

        $json_raw = isset($_POST['editorjs_data']) ? wp_unslash($_POST['editorjs_data']) : '';
        if (!is_string($json_raw) || $json_raw === '') {
            return;
        }

        $payload = self::normalize_payload($json_raw);
        if ($payload === null) {
            return;
        }

        update_post_meta($post_id, self::META_KEY, self::encode_payload($payload));
        update_post_meta($post_id, self::META_AUTOSAVED_AT, current_time('mysql'));

        $rendered = EditorJS_WP_Frontend_Renderer::render_from_json($payload);
        self::sync_post_content($post_id, $rendered);
    }

    public static function ajax_autosave(): void {
        self::suppress_runtime_warning_output();
        if (!EditorJS_WP_Settings::is_editor_enabled()) {
            wp_send_json_error(['message' => __('Режим Editor.js отключен.', 'editorjs-wordpress')], 400);
        }

        // Nonce is optional to keep frontend autosave working on cached pages.
        $nonce = isset($_POST['_ajax_nonce']) ? sanitize_text_field((string) wp_unslash($_POST['_ajax_nonce'])) : '';
        if ($nonce !== '' && !wp_verify_nonce($nonce, EditorJS_WP_Settings::NONCE_ACTION)) {
            wp_send_json_error(['message' => __('РќРµРґРµР№СЃС‚РІРёС‚РµР»СЊРЅС‹Р№ nonce.', 'editorjs-wordpress')], 403);
        }

        $post_id = isset($_POST['postId']) ? (int) $_POST['postId'] : 0;
        if ($post_id <= 0 || !self::current_user_can_edit_post_relaxed($post_id)) {
            wp_send_json_error(['message' => __('У вас нет прав на редактирование этой записи.', 'editorjs-wordpress')], 403);
        }

        $json_raw = isset($_POST['editorData']) ? wp_unslash($_POST['editorData']) : '';
        if (!is_string($json_raw) || $json_raw === '') {
            wp_send_json_error(['message' => __('Пустые данные.', 'editorjs-wordpress')], 400);
        }

        $payload = self::normalize_payload($json_raw);
        if ($payload === null) {
            wp_send_json_error(['message' => __('Некорректный payload Editor.js.', 'editorjs-wordpress')], 400);
        }

        update_post_meta($post_id, self::META_KEY, self::encode_payload($payload));
        update_post_meta($post_id, self::META_AUTOSAVED_AT, current_time('mysql'));
        self::persist_frontend_post_options($post_id);

        wp_send_json_success(
            [
                'savedAt' => current_time('mysql'),
            ]
        );
    }

    public static function ajax_frontend_save(): void {
        self::suppress_runtime_warning_output();
        $post_id = self::resolve_frontend_post_id();
        self::persist_frontend_payload($post_id, true);

        wp_send_json_success(
            [
                'savedAt' => current_time('mysql'),
                'previewUrl' => self::build_preview_url($post_id),
                'postUrl' => self::build_post_url($post_id),
            ]
        );
    }

    public static function ajax_frontend_preview(): void {
        self::suppress_runtime_warning_output();
        $post_id = self::resolve_frontend_post_id();
        self::persist_frontend_payload($post_id, false);

        $preview_url = self::build_preview_url($post_id);
        if ($preview_url === '') {
            wp_send_json_error(['message' => __('Не удалось сформировать ссылку предпросмотра.', 'editorjs-wordpress')], 400);
        }

        wp_send_json_success(
            [
                'savedAt' => current_time('mysql'),
                'previewUrl' => $preview_url,
                'postUrl' => self::build_post_url($post_id),
            ]
        );
    }

    public static function ajax_frontend_publish(): void {
        self::suppress_runtime_warning_output();
        $post_id = self::resolve_frontend_post_id();
        self::persist_frontend_payload($post_id, false);

        $result = wp_update_post(
            [
                'ID' => $post_id,
                'post_status' => self::resolve_frontend_publish_status($post_id),
            ],
            true
        );

        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()], 400);
        }

        wp_send_json_success(
            [
                'savedAt' => current_time('mysql'),
                'postStatus' => get_post_status($post_id),
                'previewUrl' => self::build_preview_url($post_id),
                'postUrl' => self::build_post_url($post_id),
            ]
        );
    }

    private static function sync_post_content(int $post_id, string $content): void {
        remove_action(
            'save_post_' . EditorJS_WP_Settings::TARGET_POST_TYPE,
            [__CLASS__, 'save_post_content'],
            10
        );

        wp_update_post(
            [
                'ID' => $post_id,
                'post_content' => $content,
            ]
        );

        add_action(
            'save_post_' . EditorJS_WP_Settings::TARGET_POST_TYPE,
            [__CLASS__, 'save_post_content'],
            10,
            3
        );
    }

    private static function resolve_frontend_post_id(): int {
        if (!EditorJS_WP_Settings::is_editor_enabled() || !EditorJS_WP_Settings::is_frontend_editor_enabled()) {
            wp_send_json_error(['message' => __('Фронтенд-режим Editor.js отключен.', 'editorjs-wordpress')], 400);
        }

        $post_id = isset($_POST['postId']) ? (int) $_POST['postId'] : 0;
        if ($post_id <= 0 && isset($_POST['post_ID'])) {
            $post_id = (int) $_POST['post_ID'];
        }
        if ($post_id <= 0) {
            $post_id = self::resolve_post_id_from_request_context();
        }

        if ($post_id <= 0 || !self::current_user_can_edit_post_relaxed($post_id)) {
            wp_send_json_error(['message' => __('У вас нет прав на редактирование этой записи.', 'editorjs-wordpress')], 403);
        }

        // Nonce is intentionally optional for frontend publish pages because
        // some installations serve them through aggressive caching layers.
        // Capability check above remains mandatory.
        $nonce = isset($_POST['_ajax_nonce']) ? sanitize_text_field((string) wp_unslash($_POST['_ajax_nonce'])) : '';
        if ($nonce !== '' && !wp_verify_nonce($nonce, EditorJS_WP_Settings::NONCE_ACTION)) {
            wp_send_json_error(['message' => __('Недействительный nonce.', 'editorjs-wordpress')], 403);
        }

        return $post_id;
    }

    private static function resolve_post_id_from_request_context(): int {
        $keys = ['id', 'post', 'post_id'];
        foreach ($keys as $key) {
            if (!empty($_REQUEST[$key])) {
                return (int) $_REQUEST[$key];
            }
        }

        $referer = wp_get_referer();
        if (!is_string($referer) || $referer === '') {
            return 0;
        }

        $query = wp_parse_url($referer, PHP_URL_QUERY);
        if (!is_string($query) || $query === '') {
            return 0;
        }

        parse_str($query, $params);
        if (!is_array($params)) {
            return 0;
        }

        foreach ($keys as $key) {
            if (!empty($params[$key])) {
                return (int) $params[$key];
            }
        }

        return 0;
    }

    private static function current_user_can_edit_post_relaxed(int $post_id): bool {
        if ($post_id <= 0 || !is_user_logged_in()) {
            return false;
        }

        if (current_user_can('edit_post', $post_id)) {
            return true;
        }

        $post = get_post($post_id);
        if (!$post instanceof WP_Post) {
            return false;
        }

        if ($post->post_type !== EditorJS_WP_Settings::TARGET_POST_TYPE) {
            return false;
        }

        return (int) $post->post_author === (int) get_current_user_id();
    }

    private static function persist_frontend_payload(int $post_id, bool $required): void {
        $json_raw = isset($_POST['editorData']) ? wp_unslash($_POST['editorData']) : '';
        if (!is_string($json_raw) || $json_raw === '') {
            if ($required) {
                wp_send_json_error(['message' => __('Пустые данные.', 'editorjs-wordpress')], 400);
            }
            self::persist_frontend_post_options($post_id);
            return;
        }

        $payload = self::normalize_payload($json_raw);
        if ($payload === null) {
            wp_send_json_error(['message' => __('Некорректный payload Editor.js.', 'editorjs-wordpress')], 400);
        }

        update_post_meta($post_id, self::META_KEY, self::encode_payload($payload));
        update_post_meta($post_id, self::META_AUTOSAVED_AT, current_time('mysql'));

        $rendered = EditorJS_WP_Frontend_Renderer::render_from_json($payload);
        self::sync_post_content($post_id, $rendered);
        self::persist_frontend_post_options($post_id);
    }

    private static function persist_frontend_post_options(int $post_id): void {
        self::persist_frontend_title($post_id);
        self::persist_frontend_excerpt($post_id);
        self::persist_frontend_taxonomies($post_id);
        self::persist_frontend_tags($post_id);
        self::persist_frontend_visibility($post_id);
        self::persist_frontend_featured_image($post_id);
    }

    private static function persist_frontend_title(int $post_id): void {
        if (empty($_POST['postTitle'])) {
            return;
        }

        $raw_title = wp_unslash((string) $_POST['postTitle']);
        $title = sanitize_text_field(self::decode_unicode_sequences($raw_title));
        if ($title === '') {
            return;
        }

        $current_title = get_the_title($post_id);
        if (is_string($current_title) && $current_title === $title) {
            return;
        }

        wp_update_post(
            [
                'ID' => $post_id,
                'post_title' => $title,
            ]
        );
    }

    private static function persist_frontend_taxonomies(int $post_id): void {
        if (!empty($_POST['postCategoryIds'])) {
            $raw_categories = wp_unslash((string) $_POST['postCategoryIds']);
            $decoded = json_decode($raw_categories, true);
            if (is_array($decoded)) {
                $category_ids = array_values(
                    array_unique(
                        array_filter(
                            array_map('intval', $decoded),
                            static function (int $id): bool {
                                return $id > 0;
                            }
                        )
                    )
                );

                wp_set_post_categories($post_id, $category_ids, false);
            }
        }

        if (isset($_POST['postFormat'])) {
            $format = sanitize_key((string) wp_unslash($_POST['postFormat']));
            $allowed_formats = array_keys(get_post_format_strings());

            if ($format === '' || $format === 'standard') {
                set_post_format($post_id, false);
            } elseif (in_array($format, $allowed_formats, true)) {
                set_post_format($post_id, $format);
            }
        }
    }

    private static function persist_frontend_excerpt(int $post_id): void {
        if (!isset($_POST['postExcerpt'])) {
            return;
        }

        $raw_excerpt = wp_unslash((string) $_POST['postExcerpt']);
        $excerpt = sanitize_textarea_field(self::decode_unicode_sequences($raw_excerpt));

        wp_update_post(
            [
                'ID' => $post_id,
                'post_excerpt' => $excerpt,
            ]
        );
    }

    private static function persist_frontend_tags(int $post_id): void {
        if (!isset($_POST['postTags'])) {
            return;
        }

        $raw_tags = self::decode_unicode_sequences((string) wp_unslash($_POST['postTags']));
        $tags = array_values(
            array_filter(
                array_map(
                    static function (string $value): string {
                        return sanitize_text_field(trim($value));
                    },
                    preg_split('/,/', $raw_tags) ?: []
                )
            )
        );

        wp_set_post_tags($post_id, $tags, false);
    }

    private static function persist_frontend_visibility(int $post_id): void {
        if (!isset($_POST['postVisibility'])) {
            return;
        }

        $visibility = sanitize_key((string) wp_unslash($_POST['postVisibility']));
        if (!in_array($visibility, ['public', 'private'], true)) {
            $visibility = 'public';
        }

        update_post_meta($post_id, '_editorjs_wp_visibility', $visibility);
        wp_update_post(
            [
                'ID' => $post_id,
                'post_password' => '',
            ]
        );
    }

    private static function persist_frontend_featured_image(int $post_id): void {
        if (!isset($_POST['postFeaturedImageId'])) {
            return;
        }

        $attachment_id = (int) $_POST['postFeaturedImageId'];
        if ($attachment_id > 0) {
            $attachment = get_post($attachment_id);
            if ($attachment instanceof WP_Post && $attachment->post_type === 'attachment') {
                set_post_thumbnail($post_id, $attachment_id);
                return;
            }
        }

        delete_post_thumbnail($post_id);
    }

    private static function resolve_frontend_publish_status(int $post_id): string {
        $visibility = '';
        if (isset($_POST['postVisibility'])) {
            $visibility = sanitize_key((string) wp_unslash($_POST['postVisibility']));
        } else {
            $stored = get_post_meta($post_id, '_editorjs_wp_visibility', true);
            if (is_string($stored) && $stored !== '') {
                $visibility = sanitize_key($stored);
            }
        }

        if ($visibility === 'private') {
            return 'private';
        }

        return 'publish';
    }

    private static function build_preview_url(int $post_id): string {
        $post = get_post($post_id);
        if (!$post instanceof WP_Post) {
            return '';
        }

        $preview_url = get_preview_post_link($post);
        if (!is_string($preview_url) || $preview_url === '') {
            return '';
        }

        $preview_url = add_query_arg(
            [
                'preview_id' => (string) $post_id,
                'preview_nonce' => wp_create_nonce('post_preview_' . $post_id),
            ],
            $preview_url
        );

        return esc_url_raw($preview_url);
    }

    private static function build_post_url(int $post_id): string {
        $post_url = get_permalink($post_id);
        if (!is_string($post_url) || $post_url === '') {
            return '';
        }

        return esc_url_raw($post_url);
    }

    private static function normalize_payload(string $json_raw): ?array {
        $decoded = json_decode($json_raw, true);
        if (!is_array($decoded) || !isset($decoded['blocks']) || !is_array($decoded['blocks'])) {
            return null;
        }

        $normalized = [
            'time' => isset($decoded['time']) ? (int) $decoded['time'] : (int) round(microtime(true) * 1000),
            'version' => sanitize_text_field((string) ($decoded['version'] ?? '')),
            'blocks' => [],
        ];

        foreach ($decoded['blocks'] as $block) {
            if (!is_array($block) || empty($block['type'])) {
                continue;
            }

            $type = (string) $block['type'];
            if (!EditorJS_WP_Frontend_Renderer::is_supported_block($type)) {
                continue;
            }

            $data = $block['data'] ?? [];
            if (!is_array($data)) {
                $data = [];
            }

            $normalized['blocks'][] = [
                'type' => $type,
                'data' => self::sanitize_block_data($type, $data),
            ];
        }

        return $normalized;
    }

    private static function encode_payload(array $payload): string {
        $encoded = wp_json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || $encoded === '') {
            return '{"time":0,"blocks":[],"version":""}';
        }
        return $encoded;
    }

    private static function sanitize_block_data(string $type, array $data): array {
        switch (strtolower($type)) {
            case 'paragraph':
                return [
                    'text' => wp_kses_post(self::decode_unicode_sequences((string) ($data['text'] ?? ''))),
                ];

            case 'header':
                $level = (int) ($data['level'] ?? 2);
                if ($level < 2 || $level > 6) {
                    $level = 2;
                }
                return [
                    'text' => wp_kses_post(self::decode_unicode_sequences((string) ($data['text'] ?? ''))),
                    'level' => $level,
                ];

            case 'image':
                $url = '';
                if (!empty($data['file']['url'])) {
                    $url = esc_url_raw((string) $data['file']['url']);
                } elseif (!empty($data['url'])) {
                    $url = esc_url_raw((string) $data['url']);
                }

                $attachment_id = 0;
                if (!empty($data['file']['attachmentId'])) {
                    $attachment_id = (int) $data['file']['attachmentId'];
                } elseif (!empty($data['attachmentId'])) {
                    $attachment_id = (int) $data['attachmentId'];
                }

                return [
                    'file' => [
                        'url' => $url,
                        'attachmentId' => $attachment_id > 0 ? $attachment_id : 0,
                    ],
                    'url' => $url,
                    'attachmentId' => $attachment_id > 0 ? $attachment_id : 0,
                    'caption' => wp_kses_post(self::decode_unicode_sequences((string) ($data['caption'] ?? ''))),
                ];

            case 'video':
                $attachment_id = 0;
                if (!empty($data['attachmentId'])) {
                    $attachment_id = (int) $data['attachmentId'];
                } elseif (!empty($data['file']['attachmentId'])) {
                    $attachment_id = (int) $data['file']['attachmentId'];
                }

                return [
                    'url' => esc_url_raw((string) ($data['url'] ?? '')),
                    'caption' => wp_kses_post(self::decode_unicode_sequences((string) ($data['caption'] ?? ''))),
                    'width' => isset($data['width']) ? (int) $data['width'] : 0,
                    'height' => isset($data['height']) ? (int) $data['height'] : 0,
                    'attachmentId' => $attachment_id > 0 ? $attachment_id : 0,
                    'poster' => self::sanitize_video_poster((string) ($data['poster'] ?? '')),
                ];

            case 'code':
                return [
                    'code' => (string) ($data['code'] ?? ''),
                ];

            case 'quote':
                return [
                    'text' => wp_kses_post(self::decode_unicode_sequences((string) ($data['text'] ?? ''))),
                    'caption' => wp_kses_post(self::decode_unicode_sequences((string) ($data['caption'] ?? ''))),
                    'alignment' => sanitize_text_field((string) ($data['alignment'] ?? 'left')),
                ];

            case 'delimiter':
                return [];

            case 'table':
                $content = [];
                if (!empty($data['content']) && is_array($data['content'])) {
                    foreach ($data['content'] as $row) {
                        if (!is_array($row)) {
                            continue;
                        }
                        $content[] = array_map(
                            static function ($cell): string {
                                return wp_kses_post(self::decode_unicode_sequences((string) $cell));
                            },
                            $row
                        );
                    }
                }
                return [
                    'withHeadings' => !empty($data['withHeadings']),
                    'content' => $content,
                ];

            case 'anybutton':
            case 'button':
                return [
                    'link' => esc_url_raw((string) ($data['link'] ?? $data['url'] ?? '')),
                    'text' => sanitize_text_field(
                        self::decode_unicode_sequences((string) ($data['text'] ?? $data['label'] ?? ''))
                    ),
                ];
        }

        return [];
    }

    private static function decode_unicode_sequences(string $value): string {
        if ($value === '') {
            return '';
        }

        $decoded = $value;

        if (strpos($decoded, '\\u') !== false) {
            $decoded = preg_replace_callback(
                '/\\\\u([0-9a-fA-F]{4})/u',
                static function (array $match): string {
                    return html_entity_decode('&#x' . $match[1] . ';', ENT_QUOTES, 'UTF-8');
                },
                $decoded
            );
        }

        if (!preg_match('/[\x{0400}-\x{04FF}]/u', $decoded)) {
            $bare_count = preg_match_all('/(?<!\\\\)u[0-9a-fA-F]{4}/u', $decoded, $matches);
            if (is_int($bare_count) && $bare_count >= 2) {
                $decoded = preg_replace_callback(
                    '/(?<!\\\\)u([0-9a-fA-F]{4})/u',
                    static function (array $match): string {
                        return html_entity_decode('&#x' . $match[1] . ';', ENT_QUOTES, 'UTF-8');
                    },
                    $decoded
                );
            }
        }

        return self::repair_mojibake($decoded);
    }

    private static function repair_mojibake(string $value): string {
        if ($value === '' || !preg_match('/(?:Р.|С.){2,}/u', $value)) {
            return $value;
        }

        if (!function_exists('mb_convert_encoding') || !function_exists('mb_check_encoding')) {
            return $value;
        }

        $reencoded = @mb_convert_encoding($value, 'Windows-1251', 'UTF-8');
        if (!is_string($reencoded) || $reencoded === '' || !mb_check_encoding($reencoded, 'UTF-8')) {
            return $value;
        }

        if (!preg_match('/[\x{0400}-\x{04FF}]/u', $reencoded)) {
            return $value;
        }

        // Accept repaired text only if mojibake marker significantly decreased.
        $before = preg_match_all('/(?:Р.|С.)/u', $value, $before_matches);
        $after = preg_match_all('/(?:Р.|С.)/u', $reencoded, $after_matches);
        if (!is_int($before) || !is_int($after) || $after >= $before) {
            return $value;
        }

        return $reencoded;
    }

    private static function sanitize_video_poster(string $poster): string {
        $poster = trim($poster);
        if ($poster === '') {
            return '';
        }

        if (strlen($poster) > 5000000) {
            return '';
        }

        if (preg_match('/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+\/=\r\n]+$/', $poster) === 1) {
            return $poster;
        }

        return esc_url_raw($poster);
    }

    private static function suppress_runtime_warning_output(): void {
        if (function_exists('ini_set')) {
            @ini_set('display_errors', '0');
            @ini_set('display_startup_errors', '0');
        }
    }
}
