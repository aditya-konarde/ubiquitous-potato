import * as fs from 'fs';

const files = [
  'src/content/modules/ui-cleanup.ts',
  'src/content/modules/dark-mode.ts',
  'src/content/modules/command-palette.ts',
  'src/content/modules/inbox-zero.ts',
  'src/content/modules/toast.ts',
  'src/content/modules/tracker-blocker.ts',
  'src/content/modules/saved-searches.ts',
  'src/content/modules/group-by-date.ts',
  'src/content/modules/pause-inbox.ts',
  'src/content/modules/keyboard-nav.ts'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/box-shadow:.*?;/g, 'box-shadow: none;');
  content = content.replace(/border-radius:.*?;/g, 'border-radius: 0;');

  content = content.replace(/ ease-in-out/g, ' linear');
  content = content.replace(/ ease-out/g, ' linear');
  content = content.replace(/ ease-in/g, ' linear');
  content = content.replace(/ ease/g, ' linear');

  content = content.replace(/rgba\(148,\s*163,\s*184,\s*0\.3\)/g, '#d4d4d8');
  content = content.replace(/rgba\(148,\s*163,\s*184,\s*0\.5\)/g, '#a1a1aa');
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.1\)/g, '#27272a');
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.2\)/g, '#3f3f46');

  content = content.replace(/rgba\(0,\s*0,\s*0,\s*0\.2\)/g, '#d4d4d8');
  content = content.replace(/rgba\(0,\s*0,\s*0,\s*0\.1\)/g, '#e4e4e7');
  content = content.replace(/rgba\(0,\s*0,\s*0,\s*0\.05\)/g, '#f4f4f5');
  content = content.replace(/rgba\(0,\s*0,\s*0,\s*0\.6\)/g, '#27272a');
  content = content.replace(/rgba\(0,\s*0,\s*0,\s*0\.5\)/g, '#111111');

  fs.writeFileSync(file, content);
}
console.log('Cleaned bad tokens');
