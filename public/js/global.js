let userLocalSettings = JSON.parse(localStorage.getItem("localSettings") || "{}");

if(userLocalSettings.leftAlignedNavbar) $(".navbar").addClass("left-aligned");

marked.setOptions({breaks: true});

Array.from(document.querySelectorAll('[data-src]')).forEach(elem => {
	let lazyImage = new Image();

	lazyImage.onload = () => {
		elem.src = lazyImage.src;
		elem.style.imageRendering = '';
	};

	if(elem.dataset.lazyrendermode) elem.style.imageRendering = elem.dataset.lazyrendermode;
	lazyImage.src = elem.dataset.src;
});

if(location.hash.startsWith('#err=')) {
	const errorID = atob(location.hash.replace('#err=', ''));
	const errorMessage = window.SETTINGS.ERRORS[errorID];

	alert("Error: " + errorMessage);
	location.hash = "";
}