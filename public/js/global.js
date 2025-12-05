let userLocalSettings = JSON.parse(localStorage.getItem("localSettings") || "{}");

if(userLocalSettings.leftAlignedNavbar) $(".navbar").addClass("left-aligned");

marked.setOptions({breaks: true});

Array.from(document.querySelectorAll('[data-compressed-layout]')).forEach(async (elem) => {
	let compressedBlob = base64ToBlob(elem.dataset.compressedLayout);
	let decompressedBlob = await decompressBlob(compressedBlob);
	
	let simpleObj = URL.createObjectURL(decompressedBlob);

	const pngImage = await blobToImage(decompressedBlob);

	elem.style.backgroundImage = `url(${simpleObj})`;
	elem.style.imageRendering = 'pixelated';

	compressedBlob = base64ToBlob(elem.dataset.compressedLogic);
	decompressedBlob = await decompressBlob(compressedBlob);
	const mapJSON = msgpackr.unpack(await decompressedBlob.arrayBuffer());

	const mapPreviewCanvas = await window.GENERATE_MAP_PREVIEW(pngImage, mapJSON);

	mapPreviewCanvas.toBlob((blob) => {
		const url = URL.createObjectURL(blob);
		elem.style.backgroundImage = `url(${url})`;
		elem.style.imageRendering = 'auto';
	}, elem.dataset.quality === 'hq' ? "image/png" : "image/jpeg", elem.dataset.quality === 'hq' ? undefined : 0.2);
});

if(location.hash.startsWith('#err=')) {
	const errorID = atob(location.hash.replace('#err=', ''));
	const errorMessage = window.SETTINGS.ERRORS[errorID];

	alert(`Error: [${errorMessage.code}] ${errorMessage.err}`);
	location.hash = "";
}

function base64ToBlob(b64Data, contentType) {
	return new Blob([Uint8Array.from(atob(b64Data), char => char.charCodeAt(0))], { type: contentType || "application/octet-stream" });
}

async function decompressBlob(blob) {
	let ds = new DecompressionStream("gzip");
	let decompressedStream = blob.stream().pipeThrough(ds);
	return await new Response(decompressedStream).blob();
}

function blobToImage(blob) {
	return new Promise(resolve => {
		const url = URL.createObjectURL(blob)
		let img = new Image()
		img.onload = () => {
			URL.revokeObjectURL(url)
			resolve(img)
		}
		img.src = url
	})
}

function getCsrfToken() {
	const cookieName = (window.SETTINGS && window.SETTINGS.SITE && window.SETTINGS.SITE.CSRF_COOKIE_NAME) || 'fm_csrf';
	const cookiePair = document.cookie.split('; ').find(row => row.startsWith(cookieName + '='));
	return cookiePair ? decodeURIComponent(cookiePair.split('=')[1]) : '';
}

window.getCsrfToken = getCsrfToken;
