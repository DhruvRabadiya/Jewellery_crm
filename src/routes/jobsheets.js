import express from 'express'
import { Op, QueryTypes } from 'sequelize'
import { models } from '../setup/database.js'
import { sequelize } from '../setup/database.js'

const router = express.Router()

// GET list with filters
router.get('/', async (req, res) => {
  const { date, employeeId, status } = req.query
  const where = {}
  if (date) where.issueDate = { [Op.gte]: new Date(date) }
  if (employeeId) where.EmployeeId = employeeId
  if (status) where.status = status

  const [jobsheets, employees] = await Promise.all([
    models.JobSheet.findAll({
      where,
      include: [
        { model: models.Employee, as: 'Employee' },
        { model: models.JobSheetStep, order: [['stepOrder', 'ASC']] }
      ],
      order: [['createdAt', 'DESC']]
    }),
    models.Employee.findAll({ order: [['name', 'ASC']] })
  ])

  res.render('production/jobsheets/list', { title: 'Job Sheets', jobsheets, employees, filters: { date, employeeId, status } })
})

// GET dashboard
router.get('/dashboard', async (req, res) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  // Total issued weight (all time)
  const totalIssued = await models.JobSheet.sum('issueWeight') || 0

  // Total returned weight (all time)
  const totalReturned = await models.JobSheet.sum('returnWeight') || 0
  
  // Total scrap weight (all time)
  const totalScrap = await models.JobSheet.sum('scrapWeight') || 0
  
  // Total dust weight (all time)
  const totalDust = await models.JobSheet.sum('dustWeight') || 0

  // Loss today
  const lossToday = await models.JobSheet.sum('totalLoss', {
    where: { issueDate: { [Op.gte]: today } }
  }) || 0

  // Loss this month
  const lossMonth = await models.JobSheet.sum('totalLoss', {
    where: { issueDate: { [Op.gte]: monthStart } }
  }) || 0
  
  // Scrap this month
  const scrapMonth = await models.JobSheet.sum('scrapWeight', {
    where: { issueDate: { [Op.gte]: monthStart } }
  }) || 0
  
  // Dust this month
  const dustMonth = await models.JobSheet.sum('dustWeight', {
    where: { issueDate: { [Op.gte]: monthStart } }
  }) || 0

  // Pending jobs (In-Progress status)
  const pendingCount = await models.JobSheet.count({
    where: { status: 'In-Progress' }
  })

  res.render('production/jobsheets/dashboard', {
    title: 'Job Sheet Dashboard',
    totalIssued,
    totalReturned,
    totalScrap,
    totalDust,
    lossToday,
    lossMonth,
    scrapMonth,
    dustMonth,
    pendingCount
  })
})

// GET create form
router.get('/new', async (req, res) => {
  const employees = await models.Employee.findAll({ order: [['name', 'ASC']] })
  
  // Get next job number
  const lastJobSheet = await models.JobSheet.findOne({
    order: [['createdAt', 'DESC']]
  })
  const nextJobNo = lastJobSheet 
    ? `JOB-${parseInt(lastJobSheet.jobNo.split('-')[1]) + 1}` 
    : 'JOB-1001'

  res.render('production/jobsheets/create', {
    title: 'Create Job Sheet',
    employees,
    nextJobNo
  })
})

