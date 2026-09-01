<p>
    <label for="th_theme_demo_url"><strong><?php esc_html_e('Demo URL', 'themeshowcase-previewer'); ?></strong></label><br />
    <input type="text" id="th_theme_demo_url" name="th_theme_demo_url"
        value="<?php echo esc_attr($demo_url); ?>"
        placeholder="serein.co — Editorial"
        style="width:100%;margin-top:6px;" />
    <span class="description"><?php esc_html_e('Shown in the chrome bar.', 'themeshowcase-previewer'); ?></span>
</p>
<p>
    <label><strong><?php esc_html_e('Preview Image', 'themeshowcase-previewer'); ?></strong></label><br />
    <div id="th_theme_image_preview" style="margin:8px 0;">
        <?php if ($image_url): ?>
            <img src="<?php echo esc_url($image_url); ?>"
                style="max-width:300px;height:auto;border-radius:8px;border:1px solid #ddd;" />
        <?php endif; ?>
    </div>
    <input type="hidden" id="th_theme_image_id" name="th_theme_image_id" value="<?php echo esc_attr($image_id); ?>" />
    <button type="button" class="button" id="th_theme_pick_image"><?php esc_html_e('Pick Image', 'themeshowcase-previewer'); ?></button>
    <button type="button" class="button" id="th_theme_remove_image" style="<?php echo $image_id ? '' : 'display:none;'; ?>">
        <?php esc_html_e('Remove', 'themeshowcase-previewer'); ?>
    </button>
</p>
