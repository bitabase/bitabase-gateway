const test = require('tape');
const writeResponse = require('write-response');
const finalStream = require('final-stream');
const { promisify } = require('util');

const httpRequest = require('../helpers/httpRequest');
const createMockServer = require('../helpers/createMockServer');

const createServer = require('../../server');

test('[post] missing collection -> missing db -> proxy to a none existing collection', async t => {
  t.plan(2);

  const mockServer = createMockServer(8000, function (request, response) {
    writeResponse(404, {}, response);
  });
  const mockManager = createMockServer(8001, function (request, response) {
    writeResponse(404, {}, response);
  });

  const server = await createServer({
    secret: 'test',
    servers: ['http://0.0.0.0:8000'],
    managers: ['http://0.0.0.0:8001']
  }).start();

  const result = await httpRequest('/one', {
    method: 'post',
    data: { a: 1 },
    baseURL: 'http://localhost:8002',
    headers: {
      host: 'notfound.bitabase.test'
    }
  });

  mockServer.close();
  mockManager.close();
  await promisify(server.stop)();

  t.equal(result.status, 404);

  t.deepEqual(result.data, {
    error: 'the collection "notfound/one" does not exist'
  });
});

test('[post] missing collection -> existing db -> proxy to a none existing collection', async t => {
  t.plan(2);

  const mockServer = createMockServer(8000, function (request, response) {
    writeResponse(404, {}, response);
  });
  const mockManager = createMockServer(8001, function (request, response) {
    writeResponse(404, {}, response);
  });

  const server = await createServer({
    secret: 'test',
    servers: ['http://0.0.0.0:8000'],
    managers: ['http://0.0.0.0:8001']
  }).start();

  const result = await httpRequest('/notfoundcollection', {
    method: 'post',
    data: { a: 1 },
    baseURL: 'http://localhost:8002',
    headers: {
      host: 'founddb.bitabase.test'
    }
  });

  mockServer.close();
  mockManager.close();
  await promisify(server.stop)();

  t.equal(result.status, 404);

  t.deepEqual(result.data, {
    error: 'the collection "founddb/notfoundcollection" does not exist'
  });
});

test('[post] missing collection -> proxy to an existing collection', async t => {
  t.plan(5);

  const mockServer = createMockServer(8000, function (request, response) {
    finalStream(request, function (error, rawBody) {
      if (error) {
        throw error;
      }

      if (request.method === 'POST') {
        let body;
        try {
          body = JSON.parse(rawBody);
        } catch (error) {}

        writeResponse(201, {
          ...body,
          id: Date.now()
        }, response);

        return;
      }

      t.fail();
    });
  });
  const mockManager = createMockServer(8001, function (request, response) {
    writeResponse(200, {}, response);
  });

  const server = await createServer({
    secret: 'test',
    servers: ['http://0.0.0.0:8000'],
    managers: ['http://0.0.0.0:8001']
  }).start();

  const createResponse = await httpRequest('/foundcl', {
    method: 'post',
    data: {
      firstName: 'Joe',
      lastName: 'Bloggs',
      email: 'joe.bloggs@example.com'
    },
    baseURL: 'http://localhost:8002',
    headers: {
      host: 'founddb.bitabase.test'
    }
  });

  mockServer.close();
  mockManager.close();
  await promisify(server.stop)();

  t.equal(createResponse.status, 201);
  t.equal(createResponse.data.firstName, 'Joe');
  t.equal(createResponse.data.lastName, 'Bloggs');
  t.equal(createResponse.data.email, 'joe.bloggs@example.com');
  t.ok(createResponse.data.id);
});
