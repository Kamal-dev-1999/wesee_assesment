import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Copy static files
const publicDir = path.join(__dirname, 'public');
const distPublicDir = path.join(distDir, 'public');

if (!fs.existsSync(distPublicDir)) {
  fs.mkdirSync(distPublicDir);
}

// Copy HTML file
const htmlContent = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
fs.writeFileSync(path.join(distPublicDir, 'index.html'), htmlContent);

// Copy CSS file (minified)
const cssContent = fs.readFileSync(path.join(publicDir, 'styles.css'), 'utf8');
const minifiedCSS = cssContent
  .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
  .replace(/\s+/g, ' ') // Remove extra whitespace
  .replace(/\s*{\s*/g, '{') // Remove whitespace around braces
  .replace(/\s*}\s*/g, '}') // Remove whitespace around braces
  .replace(/\s*:\s*/g, ':') // Remove whitespace around colons
  .replace(/\s*;\s*/g, ';') // Remove whitespace around semicolons
  .replace(/\s*,\s*/g, ',') // Remove whitespace around commas
  .trim();
fs.writeFileSync(path.join(distPublicDir, 'styles.css'), minifiedCSS);

// Copy JS file (minified)
const jsContent = fs.readFileSync(path.join(publicDir, 'client.js'), 'utf8');
const minifiedJS = jsContent
  .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
  .replace(/\/\/.*$/gm, '') // Remove line comments
  .replace(/\s+/g, ' ') // Remove extra whitespace
  .replace(/\s*{\s*/g, '{') // Remove whitespace around braces
  .replace(/\s*}\s*/g, '}') // Remove whitespace around braces
  .replace(/\s*;\s*/g, ';') // Remove whitespace around semicolons
  .replace(/\s*,\s*/g, ',') // Remove whitespace around commas
  .trim();
fs.writeFileSync(path.join(distPublicDir, 'client.js'), minifiedJS);

// Copy server.js
const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
fs.writeFileSync(path.join(distDir, 'server.js'), serverContent);

// Copy package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
// Remove devDependencies for production
delete packageJson.devDependencies;
packageJson.scripts = {
  "start": "node server.js",
  "prod": "NODE_ENV=production node server.js"
};
fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(packageJson, null, 2));

// Copy README.md
const readmeContent = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
fs.writeFileSync(path.join(distDir, 'README.md'), readmeContent);

console.log('✅ Build completed successfully!');
console.log('📁 Production files are in the "dist" directory');
console.log('🚀 To deploy: cd dist && npm install && npm start');
