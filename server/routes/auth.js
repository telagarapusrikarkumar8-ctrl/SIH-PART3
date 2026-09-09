const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Farmer = require("../models/Farmer");
const Official = require("../models/Official");
const OTP = require("../models/OTP");
const { hashAadhaar, hashOtp, verifyOtpHash } = require("../utils/hash");
const { generateOtp } = require("../utils/otp");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "epaddy_sih_secure_jwt_secret_2026_kms";

/**
 * GET /api/auth/status
 * Health check for Authentication API Service
 */
router.get("/status", (req, res) => {
  res.json({
    success: true,
    authEngine: "Native Secure OTP Engine (SHA-256)",
    status: "Operational"
  });
});

/**
 * POST /api/auth/farmer/request-otp
 * Step 1: Farmer requests OTP using Registration Number, Mobile, or Aadhaar
 */
router.post("/farmer/request-otp", async (req, res) => {
  try {
    const { method, identifier } = req.body;

    if (!method || !identifier) {
      return res.status(400).json({
        success: false,
        message: "Login method and identifier are required."
      });
    }

    const cleanIdentifier = String(identifier).trim();
    let query = {};

    if (method === "registration") {
      query = { registrationNumber: cleanIdentifier.toUpperCase() };
    } else if (method === "mobile") {
      const cleanMobile = cleanIdentifier.replace(/\D/g, "");
      if (cleanMobile.length !== 10) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid 10-digit mobile number."
        });
      }
      query = { mobileNumber: cleanMobile };
    } else if (method === "aadhaar") {
      const cleanAadhaar = cleanIdentifier.replace(/\D/g, "");
      if (cleanAadhaar.length !== 12) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid 12-digit Aadhaar number."
        });
      }
      query = { aadhaarHash: hashAadhaar(cleanAadhaar) };
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid login method. Supported: 'registration', 'mobile', 'aadhaar'."
      });
    }

    // Find farmer
    const farmer = await Farmer.findOne(query);

    if (!farmer) {
      const methodLabel =
        method === "registration"
          ? "Registration Number"
          : method === "mobile"
          ? "Mobile Number"
          : "Aadhaar Number";
      return res.status(404).json({
        success: false,
        message: `No active farmer account found matching this ${methodLabel}. Please check or register as a new farmer.`
      });
    }

    if (farmer.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "Farmer account is blocked. Please contact the District Procurement Office."
      });
    }

    // Generate standard 6-digit OTP
    const otpCode = generateOtp();
    console.log(`[AUTH OTP GENERATED]: Code '${otpCode}' for Farmer ${farmer.registrationNumber} (Mobile: ${farmer.mobileNumber})`);

    const otpHashValue = hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // Invalidate prior unverified OTPs for this farmer
    await OTP.deleteMany({
      farmerId: farmer._id,
      verified: false
    });

    // Store new OTP record with SHA-256 hash
    await OTP.create({
      farmerId: farmer._id,
      identifier: farmer.mobileNumber,
      method,
      userType: "farmer",
      otpHash: otpHashValue,
      expiresAt,
      attempts: 0,
      verified: false
    });

    return res.status(200).json({
      success: true,
      message: "One-Time Password (OTP) generated successfully.",
      farmerId: farmer._id,
      registrationNumber: farmer.registrationNumber,
      maskedMobile: `XXXX-XX-${farmer.mobileNumber.slice(-4)}`,
      devOtp: otpCode
    });
  } catch (error) {
    console.error("Farmer OTP Request Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate OTP. Please try again."
    });
  }
});

/**
 * POST /api/auth/farmer/verify-otp
 * Step 2: Farmer verifies OTP & receives authenticated JWT session
 */
