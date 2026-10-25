const base = (process.env.API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
const token = process.env.API_SMOKE_TOKEN;
const checks = ['/health', '/health/live'];
for (const path of checks) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  console.log(`${path}: ${response.status}`);
}
if (token) {
  const response = await fetch(`${base}/health/ready`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`/health/ready returned ${response.status}`);
  console.log(`/health/ready: ${response.status}`);
} else {
  console.log('Protected API smoke checks skipped: API_SMOKE_TOKEN not provided.');
}
