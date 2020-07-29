const URL_VARS = getUrlVars();

if(URL_VARS["q"]) {
	$("#searchText").val(decodeURIComponent(URL_VARS["q"]));
}

$("#searchForm").submit(() => {
	location.href = "/search?q=" + encodeURIComponent($("#searchText").val());
});

function getUrlVars(){
	let vars = [], hash;
	let hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');

	for(let i = 0; i < hashes.length; i++){
		hash = hashes[i].split('=');
		hash[1] = unescape(hash[1]);
		vars.push(hash[0]);
		vars[hash[0]] = hash[1];
	}

	return vars;
}