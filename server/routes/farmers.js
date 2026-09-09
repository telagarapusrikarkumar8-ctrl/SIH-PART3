const express = require("express");
const jwt = require("jsonwebtoken");
const Farmer = require("../models/Farmer");
const { hashAadhaar, maskAadhaar } = require("../utils/hash");
const { generateRegistrationNumber } = require("../utils/generateRegistrationNumber");
const { authenticateToken } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "epaddy_sih_secure_jwt_secret_2026_kms";

/**
 * POST /api/farmers/register
 * Public endpoint to register a new farmer with UIDAI Aadhaar hashing and unique ID issuance
 */
router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      name,
      guardianName,
      fatherName,
      aadhaar,
      mobileNumber,
      mobile,
      gender,
      age,
      krishakId,
      krishakBandhuId,
      voterId,
      district,
      mandal,
      panchayat,
      village,
      pincode,
      lands,
      bank,
      preferredCentreId
    } = req.body;

    const farmerName = (fullName || name || "").trim();
    const phone = String(mobileNumber || mobile || "").trim().replace(/\D/g, "");
    const aadhaarInput = String(aadhaar || "").trim().replace(/\D/g, "");

    // 1. Mandatory Validations
    if (!farmerName) {
      return res.status(400).json({
        success: false,
        message: "Farmer Full Name is required."
      });
    }

    if (!aadhaarInput || aadhaarInput.length !== 12) {
      return res.status(400).json({
        success: false,
        message: "A valid 12-digit Aadhaar Number is required."
      });
    }

    if (!phone || phone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "A valid 10-digit Mobile Number is required."
      });
    }

    const parsedAge = parseInt(age, 10);
    if (!isNaN(parsedAge) && (parsedAge < 18 || parsedAge > 100)) {
      return res.status(400).json({
        success: false,
        message: "Applicant age must be between 18 and 100 years."
      });
    }

    // 2. Duplicate Checks using one-way Aadhaar hash
    const aadhaarHashValue = hashAadhaar(aadhaarInput);

    const existingAadhaar = await Farmer.findOne({ aadhaarHash: aadhaarHashValue });
    if (existingAadhaar) {
      return res.status(409).json({
        success: false,
        message: `This Aadhaar Number is already registered with Registration ID: ${existingAadhaar.registrationNumber}. Please sign in directly.`
      });
    }

    const existingMobile = await Farmer.findOne({ mobileNumber: phone });
    if (existingMobile) {
      return res.status(409).json({
        success: false,
        message: `This Mobile Number (${phone}) is already registered with another farmer profile.`
      });
    }

    const cleanKrishak = (krishakId || krishakBandhuId || "").trim();
    if (cleanKrishak) {
      const existingKrishak = await Farmer.findOne({ krishakId: cleanKrishak });
      if (existingKrishak) {
        return res.status(409).json({
          success: false,
          message: `Krishak Bandhu ID ${cleanKrishak} is already in use.`
        });
      }
    }

    // 3. Generate unique sequential Registration ID
    const registrationNumber = await generateRegistrationNumber("AP", 2026);

    // 4. Create Farmer Document
    const newFarmer = await Farmer.create({
      registrationNumber,
      fullName: farmerName,
      guardianName: (guardianName || fatherName || "").trim(),
      aadhaarHash: aadhaarHashValue,
      aadhaarMasked: maskAadhaar(aadhaarInput),
      mobileNumber: phone,
      gender: ["Male", "Female", "Transgender", "Other"].includes(gender) ? gender : "Male",
      age: isNaN(parsedAge) ? 35 : parsedAge,
      krishakId: cleanKrishak || undefined,
      voterId: (voterId || "").trim() || undefined,
      district: (district || "Guntur").trim(),
      mandal: (mandal || "Tenali").trim(),
      panchayat: (panchayat || "Angalakuduru").trim(),
      village: (village || "Angalakuduru").trim(),
      pincode: (pincode || "522201").trim(),
      status: "Verified",
      lands: Array.isArray(lands) && lands.length > 0 ? lands : [
        {
          district: (district || "Guntur").trim(),
          village: (village || "Angalakuduru").trim(),
          surveyNo: "128/1A",
          dagNo: "34",
          areaAcres: 3.5,
          ownership: "Self Owned",
          status: "Verified (e-Record)"
        }
      ],
      bank: {
        bankName: bank?.bankName || "State Bank of India",
        branch: bank?.branch || "Tenali Main Branch",
        ifsc: bank?.ifsc || "SBIN0000928",
        accountNumberMasked: bank?.accountNumber ? `XXXXXXXX${String(bank.accountNumber).slice(-4)}` : "XXXXXXXX4819",
        accountNumber: bank?.accountNumber || "309812454819"
      },
      preferredCentreId: preferredCentreId || "PPC-GNT-001",
      procurementSummary: {
        scheduledQuantity: 0,
        procuredQuantity: 0,
        paymentDue: 0,
        paymentReceived: 0
      },
      currentStage: 3
    });

    // 5. Issue JWT Token
    const token = jwt.sign(
      {
        userId: newFarmer._id,
        role: "farmer",
        registrationNumber: newFarmer.registrationNumber
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      success: true,
      message: `Farmer registration successful! Your permanent Registration ID is ${registrationNumber}.`,
      registrationNumber: newFarmer.registrationNumber,
      token,
      user: {
        id: newFarmer.registrationNumber,
        registrationNumber: newFarmer.registrationNumber,
        name: newFarmer.fullName,
        fullName: newFarmer.fullName,
        mobile: newFarmer.mobileNumber,
        mobileNumber: newFarmer.mobileNumber,
        district: newFarmer.district,
        mandal: newFarmer.mandal,
        village: newFarmer.village,
        role: "Farmer",
        userRole: "farmer",
        status: newFarmer.status
      }
    });
  } catch (error) {
    console.error("Farmer Registration Error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate record detected. Aadhaar or Mobile Number already registered."
      });
    }
    return res.status(500).json({
      success: false,
      message: "An error occurred during farmer registration. Please try again."
    });
  }
});

