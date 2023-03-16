# fortunatemaps

A TagPro map hosting website

## Stack
- Node.js
- Express.js
- MongoDB
- jQuery
- Bootstrap 4
- EJS (templating engine)

## Setup
```
git clone https://github.com/raikutro/fortunatemaps.git
cd fortunatemaps
npm i
node index.js
```

Make sure to add a .env file to the folder containing the MongoDB Connection URL.

I use **MongoDB Atlas** to host the DB, but you can also use a local MongoDB Connection if you know how to set that up. You also require a **AWS S3** Bucket for map file storage.

Testing functions of the site that require account login, do not require the **CTFAuth** API. Check out the .env.example file to see how.
**CTFAuth** requires a domain callback URL, so use **ngrok** to tunnel your IP if you use the API.

See the `.env.example` file for an example of credentials.

- **Atlas**: [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- **AWS S3**: [https://aws.amazon.com/s3](https://aws.amazon.com/s3)
- **CTFAuth**: [https://ctfauth.herokuapp.com/](https://ctfauth.herokuapp.com/)
- **ngrok**: [https://ngrok.com/](https://ngrok.com/)