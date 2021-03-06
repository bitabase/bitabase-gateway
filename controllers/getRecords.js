const callarest = require('callarest');

const sendJsonResponse = require('../modules/sendJsonResponse');
const getCollectionDefinition = require('../common/getCollectionDefinition');
const createCollection = require('../common/createCollection');
const flatZip = require('../modules/flatZip');

const getRecordsFromServer = (server, collectionDefinition, headers, databaseName, collectionName, query, callback) => {
  callarest({
    url: `${server}/v1/databases/${databaseName}/records/${collectionName}${query.trim()}`,
    headers: headers
  }, function (error, records) {
    if (error) {
      return callback(error);
    }

    if (records.response.statusCode === 200) {
      return callback(null, records);
    }

    if (records.response.statusCode === 404 && collectionDefinition) {
      createCollection(server, databaseName, collectionName, collectionDefinition, function (error, result) {
        if (error) {
          return callback(error);
        }

        getRecordsFromServer(server, null, headers, databaseName, collectionName, query, callback);
      });
      return;
    }

    callback(records);
  });
};

function sendFinalResponseToServer (allErrors, allRecords, limit, sendTicks, response) {
  if (allErrors.length > 0) {
    console.log({ allErrors });
    return sendJsonResponse(500, 'Unexpected Server Error', response);
  }

  const itemBatches = allRecords.map(records => records.items);
  const items = flatZip(itemBatches, limit);
  const countBatches = allRecords.map(records => records.count);

  const count = countBatches.reduce((count, batchCount) => count + batchCount, 0);

  sendTicks(items.length);

  return sendJsonResponse(200, { count, items }, response);
}

const performGet = config => function (request, response, databaseName, collectionName, usageCollector) {
  getCollectionDefinition(config, databaseName, collectionName, function (error, collectionDefinition) {
    if (error) {
      return sendJsonResponse(error.status, { error: error.message }, response);
    }

    const parsedUrl = new URL(`https://url.test${request.url}`);
    const limit = parseInt(parsedUrl.searchParams.get('limit') || 10);

    const allErrors = [];
    const allRecords = [];
    let serverResponses = 0;

    function sendTicks (ticks) {
      usageCollector.tick(databaseName, collectionName, 'read', ticks || 1);
    }

    function handleRecordsFromServer (error, records) {
      serverResponses = serverResponses + 1;
      if (error) {
        allErrors.push(error);
      }

      if (records && records.response.statusCode === 200) {
        try {
          allRecords.push(JSON.parse(records.body));
        } catch (error) {
          console.log('Error parsing JSON from server');
          console.log(error);
          console.log('Body:\n', records.body, '\n\n\n');
          return allErrors.push(error);
        }
      }

      const isDone = serverResponses === config.servers.length;
      if (isDone) {
        sendFinalResponseToServer(allErrors, allRecords, limit, sendTicks, response);
      }
    }

    const headers = request.headers;
    config.servers.forEach(server =>
      getRecordsFromServer(server, collectionDefinition, headers, databaseName, collectionName, parsedUrl.search, handleRecordsFromServer)
    );
  });
};

module.exports = performGet;
