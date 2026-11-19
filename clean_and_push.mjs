import { Pool } from 'pg'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })

// Drop all camelCase tables that conflict with Prisma schema
const camelTables = [
  'AdminAlert', 'AgentMemory', 'BillingEvent', 'CalendarEvent', 'Campaign', 'CampaignRecipient',
  'Contact', 'Deal', 'EmailVerificationToken', 'Lead', 'Media', 'Message', 'Organization',
  'OrganizationMember', 'PasswordResetToken', 'Permission', 'Pipeline', 'Plan', 'Post',
  'Product', 'Report', 'Role', 'Session', 'Subscription', 'Task', 'TaskEvent', 'TaskStep',
  'Usage', 'User', 'Video', 'Warehouse', 'WebhookEvent', 'WhatsappChannel', 'WhatsappTemplate',
  'WhatsappInstance', 'GrowthLead', 'ScraperConfig', 'RiskLog', 'IntegrationEvent',
  'MetaIntegration', 'WebhookDeadLetter', 'MessageStatus'
]

async function clean() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const table of camelTables) {
      try {
        await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`)
        console.log(`Dropped ${table}`)
      } catch (e) {
        console.log(`Failed to drop ${table}:`, e.message)
      }
    }

    // Also drop the snake_case tables that Prisma manages
    const snakeTables = [
      'admin_alerts', 'agent_memories', 'billing_events', 'calendar_events', 'campaigns',
      'campaign_recipients', 'contacts', 'deals', 'email_verification_tokens', 'leads',
      'media', 'messages', 'organizations', 'organization_members', 'password_reset_tokens',
      'permissions', 'pipelines', 'plans', 'posts', 'products', 'reports', 'roles',
      'sessions', 'subscriptions', 'tasks', 'task_events', 'task_steps', 'usage',
      'users', 'videos', 'warehouses', 'webhook_events', 'whatsapp_channels',
      'whatsapp_templates', 'whatsapp_instances', 'growth_leads', 'scraper_configs',
      'risk_logs', 'integration_events', 'meta_integrations', 'webhook_dead_letter',
      'message_status', 'billing_events', 'integration_events', 'meta_integrations',
      'inventory_movements', 'product_variations', 'stock_balances', 'scraper_configs'
    ]

    for (const table of snakeTables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`)
        console.log(`Dropped ${table}`)
      } catch (e) {
        console.log(`Failed to drop ${table}:`, e.message)
      }
    }

    await client.query('COMMIT')
    console.log('Cleanup complete')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Error:', e.message)
  } finally {
    client.release()
    await pool.end()
  }
}

clean()