// MANUAL CONTRACT DEBUG SCRIPT
// Run this in browser console to test contracts directly

async function debugContracts() {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const address = await signer.getAddress();
    
    console.error("🔍 MANUAL CONTRACT DEBUG");
    console.error("Address:", address);
    
    // Test router contract
    const routerAddress = "0x695e5db4906b184dF670c271db31374DB3e8308B";
    const routerABI = ["function factory() external pure returns (address)", "function WETH() external pure returns (address)"];
    const router = new ethers.Contract(routerAddress, routerABI, signer);
    
    try {
        const factory = await router.factory();
        const weth = await router.WETH();
        console.error("✅ Router factory:", factory);
        console.error("✅ Router WETH:", weth);
    } catch (e) {
        console.error("❌ Router failed:", e.message);
    }
    
    // Test token contract
    const tokenAddress = "0x1f934cc104685147b953b15357ad5e2475f5BfCF";
    const tokenABI = ["function symbol() view returns (string)", "function decimals() view returns (uint8)", "function balanceOf(address) view returns (uint256)"];
    const token = new ethers.Contract(tokenAddress, tokenABI, signer);
    
    try {
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        const balance = await token.balanceOf(address);
        console.error("✅ Token symbol:", symbol);
        console.error("✅ Token decimals:", decimals);
        console.error("✅ Token balance:", ethers.utils.formatUnits(balance, decimals));
    } catch (e) {
        console.error("❌ Token failed:", e.message);
    }
    
    console.error("🔍 Debug complete");
}

// Call the function
debugContracts();