/**
 * GET /api/farmers/me
 * Protected endpoint: Returns current logged-in farmer profile
 */
router.get("/me", authenticateToken, requireRole("farmer"), async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.userId);
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: "Farmer record not found."
      });
    }

    return res.status(200).json({
      success: true,
      farmer
    });
  } catch (error) {
    console.error("Get Farmer Me Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch farmer profile."
    });
  }
});

/**
 * PUT /api/farmers/me
 * Protected endpoint: Allows farmer to update land parcels & bank particulars
 */
router.put("/me", authenticateToken, requireRole("farmer"), async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.userId);
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: "Farmer record not found."
      });
    }

    const { lands, bank, district, mandal, village, panchayat, pincode, guardianName, preferredCentreId } = req.body;

    if (Array.isArray(lands)) farmer.lands = lands;
    if (bank) {
      farmer.bank = {
        ...farmer.bank.toObject(),
        ...bank,
        accountNumberMasked: bank.accountNumber ? `XXXXXXXX${String(bank.accountNumber).slice(-4)}` : farmer.bank.accountNumberMasked
      };
    }
    if (district) farmer.district = district;
    if (mandal) farmer.mandal = mandal;
    if (village) farmer.village = village;
    if (panchayat) farmer.panchayat = panchayat;
    if (pincode) farmer.pincode = pincode;
    if (guardianName) farmer.guardianName = guardianName;
    if (preferredCentreId) farmer.preferredCentreId = preferredCentreId;

    await farmer.save();

    return res.status(200).json({
      success: true,
      message: "Farmer particulars updated successfully.",
      farmer
    });
  } catch (error) {
    console.error("Update Farmer Me Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update farmer particulars."
    });
  }
});

/**
 * GET /api/farmers/:registrationNumber
 * Protected endpoint: Returns farmer profile by registration number
 */
router.get("/:registrationNumber", authenticateToken, async (req, res) => {
  try {
    const regNumber = req.params.registrationNumber.toUpperCase();

    // Authorization check: Only officials or the farmer themselves can view this profile
    if (req.user.role !== "official" && req.user.registrationNumber !== regNumber) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You can only view your own farmer profile."
      });
    }

    const farmer = await Farmer.findOne({ registrationNumber: regNumber });

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: `Farmer with Registration Number ${regNumber} not found.`
      });
    }

    return res.status(200).json({
      success: true,
      farmer
    });
  } catch (error) {
    console.error("Get Farmer by ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch farmer profile."
    });
  }
});

module.exports = router;
