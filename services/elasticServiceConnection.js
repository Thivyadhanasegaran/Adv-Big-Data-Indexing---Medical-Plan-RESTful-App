import { Client } from '@elastic/elasticsearch';

const client = new Client({
    node: 'http://localhost:9200',
    log: 'trace',
});

export const elasticServiceConnection = async () => {
    try {
        const res = await client.info();
        console.log('Elasticsearch is running');
        return { message: 'Elasticsearch is running', client, status: 200 };
    } catch (error) {
        console.error('Error connecting to Elasticsearch:', error);
        return { message: 'Elasticsearch is not running', client, status: 500 };
    }
};

export { client };
