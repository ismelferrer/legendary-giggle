#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Pre-deployment Checklist for Render\n');

const checks = [];

// Check 1: .render.yaml exists
if (fs.existsSync('.render.yaml')) {
  checks.push({ name: '.render.yaml configuration', status: '✅', message: 'File exists' });
} else {
  checks.push({ name: '.render.yaml configuration', status: '❌', message: 'File missing' });
}

// Check 2: Package.json has correct scripts
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredScripts = ['start', 'build'];
let scriptCheck = true;

requiredScripts.forEach(script => {
  if (!packageJson.scripts[script]) {
    scriptCheck = false;
  }
});

if (scriptCheck) {
  checks.push({ name: 'package.json scripts', status: '✅', message: 'All required scripts present' });
} else {
  checks.push({ name: 'package.json scripts', status: '❌', message: 'Missing required scripts' });
}

// Check 3: Node version compatibility
const nodeVersion = packageJson.engines?.node;
if (nodeVersion && nodeVersion.includes('>=18')) {
  checks.push({ name: 'Node.js version', status: '✅', message: 'Compatible with Render' });
} else {
  checks.push({ name: 'Node.js version', status: '⚠️', message: 'Should specify >=18.0.0' });
}

// Check 4: Dependencies
const requiredDeps = ['@supabase/supabase-js', 'bull', 'redis', 'axios', 'express'];
let depsCheck = true;

requiredDeps.forEach(dep => {
  if (!packageJson.dependencies[dep]) {
    depsCheck = false;
  }
});

if (depsCheck) {
  checks.push({ name: 'Required dependencies', status: '✅', message: 'All dependencies present' });
} else {
  checks.push({ name: 'Required dependencies', status: '❌', message: 'Some dependencies missing' });
}

// Check 5: Critical files
const criticalFiles = [
  'index.js',
  'config/supabase.js',
  'config/redis.js',
  'services/supabaseService.js',
  'services/workerService.js',
  'services/queueService.js',
  'routes/userRoutes',
  'routes/workerRoutes.js',
  'routes/supabaseRoutes.js'
];

let filesCheck = true;
const missingFiles = [];

criticalFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    filesCheck = false;
    missingFiles.push(file);
  }
});

if (filesCheck) {
  checks.push({ name: 'Critical files', status: '✅', message: 'All files present' });
} else {
  checks.push({ name: 'Critical files', status: '❌', message: `Missing: ${missingFiles.join(', ')}` });
}

// Check 6: .gitignore
if (fs.existsSync('.gitignore')) {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  if (gitignore.includes('.env') && gitignore.includes('node_modules')) {
    checks.push({ name: '.gitignore', status: '✅', message: 'Properly configured' });
  } else {
    checks.push({ name: '.gitignore', status: '⚠️', message: 'Should include .env and node_modules' });
  }
} else {
  checks.push({ name: '.gitignore', status: '❌', message: 'File missing' });
}

// Check 7: Documentation
const docFiles = ['RENDER_DEPLOYMENT_GUIDE.md', 'INTEGRATION_GUIDE.md'];
let docCheck = true;

docFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    docCheck = false;
  }
});

if (docCheck) {
  checks.push({ name: 'Documentation', status: '✅', message: 'Deployment guides present' });
} else {
  checks.push({ name: 'Documentation', status: '⚠️', message: 'Some guides missing' });
}

// Display results
console.log('📋 Checklist Results:\n');
checks.forEach(check => {
  console.log(`${check.status} ${check.name}: ${check.message}`);
});

// Summary
const passed = checks.filter(c => c.status === '✅').length;
const warnings = checks.filter(c => c.status === '⚠️').length;
const failed = checks.filter(c => c.status === '❌').length;

console.log(`\n📊 Summary:`);
console.log(`✅ Passed: ${passed}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log(`❌ Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 Ready for deployment to Render!');
  console.log('\nNext steps:');
  console.log('1. Push your code to GitHub/GitLab');
  console.log('2. Create services in Render Dashboard');
  console.log('3. Configure environment variables');
  console.log('4. Deploy and monitor logs');
  console.log('\n📖 See RENDER_DEPLOYMENT_GUIDE.md for detailed instructions');
} else {
  console.log('\n⚠️  Please fix the failed checks before deploying');
  process.exit(1);
}