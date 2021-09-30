const ORDER_SIZE = 0.001;

export const roundNumber = (value: number, precision: number) => +parseFloat((+value || 0).toFixed(precision.toString().length < 2 ? 0 : precision.toString().length - 2));

export const getDefaultOrderQuantity = (totalWalletBalance: number, price: number): number => {
  const amountInQuote = roundNumber((totalWalletBalance * ORDER_SIZE) / price, 0.01);
  return amountInQuote;
};
