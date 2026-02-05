import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/clawgig";

export async function connectDb() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    throw err;
  }
}

export const JobSchema = new mongoose.Schema(
  {
    jobId: { type: Number, required: true, unique: true },
    issuer: { type: String, required: true },
    descriptionHash: { type: String, required: true },
    description: { type: String },
    bounty: { type: String, required: true },
    bountyToken: { type: String, enum: ["MON", "USDC"], default: "MON" },
    deadline: { type: Date, required: true },
    completer: { type: String },
    ipfsHash: { type: String },
    status: {
      type: String,
      enum: ["open", "claimed", "submitted", "completed", "cancelled"],
      default: "open",
    },
    chainId: { type: Number },
    txHash: { type: String },
  },
  { timestamps: true }
);

JobSchema.index({ status: 1, createdAt: -1 });
JobSchema.index({ deadline: 1 });

export const Job = mongoose.model("Job", JobSchema);

/** Agents: address + name only. No private keys. Links to on-chain reputation. */
export const AgentSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, unique: true },
    name: { type: String, default: "OpenClaw Agent" },
  },
  { timestamps: true }
);

export const Agent = mongoose.model("Agent", AgentSchema);
