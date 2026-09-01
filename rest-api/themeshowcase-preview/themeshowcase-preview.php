<?php
/**
 * Plugin Name: Theme Showcase Previewer
 * Description: CPT + taxonomy + metabox + REST route for theme previewer.
 * Version: 1.0.0
 * Text Domain: themeshowcase-previewer
 *
 * @package ThemeShowcase\Previewer
 * @since   1.0.0
 */

namespace ThemeShowcase\Previewer;

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/includes/class-content-types.php';
require_once __DIR__ . '/includes/class-theme-cache.php';
require_once __DIR__ . '/includes/class-category-slugs.php';
require_once __DIR__ . '/includes/class-theme-repository.php';
require_once __DIR__ . '/includes/class-theme-metabox.php';
require_once __DIR__ . '/includes/class-themes-controller.php';
require_once __DIR__ . '/includes/class-cache-invalidator.php';
require_once __DIR__ . '/includes/class-plugin.php';

register_activation_hook(__FILE__, [__NAMESPACE__ . '\\Plugin', 'activate']);

Plugin::boot(__FILE__);
