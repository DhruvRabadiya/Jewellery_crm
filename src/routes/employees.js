import express from 'express'
import { models } from '../setup/database.js'

const router = express.Router()

// List employees
router.get('/', async (req, res) => {
  const employees = await models.Employee.findAll({ order: [['createdAt', 'DESC']] })
  res.render('production/employees/list', { title: 'Employees', employees })
})

// New employee form
router.get('/new', (req, res) => res.render('production/employees/new', { title: 'Add Employee' }))

// Create
router.post('/', async (req, res) => {
  const { name, rate } = req.body
  await models.Employee.create({ name, rate: parseFloat(rate || 0) })
  res.redirect('/employees')
})

// Edit form
router.get('/:id/edit', async (req, res) => {
  const employee = await models.Employee.findByPk(req.params.id)
  if (!employee) return res.status(404).send('Not found')
  res.render('production/employees/edit', { title: 'Edit Employee', employee })
})

// Update
router.post('/:id/edit', async (req, res) => {
  const { name, rate } = req.body
  const employee = await models.Employee.findByPk(req.params.id)
  if (!employee) return res.status(404).send('Not found')
  await employee.update({ name, rate: parseFloat(rate || 0) })
  res.redirect('/employees')
})

// Delete
router.post('/:id/delete', async (req, res) => {
  const employee = await models.Employee.findByPk(req.params.id)
  if (employee) await employee.destroy()
  res.redirect('/employees')
})

export default router
