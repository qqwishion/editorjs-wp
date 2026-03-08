<?php

if (!defined('ABSPATH')) {
    exit;
}

class EditorJS_WP_Settings {
    public const OPTION_GROUP = 'editorjs_wp_settings_group';
    public const OPTION_EDITOR_ENABLED = 'editorjs_wp_enabled';
    public const OPTION_FRONTEND_RENDER = 'editorjs_wp_frontend_render';
    public const OPTION_FRONTEND_EDITOR = 'editorjs_wp_frontend_editor';
    public const OPTION_FRONTEND_EDITOR_PATH = 'editorjs_wp_frontend_editor_path';
    public const NONCE_ACTION = 'editorjs_wp_nonce_action';
    public const TARGET_POST_TYPE = 'post';

    public static function init(): void {
        add_action('admin_menu', [__CLASS__, 'register_menu']);
        add_action('admin_init', [__CLASS__, 'register_settings']);
    }

    public static function is_editor_enabled(): bool {
        return (bool) get_option(self::OPTION_EDITOR_ENABLED, 1);
    }

    public static function is_frontend_render_enabled(): bool {
        return (bool) get_option(self::OPTION_FRONTEND_RENDER, 1);
    }

    public static function is_frontend_editor_enabled(): bool {
        return (bool) get_option(self::OPTION_FRONTEND_EDITOR, 1);
    }

    public static function get_frontend_editor_path(): string {
        $path = get_option(self::OPTION_FRONTEND_EDITOR_PATH, 'publish');
        if (!is_string($path) || $path === '') {
            return 'publish';
        }

        return self::sanitize_frontend_path($path);
    }

    public static function register_menu(): void {
        add_options_page(
            __('Настройки Editor.js', 'editorjs-wordpress'),
            __('Editor.js', 'editorjs-wordpress'),
            'manage_options',
            'editorjs-wp-settings',
            [__CLASS__, 'render_page']
        );
    }

    public static function register_settings(): void {
        register_setting(
            self::OPTION_GROUP,
            self::OPTION_EDITOR_ENABLED,
            [
                'type' => 'integer',
                'sanitize_callback' => [__CLASS__, 'sanitize_checkbox'],
                'default' => 1,
            ]
        );

        register_setting(
            self::OPTION_GROUP,
            self::OPTION_FRONTEND_RENDER,
            [
                'type' => 'integer',
                'sanitize_callback' => [__CLASS__, 'sanitize_checkbox'],
                'default' => 1,
            ]
        );

        register_setting(
            self::OPTION_GROUP,
            self::OPTION_FRONTEND_EDITOR,
            [
                'type' => 'integer',
                'sanitize_callback' => [__CLASS__, 'sanitize_checkbox'],
                'default' => 1,
            ]
        );

        register_setting(
            self::OPTION_GROUP,
            self::OPTION_FRONTEND_EDITOR_PATH,
            [
                'type' => 'string',
                'sanitize_callback' => [__CLASS__, 'sanitize_frontend_path'],
                'default' => 'publish',
            ]
        );

        add_settings_section(
            'editorjs_wp_main',
            __('Режим Editor.js', 'editorjs-wordpress'),
            '__return_false',
            'editorjs-wp-settings'
        );

        add_settings_field(
            self::OPTION_EDITOR_ENABLED,
            __('Использовать Editor.js вместо Gutenberg (записи)', 'editorjs-wordpress'),
            [__CLASS__, 'render_editor_enabled_field'],
            'editorjs-wp-settings',
            'editorjs_wp_main'
        );

        add_settings_field(
            self::OPTION_FRONTEND_RENDER,
            __('Рендерить блоки Editor.js на фронтенде', 'editorjs-wordpress'),
            [__CLASS__, 'render_frontend_render_field'],
            'editorjs-wp-settings',
            'editorjs_wp_main'
        );

        add_settings_field(
            self::OPTION_FRONTEND_EDITOR,
            __('Включить фронтенд-режим Editor.js', 'editorjs-wordpress'),
            [__CLASS__, 'render_frontend_editor_field'],
            'editorjs-wp-settings',
            'editorjs_wp_main'
        );

        add_settings_field(
            self::OPTION_FRONTEND_EDITOR_PATH,
            __('URL фронтенд-редактора', 'editorjs-wordpress'),
            [__CLASS__, 'render_frontend_editor_path_field'],
            'editorjs-wp-settings',
            'editorjs_wp_main'
        );
    }

