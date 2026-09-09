const Farmer = require("../models/Farmer");

/**
 * Generates a unique, collision-safe Farmer Registration ID
 * Format: FMR-AP-2026-XXXXXX (e.g. FMR-AP-2026-000001)
 */
async function generateRegistrationNumber(state = "AP", year = 2026) {
  const prefix = `FMR-${state}-${year}-`;

  try {
    // Find highest existing registration number for current prefix
    const latestFarmer = await Farmer.findOne({
      registrationNumber: new RegExp(`^${prefix}`)
    })
      .sort({ createdAt: -1 })
      .select("registrationNumber")
      .lean();

    let nextSequence = 1;

    if (latestFarmer && latestFarmer.registrationNumber) {
      const parts = latestFarmer.registrationNumber.split("-");
      const lastSeqStr = parts[parts.length - 1];
      const parsedSeq = parseInt(lastSeqStr, 10);
      if (!isNaN(parsedSeq)) {
        nextSequence = parsedSeq + 1;
      }
    }

    let regNumber = `${prefix}${String(nextSequence).padStart(6, "0")}`;

    // Verify uniqueness (collision safety loop)
    let exists = await Farmer.exists({ registrationNumber: regNumber });
    while (exists) {
      nextSequence++;
      regNumber = `${prefix}${String(nextSequence).padStart(6, "0")}`;
      exists = await Farmer.exists({ registrationNumber: regNumber });
    }

    return regNumber;
  } catch (error) {
    // Fallback timestamp-based generator in case of query failure
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${randomSuffix}`;
  }
}

module.exports = {
  generateRegistrationNumber
};
