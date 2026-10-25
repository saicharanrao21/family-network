import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const forbidden = [/CHANGE_ME_ACCESS_SECRET/, /CHANGE_ME_REFRESH_SECRET/, /password\s*=\s*['\"]/i];
const skip = new Set(['node_modules','.git','.dart_tool','build']);
let failures=[];
function walk(dir){
  for(const name of readdirSync(dir)){
    if(skip.has(name)) continue;
    const p=join(dir,name); const s=statSync(p);
    if(s.isDirectory()) walk(p);
    else if(/\.(ts|dart|js|json|yaml|yml|env|md)$/.test(name)){
      const text=readFileSync(p,'utf8');
      for(const rx of forbidden) if(rx.test(text) && !p.endsWith('.env.example') && !p.endsWith('.env.production.example')) failures.push(`${p}: ${rx}`);
    }
  }
}
walk(root);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('release source secret scan passed');
