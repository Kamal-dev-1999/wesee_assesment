const { ethers } = require("hardhat");

async function main() {
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const fee = await ethers.provider.getFeeData(); // use network defaults
  const c = await MockUSDT.deploy({
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
    maxFeePerGas: fee.maxFeePerGas
  });
  console.log("tx:", c.deploymentTransaction().hash);
  await c.waitForDeployment();
  console.log("MockUSDT:", await c.getAddress());
}

main().then(()=>process.exit(0)).catch((e)=>{console.error(e);process.exit(1);});