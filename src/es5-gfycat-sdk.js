var queryString = require('qs');
var httpService = require('./util/http_browser');

var API_HOSTNAME = 'https://api.gfycat.com';
var API_BASE_PATH = '/v1';

// Check for Promise support
var promisesExist = typeof Promise !== 'undefined';

/**
 * @callback requestCallback - callback function to run when the request completes.
 * @param {Error} error
 * @param response
 */

/**
 * Error handler that supports promises and callbacks
 * @param {string} err - Error message
 * @param {requestCallback} callback
 * @ignore
 */
function _handleErr(err, callback) {
  if (callback) {
    return callback(err);
  } else if (promisesExist) {
    return Promise.reject(err);
  } else {
    throw new Error(err);
  }
}


/**
 * @param {Object} options
 * @param {string} options.client_id - Gfycat API client id.
 * @param {string} options.client_secret - Gfycat API secret.
 * @param {number} options.timeout - (optional) API timeout limit in milliseconds (default is 30000).
 * @class
 */
var GfycatSDK = function(options) {
  if (typeof options === 'object' && options.hasOwnProperty('client_id') && options.hasOwnProperty('client_secret')) {
    this.client_id = options.client_id;
    this.client_secret = options.client_secret;
    this.timeout = options.timeout || 30000;
  } else if (typeof options === 'undefined' || !options) {
    console.error('Although some of our API endpoints can be used without an API key, in order to get the best experience, we strongly recommend that you obtain an API key and initialize this SDK with the provided client_id and client_secret. Get your API key today by visiting https://developers.gfycat.com/signup');
    API_BASE_PATH = '/v1test';
  } else {
    throw new Error('Please provide a valid options object with client_id and client_secret.')
  }

  this.apiUrl = API_HOSTNAME + API_BASE_PATH;
  this.retryLimit = 2;
};


