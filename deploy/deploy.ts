import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Demo / test token with an open faucet. For a real deployment pass an existing ERC-7984
  // token address (for example a confidential wrapper) to VeilTender instead.
  const token = await deploy("ConfidentialUSD", { from: deployer, log: true });
  const tender = await deploy("VeilTender", { from: deployer, args: [token.address], log: true });

  console.log(`ConfidentialUSD: ${token.address}`);
  console.log(`VeilTender:      ${tender.address}`);
};
export default func;
func.id = "deploy_veil_tender";
func.tags = ["VeilTender"];
