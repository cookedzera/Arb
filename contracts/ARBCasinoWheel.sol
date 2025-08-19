// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ARBCasinoWheel {
    // ---- Wheel Segments ----
    string[8] private wheel = [
        "AIDOGE",
        "BUST",
        "BOOP",
        "BONUS",
        "BOBOTRUM",
        "BUST",
        "AIDOGE",
        "JACKPOT"
    ];

    // ---- Reward Token Addresses ----
    address private constant AIDOGE = 0x287396E90c5febB4dC1EDbc0EEF8e5668cdb08D4;
    address private constant BOOP = 0x0E1CD6557D2BA59C61c75850E674C2AD73253952;
    address private constant BOBOTRUM = 0xaeA5bb4F5b5524dee0E3F931911c8F8df4576E19;

    // ---- Reward Amounts ----
    uint256 private constant REWARD_AIDOGE = 1 ether;
    uint256 private constant REWARD_BOOP = 2 ether;
    uint256 private constant REWARD_BOBOTRUM = 0.5 ether;
    uint256 private constant REWARD_BONUS = 4 ether; // 2x BOOP
    uint256 private constant REWARD_JACKPOT = 10 ether; // 10x AIDOGE

    // ---- Player Stats ----
    struct Player {
        uint256 totalSpins;
        uint256 totalWins;
        uint256 lastSpinDate;
        uint256 dailySpins;
    }

    mapping(address => Player) public playerSpins;
    uint256 private globalTotalSpins;

    // ---- Events ----
    event SpinResult(
        address indexed player,
        string segment,
        bool isWin,
        address tokenAddress,
        uint256 rewardAmount,
        uint256 randomSeed
    );

    constructor() {}

    // ---- Main Spin Function ----
    function spin() external returns (string memory segment, bool isWin, address tokenAddress, uint256 rewardAmount) {
        Player storage p = playerSpins[msg.sender];
        
        // Reset daily spins if new day
        if (block.timestamp - p.lastSpinDate >= 1 days) {
            p.dailySpins = 0;
        }
        
        // Enforce daily spin limit
        require(p.dailySpins < 5, "Daily spin limit reached");
        
        uint256 randomSeed = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    msg.sender,
                    globalTotalSpins,
                    blockhash(block.number - 1)
                )
            )
        );

        uint256 index = randomSeed % wheel.length;
        segment = wheel[index];

        // Default
        isWin = false;
        tokenAddress = address(0);
        rewardAmount = 0;

        // Determine reward
        if (keccak256(bytes(segment)) == keccak256("AIDOGE")) {
            isWin = true;
            tokenAddress = AIDOGE;
            rewardAmount = REWARD_AIDOGE;
        } else if (keccak256(bytes(segment)) == keccak256("BOOP")) {
            isWin = true;
            tokenAddress = BOOP;
            rewardAmount = REWARD_BOOP;
        } else if (keccak256(bytes(segment)) == keccak256("BOBOTRUM")) {
            isWin = true;
            tokenAddress = BOBOTRUM;
            rewardAmount = REWARD_BOBOTRUM;
        } else if (keccak256(bytes(segment)) == keccak256("BONUS")) {
            isWin = true;
            tokenAddress = BOOP;
            rewardAmount = REWARD_BONUS;
        } else if (keccak256(bytes(segment)) == keccak256("JACKPOT")) {
            isWin = true;
            tokenAddress = AIDOGE;
            rewardAmount = REWARD_JACKPOT;
        }

        // Update stats
        p.totalSpins += 1;
        globalTotalSpins += 1;
        p.dailySpins += 1;
        p.lastSpinDate = block.timestamp;

        if (isWin) {
            p.totalWins += 1;
        }

        emit SpinResult(msg.sender, segment, isWin, tokenAddress, rewardAmount, randomSeed);
    }

    // ---- Player Stats View ----
    function getPlayerStats(address player) external view returns (
        uint256 totalSpins_,
        uint256 totalWins_,
        uint256 lastSpinDate_,
        uint256 dailySpins_
    ) {
        Player memory p = playerSpins[player];
        return (p.totalSpins, p.totalWins, p.lastSpinDate, p.dailySpins);
    }

    // ---- Global Stats ----
    function totalSpins() external view returns (uint256) {
        return globalTotalSpins;
    }
}