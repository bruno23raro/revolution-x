$env:DATABASE_URL = "postgresql://postgres.ardpabjoepzhkpmkgwgu:B23b23v1814*@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
$env:DIRECT_URL = "postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres"

$env:DATABASE_URL | npx vercel env add DATABASE_URL production --yes 2>&1
$env:DATABASE_URL | npx vercel env add DATABASE_URL preview --yes 2>&1
$env:DIRECT_URL | npx vercel env add DIRECT_URL production --yes 2>&1
$env:DIRECT_URL | npx vercel env add DIRECT_URL preview --yes 2>&1