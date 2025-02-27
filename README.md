# Flutter Widget Wrapper

![Flutter Widget Wrapper](extension/icon-extension.png)

A powerful VS Code extension that helps Flutter developers quickly wrap widgets with other widgets, saving time and reducing boilerplate code.

## Features

- **Quick Widget Wrapping**: Rapidly wrap any Flutter widget with common layout, styling, and interaction widgets
- **Smart Widget Detection**: Automatically detects widgets under your cursor
- **Customizable Widget List**: Enable/disable specific wrappers according to your workflow
- **Multiple Access Methods**: Use the command palette, context menu, or dedicated sidebar

![Widget Wrapping Demo](images/demo.gif)

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Flutter Widget Wrapper"
4. Click Install

### Using VSIX File

1. Download the `.vsix` file from [GitHub Releases](https://github.com/yourusername/flutter-widget-wrapper/releases)
2. In VS Code, go to Extensions
3. Click the "..." menu at the top of the Extensions view
4. Select "Install from VSIX..." and choose the downloaded file

## Usage

### Basic Usage

1. Position your cursor on a Flutter widget in your Dart code
2. Right-click to open the context menu
3. Select "Flutter Wrappers" and choose a wrapper
4. Your widget is now wrapped with the selected widget!

### Using the Command Palette

1. With your cursor on a Flutter widget, press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Wrap with" and select "Wrap with Widget..."
3. Choose the widget you want to wrap with from the menu

## Available Wrappers

### Layout Widgets
- **Container**: Add padding, margins, and decorations
- **Center**: Center a widget within its parent
- **Padding**: Add space around a widget
- **Align**: Position a widget within its parent
- **SizedBox**: Constrain a widget to specific dimensions
- **AspectRatio**: Constrain a widget to a specific aspect ratio
- **FittedBox**: Scale and position a widget within available space

### Flex Widgets
- **Expanded**: Make a widget expand to fill available space
- **Flexible**: Make a widget flexible in a Row or Column
- **Row**: Arrange widgets horizontally
- **Column**: Arrange widgets vertically
- **Wrap**: Wrap widgets to the next line when there's not enough space

### Multi-Child Layouts
- **Stack**: Stack widgets on top of each other
- **ListView**: Create a scrollable list of widgets
- **GridView**: Create a scrollable grid of widgets

### Material Widgets
- **Card**: Create a Material Design card
- **InkWell**: Add tap effects and callbacks
- **Material**: Apply Material Design styling

### Interaction Widgets
- **GestureDetector**: Detect gestures (tap, drag, etc.)
- **MouseRegion**: Respond to mouse interactions
- **Dismissible**: Create dismissible items

### Scrolling Widgets
- **SingleChildScrollView**: Make a widget scrollable
- **Scrollbar**: Add a scrollbar to a scrollable widget

### Styling & Effects
- **Opacity**: Adjust the transparency of a widget
- **ClipRRect**: Clip a widget with rounded corners
- **ClipOval**: Clip a widget into an oval shape
- **AnimatedContainer**: Animate changes to a container

## Configuration

You can enable or disable specific wrappers in the Flutter Wrappers panel:

1. Click on the Flutter Wrappers icon in the activity bar
2. Find the wrapper you want to toggle
3. Click on it to enable/disable (disabled wrappers show an X icon)

## Requirements

- Visual Studio Code 1.60.0 or higher
- Flutter extension for VS Code

## Extension Settings

This extension doesn't add any VS Code settings. Wrapper configurations are stored per workspace.

## Keyboard Shortcuts

Add your own keyboard shortcuts in VS Code for frequently used wrappers:

1. Open Keyboard Shortcuts (File > Preferences > Keyboard Shortcuts)
2. Search for the wrapper command (e.g., "wrapping.wrapWithContainer")
3. Add your preferred keyboard shortcut

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/flutter-widget-wrapper.git
cd flutter-widget-wrapper

# Install dependencies
npm install

# Package the extension
node build-vsix.js
```

## Issues and Contributions

Found a bug or have a feature request? [Open an issue](https://github.com/yourusername/flutter-widget-wrapper/issues) on our GitHub repository.

Contributions are always welcome! Please see our [contributing guidelines](CONTRIBUTING.md) for more details.

## License

MIT