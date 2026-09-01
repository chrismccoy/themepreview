jQuery(function ($) {
  let frame;

  $('#th_theme_pick_image').on('click', function (e) {
    e.preventDefault();

    if (frame) {
      frame.open();
      return;
    }

    frame = wp.media({
      title: thThemeMetabox.title,
      button: { text: thThemeMetabox.buttonText },
      multiple: false,
    });

    frame.on('select', function () {
      const attachment = frame.state().get('selection').first().toJSON();
      const imageUrl =
        (attachment.sizes && attachment.sizes.large && attachment.sizes.large.url) ||
        attachment.url;

      $('#th_theme_image_id').val(attachment.id);
      $('#th_theme_image_preview').html(
        `<img src="${imageUrl}" style="max-width:300px;height:auto;border-radius:8px;border:1px solid #ddd;" />`
      );
      $('#th_theme_remove_image').show();
    });

    frame.open();
  });

  $('#th_theme_remove_image').on('click', function (e) {
    e.preventDefault();
    $('#th_theme_image_id').val('');
    $('#th_theme_image_preview').empty();
    $(this).hide();
  });
});
