const { Kafka } = require('kafkajs');
const { KAFKA_TOPICS } = require('./constants');

let kafka = null;
let producer = null;
const consumers = new Map();

function createKafka(config = {}) {
  if (kafka) return kafka;

  kafka = new Kafka({
    clientId: config.clientId || 'foodflow',
    brokers: (config.brokers || process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    retry: { initialRetryTime: 300, retries: 10 },
  });

  return kafka;
}

async function getProducer(config = {}) {
  if (producer) return producer;

  createKafka(config);
  producer = kafka.producer();
  await producer.connect();
  return producer;
}

async function publishEvent(topic, message, config = {}) {
  const prod = await getProducer(config);
  await prod.send({
    topic,
    messages: [{
      key: message.id || message.orderId || message.userId || String(Date.now()),
      value: JSON.stringify({ ...message, timestamp: new Date().toISOString() }),
    }],
  });
}

async function createConsumer(groupId, topics, handler, config = {}) {
  createKafka(config);
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();

  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const value = JSON.parse(message.value.toString());
        await handler(topic, value, { partition, offset: message.offset });
      } catch (err) {
        console.error(`Error processing Kafka message on ${topic}:`, err);
      }
    },
  });

  consumers.set(groupId, consumer);
  return consumer;
}

async function disconnectKafka() {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
  for (const [, consumer] of consumers) {
    await consumer.disconnect();
  }
  consumers.clear();
}

module.exports = {
  createKafka,
  getProducer,
  publishEvent,
  createConsumer,
  disconnectKafka,
  KAFKA_TOPICS,
};
