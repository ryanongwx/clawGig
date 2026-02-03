import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { JobFactory, Escrow } from "../typechain-types";

function hashDesc(s: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(s));
}

describe("JobFactory", function () {
  async function deployFixture() {
    const [owner, issuer, completer] = await ethers.getSigners();
    const JobFactory = await ethers.getContractFactory("JobFactory");
    const factory = await JobFactory.deploy();
    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy();
    await escrow.setJobFactory(await factory.getAddress());
    await factory.setEscrow(await escrow.getAddress());
    return { factory, escrow, owner, issuer, completer };
  }

  it("should post a job and emit JobPosted", async function () {
    const { factory, issuer } = await loadFixture(deployFixture);
    const descHash = hashDesc("Scrape website X");
    const bounty = ethers.parseEther("0.1");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

    await expect(factory.connect(issuer).postJob(descHash, bounty, deadline))
      .to.emit(factory, "JobPosted")
      .withArgs(1, issuer.address, descHash, bounty, deadline);

    const job = await factory.getJob(1);
    expect(job.issuer_).to.eq(issuer.address);
    expect(job.bounty_).to.eq(bounty);
    expect(job.status_).to.eq(0);
  });

  it("should reject zero bounty or past deadline", async function () {
    const { factory, issuer } = await loadFixture(deployFixture);
    const descHash = hashDesc("Task");
    const past = BigInt(Math.floor(Date.now() / 1000) - 1);

    await expect(factory.connect(issuer).postJob(descHash, 0, past + 86400n))
      .to.be.revertedWithCustomError(factory, "InvalidBounty");
    await expect(factory.connect(issuer).postJob(descHash, 1, past))
      .to.be.revertedWithCustomError(factory, "InvalidDeadline");
  });

  it("should allow escrow to set claimed and completed", async function () {
    const { factory, escrow, issuer, completer } = await loadFixture(deployFixture);
    const descHash = hashDesc("Task");
    const bounty = ethers.parseEther("0.1");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await factory.connect(issuer).postJob(descHash, bounty, deadline);
    await escrow.connect(issuer).deposit(1, { value: bounty });

    await factory.setClaimed(1, completer.address);
    expect((await factory.getJob(1)).status_).to.eq(1);
    await factory.setSubmitted(1);
    expect((await factory.getJob(1)).status_).to.eq(2);
    await factory.setCompleted(1, true);
    expect((await factory.getJob(1)).status_).to.eq(3);
  });

  it("should allow issuer to cancel open job", async function () {
    const { factory, issuer } = await loadFixture(deployFixture);
    const descHash = hashDesc("Task");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await factory.connect(issuer).postJob(descHash, 1, deadline);
    await expect(factory.connect(issuer).cancelJob(1)).to.emit(factory, "JobCancelled");
    expect((await factory.getJob(1)).status_).to.eq(4);
  });
});
