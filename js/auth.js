/**
 * e-Paddy Portal: Centralized Authentication & Access Control System
 * Role-Based Access Control, Session State, Farmer OTP & Official Login
 * Connected to Node.js / Express / MongoDB REST Backend
 */

const API_BASE = "http://localhost:5000/api";

// Centralized Auth Module
const Auth = {
  // Check if any user is logged in
  isAuthenticated() {
    const user = this.getUser();
    return !!(user && user.id && this.getToken());
  },

  // Get authentication token
  getToken() {
    return localStorage.getItem("authToken");
  },

  // Get HTTP headers for authenticated requests
  getAuthHeaders() {
    const token = this.getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  },

  // Get current user object
  getUser() {
    try {
      const userStr = localStorage.getItem("epaddy_current_user") || localStorage.getItem("authUser");
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  // Get normalized user role: 'farmer', 'official', or null
  getRole() {
    const user = this.getUser();
    if (!user) return null;
    const role = (user.role || user.userRole || localStorage.getItem("userRole") || "").toLowerCase();
    if (role.includes("admin") || role.includes("official") || role.includes("officer")) {
      return "official";
    }
    return "farmer";
  },

  // Set farmer login session with JWT token
  loginFarmer(farmerData, token = null, redirectUrl = "farmer-dashboard.html") {
    if (token) {
      localStorage.setItem("authToken", token);
    }

    const sessionUser = {
      id: farmerData.registrationNumber || farmerData.id,
      registrationNumber: farmerData.registrationNumber || farmerData.id,
      name: farmerData.fullName || farmerData.name,
      mobile: farmerData.mobileNumber || farmerData.mobile,
      district: farmerData.district || "Guntur",
      mandal: farmerData.mandal || "Tenali",
      role: "Farmer",
      userRole: "farmer"
    };

    localStorage.setItem("epaddy_current_user", JSON.stringify(sessionUser));
    localStorage.setItem("authUser", JSON.stringify(sessionUser));
    localStorage.setItem("userRole", "farmer");
    localStorage.setItem("isAuthenticated", "true");

    if (typeof showToast === "function") {
      showToast(`Welcome, ${sessionUser.name}! Farmer authentication successful.`, "success");
    }

    // Check if there was a saved redirect intent
    const returnUrl = sessionStorage.getItem("auth_return_url") || redirectUrl;
    sessionStorage.removeItem("auth_return_url");

    setTimeout(() => {
      window.location.href = returnUrl;
    }, 800);
  },

  // Set official / admin login session with JWT token
  loginOfficial(officerData, token = null, redirectUrl = "admin-dashboard.html") {
    if (token) {
      localStorage.setItem("authToken", token);
    }

    const sessionUser = {
      id: officerData.employeeId || officerData.id,
      employeeId: officerData.employeeId || officerData.id,
      name: officerData.name || "Sri M. Rajasekhar, IAS",
      role: "Admin",
      userRole: "official",
      officialRole: officerData.officialRole || officerData.role || "District Procurement Officer",
      district: officerData.district || "Guntur"
    };

    localStorage.setItem("epaddy_current_user", JSON.stringify(sessionUser));
    localStorage.setItem("authUser", JSON.stringify(sessionUser));
    localStorage.setItem("userRole", "official");
    localStorage.setItem("isAuthenticated", "true");

    if (typeof showToast === "function") {
      showToast("Departmental authentication successful! Opening Admin Dashboard...", "success");
    }

    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 800);
  },

  // Log out current user
  logout(redirectUrl = "index.html") {
    localStorage.removeItem("authToken");
    localStorage.removeItem("epaddy_current_user");
    localStorage.removeItem("authUser");
    localStorage.removeItem("userRole");
    localStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("auth_return_url");

    if (typeof showToast === "function") {
      showToast("You have been securely logged out.", "info");
    }

    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 600);
  },

  // Intercept "Book Slot" actions throughout the portal
  handleBookSlot(event, centreId = "") {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }

    const targetUrl = centreId ? `slot-booking.html?centre=${encodeURIComponent(centreId)}` : "slot-booking.html";

    // 1. If not authenticated -> Show Login Required Modal
    if (!this.isAuthenticated()) {
      sessionStorage.setItem("auth_return_url", targetUrl);
      this.showLoginRequiredModal(
        "You must login as a farmer to continue booking a procurement slot.",
        "farmer-login.html"
      );
      return false;
    }

    // 2. If authenticated as Official -> Show Role Warning Modal
    if (this.getRole() === "official") {
      if (typeof showToast === "function") {
        showToast("Farmer login required. You are currently signed in with Official credentials.", "warning", 5000);
      }
      this.showLoginRequiredModal(
        "Slot booking is reserved for registered farmers. Please sign in with your Farmer credentials.",
        "farmer-login.html"
      );
      return false;
    }

    // 3. If authenticated as Farmer -> Proceed directly to booking
    window.location.href = targetUrl;
    return true;
  },

  // Display the dedicated "Login Required" modal
  showLoginRequiredModal(message = "You must login as a farmer to continue booking a procurement slot.", loginUrl = "farmer-login.html") {
    let modal = document.getElementById("login-required-modal");
    if (!modal) {
      this.injectLoginRequiredModal();
      modal = document.getElementById("login-required-modal");
    }

    if (modal) {
      const msgElem = modal.querySelector(".login-required-message");
      if (msgElem && message) {
        msgElem.textContent = message;
      }

      const loginBtn = modal.querySelector(".btn-modal-farmer-login");
      if (loginBtn) {
        loginBtn.onclick = () => {
          window.location.href = loginUrl;
        };
      }

      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
    }
  },

  // Close the Login Required modal
  closeLoginRequiredModal() {
    const modal = document.getElementById("login-required-modal");
    if (modal) {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
    }
  },

  // Inject modal into DOM if not present
  injectLoginRequiredModal() {
    if (document.getElementById("login-required-modal")) return;

    const modalHtml = `
      <div id="login-required-modal" class="login-required-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="login-req-title">
        <div class="login-required-dialog">
          <div class="login-required-header">
            <h3 id="login-req-title" class="login-required-title">
              <span>🔒</span> Login Required
            </h3>
            <button type="button" class="modal-close" onclick="Auth.closeLoginRequiredModal()" aria-label="Close dialog">&times;</button>
          </div>
          <div class="login-required-body">
            <div class="login-required-icon" aria-hidden="true">🌾</div>
            <p class="login-required-message">
              You must login as a farmer to continue booking a procurement slot.
            </p>
            <p class="login-required-hint">
              Registered farmers can book convenient weighbridge delivery dates and track MSP payments.
            </p>
          </div>
          <div class="login-required-footer">
            <button type="button" class="btn btn-secondary" onclick="Auth.closeLoginRequiredModal()">
              Cancel
            </button>
            <button type="button" class="btn btn-primary btn-modal-farmer-login">
              Farmer Login
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Close on backdrop click
    const modal = document.getElementById("login-required-modal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          Auth.closeLoginRequiredModal();
        }
      });
    }
  }
};

// Global assignment
window.Auth = Auth;

// ==========================================
// Farmer Login & OTP Engine (Backend Connected)
// ==========================================
let pendingAuthFarmer = null;
let otpTimerInterval = null;

// Tab switcher for Farmer Login
function initAuthTabs() {
  const tabs = document.querySelectorAll(".auth-tab");
  const tabContents = document.querySelectorAll(".auth-tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      const targetId = tab.getAttribute("data-tab");
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  });
}

// Captcha Simulation
function refreshCaptcha(containerId = "captcha-code") {
  const codeElem = document.getElementById(containerId);
  if (!codeElem) return;

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let captcha = "";
  for (let i = 0; i < 5; i++) {
    captcha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  codeElem.textContent = captcha;
  codeElem.setAttribute("data-code", captcha);
}

// Trigger login based on active tab
function triggerLoginOtp() {
  const activeTab = document.querySelector(".auth-tab.active");
  const tabId = activeTab ? activeTab.getAttribute("data-tab") : "tab-reg";

  if (tabId === "tab-mobile") {
    handleFarmerOtpRequest("mobile");
  } else if (tabId === "tab-aadhaar") {
    handleFarmerOtpRequest("aadhaar");
  } else {
    handleFarmerOtpRequest("reg");
  }
}

// Handle Farmer OTP Request (Calls /api/auth/farmer/request-otp)
async function handleFarmerOtpRequest(identifierType) {
  let identifierValue = "";
  let method = "registration";

  if (identifierType === "reg") {
    identifierValue = document.getElementById("login-reg-number")?.value.trim();
    method = "registration";
  } else if (identifierType === "mobile") {
    identifierValue = document.getElementById("login-mobile-number")?.value.trim();
    method = "mobile";
  } else if (identifierType === "aadhaar") {
    identifierValue = document.getElementById("login-aadhaar-number")?.value.trim();
    method = "aadhaar";
  }

  const captchaInput = document.getElementById("login-captcha-input")?.value.trim();
  const actualCaptcha = document.getElementById("captcha-code")?.getAttribute("data-code");

  if (!identifierValue) {
    if (typeof showToast === "function") {
      showToast("Please enter your login identifier.", "danger");
    }
    return;
  }

  if (captchaInput && actualCaptcha && captchaInput.toUpperCase() !== actualCaptcha.toUpperCase()) {
    if (typeof showToast === "function") {
      showToast("Invalid security Captcha code. Please try again.", "danger");
    }
    refreshCaptcha();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/farmer/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        identifier: identifierValue
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      if (typeof showToast === "function") {
        showToast(data.message || "Unable to request OTP.", "danger");
      }
      return;
    }

    pendingAuthFarmer = {
      id: data.farmerId,
      registrationNumber: data.registrationNumber
    };

    // Open OTP modal & start countdown
    const phoneDisplay = document.getElementById("otp-modal-mobile");
    if (phoneDisplay && data.maskedMobile) {
      phoneDisplay.textContent = data.maskedMobile;
    }

    const devOtpDisplay = document.getElementById("dev-otp-display");
    if (devOtpDisplay && data.devOtp) {
      devOtpDisplay.textContent = data.devOtp;
    }
    window.currentDevOtp = data.devOtp || "123456";

    startOtpTimer();
    if (typeof openModal === "function") {
      openModal("otp-modal");
    } else {
      const modal = document.getElementById("otp-modal");
      if (modal) modal.classList.add("active");
    }

    // Auto focus first OTP box
    setTimeout(() => {
      const firstBox = document.querySelector(".otp-box");
      if (firstBox) firstBox.focus();
    }, 150);

    if (typeof showToast === "function") {
      if (data.devOtp) {
        showToast(`OTP ready! Test Code: ${data.devOtp}`, "success", 7000);
      } else {
        showToast("OTP sent to registered mobile number.", "success");
      }
    }
  } catch (error) {
    console.error("Farmer OTP Request Network Error:", error);
    if (typeof showToast === "function") {
      showToast("Unable to reach backend server. Please verify the server is running.", "danger");
    }
  }
}

function autoFillOtp(customCode) {
  const code = String(customCode || window.currentDevOtp || document.getElementById("dev-otp-display")?.textContent || "123456").trim();
  const otpBoxes = document.querySelectorAll(".otp-box");
  otpBoxes.forEach((box, idx) => {
    if (idx < code.length) {
      box.value = code[idx];
    }
  });
  if (otpBoxes.length > 0) {
    otpBoxes[otpBoxes.length - 1].focus();
  }
  const verifyBtn = document.getElementById("btn-verify-otp");
  if (verifyBtn) {
    verifyBtn.focus();
  }
  if (typeof showToast === "function") {
    showToast(`Auto-filled OTP: ${code}`, "info", 2500);
  }
}
window.autoFillOtp = autoFillOtp;

function startOtpTimer() {
  let seconds = 60;
  const timerElem = document.getElementById("otp-timer-count");
  const resendBtn = document.getElementById("btn-resend-otp");

  if (resendBtn) resendBtn.disabled = true;

  clearInterval(otpTimerInterval);
  otpTimerInterval = setInterval(() => {
    seconds--;
    if (timerElem) timerElem.textContent = `${seconds}s`;
    if (seconds <= 0) {
      clearInterval(otpTimerInterval);
      if (resendBtn) resendBtn.disabled = false;
      if (timerElem) timerElem.textContent = "Expired";
    }
  }, 1000);
}

// Verify OTP & complete login (Calls /api/auth/farmer/verify-otp)
async function verifyFarmerOtp() {
  const otpInputs = document.querySelectorAll(".otp-box");
  let enteredOtp = "";
  otpInputs.forEach((input) => (enteredOtp += input.value.trim()));

  if (enteredOtp.length < 6) {
    if (typeof showToast === "function") {
      showToast("Please enter the complete 6-digit OTP.", "danger");
    }
    return;
  }

  if (!pendingAuthFarmer || !pendingAuthFarmer.id) {
    if (typeof showToast === "function") {
      showToast("Session expired. Please request a new OTP.", "danger");
    }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/farmer/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmerId: pendingAuthFarmer.id,
        otp: enteredOtp
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      if (typeof showToast === "function") {
        showToast(data.message || "Incorrect OTP code. Please try again.", "danger");
      }
      return;
    }

    // Close OTP modal
    clearInterval(otpTimerInterval);
    if (typeof closeModal === "function") {
      closeModal("otp-modal");
    } else {
      const modal = document.getElementById("otp-modal");
      if (modal) modal.classList.remove("active");
    }

    // Login farmer with returned token and profile data
    Auth.loginFarmer(data.user, data.token);
  } catch (error) {
    console.error("Farmer OTP Verify Network Error:", error);
    if (typeof showToast === "function") {
      showToast("Unable to verify OTP with authentication server.", "danger");
    }
  }
}

// ==========================================
// Official Login (Employee ID + Password)
// ==========================================
async function handleOfficialLogin(event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }

  const employeeId = document.getElementById("admin-emp-id")?.value.trim();
  const district = document.getElementById("admin-district")?.value.trim();
  const role = document.getElementById("admin-role")?.value.trim();
  const password = document.getElementById("admin-password")?.value;

  if (!employeeId || !password) {
    if (typeof showToast === "function") {
      showToast("Please enter your Employee ID and Password.", "danger");
    }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/official/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        district,
        role,
        password
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      if (typeof showToast === "function") {
        showToast(data.message || "Official authentication failed.", "danger");
      }
      return;
    }

    Auth.loginOfficial(data.user, data.token);
  } catch (error) {
    console.error("Official Login Network Error:", error);
    if (typeof showToast === "function") {
      showToast("Unable to connect to authentication server.", "danger");
    }
  }
}

// Document Ready Initialization
document.addEventListener("DOMContentLoaded", () => {
  initAuthTabs();
  refreshCaptcha();

  // Inject modal on pages where Auth is loaded
  Auth.injectLoginRequiredModal();

  // Refresh captcha button
  const refreshBtn = document.getElementById("btn-refresh-captcha");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => refreshCaptcha());
  }

  // OTP Box Auto-focus and paste behavior
  const otpBoxes = document.querySelectorAll(".otp-box");
  otpBoxes.forEach((box, idx) => {
    box.addEventListener("input", (e) => {
      const val = e.target.value.replace(/\D/g, "");
      e.target.value = val.slice(-1);
      if (e.target.value && idx < otpBoxes.length - 1) {
        otpBoxes[idx + 1].focus();
      }
    });

    box.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
      if (pasteData) {
        otpBoxes.forEach((b, i) => {
          if (i < pasteData.length) {
            b.value = pasteData[i];
          }
        });
        const targetIdx = Math.min(pasteData.length, otpBoxes.length) - 1;
        if (targetIdx >= 0 && otpBoxes[targetIdx]) {
          otpBoxes[targetIdx].focus();
        }
      }
    });

    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace") {
        if (!e.target.value && idx > 0) {
          otpBoxes[idx - 1].focus();
        }
      } else if (e.key === "ArrowLeft" && idx > 0) {
        otpBoxes[idx - 1].focus();
      } else if (e.key === "ArrowRight" && idx < otpBoxes.length - 1) {
        otpBoxes[idx + 1].focus();
      } else if (e.key === "Enter") {
        verifyFarmerOtp();
      }
    });
  });
});
