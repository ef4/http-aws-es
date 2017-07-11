'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _awsSdk = require('aws-sdk');

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _http = require('elasticsearch/src/lib/connectors/http');

var _http2 = _interopRequireDefault(_http);

var _utils = require('elasticsearch/src/lib/utils');

var _utils2 = _interopRequireDefault(_utils);

var _zlib = require('zlib');

var _zlib2 = _interopRequireDefault(_zlib);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * A connection handler for Amazon ES.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Uses the aws-sdk to make signed requests to an Amazon ES endpoint.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * @param client {Client} - The Client that this class belongs to
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * @param config {Object} - Configuration options
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * @param [config.protocol=http:] {String} - The HTTP protocol that this connection will use, can be set to https:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * @class HttpConnector
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                */

var HttpAmazonESConnector = function (_HttpConnector) {
  _inherits(HttpAmazonESConnector, _HttpConnector);

  function HttpAmazonESConnector(host, config) {
    _classCallCheck(this, HttpAmazonESConnector);

    var _this = _possibleConstructorReturn(this, (HttpAmazonESConnector.__proto__ || Object.getPrototypeOf(HttpAmazonESConnector)).call(this, host, config));

    var protocol = host.protocol,
        port = host.port;

    var endpoint = new _awsSdk2.default.Endpoint(host.host);

    // #10
    if (protocol) endpoint.protocol = protocol.replace(/:?$/, ":");
    if (port) endpoint.port = port;

    _this.AWS = _awsSdk2.default;
    _this.endpoint = endpoint;
    return _this;
  }

  _createClass(HttpAmazonESConnector, [{
    key: 'request',
    value: function () {
      var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(params, cb) {
        var incoming, timeoutId, request, req, status, headers, log, response, AWS, reqParams, cleanUp, p, CREDS, signer, send;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                incoming = void 0;
                timeoutId = void 0;
                request = void 0;
                req = void 0;
                status = 0;
                headers = {};
                log = this.log;
                response = void 0;
                AWS = this.AWS;
                reqParams = this.makeReqParams(params);
                // general clean-up procedure to run after the request
                // completes, has an error, or is aborted.

                cleanUp = _utils2.default.bind(function (err) {
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
                for (p in reqParams) {
                  request[p] = reqParams[p];
                }
                request.region = AWS.config.region;
                if (params.body) request.body = params.body;
                if (!request.headers) request.headers = {};
                request.headers['presigned-expires'] = false;
                request.headers['Host'] = this.endpoint.host;

                // load creds
                // #1, #3, #12, #15, #16, #21
                _context.next = 20;
                return this.getAWSCredentials();

              case 20:
                CREDS = _context.sent;


                // Sign the request (Sigv4)
                signer = new AWS.Signers.V4(request, 'es');

                signer.addAuthorization(CREDS, new Date());

                send = new AWS.NodeHttpClient();

                req = send.handleRequest(request, null, function (_incoming) {
                  incoming = _incoming;
                  status = incoming.statusCode;
                  headers = incoming.headers;
                  response = '';

                  var encoding = (headers['content-encoding'] || '').toLowerCase();
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

                return _context.abrupt('return', function () {
                  req.abort();
                });

              case 29:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function request(_x, _x2) {
        return _ref.apply(this, arguments);
      }

      return request;
    }()
  }, {
    key: 'getAWSCredentials',
    value: function getAWSCredentials() {
      var AWS = this.AWS;


      return new Promise(function (resolve, reject) {
        AWS.config.getCredentials(function (err, creds) {
          if (err) return reject(err);
          return resolve(creds);
        });
      });
    }
  }]);

  return HttpAmazonESConnector;
}(_http2.default);

module.exports = HttpAmazonESConnector;
