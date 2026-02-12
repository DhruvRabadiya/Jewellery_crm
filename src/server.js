import path from "path";
import express from "express";
import { fileURLToPath } from "url";
import { initDb } from "./setup/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
// serve public folder for static assets
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// static
app.use("/static", express.static(path.join(__dirname, "public")));

// routes
// app.get('/', (req, res) => res.redirect('/dashboard'))

app.get("/", async (req, res) => {
  res.render("index", { title: "Jwellery CRM" });
});

app.get("/production", async (req, res) => {
  res.render("production/index", { title: "Jwellery CRM" });
});

app.get("/pos", async (req, res) => {
  res.render("pos/index", { title: "Jwellery CRM" });
});

import employeeRoutes from "./routes/employees.js";
app.use("/employees", employeeRoutes);

import jobsheetRoutes from "./routes/jobsheets.js";
app.use("/jobsheets", jobsheetRoutes);

import inventoryRoutes from "./routes/inventory.js";
app.use("/inventory", inventoryRoutes);

import productRoutes from "./routes/products.js";
app.use("/products", productRoutes);

import bullionMerchantRoutes from "./routes/bullionMerchants.js";
app.use("/bullion-merchants", bullionMerchantRoutes);

// export a start function so callers (Electron main) can wait until server is ready
export async function startServer(port = PORT) {
  try {
    await initDb();
    return new Promise((resolve, reject) => {
      const server = app.listen(port, () => {
        console.log(`Express server listening on http://localhost:${port}`);
        resolve(server);
      });
      server.on("error", (err) => reject(err));
    });
  } catch (err) {
    console.error("Failed to init DB", err);
    throw err;
  }
}

startServer();

export default app;
