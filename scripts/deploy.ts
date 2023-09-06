import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying the contracts with the account:",
    await deployer.getAddress()
  );
  const Crash = await ethers.getContractFactory("Crash");

  const crash = await Crash.deploy();

  console.log("Crash address:", crash.address);

  const BridgeManager = await ethers.getContractFactory("BridgeManager");

  const bridgeManager = await BridgeManager.deploy();

  console.log("bridgeManager address:", bridgeManager.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
