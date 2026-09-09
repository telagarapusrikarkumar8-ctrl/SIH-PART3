require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Official = require("../models/Official");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/procuriment";
const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "DemoAdmin@2026";

const defaultOfficials = [
  {
    employeeId: "EMP-DPO-GNT-101",
    name: "Sri M. Rajasekhar, IAS",
    district: "Guntur",
    role: "District Procurement Officer",
    status: "active"
  },
  {
    employeeId: "EMP-FCI-KRI-204",
    name: "Smt. K. Sunitha, FCI",
    district: "Krishna",
    role: "PPC Centre Manager",
    status: "active"
  },
  {
    employeeId: "EMP-DIR-AP-001",
    name: "Dr. C. Venkateswarlu, IAS",
    district: "Guntur",
    role: "Quality Inspector",
    status: "active"
  }
];

async function seedOfficials() {
  try {
    console.log("Connecting to MongoDB for official account seeding...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB successfully.");

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

    for (const officialData of defaultOfficials) {
      const existing = await Official.findOne({ employeeId: officialData.employeeId });

      if (existing) {
        console.log(`Official [${officialData.employeeId}] already exists. Skipping.`);
      } else {
        await Official.create({
          ...officialData,
          passwordHash
        });
        console.log(`Official [${officialData.employeeId}] (${officialData.role} - ${officialData.district}) seeded successfully.`);
      }
    }

    console.log("\n==============================================");
    console.log("Departmental Official Seeding Complete.");
    console.log(`Default login password: ${SEED_PASSWORD}`);
    console.log("==============================================");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Official Seeding Error:", error);
    process.exit(1);
  }
}

seedOfficials();
