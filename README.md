# ER Architect

**ER Architect** is a modern, visual Entity-Relationship (ER) diagram builder running entirely in the browser. It features a clean, intuitive drag-and-drop canvas, and includes an AI-powered schema generator that automatically builds full ER diagrams from simple text descriptions.

## ✨ Features

- **Visual Canvas:** Infinite canvas with pan, zoom, and grid-snapping support.
- **Drag & Drop:** Easily add Entities, Weak Entities, Relationships, and Attributes from the sidebar.
- **Connections:** Draw relationship connections between elements and set custom cardinalities (1, N, M, 0..1, 0..N).
- **Edit Capabilities:** Double-click elements to edit their names, add/remove attributes, and mark primary keys (🔑).
- **AI Schema Generator:** Describe your system (e.g., "Hospital Management System") and watch the AI instantly generate a complete, auto-laid-out ER diagram using an external webhook.
- **History Management:** Full Undo (Ctrl+Z) and Redo (Ctrl+Y) functionality.
- **Export:** Export your finished diagram to a high-quality PNG with a single click.

## 🚀 Getting Started

Since this is a vanilla HTML/CSS/JavaScript web application, no build steps or dependencies are required.

1. Clone or download this repository.
2. Open `index.html` in your favorite modern web browser.
3. Start diagramming!

## 🤖 AI Schema Generator

The **AI Generate** button connects to an n8n cloud workflow via a webhook. When a topic is entered, it prompts an AI model (such as Google Gemini) to generate a JSON representation of an ER diagram, which is then parsed and auto-arranged on the canvas. 

*Note: For the AI functionality to work in your own environment, ensure the `N8N_WEBHOOK_URL` in `script.js` points to your active n8n webhook configured to return the expected JSON schema.*

## 🛠 Tech Stack

- **HTML5 / SVG:** Structure and high-quality vector graphics rendering for the canvas.
- **CSS3:** Clean, modern user interface.
- **Vanilla JavaScript (ES6+):** Canvas interactions, state management, event handling, history tracking, and API integration.

## ⌨️ Keyboard Shortcuts

- `V`: Select & Move tool
- `E`: Entity tool
- `R`: Relationship tool
- `C`: Connect tool
- `Delete`: Delete selected element
- `Ctrl + Z`: Undo
- `Ctrl + Y`: Redo