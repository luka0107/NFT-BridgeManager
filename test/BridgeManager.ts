import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
// import {ethers as pureEthers} from 'ethers'

describe("BridgeManager", function () {
  /**
   * What should be tested?
   * 
   * 1. Deploy Crash NFT to Ethereum and Flow chains.
   * 2. Mint Crash #1 to account1 on Ethereum.
   * 3. account1 wants to bridge Crash #1 from Ethereum to Flow chain.
   * 4. BridgeManager owner mint Crash collection so that Crash collection is registered in BridgeManager
   * 5. owner calls BridgeManager.addChainsToCollection(Crash, ["FLOW"], ["<Flow Address>"])
   * 6. account1 calls BridgeManager.sendTokenToBridge(NFTCollections.Crash, #1, "FLOW", "<Flow Address>", true <takeFee>)
   * 7. account1 calls BridgeManager.pullTokenFromBridge(NFTCollections.Crash, #1, "ETH", "<Ethereum Address>", <Signature>, true <takeFee>)
   *  
   * */

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployBridgeManagerFixture() {
    // Contracts are deployed using the first signer/account by default
    const [bridgeManagerDeployer, account1] = await ethers.getSigners();

    const BridgeManager = await ethers.getContractFactory("BridgeManager");

    const ethBridgeManager = await BridgeManager.deploy();
    const ethBridgeManagerAddress = ethBridgeManager.address;
    const flowBridgeManager = await BridgeManager.deploy();
    const flowBridgeManagerAddress = flowBridgeManager.address;

    console.log(">>> ~ bridgeManagerDeployer.address:", bridgeManagerDeployer.address);
    console.log(">>> ~ ethBridgeManagerAddress:", ethBridgeManagerAddress);
    console.log(">>> ~ flowBridgeManagerAddress:", flowBridgeManagerAddress);
    console.log(">>> ~ account1.address:", account1.address);

    return {
      ethBridgeManager,
      ethBridgeManagerAddress,
      bridgeManagerDeployer,
      flowBridgeManager,
      flowBridgeManagerAddress,
      account1
    };
  }

  async function deployCrashFixture() {
    const Crash = await ethers.getContractFactory("Crash");
    const ethCrash = await Crash.deploy();
    const flowCrash = await Crash.deploy();
    const ethCrashAddress = ethCrash.address;
    const flowCrashAddress = flowCrash.address;
    console.log(">>> ~ ethCrashAddress:", ethCrashAddress);
    console.log(">>> ~ flowCrashAddress:", flowCrashAddress);

    return {
      ethCrash,
      ethCrashAddress,
      flowCrash,
      flowCrashAddress,
    };
  }

  describe("Bridge", function () {
    it("Bridge between two different networks", async function () {
      const {
        ethCrash,
        ethCrashAddress,
        flowCrash,
        flowCrashAddress
      } = await loadFixture(deployCrashFixture);
      const {
        bridgeManagerDeployer,
        ethBridgeManager,
        ethBridgeManagerAddress,
        flowBridgeManager,
        flowBridgeManagerAddress,
        account1
      } = await loadFixture(deployBridgeManagerFixture);

      const tokenId = 2;

      await ethBridgeManager.mintCollection("Crash", "CRASH", "baseURI", "ETH", ethCrashAddress);
      await flowBridgeManager.mintCollection("Crash", "CRASH", "baseURI", "FLOW", flowCrashAddress);
      const ethCrashCollectionAddress = (await ethBridgeManager.getCollections())[0];
      const flowCrashCollectionAddress = (await flowBridgeManager.getCollections())[0];
      console.log(">>> ~ ethCrashCollection:", ethCrashCollectionAddress);
      console.log(">>> ~ flowCrashCollectionAddress:", flowCrashCollectionAddress);

      // mint tokenId to otherAccount
      await ethCrash.safeMintToken(account1, tokenId);
      await ethCrash.connect(account1).approve(ethBridgeManagerAddress, tokenId);

      // await ethBridgeManager.addChainsToCollection(ethCrashCollectionAddress, ["FLOW"], [flowCrashAddress]);
      // await flowBridgeManager.addChainsToCollection(flowCrashCollectionAddress, ["ETH"], [ethCrashAddress]);

      await ethBridgeManager.connect(account1).sendTokenToBridge(ethCrashCollectionAddress, tokenId, "FLOW", flowCrashAddress, false);
      // expect(await ethCrash.owner()).to.equal(bridgeManagerAddress);

      // // Example values for the message variables
      const nonce = await flowBridgeManager.nonces(flowCrashCollectionAddress, tokenId);
      const takeFee = false;

      // Encode the message
      const abiCoder = new ethers.utils.AbiCoder();
      const message = abiCoder.encode(
        ["address", "address", "address", "uint256", "bool", "uint256"],
        [account1.address, flowBridgeManagerAddress, flowCrashCollectionAddress, tokenId, takeFee, nonce]
      );

      // Hash the message
      const messageHash = ethers.utils.keccak256(message);
      console.log(">>> ~ messageHash:", messageHash);

      // // Sign the message hash
      const signer = await ethers.getSigner(bridgeManagerDeployer.address);
      console.log(">>> ~ signer.address:", signer.address);
      const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));
      console.log(">>> ~ signature:", signature);

      await flowBridgeManager.connect(account1).pullTokenFromBridge(flowCrashCollectionAddress, tokenId, "ETH", ethCrashAddress, signature, takeFee);
    });
  })
});
