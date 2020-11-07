$("#registerBtn").click(() => {
	fetch("/register", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			username: $("#usernameText").val().trim()
		})
	}).then(a =>a.json()).then(json => {
		if(json.err) return alert("Error: " + json.err);
		if(!json.success) return alert("Error: Failed");

		location.href = "/profile/" + json.profileID;
	});
});