import express from 'express'
import { Op, Sequelize } from 'sequelize'
import { models, sequelize } from '../setup/database.js'

const router = express.Router()

// GET all inventory with filters
router.get('/', async (req, res) => {
  try {
    const { category, search, lowStock } = req.query
    const where = {}

    if (category) where.category = category
    if (search) {
      where[Op.or] = [
        { productName: { [Op.like]: `%${search}%` } },
        { productCode: { [Op.like]: `%${search}%` } }
      ]
    }

    let inventory = await models.Inventory.findAll({
      where,
      order: [['productName', 'ASC']],
      raw: false
    })
    
    // Filter low stock in JavaScript if needed
    if (lowStock === 'true') {
      inventory = inventory.filter(item => item.quantity <= item.reorderLevel)
    }
    
    const [categories, lowStockItems] = await Promise.all([
      models.Inventory.findAll({
        attributes: ['category'],
        group: ['category'],
        where: { category: { [Op.not]: null } },
        raw: true
      }),
      models.Inventory.findAll({
        order: [['quantity', 'ASC']],
        raw: false
      }).then(items => items.filter(item => item.quantity <= item.reorderLevel))
    ])

    const categoryList = categories.map(c => c.category).filter(Boolean)

    res.render('production/inventory/list', {
      title: 'Inventory Management',
      inventory,
      categories: categoryList,
      lowStockCount: lowStockItems.length,
      filters: { category, search, lowStock }
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error fetching inventory')
  }
})

// GET dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const totalProducts = await models.Inventory.count()
    
    // Fetch all items and filter low stock in JavaScript
    const allItems = await models.Inventory.findAll({
      order: [['quantity', 'ASC']],
      raw: false
    })
    const lowStockItems = allItems.filter(item => item.quantity <= item.reorderLevel).slice(0, 10)

    const totalValue = allItems.reduce((sum, item) => sum + (item.quantity * item.sellingPrice), 0) || 0;
    const totalInvestment = allItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0) || 0;

    const goldStock = await models.Inventory.findOne({
      where: { productName: 'Gold Stock (Total)', metalType: 'GOLD' }
    });
    const silverStock = await models.Inventory.findOne({
      where: { productName: 'Silver Stock (Total)', metalType: 'SILVER' }
    });

    res.render('production/inventory/dashboard', {
      title: 'Inventory Dashboard',
      stats: {
        totalProducts,
        lowStockCount: lowStockItems.length,
        totalValue,
        totalInvestment,
        totalGoldGrams: goldStock ? goldStock.quantity : 0,
        totalSilverGrams: silverStock ? silverStock.quantity : 0
      },
      lowStockItems
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error loading dashboard')
  }
})

