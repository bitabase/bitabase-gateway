const callarest = require('callarest');
const selectRandomItemFromArray = require('../modules/selectRandomItemFromArray');

function createUsageCollector () {
  const accumulator = new Map();

  function tick (databaseName, collectionName, eventType, increment = 1) {
    const eventPath = `${databaseName}:${collectionName}:${eventType}`;
    if (!accumulator.get(eventPath)) {
      accumulator.set(eventPath, increment);
    } else {
      const currentValue = accumulator.get(eventPath);
      accumulator.set(eventPath, currentValue + increment);
    }
  }

  function reset () {
    accumulator.clear();
  }

  return {
    accumulator,
    reset,
    tick
  };
}

function setupUsageCollector (config) {
  const usageCollector = createUsageCollector();

  function sendUsage (callback) {
    const accumlationData = Object.fromEntries(usageCollector.accumulator);
    usageCollector.reset();

    const managerUrl = selectRandomItemFromArray(config.managers || []);
    if (!managerUrl) {
      return console.log('usageCollection could not send data as no managers exist');
    }

    callarest({
      method: 'post',
      url: `${managerUrl}/v1/usage-batch`,
      body: JSON.stringify(accumlationData),
      headers: {
        'X-Internal-Secret': config.secret
      }
    }, function (error, result) {
      if (error) {
        if (error.code === 'ECONNREFUSED') {
          return callback && callback(new Error('ECONNREFUSED while running /v1/usage-batch'));
        }
        return callback && callback(error);
      }

      callback && callback(null, result);
    });
  }

  const timer = setInterval(function () {
    sendUsage();
  }, 5000);

  function stop (callback) {
    clearInterval(timer);
    sendUsage(callback);
  }

  return {
    stop,
    usageCollector
  };
}

module.exports = setupUsageCollector;
