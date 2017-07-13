import crypto from 'crypto';
import querystring from 'querystring';

import request from './helpers/request';

/**
 * Kraken encapsulates the methods for varios API wrapper objects
 */
class Kraken {
  /**
   * Create a new Kraken
   * @param {string} [apiKey] - The API key to authenticate to Kraken. If the API
   *                                                key is not provided request will be made to the
   *                                                public endpoints only.
   * @param {string} [apiBase=api.kraken.com] - The base Kraken API URL
   */
  constructor(apiKey = null, apiSecret = null, apiBase = 'api.kraken.com', apiProtocol = 'https', apiVersion = 0, apiOTP = null) {
    this.__apiKey = apiKey;
    this.__apiSecret = apiSecret;
    this.__apiBase = apiBase;
    this.__apiProtocol = apiProtocol;
    this.__apiVersion = apiVersion;
    this.__apiOTP = apiOTP;
  }

  doRequest(type, endPoint, params = {}) {
    return new Promise((resolve, reject) => {
      let path = `/${this.__apiVersion}`;
      let signature = '';
      let headers = {};
      let method = 'GET';
      let paramsSet = params; // eslint-disable-line prefer-const

      headers = {
        'User-Agent': 'Kraken Wrapper Node API Client'
      };

      if (type === 'private') {
        if (!this.__apiKey || !this.__apiSecret) {
          resolve({ error: 'You must configure the API KEY and SECRET to make this request' });
        }
        path = `${path}/private/${endPoint}`;
        method = 'POST';

        const nonce = new Date() * 1000;

        paramsSet.nonce = nonce;

        signature = this.createSignature(path, paramsSet, nonce);

        headers = {
          'API-Key': this.__apiKey,
          'API-Sign': signature,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': querystring.stringify(paramsSet).length
        };
      } else {
        path = `${path}/public/${endPoint}`;
      }

      const options = {
        hostname: this.__apiBase,
        port: 443,
        path,
        method,
        headers,
        timeout: 4000
      };

      request(options, paramsSet).then((response) => {
        if (response.error && response.error.length > 0) { // The api is returning an error
          resolve(response);
        } else {
          resolve(response);
        }
      }).catch(error => reject(error));
    });
  }


  createSignature(path, params, nonce) {
    const paramsString = querystring.stringify(params);
    const secret = new Buffer(this.__apiSecret, 'base64');
    const hash = new crypto.createHash('sha256'); // eslint-disable-line new-cap
    const hmac = new crypto.createHmac('sha512', secret); // eslint-disable-line new-cap

    const hashDigest = hash.update(nonce + paramsString).digest('binary');
    const signature = hmac.update(path + hashDigest, 'binary').digest('base64');

    return signature;
  }

