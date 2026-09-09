const mongoose = require("mongoose");
const http = require("http");
require("dotenv").config({ path: require("path").resolve(__dirname, "./.env") });

const app = require("express")();
// We can test against running server or launch test instance
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const farmerRoutes = require("./routes/farmers");
const adminRoutes = require("./routes/admin");

const testApp = express();
testApp.use(cors());
testApp.use(express.json());
testApp.use("/api/auth", authRoutes);
testApp.use("/api/farmers", farmerRoutes);
testApp.use("/api/admin", adminRoutes);

async function runTests() {
  const PORT = 5555;
  const server = testApp.listen(PORT);

  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/procuriment");
  console.log("Connected to MongoDB for integration tests.\n");

  function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const options = {
        hostname: "127.0.0.1",
        port: PORT,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    console.log("=== TEST GROUP 1: FARMER REGISTRATION ===");
    const testAadhaar = "889977665544";
    const testMobile = "9123456780";

    // Clean any prior test farmer
    const Farmer = require("./models/Farmer");
    const { hashAadhaar } = require("./utils/hash");
    await Farmer.deleteMany({
      $or: [{ aadhaarHash: hashAadhaar(testAadhaar) }, { mobileNumber: testMobile }]
    });

    // 1. Valid Registration
    const regRes = await request("POST", "/api/farmers/register", {
      fullName: "Srikar Farmer Test",
      guardianName: "K. Test Rao",
      aadhaar: testAadhaar,
      mobileNumber: testMobile,
      gender: "Male",
      age: 42,
      district: "Guntur",
      mandal: "Tenali",
      village: "Angalakuduru",
      pincode: "522201"
    });

    assert(regRes.status === 201, `Status is 201 Created (got ${regRes.status})`);
    assert(regRes.body.success === true, "Response success is true");
    assert(regRes.body.registrationNumber?.startsWith("FMR-AP-2026-"), `Registration number format is valid: ${regRes.body.registrationNumber}`);
    assert(!!regRes.body.token, "JWT token returned on registration");
    const farmerToken = regRes.body.token;
    const farmerRegNumber = regRes.body.registrationNumber;

    // 2. Duplicate Aadhaar Registration
    const dupAadhaarRes = await request("POST", "/api/farmers/register", {
      fullName: "Duplicate Aadhaar User",
      aadhaar: testAadhaar,
      mobileNumber: "9988776655",
      age: 30
    });
    assert(dupAadhaarRes.status === 409, `Duplicate Aadhaar rejected with 409 (got ${dupAadhaarRes.status})`);

    // 3. Duplicate Mobile Registration
    const dupMobileRes = await request("POST", "/api/farmers/register", {
      fullName: "Duplicate Mobile User",
      aadhaar: "112233445566",
      mobileNumber: testMobile,
      age: 30
    });
    assert(dupMobileRes.status === 409, `Duplicate Mobile rejected with 409 (got ${dupMobileRes.status})`);

    // 4. Invalid Aadhaar (not 12 digits)
    const invalidAadhaarRes = await request("POST", "/api/farmers/register", {
      fullName: "Invalid Aadhaar User",
      aadhaar: "1234",
      mobileNumber: "9876501234",
      age: 30
    });
    assert(invalidAadhaarRes.status === 400, `Invalid Aadhaar rejected with 400 (got ${invalidAadhaarRes.status})`);

    console.log("\n=== TEST GROUP 2: FARMER OTP LOGIN ===");
    // 1. Request OTP via Registration Number
    const otpReq1 = await request("POST", "/api/auth/farmer/request-otp", {
      method: "registration",
      identifier: farmerRegNumber
    });
    assert(otpReq1.status === 200, `OTP requested with reg number -> 200 (got ${otpReq1.status})`);
    assert(otpReq1.body.success === true, "OTP request success is true");

    // 2. Request OTP via Mobile Number
    const otpReq2 = await request("POST", "/api/auth/farmer/request-otp", {
      method: "mobile",
      identifier: testMobile
    });
    assert(otpReq2.status === 200, `OTP requested with mobile -> 200 (got ${otpReq2.status})`);

    // 3. Request OTP via Aadhaar
    const otpReq3 = await request("POST", "/api/auth/farmer/request-otp", {
      method: "aadhaar",
      identifier: testAadhaar
    });
    assert(otpReq3.status === 200, `OTP requested with Aadhaar -> 200 (got ${otpReq3.status})`);

    // 4. Verify OTP with Wrong Code
    const wrongOtpRes = await request("POST", "/api/auth/farmer/verify-otp", {
      farmerId: otpReq3.body.farmerId,
      otp: "999999"
    });
    assert(wrongOtpRes.status === 400, `Wrong OTP rejected with 400 (got ${wrongOtpRes.status})`);

    // 5. Verify OTP with Correct Code (123456)
    const verifyOtpRes = await request("POST", "/api/auth/farmer/verify-otp", {
      farmerId: otpReq3.body.farmerId,
      otp: "123456"
    });
    assert(verifyOtpRes.status === 200, `Correct OTP verified -> 200 (got ${verifyOtpRes.status})`);
    assert(verifyOtpRes.body.user?.role === "Farmer", "Verified user role is Farmer");
    assert(!!verifyOtpRes.body.token, "Farmer JWT token generated");

    console.log("\n=== TEST GROUP 3: OFFICIAL / ADMIN LOGIN ===");
    // 1. Valid Official Login
    const officialLoginRes = await request("POST", "/api/auth/official/login", {
      employeeId: "EMP-DPO-GNT-101",
      district: "Guntur",
      role: "District Procurement Officer",
      password: process.env.SEED_ADMIN_PASSWORD || "DemoAdmin@2026"
    });
    assert(officialLoginRes.status === 200, `Official login -> 200 (got ${officialLoginRes.status})`);
    assert(officialLoginRes.body.user?.role === "Admin", "Official user role is Admin");
    assert(!!officialLoginRes.body.token, "Official JWT token generated");
    const officialToken = officialLoginRes.body.token;

    // 2. Wrong Password
    const wrongPassRes = await request("POST", "/api/auth/official/login", {
      employeeId: "EMP-DPO-GNT-101",
      district: "Guntur",
      role: "District Procurement Officer",
      password: "WrongPassword"
    });
    assert(wrongPassRes.status === 401, `Wrong password rejected -> 401 (got ${wrongPassRes.status})`);

    // 3. Wrong District
    const wrongDistRes = await request("POST", "/api/auth/official/login", {
      employeeId: "EMP-DPO-GNT-101",
      district: "Visakhapatnam",
      role: "District Procurement Officer",
      password: process.env.SEED_ADMIN_PASSWORD || "DemoAdmin@2026"
    });
    assert(wrongDistRes.status === 401, `Wrong district rejected -> 401 (got ${wrongDistRes.status})`);

    console.log("\n=== TEST GROUP 4: JWT AUTHENTICATION & ROLE AUTHORIZATION ===");
    // 1. Accessing Farmer Me with Farmer Token
    const farmerMeRes = await request("GET", "/api/farmers/me", null, farmerToken);
    assert(farmerMeRes.status === 200, `Farmer accesses /api/farmers/me -> 200 (got ${farmerMeRes.status})`);
    assert(farmerMeRes.body.farmer?.registrationNumber === farmerRegNumber, "Profile registration number matches");

    // 2. Farmer trying to access Official-only endpoint (/api/admin/farmers) -> 403
    const forbiddenRes = await request("GET", "/api/admin/farmers", null, farmerToken);
    assert(forbiddenRes.status === 403, `Farmer accessing /api/admin/farmers is Forbidden -> 403 (got ${forbiddenRes.status})`);

    // 3. Official accessing /api/admin/farmers -> 200
    const adminFarmersRes = await request("GET", "/api/admin/farmers", null, officialToken);
    assert(adminFarmersRes.status === 200, `Official accessing /api/admin/farmers -> 200 (got ${adminFarmersRes.status})`);
    assert(adminFarmersRes.body.farmers?.length > 0, `Farmers list returned (${adminFarmersRes.body.farmers?.length} records)`);

    // 4. Missing Token -> 401
    const noTokenRes = await request("GET", "/api/farmers/me");
    assert(noTokenRes.status === 401, `No token rejected with 401 (got ${noTokenRes.status})`);

    console.log("\n==============================================");
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==============================================");
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