router.post("/farmer/verify-otp", async (req, res) => {
  try {
    const { farmerId, identifier, otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "Please enter the 6-digit verification code (OTP)."
      });
    }

    const cleanOtp = String(otp).trim();
    if (cleanOtp.length !== 6 || isNaN(cleanOtp)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be exactly 6 numeric digits."
      });
    }

    let otpQuery = { verified: false };
    if (farmerId) {
      otpQuery.farmerId = farmerId;
    } else if (identifier) {
      otpQuery.identifier = identifier;
    } else {
      return res.status(400).json({
        success: false,
        message: "Farmer reference is required for OTP verification."
      });
    }

    // Find latest OTP document
    const otpDoc = await OTP.findOne(otpQuery).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "No pending OTP verification request found. Please request a new OTP."
      });
    }

    // Check expiration
    if (new Date() > otpDoc.expiresAt) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({
        success: false,
        message: "Verification code (OTP) has expired. Please request a new OTP."
      });
    }

    // Check attempts limit
    if (otpDoc.attempts >= otpDoc.maxAttempts) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({
        success: false,
        message: "Maximum OTP attempts exceeded. Please request a new OTP."
      });
    }

    // Direct SHA-256 Hashed OTP verification
    const isMatch = verifyOtpHash(cleanOtp, otpDoc.otpHash);

    if (!isMatch) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const attemptsLeft = otpDoc.maxAttempts - otpDoc.attempts;
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP code entered. ${attemptsLeft} attempt(s) remaining.`
      });
    }

    // Mark OTP as verified
    otpDoc.verified = true;
    await otpDoc.save();

    // Fetch Farmer profile
    const farmer = await Farmer.findById(otpDoc.farmerId);

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: "Farmer account record not found."
      });
    }

    // Issue JWT Token containing safe identifiers only
    const token = jwt.sign(
      {
        userId: farmer._id,
        role: "farmer",
        registrationNumber: farmer.registrationNumber
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Farmer identity verified successfully.",
      token,
      user: {
        id: farmer.registrationNumber,
        registrationNumber: farmer.registrationNumber,
        name: farmer.fullName,
        fullName: farmer.fullName,
        mobile: farmer.mobileNumber,
        mobileNumber: farmer.mobileNumber,
        district: farmer.district,
        mandal: farmer.mandal,
        village: farmer.village,
        role: "Farmer",
        userRole: "farmer",
        status: farmer.status
      }
    });
  } catch (error) {
    console.error("Farmer OTP Verification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP. Please try again."
    });
  }
});

/**
 * POST /api/auth/official/login
 * Official / Administrative Login with Employee ID, District, Role, Password
 */
router.post("/official/login", async (req, res) => {
  try {
    const { employeeId, district, role, password } = req.body;

    if (!employeeId || !password) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and Password are required."
      });
    }

    const cleanEmpId = String(employeeId).trim().toUpperCase();

    // Lookup official with passwordHash
    const official = await Official.findOne({ employeeId: cleanEmpId }).select("+passwordHash");

    if (!official) {
      return res.status(401).json({
        success: false,
        message: "Invalid Employee ID or credentials."
      });
    }

    if (official.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Official account is deactivated or blocked. Contact State Admin."
      });
    }

    // Verify district if supplied
    if (district && official.district && district.toLowerCase() !== official.district.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: "Selected jurisdiction district does not match official posting."
      });
    }

    // Verify role if supplied
    if (role && official.role && role.toLowerCase() !== official.role.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: "Selected role does not match designated official authority."
      });
    }

    // Verify Password Hash
    const isPasswordValid = await bcrypt.compare(String(password).trim(), official.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Please verify Employee ID and Password."
      });
    }

    // Update last login timestamp
    official.lastLoginAt = new Date();
    await official.save();

    // Issue Official JWT Token
    const token = jwt.sign(
      {
        userId: official._id,
        role: "official",
        employeeId: official.employeeId,
        officialRole: official.role,
        district: official.district
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(200).json({
      success: true,
      message: "Departmental authority authentication successful.",
      token,
      user: {
        id: official.employeeId,
        employeeId: official.employeeId,
        name: official.name,
        role: "Admin",
        userRole: "official",
        officialRole: official.role,
        district: official.district,
        status: official.status
      }
    });
  } catch (error) {
    console.error("Official Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Official authentication failed. Please try again."
    });
  }
});

/**
 * GET /api/auth/me
 * Returns authenticated user profile using token
 */
router.get("/me", authenticateToken, async (req, res) => {
  try {
    if (req.user.role === "farmer") {
      const farmer = await Farmer.findById(req.user.userId);
      if (!farmer) {
        return res.status(404).json({
          success: false,
          message: "Farmer account record not found."
        });
      }
      return res.status(200).json({
        success: true,
        user: {
          id: farmer.registrationNumber,
          registrationNumber: farmer.registrationNumber,
          name: farmer.fullName,
          fullName: farmer.fullName,
          guardianName: farmer.guardianName,
          mobile: farmer.mobileNumber,
          mobileNumber: farmer.mobileNumber,
          aadhaarMasked: farmer.aadhaarMasked,
          gender: farmer.gender,
          age: farmer.age,
          krishakId: farmer.krishakId,
          district: farmer.district,
          mandal: farmer.mandal,
          village: farmer.village,
          pincode: farmer.pincode,
          lands: farmer.lands,
          bank: farmer.bank,
          role: "Farmer",
          userRole: "farmer",
          status: farmer.status
        }
      });
    } else if (req.user.role === "official") {
      const official = await Official.findById(req.user.userId);
      if (!official) {
        return res.status(404).json({
          success: false,
          message: "Official account record not found."
        });
      }
      return res.status(200).json({
        success: true,
        user: {
          id: official.employeeId,
          employeeId: official.employeeId,
          name: official.name,
          role: "Admin",
          userRole: "official",
          officialRole: official.role,
          district: official.district,
          status: official.status
        }
      });
    }

    return res.status(400).json({
      success: false,
      message: "Unrecognized user role."
    });
  } catch (error) {
    console.error("Auth Me Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user session."
    });
  }
});

module.exports = router;
