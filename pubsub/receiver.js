import amqp from 'amqplib/callback_api.js';
import { postDocument, deleteDocument } from '../services/elasticsearch.service.js';

const QUEUE = 'PUBSUB';

const receiver = () => {
    console.log('Receiver running');
    amqp.connect('amqp://localhost', (error0, connection) => {
        if (error0) {
            throw error0;
        }
        
        connection.createChannel(async (error1, channel) => {
            if (error1) {
                throw error1;
            }

            channel.assertQueue(QUEUE, {
                durable: true
            });

            console.log(` [*] Waiting for messages in ${QUEUE}. To exit press CTRL+C`);

            channel.consume(QUEUE, async (msg) => {
                console.log(" [x] Received message from queue");

                const { operation, body } = JSON.parse(msg.content.toString());
                const planObject = body;

                if (operation === 'POST') {
                    const elasticResponse = await postDocument(planObject);
                    if (elasticResponse.status === 200) {
                        console.log('Document has been posted');
                        channel.ack(msg);
                        channel.checkQueue(QUEUE, (err, ok) => {
                            console.log(ok.messageCount);
                        });
                    }
                } else if (operation === 'DELETE') {
                    const elasticResponse = await deleteDocument(planObject);
                    if (elasticResponse.status === 200) {
                        console.log('Document has been deleted');
                        channel.ack(msg);
                        channel.checkQueue(QUEUE, (err, ok) => {
                            console.log(ok.messageCount);
                        });
                    }
                }
            }, {
                noAck: false
            });
        });
    });
};

export default receiver;
