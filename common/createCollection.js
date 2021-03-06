const callarest = require('callarest');

function createCollection (server, databaseName, collectionName, collectionDefinition, callback) {
  callarest({
    method: 'post',
    url: `${server}/v1/databases/${databaseName}/collections`,
    body: collectionDefinition.schema
  }, callback);
}

module.exports = createCollection;
