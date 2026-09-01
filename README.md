# Theme Showcase Previewer

A small web app that shows off your WordPress themes in a fake browser window. Visitors pick a theme from a list on the right and see its screenshot on the left, with the theme's demo address shown in the fake address bar.

Theme data comes from a companion WordPress plugin, included in this repository under `rest-api/`. The plugin stores each theme's name, category, screenshot, and demo address, and publishes them on a REST route that this app reads.

## Features

### Browsing and picking themes

* Theme list down the side, with the picked theme highlighted.
* Large preview panel styled like a browser window, showing the screenshot and the demo address.
* Search box that narrows the list as you type, matching on both theme name and category.
* One filter button per category, each showing how many themes it holds, plus an "All" button.
* Previous and Next buttons for going through the list.
* Arrow keys move up and down the list, and Enter opens the picked theme's demo site in a new tab. The arrow keys also work while the cursor is in the search box.
* Running counts in three places: the top bar, the fake browser window, and
  above the list. Each one covers the current search and filter.
* Placeholder whenever a theme has no screenshot or its screenshot fails to load.

### Screenshots served by this app

* Every screenshot is fetched by this app and passed on to the visitor, so the address of your WordPress site never appears in the page, in the data the page carries, or in any response header.
* Screenshots are only fetched from addresses you have approved, which stops the feature being used to pull in files from anywhere else.
* Only ordinary picture formats are passed through: PNG, JPEG, WebP, AVIF, and GIF. Anything else is refused
* A time limit and a size limit apply to every fetch, so no slow or oversized file can cause issues.
* Screenshots are passed straight through as they arrive rather than being held in memory first.
* Any failure serves the placeholder instead of a broken image.

### Reading from WordPress

* The theme list is kept in memory and reused rather than being requested for every visitor.
* When the stored copy expires, visitors are served the old copy while a fresh one is fetched in the background
* If WordPress cannot be reached and nothing has been stored yet, the app shows a short "unavailable" page rather than an error.
* A warning is written to the log if WordPress reports more themes than the app fetched.

### How pages are built

* The full page is built on the server, so it is readable and search engines see real content.
* The browser then takes over the same page and makes it interactive, without rebuilding it.
* The list rows and filter buttons are produced by one shared piece of code used by both the server and the browser.
* Theme names and other text are escaped everywhere they are printed, so a theme named after a snippet of code cannot break the page.
* Security headers are set on every response, including a policy that only allows screenshots, styles, and scripts from a whitelist.
* Pages and text files are compressed before being sent.

### Setting it up

* Settings are read from a `.env` file, with `.env.example` listing every option and what it does.
* Only one setting is required: the address of the WordPress REST route.
* Optional settings cover the port, waiting times, how long data is kept, the placeholder, approved screenshot addresses, header links, and web fonts.
* Wrong or missing settings stop the app at startup with a message saying which failed.
* Web fonts can be turned off completely with one setting.

### The WordPress plugin

* Adds a "Themes" section to the WordPress admin area with its own listing and editing screens.
* Categories for grouping themes, shown as the filter buttons in the app.
* A field for each theme's demo address.
* A screenshot picker that uses the normal WordPress media library.
* Publishes everything on a REST route, with paging and counts.
* Keeps its own copy of the response for five minutes so WordPress is not queried repeatedly.
* Clears that copy as soon as a theme is added, changed, deleted, or moved to another category, so the app picks up edits quickly.

### Tests

* 158 tests covering settings, the WordPress reader, the stored copy, the page routes, the screenshot feature, and the browser behaviour.
* Browser behaviour is tested against the real page the server produces, so the tests catch mismatches between the two.
* Run them with `npm test`.

## Getting started

```bash
npm install
cp .env.example .env   # then set WP_API_BASE
npm run build          # builds the css
npm start              # serves on port 3000 by default
```

The WordPress plugin lives in `rest-api/themeshowcase-preview`. Copy that folder into your site's `wp-content/plugins` directory and activate it from the Plugins screen.
