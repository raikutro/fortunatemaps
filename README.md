# fortunatemaps

A TagPro map hosting website

## Technologies
- Node.js
- Express.js
- MongoDB
- jQuery
- Bootstrap 4
- EJS (templating engine)

## Setup
```
git clone https://github.com/ParretLabs/fortunatemaps.git
cd fortunatemaps
npm i
node index.js
```

Make sure to add a .env file to the folder containing the MongoDB Connection URL.

I use **MongoDB Atlas** to host the DB, but you can also use a local MongoDB Connection if you know how to set that up. You also require a **AWS S3** Bucket for files and a **JSONBin** account for token storage.

Testing functions of the site that require account login, also requires a **CTFAuth** API key. **CTFAuth** requires a hosted callback URL, so use **Ngrok** to develop locally.

See the `.env.example` file for an example of credentials.

- Atlas: [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- AWS S3: [https://aws.amazon.com/s3](https://aws.amazon.com/s3)
- JSONBin: [https://jsonbin.org/](https://jsonbin.org/)
- CTFAuth: [https://ctfauth.herokuapp.com/](https://ctfauth.herokuapp.com/)
- Ngrok: [https://ngrok.com/](https://ngrok.com/)