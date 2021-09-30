import { mtfStochSignal } from "./signals/mtf-signal";
import { FilterObject } from "./binance.model";
import { Candle, Ticker } from "./shared/ticker.model";
import { emaSignal } from "./signals/ema-signal";
import { sendPrivateTelegramMessage } from "./shared/telegram-api";
import { getDefaultOrderQuantity, roundNumber } from "./shared/util";
import { AccountInfo } from "./shared/binance.model";

const APIKEY = process.env.APIKEY;
const APISECRET = process.env.APISECRET;
const REFRESH_INTERVAL = +process.env.REFRESH_INTERVAL;
const SYMBOLS = [];
let EXCHANGEINFO = {};
let ACCOUNT = {} as AccountInfo;
const WEBSOCKET_INTERVALS = ["1m","5m", "15m", "30m", "1h", "4h"];

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
    // sendPrivateTelegramMessage(process.env.TELEGRAM_CHAT_ID, `bot started`);
  }

  private async refreshAccountData() {
    ACCOUNT = await binance.futuresAccount().catch(console.log);
  }

  getQuantityString = (symbol: string, quantity: number): string => roundNumber(quantity, +EXCHANGEINFO[symbol].stepSize).toString();

  defaultAmount = (symbol) => {
    return this.getQuantityString(symbol, getDefaultOrderQuantity(+ACCOUNT.totalWalletBalance, +TICKERS[symbol].lastPrice));
  };

  async marketBuy(symbol, amount?: number): Promise<{ orderId: string }> {
    const defaultAmount = this.defaultAmount(symbol);
    const buy = await binance.futuresMarketBuy(symbol, this.getQuantityString(symbol, Math.abs(amount)) || defaultAmount);
    console.info(buy);
    return buy;
  }

  async marketSell(symbol, amount?: number): Promise<{ orderId: string; avgPrice: string }> {
    const defaultAmount = this.defaultAmount(symbol);
    const sell = await binance.futuresMarketSell(symbol, this.getQuantityString(symbol, Math.abs(amount)) || defaultAmount);
    console.info(sell);
    return sell;
  }

  private async setTicker(symbol: string, partialTicker: Partial<Ticker>): Promise<void> {
    let isRequired = true;
    if (SYMBOLS.length) {
      isRequired = SYMBOLS.some((s: string) => symbol === s);
    }
    if (isRequired) {
      let ticker = TICKERS[symbol] || {};
      ticker = { ...(ticker || {}), ...partialTicker } as Ticker;
      TICKERS[symbol] = ticker;
    }
  }

  private async refreshTickerData() {
    const newTickers = await binance.prevDay();

    const tickers = newTickers
      .filter((ticker) => ticker.symbol.length < 10)
      .filter((ticker) => ticker.symbol.endsWith("USDT"))
      .filter((ticker) => ticker.symbol !== "BUSDUSDT")
      .filter((ticker) => ticker.symbol !== "USDCUSDT")
      .sort((a, b) => +b.quoteVolume - +a.quoteVolume)
      .filter((a, i) => i < 30);

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
          if (Object.keys(TICKERS).indexOf(obj.symbol) > -1) await this.setTicker(obj.symbol, filters);
        }
        EXCHANGEINFO = infoObject;
      })
      .catch(console.log);
  }

  private async handleCandlesUpdate(symbol, interval, chart) {
    if (LAST_UPDATE[`${symbol}${interval}`] + +process.env.ALERT_INTERVAL < Date.now()) {
      LAST_UPDATE[`${symbol}${interval}`] = Date.now();
      let ticker: Ticker = TICKERS[symbol];
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

        ticker = { ...ticker, ...partialTicker };
        // ADD signals here
        // emaSignal(ticker);
        mtfStochSignal(ticker);

        TICKERS[symbol] = ticker;
      }
    }
  }

  async refreshSubscriptions(interval) {
    for (const symbol of Object.keys(TICKERS)) {
      const subscriptions = binance.futuresSubscriptions();
      const isCurrentlySubscribed = Object.keys(subscriptions).some((key) => key.toLowerCase().indexOf(symbol.toLowerCase()) > -1);
      if (!isCurrentlySubscribed) {
        binance.futuresChart(symbol, interval, async (symbol, interval, ohlc) => await this.handleCandlesUpdate(symbol, interval, ohlc));
        LAST_UPDATE[`${symbol}${interval}`] = Date.now();
      }
    }
  }

  async init() {
    // await this.refreshAccountData();
    await this.refreshTickerData();
    await this.refreshFuturesExchangeInfo();
    for (const interval of WEBSOCKET_INTERVALS) {
      await this.refreshSubscriptions(interval);
    }

    setInterval(async () => {
      // await this.refreshAccountData();
      await this.refreshTickerData();
      await this.refreshFuturesExchangeInfo();
      for (const interval of WEBSOCKET_INTERVALS) {
        await this.refreshSubscriptions(interval);
      }
    }, REFRESH_INTERVAL);
  }
}
