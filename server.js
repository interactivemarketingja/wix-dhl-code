// server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("DHL API Backend is running!");
});

// /rates route
app.post("/rates", async (req, res) => {
  try {
    const { origin, destination, weight } = req.body;

    // Validate required fields
    if (!origin || !destination || !weight) {
      return res.status(400).json({ error: "origin, destination, and weight are required" });
    }

    if (weight <= 0) {
      return res.status(400).json({ error: "weight must be a positive number" });
    }

    // Block shipping to Jamaica
    if (destination.countryCode.toUpperCase() === "JM") {
      return res.status(400).json({ error: "Shipping to Jamaica is not allowed" });
    }

    // Provide safe defaults for postalCode and cityName
    const shipperPostal = origin.postalCode || "10001";
    const shipperCity = origin.cityName || "New York";
    const receiverPostal = destination.postalCode || "M5V";
    const receiverCity = destination.cityName || "Toronto";

    // Build DHL payload
    const dhlPayload = {
      plannedShippingDateAndTime: new Date().toISOString(),
      unitOfMeasurement: "metric",
      customerDetails: {
        shipperDetails: {
          postalCode: shipperPostal,
          cityName: shipperCity,
          countryCode: origin.countryCode
        },
        receiverDetails: {
          postalCode: receiverPostal,
          cityName: receiverCity,
          countryCode: destination.countryCode
        }
      },
      packages: [
        {
          weight,
          dimensions: { length: 10, width: 10, height: 10 }
        }
      ],
      accounts: [
        {
          typeCode: "shipper",
          number: process.env.DHL_ACCOUNT_NUMBER || ""
        }
      ]
    };

    // Call DHL API safely
    const response = await fetch("https://api-mydhl.dhl.com/mydhlapi/rates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DHL-API-Key": process.env.DHL_API_KEY
      },
      body: JSON.stringify(dhlPayload)
    });

    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      console.error("Error parsing DHL response:", jsonErr);
      return res.status(500).json({ error: "Failed to parse DHL response" });
    }

    console.log("DHL RESPONSE:", JSON.stringify(data, null, 2));

    if (!data.products || data.products.length === 0) {
      return res.status(400).json({ error: "No DHL rates available for this destination." });
    }

    // Return DHL products
    res.json(data);

  } catch (err) {
    console.error("Backend error:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