    public static function sanitize_checkbox($value): int {
        return empty($value) ? 0 : 1;
    }

    public static function sanitize_frontend_path($value): string {
        $path = sanitize_text_field((string) $value);
        $path = trim($path);
        if ($path === '') {
            return 'publish';
        }

        $parsed_url_path = wp_parse_url($path, PHP_URL_PATH);
        if (is_string($parsed_url_path) && $parsed_url_path !== '') {
            $path = $parsed_url_path;
        } else {
            $query_cut = strpos($path, '?');
            if (is_int($query_cut) && $query_cut >= 0) {
                $path = substr($path, 0, $query_cut);
            }

            $hash_cut = strpos($path, '#');
            if (is_int($hash_cut) && $hash_cut >= 0) {
                $path = substr($path, 0, $hash_cut);
            }
        }

        $path = str_replace('\\', '/', (string) $path);
        $path = trim((string) $path, " \t\n\r\0\x0B/");
        $path = preg_replace('#/{2,}#', '/', (string) $path);

        $parts = explode('/', (string) $path);
        $safe_parts = [];
        foreach ($parts as $part) {
            $part = preg_replace('#[^A-Za-z0-9_-]+#', '', (string) $part);
            $part = (string) $part;
            if ($part !== '') {
                $safe_parts[] = $part;
            }
        }

        $path = implode('/', $safe_parts);

        if ($path === '') {
            return 'publish';
        }

        return $path;
    }

    public static function render_editor_enabled_field(): void {
        printf(
            '<label><input type="checkbox" name="%1$s" value="1" %2$s /> %3$s</label>',
            esc_attr(self::OPTION_EDITOR_ENABLED),
            checked(1, (int) get_option(self::OPTION_EDITOR_ENABLED, 1), false),
            esc_html__('Отключает Gutenberg для записей и включает метабокс Editor.js.', 'editorjs-wordpress')
        );
    }

    public static function render_frontend_render_field(): void {
        printf(
            '<label><input type="checkbox" name="%1$s" value="1" %2$s /> %3$s</label>',
            esc_attr(self::OPTION_FRONTEND_RENDER),
            checked(1, (int) get_option(self::OPTION_FRONTEND_RENDER, 1), false),
            esc_html__(
                'Использовать динамический рендер из Editor.js JSON. Если выключено, используется сохраненный post_content HTML.',
                'editorjs-wordpress'
            )
        );
    }

    public static function render_frontend_editor_field(): void {
        printf(
            '<label><input type="checkbox" name="%1$s" value="1" %2$s /> %3$s</label>',
            esc_attr(self::OPTION_FRONTEND_EDITOR),
            checked(1, (int) get_option(self::OPTION_FRONTEND_EDITOR, 1), false),
            esc_html__('Включает фронтенд-редактор на настроенном URL (например: publish/?id={post_id}) для пользователей с правом редактирования. Временно отключить можно параметром ?editorjs_edit=0.', 'editorjs-wordpress')
        );
    }

    public static function render_frontend_editor_path_field(): void {
        $path = self::get_frontend_editor_path();

        printf(
            '<input type="text" name="%1$s" value="%2$s" class="regular-text" placeholder="publish" />',
            esc_attr(self::OPTION_FRONTEND_EDITOR_PATH),
            esc_attr($path)
        );

        echo '<p class="description">';
        echo esc_html__('Относительный путь страницы редактора без домена. Примеры: publish, write/post. Ссылка формируется как /{path}/?id={post_id}.', 'editorjs-wordpress');
        echo '</p>';
    }

    public static function render_page(): void {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Настройки Editor.js', 'editorjs-wordpress'); ?></h1>
            <form method="post" action="options.php">
                <?php settings_fields(self::OPTION_GROUP); ?>
                <?php do_settings_sections('editorjs-wp-settings'); ?>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
}
