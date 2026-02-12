import express from "express";
import { Op } from "sequelize";
import { models } from "../setup/database.js";

const router = express.Router();

// GET list of merchants
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { personName: { [Op.like]: `%${search}%` } },
        { mobile: { [Op.like]: `%${search}%` } },
      ];
    }

    const merchants = await models.BullionMerchant.findAll({
      where,
      order: [["name", "ASC"]],
    });

    res.render("production/bullion_merchants/list", {
      title: "Bullion Merchants",
      merchants,
      search,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching merchants");
  }
});

// GET form to add new merchant
router.get("/add", (req, res) => {
  res.render("production/bullion_merchants/form", {
    title: "Add Bullion Merchant",
    merchant: {},
    isEdit: false,
  });
});

// POST create new merchant
router.post("/", async (req, res) => {
  try {
    const { name, personName, phone, mobile, gstNumber, address } = req.body;

    await models.BullionMerchant.create({
      name,
      personName,
      phone,
      mobile,
      gstNumber,
      address,
    });

    res.redirect("/bullion-merchants");
  } catch (err) {
    console.error(err);
    res.status(400).render("production/bullion_merchants/form", {
      title: "Add Bullion Merchant",
      merchant: req.body,
      isEdit: false,
      error: err.message,
    });
  }
});

// GET form to edit merchant
router.get("/:id/edit", async (req, res) => {
  try {
    const merchant = await models.BullionMerchant.findByPk(req.params.id);
    if (!merchant) return res.status(404).send("Merchant not found");

    res.render("production/bullion_merchants/form", {
      title: "Edit Bullion Merchant",
      merchant,
      isEdit: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading form");
  }
});

// POST update merchant
router.post("/:id/edit", async (req, res) => {
  try {
    const merchant = await models.BullionMerchant.findByPk(req.params.id);
    if (!merchant) return res.status(404).send("Merchant not found");

    const { name, personName, phone, mobile, gstNumber, address } = req.body;

    await merchant.update({
      name,
      personName,
      phone,
      mobile,
      gstNumber,
      address,
    });

    res.redirect("/bullion-merchants");
  } catch (err) {
    console.error(err);
    res.status(400).render("production/bullion_merchants/form", {
      title: "Edit Bullion Merchant",
      merchant: { ...req.body, id: req.params.id },
      isEdit: true,
      error: err.message,
    });
  }
});

// POST delete merchant
router.post("/:id/delete", async (req, res) => {
  try {
    const merchant = await models.BullionMerchant.findByPk(req.params.id);
    if (merchant) {
      await merchant.destroy();
    }
    res.redirect("/bullion-merchants");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting merchant");
  }
});

export default router;
