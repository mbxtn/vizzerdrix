// UI Configuration for card dimensions and layout
export interface UIConfig {
  card: {
    width: number;
    height: number;
    aspectRatio: number;
    magnifyOnHover: boolean;
    magnifyWidth: number;
    autoFitHand?: boolean;
  };
}

// Default UI configuration
export const defaultUIConfig: UIConfig = {
  card: {
    width: 132,
    height: 184,
    aspectRatio: 63 / 88, // ~0.716 (Magic card aspect ratio)
    magnifyOnHover: true,
    magnifyWidth: 360,
    autoFitHand: false,
  },
};

// Helper function to calculate card dimensions based on width
export function getCardDimensions(width: number) {
  return {
    width,
    height: Math.round(width / defaultUIConfig.card.aspectRatio),
  };
}

// Helper function to calculate stack card dimensions based on main card width
export function getStackCardDimensions(mainCardWidth: number) {
  const ratio = 45 / 63; // Original stack card to main card ratio
  const stackWidth = Math.round(mainCardWidth * ratio);
  return {
    width: stackWidth,
    height: Math.round(stackWidth / defaultUIConfig.card.aspectRatio),
  };
}

// Helper function to calculate zone height based on card height
export function getZoneHeight(cardHeight: number): number {
  // Zone height should be card height + padding for header and content spacing
  return cardHeight + 32; // 32px for header + 30px for padding and spacing
}

// CSS variable generator
export function generateCSSVariables(config: UIConfig): string {
  const { card } = config;
  const stackCard = getStackCardDimensions(card.width);
  const zoneHeight = getZoneHeight(card.height);
  
  return `
    :root {
      --card-width: ${card.width}px;
      --card-height: ${card.height}px;
      --stack-card-width: ${stackCard.width}px;
      --stack-card-height: ${stackCard.height}px;
      --zone-height: ${zoneHeight}px;
    }
  `;
}