GfycatSDK.prototype = {
  /**
   * Retrieve Oauth token.
   *
   * @param options - (optional if id and secret were provided in constructor)
   * @param {string} options.client_id - Gfycat client id.
   * @param {string} options.client_secret - Gfycat client secret.
   * @param {string} options.grant_type - Oauth grant type. 'client_credentials' by default.
   * @param {requestCallback} callback - (optional) callback function to run when the request completes.
   */
  authenticate: function(options, callback) {
    if (!options) options = {};
    if (!(this.client_id || this.client_secret) && !(options.client_id || options.client_secret)) {
      return _handleErr('Please provide client_id and client_secret in options', callback);
    }

    var options = {
      api: '/oauth',
      endpoint: '/token',
      method: 'POST',
      payload: {
        client_id: options.client_id || this.client_id,
        client_secret: options.client_secret || this.client_secret,
        grant_type: options.grant_type || 'client_credentials'
      }
    }

    var self = this;

    if (callback) {
      return this._request(options, function(err, res) {
        if (!err) {
          self._setToken(res);
          callback(null, res);
        } else callback(err);
      })
    } else {
      return this._request(options)
        .then(function(res) {
          self._setToken(res);
          Promise.resolve(res);
        })
        .catch(function(err) {
          Promise.reject(err);
        })
    }
  },

  /**
   * Retrieve JSON array of reactions/categories.
   *
   * @param {Object} options
   * @param {number} options.gfyCount - number of GIFs to include per category.
   * @param {string} options.locale - locale for requested language.
   * @param {string} options.cursor - cursor for pagination.
   * @param {requestCallback} callback - (optional) callback function to run when the request completes.
   */
  getCategories: function getCategories(options, callback) {
    if (!options) options = {};

    return this._request({
      api: '/reactions',
      endpoint: '/populated',
      method: 'GET',
      query: {
        gfyCount: options.gfyCount || 1,
        count: options.count || null,
        cursor: options.cursor || null,
        locale: options.locale || null
      }
    }, callback);
  },

  /**
   * Retrieve JSON array of GIFs in a specific category/reaction specified by tagName.
   *
   * Note: with the exception of "trending" category,
   * GIFs belonging to all other reaction categories can be retrieved using the search endpoint.
   * If the search term used is a category/reaction name, the search API will automatically give
   * precedence to GIFs that belong in that category.
   *
   * @param {Object} options
   * @param {number} options.gfyCount - number of GIFs to return.
   * @param {string} options.cursor - cursor for pagination.
   * @param {string} options.tagName - name of the category/reaction.
   * @param {requestCallback} callback - (optional) callback function to run when the request completes.
   */
  getTrendingCategories: function getTrendingCategories(options, callback) {
    if (!options) options = {};

    return this._request({
      api: '/reactions',
      endpoint: '/populated',
      method: 'GET',
      query: {
        gfyCount: options.gfyCount || 1,
        cursor: options.cursor || null,
        tagName: options.tagName || 'trending'
      }
    }, callback)
  },

  /**
   * Retrieve JSON array of trending GIFs for a given tag.
   * If no tag name is provided, the API returns overall trending GIFs.
   *
   * @param {Object} options
   * @param {number} options.count - number of GIFs to include per category.
   * @param {string} options.cursor - cursor for pagination.
   * @param {string} options.tagName - (optional) - name of the tag to get trending GIFs from.
   * @param {requestCallback} callback - (optional) callback function to run when the request completes.
   */
  getTrending: function getTrending(options, callback) {
    if (!options) options = {};

    return this._request({
      api: '/gfycats',
      endpoint: '/trending',
      method: 'GET',
      query: {
        count: options.count || 100,
        cursor: options.cursor || null,
        tagName: options.tagName || null
      }
    }, callback);
  },

  /**
   * Retrieve JSON array of trending tags.
   *
   * @param {Object} options
   * @param {string} options.cursor - cursor for pagination.
   * @param {requestCallback} callback - (optional) callback function to run when the request completes.
   */
  getTrendingTags: function getTrendingTags(options, callback) {
    if (!options) options = {};

    return this._request({
      api: '/tags',
      endpoint: '/trending',
      method: 'GET'
    }, callback);
  },

  /**
   * Retrieve JSON array of trending tags.
   *
   * @param {Object} options
   * @param {string} options.cursor - cursor for pagination.
   * @param {number} options.gfyCount - total number of gifs to return for each tag.
   * @param {number} options.tagCount - total number of tags to return.
   * @param {requestCallback} callback - (optional) callback function to run when the request completes.
   */
  getTrendingTagsPopulated: function getTrendingTagsPopulated(options, callback) {
    if (!options) options = {};

    return this._request({
      api: '/tags',
      endpoint: '/trending/populated',
      method: 'GET',
      query: {
        count: options.count || 100,
        cursor: options.cursor || null,
        gfyCount: options.gfyCount || 1
      }
    }, callback);
  },

  /**
   * Search all GIFs. For pagination, please only specify either cursor (& count), or count & start.
   *
   * @param {Object} options
   * @param {string} options.search_text - search query term or phrase.
   * @param {number} options.count - (optional) number of results to return, defaults to 100.
   * @param {number} options.start - (optional) results offset, defaults to 0.
   * @param {string} options.cursor - cursor for pagination.
   * @param {requestCallback} callback - (optional) callback function to run when the request completes.
   */
  search: function(options, callback) {
    return this._request({
      api: '/gfycats',
      endpoint: '/search',
      method: 'GET',
      query: {
        search_text: options.search_text,
        count: options.count || 100,
        start: options.start || null,
        cursor: options.cursor || null
      }
    }, callback);
  },

  /**
   * Search a single gif by gfyId.
   *
   * @param {Object} options
   * @param {string} options.id - gfycat id
   * @param {requestCallback} callback - (optional) callback function to run when the request completes.
   */
  searchById: function(options, callback) {
    return this._request({
      api: '/gfycats',
      endpoint: '/' + options.id,
      method: 'GET'
    }, callback);
  },

  /**
   * Get a list of gifs related to a given gif
   *
   * @param {Object} options
   * @param {string} options.id - gfycat id
   * @param {requestCallback} callback - (optional) callback function to run when the request completes.
   */
  getRelatedContent: function(options, callback) {
    return this._request({
      api: '/gfycats',
      endpoint: '/' + options.id + '/related',
      method: 'GET',
      query: {
        cursor: options.cursor,
        count: options.count,
        from: options.from
      }
    }, callback);
  },

  /**
   * @param {Object} options
   * @param {string} options.uploadKey - the key of the upload.
   * @param {string[]} options.tags - the tags to associate with this gfycat
   * @param {requestCallback} callback - (optional) callback function to run when the request completes.
   */
  artifacts: function(options, callback) {
    return this._request({
      api: '/gifartifacts',
      endpoint: '',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      method: 'POST',
      payload: {
        uploadKey: options.uploadKey,
        tags: options.tags
      }
    }, callback);
  },

  /**
   * @param {Object} options
   * @param {string} options.search_text - (optional) Search query
   * @param {string} options.cursor - (optional) Cursor for pagination
   * @param {number} options.count - (optional) Number of GIFs to return.
   * @param {requestCallback} callback - (optional) callback function to run when the request completes.
   */
  stickers: function(options, callback) {
    return this._request({
      api: '/stickers',
      endpoint: options.search_text ? '/search' : '',
      method: 'GET',
      query: {
        cursor: options.cursor,
        count: options.count,
        search_text: options.search_text
      }
    });
  },

  /**
   * Prepares the HTTP request and query string
   *
   * @param {Object} options
   * @param {string} options.api - API type.
   * @param {string} options.endpoint - The API method.
   * @param {string} options.method - The http method to be used.
   * @param {Object} options.payload - JSON data to be sent in POST requests.
   * @param {Object} options.query - (optional) Query string parameters.
   * @param {number} options.timeout - (optional) API timeout limit in milliseconds.
   * @param {requestCallback} callback - (optional) callback function to run when the request completes.
   * @ignore
   */
  _request: function(options, callback) {
    if (!callback && !promisesExist) {
      throw new Error('Callback must be provided if promises are unavailable');
    }

    if (typeof options === 'undefined' || !options) {
      return _handleErr('Please provide valid options object', callback);
    }

    var counter = options.counter || 0;

    if (counter >= this.retryLimit) {
      if (callback) _handleErr('Retry limit reached', callback);
      else return Promise.reject('Retry limit reached')
    }

    var token = this.access_token ?
      'Bearer ' + this.access_token : null;

    if (token) {
      if (typeof options.headers === 'undefined') options.headers = {};
      options.headers['Authorization'] = this.access_token;
    }

    var query = '';

    if (typeof options.query === 'object' && Object.keys(options.query).length) {

      // Omit null values from querystring
      for (var key in options.query) {
        // Using == intentionally to match null and undefined
        if (options.query[key] == null) {
          delete options.query[key]
        }
      }

      query = '?' + queryString.stringify(options.query);
    }

    var httpOptions = {
      request: {
        headers: options.headers || null,
        method: options.method,
        payload: options.payload || null,
        url: this.apiUrl + options.api + options.endpoint + query
      },
      timeout: options.timeout || this.timeout
    };

    var self = this;

    if (callback) {
      var resolve = function(res) {
        callback(null, res);
      };
      var reject = function(err) {
        if (err === 401 && options.api !== '/oauth') {
          self.authenticate({}, function(err, res) {
            if (err) callback(err);
            else {
              options.counter = counter + 1;
              return self._request(options, callback);
            }
          })
        } else {
          callback(err);
        }
      };
      httpService.request(httpOptions, resolve, reject);
    }

    else {
      return new Promise(function(resolve, reject) {
        httpService.request(httpOptions, resolve, reject)
      })
        .then(function(res) {
          return Promise.resolve(res);
        })
        .catch(function(err) {
          if (err === 401 && options.api !== '/oauth') {
            return self.authenticate({})
              .then(function(res) {
                options.counter = counter + 1;
                return self._request(options);
              })
              .catch(function(err) {
                return Promise.reject(err);
              });
          } else {
            return Promise.reject(err);
          }
        });
    }
  },

  _setToken: function(options) {
    this.access_token = options.access_token;
    this.token_type = options.token_type;
  }
};

module.exports = GfycatSDK;