// POST create
router.post('/', async (req, res) => {
  const { 
    jobNo, employeeId, issueWeight, material, size
  } = req.body
  
  try {
    const issue = parseFloat(issueWeight)
    
    // Create job sheet with multi-step workflow
    const jobsheet = await models.JobSheet.create({
      jobNo,
      EmployeeId: employeeId,
      metalType: material === 'gold' ? 'GOLD' : 'SILVER',
      purity: '22K',
      issueWeight: issue,
      issueDate: new Date(),
      size,
      currentStep: 'melting',
      status: 'In-Progress',
      loss: 0,
      totalLoss: 0,
      scrapWeight: 0,
      dustWeight: 0,
      returnWeight: 0
    })

    // Create all steps for the workflow
    const steps = [
      { name: 'melting', order: 1, label: '🔥 ગાળવા (Melting)' },
      { name: 'rolling', order: 2, label: '📏 પાટા કરવો (Rolling)' },
      { name: 'press', order: 3, label: '🔨 ચિચો (Press)' },
      { name: 'TPP', order: 4, label: '⚙️ T+P+P' },
      { name: 'packing', order: 5, label: '📦 પેકિંગ (Packaging)' }
    ]

    for (const step of steps) {
      await models.JobSheetStep.create({
        JobSheetId: jobsheet.id,
        EmployeeId: employeeId,
        stepName: step.name,
        stepOrder: step.order,
        status: step.order === 1 ? 'in-progress' : 'pending',
        issueWeight: step.order === 1 ? issue : 0,
        startDate: step.order === 1 ? new Date() : null
      })
    }

    // Log creation
    await models.AuditLog.create({
      jobSheetId: jobsheet.id,
      action: 'created',
      changedFields: jobsheet.toJSON()
    })

    res.redirect('/jobsheets')
  } catch (err) {
    const employees = await models.Employee.findAll({ order: [['name', 'ASC']] })
    res.status(400).render('production/jobsheets/create', {
      title: 'Create Job Sheet',
      employees,
      error: err.message
    })
  }
})

// GET single job sheet
router.get('/:id', async (req, res) => {
  const jobsheet = await models.JobSheet.findByPk(req.params.id, {
    include: [
      { model: models.Employee },
      { 
        model: models.JobSheetStep, 
        include: [{ model: models.Employee }],
        order: [['stepOrder', 'ASC']]
      }
    ]
  })
  if (!jobsheet) return res.status(404).send('Not found')
  res.render('production/jobsheets/view', { title: `Job ${jobsheet.jobNo}`, jobsheet })
})

// GET complete current step form
router.get('/:id/complete-step', async (req, res) => {
  const jobsheet = await models.JobSheet.findByPk(req.params.id, {
    include: [
      { model: models.Employee },
      { model: models.JobSheetStep, order: [['stepOrder', 'ASC']] }
    ]
  })
  if (!jobsheet) return res.status(404).send('Not found')
  
  // Check if job is already completed
  if (jobsheet.status === 'Completed') {
    return res.redirect(`/jobsheets/${jobsheet.id}?message=Job already completed`)
  }
  
  const currentStep = jobsheet.JobSheetSteps.find(s => s.status === 'in-progress')
  const employees = await models.Employee.findAll({ order: [['name', 'ASC']] })
  
  // Verify no steps are skipped
  const allSteps = jobsheet.JobSheetSteps.sort((a, b) => a.stepOrder - b.stepOrder)
  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i]
    if (step.status === 'pending' && i > 0 && allSteps[i-1].status !== 'completed') {
      return res.status(400).render('production/jobsheets/complete-step', {
        title: `Complete Step - ${jobsheet.jobNo}`,
        jobsheet,
        currentStep: null,
        employees,
        error: 'Previous steps must be completed first'
      })
    }
  }
  
  res.render('production/jobsheets/complete-step', { 
    title: `Complete Step - ${jobsheet.jobNo}`, 
    jobsheet, 
    currentStep,
    employees
  })
})

