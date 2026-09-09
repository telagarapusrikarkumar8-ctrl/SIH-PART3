const mongoose = require("mongoose");

const LandParcelSchema = new mongoose.Schema(
  {
    district: { type: String, default: "Guntur" },
    village: { type: String, default: "" },
    surveyNo: { type: String, default: "" },
    dagNo: { type: String, default: "-" },
    areaAcres: { type: Number, default: 0 },
    ownership: { type: String, default: "Self Owned" },
    status: { type: String, default: "Verified (e-Record)" }
  },
  { _id: false }
);

const BankDetailsSchema = new mongoose.Schema(
  {
    bankName: { type: String, default: "" },
    branch: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    accountNumberMasked: { type: String, default: "" },
    accountNumber: { type: String, default: "" }
  },
  { _id: false }
);

const ProcurementSummarySchema = new mongoose.Schema(
  {
    scheduledQuantity: { type: Number, default: 0 },
    procuredQuantity: { type: Number, default: 0 },
    paymentDue: { type: Number, default: 0 },
    paymentReceived: { type: Number, default: 0 }
  },
  { _id: false }
);

const FarmerSchema = new mongoose.Schema(
  {
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    fullName: {
      type: String,
      required: [true, "Farmer full name is required"],
      trim: true
    },
    guardianName: {
      type: String,
      trim: true,
      default: ""
    },
    aadhaarHash: {
      type: String,
      required: [true, "Aadhaar hash is required"],
      unique: true,
      select: false,
      index: true
    },
    aadhaarMasked: {
      type: String,
      trim: true,
      default: ""
    },
    mobileNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      trim: true,
      index: true
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Transgender", "Other"],
      default: "Male"
    },
    age: {
      type: Number,
      min: [18, "Age must be at least 18"],
      max: [100, "Age cannot exceed 100"],
      default: 35
    },
    krishakId: {
      type: String,
      sparse: true,
      trim: true
    },
    voterId: {
      type: String,
      sparse: true,
      trim: true
    },
    district: {
      type: String,
      default: "Guntur",
      trim: true
    },
    mandal: {
      type: String,
      default: "",
      trim: true
    },
    panchayat: {
      type: String,
      default: "",
      trim: true
    },
    village: {
      type: String,
      default: "",
      trim: true
    },
    pincode: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      enum: ["active", "inactive", "blocked", "Verified"],
      default: "active"
    },
    lands: {
      type: [LandParcelSchema],
      default: []
    },
    bank: {
      type: BankDetailsSchema,
      default: () => ({})
    },
    preferredCentreId: {
      type: String,
      default: "PPC-GNT-001"
    },
    procurementSummary: {
      type: ProcurementSummarySchema,
      default: () => ({})
    },
    currentStage: {
      type: Number,
      default: 1
    },
    activeAppointment: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    registrationDate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Virtual for backward-compatibility with frontend field names
FarmerSchema.virtual("id").get(function () {
  return this.registrationNumber;
});

FarmerSchema.virtual("name").get(function () {
  return this.fullName;
});

FarmerSchema.virtual("mobile").get(function () {
  return this.mobileNumber;
});

FarmerSchema.set("toJSON", { virtuals: true });
FarmerSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Farmer", FarmerSchema);
