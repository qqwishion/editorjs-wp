<?php

if (!defined('ABSPATH')) {
    exit;
}

class EditorJS_WP_Editor_Loader {
    public const EDITORJS_VERSION = '2.31.4';
    public const PARAGRAPH_VERSION = '2.11.7';
    public const HEADER_VERSION = '2.8.8';
    public const IMAGE_VERSION = '2.10.3';
    public const CODE_VERSION = '2.9.4';
    public const QUOTE_VERSION = '2.7.6';
    public const DELIMITER_VERSION = '1.4.2';
    public const TABLE_VERSION = '2.4.5';
    public const BUTTON_VERSION = '3.0.3';
    public const DRAG_DROP_VERSION = '1.1.16';

    public static function init(): void {
        add_filter('use_block_editor_for_post', [__CLASS__, 'disable_block_editor'], 10, 2);
        add_filter('use_block_editor_for_post_type', [__CLASS__, 'disable_block_editor_for_post_type'], 10, 2);
        add_filter('gutenberg_can_edit_post', [__CLASS__, 'disable_gutenberg'], 10, 2);
        add_action('init', [__CLASS__, 'remove_editor_support']);
        add_action('add_meta_boxes', [__CLASS__, 'register_editor_meta_box']);
        add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue_admin_assets']);
        add_action('admin_head-post.php', [__CLASS__, 'hide_classic_editor_markup']);
        add_action('admin_head-post-new.php', [__CLASS__, 'hide_classic_editor_markup']);
    }

    public static function disable_block_editor(bool $use_block_editor, $post): bool {
        if (!EditorJS_WP_Settings::is_editor_enabled()) {
            return $use_block_editor;
        }

        $post_object = get_post($post);
        if (!$post_object || $post_object->post_type !== EditorJS_WP_Settings::TARGET_POST_TYPE) {
            return $use_block_editor;
        }

        return false;
    }

    public static function disable_block_editor_for_post_type(bool $use_block_editor, string $post_type): bool {
        if (!EditorJS_WP_Settings::is_editor_enabled()) {
            return $use_block_editor;
        }

        if ($post_type !== EditorJS_WP_Settings::TARGET_POST_TYPE) {
            return $use_block_editor;
        }

        return false;
    }

    public static function disable_gutenberg(bool $can_edit, $post): bool {
        if (!EditorJS_WP_Settings::is_editor_enabled()) {
            return $can_edit;
        }

        $post_object = is_object($post) ? $post : get_post($post);
        if (!$post_object || $post_object->post_type !== EditorJS_WP_Settings::TARGET_POST_TYPE) {
            return $can_edit;
        }

        return false;
    }

    public static function remove_editor_support(): void {
        if (!EditorJS_WP_Settings::is_editor_enabled()) {
            return;
        }

        remove_post_type_support(EditorJS_WP_Settings::TARGET_POST_TYPE, 'editor');
    }

    public static function register_editor_meta_box(): void {
        if (!EditorJS_WP_Settings::is_editor_enabled()) {
            return;
        }

        add_meta_box(
            'editorjs_wp_box',
            __('Контент Editor.js', 'editorjs-wordpress'),
            [__CLASS__, 'render_editor_meta_box'],
            EditorJS_WP_Settings::TARGET_POST_TYPE,
            'normal',
            'high'
        );
    }

    public static function render_editor_meta_box(WP_Post $post): void {
        $current = self::get_editor_payload((int) $post->ID);
        // Keep JSON ASCII-safe in HTML to avoid charset-related mojibake on legacy themes/hosts.
        $json = wp_json_encode($current, JSON_UNESCAPED_SLASHES);
        if (!is_string($json) || $json === '') {
            $json = '{"time":0,"blocks":[],"version":""}';
        }

        wp_nonce_field(EditorJS_WP_Settings::NONCE_ACTION, EditorJS_WP_Save_Handler::NONCE_FIELD);
        ?>
        <div class="editorjs-wp-admin-shell">
            <div class="editorjs-wp-admin-toolbar">
                <div id="editorjs-wp-autosave-status" class="editorjs-wp-autosave-status" data-state="idle">
                    <?php esc_html_e('Автосохранение готово', 'editorjs-wordpress'); ?>
                </div>
            </div>
            <textarea id="editorjs_wp_data" name="editorjs_data" class="editorjs-wp-hidden"><?php echo esc_textarea($json); ?></textarea>
            <div id="editorjs-wp-holder" aria-label="<?php esc_attr_e('Редактор контента Editor.js', 'editorjs-wordpress'); ?>"></div>
        </div>
        <?php
    }

