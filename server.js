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

    // Block shipping to Jamaica
    if (destination.countryCode.toUpperCase() === "JM") {
      return res.status(400).json({ error: "Shipping to Jamaica is not allowed" });
    }

    // Validate weight
    if (!weight || weight <= 0) {
      return res.status(400).json({ error: "Weight must be a positive number" });
    }

    // Full DHL payload
    const dhlPayload = {
      plannedShippingDateAndTime: new Date().toISOString(),
      unitOfMeasurement: "metric",
      customerDetails: {
        shipperDetails: {
          postalCode: origin.postalCode || "10001",
          cityName: origin.cityName || "New York",
          countryCode: origin.countryCode
        },
        receiverDetails: {
          postalCode: destination.postalCode || "M5V",
          cityName: destination.cityName || "Toronto",
          countryCode: destination.countryCode
        }
      },
      packages: [
        {
          weight,
          dimensions: {
            length: 10,
            width: 10,
            height: 10
          }
        }
      ],
      accounts: [
        {
          typeCode: "shipper",
          number: process.env.DHL_ACCOUNT_NUMBER || "" // optional
        }
      ]
    };

    // Call DHL API
    const response = await fetch("https://api-mydhl.dhl.com/mydhlapi/rates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DHL-API-Key": process.env.DHL_API_KEY
      },
      body: JSON.stringify(dhlPayload)
    });

    const data = await response.json();
    console.log("DHL RESPONSE:", JSON.stringify(data, null, 2));

    if (!data.products || data.products.length === 0) {
      return res.status(400).json({ error: "No DHL rates available for this destination." });
    }

    // Return products to frontend
    res.json(data);

  } catch (err) {
    console.error("Backend error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
