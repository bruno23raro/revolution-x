# Add environment variables to Vercel
$envs = @{
    "DATABASE_URL" = "postgresql://postgres.ardpabjoepzhkpmkgwgu:B23b23v1814*@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
    "DIRECT_URL" = "postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres"
    "NEXT_PUBLIC_SUPABASE_URL" = "https://ardpabjoepzhkpmkgwgu.supabase.co"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyZHBhYmpvZXB6aGtwbWtnd2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMTAwMjAsImV4cCI6MjEwNTU4NjAyMH0.2mZAYBtMtCaByKS9qlG6GufYGl0iOEmp0hSLYtfKPgk"
    "SUPABASE_SERVICE_ROLE_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyZHBhYmpvZXB6aGtwbWtnd2d1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDAxMDAyMCwiZXhwIjoyMTA1NTg2MDIwfQ.0qn1a00akc61k5Jw2qnJZFHPE9Je7lfagx9wUB2H_Bk"
    "OPENBSP_BASE_URL" = "https://nheelwshzbgenpavwhcy.supabase.co/rest/v1"
    "OPENBSP_PUBLISHABLE_KEY" = "sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd"
    "OPENBSP_API_KEY" = "sk_dcca9cc0057142ce95bba1e051b01699"
    "OPENBSP_ORG_ID" = "9d7114cd-013e-4e03-b91d-848518bf6514"
    "OPENBSP_WEBHOOK_SECRET" = "whsec_8f4a2b3c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2"
    "OPENBSP_WEBHOOK_VERIFY_TOKEN" = "revolutionx_webhook_2026"
    "ADMIN_EMAIL" = "admin@revolutionx.dev"
    "ADMIN_PASSWORD" = "SenhaForte123!"
    "JWT_SECRET" = "AOFQxqfJrPL4ygc7l1iYNdC0XeBGmUzM3S5wKk89oRZ2sTaW"
    "JWT_REFRESH_SECRET" = "orln43NfvLBKxEYQU0abgCF9sDHz1Zc5IuqWjRTGO8ASX6Mh"
    "NEXT_PUBLIC_SITE_URL" = "https://revolutionx.com.br"
    "CRON_SECRET" = "uN48MaHTFLqBZWsP76Qkiw9zKp05GnxU"
}

foreach ($key in $envs.Keys) {
    $value = $envs[$key]
    foreach ($env in "production", "preview") {
        Write-Host "Adding $key to $env..."
        $value | npx vercel env add $key $env 2>&1
    }
}