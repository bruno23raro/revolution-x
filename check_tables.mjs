import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const pool = new Pool({ connectionString: 'postgresql://postgres:B23b23v1814*@db.ardpabjoepzhkpmkgwgu.supabase.co:5432/postgres' })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const tables = await prisma.$queryRawUnsafe('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' ORDER BY table_name')
console.log(JSON.stringify(tables, null, 2))
await prisma.$disconnect()
await pool.end()