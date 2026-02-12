import express from 'express'
import { Op } from 'sequelize'
import { models } from '../setup/database.js'

const router = express.Router()

// GET all products
router.get('/', async (req, res) => {
  try {
    const { search, category, active } = req.query
    const where = {}

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ]
    }

    if (category) where.category = category
    if (active === 'true') where.isActive = true
    if (active === 'false') where.isActive = false

    const [products, categories] = await Promise.all([
      models.Product.findAll({
        where,
        order: [['name', 'ASC']]
      }),
      models.Product.findAll({
        attributes: ['category'],
        where: { category: { [Op.not]: null } },
        group: ['category'],
        raw: true
      })
    ])

    const categoryList = categories.map(c => c.category).filter(Boolean)

    res.render('products/list', {
      title: 'Products',
      products,
      categories: categoryList,
      filters: { search, category, active }
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error fetching products')
  }
})

// GET add form
router.get('/add', async (req, res) => {
  try {
    const categories = await models.Product.findAll({
      attributes: ['category'],
      where: { category: { [Op.not]: null } },
      group: ['category'],
      raw: true
    })
    const categoryList = categories.map(c => c.category).filter(Boolean)

    res.render('products/form', {
      title: 'Add Product',
      isEdit: false,
      categories: categoryList,
      product: {}
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error loading form')
  }
})

// POST create product
router.post('/', async (req, res) => {
  try {
    const { name, sku, description, category, price, cost, stock, image, isActive } = req.body

    const existingSKU = await models.Product.findOne({ where: { sku } })
    if (existingSKU) {
      return res.status(400).send('SKU already exists')
    }

    const product = await models.Product.create({
      name: name.trim(),
      sku: sku.trim(),
      description: description || null,
      category: category || null,
      price: parseFloat(price) || 0,
      cost: parseFloat(cost) || 0,
      stock: parseInt(stock) || 0,
      image: image || null,
      isActive: isActive === 'on' || isActive === true
    })

    res.redirect(`/products/${product.id}`)
  } catch (err) {
    console.error(err)
    res.status(400).send('Error creating product: ' + err.message)
  }
})

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const product = await models.Product.findByPk(req.params.id)
    if (!product) return res.status(404).send('Product not found')

    const profit = product.price - product.cost
    const profitMargin = product.cost > 0 ? ((profit / product.cost) * 100).toFixed(2) : 0

    res.render('products/view', {
      title: product.name,
      product,
      profit,
      profitMargin
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error fetching product')
  }
})

// GET edit form
router.get('/:id/edit', async (req, res) => {
  try {
    const product = await models.Product.findByPk(req.params.id)
    if (!product) return res.status(404).send('Product not found')

    const categories = await models.Product.findAll({
      attributes: ['category'],
      where: { category: { [Op.not]: null } },
      group: ['category'],
      raw: true
    })
    const categoryList = categories.map(c => c.category).filter(Boolean)

    res.render('products/form', {
      title: 'Edit Product',
      isEdit: true,
      product,
      categories: categoryList
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error loading form')
  }
})

// POST update product
router.post('/:id/edit', async (req, res) => {
  try {
    const product = await models.Product.findByPk(req.params.id)
    if (!product) return res.status(404).send('Product not found')

    const { name, sku, description, category, price, cost, stock, image, isActive } = req.body

    // Check SKU uniqueness (if changed)
    if (sku !== product.sku) {
      const existingSKU = await models.Product.findOne({ where: { sku } })
      if (existingSKU) {
        return res.status(400).send('SKU already exists')
      }
    }

    await product.update({
      name: name.trim(),
      sku: sku.trim(),
      description: description || null,
      category: category || null,
      price: parseFloat(price) || 0,
      cost: parseFloat(cost) || 0,
      stock: parseInt(stock) || 0,
      image: image || null,
      isActive: isActive === 'on' || isActive === true
    })

    res.redirect(`/products/${product.id}`)
  } catch (err) {
    console.error(err)
    res.status(400).send('Error updating product: ' + err.message)
  }
})

// POST delete product
router.post('/:id/delete', async (req, res) => {
  try {
    const product = await models.Product.findByPk(req.params.id)
    if (!product) return res.status(404).send('Product not found')

    await product.destroy()
    res.redirect('/products')
  } catch (err) {
    console.error(err)
    res.status(500).send('Error deleting product')
  }
})

// API: Get all products as JSON
router.get('/api/all', async (req, res) => {
  try {
    const products = await models.Product.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    })
    res.json(products)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// API: Get product by SKU
router.get('/api/sku/:sku', async (req, res) => {
  try {
    const product = await models.Product.findOne({
      where: { sku: req.params.sku }
    })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// API: Get product stats
router.get('/api/stats', async (req, res) => {
  try {
    const totalProducts = await models.Product.count()
    const activeProducts = await models.Product.count({ where: { isActive: true } })
    const totalStock = await models.Product.sum('stock') || 0
    const totalValue = await models.Product.sum(
      models.sequelize.literal('stock * price')
    ) || 0

    res.json({
      totalProducts,
      activeProducts,
      totalStock,
      totalValue
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

export default router

git remote set-url origin  git@github.com:DhruvRabadiya/Jewellery_crm.git
