import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walkDir(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const badPatterns = [
  /box-shadow:(?!\s*none)/g,
  /linear-gradient/g,
  /radial-gradient/g,
  /rgba\(/g,
  /blur\(/g,
  /ease/g,
  /cubic-bezier/g,
  /border-radius(?![a-zA-Z-]):(?!\s*0)/g, // Look for border-radius but ignore things like border-radius-top-left
];

let totalMatches = 0;
const files = walkDir('src').filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.css'));

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of badPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      totalMatches += matches.length;
    }
  }
}

console.log(totalMatches);
