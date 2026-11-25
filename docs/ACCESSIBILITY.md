# Accessibility

Target: WCAG 2.2 AA.

- **Structure:** landmarks (`header`, `main`, `footer`), a single `h1`, sequential `h2`/`h3`, and a skip link to the main content.
- **Forms:** every control has a visible or screen-reader label. Related checkboxes are grouped in a `fieldset` with a `legend`.
- **Dynamic updates:** status messages, the plan and AI answers use `aria-live="polite"`. Focus moves to the results heading after a location is chosen.
- **Non-text content:** the AQI gauge and the hourly chart are `role="img"`, with text alternatives generated from the data (value, category, highest and lowest hour). Each bar also has a tooltip.
- **Colour:** category colour is always paired with a text label ("Very Poor"). Text colours meet 4.5:1 contrast on their backgrounds.
- **Keyboard:** all actions are native buttons, links or form controls, with a visible `:focus-visible` outline.
- **Motion:** animations are disabled under `prefers-reduced-motion`.
- **Responsive:** the layout reflows down to 320 px width without horizontal scrolling (the chart scrolls within its own region).
