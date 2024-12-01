import amqp from 'amqplib/callback_api.js';

const QUEUE = 'PUBSUB';

const sender = (messageData) => {
    amqp.connect('amqp://localhost', (error0, connection) => {
        if (error0) {
            throw error0;
        }

        connection.createChannel(async (error1, channel) => {
            try {
                if (error1) {
                    throw error1;
                }

                const msg = JSON.stringify(messageData);
                channel.assertQueue(QUEUE, {
                    durable: true
                });
                channel.sendToQueue(QUEUE, Buffer.from(msg));

                console.log(`Message sent to ${QUEUE}:`, messageData);
            } catch (err) {
                console.error('Error sending message:', err);
            }
        });
    });
};

export default sender;