// POST complete current step
router.post('/:id/complete-step', async (req, res) => {
  const { returnWeight, scrapWeight, dustWeight, pieces, returnPieces, employeeId, notes } = req.body
  
  try {
    const jobsheet = await models.JobSheet.findByPk(req.params.id, {
      include: [
        { model: models.Employee },
        { model: models.JobSheetStep, order: [['stepOrder', 'ASC']] }
      ]
    })
    
    if (!jobsheet) return res.status(404).send('Not found')
    
    // Check if job is already completed
    if (jobsheet.status === 'Completed') {
      return res.redirect(`/jobsheets/${jobsheet.id}?message=Job already completed`)
    }
    
    // Find current step
    const currentStep = jobsheet.JobSheetSteps.find(s => s.status === 'in-progress')
    if (!currentStep) {
      return res.status(400).render('production/jobsheets/complete-step', {
        title: `Complete Step - ${jobsheet.jobNo}`,
        jobsheet,
        currentStep: null,
        employees: await models.Employee.findAll({ order: [['name', 'ASC']] }),
        error: 'No active step found for this job sheet'
      })
    }
    
    // Verify all previous steps are completed
    const previousSteps = jobsheet.JobSheetSteps.filter(s => s.stepOrder < currentStep.stepOrder)
    const incompletePrevious = previousSteps.find(s => s.status !== 'completed')
    if (incompletePrevious) {
      return res.status(400).render('production/jobsheets/complete-step', {
        title: `Complete Step - ${jobsheet.jobNo}`,
        jobsheet,
        currentStep,
        employees: await models.Employee.findAll({ order: [['name', 'ASC']] }),
        error: `Step ${incompletePrevious.stepOrder} must be completed before step ${currentStep.stepOrder}`
      })
    }
    
    const returned = parseFloat(returnWeight || 0)
    const scrap = parseFloat(scrapWeight || 0)
    const dust = parseFloat(dustWeight || 0)
    
    // Validation: total output cannot exceed input
    const totalOutput = returned + scrap + dust
    if (totalOutput > currentStep.issueWeight) {
      const employees = await models.Employee.findAll({ order: [['name', 'ASC']] })
      return res.status(400).render('production/jobsheets/complete-step', {
        title: `Complete Step - ${jobsheet.jobNo}`,
        jobsheet,
        currentStep,
        employees,
        error: `Total output (${totalOutput.toFixed(3)}g) cannot exceed issue weight (${currentStep.issueWeight.toFixed(3)}g)`
      })
    }
    
    // Calculate loss for this step
    const stepLoss = currentStep.issueWeight - totalOutput
    
    // Update current step
    await currentStep.update({
      returnWeight: returned,
      scrapWeight: scrap,
      dustWeight: dust,
      pieces: parseInt(pieces || 0),
      returnPieces: parseInt(returnPieces || 0),
      loss: stepLoss,
      status: 'completed',
      completedDate: new Date(),
      notes,
      EmployeeId: employeeId || currentStep.EmployeeId
    })
    
    // Update jobsheet with accumulated values after each step
    const newTotalLoss = jobsheet.totalLoss + stepLoss
    const newScrapWeight = jobsheet.scrapWeight + scrap
    const newDustWeight = jobsheet.dustWeight + dust
    
    // Check if there's a next step
    const allSteps = jobsheet.JobSheetSteps.sort((a, b) => a.stepOrder - b.stepOrder)
    const nextStep = allSteps.find(s => 
      s.stepOrder === currentStep.stepOrder + 1 && s.status === 'pending'
    )
    
    // Check if this is the last step (no more pending steps)
    const isLastStep = !nextStep || currentStep.stepOrder === 5
    
    if (isLastStep) {
      // All steps completed - update with final values
      await jobsheet.update({
        currentStep: 'completed',
        status: 'Completed',
        completedDate: new Date(),
        returnWeight: returned,
        scrapWeight: newScrapWeight,
        dustWeight: newDustWeight,
        totalLoss: newTotalLoss,
        returnPieces: parseInt(returnPieces || 0)
      })
    } else {
      // Step completed but not last - keep status as In-Progress, don't auto-start next
      await jobsheet.update({
        currentStep: currentStep.stepName,
        status: 'In-Progress',
        totalLoss: newTotalLoss,
        scrapWeight: newScrapWeight,
        dustWeight: newDustWeight,
        lastReturnWeight: returned  // Store for next step
      })
    }
    
    // Log step completion
    await models.AuditLog.create({
      jobSheetId: jobsheet.id,
      action: isLastStep ? 'job_completed' : 'step_completed',
      changedFields: { 
        step: currentStep.stepName,
        stepOrder: currentStep.stepOrder,
        returnWeight: returned,
        scrapWeight: scrap,
        dustWeight: dust,
        loss: stepLoss,
        totalLoss: newTotalLoss,
        employeeId: employeeId || currentStep.EmployeeId,
        finalStatus: isLastStep ? 'Completed' : 'In-Progress'
      }
    })
    
    res.redirect(`/jobsheets/${jobsheet.id}`)
  } catch (err) {
    console.error('Error completing step:', err)
    const jobsheet = await models.JobSheet.findByPk(req.params.id, {
      include: [
        { model: models.Employee },
        { model: models.JobSheetStep, order: [['stepOrder', 'ASC']] }
      ]
    })
    const currentStep = jobsheet?.JobSheetSteps?.find(s => s.status === 'in-progress')
    const employees = await models.Employee.findAll({ order: [['name', 'ASC']] })
    
    res.status(400).render('production/jobsheets/complete-step', {
      title: jobsheet ? `Complete Step - ${jobsheet.jobNo}` : 'Complete Step',
      jobsheet,
      currentStep,
      employees,
      error: err.message || 'An error occurred while completing the step'
    })
  }
})

