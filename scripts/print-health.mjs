const url = process.argv[2];

if (!url) {
  console.error("ERROR: Missing URL. Usage: node scripts/print-health.mjs http://localhost:4000/api/health/db");
  process.exit(1);
}

try {
  const response = await fetch(url);
  const text = await response.text();

  try {
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2));
  } catch {
    console.log(text);
  }

  if (!response.ok) {
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
