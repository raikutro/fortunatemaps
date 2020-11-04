const AWS = require('aws-sdk');
AWS.config.update({region: 'us-west-1'});

const BUCKET_NAME = process.env.BUCKET_NAME;

const s3 = new AWS.S3({apiVersion: '2006-03-01'});

module.exports.uploadMapImages = ({id, previewJPEGBase64, thumbnailJPEGBase64}) => {
	return new Promise(async (resolve, reject) => {
		let previewData = await uploadFileUsingBase64(
			`preview_${id}.jpeg`,
			previewJPEGBase64.slice(previewJPEGBase64.indexOf(","))
		).catch(reject);

		let thumbnailData = await uploadFileUsingBase64(
			`thumbnail_${id}.jpeg`,
			thumbnailJPEGBase64.slice(thumbnailJPEGBase64.indexOf(","))
		).catch(reject);

		resolve({previewData, thumbnailData});
	});
};

module.exports.getPreviewMapImage = (id) => {
	return new Promise(async (resolve, reject) => {
		if(isNaN(Number(id))) return reject("Invalid ID");

		let previewFile = await getFile(`preview_${id}.jpeg`).catch(reject);
		if(!previewFile) return reject("Failed to retrieve preview image.");
		// console.log(previewFile);

		resolve(previewFile.Body);
	});
};

module.exports.getThumbnailMapImage = (id) => {
	return new Promise(async (resolve, reject) => {
		if(isNaN(Number(id))) return reject("Invalid ID");

		let thumbnailFile = await getFile(`thumbnail_${id}.jpeg`).catch(reject);
		if(!thumbnailFile) return reject("Failed to retrieve thumbnail image.");
		// console.log(thumbnailFile);

		resolve(thumbnailFile.Body);
	});
};

function getFile(fileName) {
	return new Promise((resolve, reject) => {
		// console.log(fileName);
		let params = {Bucket: BUCKET_NAME, Key: fileName};

		s3.getObject(params, (err, data) => {
			if(err) return reject(err);
			if(!data) return reject("No data was uploaded.");

			resolve(data);
		});
	});
}

function uploadFileUsingBase64(fileName, base64) {
	return new Promise((resolve, reject) => {
		let uploadParams = {Bucket: BUCKET_NAME, Key: fileName};

		uploadParams.Body = Buffer.from(base64, 'base64');
		s3.upload(uploadParams, (err, data) => {
			if(err) return reject(err);
			if(!data) return reject("No data was uploaded.");

			resolve(data);
		});
	});
}