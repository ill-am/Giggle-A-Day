# Screenshot Automation Tools

This directory contains tools for automatically capturing screenshots of the Aether application for documentation purposes.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Ensure the Aether application is running at http://localhost:3000

3. Run the screenshot capture:

```bash
npm run capture
```

## Configuration

- `screenshot-config.cjs`: Contains all configuration for viewports, selectors, and states to capture
- `screenshot-utils.cjs`: Utility functions for file handling and screenshots
- `screenshot-capture.cjs`: Main script that orchestrates the capture process

## States Captured

1. Initial State
2. Prompt Entry
3. Generation in Progress
4. Preview Display
5. Export Process
6. Error State

## Output

Screenshots are saved to `../assets/screenshots/` with timestamps in the filename.

## Adding New States

To add a new state to capture:

1. Add it to the `states` object in `screenshot-config.cjs`:

```javascript
newState: {
  name: 'new_state_name',
  description: 'Description of the state',
  actions: [
    { type: 'click', selector: '.some-button' }
  ],
  waitFor: ['.some-element'],
  delay: 1000
}
```

2. Run the capture script again.

## Troubleshooting

- If screenshots are blank, try increasing the delay
- If elements aren't found, verify selectors in the config
- If the application isn't ready, ensure it's running before starting capture
