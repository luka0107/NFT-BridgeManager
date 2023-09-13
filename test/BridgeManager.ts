import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

/*
- chain1_bridgeManager.connect(chain1_sender).sendTokenToBridge(
    chain1_bridgeManager.findCollction(chain1_collection.name),
    tokenId,
    takeFee
  )

- chain2_registered_collection = chain2_bridgeManager.findCollection(chain1_collection.name)

- signature = bridgeDeployer.sign(
  chain1_sender,
  chain2_bridgeManager,
  chain2_registered_collection,
  tokenId,
  takeFee,
  nonces[chain2_registered_collection][tokenId]
)

- chain2_bridgeManager.connect(chain1_sender).pullTokenFromBridge(
  chain2_registered_collection,
  tokenId,
  signature,
  takeFee
)
*/
describe("BridgeManager", function () {

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployBridgeManagerFixture() {
    // Contracts are deployed using the first signer/account by default
    const [bridgeManagerDeployer, account1] = await ethers.getSigners();

    const BridgeManager = await ethers.getContractFactory("BridgeManager");

    const chain1_bridgeManager = await BridgeManager.deploy();
    const chain1_bridgeManagerAddress = chain1_bridgeManager.address;
    const chain2_bridgeManager = await BridgeManager.deploy();
    const chain2_bridgeManagerAddress = chain2_bridgeManager.address;

    console.log(">>> ~ bridgeManagerDeployer.address:", bridgeManagerDeployer.address);
    console.log(">>> ~ chain1_bridgeManagerAddress:", chain1_bridgeManagerAddress);
    console.log(">>> ~ chain2_bridgeManagerAddress:", chain2_bridgeManagerAddress);
    console.log(">>> ~ account1.address:", account1.address);

    return {
      chain1_bridgeManager,
      chain1_bridgeManagerAddress,
      bridgeManagerDeployer,
      chain2_bridgeManager,
      chain2_bridgeManagerAddress,
      account1
    };
  }

  async function deployCrashFixture() {
    const Crash = await ethers.getContractFactory("Crash");
    const chain1_collection = await Crash.deploy();
    const chain2_collection = await Crash.deploy();
    const chain1_collectionAddress = chain1_collection.address;
    const chain2_collectionAddress = chain2_collection.address;
    console.log(">>> ~ chain1_collectionAddress:", chain1_collectionAddress);
    console.log(">>> ~ chain2_collectionAddress:", chain2_collectionAddress);

    return {
      chain1_collection,
      chain1_collectionAddress,
      chain2_collection,
      chain2_collectionAddress,
    };
  }

  describe("Bridge", function () {
    it("Bridge between two different networks", async function () {
      const {
        chain1_collection,
        chain1_collectionAddress,
        chain2_collection,
        chain2_collectionAddress,
      } = await loadFixture(deployCrashFixture);
      const {
        chain1_bridgeManager,
        chain1_bridgeManagerAddress,
        bridgeManagerDeployer,
        chain2_bridgeManager,
        chain2_bridgeManagerAddress,
        account1
      } = await loadFixture(deployBridgeManagerFixture);

      const tokenId = 2;

      await chain1_bridgeManager.mintCollection("Crash", "CRASH", "baseURI", "ETH", chain1_collectionAddress);
      await chain2_bridgeManager.mintCollection("Crash", "CRASH", "baseURI", "FLOW", chain2_collectionAddress);
      const chain1_registered_collectionAddress = (await chain1_bridgeManager.getCollections())[0];
      const chain2_registered_collectionAddress = (await chain2_bridgeManager.getCollections())[0];
      console.log(">>> ~ chain1_registered_collectionAddress:", chain1_registered_collectionAddress);
      console.log(">>> ~ chain2_registered_collectionAddress:", chain2_registered_collectionAddress);

      // mint tokenId to otherAccount
      await chain1_collection.safeMintToken(account1.address, tokenId);
      await chain1_collection.connect(account1).approve(chain1_bridgeManagerAddress, tokenId);

      await chain2_collection.safeMintToken(chain2_bridgeManagerAddress, tokenId);

      // await ethBridgeManager.addChainsToCollection(ethCrashCollectionAddress, ["FLOW"], [flowCrashAddress]);
      // await flowBridgeManager.addChainsToCollection(flowCrashCollectionAddress, ["ETH"], [ethCrashAddress]);

      await chain1_bridgeManager.connect(account1).sendTokenToBridge(
        chain1_registered_collectionAddress,
        tokenId,
        "chain2",
        chain2_collectionAddress,
        false
      );
      // expect(await ethCrash.owner()).to.equal(bridgeManagerAddress);

      // // Example values for the message variables
      const nonce = await chain2_bridgeManager.nonces(chain2_registered_collectionAddress, tokenId);
      const takeFee = false;

      // Encode the message
      const abiCoder = new ethers.utils.AbiCoder();
      const message = abiCoder.encode(
        ["address", "address", "address", "uint256", "bool", "uint256"],
        [account1.address, chain2_bridgeManagerAddress, chain2_registered_collectionAddress, tokenId, takeFee, nonce]
      );

      // Hash the message
      const messageHash = ethers.utils.keccak256(message);
      console.log(">>> ~ messageHash:", messageHash);

      // // Sign the message hash
      const signer = await ethers.getSigner(bridgeManagerDeployer.address);
      console.log(">>> ~ signer.address:", signer.address);
      const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));
      console.log(">>> ~ signature:", signature);

      await chain2_bridgeManager.connect(account1).pullTokenFromBridge(
        chain2_registered_collectionAddress,
        tokenId,
        "chain1",
        chain1_collectionAddress,
        signature,
        takeFee
      );
    });
  })
});
