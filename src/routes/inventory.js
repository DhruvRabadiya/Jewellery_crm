import express from "express";
import { Op, Sequelize } from "sequelize";
import { models, sequelize } from "../setup/database.js";

const router = express.Router();

// GET all inventory with filters
router.get("/", async (req, res) => {
  try {
    const { search, lowStock } = req.query;
    const where = {};

    // Filters adapted for new logic
    if (search) {
      where[Op.or] = [
        { productName: { [Op.like]: `%${search}%` } },
        { supplier: { [Op.like]: `%${search}%` } },
      ];
    }

    let inventory = await models.Inventory.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });

    // Filter low stock (Optional, user said remove reorder level but we can keep logic hidden or remove filter)
    // Keeping logic safe for now but maybe hiding from UI if not needed.
    if (lowStock === "true") {
      inventory = inventory.filter(
        (item) => item.quantity <= item.reorderLevel,
      );
    }

    res.render("production/inventory/list", {
      title: "Inventory Management",
      inventory,
      lowStockCount: 0, // Disabled for now or calculated simply
      filters: { search },
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching inventory");
  }
});

// GET dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const allItems = await models.Inventory.findAll({ raw: false });

    let goldStock = 0;
    let silverStock = 0;

    allItems.forEach((item) => {
      let qty = item.quantity;
      if (item.unit === "KG") qty = qty * 1000;

      // Check based on Product Name (Gold/Silver) - loose matching for Scrap
      const pName = item.productName.toLowerCase();
      if (pName.includes("gold")) goldStock += qty;
      if (pName.includes("silver")) silverStock += qty;
    });

    res.render("production/inventory/dashboard", {
      title: "Inventory Dashboard",
      stats: {
        totalProducts: allItems.length,
        totalValue: 0, // Placeholder
        goldStock: goldStock.toFixed(2), // in grams
        silverStock: silverStock.toFixed(2), // in grams
      },
      lowStockItems: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading dashboard");
  }
});

// GET form to add new inventory
router.get("/add", async (req, res) => {
  try {
    const suppliers = await models.BullionMerchant.findAll({
      order: [["name", "ASC"]],
    });

    res.render("production/inventory/form", {
      title: "Add Stock",
      isEdit: false,
      suppliers,
      item: { unit: "KG" }, // Default
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading form");
  }
});

// POST - Create new inventory
router.post("/", async (req, res) => {
  try {
    const {
      productName, // Now "Gold" or "Silver"
      quantity, // Weight
      unit,
      price, // Buying Price -> costPrice
      rate, // Current Price -> sellingPrice
      supplier,
      paymentType,
    } = req.body;

    const newItem = await models.Inventory.create({
      productName,
      productCode: null, // Removed
      category: productName, // Sync category with productName
      quantity: parseFloat(quantity) || 0,
      unit: unit || "gram",
      costPrice: parseFloat(price) || 0,
      sellingPrice: parseFloat(rate) || 0,
      reorderLevel: 0, // Ignored
      supplier: supplier || null,
      paymentType: paymentType || "Cash",
      location: null,
      description: null,
    });

    res.redirect(`/inventory`);
  } catch (err) {
    console.error(err);
    res.status(400).send("Error creating inventory item: " + err.message);
  }
});

// GET single inventory item
router.get("/:id", async (req, res) => {
  try {
    const item = await models.Inventory.findByPk(req.params.id);
    if (!item) return res.status(404).send("Item not found");

    res.render("production/inventory/view", {
      title: item.productName,
      item,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching item");
  }
});

// GET form to edit inventory
router.get("/:id/edit", async (req, res) => {
  try {
    const item = await models.Inventory.findByPk(req.params.id);
    if (!item) return res.status(404).send("Item not found");

    const suppliers = await models.BullionMerchant.findAll({
      order: [["name", "ASC"]],
    });

    res.render("production/inventory/form", {
      title: "Edit Stock",
      isEdit: true,
      item,
      suppliers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading form");
  }
});

// PUT - Update inventory
router.post("/:id/edit", async (req, res) => {
  try {
    const item = await models.Inventory.findByPk(req.params.id);
    if (!item) return res.status(404).send("Item not found");

    const { productName, quantity, unit, price, rate, supplier, paymentType } =
      req.body;

    await item.update({
      productName,
      category: productName,
      quantity: parseFloat(quantity) || 0,
      unit: unit || "gram",
      costPrice: parseFloat(price) || 0,
      sellingPrice: parseFloat(rate) || 0,
      supplier: supplier || null,
      paymentType: paymentType || "Cash",
      lastUpdated: new Date(),
    });

    res.redirect(`/inventory`);
  } catch (err) {
    console.error(err);
    res.status(400).send("Error updating item: " + err.message);
  }
});

// DELETE - Delete inventory
router.post("/:id/delete", async (req, res) => {
  try {
    const item = await models.Inventory.findByPk(req.params.id);
    if (!item) return res.status(404).send("Item not found");

    await item.destroy();
    res.redirect("/inventory");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting item");
  }
});

// API: adjust quantity
router.post("/:id/adjust-quantity", async (req, res) => {
  // Keep existing logic or refactor if needed.
  // For now assuming direct edits via Edit Form is preferred by user
  // as "Stock Adjustment" wasn't explicitly mentioned in latest request.
  try {
    const { quantityChange } = req.body;
    const item = await models.Inventory.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found" });

    const newQuantity = item.quantity + parseFloat(quantityChange);
    await item.update({ quantity: newQuantity, lastUpdated: new Date() });
    res.json({ success: true, newQuantity });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
