import { mtfStochSignal } from './../signals/mtf-signal';
export interface Ticker {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  weightedAvgPrice: number;
  prevClosePrice: number;
  lastPrice: number;
  lastQty: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
  status: "TRADING" | null;
  minPrice: number;
  maxPrice: number;
  tickSize: number;
  stepSize: number;
  minQty: number;
  minNotional: number;
  maxQty: number;
  baseAssetPrecision: number;
  orderTypes: string[];
  signal: string;
  lastTradePrice: number;
  mtfStochSignal?: number;
  candles?: {
    [csInterval: string]: Candle[];
  };
}

export interface MtfStoch {
  allK: number;
  allD: number;
  shortK: number;
  shortD: number;
  mediumK: number;
  mediumD: number;
  longK: number;
  longD: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export enum Side {
  SELL = "SELL",
  BUY = "BUY",
  BOTH = "BOTH",
}
export interface SignalDto {
  side: Side;
  name: Signal;
}
export interface ContinuationPatternDto {
  side: Side;
  name: ContinuationPattern;
}
export enum Signal {
  MACD_CROSSOVER = "MACD crossover",
  MACD_CROSSUNDER = "MACD crossunder",
  RSI_BOTTOM = "RSI bottom",
  RSI_TOP = "RSI top",
  SMA_CROSSOVER = "SMA crossover",
  SMA_CROSSUNDER = "SMA crossunder",
  SHOOTING_STAR = "Shooting star",
  HAMMER = "Hammer",
  INVERTED_HAMMER = "Inverted hammer",
  HANGING_MAN = "Hanging man",
  BULLISH_ENGULFING = "Bullish engulfing",
  BEARISH_ENGULFING = "Bearish engulfing",
  MORNING_STAR = "Morning star",
  EVENING_STAR = "Evening star",
  THREE_WHITE_SOLDIERS = "Three white soldiers",
  THREE_BLACK_COWS = "Three black cows",
}

export enum ContinuationPattern {
  ASCENDING_TRIANGLE = "Ascending Triangle",
  DESCENDING_TRIANGLE = "Descending Triangle",
  TRIANGLE = "Triangle",
  BULL_PENNANT = "Bull Pennant",
  BULL_FLAG = "Bull Flag",
  RISING_WEDGE = "Rising Wedge",
  FALLING_WEDGE = "Falling wedge",
  DESCENDING_BROADENING_WEDGE = "Descending Broadening Wedge",
  ASCENDING_BROADENING_WEDGE = "Ascending Broadening wedge",
  DESCENDING_CHANNEL = "Descending Channel",
  ASCENDING_CHANNEL = "Ascending Channel",
}

export interface FilterObject {
  minNotional: number;
  minPrice: number;
  maxPrice: number;
  tickSize: number;
  stepSize: number;
  minQty: number;
  maxQty: number;
  baseAssetPrecision: any;
  quoteAssetPrecision: any;
  orderTypes: string[];
  icebergAllowed: any;
  status: "TRADING" | null;
}

export interface LinesObject {
  timeFrame: string;
  supportLines: Point[][];
  resistanceLines: Point[][];
  ohlc?: Candle[];
}
export interface Point {
  x: number;
  y: number;
}
export interface ChartLines {
  resistanceLine: Point[];
  supportLine: Point[];
  currentPriceline?: Point[];
  ohlcSpline?: number[][];
}
export interface PriceSlopesObject {
  timeFrame: string;
  supportPrices: number[];
  supportSlopes: number[];
  resistancePrices: number[];
  resistanceSlopes: number[];
}

export interface Depth {
  symbol: string;
  bids: Partial<DepthLine>;
  asks: Partial<DepthLine>;
}

export interface DepthLine {
  [key: string]: string;
}
