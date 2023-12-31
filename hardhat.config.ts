import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
const config: HardhatUserConfig = {
  solidity: "0.8.9",
  defaultNetwork: "localhost",
   networks: {
      hardhat: {},
   }
};

export default config;