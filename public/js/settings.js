const markdownEditor = new SimpleMDE({ element: document.getElementById("biographyInput") });

let localSettings = JSON.parse(localStorage.getItem("localSettings") || "{}");

Object.keys(localSettings).forEach(key => {
	let value = localSettings[key];

	if(typeof value === "boolean") $(`.local-setting[data-setting=${key}]`).prop("checked", value);
});

$(".local-setting").click(function(){
	let value = null;

	if($(this).attr("type") === "checkbox") value = $(this).prop("checked");

	localSettings[$(this).attr("data-setting")] = value;

	saveSettings();
});

$("#settingsBtn").click(() => {
	$("#settingsBtn").prop("disabled", true);
	fetch("/settings", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
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
			"Content-Type": "application/json"
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