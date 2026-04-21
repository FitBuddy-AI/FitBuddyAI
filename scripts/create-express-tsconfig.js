import path from 'path';

// This script previously attempted to create a shim inside node_modules at
// install time. That behavior is fragile (breaks reproducible installs,
// fails in read-only CI environments, and hides dependency issues). Fail
// fast here with guidance so maintainers can fix the root cause instead.

const expectedPackagePath = path.join(process.cwd(), 'node_modules', '@express-rate-limit', 'tsconfig');
console.error('Refusing to create a runtime shim in node_modules. Expected package path:', expectedPackagePath);
console.error('Fix the root cause by installing the real package if available, pinning/upgrading the depending package, or adjusting your TypeScript configuration.');
process.exit(1);
