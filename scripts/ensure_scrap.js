import { models, sequelize } from "../src/setup/database.js";

async function ensureScrapItems() {
  try {
    const metals = ["Gold", "Silver"];

    for (const metal of metals) {
      const productName = `Scrap ${metal}`;
      let item = await models.Inventory.findOne({ where: { productName } });

      if (!item) {
        await models.Inventory.create({
          productName,
          category: metal,
          quantity: 0,
          unit: "gram",
          supplier: "Scrap Return", // Helpful to distinguish
          costPrice: 0,
          sellingPrice: 0,
          paymentType: "Internal",
          description: "Scrap generated from production processes",
        });
        console.log(`Created: ${productName}`);
      } else {
        console.log(`Exists: ${productName}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // We don't close sequelize here as it might hang depending on connection pool,
    // but usually script ends.
    process.exit();
  }
}

ensureScrapItems();