// GET form to add new inventory
router.get('/add', async (req, res) => {
  try {
    const [categories, merchants] = await Promise.all([
      models.Inventory.findAll({
        attributes: ['category'],
        group: ['category'],
        where: { category: { [Op.not]: null } },
        raw: true
      }),
      models.BullionMerchant.findAll({ order: [['name', 'ASC']] })
    ]);
    const categoryList = categories.map(c => c.category).filter(Boolean)

    res.render('production/inventory/form', {
      title: 'Add Inventory Item',
      isEdit: false,
      categories: categoryList,
      merchants: merchants,
      item: {}
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error loading form')
  }
})

// POST - Create new inventory
router.post('/', async (req, res) => {
  try {
    const { productName, productCode, category, metalType, quantity, costPrice, sellingPrice, reorderLevel, supplier, location, description, paymentType } = req.body

    const newItem = await models.Inventory.create({
      productName,
      productCode: productCode || null,
      category: category || null,
      metalType: metalType || 'GOLD',
      quantity: parseFloat(quantity) || 0,
      costPrice: parseFloat(costPrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      reorderLevel: parseFloat(reorderLevel) || 10,
      supplier: supplier || null,
      location: location || null,
      description: description || null,
      paymentType: paymentType || 'CASH'
    })

    // Update total gold/silver stock if the new item is gold or silver
    if (newItem.metalType === 'GOLD' || newItem.metalType === 'SILVER') {
      const totalStockItem = await models.Inventory.findOne({
        where: { productName: `${newItem.metalType} Stock (Total)`, metalType: newItem.metalType }
      });

      if (totalStockItem) {
        await totalStockItem.update({
          quantity: totalStockItem.quantity + newItem.quantity,
          lastUpdated: new Date()
        });
      } else {
        console.warn(`Warning: ${newItem.metalType} Stock (Total) not found for updating after new item creation.`);
      }
    }

    res.redirect(`/inventory/${newItem.id}`)
  } catch (err) {
    console.error(err)
    res.status(400).send('Error creating inventory item: ' + err.message)
  }
})

// GET single inventory item
router.get('/:id', async (req, res) => {
  try {
    const item = await models.Inventory.findByPk(req.params.id)
    if (!item) return res.status(404).send('Item not found')

    res.render('production/inventory/view', {
      title: item.productName,
      item,
      stockStatus: item.quantity <= item.reorderLevel ? 'Low Stock' : 'OK'
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error fetching item')
  }
})

// GET form to edit inventory
router.get('/:id/edit', async (req, res) => {
  try {
    const [item, categories, merchants] = await Promise.all([
      models.Inventory.findByPk(req.params.id),
      models.Inventory.findAll({
        attributes: ['category'],
        group: ['category'],
        where: { category: { [Op.not]: null } },
        raw: true
      }),
      models.BullionMerchant.findAll({ order: [['name', 'ASC']] })
    ]);

    if (!item) return res.status(404).send('Item not found')

    const categoryList = categories.map(c => c.category).filter(Boolean)

    res.render('production/inventory/form', {
      title: 'Edit Inventory Item',
      isEdit: true,
      item,
      categories: categoryList,
      merchants: merchants
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error loading form')
  }
})

// PUT - Update inventory
router.post('/:id/edit', async (req, res) => {
  try {
    const item = await models.Inventory.findByPk(req.params.id)
    if (!item) return res.status(404).send('Item not found')

    const oldQuantity = item.quantity;
    const oldMetalType = item.metalType;

    const { productName, productCode, category, metalType, quantity, costPrice, sellingPrice, reorderLevel, supplier, location, description, paymentType } = req.body
    const newQuantity = parseFloat(quantity) || 0;

    await item.update({
      productName,
      productCode: productCode || null,
      category: category || null,
      metalType: metalType || 'GOLD',
      quantity: newQuantity,
      costPrice: parseFloat(costPrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      reorderLevel: parseFloat(reorderLevel) || 10,
      supplier: supplier || null,
      location: location || null,
      description: description || null,
      paymentType: paymentType || 'CASH',
      lastUpdated: new Date()
    })

    // Adjust total gold/silver stock
    if (oldMetalType !== item.metalType) {
      // Metal type changed, subtract from old and add to new
      const oldTotalStockItem = await models.Inventory.findOne({
        where: { productName: `${oldMetalType} Stock (Total)`, metalType: oldMetalType }
      });
      if (oldTotalStockItem) {
        await oldTotalStockItem.update({
          quantity: oldTotalStockItem.quantity - oldQuantity,
          lastUpdated: new Date()
        });
      } else {
        console.warn(`Warning: ${oldMetalType} Stock (Total) not found for decrement.`);
      }

      const newTotalStockItem = await models.Inventory.findOne({
        where: { productName: `${item.metalType} Stock (Total)`, metalType: item.metalType }
      });
      if (newTotalStockItem) {
        await newTotalStockItem.update({
          quantity: newTotalStockItem.quantity + newQuantity,
          lastUpdated: new Date()
        });
      } else {
        console.warn(`Warning: ${item.metalType} Stock (Total) not found for increment.`);
      }

    } else if (newQuantity !== oldQuantity) {
      // Quantity changed, metal type is same
      const quantityChange = newQuantity - oldQuantity;
      const totalStockItem = await models.Inventory.findOne({
        where: { productName: `${item.metalType} Stock (Total)`, metalType: item.metalType }
      });
      if (totalStockItem) {
        await totalStockItem.update({
          quantity: totalStockItem.quantity + quantityChange,
          lastUpdated: new Date()
        });
      } else {
        console.warn(`Warning: ${item.metalType} Stock (Total) not found for quantity adjustment.`);
      }
    }

    res.redirect(`/inventory/${item.id}`)
  } catch (err) {
    console.error(err)
    res.status(400).send('Error updating item: ' + err.message)
  }
})

// DELETE - Delete inventory
router.post('/:id/delete', async (req, res) => {
  try {
    const item = await models.Inventory.findByPk(req.params.id)
    if (!item) return res.status(404).send('Item not found')

    // Adjust total gold/silver stock before deleting the item
    if (item.metalType === 'GOLD' || item.metalType === 'SILVER') {
      const totalStockItem = await models.Inventory.findOne({
        where: { productName: `${item.metalType} Stock (Total)`, metalType: item.metalType }
      });

      if (totalStockItem) {
        await totalStockItem.update({
          quantity: totalStockItem.quantity - item.quantity,
          lastUpdated: new Date()
        });
      } else {
        console.warn(`Warning: ${item.metalType} Stock (Total) not found for decrement before item deletion.`);
      }
    }

    await item.destroy()
    res.redirect('/inventory')
  } catch (err) {
    console.error(err)
    res.status(500).send('Error deleting item')
  }
})

// API: Update quantity (for stock in/out)
router.post('/:id/adjust-quantity', async (req, res) => {
  try {
    const { quantityChange, reason } = req.body
    const item = await models.Inventory.findByPk(req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })

    const newQuantity = item.quantity + parseFloat(quantityChange)
    if (newQuantity < 0) {
      return res.status(400).json({ error: 'Insufficient stock' })
    }

    await item.update({
      quantity: newQuantity,
      lastUpdated: new Date()
    })

    res.json({
      success: true,
      message: `Quantity updated by ${quantityChange} (${reason || 'Manual adjustment'})`,
      newQuantity,
      item
    })
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err.message })
  }
})

// API: Get low stock items
router.get('/api/low-stock', async (req, res) => {
  try {
    const allItems = await models.Inventory.findAll({
      order: [['quantity', 'ASC']],
      raw: false
    })
    
    const lowStockItems = allItems.filter(item => item.quantity <= item.reorderLevel)

    res.json(lowStockItems)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// API: Get inventory stats
router.get('/api/stats', async (req, res) => {
  try {
    const totalItems = await models.Inventory.count()
    const totalQuantity = await models.Inventory.sum('quantity') || 0
    
    // Fetch all items for calculations
    const allItems = await models.Inventory.findAll({ raw: false })
    
    // Calculate total value in JavaScript
    const totalValue = allItems.reduce((sum, item) => sum + (item.quantity * item.sellingPrice), 0) || 0
    
    // Filter for low stock count
    const lowStockCount = allItems.filter(item => item.quantity <= item.reorderLevel).length

    res.json({
      totalItems,
      totalQuantity,
      totalValue,
      lowStockCount
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// API: Get all inventory items (for AJAX requests)
router.get('/api/all', async (req, res) => {
  try {
    const { category, search, lowStock } = req.query
    const where = {}

    if (category) where.category = category
    if (search) {
      where[Op.or] = [
        { productName: { [Op.like]: `%${search}%` } },
        { productCode: { [Op.like]: `%${search}%` } }
      ]
    }

    let inventory = await models.Inventory.findAll({
      where,
      order: [['productName', 'ASC']],
      raw: false
    })
    
    // Filter low stock in JavaScript if needed
    if (lowStock === 'true') {
      inventory = inventory.filter(item => item.quantity <= item.reorderLevel)
    }

    res.json(inventory)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

export default router
