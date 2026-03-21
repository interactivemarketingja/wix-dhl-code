// server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Validate DHL API key
if (!process.env.DHL_API_KEY) {
  console.error("DHL_API_KEY is missing! Set it in Render environment variables.");
  process.exit(1);
}

// Simple in-memory cache (5 minutes)
const cache = new Map();
const CACHE_TIME = 5 * 60 * 1000;

// Health check
app.get("/", (req, res) => {
  res.send("DHL API Backend is running!");
});

// Rates endpoint
app.post("/rates", async (req, res) => {
  try {
    const { origin, destination, weight } = req.body;

    // Input validation
    if (!origin?.countryCode || !destination?.countryCode || !weight || weight <= 0) {
      return res.status(400).json({ error: "Invalid input: origin, destination, and positive weight required." });
    }

    const destCountry = destination.countryCode.toUpperCase();

    // Block Jamaica
    if (destCountry === "JM") {
      return res.status(400).json({ error: "Shipping to Jamaica is not allowed." });
    }

    // Cache key: origin + destination + weight
    const cacheKey = `${origin.countryCode}-${destCountry}-${weight}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.time < CACHE_TIME) {
        return res.json(cached.data);
      }
    }

    // DHL API request
    const dhlResponse = await fetch("https://wix-dhl-code.onrender.com/rates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DHL-API-Key": process.env.DHL_API_KEY
      },
      body: JSON.stringify({
        plannedShippingDateAndTime: new Date().toISOString(),
        unitOfMeasurement: "metric",
        origin: { countryCode: origin.countryCode },
        destination: { countryCode: destCountry },
        packages: [{ weight }]
      })
    });

    const data = await dhlResponse.json();

    // Check DHL response
    if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
      return res.status(400).json({ error: "No DHL rates available for this destination." });
    }

    // Map multiple DHL options
    const options = data.products.map(p => {
      const price = Number((p.totalPrice[0].price * 1.1).toFixed(2)); // +10% markup
      return {
        courier: p.productName,
        price,
        currency: p.totalPrice[0].currency || "USD",
        deliveryTime: "2–4 days" // optional: adjust if DHL provides exact delivery time
      };
    });

    // Save to cache
    cache.set(cacheKey, { data: { options }, time: Date.now() });

    // Return clean JSON
    res.json({ options });

  } catch (err) {
    console.error("DHL ERROR:", err);
    res.status(500).json({ error: "Failed to fetch DHL rates." });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DHL Backend running on port ${PORT}`));
