const { promisify } = require('util');
const { ErrorObject } = require('./error');

function parseJsonBody (request, callback) {
  if (!callback) {
    return promisify(parseJsonBody)(request);
  }

  let body = [];

  request
    .on('data', function (chunk) {
      body.push(chunk);
    })

    .on('end', function () {
      body = Buffer.concat(body).toString();

      if (body) {
        try {
          return callback(null, JSON.parse(body));
        } catch (error) {
          return callback(new ErrorObject({ code: 400, error, body }));
        }
      }

      return callback(null, null);
    })
    .on('error', function (error) {
      callback(error);
    });
}

module.exports = parseJsonBody;
