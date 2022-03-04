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