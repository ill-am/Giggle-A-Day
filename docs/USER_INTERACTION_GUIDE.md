# AetherPress User Interaction Guide

## Overview

AetherPress is a web-based application that allows users to generate, preview, and export content. The interface is split into two main panels:

- Left Panel: Controls and input
- Right Panel: Preview window

## Main Components

### 1. Prompt Input

Located in the left panel, this is where you start your content creation:

- Type or paste your prompt in the text area
- Quick-insert buttons available for common themes (e.g., "summer")
- Click "Generate" to create content based on your prompt
- The system automatically triggers a preview after generation

### 2. Preview Window

Located in the right panel, this shows your generated content:

- Displays the current content with styling and formatting
- Updates automatically when new content is generated
- Shows background images when specified
- Provides a real-time view of how your export will look

### 3. Override Controls

Located below the prompt input:

- Allows fine-tuning of the generated content
- Modify specific aspects of the output
- Changes reflect immediately in the preview

### 4. Export Button

Located at the bottom of the left panel:

- Click to export your content as PDF
- Shows export progress
- Downloads the final PDF automatically
- Disabled when there's no content to export

### 5. Status Display

Shows the current state of operations:

- Generation status
- Preview status
- Export progress
- Error messages (if any)

## Typical Workflow

1. **Content Generation**

   - Enter your prompt in the input area
   - (Optional) Use quick-insert suggestions for inspiration
   - Click Generate or use keyboard shortcut
   - Wait for content generation to complete

2. **Preview & Refinement**

   - Review the generated content in the preview window
   - Use override controls to adjust if needed
   - Changes appear immediately in the preview

3. **Export**
   - Click the Export button when satisfied
   - Wait for the export process to complete
   - PDF will download automatically

## Special Features

### Smoke Testing

- Available for development/testing purposes
- Runs a complete preview → export cycle
- Useful for verifying the entire pipeline

### Auto-Preview

- Preview updates automatically with content changes
- Ensures WYSIWYG experience
- Helps catch issues before export

## Error Handling

The system provides clear feedback through the Status Display:

- Empty prompt warnings
- Generation errors
- Preview failures
- Export issues

## Performance Notes

- Preview generation is debounced to avoid rapid requests
- Export process shows progress percentage
- Background images are cached for better performance

---

_Note: This guide reflects the current implementation as of September 2025. Features may be updated or changed in future versions._
