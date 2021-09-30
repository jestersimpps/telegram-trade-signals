import { sendPrivateTelegramMessage } from "shared/telegram-api";
import { Candle, Ticker } from "shared/ticker.model";
const Stochastic = require("technicalindicators").Stochastic;
const PSAR = require("technicalindicators").PSAR;

const getMultiTimeFrameSignals = (candles: { [csInterval: string]: Candle[] }) => {
  // stochastics
  let totalK = 0;
  let totalD = 0;
  let psar = null;
  const intervals = ["t1m", "t5m", "t15m", "t30m"];

  for (const candleInterval of intervals) {
    const ohlc = candles[candleInterval];
    const closePrices = ohlc && ohlc.length ? ohlc.map((c) => +c.close) : [];
    const lowPrices = ohlc && ohlc.length ? ohlc.map((c) => +c.low) : [];
    const highPrices = ohlc && ohlc.length ? ohlc.map((c) => +c.high) : [];

    const period = 14;
    const signalPeriod = 3;

    const stochInput = {
      high: highPrices,
      low: lowPrices,
      close: closePrices,
      period: period,
      signalPeriod: signalPeriod,
    };

    const stoch = Stochastic.calculate(stochInput);

    if (stoch.length) {
      const k = stoch[stoch.length - 1].k;
      const d = stoch[stoch.length - 1].d;
      totalK += k;
      totalD += d;
    } else {
      return null;
    }
  }

  if (candles["t1m"]) {
    const ohlc = candles["t5m"];
    const lowPrices = ohlc && ohlc.length ? ohlc.map((c) => +c.low) : [];
    const highPrices = ohlc && ohlc.length ? ohlc.map((c) => +c.high) : [];
    const psarInput = { high: highPrices, low: lowPrices, step: 0.02, max: 2 };
    psar = PSAR.calculate(psarInput);
    const psarSlice = psar.slice(psar.length - 1, psar.length);
    const candleSlice = ohlc.slice(ohlc.length - 1, ohlc.length);
    const below = candleSlice.every((c, i) => psarSlice[i] < c.low);
    const above = candleSlice.every((c, i) => psarSlice[i] > c.high);
    if (below) psar = "BELOW";
    if (above) psar = "ABOVE";
  } else {
    psar = null;
  }

  return {
    avgK: totalK / intervals.length,
    avgD: totalD / intervals.length,
    psar,
  };
};

export const mtfStochSignal = (ticker: Ticker) => {
  const avgStoch = getMultiTimeFrameSignals(ticker.candles);
  if (avgStoch) {
    if (avgStoch.avgK < 5 && avgStoch.psar) {
      console.log("=====>", ticker.symbol, avgStoch.avgK, avgStoch.psar === 'BELOW' ? 'SHORT' : 'WAIT / CLOSE');
      return avgStoch.avgK;
    }
    if (avgStoch.avgK > 95 && avgStoch.psar) {
      console.log("=====>", ticker.symbol, avgStoch.avgK, avgStoch.psar === 'ABOVE' ? 'WAIT / CLOSE' : 'LONG');
      return avgStoch.avgK;
    }
  }
};
