const markdownEditor = new SimpleMDE({ element: document.getElementById("biographyInput") });
const texturePackSelectorElem = document.getElementById("texturePackSelector");

let localSettings = JSON.parse(localStorage.getItem("localSettings") || "{}");

SETTINGS.TEXTURES.forEach(pack => {
	texturePackSelectorElem.innerHTML += `<option value="${pack.url}">${pack.name} by ${pack.author}</option>`;
});

Object.keys(localSettings).forEach(key => {
	let value = localSettings[key];

	if(typeof value === "boolean") $(`.local-setting[data-setting=${key}]`).prop("checked", value);
	if(typeof value === "string") $(`.local-setting[data-setting=${key}]`).val(value);
});

$(".local-setting[type='checkbox']").on("click", function(){
	let value = $(this).prop("checked");

	localSettings[$(this).attr("data-setting")] = value;

	saveSettings();
});

$("select.local-setting").on("change", function(){
	let value = $(this).val();

	console.log(value);

	localSettings[$(this).attr("data-setting")] = value;

	saveSettings();
});

$("#settingsBtn").click(() => {
	$("#settingsBtn").prop("disabled", true);
	fetch("/settings", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-CSRF-Token": getCsrfToken()
		},
		body: JSON.stringify({
			discord: $("#discordSocialInput").val().trim(),
			reddit: $("#redditSocialInput").val().trim(),
			bio: markdownEditor.value()
		})
	}).then(a =>a.json()).then(json => {
		$("#settingsBtn").prop("disabled", false);
		if(json.err) return alert("Error: " + json.err);
		if(!json.success) return alert("Error: Failed");

		alert("Saved settings!");
	});
});

$("#sendAnnouncementBtn").click(() => {
	$("#sendAnnouncementBtn").prop("disabled", true);
	fetch("/send_announcement", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-CSRF-Token": getCsrfToken()
		},
		body: JSON.stringify({
			announcement: prompt("Announcement:")
		})
	}).then(a =>a.json()).then(json => {
		$("#sendAnnouncementBtn").prop("disabled", false);
		if(json.err) return alert("Error: " + json.err);
		if(!json.success) return alert("Error: Failed");

		alert("Sent!");
	});
});

function saveSettings(){
	localStorage.setItem("localSettings", JSON.stringify(localSettings));
}
