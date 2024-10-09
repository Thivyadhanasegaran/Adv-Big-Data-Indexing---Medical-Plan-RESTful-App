# Adv-Big-Data-Indexing---Medical-Plan-RESTful-App

This project provides a REST API to handle any structured data in JSON format.
 It supports Create, Read, and Delete operations (CRD), validates incoming data against a JSON schema, 
 and stores data in a key-value store. The API is designed with versioning, status codes, headers, and 
 validation mechanisms for a scalable and structured API architecture.

Features:
CRUD Operations: Supports POST, GET, and DELETE.
Data Validation: Incoming JSON payloads are validated against a predefined schema.
Conditional Read: Supports conditional read based on data changes.
Key-Value Store: Data is stored in a key-value store for efficient retrieval.
REST API Semantics: Implements conditional read 
Versioning: API versioning through URI (/v1/).

Method	URI	Description:
POST	/v1/plan - 	Creates a new entry in the store.
GET	/v1/plan/:id	Retrieves a specific entry by ID, with conditional read support.
DELETE	/v1/plan/:id	Deletes an entry by ID.

Status Code:
200	Success (GET, DELETE)
201	Created (POST)
400	Bad Request (Invalid JSON or Schema)
404	Not Found (When the entry does not exist)

Headers:
Content-Type: application/json 
If-None-Match:  Used for conditional read with ETags.
ETag: Included in responses to represent the data version (used for conditional reads).

JSON Data Model
This API accepts structured JSON data, validated against the following schema:


API Endpoints:
1. Create Data Entry (POST /v1/plan)
Creates a new data entry in the key-value store.

Request:
URI: /v1/plan
Method: POST
Body: Valid JSON that adheres to the schema.
Headers: Content-Type: application/json
Example Request Body

Response:
Status Code: 201 Created
Body: A JSON object confirming the creation.
Headers: ETag header containing a unique hash of the created object for conditional reads.

2. Get data (GET /v1/plan/:id)
Fetches a data entry by its ID. Supports conditional read based on ETag values.

Request:
URI: /v1/plan/:id
Method: GET
Headers (Optional): If-None-Match: <etag>
Response:
Status Code: 200 OK if the data is fetched.
Status Code: 304 Not Modified if the data has not changed and the ETag matches.
Status Code: 404 Not Found if the entry does not exist.


3. Delete data (DELETE /v1/plan/:id)
Deletes a specific data entry by its ID.

Request:
URI: /v1/plan/:id
Method: DELETE
Response:
Status Code: 200 OK if the entry is successfully deleted.
Status Code: 404 Not Found if the entry does not exist.
