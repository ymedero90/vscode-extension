const fs = require('fs');
const path = require('path');
const vsce = require('vsce');

// Define paths
const packagePath = path.join(__dirname, 'package.json');
const resourcesPath = path.join(__dirname, 'resources');
let originalPackageContent;

// Ensure directories exist
[resourcesPath, extensionDirPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

const pngIconPath = path.join(resourcesPath, 'icon-extension.png');
const svgIconPath = path.join(resourcesPath, 'icon-extension.svg');

// Create a simple placeholder PNG if it doesn't exist
if (!fs.existsSync(pngIconPath)) {
    console.log('Creating placeholder PNG icon...');
    // This is a minimal valid PNG file (1x1 pixel, transparent)
    const minimalPNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(pngIconPath, minimalPNG);
}

// Create a simple placeholder SVG if it doesn't exist
if (!fs.existsSync(svgIconPath)) {
    console.log('Creating placeholder SVG icon...');
    const minimalSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <rect width="24" height="24" fill="#1976D2"/>
        <text x="12" y="16" font-family="Arial" font-size="14" fill="white" text-anchor="middle">FW</text>
    </svg>`;
    fs.writeFileSync(svgIconPath, minimalSVG);
}

try {
    // Backup original package.json
    originalPackageContent = fs.readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(originalPackageContent);

    // Update the package.json to use the correct icon path
    packageJson.icon = 'resources/icon-extension.png';

    // Configure activity bar icons if they exist
    if (packageJson.contributes &&
        packageJson.contributes.viewsContainers &&
        packageJson.contributes.viewsContainers.activitybar) {
        packageJson.contributes.viewsContainers.activitybar.forEach(container => {
            if (container.icon) {
                container.icon = 'resources/icon-extension.svg';  // Activity bar icon
            }
        });
    }

    // Write the updated package.json
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

    // Create the VSIX package
    console.log('Creating VSIX package...');
    vsce.createVSIX()
        .then(() => {
            console.log('VSIX package created successfully');
            // Restore original package.json after successful build
            fs.writeFileSync(packagePath, originalPackageContent);
        })
        .catch(err => {
            console.error('Error creating VSIX package:', err);
            // Restore original package.json on error
            fs.writeFileSync(packagePath, originalPackageContent);
            process.exit(1);
        });
} catch (error) {
    console.error('Build process failed:', error);
    // Restore original package.json if we have it
    if (originalPackageContent) {
        fs.writeFileSync(packagePath, originalPackageContent);
    }
    process.exit(1);
}
