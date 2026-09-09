const express = require("express");
const Farmer = require("../models/Farmer");
const Official = require("../models/Official");
const { authenticateToken } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

/**
 * GET /api/admin/farmers
 * Protected: Official-only access to view registered farmers list
 */
router.get("/farmers", authenticateToken, requireRole("official"), async (req, res) => {
  try {
    const { district, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (district && district !== "All") {
      query.district = district;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { registrationNumber: searchRegex },
        { fullName: searchRegex },
        { mobileNumber: searchRegex },
        { village: searchRegex }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Farmer.countDocuments(query);
    const farmers = await Farmer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    return res.status(200).json({
      success: true,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      farmers
    });
  } catch (error) {
    console.error("Admin Farmers List Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve registered farmers list."
    });
  }
});

/**
 * GET /api/admin/stats
 * Protected: Official KPI analytics summary
 */
router.get("/stats", authenticateToken, requireRole("official"), async (req, res) => {
  try {
    const totalFarmers = await Farmer.countDocuments();
    const verifiedFarmers = await Farmer.countDocuments({ status: "Verified" });
    const officialsCount = await Official.countDocuments();

    return res.status(200).json({
      success: true,
      stats: {
        totalFarmers,
        verifiedFarmers,
        totalCentres: 16,
        todayScheduled: 142,
        pendingGrievances: 3,
        officialsCount
      }
    });
  } catch (error) {
    console.error("Admin Stats Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve administrative statistics."
    });
  }
});

module.exports = router;
