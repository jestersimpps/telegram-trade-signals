import { sendPrivateTelegramMessage } from "shared/telegram-api";
import { Candle, Ticker } from "shared/ticker.model";

const EMA = require("technicalindicators").EMA;

const getNthlastElement = (array: number[], last: number) => {
  return array.length > last ? array[array.length - last] : null;
};

export const emaSignal = (ticker: Ticker) => {
  const ohlc = ticker.candles["t4h"];

  if (ohlc && ohlc.length) {
    const closePrices = ohlc && ohlc.length ? ohlc.map((c) => +c.close) : [];

    const ema8 = EMA.calculate({ period: 8, values: closePrices });
    const ema13 = EMA.calculate({ period: 13, values: closePrices });
    const ema21 = EMA.calculate({ period: 21, values: closePrices });
    const ema55 = EMA.calculate({ period: 55, values: closePrices });

    let signal = "LONG";

    if (
      getNthlastElement(ema8, 2) < getNthlastElement(ema8, 3) &&
      getNthlastElement(ema13, 2) < getNthlastElement(ema13, 3) &&
      getNthlastElement(ema21, 2) < getNthlastElement(ema21, 3) &&
      getNthlastElement(ema55, 2) < getNthlastElement(ema55, 3)
    ) {
      signal = "SHORT";
    }
    if (
      getNthlastElement(ema8, 2) > getNthlastElement(ema8, 3) &&
      getNthlastElement(ema13, 2) > getNthlastElement(ema13, 3) &&
      getNthlastElement(ema21, 2) > getNthlastElement(ema21, 3) &&
      getNthlastElement(ema55, 2) > getNthlastElement(ema55, 3)
    ) {
      signal = "LONG";
    }

    if (ticker.signal != signal) {
      const msg = `${ticker.symbol}: EMA SIGNAL => ${signal}`;
      console.log(msg);
      if (ticker.signal) sendPrivateTelegramMessage(process.env.TELEGRAM_CHAT_ID, msg);
    }

    ticker = { ...ticker, signal: signal };
  }
};
