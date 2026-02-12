import express from 'express'
import { models } from '../setup/database.js'

const router = express.Router()

// List bullion merchants
router.get('/', async (req, res) => {
  const merchants = await models.BullionMerchant.findAll({ order: [['createdAt', 'DESC']] })
  res.render('production/bullion_merchants/list', { title: 'Bullion Merchants', merchants })
})

// New bullion merchant form
router.get('/new', (req, res) => {
  res.render('production/bullion_merchants/new', { title: 'Add Bullion Merchant' })
})

// Create
router.post('/', async (req, res) => {
  const { name, mobile_number, address } = req.body
  await models.BullionMerchant.create({ name, mobile_number, address })
  res.redirect('/bullion-merchants')
})

// Edit form
router.get('/:id/edit', async (req, res) => {
  const merchant = await models.BullionMerchant.findByPk(req.params.id)
  if (!merchant) return res.status(404).send('Not found')
  res.render('production/bullion_merchants/edit', { title: 'Edit Bullion Merchant', merchant })
})

// Update
router.post('/:id/edit', async (req, res) => {
  const { name, mobile_number, address } = req.body
  const merchant = await models.BullionMerchant.findByPk(req.params.id)
  if (!merchant) return res.status(404).send('Not found')
  await merchant.update({ name, mobile_number, address })
  res.redirect('/bullion-merchants')
})

// Delete
router.post('/:id/delete', async (req, res) => {
  const merchant = await models.BullionMerchant.findByPk(req.params.id)
  if (merchant) await merchant.destroy()
  res.redirect('/bullion-merchants')
})

export default router
