import amqplib from 'amqplib';
import config from '../config/local.json' assert { type: "json" };
import { postDocument, deleteDocument } from './elasticsearch.service.js';

const QUEUE_NAME = config.RABBITMQ_QUEUE_NAME;
const EXCHANGE_TYPE = config.RABBITMQ_EXCHANGE_TYPE;
const EXCHANGE_NAME = config.RABBITMQ_EXCHANGE_NAME;
const KEY = config.RABBITMQ_KEY;

let channel;

// Initialize RabbitMQ connection and channel
(async () => {
    try {
        const connection = await amqplib.connect('amqp://localhost');
        channel = await connection.createChannel();
        await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE);
        await channel.assertQueue(QUEUE_NAME);
        channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, KEY);
        console.log('RabbitMQ connection and channel initialized.');
    } catch (error) {
        console.error('Failed to initialize RabbitMQ:', error);
    }
})();

export const producer = (content) => {
    if (!channel) {
        console.error('RabbitMQ channel is not initialized.');
        return;
    }
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(content)));
    setInterval(() => {
        consumer();
    }, 1000);
};

export const consumer = async () => {
    if (!channel) {
        console.error('RabbitMQ channel is not initialized.');
        return;
    }
    try {
        await channel.consume(QUEUE_NAME, async (message) => {
            if (message) {
                const content = message.content.toString();
                channel.ack(message);

                const { operation, body } = JSON.parse(content);

                if (operation === 'STORE') {
                    await postDocument(body);
                } else if (operation === 'DELETE') {
                    await deleteDocument(body);
                }
            }
        });
    } catch (error) {
        console.error('Error consuming RabbitMQ messages:', error);
    }
};

const rabbit = { producer, consumer };

export { rabbit };