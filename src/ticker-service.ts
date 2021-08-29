import { FilterObject } from "./binance.model";
import { Candle, Ticker } from "./shared/ticker.model";
import { emaSignal } from "./ema-signal";
import { sendPrivateTelegramMessage } from "./shared/telegram-api";
const notifier = require("node-notifier");

const APIKEY = process.env.APIKEY;
const APISECRET = process.env.APISECRET;
const REFRESH_INTERVAL = +process.env.REFRESH_INTERVAL;
const SYMBOLS = [
  "BTCUSDT",
  "SNXUSDT",
  "LINKUSDT",
  "MATICUSDT",
  "THETAUSDT",
  "ADAUSDT",
  "RUNEUSDT",
  "DOTUSDT",
  "COMPUSDT",
  "ATOMUSDT",
  "LTCUSDT",
  "FILUSDT",
  "BNBUSDT",
  "AAVEUSDT",
  "ETHUSDT",
  "XRPUSDT",
  "UNIUSDT",
  "SOLUSDT",
  "XLMUSDT",
  "VETUSDT",
  "MKRUSDT",
  "IOTAUSDT",
  "GRTUSDT",
  "MANAUSDT",
  "CRVUSDT",
];
const WEBSOCKET_INTERVALS = ["1h"];

const binance = require("node-binance-api")().options({
  APIKEY: APIKEY,
  APISECRET: APISECRET,
  useServerTime: true, // If you get timestamp errors, synchronize to server time at startup,
  test: false, //test orders
  recvWindow: 60000, // Set a higher recvWindow to increase response timeout
  verbose: true,
  hedgeMode: true,
});

let LAST_UPDATE = {};
let TICKERS = {};

export class TickerService {
  constructor() {
    this.init();
    sendPrivateTelegramMessage(process.env.TELEGRAM_CHAT_ID, `bot started`);
  }

  private async reset(): Promise<void> {
    for (const symbol of SYMBOLS) {
      for (const interval of WEBSOCKET_INTERVALS) {
        LAST_UPDATE[`${symbol}${interval}`] = Date.now();
      }
    }
  }

  private async setTicker(symbol: string, partialTicker: Partial<Ticker>): Promise<void> {
    const isRequired = SYMBOLS.some((s: string) => symbol === s);
    if (isRequired) {
      let ticker = TICKERS[symbol] || {};
      ticker = { ...(ticker || {}), ...partialTicker } as Ticker;
      TICKERS[symbol] = ticker;
    }
  }

  private async refreshTickerData() {
    console.log("refreshing ticker data...");
    const newTickers = await binance.prevDay();
    const tickers = newTickers.filter((ticker) => ticker.symbol.length < 10);

    for (const ticker of tickers) {
      await this.setTicker(ticker.symbol, {
        ...ticker,
        prevClosePrice: +ticker.prevClosePrice,
        lastPrice: +ticker.lastPrice,
        priceChangePercent: +ticker.lastPrice,
        weightedAvgPrice: +ticker.lastPrice,
        priceChange: +ticker.priceChange,
        lastQty: +ticker.lastQty,
        openPrice: +ticker.openPrice,
        lowPrice: +ticker.openPrice,
        highPrice: +ticker.openPrice,
        bidPrice: +ticker.bidPrice,
        bidQty: +ticker.bidQty,
        askPrice: +ticker.askPrice,
        askQty: +ticker.askQty,
        volume: +ticker.volume,
        quoteVolume: +ticker.quoteVolume,
      });
    }
  }

  private async refreshFuturesExchangeInfo() {
    await binance
      .exchangeInfo()
      .then(async (response: any) => {
        let infoObject = {};
        for (let obj of response.symbols) {
          let filters = { status: obj.status } as FilterObject;
          for (let filter of obj.filters) {
            if (filter.filterType == "MIN_NOTIONAL") {
              filters.minNotional = +filter.minNotional;
            } else if (filter.filterType == "PRICE_FILTER") {
              filters.minPrice = +filter.minPrice;
              filters.maxPrice = +filter.maxPrice;
              filters.tickSize = +filter.tickSize;
            } else if (filter.filterType == "LOT_SIZE") {
              filters.stepSize = +filter.stepSize;
              filters.minQty = +filter.minQty;
              filters.maxQty = +filter.maxQty;
            }
          }
          filters.baseAssetPrecision = obj.baseAssetPrecision;
          filters.quoteAssetPrecision = obj.quoteAssetPrecision;
          filters.orderTypes = obj.orderTypes;
          filters.icebergAllowed = obj.icebergAllowed;
          infoObject[obj.symbol] = filters;
          await this.setTicker(obj.symbol, filters);
        }
      })
      .catch(console.log);
  }

  private async handleCandlesUpdate(symbol, interval, chart) {
    if (LAST_UPDATE[`${symbol}${interval}`] + 60000 < Date.now()) {
      LAST_UPDATE[`${symbol}${interval}`] = Date.now();
      let ticker = TICKERS[symbol];
      const ohlc = Object.keys(chart).map((time) => ({
        time: +time,
        open: +chart[time].open,
        high: +chart[time].high,
        low: +chart[time].low,
        close: +chart[time].close,
        volume: +chart[time].volume,
      }));
      if (ohlc.length) {
        const partialTicker = {
          lastPrice: +ohlc[ohlc.length - 1].close,
          candles: {
            ...ticker.candles,
            [`t${interval}`]: ohlc,
          },
        };
        const es = emaSignal(ohlc, ticker);
        const profit = (+ohlc[ohlc.length - 1].close * 100) / es.lastTradePrice;
        ticker = { ...(ticker || {}), ...partialTicker, signal: es.signal } as Ticker;
        if (TICKERS[symbol].signal != es.signal) {
          console.log(symbol, es.signal, profit);
          notifier.notify(`${symbol} ${interval}: ${es.signal}`);
          sendPrivateTelegramMessage(process.env.TELEGRAM_CHAT_ID, `${symbol} ${interval}: ${es.signal}`);
        }

        TICKERS[symbol] = ticker;
      }
    }
  }

  async refreshSubscriptions(interval) {
    for (const symbol of SYMBOLS) {
      const subscriptions = binance.websockets.subscriptions();
      const isCurrentlySubscribed = Object.keys(subscriptions).some((key) => key.toLowerCase().indexOf(symbol.toLowerCase()) > -1);
      if (!isCurrentlySubscribed) {
        binance.websockets.chart(symbol, interval, async (symbol, interval, ohlc) => await this.handleCandlesUpdate(symbol, interval, ohlc));
      }
    }
  }

  async init() {
    await this.reset();
    await this.refreshTickerData();
    await this.refreshFuturesExchangeInfo();
    for (const interval of WEBSOCKET_INTERVALS) {
      await this.refreshSubscriptions(interval);
    }

    setInterval(async () => {
      await this.refreshTickerData();
      await this.refreshFuturesExchangeInfo();
      for (const interval of WEBSOCKET_INTERVALS) {
        await this.refreshSubscriptions(interval);
      }
    }, REFRESH_INTERVAL);
  }
}
