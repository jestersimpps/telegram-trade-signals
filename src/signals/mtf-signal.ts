import { sendPrivateTelegramMessage } from "shared/telegram-api";
import { Candle, Ticker } from "shared/ticker.model";
const Stochastic = require("technicalindicators").Stochastic;

const getMultiTimeFrameSignals = (candles: { [csInterval: string]: Candle[] }) => {
  // stochastics
  let totalK = 0;
  let totalD = 0;
  const intervals = ["t1m", "t3m", "t5m", "t15m", "t30m", "t1h", "t4h"];

  for (const candleInterval of intervals) {
    const ohlc = candles[candleInterval];
    const closePrices = ohlc && ohlc.length ? ohlc.map((c) => +c.close) : [];
    const lowPrices = ohlc && ohlc.length ? ohlc.map((c) => +c.low) : [];
    const highPrices = ohlc && ohlc.length ? ohlc.map((c) => +c.high) : [];

    const period = 14;
    const signalPeriod = 3;

    const input = {
      high: highPrices,
      low: lowPrices,
      close: closePrices,
      period: period,
      signalPeriod: signalPeriod,
    };

    const stoch = Stochastic.calculate(input);

    if (stoch.length) {
      const k = stoch[stoch.length - 1].k;
      const d = stoch[stoch.length - 1].d;
      totalK += k;
      totalD += d;
    } else {
      return null;
    }
  }

  return {
    avgK: totalK / intervals.length,
    avgD: totalD / intervals.length,
  };
};

export const mtfStochSignal = (ticker: Ticker) => {
  const avgStoch = getMultiTimeFrameSignals(ticker.candles);
  if (avgStoch) {
    if (avgStoch.avgK < 5) {
      console.log(ticker.symbol, avgStoch.avgK);
      ticker.lastAlert = Date.now();
    }
    if (avgStoch.avgK > 95) {
      console.log(ticker.symbol, avgStoch.avgK);
      ticker.lastAlert = Date.now();
    }
  }
};
