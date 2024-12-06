import { Client } from '@elastic/elasticsearch';


const client = new Client({
    node: 'http://localhost:9200',
    log: 'trace',
});

const elasticServiceConnection = async () => {
    try {
        const res = await client.info();
        console.log('Elasticsearch is running');
        return { message: 'Elasticsearch is running', client: client, status: 200 };
    } catch (e) {
        console.log(e);
        return { message: 'Elasticsearch is not running', client: client, status: 500 };
    }
};

export { client, elasticServiceConnection };
