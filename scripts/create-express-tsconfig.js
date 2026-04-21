import fs from 'fs';
import path from 'path';

const destDir = path.join(process.cwd(), 'node_modules', '@express-rate-limit', 'tsconfig');
try {
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, 'package.json'), JSON.stringify({ name: '@express-rate-limit/tsconfig', version: '1.0.0', main: 'tsconfig.json' }, null, 2));
  fs.writeFileSync(path.join(destDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'ESNext', skipLibCheck: true, strict: true, forceConsistentCasingInFileNames: true } }, null, 2));
  console.log('Created @express-rate-limit/tsconfig shim in node_modules');
} catch (e) {
  console.error('Failed to create shim:', e);
  process.exit(1);
}
