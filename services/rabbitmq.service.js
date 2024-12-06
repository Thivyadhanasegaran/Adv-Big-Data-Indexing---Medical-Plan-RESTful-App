import rabbit from 'amqplib';
import config from '../config/local.json' assert { type: 'json' };
import { postDocument, deleteDocument } from './elasticsearch.service.js';

const QUEUE_NAME = config.RABBITMQ_QUEUE_NAME;
const EXCHANGE_TYPE = config.RABBITMQ_EXCHANGE_TYPE;
const EXCHANGE_NAME = config.RABBITMQ_EXCHANGE_NAME;
const KEY = config.RABBITMQ_KEY;

let channel;

(async () => {
    const connection = await rabbit.connect('amqp://localhost');
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE);
    await channel.assertQueue(QUEUE_NAME);
    channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, KEY);
})();

const producer = (content) => {
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(content)));
    setInterval(() => {
        consumer();
    }, 1000);
};

const consumer = async () => {
    return await channel.consume(QUEUE_NAME, async (message) => {
        const content = message.content.toString();
        await channel.ack(message);

        const { operation, body } = JSON.parse(content);

        if (operation === "STORE") {
            await postDocument(body);
        } else if (operation === "DELETE") {
            await deleteDocument(body);
        }
    });
};

export default { producer, consumer };
