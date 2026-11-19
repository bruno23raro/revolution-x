import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = 'postgresql://revx:yzcheGaWQbK51Y0IBnNDtpioqEwfS7Fj@localhost:5434/revolution_x'
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const cols = await prisma.$queryRawUnsafe('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'admin_alerts\' ORDER BY ordinal_position')
console.log('admin_alerts columns:', JSON.stringify(cols, null, 2))

const exists = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_name = 'AdminAlert'")
console.log('AdminAlert exists:', JSON.stringify(exists, null, 2))

await prisma.$disconnect()
await pool.end()