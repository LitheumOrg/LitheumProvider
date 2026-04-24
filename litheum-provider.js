/**
 * LitheumProvider - Web3.js compatible provider for Litheum dapps.
 *
 * Routes JSON-RPC requests through the Litheum wallet extension (window.litheum)
 * when available, otherwise falls back to HTTP JSON-RPC.
 *
 * Usage:
 *   <script src="litheum-provider.js"></script>
 *   <script src="web3.min.js"></script>
 *   <script>
 *     var web3 = new Web3(LitheumProvider.create());
 *   </script>
 */
(function (root) {
  'use strict';

  var DEFAULT_RPC_URL = 'https://rpc.litheum.com';

  function LitheumProviderInstance(options) {
    options = options || {};
    this.rpcUrl = options.rpcUrl || DEFAULT_RPC_URL;
    this.requestId = 1;
  }

  /**
   * web3.js v1.x provider interface.
   * Handles single requests and batch requests.
   */
  LitheumProviderInstance.prototype.send = function (payload, callback) {
    var self = this;

    // Batch request
    if (Array.isArray(payload)) {
      var promises = payload.map(function (req) {
        return self._sendSingle(req);
      });
      Promise.all(promises).then(function (results) {
        callback(null, results);
      }).catch(function (err) {
        callback(err, null);
      });
      return;
    }

    // Single request
    self._sendSingle(payload).then(function (result) {
      callback(null, result);
    }).catch(function (err) {
      callback(err, null);
    });
  };

  /**
   * sendAsync is an alias for send (used by some web3.js versions)
   */
  LitheumProviderInstance.prototype.sendAsync = LitheumProviderInstance.prototype.send;

  /**
   * EIP-1193 request method (used by web3.js v4 and modern dapps)
   */
  LitheumProviderInstance.prototype.request = function (args) {
    var payload = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: args.method,
      params: args.params || []
    };
    return this._sendSingle(payload).then(function (response) {
      if (response.error) {
        var err = new Error(response.error.message);
        err.code = response.error.code;
        err.data = response.error.data;
        throw err;
      }
      return response.result;
    });
  };

  /**
   * Send a single JSON-RPC request.
   * Routes through window.litheum if available, otherwise falls back to HTTP.
   */
  LitheumProviderInstance.prototype._sendSingle = function (payload) {
    if (root.litheum) {
      return root.litheum.request({
        method: payload.method,
        params: payload.params
      }).then(function (result) {
        return {
          jsonrpc: '2.0',
          id: payload.id,
          result: result
        };
      }).catch(function (err) {
        return {
          jsonrpc: '2.0',
          id: payload.id,
          error: { code: err.code || -32603, message: err.message }
        };
      });
    }

    // Fallback: HTTP JSON-RPC
    return fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json();
    });
  };

  /**
   * Create a new LitheumProvider instance.
   * @param {Object} options
   * @param {string} options.rpcUrl - Fallback RPC URL (default: https://rpc.litheum.com)
   * @returns {LitheumProviderInstance}
   */
  var LitheumProvider = {
    create: function (options) {
      return new LitheumProviderInstance(options);
    }
  };

  root.LitheumProvider = LitheumProvider;

})(typeof window !== 'undefined' ? window : this);
