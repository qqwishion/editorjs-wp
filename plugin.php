<?php
/**
 * Plugin Name: EditorJS WordPress
 * Description: Replaces Gutenberg with Editor.js in wp-admin and renders Editor.js content on frontend.
 * Version: 1.3.13
 * Author: qqwishion
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('EDITORJS_WP_VERSION', '1.3.13');
define('EDITORJS_WP_FILE', __FILE__);
define('EDITORJS_WP_DIR', plugin_dir_path(__FILE__));
define('EDITORJS_WP_URL', plugin_dir_url(__FILE__));

// Mitigate AWS SDK open_basedir warnings on hosts where ~/.aws/* is forbidden.
if (defined('WP_CONTENT_DIR')) {
    $aws_config_fallback = WP_CONTENT_DIR . '/aws-config';
    $aws_credentials_fallback = WP_CONTENT_DIR . '/aws-credentials';
    $aws_home_fallback = WP_CONTENT_DIR;

    if (function_exists('putenv')) {
        if (($value = getenv('AWS_SDK_LOAD_NONDEFAULT_CONFIG')) === false || $value === '') {
            putenv('AWS_SDK_LOAD_NONDEFAULT_CONFIG=0');
        }
        if (($value = getenv('AWS_CONFIG_FILE')) === false || $value === '') {
            putenv('AWS_CONFIG_FILE=' . $aws_config_fallback);
        }
        if (($value = getenv('AWS_SHARED_CREDENTIALS_FILE')) === false || $value === '') {
            putenv('AWS_SHARED_CREDENTIALS_FILE=' . $aws_credentials_fallback);
        }
        if (($value = getenv('AWS_EC2_METADATA_DISABLED')) === false || $value === '') {
            putenv('AWS_EC2_METADATA_DISABLED=true');
        }
        if (($value = getenv('HOME')) === false || $value === '') {
            putenv('HOME=' . $aws_home_fallback);
        }
    }

    if (empty($_ENV['AWS_SDK_LOAD_NONDEFAULT_CONFIG'])) {
        $_ENV['AWS_SDK_LOAD_NONDEFAULT_CONFIG'] = '0';
    }
    if (empty($_SERVER['AWS_SDK_LOAD_NONDEFAULT_CONFIG'])) {
        $_SERVER['AWS_SDK_LOAD_NONDEFAULT_CONFIG'] = '0';
    }
    if (empty($_ENV['AWS_CONFIG_FILE'])) {
        $_ENV['AWS_CONFIG_FILE'] = $aws_config_fallback;
    }
    if (empty($_SERVER['AWS_CONFIG_FILE'])) {
        $_SERVER['AWS_CONFIG_FILE'] = $aws_config_fallback;
    }
    if (empty($_ENV['AWS_SHARED_CREDENTIALS_FILE'])) {
        $_ENV['AWS_SHARED_CREDENTIALS_FILE'] = $aws_credentials_fallback;
    }
    if (empty($_SERVER['AWS_SHARED_CREDENTIALS_FILE'])) {
        $_SERVER['AWS_SHARED_CREDENTIALS_FILE'] = $aws_credentials_fallback;
    }
    if (empty($_ENV['AWS_EC2_METADATA_DISABLED'])) {
        $_ENV['AWS_EC2_METADATA_DISABLED'] = 'true';
    }
    if (empty($_SERVER['AWS_EC2_METADATA_DISABLED'])) {
        $_SERVER['AWS_EC2_METADATA_DISABLED'] = 'true';
    }
    if (empty($_ENV['HOME'])) {
        $_ENV['HOME'] = $aws_home_fallback;
    }
    if (empty($_SERVER['HOME'])) {
        $_SERVER['HOME'] = $aws_home_fallback;
    }
}

if (!function_exists('editorjs_wp_log')) {
    /**
     * Lightweight plugin-level logger for shared hosts where debug.log may be unavailable.
     *
     * @param string $message
     * @param array<string,mixed> $context
     */
    function editorjs_wp_log(string $message, array $context = []): void {
        $line = '[' . gmdate('c') . '] ' . $message;
        if (!empty($context)) {
            $json = wp_json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (is_string($json) && $json !== '') {
                $line .= ' ' . $json;
            }
        }
        $line .= PHP_EOL;

        $target = defined('WP_CONTENT_DIR') ? WP_CONTENT_DIR . '/editorjs-wp.log' : '';
        if ($target !== '') {
            @file_put_contents($target, $line, FILE_APPEND | LOCK_EX);
        }

        // Keep default PHP error log as secondary sink.
        @error_log('[EditorJS WP] ' . trim($line));
    }
}

