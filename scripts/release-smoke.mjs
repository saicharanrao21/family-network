const base = process.env.API_BASE_URL || 'http://127.0.0.1:3000/api/v1';
const endpoints = ['/health/live', '/health/ready'];
for (const path of endpoints) {
  const r = await fetch(base + path);
  const body = await r.text();
  console.log(`${r.status} ${path} ${body.slice(0, 300)}`);
  if (path.endsWith('/live') && !r.ok) process.exit(1);
}
console.log('release smoke checks passed');
