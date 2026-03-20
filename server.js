import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.post("/rates", async (req, res) => {
  try {
    const { origin, destination, weight } = req.body;

    // Block shipments to Jamaica
    if (destination.countryCode.toUpperCase() === "JM") {
      return res.status(400).json({ error: "Shipping to Jamaica is not allowed" });
    }

    const response = await fetch("https://api-mydhl.dhl.com/mydhlapi/rates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DHL-API-Key": process.env.DHL_API_KEY
      },
      body: JSON.stringify({
        plannedShippingDateAndTime: new Date().toISOString(),
        unitOfMeasurement: "metric",
        origin,
        destination,
        packages: [{ weight }]
      })
    });

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Server running"));
