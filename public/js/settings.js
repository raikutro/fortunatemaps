const markdownEditor = new SimpleMDE({ element: document.getElementById("biographyInput") });

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