    public static function hide_classic_editor_markup(): void {
        if (!EditorJS_WP_Settings::is_editor_enabled()) {
            return;
        }
        ?>
        <style>
            #postdivrich,
            #post-status-info {
                display: none !important;
            }
        </style>
        <?php
    }

    public static function enqueue_admin_assets(string $hook): void {
        if (!EditorJS_WP_Settings::is_editor_enabled()) {
            return;
        }

        if ($hook !== 'post.php' && $hook !== 'post-new.php') {
            return;
        }

        $screen = get_current_screen();
        $post_type = $screen ? $screen->post_type : '';
        if ($post_type !== EditorJS_WP_Settings::TARGET_POST_TYPE) {
            return;
        }

        $post_id = self::resolve_current_post_id();
        self::enqueue_editor_assets($post_id, $hook === 'post-new.php', 'admin');
    }

    public static function enqueue_editor_assets(
        int $post_id,
        bool $is_new_post_screen = false,
        string $context = 'admin'
    ): void {
        if (!EditorJS_WP_Settings::is_editor_enabled()) {
            return;
        }

        $context = $context === 'frontend' ? 'frontend' : 'admin';

        wp_enqueue_style(
            'editorjs-wp-style',
            EDITORJS_WP_URL . 'assets/css/editor-style.css',
            [],
            EDITORJS_WP_VERSION
        );

        wp_enqueue_script(
            'editorjs-core',
            EDITORJS_WP_URL . 'assets/vendor/editorjs-core.js',
            [],
            self::EDITORJS_VERSION,
            true
        );
        wp_enqueue_script(
            'editorjs-paragraph',
            EDITORJS_WP_URL . 'assets/vendor/editorjs-paragraph.umd.min.js',
            [],
            self::PARAGRAPH_VERSION,
            true
        );
        wp_enqueue_script(
            'editorjs-header',
            EDITORJS_WP_URL . 'assets/vendor/editorjs-header.umd.min.js',
            [],
            self::HEADER_VERSION,
            true
        );
        wp_enqueue_script(
            'editorjs-image',
            EDITORJS_WP_URL . 'assets/vendor/editorjs-image.umd.min.js',
            [],
            self::IMAGE_VERSION,
            true
        );
        wp_enqueue_script(
            'editorjs-code',
            EDITORJS_WP_URL . 'assets/vendor/editorjs-code.umd.min.js',
            [],
            self::CODE_VERSION,
            true
        );
        wp_enqueue_script(
            'editorjs-quote',
            EDITORJS_WP_URL . 'assets/vendor/editorjs-quote.umd.min.js',
            [],
            self::QUOTE_VERSION,
            true
        );
        wp_enqueue_script(
            'editorjs-delimiter',
            EDITORJS_WP_URL . 'assets/vendor/editorjs-delimiter.umd.min.js',
            [],
            self::DELIMITER_VERSION,
            true
        );
        wp_enqueue_script(
            'editorjs-table',
            EDITORJS_WP_URL . 'assets/vendor/editorjs-table.umd.min.js',
            [],
            self::TABLE_VERSION,
            true
        );
        wp_enqueue_script(
            'editorjs-button',
            EDITORJS_WP_URL . 'assets/vendor/editorjs-button.bundle.js',
            [],
            self::BUTTON_VERSION,
            true
        );
        wp_enqueue_script(
            'editorjs-drag-drop',
            EDITORJS_WP_URL . 'assets/vendor/editorjs-drag-drop.bundle.js',
            [],
            self::DRAG_DROP_VERSION,
            true
        );

        wp_enqueue_script(
            'editorjs-wp-tools',
            EDITORJS_WP_URL . 'assets/js/editor-tools.js',
            [
                'editorjs-core',
                'editorjs-paragraph',
                'editorjs-header',
                'editorjs-image',
                'editorjs-code',
                'editorjs-quote',
                'editorjs-delimiter',
                'editorjs-table',
                'editorjs-button',
                'editorjs-drag-drop',
            ],
            EDITORJS_WP_VERSION,
            true
        );

        wp_enqueue_script(
            'editorjs-wp-autosaves',
            EDITORJS_WP_URL . 'assets/js/autosaves.js',
            ['editorjs-wp-tools'],
            EDITORJS_WP_VERSION,
            true
        );

        wp_enqueue_script(
            'editorjs-wp-integrations',
            EDITORJS_WP_URL . 'assets/js/editor-integrations.js',
            ['editorjs-wp-autosaves'],
            EDITORJS_WP_VERSION,
            true
        );

        wp_enqueue_script(
            'editorjs-wp-runtime-guard',
            EDITORJS_WP_URL . 'assets/js/editor-runtime-guard.js',
            ['editorjs-wp-integrations'],
            EDITORJS_WP_VERSION,
            true
        );

        wp_enqueue_script(
            'editorjs-wp-init',
            EDITORJS_WP_URL . 'assets/js/editor-init.js',
            ['editorjs-wp-runtime-guard'],
            EDITORJS_WP_VERSION,
            true
        );

        do_action('editorjs_wp_enqueue_editor_assets', $context, $post_id);

        $config = self::build_editor_config($post_id, $is_new_post_screen, $context);
        $config = apply_filters('editorjs_wp_editor_config', $config, $context, $post_id);

        wp_localize_script('editorjs-wp-init', 'EditorJSWPConfig', $config);
    }

    private static function build_editor_config(int $post_id, bool $is_new_post_screen, string $context): array {
        $current_data = self::get_editor_payload($post_id);

        $factory_names_raw = apply_filters('editorjs_wp_external_tool_factories', [], $context, $post_id);
        $factory_names = [];
        if (is_array($factory_names_raw)) {
            foreach ($factory_names_raw as $name) {
                $name = sanitize_text_field((string) $name);
                if ($name !== '') {
                    $factory_names[] = $name;
                }
            }
        }

        return [
            'context' => $context,
            'isFrontendEditor' => ($context === 'frontend'),
            'postId' => $post_id,
            'postTitle' => $post_id > 0 ? get_the_title($post_id) : '',
            'nonce' => wp_create_nonce(EditorJS_WP_Settings::NONCE_ACTION),
            'restNonce' => wp_create_nonce('wp_rest'),
            'autosaveInterval' => 15000,
            'cacheKeyPrefix' => 'editorjs_wp_post_',
            'cacheMaxAgeMs' => 6 * HOUR_IN_SECONDS * 1000,
            'isNewPostScreen' => $is_new_post_screen,
            'editorData' => $current_data,
            'postMeta' => self::get_post_meta_payload($post_id),
            'video' => [
                'maxWidth' => EditorJS_WP_Media_Handler::VIDEO_MAX_WIDTH,
                'maxHeight' => EditorJS_WP_Media_Handler::VIDEO_MAX_HEIGHT,
            ],
            'labels' => [
                'autosaveIdle' => __('Автосохранение готово', 'editorjs-wordpress'),
                'autosaveSaving' => __('Сохраняю черновик...', 'editorjs-wordpress'),
                'autosaveSaved' => __('Сохранено в %s', 'editorjs-wordpress'),
                'autosaveLocal' => __('Сохранено локально (новый пост)', 'editorjs-wordpress'),
                'autosaveError' => __('Ошибка автосохранения', 'editorjs-wordpress'),
                'videoToolTitle' => __('Видео', 'editorjs-wordpress'),
                'videoUpload' => __('Загрузить видео', 'editorjs-wordpress'),
                'videoCaption' => __('Подпись к видео', 'editorjs-wordpress'),
                'videoUploading' => __('Загрузка...', 'editorjs-wordpress'),
                'videoUploaded' => __('Загружено', 'editorjs-wordpress'),
                'videoPreviewGenerating' => __('Готовлю заставку (5-я секунда)...', 'editorjs-wordpress'),
                'videoPreviewReady' => __('Заставка готова', 'editorjs-wordpress'),
                'videoUploadFailed' => __('Не удалось загрузить видео.', 'editorjs-wordpress'),
                'videoPreviewFailed' => __('Не удалось сделать заставку.', 'editorjs-wordpress'),
                'paragraphPlaceholder' => __('Начните писать...', 'editorjs-wordpress'),
                'headerPlaceholder' => __('Заголовок', 'editorjs-wordpress'),
                'codePlaceholder' => __('Вставьте код', 'editorjs-wordpress'),
                'quotePlaceholder' => __('Цитата', 'editorjs-wordpress'),
                'quoteCaptionPlaceholder' => __('Автор', 'editorjs-wordpress'),
                'imageUploadFailed' => __('Не удалось загрузить изображение.', 'editorjs-wordpress'),
                'restoreNewPostConfirm' => __('Найден локальный черновик для нового поста. Восстановить его?', 'editorjs-wordpress'),
                'frontendSave' => __('Сохранить изменения', 'editorjs-wordpress'),
                'frontendSaveInProgress' => __('Сохраняю...', 'editorjs-wordpress'),
                'frontendSaveSuccess' => __('Изменения сохранены.', 'editorjs-wordpress'),
                'frontendSaveError' => __('Не удалось сохранить изменения.', 'editorjs-wordpress'),
                'frontendPreview' => __('Просмотреть', 'editorjs-wordpress'),
                'frontendPreviewInProgress' => __('Готовлю предпросмотр...', 'editorjs-wordpress'),
                'frontendPreviewSuccess' => __('Предпросмотр открыт в новой вкладке.', 'editorjs-wordpress'),
                'frontendPreviewError' => __('Не удалось открыть предпросмотр.', 'editorjs-wordpress'),
                'frontendPublish' => __('Опубликовать', 'editorjs-wordpress'),
                'frontendPublishInProgress' => __('Публикую...', 'editorjs-wordpress'),
                'frontendPublishSuccess' => __('Пост опубликован.', 'editorjs-wordpress'),
                'frontendPublishError' => __('Не удалось опубликовать пост.', 'editorjs-wordpress'),
                'frontendTitlePlaceholder' => __('Введите заголовок', 'editorjs-wordpress'),
                'frontendCategoriesLabel' => __('Рубрика', 'editorjs-wordpress'),
                'frontendFormatLabel' => __('Формат', 'editorjs-wordpress'),
                'aiPanelToggle' => __('AI', 'editorjs-wordpress'),
                'aiCustomPromptPlaceholder' => __('Кастомный промпт (необязательно)', 'editorjs-wordpress'),
                'aiRewriteAction' => __('Переписать текст', 'editorjs-wordpress'),
                'aiTitlesAction' => __('Сгенерировать заголовки', 'editorjs-wordpress'),
                'aiProcessing' => __('Обработка AI...', 'editorjs-wordpress'),
                'aiRewriteDone' => __('Текст обновлен.', 'editorjs-wordpress'),
                'aiRewriteError' => __('Ошибка AI Rewriter.', 'editorjs-wordpress'),
                'aiTitlesReady' => __('Варианты заголовков готовы.', 'editorjs-wordpress'),
                'aiTitlesError' => __('Не удалось получить заголовки.', 'editorjs-wordpress'),
                'aiApplyTitle' => __('Применить', 'editorjs-wordpress'),
                'aiTitleApplied' => __('Заголовок применен.', 'editorjs-wordpress'),
                'aiTitleApplyManual' => __('Поле заголовка не найдено. Скопируйте вручную.', 'editorjs-wordpress'),
                'aiNoText' => __('Нет текста для обработки.', 'editorjs-wordpress'),
                'aiEmptyResult' => __('AI вернул пустой результат.', 'editorjs-wordpress'),
                'aiUnavailable' => __('AI Rewriter недоступен.', 'editorjs-wordpress'),
                'stockPanelToggle' => __('Поиск фото', 'editorjs-wordpress'),
                'stockModalTitle' => __('Поиск изображений', 'editorjs-wordpress'),
                'closeLabel' => __('Закрыть', 'editorjs-wordpress'),
                'stockQueryPlaceholder' => __('Введите запрос', 'editorjs-wordpress'),
                'stockSearchAction' => __('Искать', 'editorjs-wordpress'),
                'stockSearching' => __('Ищу изображения...', 'editorjs-wordpress'),
                'stockSearchError' => __('Ошибка поиска.', 'editorjs-wordpress'),
                'stockNoResults' => __('Ничего не найдено.', 'editorjs-wordpress'),
                'stockUnavailable' => __('Stock Image Search недоступен.', 'editorjs-wordpress'),
                'stockQueryRequired' => __('Введите поисковый запрос.', 'editorjs-wordpress'),
                'stockProviderRequired' => __('Выберите хотя бы один источник.', 'editorjs-wordpress'),
                'stockInsertAction' => __('Вставить', 'editorjs-wordpress'),
                'stockInserting' => __('Вставляю изображение...', 'editorjs-wordpress'),
                'stockInsertDone' => __('Изображение вставлено.', 'editorjs-wordpress'),
                'stockInsertError' => __('Не удалось вставить изображение.', 'editorjs-wordpress'),
                'stockBadItem' => __('Некорректные данные изображения.', 'editorjs-wordpress'),
            ],
            'endpoints' => [
                'uploadImage' => admin_url('admin-ajax.php?action=' . EditorJS_WP_Media_Handler::IMAGE_ACTION),
                'uploadVideo' => admin_url('admin-ajax.php?action=' . EditorJS_WP_Media_Handler::VIDEO_ACTION),
                'autosave' => admin_url('admin-ajax.php'),
                'frontendSave' => admin_url('admin-ajax.php'),
                'frontendPreview' => admin_url('admin-ajax.php'),
                'frontendPublish' => admin_url('admin-ajax.php'),
                'aiRewrite' => esc_url_raw(rest_url('ai-rewriter/v1/rewrite')),
                'aiTitles' => esc_url_raw(rest_url('ai-rewriter/v1/titles')),
                'stockSearch' => esc_url_raw(rest_url('stock-image/v1/search')),
                'stockInsert' => esc_url_raw(rest_url('stock-image/v1/insert')),
            ],
            'actions' => [
                'frontendSave' => EditorJS_WP_Save_Handler::FRONTEND_SAVE_ACTION,
                'frontendPreview' => EditorJS_WP_Save_Handler::FRONTEND_PREVIEW_ACTION,
                'frontendPublish' => EditorJS_WP_Save_Handler::FRONTEND_PUBLISH_ACTION,
            ],
            'i18n' => self::get_i18n_messages(),
            'externalToolFactoryNames' => array_values(array_unique($factory_names)),
            'integrations' => [
                'aiRewriter' => ($context === 'frontend') ? false : defined('AIRWU_VERSION'),
                'stockImageSearch' => defined('SIS_VERSION'),
                'aiLanguageDefault' => self::resolve_ai_language_default(),
            ],
        ];
    }

    private static function get_editor_payload(int $post_id): array {
        $current_data = [];
        if ($post_id > 0) {
            $current_data = EditorJS_WP_Save_Handler::get_saved_data($post_id);
        }

        if (empty($current_data)) {
            $current_data = [
                'time' => (int) round(microtime(true) * 1000),
                'blocks' => [],
                'version' => self::EDITORJS_VERSION,
            ];
        }

        return $current_data;
    }

    private static function get_post_meta_payload(int $post_id): array {
        $category_ids = [];
        $format = 'standard';
        $excerpt = '';
        $tags = '';
        $visibility = 'public';
        $password = '';
        $featured_image_id = 0;
        $featured_image_url = '';

        if ($post_id > 0) {
            $category_ids = array_values(array_filter(array_map('intval', wp_get_post_categories($post_id))));
            if (!empty($category_ids)) {
                $category_ids = [(int) reset($category_ids)];
            }
            $post_format = get_post_format($post_id);
            if (is_string($post_format) && $post_format !== '') {
                $format = sanitize_key($post_format);
            }

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

            if (get_post_status($post_id) === 'private') {
                $visibility = 'private';
            } else {
                $password = (string) get_post_field('post_password', $post_id);
                if ($password !== '') {
                    $visibility = 'password';
                }
            }

            $featured_image_id = (int) get_post_thumbnail_id($post_id);
            if ($featured_image_id > 0) {
                $featured_image_url = (string) wp_get_attachment_image_url($featured_image_id, 'medium');
                if ($featured_image_url === '') {
                    $featured_image_url = (string) wp_get_attachment_url($featured_image_id);
                }
            }
        }

        $categories = array_map(
            static function (WP_Term $term): array {
                return [
                    'id' => (int) $term->term_id,
                    'name' => html_entity_decode((string) $term->name, ENT_QUOTES, 'UTF-8'),
                ];
            },
            get_categories(
                [
                    'taxonomy' => 'category',
                    'hide_empty' => false,
                ]
            )
        );

        $formats = [
            [
                'slug' => 'standard',
                'label' => __('Стандарт', 'editorjs-wordpress'),
            ],
        ];

        $format_strings = get_post_format_strings();
        if (is_array($format_strings)) {
            foreach ($format_strings as $slug => $label) {
                $formats[] = [
                    'slug' => sanitize_key((string) $slug),
                    'label' => html_entity_decode((string) $label, ENT_QUOTES, 'UTF-8'),
                ];
            }
        }

        return [
            'categoryIds' => $category_ids,
            'format' => $format,
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

    private static function get_i18n_messages(): array {
        return [
            'messages' => [
                'ui' => [
                    'blockTunes' => [
                        'toggler' => [
                            'Click to tune' => 'Настроить',
                            'or drag to move' => 'или перетащите',
                        ],
                    ],
                    'inlineToolbar' => [
                        'converter' => [
                            'Convert to' => 'Преобразовать в',
                        ],
                    ],
                    'toolbar' => [
                        'toolbox' => [
                            'Add' => 'Добавить',
                        ],
                    ],
                ],
                'toolNames' => [
                    'Text' => 'Текст',
                    'Heading' => 'Заголовок',
                    'Image' => 'Изображение',
                    'Video' => 'Видео',
                    'Code' => 'Код',
                    'Quote' => 'Цитата',
                    'Delimiter' => 'Разделитель',
                    'Table' => 'Таблица',
                    'Link' => 'Ссылка',
                    'Bold' => 'Жирный',
                    'Italic' => 'Курсив',
                    'InlineCode' => 'Инлайн-код',
                    'AnyButton' => 'Кнопка',
                    'Button' => 'Кнопка',
                ],
                'tools' => [
                    'link' => [
                        'Add a link' => 'Добавить ссылку',
                        'Wrong URL' => 'Некорректный URL',
                        'URL が 間 違 っ て い ま す' => 'Некорректный URL',
                    ],
                    'image' => [
                        'With border' => 'С рамкой',
                        'Stretch image' => 'Растянуть',
                        'With background' => 'С фоном',
                        'With caption' => 'С подписью',
                        'With Caption' => 'С подписью',
                        'Caption' => 'Подпись',
                    ],
                    'stub' => [
                        'The block can not be displayed correctly.' => 'Блок не может быть отображен корректно.',
                    ],
                ],
                'blockTunes' => [
                    'delete' => [
                        'Delete' => 'Удалить',
                    ],
                    'moveUp' => [
                        'Move up' => 'Переместить вверх',
                    ],
                    'moveDown' => [
                        'Move down' => 'Переместить вниз',
                    ],
                ],
            ],
        ];
    }

    private static function resolve_ai_language_default(): string {
        if (!class_exists('AIRWU_Admin') || !method_exists('AIRWU_Admin', 'get_public_settings')) {
            return 'auto';
        }

        try {
            $settings = AIRWU_Admin::get_public_settings();
            if (is_array($settings) && !empty($settings['language_default'])) {
                return sanitize_text_field((string) $settings['language_default']);
            }
        } catch (Throwable $error) {
            return 'auto';
        }

        return 'auto';
    }

    private static function resolve_current_post_id(): int {
        if (!empty($_GET['post'])) {
            return (int) $_GET['post'];
        }

        if (!empty($_GET['id'])) {
            return (int) $_GET['id'];
        }

        if (!empty($_GET['post_id'])) {
            return (int) $_GET['post_id'];
        }

        if (!empty($_POST['post_ID'])) {
            return (int) $_POST['post_ID'];
        }

        return 0;
    }
}
