# Theme Showcase Previewer

A web app that shows your WordPress themes in a mock browser window. Visitors pick a theme from a list and see its screenshot with the demo address in the address bar.

Theme data comes from a WordPress plugin that stores each theme's name, category, screenshot, and demo URL and exposes them on a REST route.

## Features

- **Screenshot preview.** The chosen theme fills a fake browser window with its demo address in the address bar. A missing or broken image falls back to a placeholder.
- **Search.** Type part of a theme name or category and the list narrows.
- **Category filters.** One button per category with a count, plus "All".
- **Keyboard control.** Arrow keys move through the list, Enter opens the demo. Prev and Next buttons do the same by mouse.
- **Running count.** Position within the current filter appears in the top bar, the browser window, and above the list.
- **WordPress admin screens.** The plugin adds a "Themes" section with categories, a demo address field, and a media-library image picker.
- **Cached data feed.** The plugin caches its response for five minutes and clears that cache when a theme is saved, deleted, or recategorised.
