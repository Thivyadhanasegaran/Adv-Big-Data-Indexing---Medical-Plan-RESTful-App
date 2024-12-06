import { client } from './elasticServiceConnection.js';

const INDEX_NAME = "planindex";

client.ping((error) => {
    if (error) {
        console.trace('Elasticsearch Cluster is down!');
    }
    console.log('Elastic search client is working fine!');
});

let MapOfDocuments = {};
let listOfKeys = [];

const convertMapToDocumentIndex = async (jsonObject, parentId, objectName, parentObjId) => {
    if (!jsonObject || typeof jsonObject !== 'object') return {}; 

    const valueMap = {};
    const map = {};

    for (const [key, value] of Object.entries(jsonObject)) {
        const redisKey = `${jsonObject.objectType}:${parentId}`;
        if (Array.isArray(value)) {
            await convertToList(value, jsonObject.objectId, key, parentObjId);
        } else if (typeof value === 'object') {
            await convertMapToDocumentIndex(value, jsonObject.objectId, key, parentObjId);
        } else {
            valueMap[key] = value;
            map[redisKey] = valueMap;
        }
    }

    if (objectName === "plan") {
        valueMap["plan_join"] = {
            "parent": "",
            "name": objectName
        };
    } else if (objectName.match(/^-?\d+$/)) {
        parentId = parentObjId;
        valueMap["plan_join"] = {
            "parent": parentObjId,
            "name": "linkedPlanServices"
        };
    } else {
        valueMap["plan_join"] = {
            "name": objectName,
            "parent": parentId
        };
    }

    const id = `${parentId}:${jsonObject.objectId}`;
    if (!!jsonObject?.objectId) MapOfDocuments[id] = valueMap;
    return map;
};

const convertToList = async (jsonArray, parentId, objectName, parentObjId) => {
    const list = [];
    for (let i = 0; i < jsonArray.length; i++) {
        let value = jsonArray[i];
        if (Array.isArray(value)) {
            value = await convertToList(value, parentId, objectName, parentObjId);
        } else if (typeof value === 'object') {
            value = await convertMapToDocumentIndex(value, parentId, objectName);
        }
        list.push(value);
    }
    return list;
};

const convertToKeysList = async (jsonArray) => {
    let list = [];
    for (let value of jsonArray) {
        if (Array.isArray(value)) {
            value = await convertToKeysList(value);
        } else if (typeof value === 'object') {
            value = await convertToKeys(value);
        }
        list.push(value);
    }
    return list;
};

const convertToKeys = async (jsonObject) => {
    if (!jsonObject || typeof jsonObject !== 'object') {
        console.error("Invalid or null jsonObject passed to convertToKeys:", jsonObject);
        return {}; 
    }

    const map = {};
    const valueMap = {};

    for (const [key, value] of Object.entries(jsonObject)) {
        const redisKey = jsonObject["objectId"];
        if (Array.isArray(value)) {
            await convertToKeysList(value);
        } else if (typeof value === 'object') {
            await convertToKeys(value);
        } else {
            valueMap[key] = value;
            map[redisKey] = valueMap;
        }
    }

    if (jsonObject["objectId"]) {
        listOfKeys.push(jsonObject["objectId"]);
    }
    return map;
};

const postDocument = async (plan) => {
    try {
        MapOfDocuments = {};
        await convertMapToDocumentIndex(plan, "", "plan", plan.objectId);
        for (const [key, value] of Object.entries(MapOfDocuments)) {
            const [parentId, objectId] = key.split(":");
            await client.index({
                index: INDEX_NAME,
                id: objectId,
                routing: parentId,
                body: value,
            });
        }
        return { message: 'Document has been posted', status: 200 };
    } catch (e) {
        console.log("Error", e);
        return { message: 'Document has not been posted', status: 500 };
    }
};

const deleteDocument = async (jsonObject) => {
    if (!jsonObject || typeof jsonObject !== 'object') {
        console.error("Invalid or null jsonObject provided to deleteDocument:", jsonObject);
        return;
    }

    listOfKeys = [];
    await convertToKeys(jsonObject);

    for (const key of listOfKeys) {
        client.delete({
            index: INDEX_NAME,
            id: key,
        }, (err, res) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('Indexes have been deleted!', res);
            }
        });
    }
};

export {
    postDocument,
    deleteDocument
};
