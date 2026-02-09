import { Sequelize, DataTypes } from 'sequelize'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// determine a safe location for the SQLite file
// When running inside Electron (packaged), writing into the ASAR will fail.
// Prefer Electron's userData path when available; otherwise use the repo `data/` folder for dev.
let storagePath
const defaultDevDataDir = path.join(__dirname, '..', '..', 'data')
if (process && process.versions && process.versions.electron) {
  try {
    const { app } = await import('electron')
    const userData = app && typeof app.getPath === 'function' ? app.getPath('userData') : null
    storagePath = userData ? path.join(userData, 'crm.sqlite') : path.join(defaultDevDataDir, 'crm.sqlite')
  } catch (e) {
    storagePath = path.join(defaultDevDataDir, 'crm.sqlite')
  }
} else {
  storagePath = path.join(defaultDevDataDir, 'crm.sqlite')
}

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: storagePath,
  logging: false
})

const Customer = sequelize.define('Customer', {
  name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING },
  address: { type: DataTypes.TEXT }
})

const Item = sequelize.define('Item', {
  name: { type: DataTypes.STRING, allowNull: false },
  code: { type: DataTypes.STRING },
  goldWeight: { type: DataTypes.FLOAT, defaultValue: 0 }
})

const Purchase = sequelize.define('Purchase', {
  amount: { type: DataTypes.FLOAT, allowNull: false },
  description: { type: DataTypes.TEXT }
})

const Sale = sequelize.define('Sale', {
  amount: { type: DataTypes.FLOAT, allowNull: false },
  description: { type: DataTypes.TEXT }
})

const Employee = sequelize.define('Employee', {
  name: { type: DataTypes.STRING, allowNull: false },
  rate: { type: DataTypes.FLOAT, defaultValue: 0 }
})

const Material = sequelize.define('Material', {
  name: { type: DataTypes.STRING, allowNull: false },
  cost: { type: DataTypes.FLOAT, defaultValue: 0 }
})

const JobSheet = sequelize.define('JobSheet', {
  jobNo: { type: DataTypes.STRING, allowNull: false, unique: true },
  metalType: { type: DataTypes.ENUM('GOLD', 'SILVER'), defaultValue: 'GOLD' }, // ચાંદી / સોનુ
  purity: { type: DataTypes.ENUM('22K', '24K'), defaultValue: '22K' }, // કેરેટ
  issueWeight: { type: DataTypes.FLOAT, allowNull: false },
  returnWeight: { type: DataTypes.FLOAT, defaultValue: 0 },
  scrapWeight: { type: DataTypes.FLOAT, defaultValue: 0 }, // સ્ક્રેપ
  dustWeight: { type: DataTypes.FLOAT, defaultValue: 0 }, // ધૂળ / લોસ
  size: { type: DataTypes.STRING },
  pieces: { type: DataTypes.INTEGER, defaultValue: 0 },
  returnPieces: { type: DataTypes.INTEGER, defaultValue: 0 }, // રીટર્ન પીસ
  workType: { type: DataTypes.STRING }, // kept for backward compatibility
  currentStep: { type: DataTypes.ENUM('melting', 'rolling', 'press', 'TPP', 'packing', 'completed'), defaultValue: 'melting' },
  status: { type: DataTypes.ENUM('Issued', 'In-Progress', 'Completed', 'Pending'), defaultValue: 'Issued' },
  loss: { type: DataTypes.FLOAT, defaultValue: 0 }, // Calculated: issueWeight - (returnWeight + scrapWeight + dustWeight)
  totalLoss: { type: DataTypes.FLOAT, defaultValue: 0 }, // Total loss across all steps
  issueDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  completedDate: { type: DataTypes.DATE }
})

const JobSheetStep = sequelize.define('JobSheetStep', {
  stepName: { type: DataTypes.ENUM('melting', 'rolling', 'press', 'TPP', 'packing'), allowNull: false },
  stepOrder: { type: DataTypes.INTEGER, allowNull: false }, // 1-5
  status: { type: DataTypes.ENUM('pending', 'in-progress', 'completed'), defaultValue: 'pending' },
  issueWeight: { type: DataTypes.FLOAT, defaultValue: 0 },
  returnWeight: { type: DataTypes.FLOAT, defaultValue: 0 },
  scrapWeight: { type: DataTypes.FLOAT, defaultValue: 0 },
  dustWeight: { type: DataTypes.FLOAT, defaultValue: 0 },
  loss: { type: DataTypes.FLOAT, defaultValue: 0 },
  pieces: { type: DataTypes.INTEGER, defaultValue: 0 }, // For TPP and packing
  returnPieces: { type: DataTypes.INTEGER, defaultValue: 0 },
  startDate: { type: DataTypes.DATE },
  completedDate: { type: DataTypes.DATE },
  notes: { type: DataTypes.TEXT }
})

const AuditLog = sequelize.define('AuditLog', {
  jobSheetId: { type: DataTypes.INTEGER, allowNull: false },
  action: { type: DataTypes.STRING }, // "created", "updated", "returned"
  changedFields: { type: DataTypes.JSON },
  changedBy: { type: DataTypes.STRING },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
})

const Inventory = sequelize.define('Inventory', {
  productName: { type: DataTypes.STRING, allowNull: false },
  productCode: { type: DataTypes.STRING, unique: true },
  category: { type: DataTypes.STRING }, // e.g., "Gold", "Silver", "Diamonds", "Stones"
  quantity: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  unit: { type: DataTypes.STRING, defaultValue: 'gm' }, // gm, pieces, carat, etc.
  costPrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  sellingPrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  reorderLevel: { type: DataTypes.FLOAT, defaultValue: 10 }, // minimum quantity to reorder
  supplier: { type: DataTypes.STRING },
  location: { type: DataTypes.STRING }, // warehouse location
  description: { type: DataTypes.TEXT },
  lastUpdated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
})

const Product = sequelize.define('Product', {
  name: { type: DataTypes.STRING, allowNull: false },
  sku: { type: DataTypes.STRING, unique: true, allowNull: false },
  description: { type: DataTypes.TEXT },
  category: { type: DataTypes.STRING },
  price: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  cost: { type: DataTypes.FLOAT, defaultValue: 0 },
  stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  image: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
})

// Associations
Customer.hasMany(Purchase)
Purchase.belongsTo(Customer)

Customer.hasMany(Sale)
Sale.belongsTo(Customer)

Item.hasMany(Purchase)
Purchase.belongsTo(Item)

Item.hasMany(Sale)
Sale.belongsTo(Item)

Employee.hasMany(JobSheet)
JobSheet.belongsTo(Employee)

JobSheet.hasMany(JobSheetStep)
JobSheetStep.belongsTo(JobSheet)

Employee.hasMany(JobSheetStep)
JobSheetStep.belongsTo(Employee)

export { sequelize, Sequelize, initDb, models }

async function initDb() {
  // ensure data folder exists
  const dbDir = path.dirname(sequelize.options.storage)
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  await sequelize.authenticate()
  // SQLite can carry legacy tables without a proper unique id; repair before sync/alter
  await sequelize.sync()
  console.log('Database initialized (SQLite)')
}


const models = {
  Customer,
  Item,
  Purchase,
  Sale,
  Employee,
  Material,
  JobSheet,
  JobSheetStep,
  AuditLog,
  Inventory,
  Product
}

