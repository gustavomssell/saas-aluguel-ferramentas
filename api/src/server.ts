import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import fs from 'node:fs'
import { env } from './env.js'
import { errorHandler, notFoundHandler } from './lib/http.js'
import { authRouter } from './routes/auth.js'
import { catalogRouter } from './routes/catalog.js'
import { customersRouter } from './routes/customers.js'
import { kitsRouter } from './routes/kits.js'
import { rentalsRouter } from './routes/rentals.js'
import { timelineRouter } from './routes/timeline.js'
import { dashboardRouter } from './routes/dashboard.js'
import { financeRouter } from './routes/finance.js'
import { teamRouter } from './routes/team.js'
import { reportsRouter } from './routes/reports.js'
import { equipmentRouter, uploadsDir } from './routes/equipment.js'

const app = express()

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: env.webOrigin, credentials: true }))
app.use(express.json({ limit: '2mb' }))

fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/api/uploads', express.static(uploadsDir, { maxAge: '1d', fallthrough: false }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'canteiro-api', time: new Date().toISOString() })
})

app.use('/api/auth', authRouter)
app.use('/api', catalogRouter)
app.use('/api/customers', customersRouter)
app.use('/api/kits', kitsRouter)
app.use('/api/rentals', rentalsRouter)
app.use('/api/timeline', timelineRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/finance', financeRouter)
app.use('/api/team', teamRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/equipment', equipmentRouter)

app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`Canteiro API ouvindo em http://localhost:${env.port}`)
})