  /**
   * Returns a json object with the unix and rfc 1123 time
   * of the Kraken servers
   * This is to aid in approximating the skew time between the server and client.
   * @return {Object}  - JSON Object { unixtime: 1497805936,
   *                                                      rfc1123: 'Sun, 18 Jun 17 17:12:16 +0000' }
   */
  getTime() {
    return new Promise((resolve, reject) => {
      this.doRequest('public', 'Time').then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Returns a json object with a list of the assets available on kraken
   *
   * @param {string} [assets] - comma delimited list of assets to get
   *                                              info on for given asset class (optional).
   *                                              default = null
   * @return {Object}  - JSON Object -
   * { XETH: { aclass: 'currency', altname: 'ETH', decimals: 10,  display_decimals: 5 } }
   *
   */
  getAssetInfo(assets = null) {
    return new Promise((resolve, reject) => {
      let params = {};
      if (assets && assets !== 'all') {
        if (typeof assets !== 'string') {
          reject('Assets option must be a string, could be all for all assets or a comma separated values such as ETH,XRP');
        }
        // Remove any whitespace
        const assetsValidated = assets.replace(/\s/g, '');
        params = { asset: assetsValidated };
      }

      this.doRequest('public', 'Assets', params).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get tradable asset pairs
   * Returns an array of pair names and their info
   *
   * @param {object} [inputs] - { info: 'all' // (default = all)  leverage, fees, margin (required)
   *                                                   pair: 'all' // (default = all), comma
   *                                                   delimited list of asset pairs
   *                                                 }
   * @return {Object}  - JSON Object -
   * "DASHUSD": {"altname": "DASHUSD","aclass_base": "currency", "base": "DASH", "quote": "ZUSD",
   *                         "lot": "unit","pair_decimals": 5, "lot_decimals": 8,
   *                         "lot_multiplier": 1, "leverage_buy": [],
   *                         "leverage_sell": [],"fees": [...], "fees_maker": [..],
   *                         "fee_volume_currency": "ZUSD",  "margin_call": 80,"margin_stop": 40}
   *
   */
  getTradableAssetPairs(params) {
    return new Promise((resolve, reject) => {
      const infoEnum = ['all', 'leverage', 'fees', 'margin'];
      const paramsSet = {};

      if (params) {
        // Check if params.info is valid
        if (params.info) {
          if (typeof params.info === 'string' && infoEnum.indexOf(params.info) >= 0) {
            if (params.info !== 'all') { // although all is in the documentation of the Kraken API this value produces an error if used
              paramsSet.info = params.info;
            }
          } else {
            reject('Option info must be a string, could be all, leverage, fees or margin');
          }
        }

        // Check if params.pair is valid
        if (params.pair && typeof params.pair === 'string') {
          const pair = params.pair.replace(/\s/g, ''); // Remove any whitespace
          if (params.pair !== 'all') { // although all is in the documentation of the Kraken API this value produces an error if used
            paramsSet.pair = pair;
          }
        } else {
          reject('pair option must be a string, could be all for all assets or a comma separated values such as ETHUSD,XRPUSD');
        }
      }

      this.doRequest('public', 'AssetPairs', paramsSet).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }


  /**
   * Get ticker information
   * Returns an array of pair names and their ticker info
   *
   * @param {string} [pair] - comma delimited list of asset pairs to get info on
   * @return {Object}  - JSON Object -
   * "XETHZUSD": {"a": ["349.28068","1","1.000"], "b": ["346.75998","4","4.000"],
   * "c": ["348.14094","0.01400000"],"v": ["487.87279670","72199.49047653"],
   * "p": ["348.24177","348.24025"],"t": [421,21937],
   * "l": ["345.00000","306.99981"],"h": ["351.49000","365.98700"],"o": "348.49998"}
   *
   */
  getTickerInformation(pair = null) {
    return new Promise((resolve, reject) => {
      const params = {};

      if (pair && pair !== 'all') {
        if (typeof pair !== 'string') {
          reject('Pair option must be a string, could be all for all pair or a comma separated values such as ETHUSD,XRPUSD');
        }
        // Remove any whitespace
        const pairValidated = pair.replace(/\s/g, '');
        params.pair = pairValidated;
      }

      this.doRequest('public', 'Ticker', params).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get OCHL data
   * Returns an array of pair names and their ticker info
   *
   * @param {object} [params] - { pair: '' // required, asset pair to get OHLC data for
   *                                                   interval: 1 // (default = 1), time frame
   *                                                   interval in minutes, could be 1 (default),
   *                                                   5, 15, 30, 60, 240, 1440, 10080, 21600
   *                                                   since: return committed OHLC data
   *                                                   since given id
   *                                                 }
   * @return {Object}  - JSON Object -
   * "XETHZUSD": {"a": ["349.28068","1","1.000"], "b": ["346.75998","4","4.000"],
   * "c": ["348.14094","0.01400000"],"v": ["487.87279670","72199.49047653"],
   * "p": ["348.24177","348.24025"],"t": [421,21937],
   * "l": ["345.00000","306.99981"],"h": ["351.49000","365.98700"],"o": "348.49998"}
   *
   */
  getOHLC(params = { pair: null, interval: 1, since: null }) {
    return new Promise((resolve, reject) => {
      const intervalEnum = [1, 5, 15, 30, 60, 240, 1440, 10080, 21600];
      const paramsValidated = params;

      if (!params || !params.pair) {
        reject("You must at least indicate the trading pair getOCHL({pair: 'tradingpair'})");
      }

      if (params.pair) {
        if (typeof params.pair !== 'string') {
          reject('Pair option must be a string, could be all for all pair or a comma separated values such as ETHUSD,XRPUSD');
        }
        // Remove any whitespace
        const pair = params.pair.replace(/\s/g, '');
        paramsValidated.pair = pair;
      }

      if (params.interval) {
        if (typeof params.interval !== 'number' || intervalEnum.indexOf(params.interval) < 0) {
          reject('Interval option must be a integer, and one of this intervals values 1 (default), 5, 15, 30, 60, 240, 1440, 10080, 21600');
        }
      }

      if (params.since) {
        if (typeof params.since !== 'number') {
          reject('Since option must be a unix time, for example 1495864800');
        }
      }

      this.doRequest('public', 'OHLC', paramsValidated).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get order book
   * Returns an array of pair name and market depth
   *
   * @param {object} [params] - { pair: '' // required, asset pair to get market depth for
   *                                                   count: maximum number of asks/bids (optional)
   *                                                 }
   * @return {Object}  - JSON Object -
   * { XLTCXXBT: { asks:  [ [Array], [Array], ... ], bids: [ [Array], [Array], ...  ] } }
   * asks = ask side array of array entries(<price>, <volume>, <timestamp>)
  *  bids = bid side array of array entries(<price>, <volume>, <timestamp>)
   *
   */
  getOrderBook(params = { pair: null, count: null }) {
    return new Promise((resolve, reject) => {
      const paramsValidated = params;

      if (!params || !params.pair) {
        reject("You must at least indicate the trading pair getOrderBook({pair: 'tradingpair'})");
      }

      if (params.pair) {
        if (typeof params.pair !== 'string') {
          reject('Pair option must be a string, could be all for all pair or a comma separated values such as ETHUSD,XRPUSD');
        }
        // Remove any whitespace
        paramsValidated.pair = params.pair.replace(/\s/g, '');
      }

      if (params.count) {
        if (typeof params.count !== 'number') {
          reject('Count option must be a integer');
        }
      }

      this.doRequest('public', 'Depth', paramsValidated).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get recent trades
   * Returns an array of pair name and recent trade data
   *
   * @param {object} [params] - { pair: '' // required, asset pair to get trade data for
   *                                                 since: '' // return trade data since given id
   *                                                 (optional.  exclusive)
   *                                                 }
   * @return {Object}  - JSON Object -
   * { XLTCXXBT: [ [ '0.01659800', '7.18559300', 1498314525.2248, 's', 'l', '' ], .... ],
   * last: 1498339561  }
   *  <pair_name> = pair name
   *   array of array entries
   *   (<price>, <volume>, <time>, <buy/sell>, <market/limit>, <miscellaneous>)
   *   last = id to be used as since when polling for new trade data
   *
   */
  getTrades(params = { pair: null, since: null }) {
    return new Promise((resolve, reject) => {
      const paramsValidated = params;
      if (!params || !params.pair) {
        reject("You must at least indicate the trading pair getTrades({pair: 'tradingpair'})");
      }

      if (params.pair) {
        if (typeof params.pair !== 'string') {
          reject('Pair option must be a string, could be all for all pair or a comma separated values such as ETHUSD,XRPUSD');
        }
        // Remove any whitespace
        paramsValidated.pair = params.pair.replace(/\s/g, '');
      }

      if (params.since) {
        if (typeof params.since !== 'number') {
          reject('Since option must be a unix timestamp');
        }
      }

      this.doRequest('public', 'Trades', paramsValidated).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get recent spread data
   * Returns an array of pair name and recent spread data
   *
   * @param {object} [params] - { pair: '' // required, asset pair to get spread data for
   *                                                 since:  // return spread data since given id
   *                                                 (optional.  inclusive)
   *                                                 }
   * @return {Object}  - JSON Object -
   * { XLTCXXBT: [ [ 1498338706, '0.01657700', '0.01660500' ],
   * [ 1498338743, '0.01657100', '0.01660500' ], ... ] , last: 1498339561}
   *  <pair_name> = pair name
   *   array of array entries(<time>, <bid>, <ask>)
   *   last = id to be used as since when polling for new spread data
   *
   */
  getSpread(params = { pair: null, since: null }) {
    return new Promise((resolve, reject) => {
      const paramsValidated = params;
      if (!params || !params.pair) {
        reject("You must at least indicate the trading pair getOCHL({pair: 'tradingpair'})");
      }

      if (params.pair) {
        if (typeof params.pair !== 'string') {
          reject('Pair option must be a string, could be all for all pair or a comma separated values such as ETHUSD,XRPUSD');
        }
        // Remove any whitespace
        paramsValidated.pair = params.pair.replace(/\s/g, '');
      }

      if (params.since) {
        if (typeof params.since !== 'number') {
          reject('Since option must be a unix timestamp');
        }
      }

      this.doRequest('public', 'Spread', paramsValidated).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }


  /**
   * Get TradeBalance
   * Returns an array of asset names and balance amount
   *
   *
   * @param {object} [params] - { aclass: '' // optional, asset class. Default: currency
   *                                                 asset:  // optional, base asset used to
   *                                                 determine balance, default: ZUSD
   *                                                 }
   * @return {Object}  - JSON Object -
   * { eb: '772.2627',  tb: '0.0000',  m: '0.0000',  n: '0.0000',  c: '0.0000',  v: '0.0000',
   * e: '0.0000',  mf: '0.0000' }
   *
   */
  getTradeBalance(params) {
    return new Promise((resolve, reject) => {
      this.doRequest('private', 'TradeBalance', params).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get Balance
   * Returns an array of balance info
   *
   * @return {Object}  - JSON Object -
   * { ZUSD: '0.0000', XLTC: '0.0000000000', XETH: '0.0000000000' }
   *
   */
  getBalance() {
    return new Promise((resolve, reject) => {
      this.doRequest('private', 'Balance').then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get OpenOrders
   * Returns an array of order info in open array with txid as the key
   *
   * @param {object} [params] - { trades: '' //  whether or not to include
   *                                            trades in output (optional.  default = false)
   *                                                 userref:  // restrict results to given user
   *                                                 reference id (optional)
   *                                                 }

   * @return {Object}  - JSON Object -
   * { open:
   * { 'OLMMW7-xxxxx-xxxxx':
   *   { refid: null,
   *     userref: null,
   *     status: 'open',
   *     opentm: 1498506263.838,
   *     starttm: 0,
   *     expiretm: 0,
   *     descr: [Object],
   *     vol: '1.00000000',
   *     vol_exec: '0.00000000',
   *     cost: '0.00000',
   *     fee: '0.00000',
   *     price: '0.00000',
   *     misc: '',
   *     oflags: 'fciq' }, ... } }
   *
   */
  getOpenOrders(params) {
    return new Promise((resolve, reject) => {
      if (params && params.trades && typeof params.trades !== 'boolean') {
        resolve({ error: 'Trades option must be a Boolean, default false' });
      }

      this.doRequest('private', 'OpenOrders', params).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get ClosedOrders
   * Returns an array of closed orders info
   *
   * @param {object} [params] - { trades = whether or not to include trades in output
   *                                                    (optional.  default = false)
   *                                                    userref = restrict results to given user
   *                                                    reference id (optional)
   *                                                    start = starting unix timestamp or order
   *                                                    tx id of results (optional.  exclusive)
   *                                                    end = ending unix timestamp or order
   *                                                    tx id of results (optional.  inclusive)
   *                                                    ofs = result offset
   *                                                    closetime = which time to use (optional)
   *                                                    open close both (default)
   *                                                 }
   *
   * @return {Object}  - JSON Object -
   * { closed:
   * { 'OLMMW7-xxxxx-xxxxx':
   *   { refid: null,
   *     userref: null,
   *     status: 'open',
   *     reason: 'User canceled',
   *     opentm: 1498506263.838,
   *     closetm: 1498506273.838,
   *     starttm: 0,
   *     expiretm: 0,
   *     descr: [Object],
   *     vol: '1.00000000',
   *     vol_exec: '0.00000000',
   *     cost: '0.00000',
   *     fee: '0.00000',
   *     price: '0.00000',
   *     misc: '',
   *     oflags: 'fciq' }, ... } }, count: 5 }
   *
   */
  getClosedOrders(params) {
    return new Promise((resolve, reject) => {
      if (params && params.trades && typeof params.trades !== 'boolean') {
        resolve({ error: 'Trades option must be a Boolean, default false' });
      }

      this.doRequest('private', 'ClosedOrders', params).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get QueryOrders
   * Returns an associative array of orders info
   *
   * @param {object} [params] - { trades = whether or not to include trades in output
   *                                                    (optional.  default = false)
   *                                                    userref = restrict results to given user
   *                                                    reference id (optional)
   *                                                    txid = comma delimited list of transaction
   *                                                    ids to query info about (20 maximum)
   *                                                 }
   *
   * @return {Object}  - JSON Object -
   */
  getQueryOrders(params) {
    return new Promise((resolve, reject) => {
      if (params && params.trades && typeof params.trades !== 'boolean') {
        resolve({ error: 'Trades option must be a Boolean, default false' });
      }

      this.doRequest('private', 'QueryOrders', params).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get TradesHistory
   * Returns an array of trade info
   *
   * @param {object} [params] - { type = type of trade (optional)
   *                                                                  all = all types (default)
   *                                                                   any position = any position
   *                                                                   (open or closed)
   *                                                                   closed position = positions
   *                                                                   that have been closed
   *                                                                   closing position = any trade
   *                                                                   closing all or part of a
   *                                                                   position
   *                                                                   no position = non-positional
   *                                                                   trades
   *                                                   trades = whether or not to include
   *                                                   trades related to position in output
   *                                                   (optional.  default = false)
   *                                                   start = starting unix timestamp or
   *                                                   trade tx id of results (optional.  exclusive)
   *                                                   end = ending unix timestamp or trade
   *                                                   tx id of results (optional.  inclusive)
   *                                                   ofs = result offset
   *                                                 }
   *
   * @return {Object}  - JSON Object -
   */
  getTradesHistory(params) {
    return new Promise((resolve, reject) => {
      if (params && params.trades && typeof params.trades !== 'boolean') {
        resolve({ error: 'Trades option must be a Boolean, default false' });
      }

      this.doRequest('private', 'TradesHistory', params).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get OpenPositions
   * Returns an associative array of open position info
   *
   * @param {object} [params] - {
   *                                                     txid = comma delimited list of transaction
   *                                                     ids to restrict output to
   *                                                     docalcs = whether or not to include
   *                                                     profit/loss calculations
   *                                                     (optional.  default = false)
   *                                                 }
   *
   * @return {Object}  - JSON Object -
   */
  getOpenPositions(params) {
    return new Promise((resolve, reject) => {
      this.doRequest('private', 'OpenPositions', params).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get Ledgers
   * Returns an associative array of ledgers info
   *
   * @param {object} [params] - {
   *                                                     aclass = asset class (optional):
   *                                                     currency (default)
   *                                                     asset = comma delimited list of
   *                                                     assets to restrict output to
   *                                                     (optional.  default = all)
   *                                                     type = type of ledger to
   *                                                     retrieve (optional):
   *                                                       all (default)
   *                                                       deposit
   *                                                       withdrawal
   *                                                       trade
   *                                                       margin
   *                                                     start = starting unix timestamp
   *                                                     or ledger id of results
   *                                                     (optional.  exclusive)
   *                                                     end = ending unix timestamp
   *                                                     or ledger id of results
   *                                                     (optional.  inclusive)
   *                                                     ofs = result offset
   *                                                 }
   *
   * @return {Object}  - JSON Object -
   */
  getLedgers(params) {
    return new Promise((resolve, reject) => {
      this.doRequest('private', 'Ledgers', params).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get Ledgers
   * Returns an associative array of ledgers info
   *
   * @param {object} [params] - {
   *                                                     id = comma delimited list of
   *                                                     ledger ids to query info about
   *                                                     (20 maximum)
   *                                                 }
   *
   * @return {Object}  - JSON Object -
   */
  getQueryLedgers(params) {
    return new Promise((resolve, reject) => {
      if (!params || !params.id) {
        resolve({ error: 'You have to indicate at least one ledger ID' });
      }
      this.doRequest('private', 'QueryLedgers', params).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Get TradeVolume
   * Returns an associative array of ledgers info
   *
   * @param {object} [params] - {
   *                                                     pair = comma delimited list
   *                                                     of asset pairs to get fee info
   *                                                     on (optional)
   *                                                     fee-info = whether or not to
   *                                                     include fee info in results (optional)
   *                                                 }
   *
   * @return {Object}  - JSON Object -
   */
  getTradeVolume(params) {
    return new Promise((resolve, reject) => {
      this.doRequest('private', 'TradeVolume', params).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }

  /**
   * Set AddOrder
   * Returns an associative array of ledgers info
   *
   * @param {object} [params] - See https://www.kraken.com/en-us/help/api#add-standard-order
   *
   * @return {Object}  - JSON Object -
   */
  setAddOrder(params) {
    return new Promise((resolve, reject) => {
      this.doRequest('private', 'AddOrder', params).then((response) => {
        resolve(response);
      }).catch(error => reject(error));
    });
  }
}

module.exports = Kraken;
