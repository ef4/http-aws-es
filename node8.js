'use strict';

var _awsSdk = require('aws-sdk');

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _http = require('elasticsearch/src/lib/connectors/http');

var _http2 = _interopRequireDefault(_http);

var _utils = require('elasticsearch/src/lib/utils');

var _utils2 = _interopRequireDefault(_utils);

var _zlib = require('zlib');

var _zlib2 = _interopRequireDefault(_zlib);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * A connection handler for Amazon ES.
 *
 * Uses the aws-sdk to make signed requests to an Amazon ES endpoint.
 *
 * @param client {Client} - The Client that this class belongs to
 * @param config {Object} - Configuration options
 * @param [config.protocol=http:] {String} - The HTTP protocol that this connection will use, can be set to https:
 * @class HttpConnector
 */

class HttpAmazonESConnector extends _http2.default {
  constructor(host, config) {
    super(host, config);
    const { protocol, port } = host;
    const endpoint = new _awsSdk2.default.Endpoint(host.host);

    // #10
    if (protocol) endpoint.protocol = protocol.replace(/:?$/, ":");
    if (port) endpoint.port = port;

    this.AWS = _awsSdk2.default;
    this.endpoint = endpoint;
  }

  async request(params, cb) {
    let incoming;
    let timeoutId;
    let request;
    let req;
    let status = 0;
    let headers = {};
    let log = this.log;
    let response;
    const AWS = this.AWS;

    let reqParams = this.makeReqParams(params);
    // general clean-up procedure to run after the request
    // completes, has an error, or is aborted.
    let cleanUp = _utils2.default.bind(function (err) {
      clearTimeout(timeoutId);

      req && req.removeAllListeners();
      incoming && incoming.removeAllListeners();

      if (err instanceof Error === false) {
        err = void 0;
      }

      log.trace(params.method, reqParams, params.body, response, status);
      if (err) {
        cb(err);
      } else {
        cb(err, response, status, headers);
      }
    }, this);

    request = new AWS.HttpRequest(this.endpoint);

    // copy across params
    for (let p in reqParams) {
      request[p] = reqParams[p];
    }
    request.region = AWS.config.region;
    if (params.body) request.body = params.body;
    if (!request.headers) request.headers = {};
    request.headers['presigned-expires'] = false;
    request.headers['Host'] = this.endpoint.host;

    // load creds
    // #1, #3, #12, #15, #16, #21
    const CREDS = await this.getAWSCredentials();

    // Sign the request (Sigv4)
    let signer = new AWS.Signers.V4(request, 'es');
    signer.addAuthorization(CREDS, new Date());

    let send = new AWS.NodeHttpClient();
    req = send.handleRequest(request, null, function (_incoming) {
      incoming = _incoming;
      status = incoming.statusCode;
      headers = incoming.headers;
      response = '';

      let encoding = (headers['content-encoding'] || '').toLowerCase();
      if (encoding === 'gzip' || encoding === 'deflate') {
        incoming = incoming.pipe(_zlib2.default.createUnzip());
      }

      incoming.setEncoding('utf8');
      incoming.on('data', function (d) {
        response += d;
      });

      incoming.on('error', cleanUp);
      incoming.on('end', cleanUp);
    }, cleanUp);

    req.on('error', cleanUp);

    req.setNoDelay(true);
    req.setSocketKeepAlive(true);

    return function () {
      req.abort();
    };
  }

  getAWSCredentials() {
    const { AWS } = this;

    return new Promise((resolve, reject) => {
      AWS.config.getCredentials((err, creds) => {
        if (err) return reject(err);
        return resolve(creds);
      });
    });
  }
}

module.exports = HttpAmazonESConnector;
