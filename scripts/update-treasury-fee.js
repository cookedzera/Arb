const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 Updating treasury fee to 0% on deployed contract...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);
  
  // Contract address from your system
  const CONTRACT_ADDRESS = "0x48a5bde3aa0743a80f055ef2289a903e972f2368";
  
  // Get contract instance
  const SpinAutoTransferContract = await ethers.getContractFactory("SpinAutoTransferContract");
  const contract = SpinAutoTransferContract.attach(CONTRACT_ADDRESS);
  
  // Get current treasury address
  const currentTreasury = await contract.treasury();
  const currentFeePercent = await contract.treasuryFeePercent();
  
  console.log("📋 Current Configuration:");
  console.log("   Treasury Address:", currentTreasury);
  console.log("   Treasury Fee:", currentFeePercent.toString() + "%");
  
  if (currentFeePercent === 0n) {
    console.log("✅ Treasury fee is already 0% - no changes needed!");
    return;
  }
  
  try {
    // Update treasury fee to 0% while keeping the same treasury address
    console.log("🚀 Setting treasury fee to 0%...");
    const tx = await contract.setTreasury(currentTreasury, 0);
    
    console.log("⏳ Transaction submitted:", tx.hash);
    await tx.wait();
    
    // Verify the change
    const newFeePercent = await contract.treasuryFeePercent();
    console.log("✅ Treasury fee updated to:", newFeePercent.toString() + "%");
    console.log("🎉 Success! 100% of spin rewards will now go to winners!");
    
  } catch (error) {
    console.error("❌ Failed to update treasury fee:");
    
    if (error.message.includes("TREASURY_ROLE")) {
      console.error("   → Account doesn't have TREASURY_ROLE permission");
      console.error("   → Only the treasury address can call this function");
    } else if (error.message.includes("Same treasury address")) {
      console.error("   → Need to use a different treasury address");
    } else {
      console.error("   →", error.message);
    }
    
    console.log("\n💡 Alternative solutions:");
    console.log("   1. Call from the treasury address account");
    console.log("   2. Use the contract owner account");
    console.log("   3. Redeploy the contract with 0% fee");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });