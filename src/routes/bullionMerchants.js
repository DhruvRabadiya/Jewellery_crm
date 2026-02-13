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
    const {
      name,
      personName,
      phone,
      mobile,
      gstNumber,
      address,
      bankName,
      accountHolderName,
      accountNumber,
      ifscCode,
      branchName,
      aadharNumber,
    } = req.body;

    // --- Server-Side Validation ---
    const errors = [];
    if (aadharNumber && !/^\d{12}$/.test(aadharNumber)) {
      errors.push("Aadhar Number must be exactly 12 digits.");
    }
    if (accountNumber && !/^\d{9,18}$/.test(accountNumber)) {
      errors.push("Account Number must be between 9 and 18 digits.");
    }
    if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      errors.push("Invalid IFSC Code format (e.g., SBIN0123456).");
    }
    // GST Validation (Standard Format)
    if (
      gstNumber &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
        gstNumber,
      )
    ) {
      errors.push("Invalid GST Number format.");
    }

    if (errors.length > 0) {
      throw new Error(errors.join(" "));
    }
    // -----------------------------

    await models.BullionMerchant.create({
      name,
      personName,
      phone,
      mobile,
      gstNumber,
      address,
      bankName,
      accountHolderName,
      accountNumber,
      ifscCode,
      branchName,
      aadharNumber,
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

    const {
      name,
      personName,
      phone,
      mobile,
      gstNumber,
      address,
      bankName,
      accountHolderName,
      accountNumber,
      ifscCode,
      branchName,
      aadharNumber,
    } = req.body;

    // --- Server-Side Validation ---
    const errors = [];
    if (aadharNumber && !/^\d{12}$/.test(aadharNumber)) {
      errors.push("Aadhar Number must be exactly 12 digits.");
    }
    if (accountNumber && !/^\d{9,18}$/.test(accountNumber)) {
      errors.push("Account Number must be between 9 and 18 digits.");
    }
    if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      errors.push("Invalid IFSC Code format (e.g., SBIN0123456).");
    }
    if (
      gstNumber &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
        gstNumber,
      )
    ) {
      errors.push("Invalid GST Number format.");
    }

    if (errors.length > 0) {
      // Re-render form with errors
      return res.status(400).render("production/bullion_merchants/form", {
        title: "Edit Bullion Merchant",
        merchant: { ...req.body, id: req.params.id }, // Merge ID back
        isEdit: true,
        error: errors.join(" "),
      });
    }
    // -----------------------------

    await merchant.update({
      name,
      personName,
      phone,
      mobile,
      gstNumber,
      address,
      bankName,
      accountHolderName,
      accountNumber,
      ifscCode,
      branchName,
      aadharNumber,
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

// GET single merchant details
router.get("/:id", async (req, res) => {
  try {
    const merchant = await models.BullionMerchant.findByPk(req.params.id);
    if (!merchant) {
      return res.status(404).send("Merchant not found");
    }
    res.render("production/bullion_merchants/view", {
      title: merchant.name,
      merchant,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching merchant details");
  }
});

export default router;