if (!function_exists('editorjs_wp_install_warning_filter')) {
    /**
     * Suppress known noisy warnings/deprecations that break frontend/AJAX responses on some hosts.
     */
    function editorjs_wp_install_warning_filter(): void {
        $previous_handler = null;

        $previous_handler = set_error_handler(
            static function ($severity, $message, $file = '', $line = 0) use (&$previous_handler): bool {
                $message = is_string($message) ? $message : '';
                $file = is_string($file) ? $file : '';

                $is_aws_open_basedir = (
                    strpos($message, 'open_basedir restriction in effect') !== false
                    && strpos($message, '.aws/config') !== false
                ) || strpos($file, 'aws-sdk-php/src/DefaultsMode/ConfigurationProvider.php') !== false;

                $is_emoji_deprecated = strpos($message, 'print_emoji_styles') !== false;

                if ($is_aws_open_basedir || $is_emoji_deprecated) {
                    if (function_exists('editorjs_wp_log')) {
                        editorjs_wp_log(
                            'Suppressed runtime warning',
                            [
                                'severity' => (int) $severity,
                                'message' => $message,
                                'file' => $file,
                                'line' => (int) $line,
                            ]
                        );
                    }
                    return true;
                }

                if (is_callable($previous_handler)) {
                    return (bool) call_user_func($previous_handler, $severity, $message, $file, $line);
                }

                return false;
            },
            E_WARNING | E_USER_WARNING | E_DEPRECATED | E_USER_DEPRECATED
        );
    }
}

editorjs_wp_install_warning_filter();

require_once EDITORJS_WP_DIR . 'includes/settings.php';
require_once EDITORJS_WP_DIR . 'includes/frontend-renderer.php';
require_once EDITORJS_WP_DIR . 'includes/save-handler.php';
require_once EDITORJS_WP_DIR . 'includes/media-handler.php';
require_once EDITORJS_WP_DIR . 'includes/editor-loader.php';

function editorjs_wp_activate(): void {
    if (get_option(EditorJS_WP_Settings::OPTION_EDITOR_ENABLED, null) === null) {
        add_option(EditorJS_WP_Settings::OPTION_EDITOR_ENABLED, 1);
    }

    if (get_option(EditorJS_WP_Settings::OPTION_FRONTEND_RENDER, null) === null) {
        add_option(EditorJS_WP_Settings::OPTION_FRONTEND_RENDER, 1);
    }

    if (get_option(EditorJS_WP_Settings::OPTION_FRONTEND_EDITOR, null) === null) {
        add_option(EditorJS_WP_Settings::OPTION_FRONTEND_EDITOR, 1);
    }

    if (get_option(EditorJS_WP_Settings::OPTION_FRONTEND_EDITOR_PATH, null) === null) {
        add_option(EditorJS_WP_Settings::OPTION_FRONTEND_EDITOR_PATH, 'publish');
    }
}
register_activation_hook(__FILE__, 'editorjs_wp_activate');

function editorjs_wp_bootstrap(): void {
    EditorJS_WP_Settings::init();
    EditorJS_WP_Media_Handler::init();
    EditorJS_WP_Save_Handler::init();
    EditorJS_WP_Editor_Loader::init();
    EditorJS_WP_Frontend_Renderer::init();
}
add_action('plugins_loaded', 'editorjs_wp_bootstrap');


