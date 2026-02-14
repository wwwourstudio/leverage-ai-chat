/**
 * Sharp Money Detector
 * Detects reverse line movement indicating sharp money
 */

export interface LineSnapshot {
  timestamp: number;
  price: number;
  volume?: number;
}

export interface SharpSignal {
  direction: "up" | "down";
  confidence: number;
  reason: string;
}

/**
 * Detect sharp money through reverse line movement analysis
 * @param publicBetPercentage - Percentage of public bets (0-100)
 * @param lineHistory - Historical line snapshots
 * @returns Sharp signal or null if no signal detected
 */
export function detectSharpMoney(
  publicBetPercentage: number,
  lineHistory: LineSnapshot[]
): SharpSignal | null {
  // Require at least 2 snapshots
  if (lineHistory.length < 2) {
    return null;
  }

  // Sort by timestamp to ensure chronological order
  const sortedHistory = [...lineHistory].sort((a, b) => a.timestamp - b.timestamp);
  
  const firstPrice = sortedHistory[0].price;
  const lastPrice = sortedHistory[sortedHistory.length - 1].price;
  
  const priceMovement = lastPrice - firstPrice;
  const percentChange = Math.abs((priceMovement / firstPrice) * 100);
  
  // Time elapsed (for speed calculation)
  const timeElapsed = sortedHistory[sortedHistory.length - 1].timestamp - sortedHistory[0].timestamp;
  const hoursElapsed = timeElapsed / (1000 * 60 * 60); // Convert ms to hours
  
  // Reverse line movement detection
  // Public heavy on one side (>70%) but line moves against them
  if (publicBetPercentage > 70 && priceMovement < 0) {
    // Public is betting heavily, but line is moving down (sharp on other side)
    const magnitude = Math.abs(priceMovement);
    const speedFactor = hoursElapsed > 0 ? magnitude / hoursElapsed : magnitude;
    
    // Calculate confidence based on magnitude and speed
    let confidence = Math.min(
      (percentChange / 10) * 0.5 + // Magnitude contribution (max 0.5)
      Math.min(speedFactor / 5, 0.5), // Speed contribution (max 0.5)
      1.0
    );
    
    // Boost confidence for extreme public percentages
    if (publicBetPercentage > 80) {
      confidence = Math.min(confidence * 1.2, 1.0);
    }
    
    return {
      direction: "down",
      confidence: Math.max(0.1, confidence), // Minimum 0.1
      reason: `Public betting ${publicBetPercentage.toFixed(1)}% but line moved down ${percentChange.toFixed(2)}% - sharp money detected on opposite side`,
    };
  }
  
  // Public light on one side (<30%) but line moves with them
  if (publicBetPercentage < 30 && priceMovement > 0) {
    // Public is barely betting, but line is moving up (sharp pushing it up)
    const magnitude = Math.abs(priceMovement);
    const speedFactor = hoursElapsed > 0 ? magnitude / hoursElapsed : magnitude;
    
    let confidence = Math.min(
      (percentChange / 10) * 0.5 +
      Math.min(speedFactor / 5, 0.5),
      1.0
    );
    
    // Boost confidence for extreme public percentages
    if (publicBetPercentage < 20) {
      confidence = Math.min(confidence * 1.2, 1.0);
    }
    
    return {
      direction: "up",
      confidence: Math.max(0.1, confidence),
      reason: `Only ${publicBetPercentage.toFixed(1)}% public betting but line moved up ${percentChange.toFixed(2)}% - sharp money pushing line`,
    };
  }
  
  return null;
}