// POST start next step
router.post('/:id/start-next-step', async (req, res) => {
  try {
    const jobsheet = await models.JobSheet.findByPk(req.params.id, {
      include: [{ model: models.JobSheetStep, order: [['stepOrder', 'ASC']] }]
    })
    
    if (!jobsheet) return res.status(404).send('Not found')
    
    if (jobsheet.status === 'Completed') {
      return res.redirect(`/jobsheets/${jobsheet.id}?message=Job already completed`)
    }
    
    // Find the last completed step
    const completedSteps = jobsheet.JobSheetSteps.filter(s => s.status === 'completed').sort((a, b) => b.stepOrder - a.stepOrder)
    const lastCompleted = completedSteps[0]
    
    if (!lastCompleted) {
      return res.status(400).send('No completed step found')
    }
    
    // Find next pending step
    const nextStep = jobsheet.JobSheetSteps.find(s => 
      s.stepOrder === lastCompleted.stepOrder + 1 && s.status === 'pending'
    )
    
    if (!nextStep) {
      return res.status(400).send('No next step available')
    }
    
    // Start next step with return weight from previous step
    await nextStep.update({
      status: 'in-progress',
      issueWeight: lastCompleted.returnWeight || jobsheet.lastReturnWeight || 0,
      startDate: new Date()
    })
    
    await jobsheet.update({
      currentStep: nextStep.stepName
    })
    
    // Log step start
    await models.AuditLog.create({
      jobSheetId: jobsheet.id,
      action: 'step_started',
      changedFields: {
        step: nextStep.stepName,
        stepOrder: nextStep.stepOrder,
        issueWeight: nextStep.issueWeight
      }
    })
    
    res.redirect(`/jobsheets/${jobsheet.id}/complete-step`)
  } catch (err) {
    console.error('Error starting next step:', err)
    res.status(400).send(err.message)
  }
})

// Legacy routes - kept for backward compatibility but redirected
router.get('/:id/return', async (req, res) => {
  res.redirect(`/jobsheets/${req.params.id}/complete-step`)
})

router.post('/:id/return', async (req, res) => {
  res.redirect(`/jobsheets/${req.params.id}/complete-step`)
})

// GET reports
router.get('/reports/all', async (req, res) => {
  const { reportType } = req.query

  let reportData = {}

  if (reportType === 'karigar' || !reportType) {
    // Karigar-wise loss
    reportData.karigarLoss = await sequelize.query(`
      SELECT e.name, SUM(j.loss) as totalLoss, COUNT(j.id) as jobCount
      FROM JobSheets j
      LEFT JOIN Employees e ON j.EmployeeId = e.id
      GROUP BY j.EmployeeId
      ORDER BY totalLoss DESC
    `, { type: QueryTypes.SELECT })
  }

  if (reportType === 'daily' || !reportType) {
    // Daily loss
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    reportData.dailyLoss = await sequelize.query(`
      SELECT DATE(issueDate) as date, SUM(loss) as totalLoss, COUNT(id) as jobCount
      FROM JobSheets
      WHERE issueDate >= ?
      GROUP BY DATE(issueDate)
      ORDER BY issueDate DESC
      LIMIT 30
    `, {
      replacements: [new Date(today.getFullYear(), today.getMonth() - 1, 1)],
      type: QueryTypes.SELECT
    })
  }

  if (reportType === 'worktype' || !reportType) {
    // Work-type loss
    reportData.worktypeLoss = await sequelize.query(`
      SELECT workType, SUM(loss) as totalLoss, COUNT(id) as jobCount
      FROM JobSheets
      GROUP BY workType
      ORDER BY totalLoss DESC
    `, { type: QueryTypes.SELECT })
  }

  res.render('production/jobsheets/reports', {
    title: 'Job Sheet Reports',
    ...reportData
  })
})

export default router
