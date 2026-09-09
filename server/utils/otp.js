/**
 * OTP Generation and Verification utilities
 */

/**
 * Generates a 6-digit OTP
 * Default demo code: '123456' for predictable development testing,
 * or configurable via DEFAULT_OTP env variable.
 */
function generateOtp() {
  if (process.env.DEFAULT_OTP) {
    return String(process.env.DEFAULT_OTP).trim();
  }
  if (process.env.NODE_ENV === "production") {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
  // Default predictable 6-digit OTP for development and demo environments
  return "123456";
}

module.exports = {
  generateOtp
};
