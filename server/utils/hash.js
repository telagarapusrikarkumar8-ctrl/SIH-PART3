const crypto = require("crypto");

/**
 * Computes a deterministic SHA-256 hash of a 12-digit Aadhaar number
 * Used for duplicate checking and secure lookup without storing plaintext Aadhaar.
 */
function hashAadhaar(aadhaar) {
  if (!aadhaar) return "";
  const normalized = String(aadhaar).trim().replace(/\D/g, "");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Creates a masked Aadhaar string (e.g. XXXX-XXXX-8921)
 */
function maskAadhaar(aadhaar) {
  if (!aadhaar) return "";
  const clean = String(aadhaar).trim().replace(/\D/g, "");
  if (clean.length < 4) return "XXXX-XXXX-XXXX";
  return `XXXX-XXXX-${clean.slice(-4)}`;
}

/**
 * Computes SHA-256 hash for OTP verification
 */
function hashOtp(otp) {
  if (!otp) return "";
  return crypto.createHash("sha256").update(String(otp).trim()).digest("hex");
}

/**
 * Compares plain OTP against hashed OTP safely
 */
function verifyOtpHash(otp, hashedOtp) {
  if (!otp || !hashedOtp) return false;
  const computedHash = hashOtp(otp);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, "hex"),
    Buffer.from(hashedOtp, "hex")
  );
}

module.exports = {
  hashAadhaar,
  maskAadhaar,
  hashOtp,
  verifyOtpHash
};
