const mongoose = require("mongoose");

const OfficialSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    district: {
      type: String,
      required: [true, "Jurisdiction district is required"],
      trim: true
    },
    role: {
      type: String,
      required: [true, "Designated official role is required"],
      trim: true
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      select: false
    },
    name: {
      type: String,
      default: "Sri M. Rajasekhar, IAS",
      trim: true
    },
    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active"
    },
    lastLoginAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Virtual for backward-compatibility
OfficialSchema.virtual("id").get(function () {
  return this.employeeId;
});

OfficialSchema.virtual("officialRole").get(function () {
  return this.role;
});

OfficialSchema.set("toJSON", { virtuals: true });
OfficialSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Official", OfficialSchema);
