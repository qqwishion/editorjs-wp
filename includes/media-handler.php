<?php

if (!defined('ABSPATH')) {
    exit;
}

class EditorJS_WP_Media_Handler {
    public const IMAGE_ACTION = 'editorjs_wp_upload_image';
    public const VIDEO_ACTION = 'editorjs_wp_upload_video';
    public const VIDEO_MAX_WIDTH = 800;
    public const VIDEO_MAX_HEIGHT = 600;

    public static function init(): void {
        add_action('wp_ajax_' . self::IMAGE_ACTION, [__CLASS__, 'upload_image']);
        add_action('wp_ajax_' . self::VIDEO_ACTION, [__CLASS__, 'upload_video']);
    }

    public static function upload_image(): void {
        self::guard_upload_request();

        if (empty($_FILES['image'])) {
            if (function_exists('editorjs_wp_log')) {
                editorjs_wp_log('Image upload failed: file missing');
            }
            wp_send_json_error(['message' => __('Файл изображения не найден.', 'editorjs-wordpress')], 400);
        }

        $attachment_id = self::create_attachment_from_upload(
            $_FILES['image'],
            [
                'jpg|jpeg|jpe' => 'image/jpeg',
                'png' => 'image/png',
                'gif' => 'image/gif',
                'webp' => 'image/webp',
            ]
        );

        if (is_wp_error($attachment_id)) {
            if (function_exists('editorjs_wp_log')) {
                editorjs_wp_log(
                    'Image upload failed: attachment error',
                    ['error' => $attachment_id->get_error_message()]
                );
            }
            wp_send_json_error(['message' => $attachment_id->get_error_message()], 400);
        }

        $url = wp_get_attachment_url($attachment_id);
        wp_send_json(
            [
                'success' => 1,
                'file' => [
                    'url' => esc_url_raw((string) $url),
                    'attachmentId' => (int) $attachment_id,
                ],
            ]
        );
    }

    public static function upload_video(): void {
        self::guard_upload_request();

        if (empty($_FILES['video'])) {
            if (function_exists('editorjs_wp_log')) {
                editorjs_wp_log('Video upload failed: file missing');
            }
            wp_send_json_error(['message' => __('Файл видео не найден.', 'editorjs-wordpress')], 400);
        }

        $attachment_id = self::create_attachment_from_upload(
            $_FILES['video'],
            [
                'mp4' => 'video/mp4',
                'webm' => 'video/webm',
                'ogv|ogg' => 'video/ogg',
                'mov' => 'video/quicktime',
            ]
        );

        if (is_wp_error($attachment_id)) {
            if (function_exists('editorjs_wp_log')) {
                editorjs_wp_log(
                    'Video upload failed: attachment error',
                    ['error' => $attachment_id->get_error_message()]
                );
            }
            wp_send_json_error(['message' => $attachment_id->get_error_message()], 400);
        }

        $meta = wp_get_attachment_metadata($attachment_id);
        $width = isset($meta['width']) ? (int) $meta['width'] : 0;
        $height = isset($meta['height']) ? (int) $meta['height'] : 0;

        $url = wp_get_attachment_url($attachment_id);

        wp_send_json(
            [
                'success' => 1,
                'file' => [
                    'url' => esc_url_raw((string) $url),
                    'attachmentId' => (int) $attachment_id,
                    'width' => $width,
                    'height' => $height,
                ],
            ]
        );
    }

    private static function guard_upload_request(): void {
        self::suppress_runtime_warning_output();

        if (!current_user_can('upload_files')) {
            if (function_exists('editorjs_wp_log')) {
                editorjs_wp_log('Upload rejected: missing upload_files capability');
            }
            wp_send_json_error(['message' => __('Недостаточно прав для загрузки файлов.', 'editorjs-wordpress')], 403);
        }

        $nonce = isset($_REQUEST['_ajax_nonce']) ? sanitize_text_field((string) wp_unslash($_REQUEST['_ajax_nonce'])) : '';
        if ($nonce !== '' && !wp_verify_nonce($nonce, EditorJS_WP_Settings::NONCE_ACTION)) {
            if (function_exists('editorjs_wp_log')) {
                editorjs_wp_log('Upload rejected: invalid nonce');
            }
            wp_send_json_error(['message' => __('Недействительный nonce.', 'editorjs-wordpress')], 403);
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
    }

    private static function suppress_runtime_warning_output(): void {
        if (function_exists('ini_set')) {
            @ini_set('display_errors', '0');
            @ini_set('display_startup_errors', '0');
        }
    }

    /**
     * @param array<string,mixed> $file
     * @param array<string,string> $mimes
     */
    private static function create_attachment_from_upload(array $file, array $mimes) {
        $uploaded = wp_handle_upload(
            $file,
            [
                'test_form' => false,
                'mimes' => $mimes,
            ]
        );

        if (!is_array($uploaded) || !empty($uploaded['error'])) {
            $message = is_array($uploaded) ? (string) ($uploaded['error'] ?? '') : '';
            return new WP_Error('editorjs_upload_failed', $message ?: __('Не удалось загрузить файл.', 'editorjs-wordpress'));
        }

        $attachment_id = wp_insert_attachment(
            [
                'post_mime_type' => (string) ($uploaded['type'] ?? ''),
                'post_title' => sanitize_file_name(wp_basename((string) $uploaded['file'])),
                'post_content' => '',
                'post_status' => 'inherit',
            ],
            (string) $uploaded['file']
        );

        if (is_wp_error($attachment_id)) {
            return $attachment_id;
        }

        $attachment_meta = wp_generate_attachment_metadata($attachment_id, (string) $uploaded['file']);
        if (!empty($attachment_meta)) {
            wp_update_attachment_metadata($attachment_id, $attachment_meta);
        }

        return (int) $attachment_id;
    }
}
