#!/usr/bin/env node

/**
 * Script to create a VSIX installer for the extension
 */
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure we're in the extension's root directory
const extensionRoot = path.resolve(__dirname, '..');
process.chdir(extensionRoot);

// Check if package.json exists
if (!fs.existsSync(path.join(extensionRoot, 'package.json'))) {
    console.error('Error: package.json not found in the extension root');
    process.exit(1);
}

// Create resources directory if it doesn't exist
const resourcesDir = path.join(extensionRoot, 'resources');
if (!fs.existsSync(resourcesDir)) {
    console.log('📁 Creating resources directory...');
    fs.mkdirSync(resourcesDir, { recursive: true });
}

// Create a simple icon file if it doesn't exist
const iconPath = path.join(resourcesDir, 'icon.png');
if (!fs.existsSync(iconPath)) {
    console.log('🖼️ Icon not found, creating a placeholder icon...');
    // This is just a simple placeholder. A real icon would be better.
    createPlaceholderIcon(iconPath);
}

// Create a LICENSE file if it doesn't exist
const licensePath = path.join(extensionRoot, 'LICENSE');
if (!fs.existsSync(licensePath)) {
    console.log('📜 LICENSE file not found, creating MIT license...');
    const mitLicense = `MIT License

Copyright (c) ${new Date().getFullYear()} Flutter Widget Wrapper

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

    fs.writeFileSync(licensePath, mitLicense);
}

// Create the Flutter logo SVG for the activity bar icon
const flutterLogoPath = path.join(resourcesDir, 'icon-extension.svg');
if (!fs.existsSync(flutterLogoPath)) {
    console.log('🖼️ Creating Flutter logo for activity bar...');
    const flutterLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path d="M13.9 2.01L3.9 12l3.09 3.09 2.71-2.7L20.09 2.01h-6.19zM3.92 17.46l3.09 3.09 6.19-6.19-3.09-3.09-6.19 6.19z" fill="#40c4ff"/>
    <path d="M13.9 22.01l6.19-6.19-3.09-3.09-3.1 3.1v6.18z" fill="#40c4ff"/>
</svg>`;
    fs.writeFileSync(flutterLogoPath, flutterLogoSvg);
}

console.log('🔍 Checking if vsce is installed globally...');
exec('vsce --version', (error) => {
    if (error) {
        console.log('📦 Installing vsce globally...');
        exec('npm install -g @vscode/vsce', (installError, stdout, stderr) => {
            if (installError) {
                console.error('❌ Failed to install vsce:', stderr);
                process.exit(1);
            }
            console.log('✅ vsce installed successfully');
            packExtension();
        });
    } else {
        console.log('✅ vsce is already installed');
        packExtension();
    }
});

function packExtension() {
    console.log('📦 Packaging extension...');
    const outputDir = path.join(extensionRoot, 'dist');

    // Create dist directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Package the extension with flags to bypass warnings
    exec('vsce package --allow-missing-repository -o dist/flutter-widget-wrapper.vsix', (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Failed to package extension:', stderr);
            process.exit(1);
        }

        console.log('✅ Extension packaged successfully!');
        console.log(stdout);

        const vsixPath = path.join(extensionRoot, 'dist', 'flutter-widget-wrapper.vsix');
        if (fs.existsSync(vsixPath)) {
            console.log(`\n📋 Installation Instructions:
1. In VSCode, go to Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
2. Click the "..." menu (top right) and select "Install from VSIX..."
3. Browse to this file: ${vsixPath}
4. Select it and click "Install"

Or run this command:
code --install-extension ${vsixPath}
`);
        }
    });
}

// Helper function to create a simple placeholder icon
function createPlaceholderIcon(filePath) {
    // Base64 encoded 128x128 PNG with "FW" text (Flutter Widget)
    // This is a small, simple PNG that will work as a placeholder
    const iconBase64 = `iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAAnFBMVEUAAAAbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidsbidubbhzjAAAAM3RSTlMAA/sG+fLt5TYS18EJ7Ll6c2lhWVE6Eg30m5OMioN3MC8mHwzey7SxqaGZkGtXU0k1LIohvG5AAAA+SURBVHja7cEBDQAAAMKg909tDwcUAAAAAAAAAAAAgLcCs7YAAWZhSYoAAAAASUVORK5CYII=`;

    // Write the binary data to the file
    const iconData = Buffer.from(iconBase64, 'base64');
    fs.writeFileSync(filePath, iconData);
}
