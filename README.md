# EditorJS WordPress

Custom WordPress plugin that replaces Gutenberg with Editor.js for `post` editing in wp-admin and provides a dedicated frontend editor route.

This README describes the current implementation used in patch line `1.3.0`.

## What It Does

- Disables Gutenberg for post type `post` and mounts Editor.js.
- Stores Editor.js JSON in post meta and syncs rendered HTML to `post_content`.
- Renders Editor.js blocks on frontend.
- Adds a frontend editor page at `/{path}/?id={post_id}` (default path: `publish`).
- Supports autosave every 15 seconds and emergency save on tab close.

## Supported Editor.js Tools

- Paragraph
- Heading (`h2`-`h6`, no `h1`)
- Image (custom upload, no default WP media modal)
- Video (custom upload + poster frame generation at ~5s)
- Code
- Quote
- Delimiter
- Table
- Button (custom built-in tool)
- Drag-and-Drop (`editorjs-drag-drop`)

## Frontend Editor UI

Frontend editor is a custom shell that mirrors the old publish flow:

- Drafts list
- Title
- Excerpt + help text
- Featured image button
- Stock image search button + autosave status
- Editor.js content area
- Topic/category
- Format
- Tags
- Access (`public`/`private`)
- Bottom actions: Save changes, Preview, Publish

The old template editor is not used when Editor.js frontend mode is active.

## Media and Video Behavior

- Image and video are uploaded through plugin AJAX endpoints.
- Uploaded files are normal WordPress attachments (compatible with offload plugins such as S3 Uploads).
- Video poster is generated from the 5th second when possible.
- Video display is constrained to `max-width: 800px` and `max-height: 600px` in editor and frontend output.

## Integrations

Optional integrations are auto-detected:

- `AI Rewriter Universal`
  - Enabled only in wp-admin Editor.js.
  - Explicitly disabled on frontend editor.
- `Stock Image Search`
  - Available in wp-admin and frontend editor when plugin is active.

## Requirements

- WordPress `6.x+`
- PHP `7.4+`
- User capability `edit_post` for editing
- User capability `upload_files` for media uploads

## Installation

1. Build plugin ZIP or copy folder into `wp-content/plugins/editorjs-wordpress`.
2. Activate plugin in WordPress admin.
3. Open `Settings -> Editor.js`.
4. Configure required options.

## Settings

Settings page: `Settings -> Editor.js`

- `Use Editor.js instead of Gutenberg (posts)`
- `Render Editor.js blocks on frontend`
- `Enable frontend Editor.js mode`
- `Frontend editor path` (default: `publish`)

Frontend route examples:

- Edit existing post: `/publish/?id=123`
- Create new draft from route: `/publish/` (auto-creates draft and redirects)
- Temporarily disable Editor.js mode on route: `?editorjs_edit=0`

## Data Storage

Post meta keys:

- `_editorjs_wp_data` - Editor.js JSON payload
- `_editorjs_wp_autosaved_at` - latest autosave timestamp
- `_editorjs_wp_visibility` - frontend visibility state (`public`/`private`)

The plugin also syncs rendered HTML to `post_content` for compatibility.

## AJAX / REST Endpoints

WordPress AJAX:

- `action=editorjs_wp_upload_image`
- `action=editorjs_wp_upload_video`
- `action=editorjs_wp_autosave`
- `action=editorjs_wp_frontend_save`
- `action=editorjs_wp_frontend_preview`
- `action=editorjs_wp_frontend_publish`

Optional REST integrations:

- `POST /wp-json/ai-rewriter/v1/rewrite`
- `POST /wp-json/ai-rewriter/v1/titles`
- `GET/POST /wp-json/stock-image/v1/*`

## Project Structure

```text
editorjs-wordpress/
  plugin.php
  README.md
  includes/
    settings.php
    editor-loader.php
    save-handler.php
    media-handler.php
    frontend-renderer.php
  assets/
    css/
      editor-style.css
    js/
      editor-init.js
      editor-tools.js
      autosaves.js
      editor-integrations.js
      editor-runtime-guard.js
    vendor/
      editorjs-*.js
```

## Development Notes

- Target post type is currently hardcoded to `post` (`EditorJS_WP_Settings::TARGET_POST_TYPE`).
- Tool registration is in `assets/js/editor-tools.js`.
- Payload sanitization is in `includes/save-handler.php`.
- Frontend HTML rendering is in `includes/frontend-renderer.php`.
- Editor runtime config is assembled in `includes/editor-loader.php` (`EditorJSWPConfig`).

## Quick QA Checklist

1. Admin editor opens with Editor.js (no Gutenberg).
2. Block insertion works via `+` and `/`.
3. Autosave runs every 15 seconds.
4. Closing tab preserves unsaved changes.
5. Image upload works for content block and featured image.
6. Video upload works and poster appears.
7. Drag-and-drop block reorder works.
8. Frontend editor route loads and saves to DB.
9. Frontend preview and publish buttons work.
10. Frontend rendered post displays all supported blocks correctly.
