const mongoose = require("mongoose");

const OTPSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farmer",
      default: null
    },
    identifier: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    method: {
      type: String,
      enum: ["registration", "mobile", "aadhaar", "quick-reg"],
      default: "mobile"
    },
    userType: {
      type: String,
      enum: ["farmer"],
      default: "farmer"
    },
    otpHash: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // TTL index automatically cleans up expired OTP documents
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 5
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("OTP", OTPSchema);
